import type { PoolClient } from 'pg';
import { DocumentLifecycleState, GrantResourceType, UnitStatus, UserRole } from '@gdoc/shared';
import type {
  CrossUnitDestinationResponse,
  CrossUnitPermission,
  CrossUnitRecipientResponse,
  FileAccessAction,
} from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { SharedVisit, TenantContext } from '../ports/database-port.js';
import type { FolderRow } from './folder-tree.js';
import {
  FILE_DERIVED_COLUMNS,
  visitFileSummaryColumns,
  type FileSummaryRow,
} from './document-control.js';

/**
 * Compartilhamento entre unidades (PRD US 5.2, change
 * `compartilhamento-entre-unidades`).
 *
 * Este módulo é o **único** que abre a transação de visita
 * (`DatabasePort.withSharedVisitTransaction`, design.md D3) — um teste de
 * arquitetura garante. Concentrar aqui a visita é o que mantém auditável a
 * única via pela qual uma pessoa lê linhas de outra unidade:
 *
 * 1. a transação **própria** da pessoa lê os compartilhamentos vigentes
 *    endereçados a ela ou à unidade dela — daí, e só daí, sai a unidade de
 *    origem candidata (nunca de valor informado pelo solicitante);
 * 2. a visita, com a RLS confinada à origem e papel sem bypass
 *    (`shared_visitor`, somente leitura por policy restritiva), **reconfirma**
 *    o compartilhamento dentro de si e aplica as subtrações antes de qualquer
 *    uso — verificação e uso na mesma transação, sem janela entre os dois.
 *
 * É o **segundo caminho** de acesso: as rotas tentam `hasAccess` primeiro e
 * só chegam aqui quando ele nega (design.md D4). `hasAccess` nunca é chamada
 * dentro da visita — quem visita não é dona, admin nem tem grant.
 */

/**
 * Subtrações sobre arquivo na visita (design.md D4, passo a): lixeira,
 * obsoleto, pendente de cadastro e arquivo sem bytes vigentes. Vencem a
 * concessão, como em `hasAccess`.
 */
const VISIT_FILE_FILTER = `deleted_at IS NULL
  AND lifecycle_state IS DISTINCT FROM '${DocumentLifecycleState.OBSOLETE}'
  AND awaiting_registration IS NOT TRUE
  AND status IN ('active', 'replacing')`;

const VISIT_FOLDER_FILTER = 'deleted_at IS NULL';

/** Teto de profundidade da subida de ancestrais — mesma guarda da trilha comum. */
const MAX_DEPTH = 1000;

/** Condição de vigência — relógio **do banco** (`now()`), como em `lib/access.ts`. */
const VIGENTE = '(expires_at IS NULL OR expires_at > now())';

export interface VisitFileRow extends FileSummaryRow {
  unit_id: string;
  object_path: string;
}

/** Identidade de quem visita, lida na transação própria (retrato da auditoria, design.md D9). */
interface ActorSnapshot {
  name: string | null;
  unitName: string | null;
}

/** O que o callback da rota recebe, já dentro da visita confirmada. */
export interface SharedVisitScope {
  client: PoolClient;
  originUnitId: string;
  originUnitName: string;
  /** Mesmo teste de cobertura, para outro verbo, na mesma transação. */
  covers(permission: CrossUnitPermission): Promise<boolean>;
  /** Grava o evento de auditoria na origem, com o retrato de quem acessou. */
  recordAudit(fileId: string, action: FileAccessAction): Promise<void>;
}

/**
 * Unidades de origem com compartilhamento vigente do verbo endereçado a
 * `ctx` (design.md D4, passo 1). `subject_unit_id = ctx.unitId` é comparado
 * explicitamente, e não deixado à RLS: para o `global_admin` o bypass é
 * incondicional (CLAUDE.md, "Trava do bypass"). `ctx.unitId` é relido do
 * banco a cada requisição, de modo que a pessoa transferida de unidade deixa
 * de casar com a concessão pessoal antiga.
 */
