import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Ports } from '../ports/index.js';
import {
  AuditAction,
  FileAccessAction,
  GrantResourceType,
  Permission,
  isPreviewable,
} from '@gdoc/shared';
import type {
  BatchUploadItemResult,
  BatchUploadUrlRequest,
  FileRestoreResponse,
  FileSummaryResponse,
  MoveItemRequest,
  RenameFileRequest,
  ReplaceFileRequest,
  UploadUrlRequest,
  ViewUrlResponse,
} from '@gdoc/shared';
import { config } from '../config.js';
import { ensureFolderPath, findFolderById, validateAnchor } from '../lib/folder-tree.js';
import { canReorganize, hasAccess } from '../lib/access.js';

interface FileRow {
  id: string;
  unit_id: string;
  owner_id: string;
  folder_id: string | null;
  object_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: string | null;
  status: string;
  created_at: string;
}

function toFileSummaryResponse(row: FileRow): FileSummaryResponse {
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
    const { rows } = await client.query<FileRow>('SELECT * FROM files WHERE id = $1', [fileId]);
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

export function filesRouter(ports: Ports): Router {
  const router = Router();

  router.post('/files/:id/view-url', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const file = await findAccessibleFile(ports, ctx, req.params.id, Permission.VIEW);
      // Dono-ou-grant `view` (design.md D2): sem posse nem o verbo, nenhuma
      // URL é emitida e nenhuma auditoria é gravada (US 4.2, fail-closed).
      if (!file) {
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

  router.post('/files/upload-url', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { fileName, contentType, declaredSizeBytes, folderId } = req.body as UploadUrlRequest;

      if (
        !fileName ||
        !contentType ||
        !Number.isFinite(declaredSizeBytes) ||
        declaredSizeBytes! < 0
      ) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const objectId = randomUUID();
      const objectPath = ports.storage.buildObjectPath(
        ctx.unitId,
        ctx.userId,
        `${objectId}-${fileName}`,
      );

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        if (folderId) {
          // RLS restringe a leitura à unidade do remetente — pasta de outra
          // unidade não aparece aqui (navegacao spec: "a pasta de destino
          // SHALL pertencer à mesma unidade do remetente"). Pasta própria
          // segue livre; pasta de outra pessoa exige grant `upload`
          // (design.md D3, Épico 4).
          const anchor = await validateAnchor(client, ctx, folderId);
          if (!anchor.ok) return { ok: false as const, status: anchor.status };
        }

        const { rows } = await client.query<{ storage_used_bytes: string }>(
          'SELECT storage_used_bytes FROM users WHERE id = $1',
          [ctx.userId],
        );
        const currentUsage = Number(rows[0]?.storage_used_bytes ?? '0');
        if (currentUsage + declaredSizeBytes! > config.storageQuotaBytesPerUser) {
          return { ok: false as const, status: 400 as const };
        }

        await client.query(
          `INSERT INTO files (id, unit_id, owner_id, folder_id, object_path, file_name, content_type, size_bytes, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
          [
            objectId,
            ctx.unitId,
            ctx.userId,
            folderId ?? null,
            objectPath,
            fileName,
            contentType,
            declaredSizeBytes,
          ],
        );
        return { ok: true as const };
      });

      if (!outcome.ok) {
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

  router.post('/files/upload-urls', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { destinationFolderId, items } = req.body as BatchUploadUrlRequest;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      type PreparedItem =
        | {
            fileName: string;
            ok: true;
            objectPath: string;
            contentType: string;
            folderId: string | null;
          }
        | { fileName: string; ok: false; error: string };

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        // Pré-condição global (design.md D1): destino inválido/de outra
        // unidade derruba o lote inteiro, sem vazar existência — diferente
        // dos erros por item, que não abortam os demais.
        const anchor = await validateAnchor(client, ctx, destinationFolderId);
        if (!anchor.ok) return { ok: false as const, status: anchor.status };

        const { rows: usageRows } = await client.query<{ storage_used_bytes: string }>(
          'SELECT storage_used_bytes FROM users WHERE id = $1',
          [ctx.userId],
        );
        const baseUsage = Number(usageRows[0]?.storage_used_bytes ?? '0');

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

        for (const item of items) {
          const { fileName, contentType, declaredSizeBytes, relativePath } =
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

          const available = config.storageQuotaBytesPerUser - baseUsage - reserved;
          if (declaredSizeBytes! > available) {
            prepared.push({ fileName, ok: false, error: 'quota exceeded' });
            continue;
          }

          const objectId = randomUUID();
          const objectPath = ports.storage.buildObjectPath(
            ctx.unitId,
            ctx.userId,
            `${objectId}-${fileName}`,
          );

          await client.query(
            `INSERT INTO files (id, unit_id, owner_id, folder_id, object_path, file_name, content_type, size_bytes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
            [
              objectId,
              ctx.unitId,
              ctx.userId,
              pathResult.folderId,
              objectPath,
              fileName,
              contentType,
              declaredSizeBytes,
            ],
          );
          reserved += declaredSizeBytes!;

          prepared.push({
            fileName,
            ok: true,
            objectPath,
            contentType,
            folderId: pathResult.folderId,
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
          };
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
          'UPDATE files SET file_name = $1 WHERE id = $2 RETURNING *',
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
          'SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL',
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
          'UPDATE files SET folder_id = $1 WHERE id = $2 RETURNING *',
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
        const { rows } = await client.query<{ storage_used_bytes: string }>(
          'SELECT storage_used_bytes FROM users WHERE id = $1',
          [ctx.userId],
        );
        const currentUsage = Number(rows[0]?.storage_used_bytes ?? '0');
        const oldSize = Number(file.size_bytes ?? '0');
        // Cota pelo delta (design.md D6): a versão antiga já está contada
        // em `storage_used_bytes`, então só a diferença importa.
        const projectedUsage = currentUsage - oldSize + declaredSizeBytes!;
        if (projectedUsage > config.storageQuotaBytesPerUser) {
          return { ok: false as const };
        }

        // O ponteiro vivo (`object_path`) NÃO muda aqui: se o upload da nova
        // versão for abandonado, o arquivo vigente continua íntegro e
        // consultável. `pending_object_path` guarda o destino do objeto novo
        // até o finalize (routes/storage-events.ts) promover o ponteiro.
        // `status = 'replacing'` (não 'pending') preserva `size_bytes`
        // vigente na linha para o finalize calcular o delta real sem contar
        // em dobro. `folder_id` e `file_name` também são preservados.
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
          `UPDATE files SET deleted_at = now(), deleted_by = $1, trash_root_id = id WHERE id = $2 RETURNING *`,
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
          'SELECT * FROM files WHERE id = $1 AND deleted_at IS NOT NULL',
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
           WHERE id = $2 RETURNING *`,
          [targetFolderId, file.id],
        );
        return { ok: true as const, file: restored[0]!, redirectedToRoot };
      });

      if (!outcome.ok) {
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
