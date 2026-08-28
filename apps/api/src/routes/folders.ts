import { Router } from 'express';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { AuditAction, GrantResourceType, Permission } from '@gdoc/shared';
import type {
  CreateFolderRequest,
  FolderCycleResponse,
  FolderDownloadManifestEntry,
  FolderDownloadManifestLimitExceededResponse,
  FolderDownloadManifestResponse,
  FolderNameConflictResponse,
  FolderResponse,
  FolderRestoreResponse,
  FileSummaryResponse,
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

interface FileSummaryRow {
  id: string;
  owner_id: string;
  folder_id: string | null;
  file_name: string;
  content_type: string | null;
  size_bytes: string | null;
  status: string;
  created_at: string;
}

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

function toFileSummaryResponse(row: FileSummaryRow): FileSummaryResponse {
  return {
    id: row.id,
    ownerId: row.owner_id,
    folderId: row.folder_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
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
): Promise<{ folders: FolderRow[]; files: FileSummaryRow[] }> {
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

  const folderClause = folderId === null ? 'folder_id IS NULL' : `folder_id = ${anchorClause}`;
  const { rows: files } = await client.query<FileSummaryRow>(
    `SELECT id, owner_id, folder_id, file_name, content_type, size_bytes, status, created_at
     FROM files WHERE ${visibleResourceClause(GrantResourceType.FILE, ownerPlaceholder, ctx)} AND ${folderClause} ORDER BY file_name`,
    params,
  );

  return { folders, files };
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
      const { folders, files } = await ports.database.withTenantTransaction(ctx, (client) =>
        listContents(client, ctx, null),
      );

      res.json({
        folder: null,
        breadcrumb: [],
        folders: folders.map(toFolderResponse),
        files: files.map(toFileSummaryResponse),
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
        return { status: 200 as const, folder, breadcrumb, folders, files };
      });

      if (outcome.status !== 200) {
        res.status(outcome.status).json({ error: 'forbidden' });
        return;
      }

      res.json({
        folder: toFolderResponse(outcome.folder),
        breadcrumb: outcome.breadcrumb.map(toFolderResponse),
        folders: outcome.folders.map(toFolderResponse),
        files: outcome.files.map(toFileSummaryResponse),
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
