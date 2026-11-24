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
import type { MyReadingsResponse, ReadingAudience } from '@gdoc/shared';
import { GrantResourceType, Permission, UserRole } from '@gdoc/shared';
import { hasAccess } from '../lib/access.js';

/**
 * Leitura obrigatória (US 12.2/12.3, change `leitura-obrigatoria`).
 *
 * O risco maior é de **alcance**: ser do público passa a liberar visualizar um
 * documento alheio (design.md D6). Os casos fixam que a liberação é só `view`,
 * só a revisão marcada, só na unidade, e que as regras de 3.3 valem na consulta,
 * sem rotina.
 */
describe('Leitura obrigatória (routes/reading.ts)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let adminA: string;
  let leitora: string;
  let leitor2: string;
  let desativada: string;
  let setorCme: string;
  let setorUti: string;
  let doc: string;

  const tudo = (over: Partial<ReadingAudience> = {}): ReadingAudience => ({
    wholeUnit: false,
    sectorIds: [],
    roles: [],
    userIds: [],
    ...over,
  });

  async function como(userId: string) {
    return { app: createApp(ports), cookie: await sessionCookieFor(ports, userId) };
  }

  async function marcar(userId: string, body: Record<string, unknown>) {
    const { app, cookie } = await como(userId);
    return request(app).post('/reading/campaigns').set('Cookie', cookie).send(body);
  }

  async function minhas(userId: string): Promise<MyReadingsResponse> {
    const { app, cookie } = await como(userId);
    const res = await request(app).get('/reading/mine').set('Cookie', cookie);
    expect(res.status).toBe(200);
    return res.body as MyReadingsResponse;
  }

  async function ver(userId: string, fileId: string, verbo: Permission = Permission.VIEW) {
    const ctx = { unitId: ids.unitA, userId, role: UserRole.COLLABORATOR };
    return ports.database.withTenantTransaction(ctx, (c) =>
      hasAccess(c, ctx, GrantResourceType.FILE, fileId, verbo),
    );
  }

  async function documento(over: Record<string, unknown> = {}): Promise<string> {
    const v = {
      unit: ids.unitA,
      owner: ids.userA,
      type: 'procedure',
      code: `POP-${Math.random().toString(36).slice(2, 7)}`,
      rev: 1,
      next: '2099-01-01',
      lifecycle: null as string | null,
      contentType: 'application/pdf',
      ...over,
    };
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status, document_type,
           document_code, document_revision, responsible_sector, next_review_at, lifecycle_state, content_type)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, 'CME', $8::date, $9, $10) RETURNING id`,
        [
          v.unit,
          v.owner,
          `leitura/${v.code}`,
          `${v.code} Limpeza.pdf`,
          v.type,
          v.code,
          v.rev,
          v.next,
          v.lifecycle,
          v.contentType,
        ],
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
        `INSERT INTO users (unit_id, email, password_hash, role, full_name, sector_id, status) VALUES
           ($1, 'admin@leitura.test', 'x', 'unit_admin', 'Admin', NULL, 'active'),
           ($1, 'leitora@leitura.test', 'x', 'collaborator', 'Leitora', $2, 'active'),
           ($1, 'leitor2@leitura.test', 'x', 'collaborator', 'Leitor Dois', $3, 'active'),
           ($1, 'desativada@leitura.test', 'x', 'collaborator', 'Desativada', $2, 'disabled')
         RETURNING id`,
        [ids.unitA, setorCme, setorUti],
      ),
    );
    [adminA, leitora, leitor2, desativada] = rows.map((r) => r.id) as [
      string,
      string,
      string,
      string,
    ];
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
      await c.query('DELETE FROM reading_assignments');
      await c.query('DELETE FROM reading_campaigns');
      await c.query('DELETE FROM grants');
      await c.query('DELETE FROM audit_events');
      await c.query('DELETE FROM files');
      await c.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorCme, leitora]);
      await c.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorUti, leitor2]);
    });
    doc = await documento();
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  it('o dono marca documento vigente; o registro guarda revisão, código, público, prazo e quem marcou', async () => {
    const res = await marcar(ids.userA, {
      fileId: doc,
      audience: tudo({ sectorIds: [setorCme] }),
      message: 'Leiam até sexta',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fileId: doc,
      documentRevision: 1,
      message: 'Leiam até sexta',
      assignedCount: 1, // só a leitora; a desativada do mesmo setor não entra
    });
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ created_by: string; d: number }>(
        `SELECT created_by, (due_date - current_date) AS d FROM reading_campaigns WHERE id = $1`,
        [res.body.id],
      ),
    );
    expect(rows[0]!.created_by).toBe(ids.userA);
    expect(rows[0]!.d).toBe(15);
  });

  it('documento fora de vigor é recusado como não elegível (design.md D5)', async () => {
    const obsoleto = await documento({ lifecycle: 'obsolete' });
    const vencido = await documento({ next: '2020-01-01' });
    const geral = await documento({ type: 'general_file' });
    const semVisualizador = await documento({
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    for (const fileId of [obsoleto, vencido, geral, semVisualizador]) {
      const res = await marcar(adminA, { fileId, audience: tudo({ wholeUnit: true }) });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'not_eligible' });
    }
  });

  it('quem só visualiza não marca (403); quem nem visualiza recebe 404', async () => {
    await withSystemBypass(pool, (c) =>
      c.query(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by)
         VALUES ($1, $2, 'file', $3, 'view', $4)`,
        [ids.unitA, leitora, doc, adminA],
      ),
    );
    expect(
      (await marcar(leitora, { fileId: doc, audience: tudo({ wholeUnit: true }) })).status,
    ).toBe(403);
    expect(
      (await marcar(leitor2, { fileId: doc, audience: tudo({ wholeUnit: true }) })).status,
    ).toBe(404);
  });

  it('a mesma revisão não é marcada duas vezes', async () => {
    expect(
      (await marcar(ids.userA, { fileId: doc, audience: tudo({ wholeUnit: true }) })).status,
    ).toBe(201);
    const de_novo = await marcar(adminA, { fileId: doc, audience: tudo({ userIds: [leitora] }) });
    expect(de_novo.status).toBe(409);
    expect(de_novo.body).toEqual({ error: 'already_marked' });
  });

  it('prévia conta a união sem repetir e sem desativados; público vazio e de outra unidade são recusados', async () => {
    const { app, cookie } = await como(ids.userA);
    const previa = await request(app)
      .post('/reading/preview')
      .set('Cookie', cookie)
      .send({ fileId: doc, audience: tudo({ sectorIds: [setorCme], userIds: [leitora] }) });
    expect(previa.body).toEqual({ count: 1 });

    const unidade = await request(app)
      .post('/reading/preview')
      .set('Cookie', cookie)
      .send({ fileId: doc, audience: tudo({ wholeUnit: true }) });
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ n: string }>(
        `SELECT count(*) AS n FROM users WHERE unit_id = $1 AND status = 'active'`,
        [ids.unitA],
      ),
    );
    expect(unidade.body.count).toBe(Number(rows[0]!.n));

    expect((await marcar(ids.userA, { fileId: doc, audience: tudo() })).body).toEqual({
      error: 'empty_audience',
    });
    const outra = await marcar(ids.userA, {
      fileId: doc,
      audience: tudo({ userIds: [ids.userB] }),
    });
    expect(outra.status).toBe(409);
    expect(outra.body).toEqual({ error: 'invalid_audience' });
    const desativadaNominal = await marcar(ids.userA, {
      fileId: doc,
      audience: tudo({ userIds: [desativada] }),
    });
    expect(desativadaNominal.body).toEqual({ error: 'invalid_audience' });
  });

  it('ser do público libera visualizar — e só isso (design.md D6)', async () => {
    expect(await ver(leitora, doc)).toBe(false);
    await marcar(ids.userA, { fileId: doc, audience: tudo({ userIds: [leitora] }) });

    expect(await ver(leitora, doc)).toBe(true);
    expect(await ver(leitora, doc, Permission.DOWNLOAD)).toBe(false);
    expect(await ver(leitora, doc, Permission.RENAME)).toBe(false);
    expect(await ver(leitor2, doc)).toBe(false);

    // Nem na listagem da raiz, nem na busca.
    const { app, cookie } = await como(leitora);
    const raiz = await request(app).get('/folders/root/contents').set('Cookie', cookie);
    expect(JSON.stringify(raiz.body)).not.toContain(doc);
    const busca = await request(app).get('/files/search?q=Limpeza').set('Cookie', cookie);
    expect(JSON.stringify(busca.body)).not.toContain(doc);
  });

  it('ciência: só a própria, só aberta, irreversível, com o setor do momento', async () => {
    await marcar(ids.userA, { fileId: doc, audience: tudo({ userIds: [leitora, leitor2] }) });
    const [item] = (await minhas(leitora)).items;
    expect(item).toMatchObject({ status: 'pending', documentRevision: 1 });
    expect(item!.file?.id).toBe(doc);

    const alheia = await como(leitor2);
    expect(
      (
        await request(alheia.app)
          .post(`/reading/assignments/${item!.assignmentId}/acknowledge`)
          .set('Cookie', alheia.cookie)
      ).status,
    ).toBe(404);

    const { app, cookie } = await como(leitora);
    const ack = `/reading/assignments/${item!.assignmentId}/acknowledge`;
    expect((await request(app).post(ack).set('Cookie', cookie)).status).toBe(204);
    const de_novo = await request(app).post(ack).set('Cookie', cookie);
    expect(de_novo.status).toBe(409);
    expect(de_novo.body).toEqual({ error: 'not_pending' });

    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ acknowledged_sector_name: string }>(
        'SELECT acknowledged_sector_name FROM reading_assignments WHERE id = $1',
        [item!.assignmentId],
      ),
    );
    expect(rows[0]!.acknowledged_sector_name).toBe('CME');
    expect((await minhas(leitora)).items[0]!.status).toBe('done');
  });

  it('prazo vencido vira Atrasada e continua aberta', async () => {
    await marcar(ids.userA, { fileId: doc, audience: tudo({ userIds: [leitora] }) });
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE reading_assignments SET due_date = current_date - 1`),
    );
    expect((await minhas(leitora)).items[0]!.status).toBe('late');
  });

  it('nova revisão encerra a pendência e retira a liberação; a ciência antiga continua concluída', async () => {
    await marcar(ids.userA, { fileId: doc, audience: tudo({ userIds: [leitora, leitor2] }) });
    const ack = (await minhas(leitor2)).items[0]!;
    const { app, cookie } = await como(leitor2);
    await request(app)
      .post(`/reading/assignments/${ack.assignmentId}/acknowledge`)
      .set('Cookie', cookie);

    await withSystemBypass(pool, (c) =>
      c.query('UPDATE files SET document_revision = 2 WHERE id = $1', [doc]),
    );

    expect((await minhas(leitora)).items[0]!.status).toBe('closed');
    expect((await minhas(leitor2)).items[0]!.status).toBe('done');
    expect(await ver(leitora, doc)).toBe(false);

    // O formulário da revisão nova traz o público anterior (design.md D9).
    const dono = await como(ids.userA);
    const estado = await request(dono.app).get(`/reading/files/${doc}`).set('Cookie', dono.cookie);
    expect(estado.body.current).toBeNull();
    expect(estado.body.previous.audience.userIds.sort()).toEqual([leitora, leitor2].sort());
    expect(
      (await marcar(ids.userA, { fileId: doc, audience: estado.body.previous.audience })).status,
    ).toBe(201);
    expect((await minhas(leitora)).items.map((i) => i.status).sort()).toEqual([
      'closed',
      'pending',
    ]);
  });

  it('documento obsoleto encerra as pendências', async () => {
    await marcar(ids.userA, { fileId: doc, audience: tudo({ userIds: [leitora] }) });
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE files SET lifecycle_state = 'obsolete' WHERE id = $1`, [doc]),
    );
    expect((await minhas(leitora)).items[0]!.status).toBe('closed');
    expect(await ver(leitora, doc)).toBe(false);
  });

  it('quem entra depois no público recebe a pendência com 15 dias a partir de então', async () => {
    await marcar(ids.userA, { fileId: doc, audience: tudo({ sectorIds: [setorCme] }) });
    expect((await minhas(leitor2)).items).toEqual([]);

    await withSystemBypass(pool, (c) =>
      c.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorCme, leitor2]),
    );
    const [item] = (await minhas(leitor2)).items;
    expect(item!.status).toBe('pending');
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ d: number }>(
        `SELECT (due_date - current_date) AS d FROM reading_assignments WHERE id = $1`,
        [item!.assignmentId],
      ),
    );
    expect(rows[0]!.d).toBe(15);
  });

  it('não atravessa unidades: documento de outra unidade é inexistente, inclusive para o administrador global', async () => {
    const deB = await documento({ unit: ids.unitB, owner: ids.userB });
    const res = await marcar(ids.globalAdmin, { fileId: deB, audience: tudo({ wholeUnit: true }) });
    expect(res.status).toBe(404);
    const { app, cookie } = await como(ids.globalAdmin);
    expect((await request(app).get(`/reading/files/${deB}`).set('Cookie', cookie)).status).toBe(
      404,
    );
  });

  it('opções de público só a quem pode marcar, e só pessoas ativas da unidade', async () => {
    const dono = await como(ids.userA);
    const res = await request(dono.app)
      .get(`/reading/files/${doc}/audience-options`)
      .set('Cookie', dono.cookie);
    expect(res.status).toBe(200);
    const nomes = res.body.people.map((p: { name: string }) => p.name);
    expect(nomes).toContain('Leitora');
    expect(nomes).not.toContain('Desativada');
    expect(res.body.sectors.map((s: { name: string }) => s.name)).toEqual(['CME', 'UTI']);

    const outro = await como(leitor2);
    expect(
      (
        await request(outro.app)
          .get(`/reading/files/${doc}/audience-options`)
          .set('Cookie', outro.cookie)
      ).status,
    ).toBe(404);
  });

  // Ícone na linha (change `superficies-de-pendencia`, design.md D4): o resumo
  // de arquivo da listagem diz se a **revisão vigente** está marcada.
  it('a listagem informa se a revisão vigente é de leitura obrigatória', async () => {
    async function naRaiz(userId: string) {
      const { app, cookie } = await como(userId);
      const res = await request(app).get('/folders/root/contents').set('Cookie', cookie);
      expect(res.status).toBe(200);
      return (res.body.files as Array<{ id: string; requiredReading?: boolean }>).find(
        (f) => f.id === doc,
      );
    }

    expect((await naRaiz(ids.userA))!.requiredReading).toBe(false);
    await marcar(ids.userA, { fileId: doc, audience: tudo({ userIds: [leitora] }) });
    expect((await naRaiz(ids.userA))!.requiredReading).toBe(true);
    expect((await naRaiz(adminA))!.requiredReading).toBe(true);
    // Não amplia alcance: o público visualiza pelo visualizador, mas o
    // documento continua fora da navegação de quem não o alcança por ela.
    expect(await naRaiz(leitora)).toBeUndefined();

    // Revisão nova sem marcação: deixa de ser.
    await withSystemBypass(pool, (c) =>
      c.query('UPDATE files SET document_revision = 2 WHERE id = $1', [doc]),
    );
    expect((await naRaiz(ids.userA))!.requiredReading).toBe(false);

    // Remarcada e depois obsoleta: o administrador ainda lista, sem o ícone.
    await marcar(ids.userA, { fileId: doc, audience: tudo({ userIds: [leitora] }) });
    expect((await naRaiz(adminA))!.requiredReading).toBe(true);
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE files SET lifecycle_state = 'obsolete' WHERE id = $1`, [doc]),
    );
    expect((await naRaiz(adminA))!.requiredReading).toBe(false);
  });

  it('sem sessão retorna 401', async () => {
    expect((await request(createApp(ports)).get('/reading/mine')).status).toBe(401);
  });
});
