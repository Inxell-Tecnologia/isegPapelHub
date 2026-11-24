import { Router } from 'express';
import { favoriteIdsAmong } from './favorites.js';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { AuditAction, GrantResourceType, Permission } from '@gdoc/shared';
import type {
  CreateFolderRequest,
  DocumentCodeInUseResponse,
  FolderCycleResponse,
  FolderDownloadManifestEntry,
  FolderDownloadManifestLimitExceededResponse,
  FolderDownloadManifestResponse,
  FolderNameConflictResponse,
  FolderListItemResponse,
  FolderResponse,
  FolderRestoreResponse,
  MoveBatchItemResult,
  MoveBatchLimitExceededResponse,
  MoveBatchRequest,
  MoveBatchResponse,
  MoveItemRequest,
  RenameFolderRequest,
} from '@gdoc/shared';
import type { PoolClient } from 'pg';
import { config } from '../config.js';
import {
  assertNoCycleAfterMove,
  collectSubtreeFolderIds,
  findFolderById,
  FolderCycleError,
  hasFolderNameConflict,
  traverseFolderSubtree,
  wouldCreateCycle,
  type FolderRow,
  type SubtreeManifest,
} from '../lib/folder-tree.js';
import { canReorganize, hasAccess, isAdminOfUnit, visibleResourceClause } from '../lib/access.js';
import {
  buildVisitBreadcrumb,
  listVisitContents,
  withSharedResource,
} from '../lib/cross-unit-share.js';
import {
  fileSummaryColumns,
  nonObsoleteClause,
  visibleRegistrationClause,
  toFileSummaryResponse,
  type FileSummaryRow,
} from '../lib/document-control.js';

