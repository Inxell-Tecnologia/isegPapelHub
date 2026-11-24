import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase, seedTwoUnits, withSystemBypass, sessionCookieFor } from './test-db.js';
import type { Ports } from '../ports/index.js';
import { GrantResourceType, Permission, ReadingOversight, UserRole } from '@gdoc/shared';
import { hasAccess } from '../lib/access.js';

/**
 * Gestor de acompanhamento (US 12.1, change `gestor-de-acompanhamento`).
 *
 * É o primeiro atributo de pessoa que vai ampliar o que ela vê (na C4). Os
 * casos abaixo fixam as regras que impedem estado incoerente — gestor do setor
 * sem setor, "todas as unidades" fora do administrador global, auto-marcação —
 * e o limite: a marcação não muda nenhuma resposta da resolução de acesso.
 */
describe('Gestor de acompanhamento (routes/users.ts, US 12.1)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let adminA: string;
  let pessoaA: string;
  let setorA: string;

  const patch = async (autor: string, alvo: string, body: Record<string, unknown>) =>
    request(createApp(ports))
      .patch(`/users/${alvo}`)
      .set('Cookie', await sessionCookieFor(ports, autor))
      .send(body);

  async function marcacao(id: string) {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{
        reading_oversight: string | null;
        reading_oversight_set_by: string | null;
        reading_oversight_set_at: string | null;
        sector_id: string | null;
      }>(
        'SELECT reading_oversight, reading_oversight_set_by, reading_oversight_set_at, sector_id FROM users WHERE id = $1',
        [id],
      ),
    );
    return rows[0]!;
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);
    const { rows: setores } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO sectors (unit_id, name) VALUES ($1, 'CME') RETURNING id`,
        [ids.unitA],
      ),
    );
    setorA = setores[0]!.id;
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name) VALUES
           ($1, 'admin-a@gestor.test', 'x', 'unit_admin', 'Admin A'),
           ($1, 'pessoa-a@gestor.test', 'x', 'collaborator', 'Pessoa A')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    [adminA, pessoaA] = rows.map((r) => r.id) as [string, string];
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

  beforeEach(async () => {
    await withSystemBypass(pool, async (c) => {
      await c.query(
        'UPDATE users SET reading_oversight = NULL, reading_oversight_set_by = NULL, reading_oversight_set_at = NULL, sector_id = NULL',
      );
      await c.query('DELETE FROM files');
    });
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  it('marca gestor da unidade e registra quem marcou e quando (design.md D5)', async () => {
    const res = await patch(adminA, pessoaA, { readingOversight: ReadingOversight.UNIT });
    expect(res.status).toBe(200);
    expect(res.body.readingOversight).toBe('unit');

    const m = await marcacao(pessoaA);
    expect(m.reading_oversight).toBe('unit');
    expect(m.reading_oversight_set_by).toBe(adminA);
    expect(m.reading_oversight_set_at).not.toBeNull();

    // Reenviar o mesmo valor não troca o autor registrado.
    await patch(ids.globalAdmin, pessoaA, { readingOversight: ReadingOversight.UNIT });
    expect((await marcacao(pessoaA)).reading_oversight_set_by).toBe(adminA);
  });

  it('o cadastro novo já pode nascer gestor, e o cargo não decide nada', async () => {
    const res = await request(createApp(ports))
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, adminA))
      .send({
        fullName: 'Coordenadora Nova',
        email: `coord-${Date.now()}@gestor.test`,
        password: 'senha-forte-123',
        jobTitle: 'Coordenadora',
        readingOversight: ReadingOversight.UNIT,
      });
    expect(res.status).toBe(201);
    expect(res.body.readingOversight).toBe('unit');
    expect((await marcacao(res.body.id)).reading_oversight_set_by).toBe(adminA);

    const semMarcacao = await request(createApp(ports))
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, adminA))
      .send({
        fullName: 'Coordenador Sem Marca',
        email: `coord2-${Date.now()}@gestor.test`,
        password: 'senha-forte-123',
        jobTitle: 'Coordenador',
      });
    expect(semMarcacao.body.readingOversight).toBeNull();
  });

  it('gestor do setor exige setor: sem setor é recusado, e nada é aplicado (design.md D2)', async () => {
    const res = await patch(adminA, pessoaA, {
      readingOversight: ReadingOversight.SECTOR,
      jobTitle: 'Coordenadora',
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'reading_oversight_requires_sector' });
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ job_title: string | null }>('SELECT job_title FROM users WHERE id = $1', [pessoaA]),
    );
    expect(rows[0]!.job_title).not.toBe('Coordenadora');
    expect((await marcacao(pessoaA)).reading_oversight).toBeNull();
  });

  it('com setor, marca gestor do setor; remover o setor depois é recusado', async () => {
    expect(
      (await patch(adminA, pessoaA, { sectorId: setorA, readingOversight: 'sector' })).status,
    ).toBe(200);

    const remover = await patch(adminA, pessoaA, { sectorId: null });
    expect(remover.status).toBe(409);
    expect(remover.body).toEqual({ error: 'reading_oversight_requires_sector' });
    const m = await marcacao(pessoaA);
    expect(m.sector_id).toBe(setorA);
    expect(m.reading_oversight).toBe('sector');
  });

  it('"todas as unidades": o administrador da unidade não concede nem retira; o global concede (design.md D3)', async () => {
    expect((await patch(adminA, pessoaA, { readingOversight: 'all_units' })).status).toBe(403);
    expect((await marcacao(pessoaA)).reading_oversight).toBeNull();

    expect((await patch(ids.globalAdmin, pessoaA, { readingOversight: 'all_units' })).status).toBe(
      200,
    );
    expect((await marcacao(pessoaA)).reading_oversight).toBe('all_units');

    expect((await patch(adminA, pessoaA, { readingOversight: null })).status).toBe(403);
    expect((await patch(adminA, pessoaA, { readingOversight: 'unit' })).status).toBe(403);
    expect((await marcacao(pessoaA)).reading_oversight).toBe('all_units');

    // Editar outro campo sem tocar na marcação continua permitido.
    expect((await patch(adminA, pessoaA, { phone: '71 0000-0000' })).status).toBe(200);
  });

  it('ninguém altera a própria marcação; reenviar o valor vigente passa (design.md D4)', async () => {
    // O administrador global é quem alcança a si mesmo pela edição — o da
    // unidade nem edita a própria conta (regra anterior a esta change).
    const res = await patch(ids.globalAdmin, ids.globalAdmin, { readingOversight: 'all_units' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'cannot change own reading oversight' });
    expect((await marcacao(ids.globalAdmin)).reading_oversight).toBeNull();
    expect((await patch(ids.globalAdmin, ids.globalAdmin, { readingOversight: null })).status).toBe(
      200,
    );
  });

  it('valor fora do conjunto é recusado como corpo inválido', async () => {
    expect((await patch(adminA, pessoaA, { readingOversight: 'diretoria' })).status).toBe(400);
  });

  it('colaborador não marca ninguém', async () => {
    expect((await patch(pessoaA, adminA, { readingOversight: 'unit' })).status).toBe(403);
  });

  it('a identidade traz o alcance, e retirá-lo vale na requisição seguinte (design.md D6)', async () => {
    const cookie = await sessionCookieFor(ports, pessoaA);
    await patch(adminA, pessoaA, { readingOversight: 'unit' });
    const app = createApp(ports);
    expect((await request(app).get('/auth/me').set('Cookie', cookie)).body.readingOversight).toBe(
      'unit',
    );
    await patch(adminA, pessoaA, { readingOversight: null });
    expect(
      (await request(app).get('/auth/me').set('Cookie', cookie)).body.readingOversight,
    ).toBeNull();
  });

  it('a marcação não concede acesso a conteúdo — hasAccess não muda (design.md D7)', async () => {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
         VALUES ($1, $2, 'gestor-test/x', 'alheio.pdf', 'active') RETURNING id`,
        [ids.unitA, ids.userA],
      ),
    );
    const arquivo = rows[0]!.id;
    await patch(ids.globalAdmin, pessoaA, { readingOversight: 'all_units' });

    const ctx = { unitId: ids.unitA, userId: pessoaA, role: UserRole.COLLABORATOR };
    for (const verbo of [Permission.VIEW, Permission.DOWNLOAD, Permission.RENAME]) {
      const ok = await ports.database.withTenantTransaction(ctx, (c) =>
        hasAccess(c, ctx, GrantResourceType.FILE, arquivo, verbo),
      );
      expect(ok).toBe(false);
    }
    // E a rota de conteúdo responde como antes.
    const res = await request(createApp(ports))
      .post(`/files/${arquivo}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, pessoaA));
    expect([403, 404]).toContain(res.status);
    // Nem administração de pessoas.
    expect(
      (
        await request(createApp(ports))
          .get('/users')
          .set('Cookie', await sessionCookieFor(ports, pessoaA))
      ).status,
    ).toBe(403);
  });
});
