import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Ports } from '../ports/index.js';
import {
  AuditAction,
  FileAccessAction,
  GrantResourceType,
  NotificationKind,
  Permission,
  isPreviewable,
} from '@gdoc/shared';
import type {
  BatchUploadItemResult,
  BatchUploadUrlRequest,
  DocumentCodeInUseResponse,
  DocumentControlRequiredResponse,
  FileRestoreResponse,
  InvalidDocumentTypeResponse,
  MoveBatchItemResult,
  MoveBatchLimitExceededResponse,
  MoveBatchRequest,
  MoveBatchResponse,
  MoveItemRequest,
  RenameFileRequest,
  ReplaceFileRequest,
  StorageQuotaResponse,
  UpdateDocumentControlRequest,
  UploadUrlRequest,
  ViewUrlResponse,
} from '@gdoc/shared';
import { config } from '../config.js';
import { ensureFolderPath, findFolderById, validateAnchor } from '../lib/folder-tree.js';
import { canReorganize, hasAccess } from '../lib/access.js';
import { withSharedResource } from '../lib/cross-unit-share.js';
import {
  FILE_DERIVED_COLUMNS,
  CONTROL_FIELD_COLUMN,
  findCodeOwner,
  isAwaitingRegistration,
  isDocumentCodeConflict,
  parseDocumentControl,
  rowAwaitsRegistration,
  toFileSummaryResponse,
  type FileSummaryRow,
  type NormalizedDocumentControl,
} from '../lib/document-control.js';
import { QUOTA_COLUMNS, resolveQuotaBytes, type QuotaRow } from '../lib/quota.js';

/**
 * Linha inteira de `files` mais as expressões derivadas do controle
 * documental (`FILE_DERIVED_COLUMNS`): as rotas desta camada precisam de
 * `object_path`/`unit_id`, que o resumo não expõe, e da situação apurada no
 * `SELECT`, que não é coluna. A projeção para o DTO é a única do sistema —
 * `toFileSummaryResponse`, em `lib/document-control.ts`.
 */
interface FileRow extends FileSummaryRow {
  unit_id: string;
  object_path: string;
}

/**
 * Busca o arquivo e resolve acesso (dono-ou-grant do verbo) na mesma
 * transação tenant (design.md D2): recurso inexistente (ou escondido pela
 * RLS de outra unidade) e recurso existente sem o verbo resolvem igual —
 * `null`, sem distinguir os dois casos (fail-closed, sem vazar existência).
 */
async function findAccessibleFile(
  ports: Ports,
  ctx: NonNullable<import('express').Request['tenantContext']>,
  fileId: string,
  permission: Permission,
) {
  return ports.database.withTenantTransaction(ctx, async (client) => {
    const { rows } = await client.query<FileRow>(
      `SELECT *, ${FILE_DERIVED_COLUMNS} FROM files WHERE id = $1`,
      [fileId],
    );
    const file = rows[0];
    if (!file) return null;
    const allowed = await hasAccess(client, ctx, GrantResourceType.FILE, file.id, permission);
    return allowed ? file : null;
  });
}

async function recordAudit(
  ports: Ports,
  ctx: NonNullable<import('express').Request['tenantContext']>,
  file: FileRow,
  action: AuditAction,
) {
  await ports.database.withTenantTransaction(ctx, async (client) => {
    await client.query(
      'INSERT INTO audit_events (unit_id, user_id, file_id, action) VALUES ($1, $2, $3, $4)',
      [file.unit_id, ctx.userId, file.id, action],
    );
  });
}

/**
 * Um evento por arquivo, numa única transação (design.md D6 do change
 * `mover-itens-em-lote`) — mesmo molde de `recordFileAudits` em
 * `routes/folders.ts`, usado aqui só pelo lote de `POST /files/move` (a
 * versão singular acima segue chamada pelas demais rotas, uma transação por
 * evento).
 */
