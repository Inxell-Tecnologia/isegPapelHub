import type { PoolClient } from 'pg';
import { READING_DEFAULT_DUE_DAYS, UserRole } from '@gdoc/shared';
import type { ReadingAudience } from '@gdoc/shared';
import type { TenantContext } from '../ports/database-port.js';

/**
 * Regras puras e fragmentos SQL da leitura obrigatória (change
 * `leitura-obrigatoria`).
 *
 * O público é **critério**, não lista (design.md D2): `{ wholeUnit, sectorIds,
 * roles, userIds }`, combinados por "ou", sempre sobre as pessoas **ativas** da
 * unidade da campanha. Uma única expressão SQL serve à prévia, à marcação e à
 * reconciliação de quem entra depois — três cópias divergiriam.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: readonly string[] = Object.values(UserRole);

/**
 * Pessoa `u` casa com o público `aud` (jsonb) da unidade `unitExpr`. Pessoa
 * desativada nunca casa (demanda 3.3: desligamento sai do cálculo).
 */
export function audienceMatchClause(unitExpr: string, audExpr: string): string {
  return `u.unit_id = ${unitExpr}
    AND u.status = 'active'
    AND (
      COALESCE((${audExpr}->>'wholeUnit')::boolean, false)
      OR u.sector_id::text IN (SELECT jsonb_array_elements_text(${audExpr}->'sectorIds'))
      OR u.role IN (SELECT jsonb_array_elements_text(${audExpr}->'roles'))
      OR u.id::text IN (SELECT jsonb_array_elements_text(${audExpr}->'userIds'))
    )`;
}

/**
 * Situação derivada na consulta (design.md D3), pelo relógio do Postgres.
 * `a` = atribuição, `c` = campanha, `f` = arquivo (LEFT JOIN — pode ser nulo).
 */
export const READING_STATUS_SQL = `CASE
    WHEN a.acknowledged_at IS NOT NULL THEN 'done'
    WHEN f.id IS NULL
      OR f.deleted_at IS NOT NULL
      OR f.lifecycle_state = 'obsolete'
      OR f.document_revision IS DISTINCT FROM c.document_revision THEN 'closed'
    WHEN current_date > a.due_date THEN 'late'
    ELSE 'pending'
  END`;

/** Normaliza o público recebido; `null` = malformado. */
export function parseAudience(raw: unknown): ReadingAudience | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const arr = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : null);
  const sectorIds = arr(r.sectorIds);
  const roles = arr(r.roles);
  const userIds = arr(r.userIds);
  if (!sectorIds || !roles || !userIds) return null;
  if (r.wholeUnit !== undefined && typeof r.wholeUnit !== 'boolean') return null;
  if (!sectorIds.every((s) => typeof s === 'string' && UUID.test(s))) return null;
  if (!userIds.every((s) => typeof s === 'string' && UUID.test(s))) return null;
  if (!roles.every((s) => typeof s === 'string' && ROLES.includes(s))) return null;
  return {
    wholeUnit: r.wholeUnit === true,
    sectorIds: [...new Set(sectorIds as string[])],
    roles: [...new Set(roles as UserRole[])],
    userIds: [...new Set(userIds as string[])],
  };
}

export function isEmptyAudience(a: ReadingAudience): boolean {
  return !a.wholeUnit && a.sectorIds.length === 0 && a.roles.length === 0 && a.userIds.length === 0;
}

/**
 * Setores e pessoas citados pertencem à unidade? Inexistente e de outra
 * unidade resolvem igual — `false`, fail-closed (spec "Público não atravessa
 * unidades"). Pessoa desativada também não é aceita nominalmente.
 */
export async function audienceBelongsToUnit(
  client: PoolClient,
  unitId: string,
  audience: ReadingAudience,
): Promise<boolean> {
  if (audience.sectorIds.length > 0) {
    const { rows } = await client.query<{ n: string }>(
      'SELECT count(*) AS n FROM sectors WHERE unit_id = $1 AND id = ANY($2::uuid[])',
      [unitId, audience.sectorIds],
    );
    if (Number(rows[0]!.n) !== audience.sectorIds.length) return false;
  }
  if (audience.userIds.length > 0) {
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM users WHERE unit_id = $1 AND status = 'active' AND id = ANY($2::uuid[])`,
      [unitId, audience.userIds],
    );
    if (Number(rows[0]!.n) !== audience.userIds.length) return false;
  }
  return true;
}

/** Quantas pessoas o público alcança hoje — a prévia antes de confirmar. */
export async function countAudience(
  client: PoolClient,
  unitId: string,
  audience: ReadingAudience,
): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*) AS n FROM users u WHERE ${audienceMatchClause('$1::uuid', '$2::jsonb')}`,
    [unitId, JSON.stringify(audience)],
  );
  return Number(rows[0]!.n);
}

/**
 * Cria as atribuições do público **da marcação**, com o prazo dela. Devolve as
 * criadas, que a rota avisa (`avisos-e-atrasos`, design.md D2).
 */
export async function materializeCampaign(
  client: PoolClient,
  campaignId: string,
): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO reading_assignments (unit_id, campaign_id, user_id, due_date)
     SELECT c.unit_id, c.id, u.id, c.due_date
     FROM reading_campaigns c
     JOIN users u ON ${audienceMatchClause('c.unit_id', 'c.audience')}
     WHERE c.id = $1
     ON CONFLICT (campaign_id, user_id) DO NOTHING
     RETURNING id`,
    [campaignId],
  );
  return rows.map((r) => r.id);
}

/**
 * Atribuições que faltam para quem casa **hoje** com o público de uma marcação
 * em curso — revisão vigente de documento em circulação (demanda 3.3; design.md
 * D2 de `leitura-obrigatoria`). Prazo de 15 dias a partir de agora. Uma
 * expressão só para a consulta da pessoa e para a rotina diária
 * (`avisos-e-atrasos`, design.md D4); `filtro` recorta por pessoa e unidade.
 */
function reconcileSql(filtro: string): string {
  return `INSERT INTO reading_assignments (unit_id, campaign_id, user_id, due_date)
     SELECT c.unit_id, c.id, u.id, current_date + $1::int
     FROM reading_campaigns c
     JOIN files f ON f.id = c.file_id
       AND f.deleted_at IS NULL
       AND f.lifecycle_state IS DISTINCT FROM 'obsolete'
       AND f.document_revision = c.document_revision
     JOIN users u ON ${audienceMatchClause('c.unit_id', 'c.audience')}
     WHERE ${filtro}
     ON CONFLICT (campaign_id, user_id) DO NOTHING
     RETURNING id`;
}

/**
 * Pendência de quem entrou no público **depois** da marcação, na consulta às
 * próprias leituras. Idempotente. Devolve as atribuições **criadas agora** —
 * quem chama as avisa (`avisos-e-atrasos`, design.md D2).
 */
export async function reconcileForUser(client: PoolClient, ctx: TenantContext): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    reconcileSql('u.id = $2 AND c.unit_id = $3'),
    [READING_DEFAULT_DUE_DAYS, ctx.userId, ctx.unitId],
  );
  return rows.map((r) => r.id);
}

/**
 * A mesma reconciliação para **todas** as marcações em curso, de todas as
 * unidades — só a rotina diária a chama, com o contexto de sistema
 * (`jobs/notify-readings.ts`). Cada atribuição herda a unidade da marcação.
 */
export async function reconcileAll(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(reconcileSql('TRUE'), [
    READING_DEFAULT_DUE_DAYS,
  ]);
  return rows.map((r) => r.id);
}
