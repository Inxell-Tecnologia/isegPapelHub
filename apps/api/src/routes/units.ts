import { Router } from 'express';
import { UserRole, UnitStatus } from '@gdoc/shared';
import type { CreateUnitRequest, UpdateUnitRequest, UnitResponse } from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';

interface UnitRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
  is_headquarters: boolean;
}

const UNIT_COLUMNS = 'id, name, status, created_at, is_headquarters';

function toUnitResponse(row: UnitRow): UnitResponse {
  return {
    id: row.id,
    name: row.name,
    status: row.status as UnitStatus,
    createdAt: new Date(row.created_at).toISOString(),
    isHeadquarters: row.is_headquarters,
  };
}

/** Violação do índice de SEDE única (change `compartilhamento-entre-unidades`, design.md D11). */
function isHeadquartersViolation(err: unknown): boolean {
  return (err as { constraint?: string } | null)?.constraint === 'units_single_headquarters_uidx';
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '23505';
}

/**
 * `routes/units.ts` — gestão de unidades pela administração global (change
 * `gestao-de-unidades`, US 1.1/5.1). Só `global_admin` gerencia unidades
 * (design.md D1): unidade é um conceito cross-tenant e um `unit_admin`
 * pertence a exatamente uma. Todas as rotas rodam em `withTenantTransaction`;
 * a policy RLS de `units` já libera o ramo `global_admin` (0002_enable_rls.sql,
 * design.md D4), então nenhum SQL especial é necessário. Isso não reabre a
 * trava de bypass de conteúdo/auditoria: lista de unidades é metadado
 * administrativo (nome/status), não bytes tenant.
 */
