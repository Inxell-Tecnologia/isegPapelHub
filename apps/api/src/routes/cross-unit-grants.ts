import { Router } from 'express';
import { CROSS_UNIT_PERMISSIONS, GrantResourceType, UserRole } from '@gdoc/shared';
import type {
  CreateCrossUnitGrantRequest,
  CrossUnitDestinationListResponse,
  CrossUnitDestinationNotAllowedResponse,
  CrossUnitGrantListResponse,
  CrossUnitGrantResponse,
  CrossUnitPermission,
  CrossUnitRecipientListResponse,
  GrantSubjectsLimitExceededResponse,
} from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { resourceTable } from '../lib/access.js';
import {
  allActiveInUnit,
  listDestinations,
  listRecipients,
  namesInUnit,
} from '../lib/cross-unit-share.js';
import { config } from '../config.js';

/**
 * `routes/cross-unit-grants.ts` — gestão do compartilhamento entre unidades
 * (PRD US 5.2, change `compartilhamento-entre-unidades`, design.md D7/D8).
 *
 * Sob o prefixo `/grants`, que já existe nas três listas de prefixos (API,
 * proxy de dev, url-map) — nenhum prefixo de topo novo. Só administração
 * (`unit_admin`/`global_admin`), e sempre sobre recurso **da unidade do
 * contexto**, comparado explicitamente: a trava do bypass do `global_admin`
 * vale aqui como em toda rota de conteúdo — cada administrador compartilha o
 * que já alcança como administrador.
 */

interface CrossUnitGrantRow {
  id: string;
  unit_id: string;
  resource_type: string;
  resource_id: string;
  subject_unit_id: string;
  subject_user_id: string | null;
  permission: string;
  granted_by: string;
  created_at: string;
  expires_at: string | null;
  expired: boolean;
}

const EXPIRED_COLUMN = `(expires_at IS NOT NULL AND expires_at <= now()) AS expired`;
const RESOURCE_TYPES: string[] = Object.values(GrantResourceType);
const PERMISSIONS: readonly string[] = CROSS_UNIT_PERMISSIONS;

function isAdmin(ctx: TenantContext): boolean {
  return ctx.role === UserRole.GLOBAL_ADMIN || ctx.role === UserRole.UNIT_ADMIN;
}

