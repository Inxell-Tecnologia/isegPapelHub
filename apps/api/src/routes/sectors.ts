import { Router } from 'express';
import { UserRole } from '@gdoc/shared';
import type { CreateSectorRequest, UpdateSectorRequest, SectorResponse } from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';

interface SectorRow {
  id: string;
  unit_id: string;
  name: string;
  created_at: string;
  people_count: string;
}

const SECTOR_SELECT = `SELECT s.id, s.unit_id, s.name, s.created_at,
         (SELECT count(*) FROM users u WHERE u.sector_id = s.id)::text AS people_count
    FROM sectors s`;

function toSectorResponse(row: SectorRow): SectorResponse {
  return {
    id: row.id,
    unitId: row.unit_id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    peopleCount: Number(row.people_count ?? '0'),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '23505';
}

/**
 * `routes/sectors.ts` — manutenção da lista de setores de uma unidade (change
 * `funcao-e-setor-na-identidade`, capability `setores`).
 *
 * **Alcance:** só administração. `unit_admin` mantém a **própria** unidade;
 * `global_admin` mantém qualquer uma — a resposta 2b do cliente coloca a
 * Governança enxergando todas as unidades, e setor é **metadado
 * administrativo** (nome), no mesmo plano de `GET /units`, não conteúdo
 * tenant. Isso **não** reabre a trava de bypass de conteúdo/auditoria: aqui
 * não transitam bytes, itens de pasta nem evento de auditoria.
 *
 * **A unidade vem do contexto, não do cliente** (design.md D8). `?unitId=` e
 * `unitId` no corpo são honrados apenas para `global_admin`; para
 * `unit_admin`, pedir outra unidade é recusado em vez de silenciosamente
 * forçado — é o que a capability exige ("recusada fail-closed, sem revelar o
 * que existe na outra unidade"). Um endereço como `/units/:unitId/sectors`
 * faria a unidade nascer no cliente, convidando a forjá-la.
 *
 * Setor de outra unidade em `PATCH`/`DELETE` não é caso especial: a RLS o
 * esconde, a linha não é encontrada, e a resposta é a mesma de um setor
 * inexistente.
 */
export function sectorsRouter(ports: Ports): Router {
  const router = Router();

  function requireAdmin(ctx: TenantContext, res: import('express').Response): boolean {
    if (ctx.role !== UserRole.GLOBAL_ADMIN && ctx.role !== UserRole.UNIT_ADMIN) {
      res.status(403).json({ error: 'forbidden' });
      return false;
    }
    return true;
  }

  /**
   * Unidade alvo da operação. `null` ⇒ recusar: um `unit_admin` pediu unidade
   * que não é a sua.
   */
  function resolveUnitId(ctx: TenantContext, requested: unknown): string | null {
    if (typeof requested !== 'string' || requested === '') return ctx.unitId;
    if (ctx.role === UserRole.GLOBAL_ADMIN) return requested;
    return requested === ctx.unitId ? ctx.unitId : null;
  }

  router.get('/sectors', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!requireAdmin(ctx, res)) return;

      const unitId = resolveUnitId(ctx, req.query.unitId);
      if (unitId === null) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<SectorRow>(
          `${SECTOR_SELECT} WHERE s.unit_id = $1 ORDER BY s.name`,
          [unitId],
        );
        return rows;
      });

      res.json(rows.map(toSectorResponse));
    } catch (err) {
      next(err);
    }
  });

  router.post('/sectors', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!requireAdmin(ctx, res)) return;

      const body = req.body as CreateSectorRequest;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const unitId = resolveUnitId(ctx, body.unitId);
      if (unitId === null) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      let row: SectorRow;
      try {
        row = await ports.database.withTenantTransaction(ctx, async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO sectors (unit_id, name) VALUES ($1, $2) RETURNING id`,
            [unitId, name],
          );
          const { rows: full } = await client.query<SectorRow>(`${SECTOR_SELECT} WHERE s.id = $1`, [
            rows[0]!.id,
          ]);
          return full[0]!;
        });
      } catch (err) {
        // Unicidade por (unit_id, lower(btrim(name))) — a colisão é de grafia,
        // não de texto exato (0020_sectors.sql).
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'sector_name_in_use' });
          return;
        }
        throw err;
      }

      res.status(201).json(toSectorResponse(row));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/sectors/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!requireAdmin(ctx, res)) return;

      const body = req.body as UpdateSectorRequest;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      type PatchOutcome = { kind: 'ok'; row: SectorRow } | { kind: 'not_found' };

      let outcome: PatchOutcome;
      try {
        outcome = await ports.database.withTenantTransaction<PatchOutcome>(ctx, async (client) => {
          const { rows } = await client.query<{ id: string }>(
            'UPDATE sectors SET name = $1 WHERE id = $2 RETURNING id',
            [name, req.params.id],
          );
          if (!rows[0]) return { kind: 'not_found' };
          const { rows: full } = await client.query<SectorRow>(`${SECTOR_SELECT} WHERE s.id = $1`, [
            rows[0].id,
          ]);
          return { kind: 'ok', row: full[0]! };
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'sector_name_in_use' });
          return;
        }
        throw err;
      }

      if (outcome.kind === 'not_found') {
        res.status(404).json({ error: 'not found' });
        return;
      }

      // Renomear preserva os vínculos por construção: o id não muda, e é por
      // ele que as pessoas apontam. É isso que faz a padronização da grafia
      // (resposta 6a) ser segura.
      res.json(toSectorResponse(outcome.row));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/sectors/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!requireAdmin(ctx, res)) return;

      type DeleteOutcome =
        { kind: 'ok' } | { kind: 'has_people'; peopleCount: number } | { kind: 'not_found' };

      const outcome = await ports.database.withTenantTransaction<DeleteOutcome>(
        ctx,
        async (client) => {
          // A contagem roda na **mesma** transação da remoção, evitando TOCTOU
          // entre "conferi que estava vazio" e "removi". A FK composta de
          // `users` é a rede embaixo: mesmo que esta checagem falhasse, o banco
          // recusaria a remoção — nenhuma pessoa é desvinculada em silêncio.
          const { rows: countRows } = await client.query<{ count: string }>(
            'SELECT count(*)::text FROM users WHERE sector_id = $1',
            [req.params.id],
          );
          const peopleCount = Number(countRows[0]?.count ?? '0');

          const { rows: found } = await client.query<{ id: string }>(
            'SELECT id FROM sectors WHERE id = $1',
            [req.params.id],
          );
          if (!found[0]) return { kind: 'not_found' };

          if (peopleCount > 0) return { kind: 'has_people', peopleCount };

          await client.query('DELETE FROM sectors WHERE id = $1', [req.params.id]);
          return { kind: 'ok' };
        },
      );

      if (outcome.kind === 'not_found') {
        res.status(404).json({ error: 'not found' });
        return;
      }
      if (outcome.kind === 'has_people') {
        res.status(409).json({ error: 'sector_has_people', peopleCount: outcome.peopleCount });
        return;
      }

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
