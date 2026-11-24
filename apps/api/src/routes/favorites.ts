import { Router } from 'express';
import type { PoolClient } from 'pg';
import { GrantResourceType, Permission } from '@gdoc/shared';
import type {
  FavoriteItemResponse,
  FavoriteMarkResponse,
  FavoritesLimitExceededResponse,
  FavoritesResponse,
} from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { hasAccess, isAdminOfUnit, resourceTable } from '../lib/access.js';
import {
  fileSummaryColumns,
  toFileSummaryResponse,
  type FileSummaryRow,
} from '../lib/document-control.js';
import { config } from '../config.js';

const RESOURCE_TYPES: readonly string[] = Object.values(GrantResourceType);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FavoriteRow {
  resource_type: GrantResourceType;
  resource_id: string;
  created_at: string;
}

/** Parâmetros de rota válidos, ou `null` — tipo fora do conjunto e id malformado resolvem igual. */
function parseResource(params: {
  resourceType?: string;
  resourceId?: string;
}): { resourceType: GrantResourceType; resourceId: string } | null {
  const { resourceType, resourceId } = params;
  if (!resourceType || !RESOURCE_TYPES.includes(resourceType)) return null;
  if (!resourceId || !UUID.test(resourceId)) return null;
  return { resourceType: resourceType as GrantResourceType, resourceId };
}

/**
 * Nome das pastas sobreviventes e da pasta que as contém — **só** ela, nunca a
 * trilha (mesma regra de `compartilhados-comigo`, design.md D8).
 */