async function recordAudits(
  ports: Ports,
  ctx: NonNullable<import('express').Request['tenantContext']>,
  files: { id: string; unit_id: string }[],
  action: AuditAction,
) {
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

export function filesRouter(ports: Ports): Router {
  const router = Router();

  /**
   * `GET /files/quota` (change `envio-multiplas-pastas-com-prechecagem`,
   * design.md D2) — espaço de armazenamento **do próprio solicitante**.
   *
   * A identidade vem exclusivamente de `ctx.userId` (sessão relida do banco
   * por `attachTenantContext`): a rota **não aceita identificador de pessoa**,
   * nem em caminho, nem em query — não existindo superfície para consultar a
   * cota de terceiro, ainda que da mesma unidade, ainda que por admin.
   * Deliberadamente **sem** o bypass de `global_admin`: o CLAUDE.md restringe
   * esse bypass a agregados de painel, e cota é dado de pessoa.
   *
   * `trashedBytes` (e seu par de contagem `trashedFiles`, que a confirmação
   * de `POST /trash/purge` usa) é decomposição explicativa de `usedBytes` e
   * **não** é descontado do disponível — um arquivo na lixeira segue contando em
   * `storage_used_bytes` até o `purge-trash` (retenção de
   * `config.trashRetentionDays`). Descontá-lo aqui inflaria o disponível e
   * produziria uma promessa que a emissão de URLs desmentiria em seguida.
   *
   * `pendingBytes` usa a **mesma** soma de `pending`/`replacing` da reserva
   * consciente do lote em `POST /files/upload-urls`, para que o retrato e a
   * guarda falem do mesmo número.
   */
  router.get('/files/quota', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const snapshot = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows: usageRows } = await client.query<{ storage_used_bytes: string } & QuotaRow>(
          `SELECT ${QUOTA_COLUMNS} FROM users WHERE id = $1`,
          [ctx.userId],
        );
        const usedBytes = Number(usageRows[0]?.storage_used_bytes ?? '0');
        // Cota efetiva desta pessoa (`lib/quota.ts`), não o padrão da
        // plataforma: quem tem exceção nominal vê a própria cota aqui.
        const quotaBytes = resolveQuotaBytes(usageRows[0]);

        const { rows: trashedRows } = await client.query<{
          total: string | null;
          files: string;
        }>(
          `SELECT SUM(size_bytes) AS total, COUNT(*) AS files FROM files
           WHERE owner_id = $1 AND deleted_at IS NOT NULL`,
          [ctx.userId],
        );
        const trashedBytes = Number(trashedRows[0]?.total ?? '0');
        const trashedFiles = Number(trashedRows[0]?.files ?? '0');

        const { rows: pendingRows } = await client.query<{ total: string | null }>(
          `SELECT SUM(size_bytes) AS total FROM files
           WHERE owner_id = $1 AND status IN ('pending', 'replacing')`,
          [ctx.userId],
        );
        const pendingBytes = Number(pendingRows[0]?.total ?? '0');

        return { usedBytes, quotaBytes, trashedBytes, trashedFiles, pendingBytes };
      });

      const { quotaBytes } = snapshot;
      const response: StorageQuotaResponse = {
        quotaBytes,
        usedBytes: snapshot.usedBytes,
        trashedBytes: snapshot.trashedBytes,
        trashedFiles: snapshot.trashedFiles,
        pendingBytes: snapshot.pendingBytes,
        // Piso em zero: uma reconciliação de finalize que ultrapasse a cota
        // (o `size_bytes` real difere do declarado) não deve devolver um
        // disponível negativo, que o cliente exibiria como número absurdo.
        availableBytes: Math.max(0, quotaBytes - snapshot.usedBytes - snapshot.pendingBytes),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.post('/files/:id/view-url', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const file = await findAccessibleFile(ports, ctx, req.params.id, Permission.VIEW);
      // Dono-ou-grant `view` (design.md D2): sem posse nem o verbo, nenhuma
      // URL é emitida e nenhuma auditoria é gravada (US 4.2, fail-closed).
      if (!file) {
        // Segundo caminho (change `compartilhamento-entre-unidades`,
        // design.md D4): compartilhamento entre unidades vigente. Assinatura
        // e auditoria acontecem **dentro** da visita confirmada; sem ela, a
        // resposta é exatamente a de antes.
        const shared = await withSharedResource(
          ports,
          ctx,
          GrantResourceType.FILE,
          req.params.id,
          Permission.VIEW,
          async (scope, resource) => {
            if (resource.type !== GrantResourceType.FILE) return null;
            const visitFile = resource.row;
            if (!isPreviewable(visitFile.content_type)) {
              const notPreviewable: ViewUrlResponse = {
                previewAvailable: false,
                reason: 'unsupported_format',
                download: { available: await scope.covers(Permission.DOWNLOAD) },
              };
              return notPreviewable;
            }
            await scope.recordAudit(visitFile.id, FileAccessAction.VIEW);
            const signed = await ports.storage.getViewUrl(visitFile.object_path);
            const previewable: ViewUrlResponse = {
              previewAvailable: true,
              url: signed.url,
              expiresAt: signed.expiresAt.toISOString(),
              action: FileAccessAction.VIEW,
            };
            return previewable;
          },
        );
        if (shared?.value) {
          res.json(shared.value);
          return;
        }
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Formato não pré-visualizável (US 9.2 cenário 2, design.md D2/D4):
      // nenhuma URL é emitida, nenhum `view` é auditado — nada foi visto. A
      // oferta de download é só um sinal (design.md D5): resolve o verbo
      // `download` sem emitir a URL de download nem auditá-lo.
      if (!isPreviewable(file.content_type)) {
        const downloadable = await findAccessibleFile(ports, ctx, file.id, Permission.DOWNLOAD);
        const response: ViewUrlResponse = {
          previewAvailable: false,
          reason: 'unsupported_format',
          download: { available: downloadable !== null },
        };
        res.json(response);
        return;
      }

      await recordAudit(ports, ctx, file, FileAccessAction.VIEW);
      const signed = await ports.storage.getViewUrl(file.object_path);
      const response: ViewUrlResponse = {
        previewAvailable: true,
        url: signed.url,
        expiresAt: signed.expiresAt.toISOString(),
        action: FileAccessAction.VIEW,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.post('/files/:id/download-url', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const file = await findAccessibleFile(ports, ctx, req.params.id, Permission.DOWNLOAD);
      if (!file) {
        // Segundo caminho: compartilhamento entre unidades (design.md D4).
        const shared = await withSharedResource(
          ports,
          ctx,
          GrantResourceType.FILE,
          req.params.id,
          Permission.DOWNLOAD,
          async (scope, resource) => {
            if (resource.type !== GrantResourceType.FILE) return null;
            await scope.recordAudit(resource.row.id, FileAccessAction.DOWNLOAD);
            const signed = await ports.storage.getDownloadUrl(
              resource.row.object_path,
              resource.row.file_name,
            );
            return {
              url: signed.url,
              expiresAt: signed.expiresAt.toISOString(),
              action: FileAccessAction.DOWNLOAD,
            };
          },
        );
        if (shared?.value) {
          res.json(shared.value);
          return;
        }
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      await recordAudit(ports, ctx, file, FileAccessAction.DOWNLOAD);
      const signed = await ports.storage.getDownloadUrl(file.object_path, file.file_name);
      res.json({
        url: signed.url,
        expiresAt: signed.expiresAt.toISOString(),
        action: FileAccessAction.DOWNLOAD,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * `POST /files/upload-url` — publicação de **um** documento (US 10.5,
   * design.md D7 de `controle-documental`). É aqui que a exigência dos dados
   * de controle liga: tipo, código, revisão e data de próxima revisão são
   * obrigatórios, e a recusa **nomeia** o que falta.
   *
   * O envio em lote e o de pasta usam `POST /files/upload-urls`, que os
   * dispensa — e é essa divisão em duas rotas que mantém as duas regras
   * compatíveis: o lote precisa pedir URL para um item só ao repetir um envio
   * que falhou, e repetir não é publicar um documento novo.
   */
  router.post('/files/upload-url', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { fileName, contentType, declaredSizeBytes, folderId, documentControl } =
        req.body as UploadUrlRequest;

      if (
        !fileName ||
        !contentType ||
        !Number.isFinite(declaredSizeBytes) ||
        declaredSizeBytes! < 0
      ) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const parsed = parseDocumentControl(documentControl, { requireAll: true });
      if (!parsed.ok) {
        // Três recusas distinguíveis entre si (web-upload: "indicando o que
        // corrigir"), nenhuma delas gravando coisa alguma.
        if (parsed.error === 'document_control_required') {
          const body: DocumentControlRequiredResponse = {
            error: 'document_control_required',
            missing: parsed.missing,
          };
          res.status(400).json(body);
          return;
        }
        if (parsed.error === 'invalid_document_type') {
          const body: InvalidDocumentTypeResponse = { error: 'invalid_document_type' };
          res.status(400).json(body);
          return;
        }
        res.status(400).json({ error: 'invalid request body' });
        return;
      }
      const control = parsed.value;
      // `null` quando o tipo é Arquivo geral, que declara **não ter** código
      // (US 10.8) e por isso não passa pela checagem de unicidade nem pelo
      // caminho de retomada — ambos condicionados à existência do código.
      const documentCode = control.documentCode ?? null;

      const objectId = randomUUID();
      const objectPath = ports.storage.buildObjectPath(
        ctx.unitId,
        ctx.userId,
        `${objectId}-${fileName}`,
      );

      const outcome = await ports.database
        .withTenantTransaction(ctx, async (client) => {
          if (folderId) {
            // RLS restringe a leitura à unidade do remetente — pasta de outra
            // unidade não aparece aqui (navegacao spec: "a pasta de destino
            // SHALL pertencer à mesma unidade do remetente"). Pasta própria
            // segue livre; pasta de outra pessoa exige grant `upload`
            // (design.md D3, Épico 4).
            const anchor = await validateAnchor(client, ctx, folderId);
            if (!anchor.ok) return { ok: false as const, status: anchor.status };
          }

          const { rows } = await client.query<{ storage_used_bytes: string } & QuotaRow>(
            `SELECT ${QUOTA_COLUMNS} FROM users WHERE id = $1`,
            [ctx.userId],
          );
          const currentUsage = Number(rows[0]?.storage_used_bytes ?? '0');
          if (currentUsage + declaredSizeBytes! > resolveQuotaBytes(rows[0])) {
            return { ok: false as const, status: 400 as const };
          }

          // Unicidade do código na unidade (US 10.2, design.md D5). A leitura
          // resolve o caso comum com erro nomeado; o índice único resolve a
          // corrida, no `catch` abaixo. RLS filtra por baixo, então o homônimo
          // de outra unidade não aparece aqui — e nada dele é revelado.
          // Sem código (Arquivo geral) não há unicidade a verificar nem
          // retomada a reconhecer: o caminho inteiro é condicionado à
          // existência do código.
          const occupant = documentCode === null ? null : await findCodeOwner(client, documentCode);
          // **Retomada**: se o código está preso a um envio `pending` do próprio
          // solicitante, este pedido é a retomada daquela publicação, não uma
          // duplicata — a linha é reaproveitada com o objeto novo. Sem isso, um
          // envio que falhou na transferência deixaria o código travado até o
          // expurgo da lixeira, e a pessoa ficaria impedida de publicar o
          // próprio documento de novo.
          const retomada =
            occupant !== null && occupant.owner_id === ctx.userId && occupant.status === 'pending'
              ? occupant.id
              : null;
          if (occupant && !retomada) {
            return { ok: false as const, status: 409 as const, code: documentCode! };
          }

          const controlValues = [
            control.documentType ?? null,
            documentCode,
            control.documentRevision ?? null,
            control.responsibleSector ?? null,
            control.nextReviewAt ?? null,
            control.lifecycleState ?? null,
          ];

          if (retomada) {
            await client.query(
              `UPDATE files SET object_path = $1, file_name = $2, content_type = $3, size_bytes = $4,
               folder_id = $5, status = 'pending', pending_object_path = NULL,
               document_type = $6, document_code = $7, document_revision = $8,
               responsible_sector = $9, next_review_at = $10, lifecycle_state = $11
             WHERE id = $12`,
              [
                objectPath,
                fileName,
                contentType,
                declaredSizeBytes,
                folderId ?? null,
                ...controlValues,
                retomada,
              ],
            );
            return { ok: true as const };
          }

          await client.query(
            `INSERT INTO files (id, unit_id, owner_id, folder_id, object_path, file_name, content_type, size_bytes, status,
             document_type, document_code, document_revision, responsible_sector, next_review_at, lifecycle_state)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13, $14)`,
            [
              objectId,
              ctx.unitId,
              ctx.userId,
              folderId ?? null,
              objectPath,
              fileName,
              contentType,
              declaredSizeBytes,
              ...controlValues,
            ],
          );
          return { ok: true as const };
        })
        .catch((err) => {
          // Corrida entre duas publicações simultâneas do mesmo código: só o
          // índice único consegue decidir, e o perdedor recebe a mesma recusa
          // nomeada da checagem acima (design.md D5).
          if (isDocumentCodeConflict(err)) {
            // Conflito de código só é alcançável quando havia código: o índice
            // único é parcial (`WHERE document_code IS NOT NULL`).
            return { ok: false as const, status: 409 as const, code: documentCode! };
          }
          throw err;
        });

      if (!outcome.ok) {
        if (outcome.status === 409) {
          const body: DocumentCodeInUseResponse = {
            error: 'document_code_in_use',
            code: outcome.code,
          };
          res.status(409).json(body);
          return;
        }
        const error =
          outcome.status === 404
            ? 'folder not found'
            : outcome.status === 403
              ? 'forbidden'
              : 'quota exceeded';
        res.status(outcome.status).json({ error });
        return;
      }

      const signed = await ports.storage.getUploadUrl(objectPath, contentType);
      res.json({ uploadUrl: signed.url, objectPath, expiresAt: signed.expiresAt.toISOString() });
    } catch (err) {
      next(err);
    }
  });

  /**
   * `POST /files/upload-urls` — envio em **lote** e de pasta. Dispensa os
   * dados de controle por decisão explícita (US 10.5 cenário 2, design.md D7
   * de `controle-documental`): o que entra por aqui nasce com situação "Sem
   * controle de revisão" e recebe os dados depois, por
   * `PATCH /files/:id/document-control`.
   *
   * A dispensa não é descuido nem brecha: é a rota do lote, e é também por
   * ela que um item que falhou na transferência pede URL nova — repetir um
   * item de um lote de cinquenta não é publicar um documento novo, e exigir
   * quatro campos nessa repetição quebraria o relato de falha independente
   * que o envio em lote já entrega.
   */
  router.post('/files/upload-urls', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { destinationFolderId, items } = req.body as BatchUploadUrlRequest;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      // Teto por requisição (change corrige-defeitos-envio-lote, design.md
      // D2), avaliado **antes** de abrir a transação: a recusa não deixa
      // linha `pending`, pasta de caminho relativo nem URL assinada para
      // trás. Molde de `move_batch_limit_exceeded` /
      // `download_manifest_limit_exceeded`; `allowed` é a fonte da verdade
      // para o cliente, que orienta a recusa antecipada pelo padrão
      // compartilhado em `packages/shared`.
      if (items.length > config.uploadBatch.maxItems) {
        res.status(400).json({
          error: 'upload_batch_limit_exceeded',
          found: items.length,
          allowed: config.uploadBatch.maxItems,
        });
        return;
      }

      type PreparedItem =
        | {
            fileName: string;
            ok: true;
            objectPath: string;
            contentType: string;
            folderId: string | null;
            /** US 10.9: item sem os dados exigidos pelo seu tipo nasce pendente. */
            awaitingRegistration: boolean;
            /** Identificador da linha, para o aviso ao remetente (US 10.9). */
            fileId: string;
          }
        | { fileName: string; ok: false; error: string };

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        // Pré-condição global (design.md D1): destino inválido/de outra
        // unidade derruba o lote inteiro, sem vazar existência — diferente
        // dos erros por item, que não abortam os demais.
        const anchor = await validateAnchor(client, ctx, destinationFolderId);
        if (!anchor.ok) return { ok: false as const, status: anchor.status };

        const { rows: usageRows } = await client.query<{ storage_used_bytes: string } & QuotaRow>(
          `SELECT ${QUOTA_COLUMNS} FROM users WHERE id = $1`,
          [ctx.userId],
        );
        const baseUsage = Number(usageRows[0]?.storage_used_bytes ?? '0');
        const quotaBytes = resolveQuotaBytes(usageRows[0]);

        // Reserva consciente do lote (design.md D2): soma o que já está
        // pendente/em substituição, e cresce a cada item aceito no próprio
        // lote — sem isso, itens do mesmo lote veem a mesma folga e furam a
        // cota em conjunto.
        const { rows: pendingRows } = await client.query<{ total: string | null }>(
          `SELECT SUM(size_bytes) AS total FROM files WHERE owner_id = $1 AND status IN ('pending', 'replacing')`,
          [ctx.userId],
        );
        let reserved = Number(pendingRows[0]?.total ?? '0');

        const prepared: PreparedItem[] = [];
        // Códigos já consumidos **por este lote** (US 10.2, design.md D6).
        // Sem esta guarda, dois itens do mesmo lote com o mesmo código
        // passariam pela checagem individual — nenhum dos dois existe no banco
        // ainda — e colidiriam no índice único `files_unit_document_code_uidx`,
        // cujo erro aborta a **transação inteira** e derrubaria o lote todo.
        // Isso contrariaria "falha parcial não derruba o lote"
        // (`envio-lote`), então a colisão intra-lote é recusada por item,
        // como qualquer outro conflito de código.
        const codesInBatch = new Set<string>();

        for (const item of items) {
          const { fileName, contentType, declaredSizeBytes, relativePath, documentControl } =
            item ?? ({} as (typeof items)[number]);

          if (
            !fileName ||
            !contentType ||
            !Number.isFinite(declaredSizeBytes) ||
            declaredSizeBytes! < 0
          ) {
            prepared.push({ fileName: fileName ?? '', ok: false, error: 'invalid item' });
            continue;
          }

          // US 10.5 (design.md D6): dados de controle **deste** item.
          // `requireAll: false` é deliberado e é o coração da change: dado
          // **ausente** não recusa — produz pendência de cadastro —, enquanto
          // dado **inválido** recusa, e só este item. Confundir os dois é o que
          // obrigava o lote a dispensar os dados por inteiro.
          const parsedControl = parseDocumentControl(documentControl, { requireAll: false });
          if (!parsedControl.ok) {
            prepared.push({ fileName, ok: false, error: parsedControl.error });
            continue;
          }
          const control = parsedControl.value;
          const awaitingRegistration = isAwaitingRegistration(control);

          const pathResult = await ensureFolderPath(
            client,
            ctx,
            anchor.anchor?.id ?? null,
            relativePath,
          );
          if (!pathResult.ok) {
            prepared.push({ fileName, ok: false, error: pathResult.error });
            continue;
          }

          const available = quotaBytes - baseUsage - reserved;
          if (declaredSizeBytes! > available) {
            prepared.push({ fileName, ok: false, error: 'quota exceeded' });
            continue;
          }

          // Unicidade do código na unidade (US 10.2, design.md D5), agora
          // também no lote, porque o lote passou a carregar código. Duas
          // fontes de colisão: o acervo (via `findCodeOwner`, com RLS
          // filtrando por baixo — homônimo de outra unidade não aparece nem é
          // revelado) e o próprio lote (via `codesInBatch`).
          let retomada: string | null = null;
          if (control.documentCode) {
            const codeKey = control.documentCode.toLowerCase();
            if (codesInBatch.has(codeKey)) {
              prepared.push({ fileName, ok: false, error: 'document_code_conflict' });
              continue;
            }
            const occupant = await findCodeOwner(client, control.documentCode);
            // **Retomada**, pelo mesmo motivo e da mesma forma que na rota
            // unitária: código preso a um envio `pending` do próprio
            // solicitante é a retomada daquela publicação, não duplicata. Sem
            // isto, repetir um item de lote que falhou na transferência seria
            // recusado por conflito com a sua própria linha — quebrando "nova
            // tentativa apenas do item que falhou" (`envio-lote`) justamente
            // no caso que ela existe para cobrir.
            //
            // A linha é **reaproveitada**, não substituída: apagá-la e inserir
            // outra trocaria o identificador do arquivo, e com ele as
            // concessões que apontam para o id antigo, o histórico de
            // auditoria e a identidade do evento de origem do aviso de
            // pendência — que passaria a avisar duas vezes do mesmo arquivo.
            if (
              occupant !== null &&
              occupant.owner_id === ctx.userId &&
              occupant.status === 'pending'
            ) {
              retomada = occupant.id;
            } else if (occupant) {
              prepared.push({ fileName, ok: false, error: 'document_code_conflict' });
              continue;
            }
            codesInBatch.add(codeKey);
          }

          const objectId = retomada ?? randomUUID();
          const objectPath = ports.storage.buildObjectPath(
            ctx.unitId,
            ctx.userId,
            `${randomUUID()}-${fileName}`,
          );

          const controlValues = [
            control.documentType ?? null,
            control.documentCode ?? null,
            control.documentRevision ?? null,
            control.responsibleSector ?? null,
            control.nextReviewAt ?? null,
            control.lifecycleState ?? null,
            awaitingRegistration,
          ];

          if (retomada) {
            await client.query(
              `UPDATE files SET object_path = $1, file_name = $2, content_type = $3, size_bytes = $4,
                 folder_id = $5, status = 'pending', pending_object_path = NULL,
                 document_type = $6, document_code = $7, document_revision = $8,
                 responsible_sector = $9, next_review_at = $10, lifecycle_state = $11,
                 awaiting_registration = $12
               WHERE id = $13`,
              [
                objectPath,
                fileName,
                contentType,
                declaredSizeBytes,
                pathResult.folderId,
                ...controlValues,
                retomada,
              ],
            );
          } else {
            await client.query(
              `INSERT INTO files (id, unit_id, owner_id, folder_id, object_path, file_name, content_type, size_bytes, status,
                 document_type, document_code, document_revision, responsible_sector, next_review_at, lifecycle_state,
                 awaiting_registration)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13, $14, $15)`,
              [
                objectId,
                ctx.unitId,
                ctx.userId,
                pathResult.folderId,
                objectPath,
                fileName,
                contentType,
                declaredSizeBytes,
                ...controlValues,
              ],
            );
          }
          reserved += declaredSizeBytes!;

          prepared.push({
            fileName,
            ok: true,
            objectPath,
            contentType,
            folderId: pathResult.folderId,
            awaitingRegistration,
            fileId: objectId,
          });
        }

        return { ok: true as const, prepared };
      });

      if (!outcome.ok) {
        res
          .status(outcome.status)
          .json({ error: outcome.status === 404 ? 'destination not found' : 'forbidden' });
        return;
      }

      // Assinatura fora da transação (mesmo padrão do upload-url singular):
      // evita manter a transação aberta durante N chamadas de rede ao signer.
      const results: BatchUploadItemResult[] = await Promise.all(
        outcome.prepared.map(async (item) => {
          if (!item.ok) return { fileName: item.fileName, ok: false, error: item.error };
          const signed = await ports.storage.getUploadUrl(item.objectPath, item.contentType);
          return {
            fileName: item.fileName,
            ok: true,
            uploadUrl: signed.url,
            objectPath: item.objectPath,
            folderId: item.folderId,
            expiresAt: signed.expiresAt.toISOString(),
            awaitingRegistration: item.awaitingRegistration,
          };
        }),
      );

      // US 10.9: aviso a quem enviou, um por arquivo pendente. Fora da
      // transação e **depois** da assinatura, com a falha engolida de
      // propósito: "a falha ao avisar NÃO SHALL impedir a conclusão do envio"
      // — mesmo princípio já aplicado ao aviso de concessão. A idempotência
      // por `(destinatário, tipo, sourceRef = arquivo)` é do próprio canal, de
      // modo que repetir a transferência não duplica nada.
      await Promise.all(
        outcome.prepared
          .filter((item) => item.ok && item.awaitingRegistration)
          .map(async (item) => {
            if (!item.ok) return;
            try {
              await ports.notifications.notify({
                unitId: ctx.unitId,
                recipientUserId: ctx.userId,
                kind: NotificationKind.REGISTRATION_PENDING,
                sourceRef: item.fileId,
                payload: { fileId: item.fileId, fileName: item.fileName },
              });
            } catch (err) {
              console.error('files: falha ao emitir aviso registration_pending', err);
            }
          }),
      );

      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/files/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { fileName } = req.body as RenameFileRequest;
      if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const file = await findAccessibleFile(ports, ctx, req.params.id, Permission.RENAME);
      // Dono-ou-grant `rename` (design.md D2/D3) — arquivo não visível pela
      // RLS, de outro dono sem grant, recebe o mesmo 403, sem distinguir os
      // dois casos.
      if (!file) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const updated = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<FileRow>(
          `UPDATE files SET file_name = $1 WHERE id = $2 RETURNING *, ${FILE_DERIVED_COLUMNS}`,
          [fileName, file.id],
        );
        return rows[0]!;
      });

      await recordAudit(ports, ctx, updated, AuditAction.RENAME);
      res.json(toFileSummaryResponse(updated));
    } catch (err) {
      next(err);
    }
  });

  /**
   * `PATCH /files/:id/document-control` — preencher ou corrigir os dados de
   * controle de um documento já existente (US 10.5, requisito "Dados de
   * controle podem ser preenchidos ou corrigidos depois").
   *
   * Exige a **mesma** permissão requerida para substituir o documento
   * (`rename`, o verbo que `POST /files/:id/replace-url` já usa) — nenhum
   * verbo novo entra em `grants` por causa desta change. Não recebe conteúdo
   * e **não** avança a revisão: quem avança é a substituição, no finalize
   * (`lib/storage-reconcile.ts`).
   *
   * Campo ausente no corpo não é tocado; campo enviado como `null` é limpo.
   * A distinção é o que permite corrigir o responsável sem apagar a data de
   * próxima revisão.
   */
  router.patch('/files/:id/document-control', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const parsed = parseDocumentControl(req.body as UpdateDocumentControlRequest, {
        requireAll: false,
      });
      if (!parsed.ok) {
        if (parsed.error === 'invalid_document_type') {
          const body: InvalidDocumentTypeResponse = { error: 'invalid_document_type' };
          res.status(400).json(body);
          return;
        }
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const control = parsed.value;
      const campos = Object.keys(control) as (keyof NormalizedDocumentControl)[];
      if (campos.length === 0) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const file = await findAccessibleFile(ports, ctx, req.params.id, Permission.RENAME);
      // Sem o verbo, 403 fail-closed sem distinguir de recurso inexistente —
      // e, para quem não é admin da unidade, documento obsoleto já resolveu
      // como inexistente em `hasAccess` (design.md D6).
      if (!file) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Fonte única do mapa campo→coluna, compartilhada com
      // `rowAwaitsRegistration` (US 10.9).
      const COLUNA = CONTROL_FIELD_COLUMN;

      const outcome = await ports.database
        .withTenantTransaction(ctx, async (client) => {
          if (control.documentCode) {
            const occupant = await findCodeOwner(client, control.documentCode, {
              excludeFileId: file.id,
            });
            if (occupant) {
              return { ok: false as const, code: control.documentCode };
            }
          }

          // `SET` montado só com os campos informados: os nomes de coluna vêm
          // do mapa acima (constantes internas), e os **valores** sempre por
          // placeholder — nenhum pedaço de entrada do usuário entra no texto
          // da query.
          const params: unknown[] = [];
          const sets = campos.map((campo) => {
            params.push(control[campo] ?? null);
            return `${COLUNA[campo]} = $${params.length}`;
          });
          params.push(file.id);

          const { rows } = await client.query<FileRow>(
            `UPDATE files SET ${sets.join(', ')} WHERE id = $${params.length}
             RETURNING *, ${FILE_DERIVED_COLUMNS}`,
            params,
          );
          const atualizado = rows[0]!;

          // US 10.9 (design.md D10): completar os dados **publica** o arquivo
          // pendente, na mesma transação. A avaliação é sobre a linha
          // resultante — por isso vem depois do `UPDATE` —, de modo que
          // informar só o campo que faltava baste. Preenchimento parcial
          // mantém a pendência, sem erro: gravar o que veio e continuar
          // pendente é o comportamento pedido.
          if (atualizado.awaiting_registration && !rowAwaitsRegistration(atualizado)) {
            const { rows: publicado } = await client.query<FileRow>(
              `UPDATE files SET awaiting_registration = false WHERE id = $1
               RETURNING *, ${FILE_DERIVED_COLUMNS}`,
              [file.id],
            );
            return { ok: true as const, file: publicado[0]! };
          }
          return { ok: true as const, file: atualizado };
        })
        .catch((err) => {
          if (isDocumentCodeConflict(err)) {
            return { ok: false as const, code: control.documentCode! };
          }
          throw err;
        });

      if (!outcome.ok) {
        const body: DocumentCodeInUseResponse = {
          error: 'document_code_in_use',
          code: outcome.code,
        };
        res.status(409).json(body);
        return;
      }

      // A situação vem reapurada no próprio `RETURNING` (design.md D2): não
      // existe passo de recálculo, porque a situação nunca foi gravada.
      res.json(toFileSummaryResponse(outcome.file));
    } catch (err) {
      next(err);
    }
  });

  /**
   * Mover vários arquivos para um mesmo destino (US 2.4, design.md D1/D2/D6
   * do change `mover-itens-em-lote`) — dois segmentos, sem colisão nem
   * requisito de ordenação de registro com `POST /files/:id/move` (três
   * segmentos, abaixo). Pré-condição global de destino derruba o lote
   * inteiro (mesmo alcance dono-ou-admin da rota por item); falta de alcance
   * sobre um item recusa só aquele item, sem abortar os demais (design.md
   * D2). Auditoria só para os itens efetivamente movidos, depois da
   * transação (design.md D6).
   */
  router.post('/files/move', async (req, res, next) => {
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

      // Dedup preservando ordem de chegada (mesmo padrão de POST /grants):
      // o teto e o veredito por item se aplicam a identificadores distintos.
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
        // Pré-condição global de destino (design.md D2): mesmo alcance
        // dono-ou-admin exigido pela rota por item, indistinguível entre
        // inexistente/de outra unidade/na lixeira/sem alcance.
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
        const movedFiles: FileRow[] = [];

        for (const id of uniqueIds) {
          const { rows } = await client.query<FileRow>(
            `SELECT *, ${FILE_DERIVED_COLUMNS} FROM files WHERE id = $1 AND deleted_at IS NULL`,
            [id],
          );
          const file = rows[0];
          if (!file) {
            results.push({ id, ok: false, error: 'forbidden' });
            continue;
          }
          const allowed = await canReorganize(client, ctx, GrantResourceType.FILE, file.id);
          if (!allowed) {
            results.push({ id, ok: false, error: 'forbidden' });
            continue;
          }

          const { rows: updated } = await client.query<FileRow>(
            `UPDATE files SET folder_id = $1 WHERE id = $2 RETURNING *, ${FILE_DERIVED_COLUMNS}`,
            [destinationFolderId, file.id],
          );
          movedFiles.push(updated[0]!);
          results.push({ id, ok: true });
        }

        return { ok: true as const, results, movedFiles };
      });

      if (!outcome.ok) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      await recordAudits(ports, ctx, outcome.movedFiles, AuditAction.MOVE);

      const response: MoveBatchResponse = { results: outcome.results };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.post('/files/:id/move', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { destinationFolderId } = req.body as MoveItemRequest;
      if (destinationFolderId !== null && typeof destinationFolderId !== 'string') {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<FileRow>(
          `SELECT *, ${FILE_DERIVED_COLUMNS} FROM files WHERE id = $1 AND deleted_at IS NULL`,
          [req.params.id],
        );
        const file = rows[0];
        if (!file) return { ok: false as const };
        // Dono-ou-admin da unidade, sem ramo de grant (design.md D1/D2 de
        // `mover-e-renomear-itens`) — `rename`/`upload` sobre item ou
        // destino NÃO habilitam esta operação nesta fatia.
        const allowed = await canReorganize(client, ctx, GrantResourceType.FILE, file.id);
        if (!allowed) return { ok: false as const };

        // Destino nulo = raiz da unidade, sem exigir alcance (design.md D1).
        // Destino não-nulo exige o mesmo alcance dono-ou-admin, sobre a
        // pasta de destino (D1: "vale para os dois lados").
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

        // Só a localização lógica muda — object_path, size_bytes, owner_id,
        // status e file_name ficam intocados (spec `gestao-arquivos`).
        const { rows: updated } = await client.query<FileRow>(
          `UPDATE files SET folder_id = $1 WHERE id = $2 RETURNING *, ${FILE_DERIVED_COLUMNS}`,
          [destinationFolderId, file.id],
        );
        return { ok: true as const, file: updated[0]! };
      });

      if (!outcome.ok) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      await recordAudit(ports, ctx, outcome.file, AuditAction.MOVE);
      res.json(toFileSummaryResponse(outcome.file));
    } catch (err) {
      next(err);
    }
  });

  router.post('/files/:id/replace-url', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { contentType, declaredSizeBytes } = req.body as ReplaceFileRequest;
      if (!contentType || !Number.isFinite(declaredSizeBytes) || declaredSizeBytes! < 0) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const file = await findAccessibleFile(ports, ctx, req.params.id, Permission.RENAME);
      if (!file) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const objectId = randomUUID();
      const newObjectPath = ports.storage.buildObjectPath(
        ctx.unitId,
        ctx.userId,
        `${objectId}-${file.file_name}`,
      );

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<{ storage_used_bytes: string } & QuotaRow>(
          `SELECT ${QUOTA_COLUMNS} FROM users WHERE id = $1`,
          [ctx.userId],
        );
        const currentUsage = Number(rows[0]?.storage_used_bytes ?? '0');
        const oldSize = Number(file.size_bytes ?? '0');
        // Cota pelo delta (design.md D6): a versão antiga já está contada
        // em `storage_used_bytes`, então só a diferença importa.
        const projectedUsage = currentUsage - oldSize + declaredSizeBytes!;
        if (projectedUsage > resolveQuotaBytes(rows[0])) {
          return { ok: false as const };
        }

        // O ponteiro vivo (`object_path`) NÃO muda aqui: se o upload da nova
        // versão for abandonado, o arquivo vigente continua íntegro e
        // consultável. `pending_object_path` guarda o destino do objeto novo
        // até o finalize (routes/storage-events.ts) promover o ponteiro.
        // `status = 'replacing'` (não 'pending') preserva `size_bytes`
        // vigente na linha para o finalize calcular o delta real sem contar
        // em dobro. `folder_id` e `file_name` também são preservados.
        //
        // Pela mesma razão a **revisão não avança aqui** (US 10.6, design.md
        // D8 de `controle-documental`): ela avança junto com a promoção do
        // ponteiro, no finalize (`lib/storage-reconcile.ts`) — adiantar o
        // número mostraria `Rev. 02` sobre o conteúdo da `Rev. 01`, e uma
        // substituição abandonada deixaria a numeração mentindo para sempre.
        await client.query(
          `UPDATE files SET pending_object_path = $1, status = 'replacing' WHERE id = $2`,
          [newObjectPath, file.id],
        );
        return { ok: true as const };
      });

      if (!outcome.ok) {
        res.status(400).json({ error: 'quota exceeded' });
        return;
      }

      const signed = await ports.storage.getUploadUrl(newObjectPath, contentType);
      res.json({
        uploadUrl: signed.url,
        objectPath: newObjectPath,
        expiresAt: signed.expiresAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/files/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const file = await findAccessibleFile(ports, ctx, req.params.id, Permission.DELETE);
      // Dono-ou-grant `delete` ou admin da unidade (design.md D3): sem
      // alcance, 403 fail-closed sem vazar existência.
      if (!file) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const updated = await ports.database.withTenantTransaction(ctx, async (client) => {
        // Arquivo avulso é sua própria raiz de exclusão (design.md D4);
        // `folder_id`/grants nunca mudam, só a marcação.
        const { rows } = await client.query<FileRow>(
          `UPDATE files SET deleted_at = now(), deleted_by = $1, trash_root_id = id WHERE id = $2
           RETURNING *, ${FILE_DERIVED_COLUMNS}`,
          [ctx.userId, file.id],
        );
        return rows[0]!;
      });

      await recordAudit(ports, ctx, updated, AuditAction.DELETE);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/files/:id/restore', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<FileRow & { trash_root_id: string | null }>(
          `SELECT *, ${FILE_DERIVED_COLUMNS} FROM files WHERE id = $1 AND deleted_at IS NOT NULL`,
          [req.params.id],
        );
        const file = rows[0];
        if (!file) return { ok: false as const };

        // Só raízes de exclusão são restauráveis individualmente
        // (design.md D5) — um descendente de uma pasta excluída volta junto
        // ao restaurar a raiz da pasta, não sozinho.
        if (file.trash_root_id !== file.id) return { ok: false as const };

        const allowed = await hasAccess(
          client,
          ctx,
          GrantResourceType.FILE,
          file.id,
          Permission.DELETE,
          {
            includeTrash: true,
          },
        );
        if (!allowed) return { ok: false as const };

        // Épico 10 (design.md D5): o código do documento pode ter sido reusado
        // enquanto ele estava na lixeira — o índice único recusaria a volta
        // com um 23505 cru. A recusa nomeada diz **qual** documento ocupa o
        // código, para a pessoa poder resolver; liberar o duplicado quebraria
        // a unicidade, e travar o reuso enquanto houvesse documento na lixeira
        // tornaria um código irrecuperável por até 30 dias sem explicação.
        if (file.document_code) {
          const occupant = await findCodeOwner(client, file.document_code, {
            excludeFileId: file.id,
          });
          if (occupant) {
            return {
              ok: false as const,
              codeInUse: {
                code: file.document_code,
                occupiedBy: { id: occupant.id, fileName: occupant.file_name },
              },
            };
          }
        }

        // Pai não existe mais como pasta viva (ancestral expurgado ou ainda
        // na lixeira) ⇒ volta para a raiz da unidade, informado na resposta
        // (design.md D5).
        let redirectedToRoot = false;
        let targetFolderId = file.folder_id;
        if (file.folder_id) {
          const { rows: parentRows } = await client.query(
            'SELECT 1 FROM folders WHERE id = $1 AND deleted_at IS NULL',
            [file.folder_id],
          );
          if (!parentRows[0]) {
            redirectedToRoot = true;
            targetFolderId = null;
          }
        }

        const { rows: restored } = await client.query<FileRow>(
          `UPDATE files SET deleted_at = NULL, deleted_by = NULL, trash_root_id = NULL, folder_id = $1
           WHERE id = $2 RETURNING *, ${FILE_DERIVED_COLUMNS}`,
          [targetFolderId, file.id],
        );
        return { ok: true as const, file: restored[0]!, redirectedToRoot };
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

      await recordAudit(ports, ctx, outcome.file, AuditAction.RESTORE);
      const response: FileRestoreResponse = {
        ...toFileSummaryResponse(outcome.file),
        redirectedToRoot: outcome.redirectedToRoot,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
