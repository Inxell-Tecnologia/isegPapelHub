import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import type { PgDatabasePort } from '../adapters/pg-database-port.js';
import { setupTestDatabase, seedTwoUnits, withSystemBypass } from './test-db.js';

describe('RLS: isolamento por unidade', () => {
  let pool: Pool;
  let database: PgDatabasePort;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let setorA: string;
  let setorB: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    database = setup.database;
    ids = await seedTwoUnits(pool);

    // um arquivo em cada unidade
    await withSystemBypass(pool, (client) =>
      client.query(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
         VALUES ($1, $2, 'unitA/f1', 'a.txt', 'active'), ($3, $4, 'unitB/f1', 'b.txt', 'active')`,
        [ids.unitA, ids.userA, ids.unitB, ids.userB],
      ),
    );

    // um setor em cada unidade, de mesmo nome (change
    // `funcao-e-setor-na-identidade`): setor é dado de unidade, e tabela nova
    // com dado de unidade sem policy RLS é furo de isolamento, não detalhe.
    const setores = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string; unit_id: string }>(
          `INSERT INTO sectors (unit_id, name) VALUES ($1, 'Governança'), ($2, 'Governança')
           RETURNING id, unit_id`,
          [ids.unitA, ids.unitB],
        )
        .then((r) => r.rows),
    );
    setorA = setores.find((s) => s.unit_id === ids.unitA)!.id;
    setorB = setores.find((s) => s.unit_id === ids.unitB)!.id;
  });

  afterAll(async () => {
    await database.close();
    await pool.end();
  });

  it('usuário da unidade A não enxerga arquivos da unidade B', async () => {
    const rows = await database.withTenantTransaction(
      { unitId: ids.unitA, userId: ids.userA, role: 'collaborator' },
      (client) => client.query('SELECT object_path FROM files').then((r) => r.rows),
    );
    expect(rows.map((r) => r.object_path)).toEqual(['unitA/f1']);
  });

  it('usuário da unidade B não enxerga arquivos da unidade A', async () => {
    const rows = await database.withTenantTransaction(
      { unitId: ids.unitB, userId: ids.userB, role: 'collaborator' },
      (client) => client.query('SELECT object_path FROM files').then((r) => r.rows),
    );
    expect(rows.map((r) => r.object_path)).toEqual(['unitB/f1']);
  });

  it('sem contexto de tenant nenhuma linha é retornada (fail-closed)', async () => {
    const rows = await database.withTransaction((client) =>
      client.query('SELECT object_path FROM files').then((r) => r.rows),
    );
    expect(rows).toEqual([]);
  });

  it('admin global agrega todas as unidades', async () => {
    const rows = await database.withTenantTransaction(
      { unitId: ids.unitA, userId: ids.globalAdmin, role: 'global_admin' },
      (client) =>
        client.query('SELECT object_path FROM files ORDER BY object_path').then((r) => r.rows),
    );
    expect(rows.map((r) => r.object_path)).toEqual(['unitA/f1', 'unitB/f1']);
  });

  it('usuário da unidade A só enxerga os setores da unidade A', async () => {
    const rows = await database.withTenantTransaction(
      { unitId: ids.unitA, userId: ids.userA, role: 'collaborator' },
      (client) => client.query('SELECT id FROM sectors').then((r) => r.rows),
    );
    expect(rows.map((r) => r.id)).toEqual([setorA]);
  });

  it('sem contexto de tenant nenhum setor é retornado (fail-closed)', async () => {
    const rows = await database.withTransaction((client) =>
      client.query('SELECT id FROM sectors').then((r) => r.rows),
    );
    expect(rows).toEqual([]);
  });

  it('vincular pessoa a setor de outra unidade é recusado pelo BANCO', async () => {
    // Não é a rota que recusa aqui: é a chave estrangeira composta
    // `(unit_id, sector_id)` da 0020 (design.md D1). O contexto é de
    // `global_admin`, que **enxerga** o setor da outra unidade — e ainda assim
    // o vínculo não se forma. É essa a diferença entre "a aplicação checa" e
    // "o banco garante".
    await expect(
      database.withTenantTransaction(
        { unitId: ids.unitA, userId: ids.globalAdmin, role: 'global_admin' },
        (client) =>
          client.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorB, ids.userA]),
      ),
    ).rejects.toThrow(/users_sector_same_unit_fk|violates foreign key/i);
  });

  it('vincular pessoa a setor da própria unidade é aceito', async () => {
    const rows = await database.withTenantTransaction(
      { unitId: ids.unitA, userId: ids.globalAdmin, role: 'global_admin' },
      async (client) => {
        await client.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorA, ids.userA]);
        return client
          .query('SELECT sector_id FROM users WHERE id = $1', [ids.userA])
          .then((r) => r.rows);
      },
    );
    expect(rows[0]!.sector_id).toBe(setorA);
  });

  it('setor não é criado fora da própria unidade (WITH CHECK)', async () => {
    await expect(
      database.withTenantTransaction(
        { unitId: ids.unitA, userId: ids.userA, role: 'unit_admin' },
        (client) =>
          client.query('INSERT INTO sectors (unit_id, name) VALUES ($1, $2)', [
            ids.unitB,
            'Setor forjado',
          ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
