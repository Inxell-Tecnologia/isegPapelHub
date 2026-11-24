import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase, withSystemBypass, sessionCookieFor } from './test-db.js';
import type { Ports } from '../ports/index.js';

/**
 * Testes de `routes/sectors.ts` (change `funcao-e-setor-na-identidade`,
 * capability `setores`). Codificam os invariantes: nome único por unidade sem
 * distinção de caixa; mesmo nome livre em unidades diferentes; só administração
 * mantém a lista; `unit_admin` preso à própria unidade, fail-closed; renomear
 * preserva os vínculos; setor com pessoas não é removido.
 */
describe('Setores: GET/POST/PATCH/DELETE /sectors', () => {
  let pool: Pool;
  let ports: Ports;
  let unitA: string;
  let unitB: string;
  let globalAdminId: string;
  let unitAdminAId: string;
  let collaboratorAId: string;

  async function seed() {
    return withSystemBypass(pool, async (client) => {
      const { rows: units } = await client.query<{ id: string; name: string }>(
        `INSERT INTO units (name) VALUES ('Sede ISETES'), ('Unidade Norte') RETURNING id, name`,
      );
      const a = units.find((u) => u.name === 'Sede ISETES')!.id;
      const b = units.find((u) => u.name === 'Unidade Norte')!.id;

      const { rows: users } = await client.query<{ id: string; email: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name) VALUES
           ($1, 'global@test.dev', 'x', 'global_admin', 'Governança'),
           ($1, 'admin-a@test.dev', 'x', 'unit_admin', 'Admin A'),
           ($1, 'collab-a@test.dev', 'x', 'collaborator', 'Colaborador A')
         RETURNING id, email`,
        [a],
      );

      return {
        unitA: a,
        unitB: b,
        globalAdminId: users.find((u) => u.email === 'global@test.dev')!.id,
        unitAdminAId: users.find((u) => u.email === 'admin-a@test.dev')!.id,
        collaboratorAId: users.find((u) => u.email === 'collab-a@test.dev')!.id,
      };
    });
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    const secrets = new EnvSecretsPort();
    const database = new PgDatabasePort();
    ports = {
      database,
      notifications: new InAppNotificationPort(database),
      storage: new InMemoryStoragePort(),
      secrets,
      auth: new Argon2AuthPort(secrets),
    };
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE audit_events, files, users, units RESTART IDENTITY CASCADE');
    const ids = await seed();
    unitA = ids.unitA;
    unitB = ids.unitB;
    globalAdminId = ids.globalAdminId;
    unitAdminAId = ids.unitAdminAId;
    collaboratorAId = ids.collaboratorAId;
  });

  // --- Unicidade por unidade (design.md D3) ---

  it('cadastra setor na própria unidade e devolve a contagem de pessoas', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/sectors')
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({ name: 'Centro Cirúrgico' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Centro Cirúrgico');
    expect(res.body.unitId).toBe(unitA);
    expect(res.body.peopleCount).toBe(0);
  });

  it('nome repetido na mesma unidade é recusado, ainda que com outra caixa ou espaços', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    expect(
      (await request(app).post('/sectors').set('Cookie', cookie).send({ name: 'CME' })).status,
    ).toBe(201);

    for (const variante of ['CME', 'cme', '  CME  ', 'cMe']) {
      const res = await request(app)
        .post('/sectors')
        .set('Cookie', cookie)
        .send({ name: variante });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'sector_name_in_use' });
    }
  });

  it('o mesmo nome em unidades diferentes é permitido e os setores são independentes', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, globalAdminId);

    const naA = await request(app)
      .post('/sectors')
      .set('Cookie', cookie)
      .send({ name: 'Governança', unitId: unitA });
    const naB = await request(app)
      .post('/sectors')
      .set('Cookie', cookie)
      .send({ name: 'Governança', unitId: unitB });

    expect(naA.status).toBe(201);
    expect(naB.status).toBe(201);
    expect(naA.body.id).not.toBe(naB.body.id);

    // E cada listagem vê só a sua.
    const listaB = await request(app)
      .get('/sectors')
      .query({ unitId: unitB })
      .set('Cookie', cookie);
    expect(listaB.body.map((s: { id: string }) => s.id)).toEqual([naB.body.id]);
  });

  // --- Alcance por papel ---

  it('colaborador é recusado nas quatro rotas', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, collaboratorAId);
    const setorId = await withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO sectors (unit_id, name) VALUES ($1, 'Existente') RETURNING id`,
        [unitA],
      );
      return rows[0]!.id;
    });

    expect((await request(app).get('/sectors').set('Cookie', cookie)).status).toBe(403);
    expect(
      (await request(app).post('/sectors').set('Cookie', cookie).send({ name: 'X' })).status,
    ).toBe(403);
    expect(
      (await request(app).patch(`/sectors/${setorId}`).set('Cookie', cookie).send({ name: 'Y' }))
        .status,
    ).toBe(403);
    expect((await request(app).delete(`/sectors/${setorId}`).set('Cookie', cookie)).status).toBe(
      403,
    );

    // A lista permanece intacta.
    const sobrou = await withSystemBypass(pool, (client) =>
      client.query('SELECT count(*)::int AS n FROM sectors').then((r) => r.rows[0]!.n),
    );
    expect(sobrou).toBe(1);
  });

  it('unit_admin pedindo outra unidade é recusado fail-closed, sem revelar o que há nela', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    await withSystemBypass(pool, (client) =>
      client.query(`INSERT INTO sectors (unit_id, name) VALUES ($1, 'Setor da Norte')`, [unitB]),
    );

    const lista = await request(app).get('/sectors').query({ unitId: unitB }).set('Cookie', cookie);
    expect(lista.status).toBe(403);
    expect(lista.text).not.toContain('Setor da Norte');

    const criar = await request(app)
      .post('/sectors')
      .set('Cookie', cookie)
      .send({ name: 'Forjado', unitId: unitB });
    expect(criar.status).toBe(403);

    const criado = await withSystemBypass(pool, (client) =>
      client
        .query('SELECT count(*)::int AS n FROM sectors WHERE unit_id = $1', [unitB])
        .then((r) => r.rows[0]!.n),
    );
    expect(criado).toBe(1);
  });

  it('setor de outra unidade não é renomeado nem removido: responde como inexistente', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const alheio = await withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO sectors (unit_id, name) VALUES ($1, 'Alheio') RETURNING id`,
        [unitB],
      );
      return rows[0]!.id;
    });

    const renomear = await request(app)
      .patch(`/sectors/${alheio}`)
      .set('Cookie', cookie)
      .send({ name: 'Tomado' });
    const remover = await request(app).delete(`/sectors/${alheio}`).set('Cookie', cookie);

    // Mesma resposta que um id inexistente produziria — os dois casos são
    // indistinguíveis de propósito.
    const inexistente = await request(app)
      .patch('/sectors/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookie)
      .send({ name: 'Tomado' });

    expect(renomear.status).toBe(404);
    expect(remover.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(renomear.body).toEqual(inexistente.body);

    const intacto = await withSystemBypass(pool, (client) =>
      client.query('SELECT name FROM sectors WHERE id = $1', [alheio]).then((r) => r.rows[0]!.name),
    );
    expect(intacto).toBe('Alheio');
  });

  it('global_admin mantém a lista de qualquer unidade', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, globalAdminId);

    const criado = await request(app)
      .post('/sectors')
      .set('Cookie', cookie)
      .send({ name: 'CME', unitId: unitB });
    expect(criado.status).toBe(201);

    const renomeado = await request(app)
      .patch(`/sectors/${criado.body.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Central de Material' });
    expect(renomeado.status).toBe(200);
    expect(renomeado.body.name).toBe('Central de Material');

    expect(
      (await request(app).delete(`/sectors/${criado.body.id}`).set('Cookie', cookie)).status,
    ).toBe(204);
  });

  // --- Renomear e remover ---

  it('renomear padroniza a grafia sem perder os vínculos', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const setorId = await withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO sectors (unit_id, name) VALUES ($1, 'Gov.') RETURNING id`,
        [unitA],
      );
      await client.query('UPDATE users SET sector_id = $1 WHERE id = $2', [
        rows[0]!.id,
        collaboratorAId,
      ]);
      return rows[0]!.id;
    });

    const res = await request(app)
      .patch(`/sectors/${setorId}`)
      .set('Cookie', cookie)
      .send({ name: 'Governança' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Governança');
    // É esta a operação que o cliente usará para aplicar a lista oficial sobre
    // o que a migração trouxe do texto livre (resposta 6a) — e por isso ela
    // não pode desvincular ninguém.
    expect(res.body.peopleCount).toBe(1);

    const vinculo = await withSystemBypass(pool, (client) =>
      client
        .query('SELECT sector_id FROM users WHERE id = $1', [collaboratorAId])
        .then((r) => r.rows[0]!.sector_id),
    );
    expect(vinculo).toBe(setorId);
  });

  it('setor com pessoas vinculadas não é removido, e informa quantas', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const setorId = await withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO sectors (unit_id, name) VALUES ($1, 'Ocupado') RETURNING id`,
        [unitA],
      );
      await client.query('UPDATE users SET sector_id = $1 WHERE unit_id = $2', [
        rows[0]!.id,
        unitA,
      ]);
      return rows[0]!.id;
    });

    const res = await request(app).delete(`/sectors/${setorId}`).set('Cookie', cookie);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('sector_has_people');
    expect(res.body.peopleCount).toBe(3);

    // Nenhum vínculo desfeito em silêncio.
    const aindaVinculadas = await withSystemBypass(pool, (client) =>
      client
        .query('SELECT count(*)::int AS n FROM users WHERE sector_id = $1', [setorId])
        .then((r) => r.rows[0]!.n),
    );
    expect(aindaVinculadas).toBe(3);
  });

  it('setor vazio é removido e deixa de ser listado', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const criado = await request(app)
      .post('/sectors')
      .set('Cookie', cookie)
      .send({ name: 'Vazio' });
    expect(
      (await request(app).delete(`/sectors/${criado.body.id}`).set('Cookie', cookie)).status,
    ).toBe(204);

    const lista = await request(app).get('/sectors').set('Cookie', cookie);
    expect(lista.body).toEqual([]);
  });

  it('nome em branco é recusado antes de chegar ao banco', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    for (const invalido of ['', '   ', undefined]) {
      const res = await request(app)
        .post('/sectors')
        .set('Cookie', cookie)
        .send({ name: invalido });
      expect(res.status).toBe(400);
    }
  });

  it('sem sessão, nenhuma rota de setor responde', async () => {
    const app = createApp(ports);
    expect((await request(app).get('/sectors')).status).toBe(401);
    expect((await request(app).post('/sectors').send({ name: 'X' })).status).toBe(401);
  });
});
