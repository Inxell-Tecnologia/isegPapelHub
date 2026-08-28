import type { PoolClient } from 'pg';
import { GrantResourceType, Permission } from '@gdoc/shared';
import type { TenantContext } from '../ports/database-port.js';
import { hasAccess, isAdminOfUnit, resourceScopeClause, visibleResourceClause } from './access.js';

export interface FolderRow {
  id: string;
  unit_id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

/**
 * Pasta na lixeira resolve como inexistente (design.md D2) — breadcrumb,
 * validação de âncora de upload e a rota de conteúdo não enxergam pasta
 * excluída; a lixeira e o restore consultam `folders` diretamente, sem
 * passar por aqui.
 */
export async function findFolderById(
  client: PoolClient,
  folderId: string,
): Promise<FolderRow | null> {
  const { rows } = await client.query<FolderRow>(
    'SELECT * FROM folders WHERE id = $1 AND deleted_at IS NULL',
    [folderId],
  );
  return rows[0] ?? null;
}

export type AnchorValidation =
  { ok: true; anchor: FolderRow | null } | { ok: false; status: 404 | 403 };

/**
 * Valida a pasta-âncora (`parentId`/`destinationFolderId`): RLS já restringe
 * a leitura à unidade do usuário — pasta de outra unidade simplesmente não
 * aparece aqui, sem distinguir "não existe" de "é de outra unidade"
 * (design.md D3/D4: "sem vazar"). `anchorId` ausente/`null` = raiz. Enviar
 * para pasta própria segue livre (posse); para pasta de outra pessoa exige
 * grant `upload` sobre ela (Épico 4, design.md D3).
 */
export async function validateAnchor(
  client: PoolClient,
  ctx: TenantContext,
  anchorId: string | null | undefined,
): Promise<AnchorValidation> {
  if (!anchorId) return { ok: true, anchor: null };
  const anchor = await findFolderById(client, anchorId);
  if (!anchor) return { ok: false, status: 404 };
  const allowed = await hasAccess(
    client,
    ctx,
    GrantResourceType.FOLDER,
    anchor.id,
    Permission.UPLOAD,
  );
  if (!allowed) return { ok: false, status: 403 };
  return { ok: true, anchor };
}

/**
 * Normaliza um `relativePath` em segmentos, rejeitando vazios, `.`/`..` e
 * separadores estranhos — barreira contra path traversal (design.md D3):
 * o caminho nunca vira caminho físico no bucket, só define a árvore lógica
 * de `folders`, mas ainda assim não pode escapar da âncora.
 */
export function normalizeRelativePath(relativePath: string): string[] | null {
  if (typeof relativePath !== 'string') return null;
  const trimmed = relativePath.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes('\\') || trimmed.includes('\0')) return null;

  const segments = trimmed.split('/').map((segment) => segment.trim());
  for (const segment of segments) {
    if (segment.length === 0) return null;
    if (segment === '.' || segment === '..') return null;
  }
  return segments;
}

async function findOrCreateChild(
  client: PoolClient,
  ctx: TenantContext,
  parentId: string | null,
  name: string,
): Promise<FolderRow> {
  // `ON CONFLICT` casa com o índice único parcial `folders_unit_parent_name_uidx`
  // (migração 0006, restrito a `deleted_at IS NULL` pela 0008), tornando a
  // criação idempotente sob concorrência. Desde a migração `0014`
  // (`NULLS NOT DISTINCT`, design.md D5 de `mover-e-renomear-itens`) o
  // índice cobre também a raiz (`parent_id IS NULL`) — antes disso dois
  // `NULL` não colidiam em índice único do Postgres, e esta função precisava
  // de uma leitura prévia como remendo só para a raiz. Não é mais necessário:
  // o `INSERT ... ON CONFLICT DO NOTHING` seguido da leitura abaixo é
  // suficiente e idêntico em qualquer nível.
  await client.query(
    `INSERT INTO folders (unit_id, owner_id, parent_id, name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (unit_id, parent_id, lower(name)) WHERE deleted_at IS NULL DO NOTHING`,
    [ctx.unitId, ctx.userId, parentId, name],
  );

  const { rows } = await client.query<FolderRow>(
    `SELECT * FROM folders
     WHERE unit_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND lower(name) = lower($3) AND deleted_at IS NULL`,
    [ctx.unitId, parentId, name],
  );
  return rows[0]!;
}

/**
 * Garante a existência da cadeia de pastas de `relativePath` sob `anchorId`
 * (design.md D3), criando os níveis que faltarem e reaproveitando os
 * existentes, e devolve o `id` da pasta-folha. `relativePath` ausente
 * devolve a própria âncora, sem tocar o banco.
 */