export function unitsRouter(ports: Ports): Router {
  const router = Router();

  function requireGlobalAdmin(ctx: TenantContext, res: import('express').Response): boolean {
    if (ctx.role !== UserRole.GLOBAL_ADMIN) {
      res.status(403).json({ error: 'forbidden' });
      return false;
    }
    return true;
  }

  router.post('/units', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!requireGlobalAdmin(ctx, res)) return;

      const body = req.body as CreateUnitRequest;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      let row: UnitRow;
      try {
        row = await ports.database.withTenantTransaction(ctx, async (client) => {
          const { rows } = await client.query<UnitRow>(
            `INSERT INTO units (name) VALUES ($1) RETURNING ${UNIT_COLUMNS}`,
            [name],
          );
          return rows[0]!;
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'name already in use' });
          return;
        }
        throw err;
      }

      res.status(201).json(toUnitResponse(row));
    } catch (err) {
      next(err);
    }
  });

  // `GET /units` (design.md D4/D7): lista para uso administrativo, inclusive
  // o seletor de unidade no cadastro de pessoas. `?status=active` filtra só as
  // ativas, para não alocar pessoa em unidade desativada.
  router.get('/units', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!requireGlobalAdmin(ctx, res)) return;

      const statusFilter = req.query.status;
      const onlyActive = statusFilter === UnitStatus.ACTIVE;

      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = onlyActive
          ? await client.query<UnitRow>(
              `SELECT ${UNIT_COLUMNS} FROM units WHERE status = $1 ORDER BY name`,
              [UnitStatus.ACTIVE],
            )
          : await client.query<UnitRow>(`SELECT ${UNIT_COLUMNS} FROM units ORDER BY name`);
        return rows;
      });

      res.json(rows.map(toUnitResponse));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/units/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!requireGlobalAdmin(ctx, res)) return;

      const body = req.body as UpdateUnitRequest;
      const wantsRename = body.name !== undefined;
      const wantsStatus = body.status !== undefined;
      const wantsHeadquarters = body.isHeadquarters !== undefined;

      if (!wantsRename && !wantsStatus && !wantsHeadquarters) {
        res.status(400).json({ error: 'no fields to update' });
        return;
      }

      const name = wantsRename ? String(body.name).trim() : undefined;
      if (wantsRename && !name) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }
      if (wantsStatus && body.status !== UnitStatus.ACTIVE && body.status !== UnitStatus.DISABLED) {
        res.status(400).json({ error: 'invalid status' });
        return;
      }
      if (wantsHeadquarters && typeof body.isHeadquarters !== 'boolean') {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const unitId = req.params.id;
      const deactivating = body.status === UnitStatus.DISABLED;

      // A transação devolve um resultado discriminado (em vez de mutar
      // variáveis externas) para o controle de fluxo ser type-safe. As
      // precondições de desativação (design.md D2/D3) rodam na mesma transação
      // da escrita, evitando TOCTOU. Reativar (status=active) é sempre
      // permitido, então essas guardas só valem ao desativar.
      type PatchOutcome =
        | { kind: 'ok'; row: UnitRow }
        | { kind: 'name_conflict' }
        | { kind: 'unit_not_empty' }
        | { kind: 'cannot_deactivate' }
        | { kind: 'headquarters_already_set' }
        | { kind: 'headquarters_cannot_be_disabled' }
        | { kind: 'not_found' };

      const outcome = await ports.database.withTenantTransaction<PatchOutcome>(
        ctx,
        async (client) => {
          // SEDE (change `compartilhamento-entre-unidades`, design.md D11):
          // no máximo uma, e a marcada não é desativada — os compartilhamentos
          // entre unidades dependem dela. A troca é deliberada em dois passos
          // (desmarcar, marcar): muda o alcance de todos os compartilhamentos.
          const { rows: hqRows } = await client.query<{ id: string }>(
            'SELECT id FROM units WHERE is_headquarters',
          );
          const currentHq = hqRows[0]?.id;
          if (body.isHeadquarters === true && currentHq && currentHq !== unitId) {
            return { kind: 'headquarters_already_set' };
          }
          const staysHeadquarters =
            body.isHeadquarters === true ||
            (body.isHeadquarters === undefined && currentHq === unitId);
          if (deactivating && staysHeadquarters) {
            return { kind: 'headquarters_cannot_be_disabled' };
          }

          if (deactivating) {
            // D3 (defesa em profundidade): recusa a própria unidade do contexto
            // e a unidade de bootstrap (a mais antiga — o bootstrap cria a
            // primeira unidade). Redundante com D2 no caminho feliz, mas fecha o
            // caso de borda de uma unidade que fique vazia por acidente.
            const { rows: bootstrapRows } = await client.query<{ id: string }>(
              'SELECT id FROM units ORDER BY created_at ASC, id ASC LIMIT 1',
            );
            const bootstrapUnitId = bootstrapRows[0]?.id;
            if (unitId === ctx.unitId || unitId === bootstrapUnitId) {
              return { kind: 'cannot_deactivate' };
            }

            // D2: só desativa unidade vazia (zero pessoas vinculadas).
            const { rows: countRows } = await client.query<{ count: string }>(
              'SELECT count(*)::text FROM users WHERE unit_id = $1',
              [unitId],
            );
            if (Number(countRows[0]?.count ?? '0') > 0) {
              return { kind: 'unit_not_empty' };
            }
          }

          const setClauses: string[] = [];
          const values: unknown[] = [];
          if (name !== undefined) {
            values.push(name);
            setClauses.push(`name = $${values.length}`);
          }
          if (wantsStatus) {
            values.push(body.status);
            setClauses.push(`status = $${values.length}`);
          }
          if (wantsHeadquarters) {
            values.push(body.isHeadquarters);
            setClauses.push(`is_headquarters = $${values.length}`);
          }
          values.push(unitId);

          try {
            const { rows } = await client.query<UnitRow>(
              `UPDATE units SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING ${UNIT_COLUMNS}`,
              values,
            );
            const updated = rows[0];
            return updated ? { kind: 'ok', row: updated } : { kind: 'not_found' };
          } catch (err) {
            if (isHeadquartersViolation(err)) return { kind: 'headquarters_already_set' };
            if (isUniqueViolation(err)) return { kind: 'name_conflict' };
            throw err;
          }
        },
      );

      switch (outcome.kind) {
        case 'name_conflict':
          res.status(409).json({ error: 'name already in use' });
          return;
        case 'unit_not_empty':
          res.status(409).json({ error: 'unit not empty' });
          return;
        case 'cannot_deactivate':
          res.status(409).json({ error: 'cannot deactivate own or bootstrap unit' });
          return;
        case 'headquarters_already_set':
          res.status(409).json({ error: 'headquarters_already_set' });
          return;
        case 'headquarters_cannot_be_disabled':
          res.status(409).json({ error: 'headquarters_cannot_be_disabled' });
          return;
        case 'not_found':
          // RLS escondeu a linha (não deveria para global_admin) ou id inexistente.
          res.status(404).json({ error: 'unit not found' });
          return;
        case 'ok':
          res.json(toUnitResponse(outcome.row));
          return;
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
