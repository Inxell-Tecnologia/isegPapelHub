import { Router } from 'express';
import { GrantResourceType, NotificationKind, Permission, UserRole } from '@gdoc/shared';
import type {
  CreateGrantRequest,
  GrantListResponse,
  GrantResponse,
  GrantSubjectsLimitExceededResponse,
} from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { resourceTable } from '../lib/access.js';
import { config } from '../config.js';

interface GrantRow {
  id: string;
  unit_id: string;
  subject_user_id: string;
  resource_type: string;
  resource_id: string;
  permission: string;
  granted_by: string;
  created_at: string;
  expires_at: string | null;
  expired: boolean;
}

function toGrantResponse(row: GrantRow): GrantResponse {
  return {
    id: row.id,
    unitId: row.unit_id,
    subjectUserId: row.subject_user_id,
    resourceType: row.resource_type as GrantResourceType,
    resourceId: row.resource_id,
    permission: row.permission as Permission,
    grantedBy: row.granted_by,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    expired: row.expired,
  };
}

function isAdmin(ctx: TenantContext): boolean {
  return ctx.role === UserRole.GLOBAL_ADMIN || ctx.role === UserRole.UNIT_ADMIN;
}

const RESOURCE_TYPES: string[] = Object.values(GrantResourceType);
const PERMISSIONS: string[] = Object.values(Permission);

/** Coluna computada de vigência, mesmo predicado de `lib/access.ts` D1 — `now()` do banco. */
const EXPIRED_COLUMN = `(expires_at IS NOT NULL AND expires_at <= now()) AS expired`;

/**
 * `source_ref` do aviso de concessão (design.md D5): ancorado em **(recurso,
 * vencimento)**, nunca no id do grant nem no instante da execução. Uma
 * requisição com vários verbos sobre o mesmo recurso e prazo produz o mesmo
 * `source_ref`, logo uma única notificação (design.md D5/D8); mudar o prazo
 * muda o `source_ref`, logo notifica de novo.
 */
function grantSourceRef(
  resourceType: GrantResourceType,
  resourceId: string,
  expiresAt: Date,
): string {
  return `grant:${resourceType}:${resourceId}:${expiresAt.toISOString()}`;
}

/**
 * `routes/grants.ts` — conceder/listar/revogar permissão granular por
 * pessoa (US 4.1), restrito à administração (design.md D5). Mesma dupla
 * camada de `routes/users.ts`: a checagem de papel aqui barra o
 * `collaborator` de plano, e a RLS (`withTenantTransaction`) garante que
 * `unit_admin` nunca opere fora da própria unidade mesmo se a checagem de
 * aplicação falhasse.
 */
