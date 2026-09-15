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

/**
 * US 9.2 cenário 2 (`epico-9-preview-cenario-2`, tasks.md seção 3): a rota
 * `POST /files/:id/view-url` ramifica por formato pré-visualizável, sem
 * mudar a checagem de permissão `view` fail-closed que já existe (coberta
 * por `permission.test.ts` / `isolamento-unidade.test.ts` / `trash.test.ts`).
 */
describe('US 9.2 cenário 2: pré-visualização indisponível + oferta de download', () => {
  let pool: Pool;
  let ports: Ports;
  let storage: InMemoryStoragePort;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let userA2Id: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES ($1, 'collab-a2@preview.test', 'x', 'collaborator') RETURNING id`,
        [ids.unitA],
      ),
    );
    userA2Id = rows[0]!.id;

    storage = new InMemoryStoragePort();
    const secrets = new EnvSecretsPort();
    const database = new PgDatabasePort();
    ports = {
      database,
      notifications: new InAppNotificationPort(database),
      storage,
      secrets,
      auth: new Argon2AuthPort(secrets),
    };
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  async function insertFile(contentType: string | null, objectPath: string): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, content_type, status)
         VALUES ($1, $2, $3, 'arquivo.bin', $4, 'active') RETURNING id`,
        [ids.unitA, ids.userA, objectPath, contentType],
      ),
    );
    return rows[0]!.id;
  }

  async function grant(fileId: string, permissions: string[]) {
    const res = await request(createApp(ports))
      .post('/grants')
      .set('Cookie', await sessionCookieFor(ports, ids.globalAdmin))
      .send({ subjectUserIds: [userA2Id], resourceType: 'file', resourceId: fileId, permissions });
    expect(res.status).toBe(201);
  }

  async function viewAudit(fileId: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query('SELECT action FROM audit_events WHERE file_id = $1', [fileId]),
    );
    return rows;
  }

  it('3.1: formato pré-visualizável (PDF) emite URL inline e audita view', async () => {
    const app = createApp(ports);
    const fileId = await insertFile('application/pdf', 'unitA/preview-pdf');
    const callsBefore = storage.calls.length;

    const res = await request(app)
      .post(`/files/${fileId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      previewAvailable: true,
      url: expect.any(String),
      expiresAt: expect.any(String),
      action: 'view',
    });
    expect(storage.calls.slice(callsBefore)).toEqual([
      { method: 'view', objectPath: 'unitA/preview-pdf' },
    ]);
    expect(await viewAudit(fileId)).toEqual([{ action: 'view' }]);
  });

  it('3.2: Office com solicitante detentor de download responde indisponível, sem URL/auditoria, e oferece o download', async () => {
    const app = createApp(ports);
    const fileId = await insertFile(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'unitA/preview-office-1',
    );
    await grant(fileId, ['view', 'download']);
    const callsBefore = storage.calls.length;

    const res = await request(app)
      .post(`/files/${fileId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, userA2Id));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      previewAvailable: false,
      reason: 'unsupported_format',
      download: { available: true },
    });
    expect(storage.calls.slice(callsBefore)).toHaveLength(0);
    expect(await viewAudit(fileId)).toHaveLength(0);
  });

  it('3.3: formato não pré-visualizável com solicitante só com view não oferece o download', async () => {
    const app = createApp(ports);
    const fileId = await insertFile(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'unitA/preview-office-2',
    );
    await grant(fileId, ['view']);
    const callsBefore = storage.calls.length;

    const res = await request(app)
      .post(`/files/${fileId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, userA2Id));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      previewAvailable: false,
      reason: 'unsupported_format',
      download: { available: false },
    });
    expect(storage.calls.slice(callsBefore)).toHaveLength(0);
    expect(await viewAudit(fileId)).toHaveLength(0);
  });

  it('3.4: content_type ausente/desconhecido cai no ramo indisponível, nunca URL inline', async () => {
    const app = createApp(ports);
    const semTipo = await insertFile(null, 'unitA/preview-sem-tipo');
    const desconhecido = await insertFile(
      'application/x-proprietary-blob',
      'unitA/preview-desconhecido',
    );
    const cookieA = await sessionCookieFor(ports, ids.userA);

    const resSemTipo = await request(app).post(`/files/${semTipo}/view-url`).set('Cookie', cookieA);
    expect(resSemTipo.status).toBe(200);
    expect(resSemTipo.body.previewAvailable).toBe(false);
    expect(resSemTipo.body.url).toBeUndefined();

    const resDesconhecido = await request(app)
      .post(`/files/${desconhecido}/view-url`)
      .set('Cookie', cookieA);
    expect(resDesconhecido.status).toBe(200);
    expect(resDesconhecido.body.previewAvailable).toBe(false);
    expect(resDesconhecido.body.url).toBeUndefined();
  });

  it('3.5: sem o verbo view, 403 fail-closed antes de qualquer classificação de formato — sem vazar formato/existência', async () => {
    const app = createApp(ports);
    const fileId = await insertFile(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'unitA/preview-office-sem-grant',
    );
    const callsBefore = storage.calls.length;

    const res = await request(app)
      .post(`/files/${fileId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, userA2Id));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
    expect(storage.calls.slice(callsBefore)).toHaveLength(0);
    expect(await viewAudit(fileId)).toHaveLength(0);
  });
});
