import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { config } from '../config.js';

describe('Endpoints de gestão de permissão (routes/grants.ts, admin-only)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let unitAdminAId: string;
  let unitAdminBId: string;
  let userA2Id: string;
  let userA3Id: string;
  let fileAId: string;
  let folderBId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows: users } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'unit-admin-a@test.dev', 'x', 'unit_admin'),
           ($2, 'unit-admin-b@test.dev', 'x', 'unit_admin'),
           ($1, 'collab-a2@test.dev', 'x', 'collaborator'),
           ($1, 'collab-a3@test.dev', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA, ids.unitB],
      ),
    );
    [unitAdminAId, unitAdminBId, userA2Id, userA3Id] = users.map((u) => u.id) as [
      string,
      string,
      string,
      string,
    ];

    const { rows: files } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
         VALUES ($1, $2, 'unitA/f1', 'a.txt', 'active') RETURNING id`,
        [ids.unitA, ids.userA],
      ),
    );
    fileAId = files[0]!.id;

    const { rows: folders } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'Pasta B') RETURNING id`,
        [ids.unitB, ids.userB],
      ),
    );
    folderBId = folders[0]!.id;

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

  it('collaborator recebe 403 ao conceder, listar ou revogar', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    const create = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'file',
        resourceId: fileAId,
        permissions: ['view'],
      });
    expect(create.status).toBe(403);

    const list = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileAId}`)
      .set('Cookie', cookie);
    expect(list.status).toBe(403);

    const del = await request(app)
      .delete('/grants/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookie);
    expect(del.status).toBe(403);
  });

  it('admin concede múltiplos verbos numa chamada, idempotente ao reconceder', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const first = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'file',
        resourceId: fileAId,
        permissions: ['view', 'download'],
      });
    expect(first.status).toBe(201);
    expect(first.body.grants).toHaveLength(2);

    const second = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'file',
        resourceId: fileAId,
        permissions: ['view'],
      });
    expect(second.status).toBe(201);
    expect(second.body.grants).toHaveLength(1);

    const rows = await withSystemBypass(pool, (client) =>
      client.query(
        'SELECT permission FROM grants WHERE subject_user_id = $1 AND resource_id = $2',
        [userA2Id, fileAId],
      ),
    );
    expect(rows.rows).toHaveLength(2);
  });

  it('admin lista as concessões do recurso e revoga apenas o verbo indicado', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const list = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileAId}`)
      .set('Cookie', cookie);
    expect(list.status).toBe(200);
    const permissions = list.body.grants.map((g: { permission: string }) => g.permission).sort();
    expect(permissions).toEqual(['download', 'view']);

    const viewGrant = list.body.grants.find((g: { permission: string }) => g.permission === 'view');
    const del = await request(app).delete(`/grants/${viewGrant.id}`).set('Cookie', cookie);
    expect(del.status).toBe(204);

    const after = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileAId}`)
      .set('Cookie', cookie);
    expect(after.body.grants.map((g: { permission: string }) => g.permission)).toEqual([
      'download',
    ]);
  });

  it('unit_admin não concede sobre recurso de outra unidade, sem vazar existência', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const create = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'folder',
        resourceId: folderBId,
        permissions: ['view'],
      });
    expect(create.status).toBe(404);

    const created = await withSystemBypass(pool, (client) =>
      client.query('SELECT 1 FROM grants WHERE resource_id = $1', [folderBId]),
    );
    expect(created.rows).toHaveLength(0);
  });

  it('unit_admin não concede a pessoa de outra unidade', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const create = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [ids.userB],
        resourceType: 'file',
        resourceId: fileAId,
        permissions: ['view'],
      });
    expect(create.status).toBe(404);
  });

  it('corpo inválido (400): subjectUserIds ausente, vazio ou com elemento não-string', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const missing = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({ resourceType: 'file', resourceId: fileAId, permissions: ['view'] });
    expect(missing.status).toBe(400);

    const empty = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [],
        resourceType: 'file',
        resourceId: fileAId,
        permissions: ['view'],
      });
    expect(empty.status).toBe(400);

    const notString = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id, 42],
        resourceType: 'file',
        resourceId: fileAId,
        permissions: ['view'],
      });
    expect(notString.status).toBe(400);
  });

  it('destinatário repetido na mesma requisição converge para uma única linha por verbo, sem falhar', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
           VALUES ($1, $2, 'unitA/dedup.txt', 'dedup.txt', 'active') RETURNING id`,
          [ids.unitA, ids.userA],
        )
        .then((r) => r.rows[0]!.id),
    );

    const res = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id, userA2Id],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
      });
    expect(res.status).toBe(201);
    expect(res.body.grants).toHaveLength(1);

    const rows = await withSystemBypass(pool, (client) =>
      client.query('SELECT 1 FROM grants WHERE subject_user_id = $1 AND resource_id = $2', [
        userA2Id,
        fileId,
      ]),
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('concessão simultânea a vários colaboradores: cada um recebe cada verbo, numa única requisição', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
           VALUES ($1, $2, 'unitA/multi.txt', 'multi.txt', 'active') RETURNING id`,
          [ids.unitA, ids.userA],
        )
        .then((r) => r.rows[0]!.id),
    );

    const res = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id, userA3Id],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view', 'download'],
      });
    expect(res.status).toBe(201);
    expect(res.body.grants).toHaveLength(4);

    const rows = await withSystemBypass(pool, (client) =>
      client.query<{ subject_user_id: string; permission: string }>(
        'SELECT subject_user_id, permission FROM grants WHERE resource_id = $1',
        [fileId],
      ),
    );
    const bySubject = new Map<string, string[]>();
    for (const row of rows.rows) {
      const list = bySubject.get(row.subject_user_id) ?? [];
      list.push(row.permission);
      bySubject.set(row.subject_user_id, list);
    }
    expect(bySubject.get(userA2Id)?.sort()).toEqual(['download', 'view']);
    expect(bySubject.get(userA3Id)?.sort()).toEqual(['download', 'view']);
  });

  it('N sujeitos válidos + 1 inexistente recusa a requisição inteira (404), sem efetivar nenhuma concessão', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
           VALUES ($1, $2, 'unitA/parcial.txt', 'parcial.txt', 'active') RETURNING id`,
          [ids.unitA, ids.userA],
        )
        .then((r) => r.rows[0]!.id),
    );
    const nonexistent = '00000000-0000-0000-0000-000000000000';

    const create = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id, userA3Id, nonexistent],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
      });
    expect(create.status).toBe(404);

    const list = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileId}`)
      .set('Cookie', cookie);
    expect(list.body.grants).toEqual([]);
  });

  it('id extra de outra unidade produz a mesma recusa 404 indistinguível de id inexistente', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
           VALUES ($1, $2, 'unitA/outra-unidade.txt', 'outra-unidade.txt', 'active') RETURNING id`,
          [ids.unitA, ids.userA],
        )
        .then((r) => r.rows[0]!.id),
    );

    const create = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [userA2Id, ids.userB],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
      });
    expect(create.status).toBe(404);
    expect(create.body).toEqual({ error: 'not found' });

    const list = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileId}`)
      .set('Cookie', cookie);
    expect(list.body.grants).toEqual([]);
  });

  it('teto de destinatários (413) usa o valor configurado e não efetiva nenhuma concessão', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
           VALUES ($1, $2, 'unitA/teto.txt', 'teto.txt', 'active') RETURNING id`,
          [ids.unitA, ids.userA],
        )
        .then((r) => r.rows[0]!.id),
    );

    const maxSubjects = config.grants.maxSubjects;
    const { rows: manyUsers } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role)
         SELECT $1, 'teto-' || gs || '@test.dev', 'x', 'collaborator'
           FROM generate_series(1, $2) AS gs
         RETURNING id`,
        [ids.unitA, maxSubjects + 1],
      ),
    );
    const subjectUserIds = manyUsers.map((u) => u.id);

    const create = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds,
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
      });
    expect(create.status).toBe(413);
    expect(create.body).toEqual({
      error: 'grant_subjects_limit_exceeded',
      found: maxSubjects + 1,
      allowed: maxSubjects,
    });

    const list = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileId}`)
      .set('Cookie', cookie);
    expect(list.body.grants).toEqual([]);
  });

  it('RLS: unit_admin de uma unidade não enxerga grant de outra unidade, mesmo pedindo o mesmo recurso', async () => {
    const app = createApp(ports);
    const cookieB = await sessionCookieFor(ports, unitAdminBId);

    const list = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileAId}`)
      .set('Cookie', cookieB);
    expect(list.status).toBe(200);
    expect(list.body.grants).toEqual([]);
  });
});

/**
 * Change `expiracao-permissoes` — prazo de expiração, reconcessão (design.md
 * D3, tasks.md 9.4/9.5) e avisos emitidos pela rota (design.md D8, tasks.md
 * 9.6a-9.6d).
 */
describe('Prazo de expiração e avisos de concessão (routes/grants.ts)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let unitAdminAId: string;
  let recipientId: string;

  async function notificationsFor(recipient: string, kind?: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query(
        `SELECT kind, payload, source_ref FROM notifications WHERE recipient_user_id = $1 ${kind ? 'AND kind = $2' : ''} ORDER BY created_at`,
        kind ? [recipient, kind] : [recipient],
      ),
    );
    return rows;
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows: users } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'unit-admin-a-exp@test.dev', 'x', 'unit_admin'),
           ($1, 'collab-a-exp@test.dev', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    [unitAdminAId, recipientId] = users.map((u) => u.id) as [string, string];

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

  async function makeFile(name: string): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status) VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
        [ids.unitA, ids.userA, `unitA/${name}`, `${name}.txt`],
      ),
    );
    return rows[0]!.id;
  }

  it('9.4: reconceder com prazo mais distante estende, mais próximo encurta, sem prazo torna permanente — nunca duplica', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await makeFile('reconceder');
    const t1 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const t2 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const first = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
        expiresAt: t1,
      });
    expect(first.status).toBe(201);
    expect(first.body.grants[0].expiresAt).toBe(new Date(t1).toISOString());

    const extended = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
        expiresAt: t2,
      });
    expect(extended.status).toBe(201);
    expect(extended.body.grants[0].expiresAt).toBe(new Date(t2).toISOString());

    const shortened = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
        expiresAt: t1,
      });
    expect(shortened.status).toBe(201);
    expect(shortened.body.grants[0].expiresAt).toBe(new Date(t1).toISOString());

    const madePermanent = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
      });
    expect(madePermanent.status).toBe(201);
    expect(madePermanent.body.grants[0].expiresAt).toBeNull();

    const rows = await withSystemBypass(pool, (client) =>
      client.query('SELECT 1 FROM grants WHERE subject_user_id = $1 AND resource_id = $2', [
        recipientId,
        fileId,
      ]),
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('9.5: concessão expirada permanece listada e marcada; revogar remove', async () => {
    const fileId = await makeFile('expirada-listada');
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
         VALUES ($1, $2, 'file', $3, 'view', $4, $5) RETURNING id`,
        [ids.unitA, recipientId, fileId, unitAdminAId, past],
      ),
    );
    const grantId = rows[0]!.id;

    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);

    const list = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileId}`)
      .set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.grants).toHaveLength(1);
    expect(list.body.grants[0].expired).toBe(true);
    expect(list.body.grants[0].expiresAt).toBe(new Date(past).toISOString());

    const del = await request(app).delete(`/grants/${grantId}`).set('Cookie', cookie);
    expect(del.status).toBe(204);

    const after = await request(app)
      .get(`/grants?resourceType=file&resourceId=${fileId}`)
      .set('Cookie', cookie);
    expect(after.body.grants).toHaveLength(0);
  });

  it('9.6a: concessão com prazo avisa a pessoa no ato; sem prazo não avisa', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileWithDeadline = await makeFile('aviso-com-prazo');
    const fileWithoutDeadline = await makeFile('aviso-sem-prazo');
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const withDeadline = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileWithDeadline,
        permissions: ['view'],
        expiresAt,
      });
    expect(withDeadline.status).toBe(201);

    const withoutDeadline = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileWithoutDeadline,
        permissions: ['view'],
      });
    expect(withoutDeadline.status).toBe(201);

    const notified = await notificationsFor(recipientId, 'grant_created');
    expect(notified.filter((n) => n.payload.resourceId === fileWithDeadline)).toHaveLength(1);
    expect(notified.filter((n) => n.payload.resourceId === fileWithoutDeadline)).toHaveLength(0);
  });

  it('9.6b: vários verbos no mesmo recurso e prazo geram uma única notificação enumerando os verbos', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await makeFile('varios-verbos');
    const expiresAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view', 'download', 'rename'],
        expiresAt,
      });
    expect(res.status).toBe(201);

    const notified = await notificationsFor(recipientId, 'grant_created');
    const forThisFile = notified.filter((n) => n.payload.resourceId === fileId);
    expect(forThisFile).toHaveLength(1);
    expect(forThisFile[0]!.payload.permissions.sort()).toEqual(['download', 'rename', 'view']);
  });

  it('9.6c: reconceder alterando o prazo notifica de novo; com o mesmo prazo não', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, unitAdminAId);
    const fileId = await makeFile('prazo-muda-notifica');
    const t1 = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    const t2 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
        expiresAt: t1,
      });

    await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
        expiresAt: t1,
      });

    let notified = await notificationsFor(recipientId, 'grant_created');
    expect(notified.filter((n) => n.payload.resourceId === fileId)).toHaveLength(1);

    await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
        expiresAt: t2,
      });

    notified = await notificationsFor(recipientId, 'grant_created');
    expect(notified.filter((n) => n.payload.resourceId === fileId)).toHaveLength(2);
  });

  it('9.6d: falha na emissão do aviso não reverte a concessão nem faz a operação retornar erro', async () => {
    const failingPorts: Ports = {
      ...ports,
      notifications: {
        notify: async () => {
          throw new Error('canal indisponível');
        },
      },
    };
    const app = createApp(failingPorts);
    const cookie = await sessionCookieFor(failingPorts, unitAdminAId);
    const fileId = await makeFile('falha-no-aviso');
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/grants')
      .set('Cookie', cookie)
      .send({
        subjectUserIds: [recipientId],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
        expiresAt,
      });

    expect(res.status).toBe(201);

    const rows = await withSystemBypass(pool, (client) =>
      client.query('SELECT 1 FROM grants WHERE subject_user_id = $1 AND resource_id = $2', [
        recipientId,
        fileId,
      ]),
    );
    expect(rows.rows).toHaveLength(1);
  });
});