/** Recurso vivo da unidade do contexto — comparação explícita, não só RLS. */
async function ownLiveResource(
  ports: Ports,
  ctx: TenantContext,
  resourceType: GrantResourceType,
  resourceId: string,
): Promise<boolean> {
  return ports.database.withTenantTransaction(ctx, async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM ${resourceTable(resourceType)}
       WHERE id = $1 AND unit_id = $2 AND deleted_at IS NULL`,
      [resourceId, ctx.unitId],
    );
    return rows.length > 0;
  });
}

async function toResponses(
  ports: Ports,
  ctx: TenantContext,
  rows: CrossUnitGrantRow[],
): Promise<CrossUnitGrantResponse[]> {
  // Nomes do destino lidos em visita a cada unidade de destino (design.md
  // D7): a RLS de `users`/`units` daqui não os mostraria.
  const byUnit = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = byUnit.get(row.subject_unit_id) ?? new Set<string>();
    if (row.subject_user_id) set.add(row.subject_user_id);
    byUnit.set(row.subject_unit_id, set);
  }
  const names = new Map<string, Awaited<ReturnType<typeof namesInUnit>>>();
  for (const [unitId, userIds] of byUnit) {
    names.set(unitId, await namesInUnit(ports, ctx, unitId, [...userIds]));
  }

  return rows.map((row) => {
    const unit = names.get(row.subject_unit_id);
    return {
      id: row.id,
      unitId: row.unit_id,
      resourceType: row.resource_type as GrantResourceType,
      resourceId: row.resource_id,
      subjectUnitId: row.subject_unit_id,
      subjectUnitName: unit?.unitName ?? null,
      subjectUserId: row.subject_user_id,
      subjectUserName: row.subject_user_id ? (unit?.users.get(row.subject_user_id) ?? null) : null,
      permission: row.permission as CrossUnitPermission,
      grantedBy: row.granted_by,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      expired: row.expired,
    };
  });
}

export function crossUnitGrantsRouter(ports: Ports): Router {
  const router = Router();

  /** Destinos permitidos para a unidade do contexto (design.md D8). */
  router.get('/grants/cross-unit/destinations', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const response: CrossUnitDestinationListResponse = await listDestinations(ports, ctx);
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  /** Pessoas ativas de um destino permitido — exposição mínima (design.md D8). */
  router.get('/grants/cross-unit/recipients', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const unitId = req.query.unitId;
      if (typeof unitId !== 'string' || !unitId) {
        res.status(400).json({ error: 'invalid query' });
        return;
      }
      const { destinations } = await listDestinations(ports, ctx);
      if (!destinations.some((destination) => destination.id === unitId)) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const response: CrossUnitRecipientListResponse = {
        recipients: await listRecipients(ports, ctx, unitId),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.post('/grants/cross-unit', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      // Passo 1 (design.md D7): só administração.
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Passo 4: forma do corpo, verbos só de leitura, prazo futuro.
      const body = req.body as CreateCrossUnitGrantRequest;
      const subjectUserIds = Array.from(new Set(body.subjectUserIds ?? []));
      if (
        !RESOURCE_TYPES.includes(body.resourceType) ||
        typeof body.resourceId !== 'string' ||
        !body.resourceId ||
        typeof body.subjectUnitId !== 'string' ||
        !body.subjectUnitId ||
        !Array.isArray(body.permissions) ||
        body.permissions.length === 0 ||
        !body.permissions.every((permission) => PERMISSIONS.includes(permission)) ||
        !subjectUserIds.every((id) => typeof id === 'string' && id.length > 0)
      ) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }
      let expiresAt: Date | null = null;
      if (body.expiresAt !== undefined && body.expiresAt !== null) {
        const parsed = new Date(body.expiresAt);
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
          res.status(400).json({ error: 'invalid request body' });
          return;
        }
        expiresAt = parsed;
      }

      // Passo 2: recurso vivo da própria unidade.
      if (!(await ownLiveResource(ports, ctx, body.resourceType, body.resourceId))) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      // Passo 3: destino permitido (outra unidade, ativa, com a SEDE numa das
      // pontas) — a mesma lista que a SPA oferece.
      const { destinations } = await listDestinations(ports, ctx);
      if (!destinations.some((destination) => destination.id === body.subjectUnitId)) {
        const notAllowed: CrossUnitDestinationNotAllowedResponse = {
          error: 'cross_unit_destination_not_allowed',
        };
        res.status(422).json(notAllowed);
        return;
      }

      // Passo 6: teto de destinatários (o mesmo da concessão comum).
      if (subjectUserIds.length > config.grants.maxSubjects) {
        const limit: GrantSubjectsLimitExceededResponse = {
          error: 'grant_subjects_limit_exceeded',
          found: subjectUserIds.length,
          allowed: config.grants.maxSubjects,
        };
        res.status(413).json(limit);
        return;
      }

      // Passo 5: pessoas ativas e do destino — tudo ou nada, sem apontar qual.
      if (
        subjectUserIds.length > 0 &&
        !(await allActiveInUnit(ports, ctx, body.subjectUnitId, subjectUserIds))
      ) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      // Passo 7: produto destinatários × verbos; sem pessoas = unidade
      // inteira (uma linha por verbo com `subject_user_id` nulo). Mesma
      // semântica de reconcessão de `POST /grants`.
      const subjects: (string | null)[] = subjectUserIds.length > 0 ? subjectUserIds : [null];
      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<CrossUnitGrantRow>(
          `INSERT INTO cross_unit_grants
             (unit_id, resource_type, resource_id, subject_unit_id, subject_user_id, permission, granted_by, expires_at)
           SELECT $1, $2, $3, $4, s.subject, p.permission, $5, $6
             FROM unnest($7::uuid[]) AS s(subject)
            CROSS JOIN unnest($8::text[]) AS p(permission)
           ON CONFLICT (unit_id, resource_type, resource_id, subject_unit_id, subject_user_id, permission)
           DO UPDATE SET expires_at = EXCLUDED.expires_at, granted_by = EXCLUDED.granted_by, created_at = now()
           RETURNING *, ${EXPIRED_COLUMN}`,
          [
            ctx.unitId,
            body.resourceType,
            body.resourceId,
            body.subjectUnitId,
            ctx.userId,
            expiresAt,
            subjects,
            body.permissions,
          ],
        );
        return rows;
      });

      const response: CrossUnitGrantListResponse = { grants: await toResponses(ports, ctx, rows) };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  /** Compartilhamentos de um recurso — só o administrador da origem (design.md D7). */
  router.get('/grants/cross-unit', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const resourceType = req.query.resourceType;
      const resourceId = req.query.resourceId;
      if (
        typeof resourceType !== 'string' ||
        !RESOURCE_TYPES.includes(resourceType) ||
        typeof resourceId !== 'string' ||
        !resourceId
      ) {
        res.status(400).json({ error: 'invalid query' });
        return;
      }
      // Só a origem lista: para o destino (ou recurso inexistente), 404 sem
      // distinguir os casos.
      if (!(await ownLiveResource(ports, ctx, resourceType as GrantResourceType, resourceId))) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<CrossUnitGrantRow>(
          `SELECT *, ${EXPIRED_COLUMN} FROM cross_unit_grants
           WHERE resource_type = $1 AND resource_id = $2 AND unit_id = $3
           ORDER BY created_at`,
          [resourceType, resourceId, ctx.unitId],
        );
        return rows;
      });
      const response: CrossUnitGrantListResponse = { grants: await toResponses(ports, ctx, rows) };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  /** Revogação — só a origem; o destino recebe 404 (design.md D7). */
  router.delete('/grants/cross-unit/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const deleted = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query(
          'DELETE FROM cross_unit_grants WHERE id = $1 AND unit_id = $2 RETURNING id',
          [req.params.id, ctx.unitId],
        );
        return rows[0] ?? null;
      });
      if (!deleted) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
