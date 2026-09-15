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

describe('Consulta de auditoria de acesso a arquivo (Épico 7, US 7.1/US 7.2)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let unitAdminAId: string;
  let userA2Id: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'unit-admin-a@audit.test', 'x', 'unit_admin'),
           ($1, 'collab-a2@audit.test', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    [unitAdminAId, userA2Id] = rows.map((r) => r.id) as [string, string];

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

  async function uploadFile(cookie: string, fileName: string): Promise<string> {
    const res = await request(createApp(ports))
      .post('/files/upload-url')
      .set('Cookie', cookie)
      .send({ fileName, contentType: 'text/plain', declaredSizeBytes: 5 });
    expect(res.status).toBe(200);
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>('SELECT id FROM files WHERE object_path = $1', [
        res.body.objectPath,
      ]),
    );
    return rows[0]!.id;
  }

  it('dono consulta a auditoria do próprio arquivo e vê os eventos view/download com ator, ação e data, ordenados desc (US 7.2)', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const fileId = await uploadFile(cookieA, 'dono-audit.txt');

    await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookieA);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await request(app).post(`/files/${fileId}/download-url`).set('Cookie', cookieA);

    const res = await request(app).get(`/files/${fileId}/audit`).set('Cookie', cookieA);
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);

    const [mostRecent, oldest] = res.body.events;
    expect(mostRecent.action).toBe('download');
    expect(oldest.action).toBe('view');
    expect(new Date(mostRecent.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(oldest.createdAt).getTime(),
    );
    expect(mostRecent.actor).toEqual({ id: ids.userA, name: null, email: 'collab-a@test.dev' });
  });

  it('admin da unidade consulta a auditoria de arquivo do qual não é dono e vê os eventos (US 7.1)', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const fileId = await uploadFile(cookieA, 'admin-audit.txt');

    await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookieA);

    const res = await request(app)
      .get(`/files/${fileId}/audit`)
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId));
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].action).toBe('view');
  });

  it('colaborador com grant view (não dono, não admin) recebe 403 (design D2 — grant não concede auditoria)', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);
    const fileId = await uploadFile(cookieA, 'grant-nao-concede.txt');

    const grant = await request(app)
      .post('/grants')
      .set('Cookie', cookieAdmin)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'file',
        resourceId: fileId,
        permissions: ['view'],
      });
    expect(grant.status).toBe(201);

    const res = await request(app)
      .get(`/files/${fileId}/audit`)
      .set('Cookie', await sessionCookieFor(ports, userA2Id));
    expect(res.status).toBe(403);
    expect(res.body.events).toBeUndefined();
  });

  it('isolamento entre unidades: pessoa da unidade B recebe 403 ao consultar auditoria de arquivo da unidade A, sem vazar existência', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const fileId = await uploadFile(cookieA, 'isolado.txt');

    const res = await request(app)
      .get(`/files/${fileId}/audit`)
      .set('Cookie', await sessionCookieFor(ports, ids.userB));
    expect(res.status).toBe(403);
  });

  it('arquivo inexistente e arquivo na lixeira retornam o mesmo 403 fail-closed', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);

    const nonexistent = await request(app)
      .get('/files/00000000-0000-0000-0000-000000000099/audit')
      .set('Cookie', cookieA);
    expect(nonexistent.status).toBe(403);

    const fileId = await uploadFile(cookieA, 'lixeira-audit.txt');
    await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA).expect(204);

    const trashed = await request(app).get(`/files/${fileId}/audit`).set('Cookie', cookieA);
    expect(trashed.status).toBe(403);
  });

  it('arquivo sem eventos retorna 200 com lista vazia; eventos não-acesso (rename) não aparecem', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const fileId = await uploadFile(cookieA, 'sem-eventos.txt');

    const empty = await request(app).get(`/files/${fileId}/audit`).set('Cookie', cookieA);
    expect(empty.status).toBe(200);
    expect(empty.body.events).toEqual([]);

    await request(app)
      .patch(`/files/${fileId}`)
      .set('Cookie', cookieA)
      .send({ fileName: 'renomeado.txt' })
      .expect(200);

    const afterRename = await request(app).get(`/files/${fileId}/audit`).set('Cookie', cookieA);
    expect(afterRename.status).toBe(200);
    expect(afterRename.body.events).toEqual([]);
  });
});
