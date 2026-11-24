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
import type { OversightListResponse, OversightReportResponse, ReadingAudience } from '@gdoc/shared';

/**
 * Acompanhamento de leituras (US 12.6, change `acompanhamento-de-leituras`).
 *
 * É a fatia que mais pressiona o isolamento: lista **nominal**. Cada recorte —
 * publicador, gestor do setor, gestor da unidade, todas as unidades — tem o
 * seu caso, e o da Governança fixa o que a exceção **não** abre (design.md D3).
 */
describe('Acompanhamento de leituras (lib/reading-oversight.ts)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let ana: string;
  let bruno: string;
  let carla: string;
  let davi: string;
  let gestorCme: string;
  let gestorUnidade: string;
  let colega: string;
  let governanca: string;
  let gestorB: string;
  let setorCme: string;
  let setorUti: string;
  let doc: string;
  let docB: string;

  const publico = (userIds: string[]): ReadingAudience => ({
    wholeUnit: false,
    sectorIds: [],
    roles: [],
    userIds,
  });

  async function como(userId: string) {
    return { app: createApp(ports), cookie: await sessionCookieFor(ports, userId) };
  }

  async function marcar(autor: string, fileId: string, userIds: string[]): Promise<string> {
    const { app, cookie } = await como(autor);
    const res = await request(app)
      .post('/reading/campaigns')
      .set('Cookie', cookie)
      .send({ fileId, audience: publico(userIds) });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function lista(userId: string): Promise<OversightListResponse> {
    const { app, cookie } = await como(userId);
    const res = await request(app).get('/reading/oversight').set('Cookie', cookie);
    expect(res.status).toBe(200);
    return res.body as OversightListResponse;
  }

  async function relatorio(userId: string, campaignId: string) {
    const { app, cookie } = await como(userId);
    return request(app).get(`/reading/oversight/campaigns/${campaignId}`).set('Cookie', cookie);
  }

  async function arquivo(unit: string, owner: string, code: string): Promise<string> {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status, document_type,
           document_code, document_revision, responsible_sector, next_review_at, content_type)
         VALUES ($1, $2, $3, $4, 'active', 'procedure', $5, 1, 'CME', '2099-01-01', 'application/pdf')
         RETURNING id`,
        [unit, owner, `${unit}/${owner}/${code}`, `${code}.pdf`, code],
      ),
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);
    const { rows: setores } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO sectors (unit_id, name) VALUES ($1, 'CME'), ($1, 'UTI') RETURNING id`,
        [ids.unitA],
      ),
    );
    [setorCme, setorUti] = setores.map((s) => s.id) as [string, string];
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name, sector_id, status, reading_oversight) VALUES
           ($1, 'ana@acomp.test', 'x', 'collaborator', 'Ana', $2, 'active', NULL),
           ($1, 'bruno@acomp.test', 'x', 'collaborator', 'Bruno', $2, 'active', NULL),
           ($1, 'carla@acomp.test', 'x', 'collaborator', 'Carla', $3, 'active', NULL),
           ($1, 'davi@acomp.test', 'x', 'collaborator', 'Davi', $3, 'active', NULL),
           ($1, 'gestor.cme@acomp.test', 'x', 'collaborator', 'Gestor CME', $2, 'active', 'sector'),
           ($1, 'gestor.unidade@acomp.test', 'x', 'collaborator', 'Gestor Unidade', NULL, 'active', 'unit'),
           ($1, 'colega@acomp.test', 'x', 'collaborator', 'Colega', $2, 'active', NULL),
           ($4, 'governanca@acomp.test', 'x', 'collaborator', 'Mariana', NULL, 'active', 'all_units'),
           ($4, 'gestor.b@acomp.test', 'x', 'collaborator', 'Gestor B', NULL, 'active', 'unit')
         RETURNING id`,
        [ids.unitA, setorCme, setorUti, ids.unitB],
      ),
    );
    [ana, bruno, carla, davi, gestorCme, gestorUnidade, colega, governanca, gestorB] = rows.map(
      (r) => r.id,
    ) as [string, string, string, string, string, string, string, string, string];
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
      await c.query('DELETE FROM notifications');
      await c.query('DELETE FROM reading_assignments');
      await c.query('DELETE FROM reading_campaigns');
      await c.query('DELETE FROM audit_events');
      await c.query('DELETE FROM files');
      await c.query(`UPDATE users SET status = 'active' WHERE id = ANY($1::uuid[])`, [
        [ana, bruno, carla, davi],
      ]);
      await c.query(`UPDATE users SET reading_oversight = 'sector' WHERE id = $1`, [gestorCme]);
    });
    doc = await arquivo(ids.unitA, ids.userA, 'POP-CME-001');
    docB = await arquivo(ids.unitB, ids.userB, 'POP-B-001');
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  async function cenarioDeQuatro(): Promise<string> {
    const id = await marcar(ids.userA, doc, [ana, bruno, carla, davi]);
    await withSystemBypass(pool, async (c) => {
      await c.query(
        `UPDATE reading_assignments SET acknowledged_at = now(), acknowledged_sector_name = 'CME'
         WHERE user_id = ANY($1::uuid[])`,
        [[ana, bruno]],
      );
      await c.query(
        `UPDATE reading_assignments SET due_date = current_date - 1 WHERE user_id = $1`,
        [carla],
      );
    });
    return id;
  }

  it('publicador vê os números de 3.5 da marcação que criou', async () => {
    const id = await cenarioDeQuatro();
    const { available, campaigns } = await lista(ids.userA);
    expect(available).toBe(true);
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]).toMatchObject({
      id,
      unitName: expect.any(String),
      documentCode: 'POP-CME-001',
      documentRevision: 1,
      inProgress: true,
      scope: 'full',
      total: 4,
      done: 2,
      pending: 1,
      late: 1,
      closed: 0,
      adherence: 50,
    });

    const res = await relatorio(ids.userA, id);
    expect(res.status).toBe(200);
    const body = res.body as OversightReportResponse;
    expect(body.people.map((p) => [p.name, p.sectorName, p.status])).toEqual([
      ['Ana', 'CME', 'done'],
      ['Bruno', 'CME', 'done'],
      ['Carla', 'UTI', 'late'],
      ['Davi', 'UTI', 'pending'],
    ]);
    expect(body.people[0]!.acknowledgedAt).toEqual(expect.any(String));
    // A resposta não carrega nada do arquivo.
    expect(JSON.stringify(body)).not.toContain(doc);
  });

  it('desativado sai do público, da adesão e da lista', async () => {
    const id = await cenarioDeQuatro();
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE users SET status = 'disabled' WHERE id = $1`, [davi]),
    );
    const res = await relatorio(ids.userA, id);
    expect(res.body.campaign).toMatchObject({ total: 3, done: 2, adherence: 67 });
    expect(res.body.people.map((p: { name: string }) => p.name)).not.toContain('Davi');
  });

  it('sem nada a acompanhar: sem aba e relatório recusado como inexistente', async () => {
    const id = await cenarioDeQuatro();
    expect(await lista(colega)).toEqual({ available: false, campaigns: [] });
    expect((await relatorio(colega, id)).status).toBe(404);
    // Ser do público não é acompanhar.
    expect((await lista(ana)).available).toBe(false);
    expect((await relatorio(ana, id)).status).toBe(404);
  });

  it('gestor do setor vê só a equipe; gestor da unidade vê todos', async () => {
    const id = await cenarioDeQuatro();
    const setor = await lista(gestorCme);
    expect(setor.campaigns[0]).toMatchObject({
      scope: 'sector',
      scopeSectorName: 'CME',
      total: 2,
      done: 2,
      adherence: 100,
    });
    const rel = (await relatorio(gestorCme, id)).body as OversightReportResponse;
    expect(rel.people.map((p) => p.name)).toEqual(['Ana', 'Bruno']);

    const unidade = await lista(gestorUnidade);
    expect(unidade.campaigns[0]).toMatchObject({ scope: 'full', total: 4 });
  });

  it('marcação de outra unidade é inexistente para o gestor e para o publicador de lá', async () => {
    const id = await cenarioDeQuatro();
    expect((await lista(gestorB)).campaigns).toEqual([]);
    expect((await relatorio(gestorB, id)).status).toBe(404);
    expect((await relatorio(ids.userB, id)).status).toBe(404);
  });

  it('os recortes somam: publicador que é gestor do setor vê o público inteiro do que marcou', async () => {
    const minha = await marcar(gestorCme, doc, [ana, carla]).catch(() => null);
    // O gestor não edita o documento alheio: marca um documento dele.
    expect(minha).toBeNull();
    const proprio = await arquivo(ids.unitA, gestorCme, 'POP-CME-002');
    const id = await marcar(gestorCme, proprio, [ana, carla]);
    const { campaigns } = await lista(gestorCme);
    expect(campaigns.find((c) => c.id === id)).toMatchObject({ scope: 'full', total: 2 });
  });

  it('perder a marcação de gestor corta o acompanhamento na requisição seguinte', async () => {
    const id = await cenarioDeQuatro();
    expect((await relatorio(gestorCme, id)).status).toBe(200);
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE users SET reading_oversight = NULL WHERE id = $1`, [gestorCme]),
    );
    expect((await relatorio(gestorCme, id)).status).toBe(404);
    expect((await lista(gestorCme)).available).toBe(false);
  });

  it('Governança vê as marcações de todas as unidades, com a unidade de cada pessoa', async () => {
    const id = await cenarioDeQuatro();
    const idB = await marcar(ids.userB, docB, [gestorB]);
    const { available, campaigns } = await lista(governanca);
    expect(available).toBe(true);
    expect(campaigns.map((c) => c.id).sort()).toEqual([id, idB].sort());
    const rel = (await relatorio(governanca, id)).body as OversightReportResponse;
    expect(rel.campaign.scope).toBe('full');
    expect(rel.people).toHaveLength(4);
    expect(new Set(rel.people.map((p) => p.unitName)).size).toBe(1);
  });

  it('a exceção da Governança não abre bytes, auditoria nem estado do arquivo de outra unidade', async () => {
    await cenarioDeQuatro();
    const { app, cookie } = await como(governanca);
    const recusas = await Promise.all([
      request(app).post(`/files/${doc}/view-url`).set('Cookie', cookie),
      request(app).post(`/files/${doc}/download-url`).set('Cookie', cookie),
      request(app).get(`/files/${doc}/audit`).set('Cookie', cookie),
      request(app).get(`/reading/files/${doc}`).set('Cookie', cookie),
    ]);
    for (const r of recusas) expect([403, 404]).toContain(r.status);
    // Indistinguível de um arquivo que não existe.
    const inexistente = '00000000-0000-4000-8000-000000000000';
    const fantasmas = await Promise.all([
      request(app).post(`/files/${inexistente}/view-url`).set('Cookie', cookie),
      request(app).post(`/files/${inexistente}/download-url`).set('Cookie', cookie),
      request(app).get(`/files/${inexistente}/audit`).set('Cookie', cookie),
      request(app).get(`/reading/files/${inexistente}`).set('Cookie', cookie),
    ]);
    expect(recusas.map((r) => r.status)).toEqual(fantasmas.map((r) => r.status));
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query('SELECT count(*)::int AS n FROM audit_events'),
    );
    expect(rows[0]!.n).toBe(0);
  });

  it('administrador global sem a marcação não atravessa unidades', async () => {
    await cenarioDeQuatro();
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name, status)
         VALUES ($1, 'global@acomp.test', 'x', 'global_admin', 'Global', 'active')
         ON CONFLICT (email) DO UPDATE SET status = 'active' RETURNING id`,
        [ids.unitB],
      ),
    );
    expect(await lista(rows[0]!.id)).toEqual({ available: false, campaigns: [] });
  });

  it('marcação encerrada continua no acompanhamento, como encerrada', async () => {
    const id = await cenarioDeQuatro();
    await withSystemBypass(pool, (c) =>
      c.query('UPDATE files SET document_revision = 2 WHERE id = $1', [doc]),
    );
    const { campaigns } = await lista(ids.userA);
    expect(campaigns.find((c) => c.id === id)).toMatchObject({
      inProgress: false,
      done: 2,
      closed: 2,
      pending: 0,
      late: 0,
    });
  });
});
