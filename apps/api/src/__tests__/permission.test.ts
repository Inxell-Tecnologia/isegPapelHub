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

describe('Endpoints de URL assinada: checagem de permissão', () => {
  let pool: Pool;
  let ports: Ports;
  let storage: InMemoryStoragePort;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let fileAId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, content_type, status)
         VALUES ($1, $2, 'unitA/f1', 'a.txt', 'text/plain', 'active') RETURNING id`,
        [ids.unitA, ids.userA],
      ),
    );
    fileAId = rows[0]!.id;

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

  it('usuário sem permissão não recebe URL nem gera auditoria', async () => {
    const app = createApp(ports);

    const res = await request(app)
      .post(`/files/${fileAId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, ids.userB)); // userB é de outra unidade

    expect(res.status).toBe(403);
    expect(storage.calls).toHaveLength(0);

    const audit = await withSystemBypass(pool, (client) =>
      client.query('SELECT * FROM audit_events WHERE file_id = $1', [fileAId]),
    );
    expect(audit.rows).toHaveLength(0);
  });

  it('usuário com permissão recebe URL de visualização e gera auditoria "view"', async () => {
    const app = createApp(ports);

    const res = await request(app)
      .post(`/files/${fileAId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('view');
    expect(storage.calls).toEqual([{ method: 'view', objectPath: 'unitA/f1' }]);

    const audit = await withSystemBypass(pool, (client) =>
      client.query('SELECT action FROM audit_events WHERE file_id = $1', [fileAId]),
    );
    expect(audit.rows).toEqual([{ action: 'view' }]);
  });
});

describe('Épico 4: grants por pessoa — imposição dono-ou-grant', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let userA2Id: string;
  let grantAudit: (fileId: string) => Promise<unknown[]>;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES ($1, 'collab-a2@test.dev', 'x', 'collaborator') RETURNING id`,
        [ids.unitA],
      ),
    );
    userA2Id = rows[0]!.id;

    const secrets = new EnvSecretsPort();
    const database = new PgDatabasePort();
    ports = {
      database,
      notifications: new InAppNotificationPort(database),
      storage: new InMemoryStoragePort(),
      secrets,
      auth: new Argon2AuthPort(secrets),
    };

    grantAudit = async (fileId: string) => {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query('SELECT action FROM audit_events WHERE file_id = $1', [fileId]),
      );
      return rows;
    };
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  async function insertFile(
    ownerId: string,
    objectPath: string,
    fileName: string,
    folderId: string | null = null,
  ) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, content_type, status)
         VALUES ($1, $2, $3, $4, $5, 'text/plain', 'active') RETURNING id`,
        [ids.unitA, ownerId, folderId, objectPath, fileName],
      ),
    );
    return rows[0]!.id;
  }

  async function insertFolder(ownerId: string, name: string, parentId: string | null = null) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, $3, $4) RETURNING id`,
        [ids.unitA, ownerId, parentId, name],
      ),
    );
    return rows[0]!.id;
  }

  async function grant(resourceType: 'file' | 'folder', resourceId: string, permissions: string[]) {
    const app = createApp(ports);
    const res = await request(app)
      .post('/grants')
      .set('Cookie', await sessionCookieFor(ports, ids.globalAdmin))
      .send({ subjectUserIds: [userA2Id], resourceType, resourceId, permissions });
    expect(res.status).toBe(201);
  }

  it('não-dono da mesma unidade sem grant é bloqueado em view-url/download-url, sem auditoria', async () => {
    const app = createApp(ports);
    const fileId = await insertFile(ids.userA, 'unitA/perm-1', 'perm1.txt');
    const cookieA2 = await sessionCookieFor(ports, userA2Id);

    const view = await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookieA2);
    expect(view.status).toBe(403);

    const download = await request(app)
      .post(`/files/${fileId}/download-url`)
      .set('Cookie', cookieA2);
    expect(download.status).toBe(403);

    expect(await grantAudit(fileId)).toHaveLength(0);
  });

  it('com grant view/download, não-dono acessa e a auditoria é gravada', async () => {
    const app = createApp(ports);
    const fileId = await insertFile(ids.userA, 'unitA/perm-2', 'perm2.txt');
    const cookieA2 = await sessionCookieFor(ports, userA2Id);

    await grant('file', fileId, ['view']);
    const view = await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookieA2);
    expect(view.status).toBe(200);

    const downloadBefore = await request(app)
      .post(`/files/${fileId}/download-url`)
      .set('Cookie', cookieA2);
    expect(downloadBefore.status).toBe(403);

    await grant('file', fileId, ['download']);
    const downloadAfter = await request(app)
      .post(`/files/${fileId}/download-url`)
      .set('Cookie', cookieA2);
    expect(downloadAfter.status).toBe(200);

    expect((await grantAudit(fileId)).map((r) => (r as { action: string }).action).sort()).toEqual([
      'download',
      'view',
    ]);
  });

  it('renomear/substituir exige o verbo rename', async () => {
    const app = createApp(ports);
    const fileId = await insertFile(ids.userA, 'unitA/perm-3', 'perm3.txt');
    const cookieA2 = await sessionCookieFor(ports, userA2Id);

    const renameBlocked = await request(app)
      .patch(`/files/${fileId}`)
      .set('Cookie', cookieA2)
      .send({ fileName: 'renomeado.txt' });
    expect(renameBlocked.status).toBe(403);

    const replaceBlocked = await request(app)
      .post(`/files/${fileId}/replace-url`)
      .set('Cookie', cookieA2)
      .send({ contentType: 'text/plain', declaredSizeBytes: 5 });
    expect(replaceBlocked.status).toBe(403);

    await grant('file', fileId, ['rename']);

    const renameAllowed = await request(app)
      .patch(`/files/${fileId}`)
      .set('Cookie', cookieA2)
      .send({ fileName: 'renomeado.txt' });
    expect(renameAllowed.status).toBe(200);

    const replaceAllowed = await request(app)
      .post(`/files/${fileId}/replace-url`)
      .set('Cookie', cookieA2)
      .send({ contentType: 'text/plain', declaredSizeBytes: 5 });
    expect(replaceAllowed.status).toBe(200);
  });

  it('enviar para pasta de outra pessoa exige o verbo upload', async () => {
    const app = createApp(ports);
    const folderId = await insertFolder(ids.userA, 'Pasta Alheia');
    const cookieA2 = await sessionCookieFor(ports, userA2Id);

    const blocked = await request(app)
      .post('/files/upload-url')
      .set('Cookie', cookieA2)
      .send({ fileName: 'novo.txt', contentType: 'text/plain', declaredSizeBytes: 5, folderId });
    expect(blocked.status).toBe(403);

    await grant('folder', folderId, ['upload']);

    const allowed = await request(app)
      .post('/files/upload-url')
      .set('Cookie', cookieA2)
      .send({ fileName: 'novo.txt', contentType: 'text/plain', declaredSizeBytes: 5, folderId });
    expect(allowed.status).toBe(200);
  });

  it('sem herança: grant view em pasta não expõe os arquivos internos', async () => {
    const app = createApp(ports);
    const folderId = await insertFolder(ids.userA, 'Pasta Sem Heranca');
    const innerFileId = await insertFile(ids.userA, 'unitA/perm-inner', 'interno.txt', folderId);
    const cookieA2 = await sessionCookieFor(ports, userA2Id);

    await grant('folder', folderId, ['view']);

    const contents = await request(app)
      .get(`/folders/${folderId}/contents`)
      .set('Cookie', cookieA2);
    expect(contents.status).toBe(200);
    expect(contents.body.files).toEqual([]);

    const view = await request(app).post(`/files/${innerFileId}/view-url`).set('Cookie', cookieA2);
    expect(view.status).toBe(403);

    // Liberação explícita do item interno: só ele passa a ser acessível.
    await grant('file', innerFileId, ['view']);

    const contentsAfter = await request(app)
      .get(`/folders/${folderId}/contents`)
      .set('Cookie', cookieA2);
    expect(contentsAfter.body.files.map((f: { fileName: string }) => f.fileName)).toEqual([
      'interno.txt',
    ]);

    const viewAfter = await request(app)
      .post(`/files/${innerFileId}/view-url`)
      .set('Cookie', cookieA2);
    expect(viewAfter.status).toBe(200);
  });

  it('listagem retorna itens próprios + liberados e oculta os de terceiros; abrir sem posse/view é negado', async () => {
    const app = createApp(ports);
    const folderId = await insertFolder(ids.userA, 'Pasta Listagem');
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const cookieA2 = await sessionCookieFor(ports, userA2Id);

    // Sem posse nem grant: abrir a pasta é negado.
    const deniedBefore = await request(app)
      .get(`/folders/${folderId}/contents`)
      .set('Cookie', cookieA2);
    expect(deniedBefore.status).toBe(403);

    // Subpasta própria de userA2 na raiz: liberada a ela, oculta a userA.
    const ownFolder = await request(app)
      .post('/folders')
      .set('Cookie', cookieA2)
      .send({ name: 'Pasta A2' });
    expect(ownFolder.status).toBe(201);

    await grant('folder', folderId, ['view']);

    const root = await request(app).get('/folders/root/contents').set('Cookie', cookieA2);
    expect(root.status).toBe(200);
    const rootFolderNames = root.body.folders.map((f: { name: string }) => f.name);
    expect(rootFolderNames).toContain('Pasta A2');
    expect(rootFolderNames).toContain('Pasta Listagem');

    const rootForA = await request(app).get('/folders/root/contents').set('Cookie', cookieA);
    expect(rootForA.body.folders.map((f: { name: string }) => f.name)).not.toContain('Pasta A2');

    const opened = await request(app).get(`/folders/${folderId}/contents`).set('Cookie', cookieA2);
    expect(opened.status).toBe(200);
  });
});