async function readFolders(
  client: PoolClient,
  ids: string[],
): Promise<Map<string, { name: string; folder_name: string | null }>> {
  const { rows } = await client.query<{ id: string; name: string; folder_name: string | null }>(
    `SELECT f.id, f.name,
            (SELECT p.name FROM folders p WHERE p.id = f.parent_id) AS folder_name
     FROM folders f WHERE f.id = ANY($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row]));
}

type FavoriteFileRow = FileSummaryRow & { folder_name: string | null };

/**
 * Resumo dos arquivos sobreviventes pelo **mesmo** fragmento da listagem de
 * pasta, da busca e dos recentes. O placeholder do dono só entra nos
 * parâmetros quando não-admin — mesmo cuidado de `routes/recent.ts`.
 */
async function readFiles(
  client: PoolClient,
  ctx: TenantContext,
  ids: string[],
): Promise<Map<string, FavoriteFileRow>> {
  const admin = isAdminOfUnit(ctx, ctx.unitId);
  const params: unknown[] = admin ? [] : [ctx.userId];
  const ownerPlaceholder = admin ? '' : `$${params.length}`;
  params.push(ids);
  const { rows } = await client.query<FavoriteFileRow>(
    `SELECT ${fileSummaryColumns(ctx, ownerPlaceholder)},
            (SELECT p.name FROM folders p WHERE p.id = files.folder_id) AS folder_name
     FROM files WHERE id = ANY($${params.length}::uuid[])`,
    params,
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * `routes/favorites.ts` — favoritos (US 2.5, change `favoritos`).
 *
 * **Favorito não é permissão** (design.md D3): nenhuma regra de acesso lê
 * `favorites`, e a lista confirma cada marca por `hasAccess` — nenhuma segunda
 * expressão da regra, pelo precedente de `GET /files/recent` e de
 * `GET /grants/received`.
 *
 * A RLS isola unidades, não pessoas: toda leitura e escrita filtra
 * `user_id = ctx.userId` explicitamente (design.md D1), de modo que nem o
 * administrador da unidade vê ou altera favorito alheio.
 */
export function favoritesRouter(ports: Ports): Router {
  const router = Router();

  // Marcar (design.md D2): exige `view`; sem alcance responde 404 sem
  // distinguir inexistente, de outra unidade, na lixeira, obsoleto ou
  // pendente de outra pessoa — marcar o que não se vê seria a primeira forma
  // de confirmar que existe. Idempotente.
  router.put('/favorites/:resourceType/:resourceId', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const resource = parseResource(req.params);
      if (!resource) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        const alcanca = await hasAccess(
          client,
          ctx,
          resource.resourceType,
          resource.resourceId,
          Permission.VIEW,
        );
        if (!alcanca) return { status: 404 as const };

        const { rows: existentes } = await client.query<{ created_at: string }>(
          `SELECT created_at FROM favorites
           WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
          [ctx.userId, resource.resourceType, resource.resourceId],
        );
        if (existentes[0]) {
          return { status: 200 as const, favoritedAt: existentes[0].created_at };
        }

        // Teto contando **todas** as marcas, inclusive as ocultas por perda de
        // acesso (design.md D4).
        const { rows: contagem } = await client.query<{ total: string }>(
          'SELECT count(*) AS total FROM favorites WHERE user_id = $1',
          [ctx.userId],
        );
        if (Number(contagem[0]!.total) >= config.favorites.maxPerUser) {
          return { status: 409 as const };
        }

        // `unit_id` do **recurso**, lido aqui — nunca do corpo (design.md D1).
        const { rows: recurso } = await client.query<{ unit_id: string }>(
          `SELECT unit_id FROM ${resourceTable(resource.resourceType)} WHERE id = $1`,
          [resource.resourceId],
        );
        const { rows } = await client.query<{ created_at: string }>(
          `INSERT INTO favorites (unit_id, user_id, resource_type, resource_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, resource_type, resource_id) DO UPDATE SET user_id = EXCLUDED.user_id
           RETURNING created_at`,
          [recurso[0]!.unit_id, ctx.userId, resource.resourceType, resource.resourceId],
        );
        return { status: 200 as const, favoritedAt: rows[0]!.created_at };
      });

      if (outcome.status === 404) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (outcome.status === 409) {
        const body: FavoritesLimitExceededResponse = {
          error: 'favorites_limit_exceeded',
          allowed: config.favorites.maxPerUser,
        };
        res.status(409).json(body);
        return;
      }
      const body: FavoriteMarkResponse = {
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        favoritedAt: new Date(outcome.favoritedAt).toISOString(),
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  // Desmarcar (design.md D2): **não** exige alcance — quem perdeu o acesso
  // pode limpar a própria marca, e a operação só toca linhas da própria
  // pessoa. Idempotente: 204 com ou sem marca, sem revelar nada.
  router.delete('/favorites/:resourceType/:resourceId', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const resource = parseResource(req.params);
      if (resource) {
        await ports.database.withTenantTransaction(ctx, (client) =>
          client.query(
            `DELETE FROM favorites WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
            [ctx.userId, resource.resourceType, resource.resourceId],
          ),
        );
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Lista (design.md D3): parte da **marca** e confirma por `hasAccess`. O
  // que não passa é **omitido, não apagado** — concessão vencida é
  // reversível, e uma leitura que apagasse dado como efeito colateral seria
  // surpresa. `unit_id` comparado explicitamente pela trava do bypass.
  router.get('/favorites', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;

      const items = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows: marcas } = await client.query<FavoriteRow>(
          `SELECT resource_type, resource_id, created_at FROM favorites
           WHERE user_id = $1 AND unit_id = $2
           ORDER BY created_at DESC, resource_id`,
          [ctx.userId, ctx.unitId],
        );

        const vigentes: { marca: FavoriteRow; permissions: Permission[] }[] = [];
        for (const marca of marcas) {
          const ve = await hasAccess(
            client,
            ctx,
            marca.resource_type,
            marca.resource_id,
            Permission.VIEW,
          );
          if (!ve) continue;
          const permissions: Permission[] = [Permission.VIEW];
          if (
            marca.resource_type === GrantResourceType.FILE &&
            (await hasAccess(
              client,
              ctx,
              GrantResourceType.FILE,
              marca.resource_id,
              Permission.DOWNLOAD,
            ))
          ) {
            permissions.push(Permission.DOWNLOAD);
          }
          vigentes.push({ marca, permissions });
        }
        if (vigentes.length === 0) return [];

        const idsDe = (tipo: GrantResourceType) =>
          vigentes.filter((v) => v.marca.resource_type === tipo).map((v) => v.marca.resource_id);
        const idsDePasta = idsDe(GrantResourceType.FOLDER);
        const idsDeArquivo = idsDe(GrantResourceType.FILE);
        const pastas = idsDePasta.length ? await readFolders(client, idsDePasta) : new Map();
        const arquivos = idsDeArquivo.length
          ? await readFiles(client, ctx, idsDeArquivo)
          : new Map<string, FavoriteFileRow>();

        return vigentes.flatMap<FavoriteItemResponse>(({ marca, permissions }) => {
          const comum = {
            resourceType: marca.resource_type,
            id: marca.resource_id,
            permissions,
            favoritedAt: new Date(marca.created_at).toISOString(),
          };
          if (marca.resource_type === GrantResourceType.FOLDER) {
            const pasta = pastas.get(marca.resource_id);
            if (!pasta) return [];
            return [{ ...comum, name: pasta.name, folderName: pasta.folder_name, file: null }];
          }
          const arquivo = arquivos.get(marca.resource_id);
          if (!arquivo) return [];
          const resumo = toFileSummaryResponse(arquivo);
          return [
            { ...comum, name: resumo.fileName, folderName: arquivo.folder_name, file: resumo },
          ];
        });
      });

      const response: FavoritesResponse = { items };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * Ids favoritados por quem consulta, **restritos** às pastas e aos arquivos de
 * uma listagem já filtrada pelo alcance (design.md D5) — não amplia nada.
 */
export async function favoriteIdsAmong(
  client: PoolClient,
  ctx: TenantContext,
  folderIds: string[],
  fileIds: string[],
): Promise<{ favoriteFolderIds: string[]; favoriteFileIds: string[] }> {
  if (folderIds.length === 0 && fileIds.length === 0) {
    return { favoriteFolderIds: [], favoriteFileIds: [] };
  }
  const { rows } = await client.query<{ resource_type: string; resource_id: string }>(
    `SELECT resource_type, resource_id FROM favorites
     WHERE user_id = $1
       AND ((resource_type = 'folder' AND resource_id = ANY($2::uuid[]))
         OR (resource_type = 'file' AND resource_id = ANY($3::uuid[])))`,
    [ctx.userId, folderIds, fileIds],
  );
  return {
    favoriteFolderIds: rows.filter((r) => r.resource_type === 'folder').map((r) => r.resource_id),
    favoriteFileIds: rows.filter((r) => r.resource_type === 'file').map((r) => r.resource_id),
  };
}