export function grantsRouter(ports: Ports): Router {
  const router = Router();

  router.post('/grants', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const body = req.body as CreateGrantRequest;
      if (
        !Array.isArray(body.subjectUserIds) ||
        body.subjectUserIds.length === 0 ||
        !body.subjectUserIds.every((id) => typeof id === 'string' && id.length > 0) ||
        !RESOURCE_TYPES.includes(body.resourceType) ||
        !body.resourceId ||
        !Array.isArray(body.permissions) ||
        body.permissions.length === 0 ||
        !body.permissions.every((permission) => PERMISSIONS.includes(permission))
      ) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      // Prazo opcional (design.md D1, tasks.md 4.1): ausente/nulo = permanente.
      // Quando informado, precisa ser uma data futura — validação de entrada,
      // distinta do relógio do banco usado depois na resolução de acesso.
      let expiresAt: Date | null = null;
      if (body.expiresAt !== undefined && body.expiresAt !== null) {
        const parsed = new Date(body.expiresAt);
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
          res.status(400).json({ error: 'invalid request body' });
          return;
        }
        expiresAt = parsed;
      }

      // Dedup preservando ordem de chegada (design.md D2/D3): o `CROSS JOIN`
      // sobre `unnest` recusaria a mesma linha duas vezes no mesmo comando, e
      // o teto de D4 precisa contar destinatários **distintos**.
      const subjectUserIds = Array.from(new Set(body.subjectUserIds));

      if (subjectUserIds.length > config.grants.maxSubjects) {
        const limitResponse: GrantSubjectsLimitExceededResponse = {
          error: 'grant_subjects_limit_exceeded',
          found: subjectUserIds.length,
          allowed: config.grants.maxSubjects,
        };
        res.status(413).json(limitResponse);
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        // RLS já restringe a leitura à unidade do admin (ou bypass de
        // global_admin) — recurso ou colaborador de outra unidade simplesmente
        // não aparecem aqui, sem distinguir "não existe" de "é de outra
        // unidade" (design.md D5: "sem vazar existência").
        const { rows: resourceRows } = await client.query<{ unit_id: string }>(
          `SELECT unit_id FROM ${resourceTable(body.resourceType)} WHERE id = $1`,
          [body.resourceId],
        );
        const resource = resourceRows[0];
        if (!resource) return { status: 404 as const };

        // Existência de todos os sujeitos numa única consulta (design.md D3):
        // a cardinalidade do resultado comparada com o conjunto deduplicado
        // decide tudo-ou-nada, sem apontar qual id falhou — recusa parcial
        // transformaria a rota num oráculo de existência de contas.
        const { rows: subjectRows } = await client.query<{ id: string }>(
          'SELECT id FROM users WHERE id = ANY($1)',
          [subjectUserIds],
        );
        if (subjectRows.length !== subjectUserIds.length) return { status: 404 as const };

        // Produto colaboradores × verbos num único INSERT ... SELECT sobre
        // unnest (design.md D2) — uma ida ao banco em vez de N×M, com a
        // mesma semântica de reconcessão de sempre (prazo informado
        // prevalece; sem prazo, torna permanente).
        const { rows } = await client.query<GrantRow>(
          `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
           SELECT $1, s.subject, $2, $3, p.permission, $4, $5
             FROM unnest($6::uuid[]) AS s(subject)
            CROSS JOIN unnest($7::text[]) AS p(permission)
           ON CONFLICT (unit_id, subject_user_id, resource_type, resource_id, permission)
           DO UPDATE SET expires_at = EXCLUDED.expires_at, granted_by = EXCLUDED.granted_by, created_at = now()
           RETURNING *, ${EXPIRED_COLUMN}`,
          [
            resource.unit_id,
            body.resourceType,
            body.resourceId,
            ctx.userId,
            expiresAt,
            subjectUserIds,
            body.permissions,
          ],
        );
        return { status: 201 as const, rows };
      });

      if (outcome.status !== 201) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      // Aviso de concessão (design.md D5): só quando a operação envolve
      // prazo, emitido **após** o commit acima, fora da transação — um aviso
      // por destinatário, cada um em seu próprio try/catch, para que a falha
      // de um não afete os demais nem a concessão já efetivada. A fórmula do
      // `sourceRef` não muda: a idempotência do NotificationPort já é por
      // (destinatário, tipo, sourceRef), logo já é por destinatário.
      if (expiresAt) {
        const unitId = outcome.rows[0]!.unit_id;
        const sourceRef = grantSourceRef(body.resourceType, body.resourceId, expiresAt);
        for (const subjectUserId of subjectUserIds) {
          try {
            await ports.notifications.notify({
              unitId,
              recipientUserId: subjectUserId,
              kind: NotificationKind.GRANT_CREATED,
              payload: {
                resourceType: body.resourceType,
                resourceId: body.resourceId,
                permissions: body.permissions,
                expiresAt: expiresAt.toISOString(),
              },
              sourceRef,
            });
          } catch (err) {
            console.error('grants: falha ao emitir aviso grant_created', err);
          }
        }
      }

      const response: GrantListResponse = { grants: outcome.rows.map(toGrantResponse) };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  router.get('/grants', async (req, res, next) => {
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

      // Nenhum filtro de unidade aqui: a RLS já restringe unit_admin à
      // própria unidade e dá bypass a global_admin (mesmo padrão de
      // routes/users.ts). Expiradas permanecem na resposta, marcadas
      // (design.md D2) — sem ocultar, distinguindo pelo campo `expired`.
      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<GrantRow>(
          `SELECT *, ${EXPIRED_COLUMN} FROM grants WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at`,
          [resourceType, resourceId],
        );
        return rows;
      });

      const response: GrantListResponse = { grants: rows.map(toGrantResponse) };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/grants/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // RLS filtra a linha visível para DELETE antes do WHERE por id rodar:
      // grant de outra unidade não aparece, 0 linhas removidas. Revogar
      // permanece removendo a linha mesmo se já expirada (design.md D2).
      const deleted = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query('DELETE FROM grants WHERE id = $1 RETURNING id', [
          req.params.id,
        ]);
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