async function listOrigins(
  client: PoolClient,
  ctx: TenantContext,
  permission: CrossUnitPermission,
): Promise<string[]> {
  const { rows } = await client.query<{ unit_id: string }>(
    `SELECT DISTINCT unit_id FROM cross_unit_grants
     WHERE subject_unit_id = $1
       AND (subject_user_id IS NULL OR subject_user_id = $2)
       AND permission = $3
       AND ${VIGENTE}`,
    [ctx.unitId, ctx.userId, permission],
  );
  return rows.map((row) => row.unit_id);
}

async function readActorSnapshot(client: PoolClient, ctx: TenantContext): Promise<ActorSnapshot> {
  const { rows } = await client.query<{ full_name: string | null; unit_name: string | null }>(
    `SELECT u.full_name, un.name AS unit_name
     FROM users u LEFT JOIN units un ON un.id = u.unit_id
     WHERE u.id = $1`,
    [ctx.userId],
  );
  return { name: rows[0]?.full_name ?? null, unitName: rows[0]?.unit_name ?? null };
}

/**
 * Regra da SEDE e origem ativa (design.md D4, passo 2.b), avaliada **na
 * resolução** e não só na criação: desmarcar a SEDE ou desativar a origem
 * adormece o compartilhamento sem apagá-lo. Na visita, a linha da origem é
 * visível pela `unit_isolation` e a da SEDE pela `headquarters_visible`.
 */
async function pairStillValid(
  client: PoolClient,
  originUnitId: string,
  destinationUnitId: string,
): Promise<{ ok: false } | { ok: true; originUnitName: string }> {
  const { rows } = await client.query<{
    id: string;
    name: string;
    status: string;
    is_headquarters: boolean;
  }>('SELECT id, name, status, is_headquarters FROM units WHERE id = ANY($1::uuid[])', [
    [originUnitId, destinationUnitId],
  ]);
  const origin = rows.find((row) => row.id === originUnitId);
  if (!origin || origin.status !== UnitStatus.ACTIVE) return { ok: false };
  if (!rows.some((row) => row.is_headquarters)) return { ok: false };
  return { ok: true, originUnitName: origin.name };
}

/**
 * Cadeia de pastas **vivas** da pasta `startFolderId` para cima, com a
 * profundidade (0 = a própria). Uma pasta na lixeira interrompe a subida:
 * o que está abaixo dela não é alcançado por compartilhamento feito acima.
 */
async function liveAncestorChain(
  client: PoolClient,
  startFolderId: string | null,
): Promise<{ id: string; depth: number }[]> {
  if (!startFolderId) return [];
  const { rows } = await client.query<{ id: string; depth: number }>(
    `WITH RECURSIVE anc (id, parent_id, depth) AS (
       SELECT id, parent_id, 0 FROM folders WHERE id = $1 AND ${VISIT_FOLDER_FILTER}
       UNION ALL
       SELECT f.id, f.parent_id, a.depth + 1
       FROM anc a JOIN folders f ON f.id = a.parent_id
       WHERE f.${VISIT_FOLDER_FILTER} AND a.depth < ${MAX_DEPTH}
     )
     SELECT id, depth FROM anc ORDER BY depth`,
    [startFolderId],
  );
  return rows;
}

/**
 * Ids das pastas da cadeia que são raiz de compartilhamento vigente do verbo
 * para a pessoa (ou a unidade dela), e se o próprio arquivo é raiz — a
 * cobertura por subárvore de design.md D5, avaliada na consulta.
 */
async function coveringRoots(
  client: PoolClient,
  visit: SharedVisit,
  destinationUnitId: string,
  permission: CrossUnitPermission,
  fileId: string | null,
  chainIds: string[],
): Promise<{ fileRoot: boolean; folderRoots: Set<string> }> {
  const { rows } = await client.query<{ resource_type: string; resource_id: string }>(
    `SELECT resource_type, resource_id FROM cross_unit_grants
     WHERE unit_id = $1
       AND subject_unit_id = $2
       AND (subject_user_id IS NULL OR subject_user_id = $3)
       AND permission = $4
       AND ${VIGENTE}
       AND ((resource_type = 'file' AND resource_id = $5::uuid)
         OR (resource_type = 'folder' AND resource_id = ANY($6::uuid[])))`,
    [visit.originUnitId, destinationUnitId, visit.userId, permission, fileId, chainIds],
  );
  return {
    fileRoot: rows.some((row) => row.resource_type === GrantResourceType.FILE),
    folderRoots: new Set(
      rows
        .filter((row) => row.resource_type === GrantResourceType.FOLDER)
        .map((row) => row.resource_id),
    ),
  };
}