export async function ensureFolderPath(
  client: PoolClient,
  ctx: TenantContext,
  anchorId: string | null,
  relativePath: string | undefined,
): Promise<{ ok: true; folderId: string | null } | { ok: false; error: string }> {
  if (relativePath === undefined) return { ok: true, folderId: anchorId };

  const segments = normalizeRelativePath(relativePath);
  if (!segments) return { ok: false, error: 'invalid path' };

  let parentId = anchorId;
  for (const name of segments) {
    const folder = await findOrCreateChild(client, ctx, parentId, name);
    parentId = folder.id;
  }
  return { ok: true, folderId: parentId };
}

/**
 * Ids da pasta e de toda a sua subárvore (design.md D4 de
 * `epico-6-lixeira-retencao`; movida de `routes/folders.ts` para cá em
 * `mover-e-renomear-itens` para ser reusada pela verificação de ciclo
 * pré-`UPDATE`, task 4.1), via CTE recursiva por `parent_id`. Guarda de
 * ciclo (design.md D3): a cláusula `CYCLE` do Postgres (14+) descarta a
 * travessia de qualquer nó revisitado, em vez do `UNION ALL` nu de antes —
 * antes desta mudança um ciclo era estruturalmente impossível e a travessia
 * nunca precisou de guarda; mover é a primeira operação que reescreve
 * `parent_id`. Uma linha inconsistente por qualquer via termina a consulta
 * normalmente, sem recursionar até estourar no Postgres.
 */
export async function collectSubtreeFolderIds(
  client: PoolClient,
  rootId: string,
): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    `WITH RECURSIVE subtree(id) AS (
       SELECT id FROM folders WHERE id = $1
       UNION ALL
       SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
     )
     CYCLE id SET is_cycle USING path
     SELECT id FROM subtree WHERE NOT is_cycle`,
    [rootId],
  );
  return rows.map((r) => r.id);
}

/**
 * Ciclo detectado num walk de árvore. Dois usos: (1) `assertNoCycleAfterMove`
 * — reverificação pós-`UPDATE` que encontra um ciclo instalado por uma
 * corrida entre movimentos concorrentes (design.md D3); lançar dentro de
 * `withTenantTransaction` já dispara o `ROLLBACK` (`pg-database-port.ts`), e
 * o chamador (`routes/folders.ts`) traduz para `409 folder_cycle`, o mesmo
 * código da recusa da camada 1. (2) `buildBreadcrumb` — guarda defensiva
 * contra uma linha de dado inconsistente por qualquer via; ali ninguém
 * captura o tipo especificamente, e a exceção vira `500` genérico pelo
 * tratador de erro da rota — "erro tratado" em vez de laço infinito, não uma
 * recusa de negócio.
 */
export class FolderCycleError extends Error {
  constructor() {
    super('folder hierarchy cycle detected');
    this.name = 'FolderCycleError';
  }
}

/**
 * Ciclo, camada 1 — antes do `UPDATE` (design.md D3): recusa se o destino é
 * a própria pasta ou pertence à sua subárvore, reusando
 * `collectSubtreeFolderIds` (a mesma travessia que já embasa a cascata de
 * exclusão). `destinationId` nulo é sempre a raiz da unidade — nunca ciclo.
 */
export async function wouldCreateCycle(
  client: PoolClient,
  folderId: string,
  destinationId: string | null,
): Promise<boolean> {
  if (destinationId === null) return false;
  if (destinationId === folderId) return true;
  const subtreeIds = await collectSubtreeFolderIds(client, folderId);
  return subtreeIds.includes(destinationId);
}

const MAX_FOLDER_DEPTH = 1000;

/**
 * Ciclo, camada 2 — depois do `UPDATE` e antes do commit, na mesma
 * transação (design.md D3): sobe a cadeia de `parent_id` a partir da pasta
 * movida, com conjunto de visitados e teto de profundidade. Fecha a corrida
 * que a camada 1 não vê — duas transações concorrentes que cada uma
 * verificou "meu destino não está na minha subárvore" antes de qualquer
 * `UPDATE` commitar, mas que juntas instalam um ciclo (A→B e B→A). Não
 * filtra por `deleted_at`: o interesse aqui é a forma do grafo de
 * `parent_id`, não se as pastas estão vivas.
 */
export async function assertNoCycleAfterMove(
  client: PoolClient,
  movedFolderId: string,
): Promise<void> {
  const visited = new Set<string>([movedFolderId]);
  let currentId: string = movedFolderId;
  for (let depth = 0; depth < MAX_FOLDER_DEPTH; depth++) {
    const { rows } = await client.query<{ parent_id: string | null }>(
      'SELECT parent_id FROM folders WHERE id = $1',
      [currentId],
    );
    const parentId = rows[0]?.parent_id ?? null;
    if (parentId === null) return;
    if (visited.has(parentId)) throw new FolderCycleError();
    visited.add(parentId);
    currentId = parentId;
  }
  throw new FolderCycleError();
}

