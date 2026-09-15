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
import { runPurge } from '../jobs/purge-trash.js';

/** Storage double que falha para um conjunto de paths (task 7.6 — falha por item não derruba o lote). */
class FlakyStoragePort extends InMemoryStoragePort {
  constructor(private readonly failPaths: Set<string>) {
    super();
  }
  override async deleteObject(objectPath: string): Promise<void> {
    if (this.failPaths.has(objectPath)) throw new Error('storage indisponível (teste)');
    return super.deleteObject(objectPath);
  }
}

describe('Lixeira e retenção (Épico 6, US 6.1)', () => {
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
           ($1, 'unit-admin-a@trash.test', 'x', 'unit_admin'),
           ($1, 'collab-a2@trash.test', 'x', 'collaborator')
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

  async function createFolder(cookie: string, name: string, parentId?: string): Promise<string> {
    const res = await request(createApp(ports))
      .post('/folders')
      .set('Cookie', cookie)
      .send({ name, parentId });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function uploadFile(cookie: string, fileName: string, folderId?: string): Promise<string> {
    const res = await request(createApp(ports))
      .post('/files/upload-url')
      .set('Cookie', cookie)
      .send({ fileName, contentType: 'text/plain', declaredSizeBytes: 5, folderId });
    expect(res.status).toBe(200);
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>('SELECT id FROM files WHERE object_path = $1', [
        res.body.objectPath,
      ]),
    );
    return rows[0]!.id;
  }

  describe('Exclusão e alcance (7.1)', () => {
    it('dono exclui o próprio arquivo', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const fileId = await uploadFile(cookieA, 'dono.txt');

      const del = await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA);
      expect(del.status).toBe(204);

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT deleted_at, trash_root_id FROM files WHERE id = $1', [fileId]),
      );
      expect(row.rows[0].deleted_at).not.toBeNull();
      expect(row.rows[0].trash_root_id).toBe(fileId);
    });

    it('grant delete permite excluir arquivo de outra pessoa', async () => {
      const app = createApp(ports);
      const cookieA2 = await sessionCookieFor(ports, userA2Id);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);
      const fileId = await uploadFile(cookieA2, 'grant-delete.txt');

      const grant = await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserIds: [ids.userA],
          resourceType: 'file',
          resourceId: fileId,
          permissions: ['delete'],
        });
      expect(grant.status).toBe(201);

      const del = await request(app)
        .delete(`/files/${fileId}`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA));
      expect(del.status).toBe(204);
    });

    it('admin da unidade exclui arquivo sem grant', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const fileId = await uploadFile(cookieA, 'admin-delete.txt');

      const del = await request(app)
        .delete(`/files/${fileId}`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId));
      expect(del.status).toBe(204);
    });

    it('sem posse/grant/admin, exclusão é negada com 403 e o item permanece vivo', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const fileId = await uploadFile(cookieA, 'protegido.txt');

      const del = await request(app)
        .delete(`/files/${fileId}`)
        .set('Cookie', await sessionCookieFor(ports, userA2Id));
      expect(del.status).toBe(403);

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT deleted_at FROM files WHERE id = $1', [fileId]),
      );
      expect(row.rows[0].deleted_at).toBeNull();
    });
  });

  describe('Item na lixeira resolve como inexistente em toda via viva (3.4)', () => {
    it('view-url, download-url, rename, replace-url, contents e link direto — todos 403 fail-closed', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const folderId = await createFolder(cookieA, 'Pasta Fail-Closed');
      const fileId = await uploadFile(cookieA, 'invisivel.txt', folderId);

      const del = await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA);
      expect(del.status).toBe(204);

      const view = await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookieA);
      expect(view.status).toBe(403);
      expect(view.body.url).toBeUndefined();

      const download = await request(app)
        .post(`/files/${fileId}/download-url`)
        .set('Cookie', cookieA);
      expect(download.status).toBe(403);

      const rename = await request(app)
        .patch(`/files/${fileId}`)
        .set('Cookie', cookieA)
        .send({ fileName: 'novo.txt' });
      expect(rename.status).toBe(403);

      const replace = await request(app)
        .post(`/files/${fileId}/replace-url`)
        .set('Cookie', cookieA)
        .send({ contentType: 'text/plain', declaredSizeBytes: 5 });
      expect(replace.status).toBe(403);

      const contents = await request(app)
        .get(`/folders/${folderId}/contents`)
        .set('Cookie', cookieA);
      expect(contents.status).toBe(200);
      expect(contents.body.files).toEqual([]);

      const audits = await withSystemBypass(pool, (client) =>
        client.query(
          "SELECT 1 FROM audit_events WHERE file_id = $1 AND action IN ('view','download')",
          [fileId],
        ),
      );
      expect(audits.rows).toHaveLength(0);
    });

    it('pasta excluída também resolve como inexistente para GET /folders/:id/contents', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const folderId = await createFolder(cookieA, 'Pasta Sumida');

      await request(app).delete(`/folders/${folderId}`).set('Cookie', cookieA).expect(204);

      const contents = await request(app)
        .get(`/folders/${folderId}/contents`)
        .set('Cookie', cookieA);
      expect(contents.status).toBe(403);

      const root = await request(app).get('/folders/root/contents').set('Cookie', cookieA);
      expect(root.body.folders.map((f: { id: string }) => f.id)).not.toContain(folderId);
    });
  });

  describe('Cascata de pasta (7.2)', () => {
    it('exclui pasta com subárvore inteira e preserva o agrupamento de item já excluído antes', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const p = await createFolder(cookieA, 'Cascata P');
      const q = await createFolder(cookieA, 'Cascata Q', p);
      const f1 = await uploadFile(cookieA, 'f1.txt', p);
      const f2 = await uploadFile(cookieA, 'f2.txt', q);
      const f3 = await uploadFile(cookieA, 'f3-ja-excluido.txt', p);

      // f3 já estava na lixeira antes da cascata de P.
      await request(app).delete(`/files/${f3}`).set('Cookie', cookieA).expect(204);
      const f3Before = await withSystemBypass(pool, (client) =>
        client.query<{ trash_root_id: string }>('SELECT trash_root_id FROM files WHERE id = $1', [
          f3,
        ]),
      );

      const del = await request(app).delete(`/folders/${p}`).set('Cookie', cookieA);
      expect(del.status).toBe(204);

      const rows = await withSystemBypass(pool, (client) =>
        client.query<{ id: string; deleted_at: string | null; trash_root_id: string | null }>(
          `SELECT id, deleted_at, trash_root_id FROM folders WHERE id = ANY($1::uuid[])
           UNION ALL
           SELECT id, deleted_at, trash_root_id FROM files WHERE id = ANY($2::uuid[])`,
          [
            [p, q],
            [f1, f2, f3],
          ],
        ),
      );
      const byId = new Map(rows.rows.map((r) => [r.id, r]));
      expect(byId.get(p)!.deleted_at).not.toBeNull();
      expect(byId.get(q)!.deleted_at).not.toBeNull();
      expect(byId.get(q)!.trash_root_id).toBe(p);
      expect(byId.get(f1)!.trash_root_id).toBe(p);
      expect(byId.get(f2)!.trash_root_id).toBe(p);
      // f3 preserva seu próprio agrupamento anterior — não foi absorvido por P.
      expect(byId.get(f3)!.trash_root_id).toBe(f3Before.rows[0]!.trash_root_id);
      expect(byId.get(f3)!.trash_root_id).toBe(f3);

      const rootContents = await request(app).get('/folders/root/contents').set('Cookie', cookieA);
      expect(rootContents.body.folders.map((fo: { id: string }) => fo.id)).not.toContain(p);
    });
  });

  describe('Restauração (7.3)', () => {
    it('restaura arquivo avulso ao folder_id de origem, com grants preservados', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);

      const folderId = await createFolder(cookieA, 'Restaura Origem');
      const fileId = await uploadFile(cookieA, 'restaura.txt', folderId);

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

      await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA).expect(204);

      const restore = await request(app).post(`/files/${fileId}/restore`).set('Cookie', cookieA);
      expect(restore.status).toBe(200);
      expect(restore.body.folderId).toBe(folderId);
      expect(restore.body.redirectedToRoot).toBe(false);

      const contents = await request(app)
        .get(`/folders/${folderId}/contents`)
        .set('Cookie', cookieA);
      expect(contents.body.files.map((f: { id: string }) => f.id)).toContain(fileId);

      const grants = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM grants WHERE resource_id = $1 AND permission = $2', [
          fileId,
          'view',
        ]),
      );
      expect(grants.rows).toHaveLength(1);
    });

    it('restaura pasta e sua subárvore excluída juntas', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const p = await createFolder(cookieA, 'Restaura Cascata P');
      const q = await createFolder(cookieA, 'Restaura Cascata Q', p);
      const f1 = await uploadFile(cookieA, 'r1.txt', p);
      const f2 = await uploadFile(cookieA, 'r2.txt', q);

      await request(app).delete(`/folders/${p}`).set('Cookie', cookieA).expect(204);

      const restore = await request(app).post(`/folders/${p}/restore`).set('Cookie', cookieA);
      expect(restore.status).toBe(200);

      const pContents = await request(app).get(`/folders/${p}/contents`).set('Cookie', cookieA);
      expect(pContents.status).toBe(200);
      expect(pContents.body.folders.map((fo: { id: string }) => fo.id)).toContain(q);
      expect(pContents.body.files.map((f: { id: string }) => f.id)).toContain(f1);

      const qContents = await request(app).get(`/folders/${q}/contents`).set('Cookie', cookieA);
      expect(qContents.body.files.map((f: { id: string }) => f.id)).toContain(f2);
    });

    it('descendente não-raiz não é restaurável individualmente', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const p = await createFolder(cookieA, 'Nao Raiz P');
      const q = await createFolder(cookieA, 'Nao Raiz Q', p);
      await request(app).delete(`/folders/${p}`).set('Cookie', cookieA).expect(204);

      const restore = await request(app).post(`/folders/${q}/restore`).set('Cookie', cookieA);
      expect(restore.status).toBe(403);
    });

    it('arquivo cujo pai não existe mais como pasta viva volta à raiz, informando o destino', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const p = await createFolder(cookieA, 'Pai Vai Sumir');
      const fileId = await uploadFile(cookieA, 'orfao.txt', p);

      // Exclui o arquivo primeiro (raiz própria), depois o pai (cascata
      // preserva o agrupamento do arquivo já excluído — design.md D4) — o
      // pai fica na lixeira, deixando de existir como pasta viva.
      await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA).expect(204);
      await request(app).delete(`/folders/${p}`).set('Cookie', cookieA).expect(204);

      const restore = await request(app).post(`/files/${fileId}/restore`).set('Cookie', cookieA);
      expect(restore.status).toBe(200);
      expect(restore.body.redirectedToRoot).toBe(true);
      expect(restore.body.folderId).toBeNull();

      const root = await request(app).get('/folders/root/contents').set('Cookie', cookieA);
      expect(root.body.files.map((f: { id: string }) => f.id)).toContain(fileId);
    });
  });

  describe('Isolamento entre unidades (7.4)', () => {
    it('collaborator/admin de outra unidade não excluem, não restauram e não veem na lixeira recurso alheio', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieB = await sessionCookieFor(ports, ids.userB);

      const fileId = await uploadFile(cookieA, 'isolado.txt');

      const delFromB = await request(app).delete(`/files/${fileId}`).set('Cookie', cookieB);
      expect(delFromB.status).toBe(403);

      await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA).expect(204);

      const restoreFromB = await request(app)
        .post(`/files/${fileId}/restore`)
        .set('Cookie', cookieB);
      expect(restoreFromB.status).toBe(403);

      const trashB = await request(app).get('/trash').set('Cookie', cookieB);
      expect(trashB.status).toBe(200);
      expect(trashB.body.items.map((i: { id: string }) => i.id)).not.toContain(fileId);
    });
  });

  describe('GET /trash — alcance do solicitante (5.4)', () => {
    it('collaborator vê raízes próprias e com grant delete; admin vê a lixeira da unidade', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieA2 = await sessionCookieFor(ports, userA2Id);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);

      const ownFile = await uploadFile(cookieA, 'trash-own.txt');
      const grantedFile = await uploadFile(cookieA2, 'trash-granted.txt');
      const otherFile = await uploadFile(cookieA2, 'trash-other.txt');

      await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserIds: [ids.userA],
          resourceType: 'file',
          resourceId: grantedFile,
          permissions: ['delete'],
        });

      await request(app).delete(`/files/${ownFile}`).set('Cookie', cookieA).expect(204);
      await request(app).delete(`/files/${grantedFile}`).set('Cookie', cookieA).expect(204);
      await request(app).delete(`/files/${otherFile}`).set('Cookie', cookieA2).expect(204);

      const trashA = await request(app).get('/trash').set('Cookie', cookieA);
      const idsA = trashA.body.items.map((i: { id: string }) => i.id);
      expect(idsA).toContain(ownFile);
      expect(idsA).toContain(grantedFile);
      expect(idsA).not.toContain(otherFile);

      const trashAdmin = await request(app)
        .get('/trash')
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId));
      const idsAdmin = trashAdmin.body.items.map((i: { id: string }) => i.id);
      expect(idsAdmin).toContain(ownFile);
      expect(idsAdmin).toContain(grantedFile);
      expect(idsAdmin).toContain(otherFile);
    });
  });

  describe('Cota durante a retenção (7.5)', () => {
    it('excluir não altera storage_used_bytes do dono', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const fileId = await uploadFile(cookieA, 'cota.txt');

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE files SET status = $1, size_bytes = $2 WHERE id = $3', [
          'active',
          1000,
          fileId,
        ]),
      );
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET storage_used_bytes = $1 WHERE id = $2', [1000, ids.userA]),
      );

      await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA).expect(204);

      const user = await withSystemBypass(pool, (client) =>
        client.query<{ storage_used_bytes: string }>(
          'SELECT storage_used_bytes FROM users WHERE id = $1',
          [ids.userA],
        ),
      );
      expect(Number(user.rows[0]!.storage_used_bytes)).toBe(1000);
    });
  });

  describe('Expurgo (7.6)', () => {
    it('item vencido é apagado permanentemente e devolve cota; item dentro do prazo é preservado', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const expiredId = await uploadFile(cookieA, 'vencido.txt');
      const freshId = await uploadFile(cookieA, 'recente.txt');

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE files SET status = $1, size_bytes = $2 WHERE id = ANY($3::uuid[])', [
          'active',
          1000,
          [expiredId, freshId],
        ]),
      );
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET storage_used_bytes = $1 WHERE id = $2', [2000, ids.userA]),
      );

      await request(app).delete(`/files/${expiredId}`).set('Cookie', cookieA).expect(204);
      await request(app).delete(`/files/${freshId}`).set('Cookie', cookieA).expect(204);

      await withSystemBypass(pool, (client) =>
        client.query(`UPDATE files SET deleted_at = now() - interval '31 days' WHERE id = $1`, [
          expiredId,
        ]),
      );

      const { rows: pathRows } = await withSystemBypass(pool, (client) =>
        client.query<{ object_path: string }>('SELECT object_path FROM files WHERE id = $1', [
          expiredId,
        ]),
      );
      const objectPath = pathRows[0]!.object_path;

      const summary = await runPurge(ports);
      expect(summary.purgedFiles).toBeGreaterThanOrEqual(1);

      const expiredRow = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM files WHERE id = $1', [expiredId]),
      );
      expect(expiredRow.rows).toHaveLength(0);

      const freshRow = await withSystemBypass(pool, (client) =>
        client.query('SELECT deleted_at FROM files WHERE id = $1', [freshId]),
      );
      expect(freshRow.rows[0].deleted_at).not.toBeNull();

      const user = await withSystemBypass(pool, (client) =>
        client.query<{ storage_used_bytes: string }>(
          'SELECT storage_used_bytes FROM users WHERE id = $1',
          [ids.userA],
        ),
      );
      expect(Number(user.rows[0]!.storage_used_bytes)).toBe(1000);

      expect((ports.storage as InMemoryStoragePort).wasDeleted(objectPath)).toBe(true);
    });

    it('grants e auditoria do arquivo expurgado são apagados junto', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);

      const fileId = await uploadFile(cookieA, 'auditado.txt');
      await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserIds: [userA2Id],
          resourceType: 'file',
          resourceId: fileId,
          permissions: ['view'],
        });

      await request(app)
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', await sessionCookieFor(ports, userA2Id));

      await request(app).delete(`/files/${fileId}`).set('Cookie', cookieA).expect(204);
      await withSystemBypass(pool, (client) =>
        client.query(`UPDATE files SET deleted_at = now() - interval '31 days' WHERE id = $1`, [
          fileId,
        ]),
      );

      await runPurge(ports);

      const grants = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM grants WHERE resource_id = $1', [fileId]),
      );
      expect(grants.rows).toHaveLength(0);

      const audits = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM audit_events WHERE file_id = $1', [fileId]),
      );
      expect(audits.rows).toHaveLength(0);
    });

    it('falha ao apagar bytes de um item não derruba o lote — item falho permanece íntegro', async () => {
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const app = createApp(ports);

      const okId = await uploadFile(cookieA, 'ok-expurgo.txt');
      const failId = await uploadFile(cookieA, 'falha-expurgo.txt');

      await request(app).delete(`/files/${okId}`).set('Cookie', cookieA).expect(204);
      await request(app).delete(`/files/${failId}`).set('Cookie', cookieA).expect(204);
      await withSystemBypass(pool, (client) =>
        client.query(
          `UPDATE files SET deleted_at = now() - interval '31 days' WHERE id = ANY($1::uuid[])`,
          [[okId, failId]],
        ),
      );

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string; object_path: string }>(
          'SELECT id, object_path FROM files WHERE id = ANY($1::uuid[])',
          [[okId, failId]],
        ),
      );
      const failPath = rows.find((r) => r.id === failId)!.object_path;

      const flakyPorts = {
        database: ports.database,
        storage: new FlakyStoragePort(new Set([failPath])),
      };
      const summary = await runPurge(flakyPorts);
      expect(summary.failedFiles).toBeGreaterThanOrEqual(1);

      const okRow = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM files WHERE id = $1', [okId]),
      );
      expect(okRow.rows).toHaveLength(0);

      const failRow = await withSystemBypass(pool, (client) =>
        client.query('SELECT deleted_at FROM files WHERE id = $1', [failId]),
      );
      expect(failRow.rows).toHaveLength(1);
      expect(failRow.rows[0].deleted_at).not.toBeNull();
    });

    it('expurga pasta vencida (folha) depois de apagar seus arquivos', async () => {
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const app = createApp(ports);

      const folderId = await createFolder(cookieA, 'Pasta Para Expurgo');
      const fileId = await uploadFile(cookieA, 'dentro.txt', folderId);

      await request(app).delete(`/folders/${folderId}`).set('Cookie', cookieA).expect(204);
      await withSystemBypass(pool, (client) =>
        client.query(`UPDATE folders SET deleted_at = now() - interval '31 days' WHERE id = $1`, [
          folderId,
        ]),
      );
      await withSystemBypass(pool, (client) =>
        client.query(`UPDATE files SET deleted_at = now() - interval '31 days' WHERE id = $1`, [
          fileId,
        ]),
      );

      const summary = await runPurge(ports);
      expect(summary.purgedFolders).toBeGreaterThanOrEqual(1);

      const folderRow = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM folders WHERE id = $1', [folderId]),
      );
      expect(folderRow.rows).toHaveLength(0);
    });
  });
  /**
   * Expurgo sob demanda — change `esvaziar-lixeira`. Usa pessoas próprias em
   * cada caso: a rota apaga **tudo** o que o solicitante tem na lixeira, e
   * reaproveitar `ids.userA` misturaria os restos dos blocos anteriores na
   * contagem.
   */
  describe('Expurgo sob demanda (POST /trash/purge)', () => {
    async function createUser(email: string, unitId: string, role = 'collaborator') {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role)
           VALUES ($1, $2, 'x', $3) RETURNING id`,
          [unitId, email, role],
        ),
      );
      return rows[0]!.id;
    }

    async function activate(fileIds: string[], sizeBytes: number) {
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE files SET status = $1, size_bytes = $2 WHERE id = ANY($3::uuid[])', [
          'active',
          sizeBytes,
          fileIds,
        ]),
      );
    }

    async function setUsage(userId: string, bytes: number) {
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET storage_used_bytes = $1 WHERE id = $2', [bytes, userId]),
      );
    }

    async function usage(userId: string): Promise<number> {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ storage_used_bytes: string }>(
          'SELECT storage_used_bytes FROM users WHERE id = $1',
          [userId],
        ),
      );
      return Number(rows[0]!.storage_used_bytes);
    }

    async function objectPathOf(fileId: string): Promise<string> {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ object_path: string }>('SELECT object_path FROM files WHERE id = $1', [
          fileId,
        ]),
      );
      return rows[0]!.object_path;
    }

    it('devolve exatamente os bytes dos próprios arquivos, sem tocar nos de outra pessoa nem nas pastas (tasks 3.3/3.4/3.6)', async () => {
      const app = createApp(ports);
      const purgerId = await createUser('purger@trash.test', ids.unitA);
      const otherId = await createUser('vizinho@trash.test', ids.unitA);
      const cookiePurger = await sessionCookieFor(ports, purgerId);
      const cookieOther = await sessionCookieFor(ports, otherId);

      const soltoId = await uploadFile(cookiePurger, 'solto.txt');
      const folderId = await createFolder(cookiePurger, 'Pasta Esvaziar');
      const dentroId = await uploadFile(cookiePurger, 'dentro.txt', folderId);
      const alheioId = await uploadFile(cookieOther, 'alheio.txt');

      await activate([soltoId, dentroId, alheioId], 1000);
      await setUsage(purgerId, 2000);
      await setUsage(otherId, 1000);

      await request(app).delete(`/files/${soltoId}`).set('Cookie', cookiePurger).expect(204);
      // Pasta excluída em cascata: o arquivo de dentro vai para a lixeira com
      // a pasta como raiz — e ocupa bytes do mesmo jeito.
      await request(app).delete(`/folders/${folderId}`).set('Cookie', cookiePurger).expect(204);
      await request(app).delete(`/files/${alheioId}`).set('Cookie', cookieOther).expect(204);

      const soltoPath = await objectPathOf(soltoId);

      const res = await request(app).post('/trash/purge').set('Cookie', cookiePurger);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ purgedFiles: 2, reclaimedBytes: 2000, failedFiles: 0 });

      // Cota devolvida exatamente pela soma dos apagados (task 3.3).
      expect(await usage(purgerId)).toBe(0);
      expect((ports.storage as InMemoryStoragePort).wasDeleted(soltoPath)).toBe(true);

      const purged = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM files WHERE id = ANY($1::uuid[])', [[soltoId, dentroId]]),
      );
      expect(purged.rows).toHaveLength(0);

      // Arquivo de outra pessoa da mesma unidade: intacto e restaurável (task 3.4).
      const alheio = await withSystemBypass(pool, (client) =>
        client.query<{ deleted_at: string | null }>('SELECT deleted_at FROM files WHERE id = $1', [
          alheioId,
        ]),
      );
      expect(alheio.rows).toHaveLength(1);
      expect(alheio.rows[0]!.deleted_at).not.toBeNull();
      expect(await usage(otherId)).toBe(1000);
      await request(app).post(`/files/${alheioId}/restore`).set('Cookie', cookieOther).expect(200);

      // Pasta na lixeira permanece, sujeita só ao expurgo automático (task 3.6).
      const folder = await withSystemBypass(pool, (client) =>
        client.query<{ deleted_at: string | null }>(
          'SELECT deleted_at FROM folders WHERE id = $1',
          [folderId],
        ),
      );
      expect(folder.rows).toHaveLength(1);
      expect(folder.rows[0]!.deleted_at).not.toBeNull();
    });

    it('arquivo de outra unidade é inalcançável, e o admin global esvazia só a própria lixeira (task 3.5)', async () => {
      const app = createApp(ports);
      const adminId = await createUser('admin-purge@trash.test', ids.unitA, 'global_admin');
      const cookieAdmin = await sessionCookieFor(ports, adminId);
      const cookieB = await sessionCookieFor(ports, ids.userB);

      const ownId = await uploadFile(cookieAdmin, 'admin-proprio.txt');
      const otherUnitId = await uploadFile(cookieB, 'outra-unidade.txt');

      await activate([ownId, otherUnitId], 1000);
      await setUsage(adminId, 1000);
      const usageBBefore = await usage(ids.userB);

      await request(app).delete(`/files/${ownId}`).set('Cookie', cookieAdmin).expect(204);
      await request(app).delete(`/files/${otherUnitId}`).set('Cookie', cookieB).expect(204);

      const res = await request(app).post('/trash/purge').set('Cookie', cookieAdmin);
      expect(res.status).toBe(200);
      // O bypass de RLS do global_admin faria a seleção ver a outra unidade; o
      // filtro por dono é que fecha (design.md D2) — 1 arquivo, não 2.
      expect(res.body).toEqual({ purgedFiles: 1, reclaimedBytes: 1000, failedFiles: 0 });

      const own = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM files WHERE id = $1', [ownId]),
      );
      expect(own.rows).toHaveLength(0);

      const foreign = await withSystemBypass(pool, (client) =>
        client.query<{ deleted_at: string | null }>('SELECT deleted_at FROM files WHERE id = $1', [
          otherUnitId,
        ]),
      );
      expect(foreign.rows).toHaveLength(1);
      expect(foreign.rows[0]!.deleted_at).not.toBeNull();
      expect(await usage(ids.userB)).toBe(usageBBefore);
    });

    it('falha ao apagar bytes de um arquivo não impede os demais, e o falho continua na lixeira (task 3.7)', async () => {
      const purgerId = await createUser('purger-falha@trash.test', ids.unitA);
      const cookie = await sessionCookieFor(ports, purgerId);
      const app = createApp(ports);

      const okId = await uploadFile(cookie, 'ok-sob-demanda.txt');
      const failId = await uploadFile(cookie, 'falha-sob-demanda.txt');
      await activate([okId, failId], 1000);
      await setUsage(purgerId, 2000);

      await request(app).delete(`/files/${okId}`).set('Cookie', cookie).expect(204);
      await request(app).delete(`/files/${failId}`).set('Cookie', cookie).expect(204);

      const failPath = await objectPathOf(failId);
      const flakyApp = createApp({
        ...ports,
        storage: new FlakyStoragePort(new Set([failPath])),
      });

      const res = await request(flakyApp).post('/trash/purge').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ purgedFiles: 1, reclaimedBytes: 1000, failedFiles: 1 });

      // Só o que foi apagado devolveu cota — o falho segue contando.
      expect(await usage(purgerId)).toBe(1000);

      const okRow = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM files WHERE id = $1', [okId]),
      );
      expect(okRow.rows).toHaveLength(0);

      const failRow = await withSystemBypass(pool, (client) =>
        client.query<{ deleted_at: string | null }>('SELECT deleted_at FROM files WHERE id = $1', [
          failId,
        ]),
      );
      expect(failRow.rows).toHaveLength(1);
      expect(failRow.rows[0]!.deleted_at).not.toBeNull();
    });

    it('grants e auditoria dos arquivos expurgados sob demanda são apagados junto (task 3.8)', async () => {
      const app = createApp(ports);
      const purgerId = await createUser('purger-grants@trash.test', ids.unitA);
      const cookie = await sessionCookieFor(ports, purgerId);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);

      const fileId = await uploadFile(cookie, 'com-grant.txt');
      await activate([fileId], 1000);
      await setUsage(purgerId, 1000);

      await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserIds: [userA2Id],
          resourceType: 'file',
          resourceId: fileId,
          permissions: ['view'],
        })
        .expect(201);

      await request(app)
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', await sessionCookieFor(ports, userA2Id))
        .expect(200);

      await request(app).delete(`/files/${fileId}`).set('Cookie', cookie).expect(204);

      const res = await request(app).post('/trash/purge').set('Cookie', cookie);
      expect(res.body.purgedFiles).toBe(1);

      const grants = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM grants WHERE resource_id = $1', [fileId]),
      );
      expect(grants.rows).toHaveLength(0);

      const audits = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM audit_events WHERE file_id = $1', [fileId]),
      );
      expect(audits.rows).toHaveLength(0);
    });

    it('lixeira sem arquivo próprio responde zerado, sem tocar em nada (design.md D1/D2)', async () => {
      const app = createApp(ports);
      const vazioId = await createUser('purger-vazio@trash.test', ids.unitA);
      const cookie = await sessionCookieFor(ports, vazioId);

      const folderId = await createFolder(cookie, 'Só Pasta');
      await request(app).delete(`/folders/${folderId}`).set('Cookie', cookie).expect(204);

      const res = await request(app).post('/trash/purge').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ purgedFiles: 0, reclaimedBytes: 0, failedFiles: 0 });

      const folder = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM folders WHERE id = $1', [folderId]),
      );
      expect(folder.rows).toHaveLength(1);
    });
  });
});