type VisitResource =
  | { type: typeof GrantResourceType.FILE; row: VisitFileRow; startFolderId: string | null }
  | { type: typeof GrantResourceType.FOLDER; row: FolderRow; startFolderId: string };

async function loadVisitResource(
  client: PoolClient,
  resourceType: GrantResourceType,
  resourceId: string,
): Promise<VisitResource | null> {
  if (resourceType === GrantResourceType.FILE) {
    const { rows } = await client.query<VisitFileRow>(
      `SELECT *, ${FILE_DERIVED_COLUMNS} FROM files WHERE id = $1 AND ${VISIT_FILE_FILTER}`,
      [resourceId],
    );
    const row = rows[0];
    return row ? { type: GrantResourceType.FILE, row, startFolderId: row.folder_id } : null;
  }
  const { rows } = await client.query<FolderRow>(
    `SELECT * FROM folders WHERE id = $1 AND ${VISIT_FOLDER_FILTER}`,
    [resourceId],
  );
  const row = rows[0];
  return row ? { type: GrantResourceType.FOLDER, row, startFolderId: row.id } : null;
}

async function isCovered(
  client: PoolClient,
  visit: SharedVisit,
  destinationUnitId: string,
  resource: VisitResource,
  permission: CrossUnitPermission,
): Promise<boolean> {
  const chain = await liveAncestorChain(client, resource.startFolderId);
  // Arquivo cuja pasta (ou um ancestral) está na lixeira: a cadeia viva para
  // antes — mas o arquivo na raiz (`folder_id` nulo) tem cadeia vazia de
  // propósito, e só o compartilhamento do próprio arquivo o cobre.
  const roots = await coveringRoots(
    client,
    visit,
    destinationUnitId,
    permission,
    resource.type === GrantResourceType.FILE ? resource.row.id : null,
    chain.map((link) => link.id),
  );
  if (resource.type === GrantResourceType.FILE && roots.fileRoot) return true;
  return roots.folderRoots.size > 0;
}

/**
 * Resolve o acesso por compartilhamento entre unidades e, se concedido,
 * executa `fn` **dentro** da transação de visita (design.md D4, passos 1–3).
 * Devolve `null` quando nenhuma origem serve — a rota responde então
 * exatamente como responderia sem este caminho (fail-closed, sem distinguir
 * "não existe", "é de outra unidade" e "fora do compartilhamento").
 */
