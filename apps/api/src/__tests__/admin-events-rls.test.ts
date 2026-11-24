import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import type { PgDatabasePort } from '../adapters/pg-database-port.js';
import { setupTestDatabase, seedTwoUnits, withSystemBypass } from './test-db.js';

/**
 * RLS de `admin_events` (change `edicao-email-pessoa`, design.md D3/D4):
 * isolamento por unidade como toda tabela com dado de unidade, e **só de
 * inclusão** imposto no banco — sem policy de UPDATE/DELETE, nem o
 * `global_admin` altera ou apaga registro. Roda contra o papel não-superuser
 * da app (superuser ignoraria a RLS e mascararia o furo).
 */
describe('RLS: admin_events', () => {
  let pool: Pool;
  let database: PgDatabasePort;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;

  const insert = `INSERT INTO admin_events (unit_id, actor_user_id, target_user_id, action, changes)
                  VALUES ($1, $2, $3, 'person_updated', '{"fullName":{"from":"a","to":"b"}}'::jsonb)`;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    database = setup.database;
    ids = await seedTwoUnits(pool);
    await withSystemBypass(pool, async (client) => {
      await client.query(insert, [ids.unitA, ids.globalAdmin, ids.userA]);
      await client.query(insert, [ids.unitB, ids.globalAdmin, ids.userB]);
    });
  });

  afterAll(async () => {
    await database.close();
    await pool.end();
  });

  it('unit_admin da unidade A só lê eventos da unidade A', async () => {
    const rows = await database.withTenantTransaction(
      { unitId: ids.unitA, userId: ids.userA, role: 'unit_admin' },
      (client) => client.query('SELECT unit_id FROM admin_events').then((r) => r.rows),
    );
    expect(rows.map((r) => r.unit_id)).toEqual([ids.unitA]);
  });

  it('unit_admin da unidade A não grava evento da unidade B', async () => {
    await expect(
      database.withTenantTransaction(
        { unitId: ids.unitA, userId: ids.userA, role: 'unit_admin' },
        (client) => client.query(insert, [ids.unitB, ids.userA, ids.userB]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('sem contexto de tenant nenhuma linha é visível (fail-closed)', async () => {
    const rows = await database.withTransaction((client) =>
      client.query('SELECT id FROM admin_events').then((r) => r.rows),
    );
    expect(rows).toEqual([]);
  });

  it('UPDATE e DELETE afetam 0 linhas, mesmo como global_admin (só de inclusão)', async () => {
    const counts = await database.withTenantTransaction(
      { unitId: ids.unitA, userId: ids.globalAdmin, role: 'global_admin' },
      async (client) => {
        const visiveis = await client.query('SELECT id FROM admin_events');
        const upd = await client.query(`UPDATE admin_events SET changes = '{}'::jsonb`);
        const del = await client.query('DELETE FROM admin_events');
        return { visiveis: visiveis.rowCount, upd: upd.rowCount, del: del.rowCount };
      },
    );
    expect(counts).toEqual({ visiveis: 2, upd: 0, del: 0 });

    const intactos = await withSystemBypass(pool, (client) =>
      client.query<{ changes: unknown }>('SELECT changes FROM admin_events').then((r) => r.rows),
    );
    expect(intactos).toHaveLength(2);
    for (const row of intactos) {
      expect(row.changes).toEqual({ fullName: { from: 'a', to: 'b' } });
    }
  });
});
