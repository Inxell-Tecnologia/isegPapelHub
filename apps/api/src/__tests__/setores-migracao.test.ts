import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { config } from '../config.js';

/**
 * Backfill de `0020_sectors.sql` (change `funcao-e-setor-na-identidade`,
 * capability `setores`, requisito "A área de trabalho já cadastrada vira setor
 * sem perda").
 *
 * **Por que este teste não usa `setupTestDatabase`.** Ele aplica *todas* as
 * migrações e só então trunca — de modo que, quando o teste pudesse inserir
 * dado, `users.work_area` já não existe. Provar um backfill exige dado
 * **anterior** à migração que o consome.
 *
 * Então aqui as migrações são reexecutadas dentro de um **schema próprio**
 * (`search_path`), em duas etapas: 0001–0019, dado de entrada, e só depois a
 * 0020. É o arquivo real que roda, não uma reescrita dele — reescrever o SQL no
 * teste provaria a cópia, não a migração.
 *
 * **Por que o teste precisa existir.** A falha deste backfill é *silenciosa*:
 * sob FORCE ROW LEVEL SECURITY, um INSERT/UPDATE sem contexto de tenant atinge
 * zero linhas sem erro algum (ver o comentário de topo da 0020). Uma migração
 * que não fez nada passa como se tivesse feito.
 */

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const SCHEMA = 'teste_backfill_setores';

function migrationsUpTo(limitExclusive: string): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && f < limitExclusive)
    .sort();
}

function sqlOf(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8');
}

/** Executa no schema isolado; `public` fica no caminho só por causa do pgcrypto. */
async function inSchema<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
  await client.query(`SET search_path TO ${SCHEMA}, public`);
  return fn();
}

describe('0020_sectors.sql: backfill de work_area para setores', () => {
  let pool: Pool;
  let client: PoolClient;
  let unitA: string;
  let unitB: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: config.databaseUrl });
    client = await pool.connect();

    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);

    await inSchema(client, async () => {
      for (const file of migrationsUpTo('0020_')) {
        await client.query(sqlOf(file));
      }

      // Dado de entrada: duas unidades, grafias repetidas, divergentes, com
      // espaço sobrando, e pessoas sem área nenhuma.
      await client.query("SELECT set_config('app.user_role', 'global_admin', false)");
      const units = await client.query<{ id: string; name: string }>(
        `INSERT INTO units (name) VALUES ('Unidade A'), ('Unidade B') RETURNING id, name`,
      );
      unitA = units.rows.find((u) => u.name === 'Unidade A')!.id;
      unitB = units.rows.find((u) => u.name === 'Unidade B')!.id;

      await client.query(
        `INSERT INTO users (unit_id, email, password_hash, role, work_area, created_at) VALUES
           ($1, 'a1@x.com', 'h', 'collaborator', 'Governança',   now() - interval '5 day'),
           ($1, 'a2@x.com', 'h', 'collaborator', 'governança',   now() - interval '4 day'),
           ($1, 'a3@x.com', 'h', 'collaborator', '  Governança ', now() - interval '3 day'),
           ($1, 'a4@x.com', 'h', 'collaborator', 'Gov.',         now() - interval '2 day'),
           ($1, 'a5@x.com', 'h', 'collaborator', NULL,           now() - interval '1 day'),
           ($1, 'a6@x.com', 'h', 'collaborator', '   ',          now()),
           ($2, 'b1@x.com', 'h', 'collaborator', 'Governança',   now()),
           ($2, 'b2@x.com', 'h', 'collaborator', 'CME',          now())`,
        [unitA, unitB],
      );

      // E só agora a migração sob prova.
      await client.query(sqlOf('0020_sectors.sql'));
      await client.query("SELECT set_config('app.user_role', 'global_admin', false)");
    });
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    client.release();
    await pool.end();
  });

  it('a coluna de texto livre deixou de existir', async () => {
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'users' AND column_name IN ('work_area', 'sector_id')`,
      [SCHEMA],
    );
    expect(rows.map((r) => r.column_name).sort()).toEqual(['sector_id']);
  });

  it('cada pessoa com área preenchida aponta para um setor da própria unidade', async () => {
    const { rows } = await client.query<{ email: string; name: string; unit_id: string }>(
      `SELECT u.email, s.name, s.unit_id
         FROM users u JOIN sectors s ON s.id = u.sector_id
        ORDER BY u.email`,
    );
    expect(rows).toEqual([
      { email: 'a1@x.com', name: 'Governança', unit_id: unitA },
      { email: 'a2@x.com', name: 'Governança', unit_id: unitA },
      { email: 'a3@x.com', name: 'Governança', unit_id: unitA },
      { email: 'a4@x.com', name: 'Gov.', unit_id: unitA },
      { email: 'b1@x.com', name: 'Governança', unit_id: unitB },
      { email: 'b2@x.com', name: 'CME', unit_id: unitB },
    ]);
  });

  it('grafia preservada é a da ocorrência mais antiga, não a última', async () => {
    // "Governança", "governança" e "  Governança " colapsam num setor só; o
    // nome guardado é o da pessoa mais antiga, com os espaços aparados.
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM sectors WHERE unit_id = $1 ORDER BY name`,
      [unitA],
    );
    expect(rows.map((r) => r.name)).toEqual(['Gov.', 'Governança']);
  });

  it('pessoa sem área, ou com área só de espaços, fica sem setor', async () => {
    const { rows } = await client.query<{ email: string }>(
      `SELECT email FROM users WHERE sector_id IS NULL ORDER BY email`,
    );
    expect(rows.map((r) => r.email)).toEqual(['a5@x.com', 'a6@x.com']);
  });

  it('grafias que o sistema não pode fundir sozinho nascem como setores distintos', async () => {
    // design.md D3: "Governança" e "Gov." são o mesmo setor para o cliente e
    // não há como o banco saber. A padronização é por renomeação — e é por
    // isso que renomear setor existe na capability.
    const { rows } = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sectors WHERE unit_id = $1`,
      [unitA],
    );
    expect(rows[0]!.total).toBe('2');
  });

  it('unidades diferentes recebem setores próprios, de mesmo nome', async () => {
    const { rows } = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sectors WHERE lower(name) = 'governança'`,
    );
    expect(rows[0]!.total).toBe('2');
  });

  it('sem contexto de tenant, DML na tabela com FORCE RLS atinge zero linhas sem erro', async () => {
    // É o motivo de a 0020 abrir com `SET LOCAL app.user_role`. Medido aqui
    // para que a razão não se perca, e porque é a mesma armadilha em que
    // `0012_password_changed_at.sql` caiu — aquele UPDATE de backfill não
    // atualizou linha alguma, e passou despercebido porque o `DEFAULT now()`
    // da coluna cobriu o caso. Migration já aplicada não se edita; fica o
    // registro.
    const outro = await pool.connect();
    try {
      await outro.query(`SET search_path TO ${SCHEMA}, public`);
      const semContexto = await outro.query(`UPDATE users SET job_title = 'x'`);
      expect(semContexto.rowCount).toBe(0);

      await outro.query("SELECT set_config('app.user_role', 'global_admin', false)");
      const comContexto = await outro.query(`UPDATE users SET job_title = 'x'`);
      expect(comContexto.rowCount).toBe(8);
    } finally {
      outro.release();
    }
  });
});