export async function withSharedResource<T>(
  ports: Ports,
  ctx: TenantContext,
  resourceType: GrantResourceType,
  resourceId: string,
  permission: CrossUnitPermission,
  fn: (scope: SharedVisitScope, resource: VisitResource) => Promise<T>,
): Promise<{ value: T } | null> {
  const own = await ports.database.withTenantTransaction(ctx, async (client) => {
    const origins = await listOrigins(client, ctx, permission);
    // Conteúdo da própria unidade nunca passa por aqui — é o caminho comum.
    const foreign = origins.filter((origin) => origin !== ctx.unitId);
    if (foreign.length === 0) return null;
    return { origins: foreign, actor: await readActorSnapshot(client, ctx) };
  });
  if (!own) return null;

  for (const originUnitId of own.origins) {
    const visit: SharedVisit = { userId: ctx.userId, originUnitId };
    const outcome = await ports.database.withSharedVisitTransaction(visit, async (client) => {
      const resource = await loadVisitResource(client, resourceType, resourceId);
      if (!resource) return null;
      const pair = await pairStillValid(client, originUnitId, ctx.unitId);
      if (!pair.ok) return null;
      if (!(await isCovered(client, visit, ctx.unitId, resource, permission))) return null;

      const scope: SharedVisitScope = {
        client,
        originUnitId,
        originUnitName: pair.originUnitName,
        covers: (other) => isCovered(client, visit, ctx.unitId, resource, other),
        recordAudit: async (fileId, action) => {
          await client.query(
            `INSERT INTO audit_events (unit_id, user_id, file_id, action, actor_name, actor_unit_name)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [originUnitId, ctx.userId, fileId, action, own.actor.name, own.actor.unitName],
          );
        },
      };
      return { value: await fn(scope, resource) };
    });
    if (outcome) return outcome;
  }
  return null;
}

/** Subpasta listada em visita, com a contagem da subárvore já filtrada. */
export type VisitFolderRow = FolderRow & { document_count: number };

/**
 * Conteúdo de uma pasta em visita (design.md D6): todos os filhos diretos
 * estão cobertos pela subárvore do compartilhamento, menos as subtrações.
 * Deve ser chamado de dentro de `withSharedResource` (recebe o `scope`).
 */
export async function listVisitContents(
  scope: SharedVisitScope,
  folderId: string,
): Promise<{ folders: VisitFolderRow[]; files: VisitFileRow[] }> {
  const { client } = scope;
  const { rows: folders } = await client.query<FolderRow>(
    `SELECT * FROM folders WHERE parent_id = $1 AND ${VISIT_FOLDER_FILTER} ORDER BY name`,
    [folderId],
  );
  const { rows: files } = await client.query<VisitFileRow>(
    `SELECT ${visitFileSummaryColumns()}, unit_id, object_path
     FROM files WHERE folder_id = $1 AND ${VISIT_FILE_FILTER} ORDER BY file_name`,
    [folderId],
  );

  const counts = new Map<string, number>();
  if (folders.length > 0) {
    const { rows } = await client.query<{ folder_id: string; n: number }>(
      `WITH RECURSIVE alcance (raiz_id, pasta_id) AS (
         SELECT id, id FROM folders WHERE id = ANY($1::uuid[])
         UNION
         SELECT a.raiz_id, f.id
         FROM alcance a JOIN folders f ON f.parent_id = a.pasta_id
         WHERE f.${VISIT_FOLDER_FILTER}
       )
       SELECT a.raiz_id AS folder_id, count(*)::int AS n
       FROM alcance a
       JOIN (SELECT folder_id FROM files WHERE ${VISIT_FILE_FILTER}) v ON v.folder_id = a.pasta_id
       GROUP BY a.raiz_id`,
      [folders.map((folder) => folder.id)],
    );
    for (const row of rows) counts.set(row.folder_id, row.n);
  }

  return {
    folders: folders.map((folder) => ({ ...folder, document_count: counts.get(folder.id) ?? 0 })),
    files,
  };
}

/**
 * Trilha em visita (design.md D6): só as pastas da cadeia que estão
 * cobertas — da raiz compartilhada **mais alta** até a pasta-mãe da
 * corrente. Nenhum ancestral acima da raiz é nomeado.
 */
export async function buildVisitBreadcrumb(
  scope: SharedVisitScope,
  ctx: TenantContext,
  folder: FolderRow,
): Promise<FolderRow[]> {
  const { client } = scope;
  const chain = await liveAncestorChain(client, folder.id);
  const roots = await coveringRoots(
    client,
    { userId: ctx.userId, originUnitId: scope.originUnitId },
    ctx.unitId,
    'view',
    null,
    chain.map((link) => link.id),
  );
  const outermost = chain.filter((link) => roots.folderRoots.has(link.id)).pop();
  if (!outermost) return [];
  const ids = chain
    .filter((link) => link.depth > 0 && link.depth <= outermost.depth)
    .map((l) => l.id);
  if (ids.length === 0) return [];
  const { rows } = await client.query<FolderRow>(
    'SELECT * FROM folders WHERE id = ANY($1::uuid[])',
    [ids],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  // Da raiz para a pasta-mãe: profundidade decrescente.
  return ids
    .slice()
    .reverse()
    .map((id) => byId.get(id))
    .filter((row): row is FolderRow => row !== undefined);
}

// ---------------------------------------------------------------------------
// Compartilhados comigo (design.md D12)

export interface CrossUnitReceivedItem {
  resourceType: GrantResourceType;
  resourceId: string;
  originUnitId: string;
  originUnitName: string;
  permissions: { permission: CrossUnitPermission; expiresAt: string | null }[];
  sharedAt: string;
  folder: FolderRow | null;
  file: (VisitFileRow & { folder_name: null }) | null;
}

/**
 * As **raízes** compartilhadas com a pessoa (ou a unidade dela) por outra
 * unidade, confirmadas na visita: o recurso vive, não está sob subtração, e
 * o par origem/destino ainda tem a SEDE. O conteúdo interno não vira item.
 */
export async function listCrossUnitReceived(
  ports: Ports,
  ctx: TenantContext,
): Promise<CrossUnitReceivedItem[]> {
  const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
    const { rows } = await client.query<{
      unit_id: string;
      resource_type: string;
      resource_id: string;
      permission: string;
      expires_at: string | null;
      created_at: string;
    }>(
      `SELECT unit_id, resource_type, resource_id, permission, expires_at, created_at
       FROM cross_unit_grants
       WHERE subject_unit_id = $1
         AND unit_id <> $1
         AND (subject_user_id IS NULL OR subject_user_id = $2)
         AND ${VIGENTE}`,
      [ctx.unitId, ctx.userId],
    );
    return rows;
  });
  if (rows.length === 0) return [];

  // Agrupamento por recurso: uma concessão à unidade e outra pessoal, com o
  // mesmo verbo, viram um verbo só (o de prazo mais longo prevalece).
  const byOrigin = new Map<string, Map<string, CrossUnitReceivedItem>>();
  for (const row of rows) {
    const items = byOrigin.get(row.unit_id) ?? new Map<string, CrossUnitReceivedItem>();
    byOrigin.set(row.unit_id, items);
    const key = `${row.resource_type}:${row.resource_id}`;
    const sharedAt = new Date(row.created_at).toISOString();
    const expiresAt = row.expires_at ? new Date(row.expires_at).toISOString() : null;
    const item =
      items.get(key) ??
      ({
        resourceType: row.resource_type as GrantResourceType,
        resourceId: row.resource_id,
        originUnitId: row.unit_id,
        originUnitName: '',
        permissions: [],
        sharedAt,
        folder: null,
        file: null,
      } satisfies CrossUnitReceivedItem);
    items.set(key, item);
    if (sharedAt > item.sharedAt) item.sharedAt = sharedAt;
    const permission = row.permission as CrossUnitPermission;
    const existing = item.permissions.find((p) => p.permission === permission);
    if (!existing) {
      item.permissions.push({ permission, expiresAt });
    } else if (
      existing.expiresAt !== null &&
      (expiresAt === null || expiresAt > existing.expiresAt)
    ) {
      existing.expiresAt = expiresAt;
    }
  }

  const result: CrossUnitReceivedItem[] = [];
  for (const [originUnitId, items] of byOrigin) {
    const visit: SharedVisit = { userId: ctx.userId, originUnitId };
    const confirmed = await ports.database.withSharedVisitTransaction(visit, async (client) => {
      const pair = await pairStillValid(client, originUnitId, ctx.unitId);
      if (!pair.ok) return [];
      const ok: CrossUnitReceivedItem[] = [];
      for (const item of items.values()) {
        const resource = await loadVisitResource(client, item.resourceType, item.resourceId);
        if (!resource) continue;
        item.originUnitName = pair.originUnitName;
        if (resource.type === GrantResourceType.FOLDER) {
          item.folder = resource.row;
        } else {
          const { rows: detail } = await client.query<VisitFileRow>(
            `SELECT ${visitFileSummaryColumns()}, unit_id, object_path FROM files WHERE id = $1`,
            [resource.row.id],
          );
          if (!detail[0]) continue;
          item.file = { ...detail[0], folder_name: null };
        }
        ok.push(item);
      }
      return ok;
    });
    result.push(...confirmed);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Gestão: destinos e destinatários (design.md D7/D8)

/**
 * Unidades para as quais a unidade de `ctx` pode compartilhar: se ela é a
 * SEDE, as demais unidades ativas; senão, só a SEDE (ativa). Nome de unidade
 * é metadado, não conteúdo: a leitura das demais unidades pela SEDE usa um
 * contexto de sistema que projeta só `id, name`, padrão `SYSTEM_CTX` dos jobs.
 */
export async function listDestinations(
  ports: Ports,
  ctx: TenantContext,
): Promise<{ headquartersDefined: boolean; destinations: CrossUnitDestinationResponse[] }> {
  const hq = await ports.database.withTenantTransaction(ctx, async (client) => {
    const { rows } = await client.query<{ id: string; name: string; status: string }>(
      'SELECT id, name, status FROM units WHERE is_headquarters',
    );
    return rows[0] ?? null;
  });
  if (!hq) return { headquartersDefined: false, destinations: [] };

  if (hq.id !== ctx.unitId) {
    const destinations =
      hq.status === UnitStatus.ACTIVE ? [{ id: hq.id, name: hq.name, isHeadquarters: true }] : [];
    return { headquartersDefined: true, destinations };
  }

  const systemCtx: TenantContext = {
    unitId: ctx.unitId,
    userId: ctx.userId,
    role: UserRole.GLOBAL_ADMIN,
  };
  const others = await ports.database.withTenantTransaction(systemCtx, async (client) => {
    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM units WHERE id <> $1 AND status = $2 ORDER BY name`,
      [ctx.unitId, UnitStatus.ACTIVE],
    );
    return rows;
  });
  return {
    headquartersDefined: true,
    destinations: others.map((unit) => ({ id: unit.id, name: unit.name, isHeadquarters: false })),
  };
}

/**
 * Pessoas ativas da unidade de destino — exposição mínima: nome, cargo e
 * setor (design.md D8). Leitura em visita à unidade de destino, que a RLS
 * confina a ela. Quem chama já validou que `destinationUnitId` é destino
 * permitido para a unidade de quem pede.
 */
export async function listRecipients(
  ports: Ports,
  ctx: TenantContext,
  destinationUnitId: string,
): Promise<CrossUnitRecipientResponse[]> {
  return ports.database.withSharedVisitTransaction(
    { userId: ctx.userId, originUnitId: destinationUnitId },
    async (client) => {
      const { rows } = await client.query<{
        id: string;
        full_name: string | null;
        job_title: string | null;
        sector_name: string | null;
      }>(
        `SELECT u.id, u.full_name, u.job_title, s.name AS sector_name
         FROM users u LEFT JOIN sectors s ON s.id = u.sector_id
         WHERE u.unit_id = $1 AND u.status = 'active'
         ORDER BY u.full_name NULLS LAST, u.id`,
        [destinationUnitId],
      );
      return rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        jobTitle: row.job_title,
        sectorName: row.sector_name,
      }));
    },
  );
}

