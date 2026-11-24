import type { PoolClient } from 'pg';
import { ReadingOversight, UserRole } from '@gdoc/shared';
import type {
  OversightCampaignResponse,
  OversightPersonResponse,
  ReadingStatus,
} from '@gdoc/shared';
import type { DatabasePort, TenantContext } from '../ports/database-port.js';
import { READING_STATUS_SQL } from './reading.js';

/**
 * Acompanhamento da leitura obrigatória (change `acompanhamento-de-leituras`,
 * demanda nº 2, seção 3.5): **quem vê o quê**.
 *
 * Este é o **único** lugar do sistema em que uma consulta de pessoa comum
 * atravessa unidades (design.md D3): quem tem acompanhamento de todas as
 * unidades (Governança, resposta 7a do cliente) vê a situação nominal de
 * leitura das outras. A exceção é estreita por construção:
 *
 * - só neste arquivo, e só depois de reler do banco que a pessoa está ativa e
 *   tem o alcance `all_units`;
 * - só `reading_campaigns`, `reading_assignments` e nome/setor/unidade de
 *   pessoas; de `files`, só as três colunas que decidem se a marcação está em
 *   curso, e **nada** de `files` vai à resposta;
 * - nenhuma URL assinada, listagem de pasta ou auditoria — e `lib/access.ts`
 *   continua sem ler `reading_oversight`, de modo que a mesma pessoa segue
 *   recusada em bytes e auditoria de outra unidade.
 *
 * Publicador e gestor rodam no próprio contexto: a RLS e o recorte limitam à
 * unidade duas vezes.
 */

// Contexto de sistema, o mesmo das rotinas (`jobs/notify-readings.ts`): só o
// ramo de todas as unidades o usa, e só para ler.
const SYSTEM_CTX: TenantContext = {
  unitId: '00000000-0000-0000-0000-000000000000',
  userId: '00000000-0000-0000-0000-000000000000',
  role: UserRole.GLOBAL_ADMIN,
};

/** Quem consulta, relido do banco a cada requisição (design.md D1). */
export interface Overseer {
  userId: string;
  unitId: string;
  sectorId: string | null;
  sectorName: string | null;
  oversight: ReadingOversight | null;
}

/**
 * Recorte único (design.md D1), sobre `a` (atribuição), `c` (marcação) e `u`
 * (pessoa **ativa**). Parâmetros: `$1` quem consulta, `$2` a unidade dele,
 * `$3` o setor dele, `$4` o alcance de acompanhamento.
 */
const VISIBLE_SQL = `(c.created_by = $1::uuid
    OR $4::text = '${ReadingOversight.ALL_UNITS}'
    OR ($4::text = '${ReadingOversight.UNIT}' AND c.unit_id = $2::uuid)
    OR ($4::text = '${ReadingOversight.SECTOR}' AND c.unit_id = $2::uuid AND u.sector_id = $3::uuid))`;

/** A marcação aparece com o público inteiro (`full`) ou só com o setor do gestor. */
const FULL_SCOPE_SQL = `(c.created_by = $1::uuid
    OR $4::text = '${ReadingOversight.ALL_UNITS}'
    OR ($4::text = '${ReadingOversight.UNIT}' AND c.unit_id = $2::uuid))`;

/**
 * Linhas visíveis, uma por atribuição, com a situação apurada agora. As colunas
 * são enumeradas: de `files` só sai `in_progress`, um booleano.
 */
function visibleRowsSql(extra: string): string {
  return `SELECT a.id AS assignment_id, c.id AS campaign_id, c.unit_id, un.name AS unit_name,
      c.document_code, c.document_title, c.document_revision,
      to_char(c.due_date, 'YYYY-MM-DD') AS campaign_due_date, c.created_at,
      (f.id IS NOT NULL AND f.deleted_at IS NULL
        AND f.lifecycle_state IS DISTINCT FROM 'obsolete'
        AND f.document_revision = c.document_revision) AS in_progress,
      ${FULL_SCOPE_SQL} AS full_scope,
      ${READING_STATUS_SQL} AS status,
      COALESCE(NULLIF(u.full_name, ''), u.email) AS person_name,
      CASE WHEN a.acknowledged_at IS NOT NULL THEN a.acknowledged_sector_name ELSE s.name END
        AS sector_name,
      to_char(a.due_date, 'YYYY-MM-DD') AS due_date,
      a.acknowledged_at
    FROM reading_assignments a
    JOIN reading_campaigns c ON c.id = a.campaign_id
    LEFT JOIN files f ON f.id = c.file_id
    JOIN users u ON u.id = a.user_id AND u.status = 'active'
    LEFT JOIN sectors s ON s.id = u.sector_id
    JOIN units un ON un.id = c.unit_id
    WHERE ${VISIBLE_SQL} ${extra}`;
}

interface CampaignRow {
  campaign_id: string;
  unit_id: string;
  unit_name: string;
  document_code: string;
  document_title: string;
  document_revision: number;
  campaign_due_date: string;
  created_at: string;
  in_progress: boolean;
  full_scope: boolean;
  total: string;
  done: string;
  pending: string;
  late: string;
  closed: string;
}

interface PersonRow {
  assignment_id: string;
  person_name: string;
  unit_name: string;
  sector_name: string | null;
  status: ReadingStatus;
  due_date: string;
  acknowledged_at: string | null;
}

