import { Router } from 'express';
import type { Ports } from '../ports/index.js';
import { GrantResourceType, Permission } from '@gdoc/shared';
import type { TrashEntryResponse, TrashListResponse, TrashPurgeResponse } from '@gdoc/shared';
import { config } from '../config.js';
import { isAdminOfUnit, resourceScopeClause } from '../lib/access.js';
import { purgeFile, type PurgeableFile } from '../lib/purge-file.js';

interface TrashRow {
  id: string;
  name: string;
  deleted_at: string;
}

function toEntry(row: TrashRow, type: GrantResourceType): TrashEntryResponse {
  const deletedAt = new Date(row.deleted_at);
  const expiresAt = new Date(deletedAt.getTime() + config.trashRetentionDays * 24 * 60 * 60 * 1000);
  return {
    id: row.id,
    type,
    name: row.name,
    deletedAt: deletedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * `GET /trash` — raízes de exclusão no alcance do solicitante: próprias,
 * com grant `delete`, ou toda a unidade se admin (design.md D9). Mesmo
 * fragmento de alcance de `hasAccess`/`visibleResourceClause`
 * (`resourceScopeClause`), mas com o filtro de `deleted_at` invertido — só
 * raízes (`trash_root_id = id`) aparecem, nunca descendentes soltos.
 */
export function trashRouter(ports: Ports): Router {
  const router = Router();

  router.get('/trash', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const admin = isAdminOfUnit(ctx, ctx.unitId);
      const params: string[] = admin ? [] : [ctx.userId];
      const ownerPlaceholder = admin ? '' : `$${params.length}`;

      const folderScope = resourceScopeClause(
        GrantResourceType.FOLDER,
        ownerPlaceholder,
        ctx,
        Permission.DELETE,
      );
      const fileScope = resourceScopeClause(
        GrantResourceType.FILE,
        ownerPlaceholder,
        ctx,
        Permission.DELETE,
      );

      const { folders, files } = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows: folders } = await client.query<TrashRow>(
          `SELECT id, name, deleted_at FROM folders
           WHERE deleted_at IS NOT NULL AND trash_root_id = id AND ${folderScope}
           ORDER BY deleted_at DESC`,
          params,
        );
        const { rows: files } = await client.query<TrashRow>(
          `SELECT id, file_name AS name, deleted_at FROM files
           WHERE deleted_at IS NOT NULL AND trash_root_id = id AND ${fileScope}
           ORDER BY deleted_at DESC`,
          params,
        );
        return { folders, files };
      });

      const items: TrashEntryResponse[] = [
        ...folders.map((row) => toEntry(row, GrantResourceType.FOLDER)),
        ...files.map((row) => toEntry(row, GrantResourceType.FILE)),
      ];
      const response: TrashListResponse = { items };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  /**
   * `POST /trash/purge` (change `esvaziar-lixeira`) — expurgo **imediato e
   * irreversível** dos arquivos do próprio solicitante que estão na lixeira,
   * sem aguardar o prazo de retenção, devolvendo a cota correspondente.
   *
   * Alcance estritamente próprio (design.md D2): o filtro `owner_id =
   * ctx.userId` impede alcançar outra pessoa da mesma unidade, e a RLS por
   * `unit_id` impede alcançar outra unidade. O bypass de `global_admin`
   * **não** é usado — esta é rota de conteúdo, e destrutiva; o admin global
   * esvazia a própria lixeira, nunca a de terceiro. O job continua varrendo
   * cross-unit com contexto de sistema, que é outro caminho.
   *
   * Somente **arquivos**, nunca pastas (design.md D1): pasta não ocupa bytes
   * e não devolve cota alguma, e apagar uma pasta minha que ainda abriga na
   * lixeira o arquivo de outra pessoa violaria o FK daquele arquivo. As
   * pastas seguem sujeitas exclusivamente ao expurgo automático.
   *
   * Sem filtro de prazo — é justamente o que a ação acrescenta — e sem
   * filtro de `trash_root_id`: o que se recupera é espaço, e um arquivo meu
   * dentro de uma pasta excluída ocupa bytes do mesmo jeito (é também o que
   * `trashedBytes`/`trashedFiles` de `GET /files/quota` contam, então o
   * número confirmado na tela é o número apagado).
   *
   * Tolerante a falha por item (design.md D3): a falha ao remover bytes de um
   * arquivo não impede o expurgo dos demais, e o arquivo que falhou continua
   * íntegro na lixeira — candidato a uma nova tentativa ou ao ciclo do job.
   */
  router.post('/trash/purge', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;

      const own = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<PurgeableFile>(
          `SELECT id, owner_id, object_path, pending_object_path, size_bytes FROM files
           WHERE deleted_at IS NOT NULL AND owner_id = $1`,
          [ctx.userId],
        );
        return rows;
      });

      const response: TrashPurgeResponse = { purgedFiles: 0, reclaimedBytes: 0, failedFiles: 0 };

      for (const file of own) {
        try {
          response.reclaimedBytes += await purgeFile(ports.database, ports.storage, ctx, file);
          response.purgedFiles += 1;
        } catch (err) {
          response.failedFiles += 1;
          console.error(`trash/purge: falha ao expurgar arquivo ${file.id}`, err);
        }
      }

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