/**
 * Confirma, tudo ou nada, que todas as pessoas são ativas e da unidade de
 * destino (design.md D7, passo 5) — sem apontar qual falhou.
 */
export async function allActiveInUnit(
  ports: Ports,
  ctx: TenantContext,
  destinationUnitId: string,
  userIds: string[],
): Promise<boolean> {
  return ports.database.withSharedVisitTransaction(
    { userId: ctx.userId, originUnitId: destinationUnitId },
    async (client) => {
      const { rows } = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM users
         WHERE id = ANY($1::uuid[]) AND unit_id = $2 AND status = 'active'`,
        [userIds, destinationUnitId],
      );
      return rows[0]?.n === userIds.length;
    },
  );
}

/** Nomes de pessoas de uma unidade de destino, para a listagem dos compartilhamentos. */
export async function namesInUnit(
  ports: Ports,
  ctx: TenantContext,
  unitId: string,
  userIds: string[],
): Promise<{ unitName: string | null; users: Map<string, string | null> }> {
  return ports.database.withSharedVisitTransaction(
    { userId: ctx.userId, originUnitId: unitId },
    async (client) => {
      const { rows: unit } = await client.query<{ name: string }>(
        'SELECT name FROM units WHERE id = $1',
        [unitId],
      );
      const users = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { rows } = await client.query<{ id: string; full_name: string | null }>(
          'SELECT id, full_name FROM users WHERE id = ANY($1::uuid[])',
          [userIds],
        );
        for (const row of rows) users.set(row.id, row.full_name);
      }
      return { unitName: unit[0]?.name ?? null, users };
    },
  );
}
