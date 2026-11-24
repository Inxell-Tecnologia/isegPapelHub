import { Router } from 'express';
import type { Ports } from '../ports/index.js';
import type { AuditQueryEventResponse, AuditQueryResponse } from '@gdoc/shared';
import { canReadAudit } from '../lib/access.js';

interface AuditEventRow {
  action: 'view' | 'download';
  created_at: string;
  id: string;
  full_name: string | null;
  email: string | null;
  actor_unit_name: string | null;
}

/**
 * Teto superior fixo (design.md D6): protege contra históricos gigantes sem
 * introduzir contrato de cursor/paginação — fica para quando o volume exigir.
 */
const AUDIT_QUERY_LIMIT = 500;

function toAuditQueryEventResponse(row: AuditEventRow): AuditQueryEventResponse {
  return {
    // `unitName` só nos eventos vindos de outra unidade — o contrato dos
    // demais permanece exatamente o de antes.
    actor: {
      id: row.id,
      name: row.full_name,
      email: row.email,
      ...(row.actor_unit_name ? { unitName: row.actor_unit_name } : {}),
    },
    action: row.action,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * `GET /files/:id/audit` — consulta (lado de leitura) do registro de acesso
 * de um arquivo (design.md D1, Épico 7). Autorização é `canReadAudit`
 * (dono OU admin da unidade, sem grant — design.md D2), fail-closed sem
 * distinguir inexistente/outra-unidade/não-dono (design.md D4).
 */
export function auditRouter(ports: Ports): Router {
  const router = Router();

  router.get('/files/:id/audit', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const fileId = req.params.id;

      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const allowed = await canReadAudit(client, ctx, fileId);
        if (!allowed) return null;

        const { rows } = await client.query<AuditEventRow>(
          // `LEFT JOIN` + retrato (change `compartilhamento-entre-unidades`,
          // design.md D9): quem acessou vindo de outra unidade é invisível à
          // RLS de `users` daqui — com `JOIN` interno o evento sumiria. O
          // retrato (`actor_name`/`actor_unit_name`) só existe nesses eventos,
          // e neles o e-mail nunca é exposto, mesmo ao `global_admin` (cujo
          // bypass enxergaria a linha da pessoa).
          `SELECT ae.action, ae.created_at, ae.user_id AS id,
                  COALESCE(ae.actor_name, u.full_name) AS full_name,
                  CASE WHEN ae.actor_unit_name IS NULL THEN u.email END AS email,
                  ae.actor_unit_name
           FROM audit_events ae
           LEFT JOIN users u ON u.id = ae.user_id
           WHERE ae.file_id = $1 AND ae.action IN ('view', 'download')
           ORDER BY ae.created_at DESC
           LIMIT ${AUDIT_QUERY_LIMIT}`,
          [fileId],
        );
        return rows;
      });

      if (!rows) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const response: AuditQueryResponse = { events: rows.map(toAuditQueryEventResponse) };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