function toFolderResponse(row: FolderRow): FolderResponse {
  return {
    id: row.id,
    unitId: row.unit_id,
    ownerId: row.owner_id,
    parentId: row.parent_id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Subpasta da listagem já com a contagem filtrada (design.md D1/D3 de `contagem-de-documentos-nas-pastas`). */
type ListedFolderRow = FolderRow & { document_count: number };

function toFolderListItemResponse(row: ListedFolderRow): FolderListItemResponse {
  return { ...toFolderResponse(row), documentCount: row.document_count };
}

const MAX_BREADCRUMB_DEPTH = 1000;

/**
 * Sobe a cadeia `parent_id` a partir da pasta corrente até a raiz, montando
 * a trilha (design.md D5). O walk roda na mesma transação tenant já aberta
 * pelo chamador — RLS garante que nenhuma pasta de outra unidade apareça
 * aqui. **Não** é mais verdade que todo ancestral pertence ao mesmo dono
 * (comentário antigo, já falso desde o Épico 3: `ensureFolderPath` cria
 * pasta sob âncora de terceiro validada por `upload`, e `mover-e-renomear-itens`
 * torna isso rotineiro, design.md Risks) — este walk não checa acesso ao
 * subir, então nomes de pastas ancestrais podem aparecer para quem não tem
 * `view` sobre elas; vazamento de **nome** conhecido e aceito, não fechado
 * por esta mudança. Guarda de ciclo (conjunto de visitados + teto de
 * profundidade, design.md D3): termina com erro tratado em vez de laço
 * infinito, caso uma linha inconsistente exista por qualquer via.
 */
async function buildBreadcrumb(client: PoolClient, folder: FolderRow): Promise<FolderRow[]> {
  const breadcrumb: FolderRow[] = [];
  const visited = new Set<string>([folder.id]);
  let parentId = folder.parent_id;
  while (parentId) {
    if (visited.has(parentId) || breadcrumb.length >= MAX_BREADCRUMB_DEPTH) {
      throw new FolderCycleError();
    }
    const parent = await findFolderById(client, parentId);
    if (!parent) break;
    visited.add(parent.id);
    breadcrumb.unshift(parent);
    parentId = parent.parent_id;
  }
  return breadcrumb;
}

/**
 * Itens próprios OU com grant `view`, por tipo (design.md D8) — fecha a
 * US 2.1 cenário 2. Sem herança: filhos de uma pasta liberada só aparecem
 * se também forem próprios ou liberados, nunca por estarem dentro dela.
 */
async function listContents(
  client: PoolClient,
  ctx: TenantContext,
  folderId: string | null,
): Promise<{ folders: ListedFolderRow[]; files: FileSummaryRow[] }> {
  // Admin da unidade (design.md D2): o fragmento de visibilidade vira `TRUE`
  // ou um literal de `unit_id`, sem referenciar `ownerIdParam` — por isso o
  // placeholder do dono só entra nos parâmetros quando não-admin, senão o
  // driver rejeita um `$n` sem uso correspondente na query.
  const admin = isAdminOfUnit(ctx, ctx.unitId);
  const params: string[] = admin ? [] : [ctx.userId];
  const ownerPlaceholder = admin ? '' : `$${params.length}`;

  let anchorClause = '';
  if (folderId !== null) {
    params.push(folderId);
    anchorClause = `$${params.length}`;
  }

  const parentClause = folderId === null ? 'parent_id IS NULL' : `parent_id = ${anchorClause}`;
  const { rows: folders } = await client.query<FolderRow>(
    `SELECT * FROM folders WHERE ${visibleResourceClause(GrantResourceType.FOLDER, ownerPlaceholder, ctx)} AND ${parentClause} ORDER BY name`,
    params,
  );

  // Dois cortes restritivos, ambos subtração e nunca concessão:
  // `nonObsoleteClause` (Épico 10, US 10.7, design.md D6) tira o documento
  // obsoleto de quem não é admin da unidade, e `visibleRegistrationClause`
  // (US 10.9) tira o arquivo pendente de cadastro de quem não o enviou nem
  // administra a unidade. A situação de cada item vem derivada no próprio
  // `SELECT`, pelo relógio do banco (`fileSummaryColumns`).
  const folderClause = folderId === null ? 'folder_id IS NULL' : `folder_id = ${anchorClause}`;
  const { rows: files } = await client.query<FileSummaryRow>(
    `SELECT ${fileSummaryColumns(ctx, ownerPlaceholder)}
     FROM files WHERE ${visibleResourceClause(GrantResourceType.FILE, ownerPlaceholder, ctx)}
       AND ${nonObsoleteClause(ctx)} AND ${visibleRegistrationClause(ctx, ownerPlaceholder)}
       AND ${folderClause} ORDER BY file_name`,
    params,
  );

  // Contagem de documentos na **subárvore alcançável** de cada subpasta
  // listada (change `contagem-de-documentos-na-subarvore`, design.md D1/D2;
  // US 11.1, cenário 3; `docs/demanda_cliente_3.md`, item 7). Uma consulta só:
  //
  // - Raízes: **só** os ids que a cláusula de pastas acabou de liberar — não
  //   existe contagem para pasta que a pessoa não pode abrir.
  // - Descida (D1): o passo recursivo só atravessa subpasta que passa em
  //   `visibleResourceClause(FOLDER)` — a mesma regra de "pode abrir" da
  //   listagem. Subpasta sem acesso (ou na lixeira) é podada **com toda a
  //   descendência**, como no manifesto de download de pasta: o número nunca
  //   fala de conteúdo num lugar que a pessoa não alcança navegando.
  // - Em cada pasta alcançada conta-se o mesmo recorte da consulta de arquivos
  //   acima (fragmentos e placeholder do dono idênticos): sem herança da pasta,
  //   obsoleto e pendente de cadastro como na listagem. Vale, nível a nível,
  //   `documentCount(X) = files(X) + Σ documentCount(S)` sobre as subpastas S
  //   que `GET /folders/X/contents` lista — é o que o teste afirma (D3).
  // - Ciclo (D2): `UNION` sobre `(raiz_id, pasta_id)` descarta tupla repetida,
  //   então a recursão termina mesmo com `parent_id` cíclico, e cada pasta
  //   entra uma vez por raiz — sem contar arquivo em dobro.
  // - Os fragmentos usam colunas sem qualificação; por isso entram em
  //   subconsultas sobre a própria tabela (`folders`/`files`), onde resolvem
  //   sem ambiguidade, em vez de reescritos com alias.
  // - A vigência das concessões é a do relógio do Postgres, em cada nível, e o
  //   ramo `global_admin` dos fragmentos fixa `unit_id` na própria unidade — o
  //   bypass de RLS não vira descida nem soma em outra unidade.
  const counts = new Map<string, number>();
  if (folders.length > 0) {
    // Só o placeholder do dono (quando não-admin) é reaproveitado; a âncora
    // da pasta corrente não entra — o driver recusaria um `$n` sem uso.
    const countParams: unknown[] = admin ? [] : [ctx.userId];
    countParams.push(folders.map((f) => f.id));
    const { rows } = await client.query<{ folder_id: string; n: number }>(
      `WITH RECURSIVE alcance (raiz_id, pasta_id) AS (
         SELECT id, id FROM folders WHERE id = ANY($${countParams.length}::uuid[])
         UNION
         SELECT a.raiz_id, f.id
         FROM alcance a
         JOIN (
           SELECT id, parent_id FROM folders
           WHERE ${visibleResourceClause(GrantResourceType.FOLDER, ownerPlaceholder, ctx)}
         ) f ON f.parent_id = a.pasta_id
       )
       SELECT a.raiz_id AS folder_id, count(*)::int AS n
       FROM alcance a
       JOIN (
         SELECT folder_id FROM files
         WHERE ${visibleResourceClause(GrantResourceType.FILE, ownerPlaceholder, ctx)}
           AND ${nonObsoleteClause(ctx)} AND ${visibleRegistrationClause(ctx, ownerPlaceholder)}
       ) v ON v.folder_id = a.pasta_id
       GROUP BY a.raiz_id`,
      countParams,
    );
    for (const row of rows) counts.set(row.folder_id, row.n);
  }

  return {
    folders: folders.map((f) => ({ ...f, document_count: counts.get(f.id) ?? 0 })),
    files,
  };
}

async function recordFileAudits(
  ports: Ports,
  ctx: TenantContext,
  files: { id: string; unit_id: string }[],
  action: AuditAction,
): Promise<void> {
  if (files.length === 0) return;
  await ports.database.withTenantTransaction(ctx, async (client) => {
    for (const file of files) {
      await client.query(
        'INSERT INTO audit_events (unit_id, user_id, file_id, action) VALUES ($1, $2, $3, $4)',
        [file.unit_id, ctx.userId, file.id, action],
      );
    }
  });
}

type DownloadManifestOutcome =
  | { ok: true; response: FolderDownloadManifestResponse }
  | { ok: false; status: 413; body: FolderDownloadManifestLimitExceededResponse };

/**
 * Valida limites, assina e audita o manifesto (design.md D5, task 3.2):
 * ordem obrigatória **validar limites → emitir URLs assinadas → auditar** —
 * nada é assinado nem auditado num pedido recusado por limite. `entries` já
 * chega filtrada por `download` item a item (`traverseFolderSubtree`);
 * `totalFiles` é o total vivo da subárvore visível, sempre devolvido mesmo
 * quando nenhum arquivo é permitido (design.md D3).
 */
async function finalizeDownloadManifest(
  ports: Ports,
  ctx: TenantContext,
  manifest: SubtreeManifest,
): Promise<DownloadManifestOutcome> {
  const { entries, totalFiles } = manifest;

  if (entries.length > config.downloadManifest.maxFiles) {
    return {
      ok: false,
      status: 413,
      body: {
        error: 'download_manifest_limit_exceeded',
        limit: 'maxFiles',
        found: entries.length,
        allowed: config.downloadManifest.maxFiles,
      },
    };
  }

  const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  if (totalBytes > config.downloadManifest.maxBytes) {
    return {
      ok: false,
      status: 413,
      body: {
        error: 'download_manifest_limit_exceeded',
        limit: 'maxBytes',
        found: totalBytes,
        allowed: config.downloadManifest.maxBytes,
      },
    };
  }

  // Assinatura fora da transação de leitura (mesmo padrão do upload em lote,
  // routes/files.ts): evita manter a transação aberta durante N chamadas de
  // rede ao signer. Mesmo TTL já praticado pelo download unitário
  // (design.md D6) — `getDownloadUrl` não recebe parâmetro de TTL.
  const signedEntries: FolderDownloadManifestEntry[] = await Promise.all(
    entries.map(async (entry) => {
      const signed = await ports.storage.getDownloadUrl(entry.objectPath, entry.fileName);
      return {
        relativePath: entry.relativePath,
        fileName: entry.fileName,
        sizeBytes: entry.sizeBytes,
        url: signed.url,
        expiresAt: signed.expiresAt.toISOString(),
      };
    }),
  );

  // Um evento `download` por arquivo incluído, em lote na mesma transação
  // (design.md D4) — mesma semântica do download unitário, N vezes.
  await recordFileAudits(
    ports,
    ctx,
    entries.map((entry) => ({ id: entry.fileId, unit_id: entry.unitId })),
    AuditAction.DOWNLOAD,
  );

  return {
    ok: true,
    response: { entries: signedEntries, totalFiles, allowedFiles: entries.length, totalBytes },
  };
}

function sendDownloadManifestOutcome(
  res: import('express').Response,
  outcome: DownloadManifestOutcome,
): void {
  if (!outcome.ok) {
    res.status(outcome.status).json(outcome.body);
    return;
  }
  res.json(outcome.response);
}

export function foldersRouter(ports: Ports): Router {
  const router = Router();

  router.post('/folders', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { name, parentId } = req.body as CreateFolderRequest;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        if (parentId) {
          const parent = await findFolderById(client, parentId);
          // Pai inexistente (ou de outra unidade, escondido pela RLS) e pai
          // de outra pessoa resolvem igual — 403, sem distinguir os casos
          // (fail-closed, não vaza existência; mesmo tratamento do endpoint
          // de contents e de `findAccessibleFile` em routes/files.ts).
          if (!parent || parent.owner_id !== ctx.userId) return { status: 403 as const };
        }

        const { rows } = await client.query<FolderRow>(
          `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, $3, $4) RETURNING *`,
          [ctx.unitId, ctx.userId, parentId ?? null, name],
        );
        return { status: 201 as const, folder: rows[0]! };
      });

      if (outcome.status !== 201) {
        res.status(outcome.status).json({ error: 'forbidden' });
        return;
      }

      res.status(201).json(toFolderResponse(outcome.folder));
    } catch (err) {
      next(err);
    }
  });

  // Precisa vir antes de `/folders/:id/contents` — senão "root" seria
  // capturado como `:id`.
  router.get('/folders/root/contents', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { folders, files, favoritos } = await ports.database.withTenantTransaction(
        ctx,
        async (client) => {
          const conteudo = await listContents(client, ctx, null);
          const favoritos = await favoriteIdsAmong(
            client,
            ctx,
            conteudo.folders.map((f) => f.id),
            conteudo.files.map((f) => f.id),
          );
          return { ...conteudo, favoritos };
        },
      );

      res.json({
        folder: null,
        breadcrumb: [],
        folders: folders.map(toFolderListItemResponse),
        files: files.map(toFileSummaryResponse),
        // A raiz da unidade não é recurso concedível (design.md D9, US 3.3):
        // enviar para ela é livre a qualquer pessoa autenticada, então não há
        // `view`/`upload` a resolver aqui.
        canUpload: true,
        ...favoritos,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/folders/:id/contents', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const folder = await findFolderById(client, req.params.id);
        // Dono-ou-grant `view` (design.md D2): pasta inexistente (ou
        // escondida pela RLS de outra unidade) e pasta existente sem `view`
        // resolvem igual — 403, sem distinguir os dois casos (fail-closed,
        // sem vazar existência; mesmo tratamento de `findAccessibleFile` em
        // routes/files.ts). Distinguir com 404 vazaria que a pasta existe na
        // unidade do solicitante.
        if (!folder) return { status: 403 as const };
        const allowed = await hasAccess(
          client,
          ctx,
          GrantResourceType.FOLDER,
          folder.id,
          Permission.VIEW,
        );
        if (!allowed) return { status: 403 as const };

        const breadcrumb = await buildBreadcrumb(client, folder);
        const { folders, files } = await listContents(client, ctx, folder.id);
        // Veredito de `upload` sobre a pasta corrente, resolvido **aqui**, na
        // mesma transação tenant e pela mesma `hasAccess` que a rota de envio
        // usa (change `identidade-visual-isetes`, design.md D10). A SPA não
        // infere permissão no cliente — a capability `web-navegacao` proíbe —,
        // e sem este veredito a orientação de pasta vazia esconderia a ação de
        // quem tem a concessão `upload` sobre pasta de outra pessoa.
        const canUpload = await hasAccess(
          client,
          ctx,
          GrantResourceType.FOLDER,
          folder.id,
          Permission.UPLOAD,
        );
        // Favoritos entre os itens já listados (change `favoritos`, design.md
        // D5): restrito aos ids que a listagem acabou de liberar.
        const favoritos = await favoriteIdsAmong(
          client,
          ctx,
          folders.map((f) => f.id),
          files.map((f) => f.id),
        );
        return { status: 200 as const, folder, breadcrumb, folders, files, canUpload, favoritos };
      });

      if (outcome.status !== 200) {
        // Segundo caminho (change `compartilhamento-entre-unidades`,
        // design.md D6): pasta coberta por compartilhamento entre unidades —
        // navegação somente leitura, trilha a partir da raiz compartilhada.
        // Sem compartilhamento, a mesma recusa de antes.
        const shared = await withSharedResource(
          ports,
          ctx,
          GrantResourceType.FOLDER,
          req.params.id,
          Permission.VIEW,
          async (scope, resource) => {
            if (resource.type !== GrantResourceType.FOLDER) return null;
            const breadcrumb = await buildVisitBreadcrumb(scope, ctx, resource.row);
            const { folders, files } = await listVisitContents(scope, resource.row.id);
            return {
              folder: toFolderResponse(resource.row),
              breadcrumb: breadcrumb.map(toFolderResponse),
              folders: folders.map(toFolderListItemResponse),
              files: files.map(toFileSummaryResponse),
              canUpload: false,
              favoriteFolderIds: [],
              favoriteFileIds: [],
              readOnly: true,
              sharedFrom: { unitId: scope.originUnitId, unitName: scope.originUnitName },
              canDownload: await scope.covers(Permission.DOWNLOAD),
            };
          },
        );
        if (shared?.value) {
          res.json(shared.value);
          return;
        }
        res.status(outcome.status).json({ error: 'forbidden' });
        return;
      }

      res.json({
        folder: toFolderResponse(outcome.folder),
        breadcrumb: outcome.breadcrumb.map(toFolderResponse),
        folders: outcome.folders.map(toFolderListItemResponse),
        files: outcome.files.map(toFileSummaryResponse),
        canUpload: outcome.canUpload,
        ...outcome.favoritos,
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/folders/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { name } = req.body as RenameFolderRequest;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const folder = await findFolderById(client, req.params.id);
        // Dono-ou-admin da unidade, sem ramo de grant (design.md D1/D2 de
        // `mover-e-renomear-itens`) — mesmo 403 fail-closed sem vazar
        // existência dos demais endpoints.
        if (!folder) return { ok: false as const, status: 403 as const };
        const allowed = await canReorganize(client, ctx, GrantResourceType.FOLDER, folder.id);
        if (!allowed) return { ok: false as const, status: 403 as const };

        if (await hasFolderNameConflict(client, ctx.unitId, folder.parent_id, name, folder.id)) {
          const body: FolderNameConflictResponse = { error: 'folder_name_conflict' };
          return { ok: false as const, status: 409 as const, body };
        }

        const { rows } = await client.query<FolderRow>(
          'UPDATE folders SET name = $1 WHERE id = $2 RETURNING *',
          [name, folder.id],
        );
        return { ok: true as const, folder: rows[0]! };
      });

      if (!outcome.ok) {
        if (outcome.status === 409) {
          res.status(409).json(outcome.body);
          return;
        }
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Sem escrita em audit_events (design.md D6): renomear pasta, ao
      // contrário de renomear arquivo, não gera evento de auditoria — em
      // coerência com `POST /folders`, que também não audita.
      res.json(toFolderResponse(outcome.folder));
    } catch (err) {
      next(err);
    }
  });

  /**
   * Mover várias pastas para um mesmo destino (US 2.4, design.md D1/D2/D5 do
   * change `mover-itens-em-lote`) — dois segmentos, sem colisão nem
   * requisito de ordenação de registro com `POST /folders/:id/move` (três
   * segmentos, abaixo). Pré-condição global de destino derruba o lote
   * inteiro; falta de alcance, ciclo (camada 1) e colisão de nome recusam só
   * o item, sem abortar os demais. A camada 2 do ciclo (pós-`UPDATE`) roda
   * **uma vez, ao fim**, sobre o conjunto efetivamente movido — se lançar,
   * derruba o lote de pastas inteiro por `ROLLBACK` (design.md D5), nunca
   * atribuída a um item específico. Sem escrita em `audit_events` (design.md
   * D6): mover pasta, como mover pasta por item, não audita.
   */
  router.post('/folders/move', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { ids, destinationFolderId } = req.body as MoveBatchRequest;

      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        !ids.every((id) => typeof id === 'string' && id.length > 0) ||
        (destinationFolderId !== null && typeof destinationFolderId !== 'string')
      ) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const uniqueIds = Array.from(new Set(ids));

      if (uniqueIds.length > config.moveBatch.maxItems) {
        const limitResponse: MoveBatchLimitExceededResponse = {
          error: 'move_batch_limit_exceeded',
          found: uniqueIds.length,
          allowed: config.moveBatch.maxItems,
        };
        res.status(400).json(limitResponse);
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        // Pré-condição global de destino (design.md D2), mesmo alcance
        // dono-ou-admin da rota por item.
        if (destinationFolderId !== null) {
          const destination = await findFolderById(client, destinationFolderId);
          if (!destination) return { ok: false as const };
          const destinationAllowed = await canReorganize(
            client,
            ctx,
            GrantResourceType.FOLDER,
            destination.id,
          );
          if (!destinationAllowed) return { ok: false as const };
        }

        const results: MoveBatchItemResult[] = [];
        const movedFolderIds: string[] = [];

        for (const id of uniqueIds) {
          const folder = await findFolderById(client, id);
          if (!folder) {
            results.push({ id, ok: false, error: 'forbidden' });
            continue;
          }
          const allowed = await canReorganize(client, ctx, GrantResourceType.FOLDER, folder.id);
          if (!allowed) {
            results.push({ id, ok: false, error: 'forbidden' });
            continue;
          }

          // Ciclo, camada 1 — antes do UPDATE (design.md D3 de
          // `mover-e-renomear-itens`), recusa só este item.
          if (await wouldCreateCycle(client, folder.id, destinationFolderId)) {
            results.push({ id, ok: false, error: 'folder_cycle' });
            continue;
          }

          // Colisão de nome — mesmo nome já vivo no destino, recusa só este item.
          if (
            await hasFolderNameConflict(
              client,
              ctx.unitId,
              destinationFolderId,
              folder.name,
              folder.id,
            )
          ) {
            results.push({ id, ok: false, error: 'folder_name_conflict' });
            continue;
          }

          await client.query('UPDATE folders SET parent_id = $1 WHERE id = $2', [
            destinationFolderId,
            folder.id,
          ]);
          movedFolderIds.push(folder.id);
          results.push({ id, ok: true });
        }

        // Ciclo, camada 2 — uma vez, ao fim, sobre o conjunto movido
        // (design.md D5): fecha a corrida entre movimentos concorrentes. Um
        // disparo aqui lança `FolderCycleError`, capturado abaixo, e derruba
        // o lote inteiro por `ROLLBACK` — não é veredito de item.
        for (const movedId of movedFolderIds) {
          await assertNoCycleAfterMove(client, movedId);
        }

        return { ok: true as const, results };
      });

      if (!outcome.ok) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const response: MoveBatchResponse = { results: outcome.results };
      res.json(response);
    } catch (err) {
      if (err instanceof FolderCycleError) {
        const body: FolderCycleResponse = { error: 'folder_cycle' };
        res.status(409).json(body);
        return;
      }
      next(err);
    }
  });

  router.post('/folders/:id/move', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { destinationFolderId } = req.body as MoveItemRequest;
      if (destinationFolderId !== null && typeof destinationFolderId !== 'string') {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const folder = await findFolderById(client, req.params.id);
        if (!folder) return { ok: false as const, status: 403 as const };
        const allowed = await canReorganize(client, ctx, GrantResourceType.FOLDER, folder.id);
        if (!allowed) return { ok: false as const, status: 403 as const };

        // Destino nulo = raiz da unidade, sem exigir alcance (design.md D1):
        // a raiz não tem dono. Destino não-nulo exige o mesmo alcance
        // dono-ou-admin do item movido (D1: "vale para os dois lados").
        if (destinationFolderId !== null) {
          const destination = await findFolderById(client, destinationFolderId);
          if (!destination) return { ok: false as const, status: 403 as const };
          const destinationAllowed = await canReorganize(
            client,
            ctx,
            GrantResourceType.FOLDER,
            destination.id,
          );
          if (!destinationAllowed) return { ok: false as const, status: 403 as const };
        }

        // Ciclo, camada 1 — antes do UPDATE (design.md D3).
        if (await wouldCreateCycle(client, folder.id, destinationFolderId)) {
          const body: FolderCycleResponse = { error: 'folder_cycle' };
          return { ok: false as const, status: 409 as const, body };
        }

        // Colisão de nome (design.md D4/D5) — mesmo nome já vivo no destino.
        if (
          await hasFolderNameConflict(
            client,
            ctx.unitId,
            destinationFolderId,
            folder.name,
            folder.id,
          )
        ) {
          const body: FolderNameConflictResponse = { error: 'folder_name_conflict' };
          return { ok: false as const, status: 409 as const, body };
        }

        const { rows } = await client.query<FolderRow>(
          'UPDATE folders SET parent_id = $1 WHERE id = $2 RETURNING *',
          [destinationFolderId, folder.id],
        );
        const moved = rows[0]!;

        // Ciclo, camada 2 — depois do UPDATE e antes do commit, na mesma
        // transação (design.md D3): fecha a corrida entre dois movimentos
        // concorrentes que a camada 1, isoladamente, não vê. Lança
        // `FolderCycleError`, que dispara `ROLLBACK` e é traduzido abaixo.
        await assertNoCycleAfterMove(client, moved.id);

        return { ok: true as const, folder: moved };
      });

      if (!outcome.ok) {
        if (outcome.status === 409) {
          res.status(409).json(outcome.body);
          return;
        }
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Sem escrita em audit_events (design.md D6): mover pasta, e a
      // subárvore que ela arrasta, não gera evento de auditoria.
      res.json(toFolderResponse(outcome.folder));
    } catch (err) {
      if (err instanceof FolderCycleError) {
        const body: FolderCycleResponse = { error: 'folder_cycle' };
        res.status(409).json(body);
        return;
      }
      next(err);
    }
  });

  // Precisa vir antes de `/folders/:id/download-manifest` — mesma razão de
  // `/folders/root/contents` acima. Raiz da unidade não é um recurso
  // próprio, então não há checagem de `view` a fazer (design.md D9, US 3.3):
  // a ação é oferecida uniformemente, inclusive aqui.
  router.post('/folders/root/download-manifest', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const manifest = await ports.database.withTenantTransaction(ctx, (client) =>
        traverseFolderSubtree(client, ctx, null),
      );
      const outcome = await finalizeDownloadManifest(ports, ctx, manifest);
      sendDownloadManifestOutcome(res, outcome);
    } catch (err) {
      next(err);
    }
  });

  router.post('/folders/:id/download-manifest', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const manifestOrDenied = await ports.database.withTenantTransaction(ctx, async (client) => {
        const folder = await findFolderById(client, req.params.id);
        // Mesmo fail-closed de `/folders/:id/contents` (design.md D2):
        // pasta inexistente/de outra unidade e pasta sem `view` resolvem
        // igual, 403, sem vazar existência — "abrir a pasta" é
        // pré-condição do download da pasta.
        if (!folder) return { ok: false as const };
        const allowed = await hasAccess(
          client,
          ctx,
          GrantResourceType.FOLDER,
          folder.id,
          Permission.VIEW,
        );
        if (!allowed) return { ok: false as const };

        const manifest = await traverseFolderSubtree(client, ctx, folder.id);
        return { ok: true as const, manifest };
      });

      if (!manifestOrDenied.ok) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const outcome = await finalizeDownloadManifest(ports, ctx, manifestOrDenied.manifest);
      sendDownloadManifestOutcome(res, outcome);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/folders/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const folder = await findFolderById(client, req.params.id);
        // Dono-ou-grant `delete` ou admin da unidade (design.md D3), mesmo
        // 403 fail-closed sem vazar existência dos demais endpoints.
        if (!folder) return { ok: false as const };
        const allowed = await hasAccess(
          client,
          ctx,
          GrantResourceType.FOLDER,
          folder.id,
          Permission.DELETE,
        );
        if (!allowed) return { ok: false as const };

        const folderIds = await collectSubtreeFolderIds(client, folder.id);

        // Cascata (design.md D4): mesmo `deleted_at`, `trash_root_id` da
        // raiz; `deleted_at IS NULL` no WHERE preserva o agrupamento de
        // descendentes já excluídos antes, sem sobrescrever seu
        // `trash_root_id`.
        await client.query(
          `UPDATE folders SET deleted_at = now(), deleted_by = $1, trash_root_id = $2
           WHERE id = ANY($3::uuid[]) AND deleted_at IS NULL`,
          [ctx.userId, folder.id, folderIds],
        );

        const { rows: deletedFiles } = await client.query<{ id: string; unit_id: string }>(
          `UPDATE files SET deleted_at = now(), deleted_by = $1, trash_root_id = $2
           WHERE folder_id = ANY($3::uuid[]) AND deleted_at IS NULL
           RETURNING id, unit_id`,
          [ctx.userId, folder.id, folderIds],
        );

        return { ok: true as const, deletedFiles };
      });

      if (!outcome.ok) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Auditoria por arquivo afetado (design.md D10): `audit_events`
      // exige `file_id`, então a pasta em si não gera linha própria — cada
      // arquivo da subárvore excluída é auditado individualmente.
      await recordFileAudits(ports, ctx, outcome.deletedFiles, AuditAction.DELETE);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/folders/:id/restore', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<FolderRow & { trash_root_id: string | null }>(
          'SELECT * FROM folders WHERE id = $1 AND deleted_at IS NOT NULL',
          [req.params.id],
        );
        const folder = rows[0];
        if (!folder) return { ok: false as const };

        // Só raízes de exclusão são restauráveis individualmente
        // (design.md D5).
        if (folder.trash_root_id !== folder.id) return { ok: false as const };

        const allowed = await hasAccess(
          client,
          ctx,
          GrantResourceType.FOLDER,
          folder.id,
          Permission.DELETE,
          {
            includeTrash: true,
          },
        );
        if (!allowed) return { ok: false as const };

        // Épico 10 (design.md D5 de `controle-documental`): restaurar a pasta
        // ressuscita os documentos da subárvore, e o código de um deles pode
        // ter sido reusado nesse intervalo. O índice único recusaria a
        // escrita com um 23505 cru; a checagem aqui transforma isso na mesma
        // recusa nomeada do restore de arquivo, dizendo qual documento ocupa
        // o código. Liberar o duplicado quebraria a unicidade; bloquear o
        // reuso enquanto houver documento na lixeira tornaria um código
        // irrecuperável por até 30 dias sem que ninguém entenda por quê.
        const { rows: conflitos } = await client.query<{
          document_code: string;
          occupant_id: string;
          occupant_name: string;
        }>(
          `SELECT d.document_code, o.id AS occupant_id, o.file_name AS occupant_name
           FROM files d
           JOIN files o
             ON o.unit_id = d.unit_id
            AND lower(o.document_code) = lower(d.document_code)
            AND o.deleted_at IS NULL
           WHERE d.trash_root_id = $1 AND d.document_code IS NOT NULL
           ORDER BY d.file_name
           LIMIT 1`,
          [folder.id],
        );
        const conflito = conflitos[0];
        if (conflito) {
          return {
            ok: false as const,
            codeInUse: {
              code: conflito.document_code,
              occupiedBy: { id: conflito.occupant_id, fileName: conflito.occupant_name },
            },
          };
        }

        // `trash_root_id = raiz` agrupa a pasta e toda a subárvore excluída
        // junto (design.md D4) — restaurar é só limpar a marcação de quem
        // tem esse agrupador, sem walk recursivo (design.md D5).
        await client.query(
          `UPDATE folders SET deleted_at = NULL, deleted_by = NULL, trash_root_id = NULL WHERE trash_root_id = $1`,
          [folder.id],
        );
        const { rows: restoredFiles } = await client.query<{ id: string; unit_id: string }>(
          `UPDATE files SET deleted_at = NULL, deleted_by = NULL, trash_root_id = NULL
           WHERE trash_root_id = $1 RETURNING id, unit_id`,
          [folder.id],
        );

        const { rows: refreshed } = await client.query<FolderRow>(
          'SELECT * FROM folders WHERE id = $1',
          [folder.id],
        );
        return { ok: true as const, folder: refreshed[0]!, restoredFiles };
      });

      if (!outcome.ok) {
        if ('codeInUse' in outcome && outcome.codeInUse) {
          const { code, occupiedBy } = outcome.codeInUse;
          const body: DocumentCodeInUseResponse = {
            error: 'document_code_in_use',
            code,
            occupiedBy,
          };
          res.status(409).json(body);
          return;
        }
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      await recordFileAudits(ports, ctx, outcome.restoredFiles, AuditAction.RESTORE);

      const response: FolderRestoreResponse = toFolderResponse(outcome.folder);
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