/**
 * Colisão de nome (design.md D4/D5): já existe outra pasta **viva** de mesmo
 * nome (insensível a maiúsculas) sob o mesmo pai, na mesma unidade. Dá erro
 * legível (`409 folder_name_conflict`) antes de deixar o `23505` cru do
 * índice único escapar — o índice continua sendo a garantia real sob
 * concorrência; esta verificação só melhora a mensagem no caminho comum.
 * `excludeFolderId` evita que a própria pasta (ao renomear sem mudar de pai,
 * por exemplo) colida consigo mesma.
 */
export async function hasFolderNameConflict(
  client: PoolClient,
  unitId: string,
  parentId: string | null,
  name: string,
  excludeFolderId: string,
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM folders
     WHERE unit_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND lower(name) = lower($3)
       AND deleted_at IS NULL AND id != $4`,
    [unitId, parentId, name, excludeFolderId],
  );
  return rows.length > 0;
}

interface SubtreeFileRow {
  id: string;
  unit_id: string;
  owner_id: string;
  object_path: string;
  file_name: string;
  size_bytes: string | null;
  allowed: boolean;
}

/**
 * Uma pasta em profundidade da travessia (design.md D2): subpastas SHALL vir
 * já filtradas por `view` (mesmo fragmento de `listContents`,
 * `routes/folders.ts`) e arquivos SHALL vir com a coluna `allowed` calculada
 * em SQL a partir do mesmo fragmento de acesso, agora para o verbo
 * `download` — sem round-trip extra por item.
 */
async function listSubtreeLevel(
  client: PoolClient,
  ctx: TenantContext,
  folderId: string | null,
): Promise<{ folders: FolderRow[]; files: SubtreeFileRow[] }> {
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
  const { rows: files } = await client.query<SubtreeFileRow>(
    `SELECT id, unit_id, owner_id, object_path, file_name, size_bytes,
       (${resourceScopeClause(GrantResourceType.FILE, ownerPlaceholder, ctx, Permission.DOWNLOAD)}) AS allowed
     FROM files WHERE deleted_at IS NULL AND ${folderClause} ORDER BY file_name`,
    params,
  );

  return { folders, files };
}

export interface SubtreeManifestEntry {
  fileId: string;
  unitId: string;
  objectPath: string;
  fileName: string;
  sizeBytes: number;
  relativePath: string;
}

export interface SubtreeManifest {
  entries: SubtreeManifestEntry[];
  /** Arquivos vivos na subárvore **visível** ao solicitante (design.md D3) — não conta o
   * que está dentro de subpastas podadas por falta de `view` (design.md D2), para não
   * vazar a existência de conteúdo que o solicitante não pode nem abrir. */
  totalFiles: number;
}

/**
 * Percorre a subárvore **viva** (`deleted_at IS NULL`) a partir de
 * `rootFolderId` (`null` = raiz da unidade), produzindo o caminho relativo de
 * cada arquivo permitido (inverso de `normalizeRelativePath`, design.md D7).
 * A checagem de `view` sobre a própria pasta pedida é responsabilidade do
 * chamador — esta função só decide sobre a descendência (design.md D2):
 * subpasta sem `view` é podada com toda a sua descendência (task 2.2), e
 * pastas cujo conteúdo foi integralmente filtrado nunca geram entrada própria
 * — só arquivos viram entrada (task 2.3).
 */
export async function traverseFolderSubtree(
  client: PoolClient,
  ctx: TenantContext,
  rootFolderId: string | null,
): Promise<SubtreeManifest> {
  const entries: SubtreeManifestEntry[] = [];
  let totalFiles = 0;

  async function walk(folderId: string | null, pathSegments: string[]): Promise<void> {
    const { folders, files } = await listSubtreeLevel(client, ctx, folderId);

    totalFiles += files.length;
    for (const file of files) {
      if (!file.allowed) continue;
      entries.push({
        fileId: file.id,
        unitId: file.unit_id,
        objectPath: file.object_path,
        fileName: file.file_name,
        sizeBytes: Number(file.size_bytes ?? '0'),
        relativePath: [...pathSegments, file.file_name].join('/'),
      });
    }

    for (const folder of folders) {
      await walk(folder.id, [...pathSegments, folder.name]);
    }
  }

  await walk(rootFolderId, []);
  return { entries, totalFiles };
}
