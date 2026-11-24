import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import {
  setupTestDatabase,
  seedTwoUnits,
  withSystemBypass,
  sessionCookieFor,
  controleDeTeste,
} from './test-db.js';
import type { Ports } from '../ports/index.js';

const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

/**
 * Change `expiracao-permissoes` — corte de acesso (design.md D1, tasks.md
 * seção 9.1-9.3, 9.11). O corte é um predicado de consulta (`lib/access.ts`):
 * estes testes nunca invocam `notify-expiring-grants`, provando por
 * construção que o encerramento não depende da rotina de avisos ter rodado
 * (tarefa 9.11).
 */
describe('Corte de acesso por grant vencido (change expiracao-permissoes)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let userA2Id: string;

  let fileVerbsExpiredId: string;
  let fileVerbsFutureId: string;
  let folderUploadExpiredId: string;
  let folderUploadFutureId: string;
  let fileDeleteExpiredId: string;
  let fileDeleteFutureId: string;

  let folderListingId: string;
  let fileListingHiddenId: string;
  let fileSearchHiddenId: string;
  let folderTrashHiddenId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows: users } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES ($1, 'collab-a2-exp@test.dev', 'x', 'collaborator') RETURNING id`,
        [ids.unitA],
      ),
    );
    userA2Id = users[0]!.id;

    async function makeFile(name: string): Promise<string> {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, content_type, status)
           VALUES ($1, $2, $3, $4, 'text/plain', 'active') RETURNING id`,
          [ids.unitA, ids.userA, `unitA/${name}`, `${name}.txt`],
        ),
      );
      return rows[0]!.id;
    }

    async function makeFolder(name: string): Promise<string> {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, $3) RETURNING id`,
          [ids.unitA, ids.userA, name],
        ),
      );
      return rows[0]!.id;
    }

    async function grant(
      resourceType: 'file' | 'folder',
      resourceId: string,
      permission: string,
      expiresAt: string,
    ) {
      await withSystemBypass(pool, (client) =>
        client.query(
          `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ids.unitA, userA2Id, resourceType, resourceId, permission, ids.userA, expiresAt],
        ),
      );
    }

    // 9.1: um recurso por conjunto de verbos vencidos, outro com verbos
    // ainda vigentes (9.3, controle positivo) — não dá para ter as duas
    // datas na mesma linha (unicidade por verbo).
    fileVerbsExpiredId = await makeFile('verbs-expired');
    await grant('file', fileVerbsExpiredId, 'view', PAST);
    await grant('file', fileVerbsExpiredId, 'download', PAST);
    await grant('file', fileVerbsExpiredId, 'rename', PAST);

    fileVerbsFutureId = await makeFile('verbs-future');
    await grant('file', fileVerbsFutureId, 'view', FUTURE);
    await grant('file', fileVerbsFutureId, 'download', FUTURE);
    await grant('file', fileVerbsFutureId, 'rename', FUTURE);

    folderUploadExpiredId = await makeFolder('Upload Expired');
    await grant('folder', folderUploadExpiredId, 'upload', PAST);

    folderUploadFutureId = await makeFolder('Upload Future');
    await grant('folder', folderUploadFutureId, 'upload', FUTURE);

    fileDeleteExpiredId = await makeFile('delete-expired');
    await grant('file', fileDeleteExpiredId, 'delete', PAST);

    fileDeleteFutureId = await makeFile('delete-future');
    await grant('file', fileDeleteFutureId, 'delete', FUTURE);

    // 9.2: um caso por via (listagem, busca, lixeira).
    folderListingId = await makeFolder('Listing Parent');
    // Sem herança: abrir a pasta exige grant `view` próprio sobre ela
    // (vigente) — o que expira aqui é só o grant sobre o arquivo interno.
    await grant('folder', folderListingId, 'view', FUTURE);
    const { rows: listingFileRows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, status)
         VALUES ($1, $2, $3, 'unitA/listing-hidden', 'listing-hidden.txt', 'active') RETURNING id`,
        [ids.unitA, ids.userA, folderListingId],
      ),
    );
    fileListingHiddenId = listingFileRows[0]!.id;
    await grant('file', fileListingHiddenId, 'view', PAST);

    fileSearchHiddenId = await makeFile('search-hidden-unique-token');
    await grant('file', fileSearchHiddenId, 'view', PAST);

    folderTrashHiddenId = await makeFolder('Trash Hidden Root');
    await withSystemBypass(pool, (client) =>
      client.query(
        `UPDATE folders SET deleted_at = now(), deleted_by = $1, trash_root_id = id WHERE id = $2`,
        [ids.userA, folderTrashHiddenId],
      ),
    );
    await grant('folder', folderTrashHiddenId, 'delete', PAST);

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

  it('9.1: grant vencido nega view/download/rename/upload/delete — 403, sem URL, sem auditoria (9.11: sem o job ter rodado)', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, userA2Id);

    const view = await request(app)
      .post(`/files/${fileVerbsExpiredId}/view-url`)
      .set('Cookie', cookie);
    expect(view.status).toBe(403);

    const download = await request(app)
      .post(`/files/${fileVerbsExpiredId}/download-url`)
      .set('Cookie', cookie);
    expect(download.status).toBe(403);

    const rename = await request(app)
      .patch(`/files/${fileVerbsExpiredId}`)
      .set('Cookie', cookie)
      .send({ fileName: 'novo-nome.txt' });
    expect(rename.status).toBe(403);

    const upload = await request(app).post('/files/upload-url').set('Cookie', cookie).send({
      fileName: 'x.txt',
      contentType: 'text/plain',
      declaredSizeBytes: 10,
      folderId: folderUploadExpiredId,
      documentControl: controleDeTeste(),
    });
    expect(upload.status).toBe(403);

    const del = await request(app).delete(`/files/${fileDeleteExpiredId}`).set('Cookie', cookie);
    expect(del.status).toBe(403);

    const audit = await withSystemBypass(pool, (client) =>
      client.query('SELECT 1 FROM audit_events WHERE file_id = ANY($1)', [
        [fileVerbsExpiredId, fileDeleteExpiredId],
      ]),
    );
    expect(audit.rows).toHaveLength(0);
  });

  it('9.3: grant com prazo futuro concede normalmente em todos os verbos', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, userA2Id);

    const view = await request(app)
      .post(`/files/${fileVerbsFutureId}/view-url`)
      .set('Cookie', cookie);
    expect(view.status).toBe(200);

    const download = await request(app)
      .post(`/files/${fileVerbsFutureId}/download-url`)
      .set('Cookie', cookie);
    expect(download.status).toBe(200);

    const rename = await request(app)
      .patch(`/files/${fileVerbsFutureId}`)
      .set('Cookie', cookie)
      .send({ fileName: 'renomeado-ok.txt' });
    expect(rename.status).toBe(200);

    const upload = await request(app).post('/files/upload-url').set('Cookie', cookie).send({
      fileName: 'ok.txt',
      contentType: 'text/plain',
      declaredSizeBytes: 10,
      folderId: folderUploadFutureId,
      documentControl: controleDeTeste(),
    });
    expect(upload.status).toBe(200);

    const del = await request(app).delete(`/files/${fileDeleteFutureId}`).set('Cookie', cookie);
    expect(del.status).toBe(204);
  });

  it('9.2: item liberado por grant view vencido some da listagem da pasta', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, userA2Id);

    const contents = await request(app)
      .get(`/folders/${folderListingId}/contents`)
      .set('Cookie', cookie);
    expect(contents.status).toBe(200);
    const fileIds = contents.body.files.map((f: { id: string }) => f.id);
    expect(fileIds).not.toContain(fileListingHiddenId);
  });

  it('9.2: busca não retorna arquivo liberado por grant view vencido', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, userA2Id);

    const search = await request(app)
      .get('/files/search?q=search-hidden-unique-token')
      .set('Cookie', cookie);
    expect(search.status).toBe(200);
    const fileIds = search.body.files.map((f: { id: string }) => f.id);
    expect(fileIds).not.toContain(fileSearchHiddenId);
  });

  it('9.2: lixeira não lista raiz alcançada por grant delete vencido', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, userA2Id);

    const trash = await request(app).get('/trash').set('Cookie', cookie);
    expect(trash.status).toBe(200);
    const ids = trash.body.items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(folderTrashHiddenId);
  });
});