/** Números de 3.5 por marcação (design.md D2), sobre as linhas visíveis. */
function campaignsSql(extra: string): string {
  return `SELECT campaign_id, unit_id, unit_name, document_code, document_title,
      document_revision, campaign_due_date, created_at, in_progress, full_scope,
      count(*) AS total,
      count(*) FILTER (WHERE status = 'done') AS done,
      count(*) FILTER (WHERE status = 'pending') AS pending,
      count(*) FILTER (WHERE status = 'late') AS late,
      count(*) FILTER (WHERE status = 'closed') AS closed
    FROM (${visibleRowsSql(extra)}) v
    GROUP BY campaign_id, unit_id, unit_name, document_code, document_title,
      document_revision, campaign_due_date, created_at, in_progress, full_scope
    ORDER BY in_progress DESC, created_at DESC`;
}

function params(o: Overseer): unknown[] {
  return [o.userId, o.unitId, o.sectorId, o.oversight];
}

function toCampaign(row: CampaignRow, o: Overseer): OversightCampaignResponse {
  const total = Number(row.total);
  const done = Number(row.done);
  return {
    id: row.campaign_id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    documentCode: row.document_code,
    documentTitle: row.document_title,
    documentRevision: Number(row.document_revision),
    dueDate: row.campaign_due_date,
    createdAt: new Date(row.created_at).toISOString(),
    inProgress: row.in_progress,
    scope: row.full_scope ? 'full' : 'sector',
    scopeSectorName: row.full_scope ? null : o.sectorName,
    total,
    done,
    pending: Number(row.pending),
    late: Number(row.late),
    closed: Number(row.closed),
    adherence: total === 0 ? null : Math.round((100 * done) / total),
  };
}

/** Relê de quem consulta o alcance e o setor (design.md D1). */
export async function readOverseer(client: PoolClient, ctx: TenantContext): Promise<Overseer> {
  const { rows } = await client.query<{
    reading_oversight: ReadingOversight | null;
    sector_id: string | null;
    sector_name: string | null;
  }>(
    `SELECT u.reading_oversight, u.sector_id, s.name AS sector_name
     FROM users u LEFT JOIN sectors s ON s.id = u.sector_id
     WHERE u.id = $1 AND u.unit_id = $2 AND u.status = 'active'`,
    [ctx.userId, ctx.unitId],
  );
  const r = rows[0];
  return {
    userId: ctx.userId,
    unitId: ctx.unitId,
    sectorId: r?.sector_id ?? null,
    sectorName: r?.sector_name ?? null,
    oversight: r?.reading_oversight ?? null,
  };
}

/**
 * Transação em que o recorte roda: a do próprio contexto, salvo para quem
 * acompanha todas as unidades — o único ramo com o contexto de sistema
 * (design.md D3).
 */
async function inScope<T>(
  database: DatabasePort,
  ctx: TenantContext,
  o: Overseer,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const alvo = o.oversight === ReadingOversight.ALL_UNITS ? SYSTEM_CTX : ctx;
  return database.withTenantTransaction(alvo, fn);
}

/** `GET /reading/oversight` (design.md D4). */
export async function listOversight(
  database: DatabasePort,
  ctx: TenantContext,
): Promise<{ available: boolean; campaigns: OversightCampaignResponse[] }> {
  const { o, marcou } = await database.withTenantTransaction(ctx, async (client) => {
    const o = await readOverseer(client, ctx);
    const { rows } = await client.query(
      'SELECT 1 FROM reading_campaigns WHERE created_by = $1 AND unit_id = $2 LIMIT 1',
      [ctx.userId, ctx.unitId],
    );
    return { o, marcou: rows.length > 0 };
  });
  const available = o.oversight !== null || marcou;
  if (!available) return { available, campaigns: [] };
  const rows = await inScope(database, ctx, o, async (client) => {
    const { rows } = await client.query<CampaignRow>(campaignsSql(''), params(o));
    return rows;
  });
  return { available, campaigns: rows.map((r) => toCampaign(r, o)) };
}

/**
 * `GET /reading/oversight/campaigns/:id` (design.md D4). `null` = fora do
 * recorte, de outra unidade sem a exceção, ou inexistente — indistinguíveis.
 */
export async function readOversightReport(
  database: DatabasePort,
  ctx: TenantContext,
  campaignId: string,
): Promise<{ campaign: OversightCampaignResponse; people: OversightPersonResponse[] } | null> {
  const o = await database.withTenantTransaction(ctx, (client) => readOverseer(client, ctx));
  return inScope(database, ctx, o, async (client) => {
    const filtro = 'AND c.id = $5::uuid';
    const { rows } = await client.query<CampaignRow>(campaignsSql(filtro), [
      ...params(o),
      campaignId,
    ]);
    if (!rows[0]) return null;
    const { rows: pessoas } = await client.query<PersonRow>(
      `SELECT assignment_id, person_name, unit_name, sector_name, status, due_date, acknowledged_at
       FROM (${visibleRowsSql(filtro)}) v
       ORDER BY lower(unit_name), lower(person_name)`,
      [...params(o), campaignId],
    );
    return {
      campaign: toCampaign(rows[0], o),
      people: pessoas.map((p) => ({
        assignmentId: p.assignment_id,
        name: p.person_name,
        unitName: p.unit_name,
        sectorName: p.sector_name,
        status: p.status,
        dueDate: p.due_date,
        acknowledgedAt: p.acknowledged_at ? new Date(p.acknowledged_at).toISOString() : null,
      })),
    };
  });
}
