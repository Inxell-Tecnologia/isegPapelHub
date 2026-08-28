import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { UserRole } from '@gdoc/shared';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase, seedTwoUnits, withSystemBypass, sessionCookieFor } from './test-db.js';
import type { Ports } from '../ports/index.js';
import { assertNoCycleAfterMove, FolderCycleError } from '../lib/folder-tree.js';

interface FolderBody {
  id: string;
  parentId: string | null;
  name: string;
}

/**
 * Testes de `mover-e-renomear-itens` (US 2.3): mover arquivo/pasta e
 * renomear pasta — ciclo, colisão de nome, alcance dono-ou-admin sem grant,
 * isolamento por unidade, lixeira, preservação e auditoria (tasks.md seção 8).
 */
describe('Mover e renomear itens (US 2.3)', () => {
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
           ($1, 'unit-admin-a@mover.test', 'x', 'unit_admin'),
           ($1, 'collab-a2@mover.test', 'x', 'collaborator')
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

  async function createFolder(
    app: ReturnType<typeof createApp>,
    cookie: string,
    name: string,
    parentId?: string,
  ): Promise<FolderBody> {
    const res = await request(app).post('/folders').set('Cookie', cookie).send({ name, parentId });
    expect(res.status).toBe(201);
    return res.body as FolderBody;
  }

  async function createActiveFile(opts: {
    unitId: string;
    ownerId: string;
    folderId?: string | null;
    objectPath: string;
    fileName: string;
    sizeBytes?: number;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, content_type, size_bytes, status)
         VALUES ($1, $2, $3, $4, $5, 'text/plain', $6, 'active') RETURNING id`,
        [
          opts.unitId,
          opts.ownerId,
          opts.folderId ?? null,
          opts.objectPath,
          opts.fileName,
          opts.sizeBytes ?? 5,
        ],
      ),
    );
    return rows[0]!.id;
  }

  describe('Ciclo (design.md D3)', () => {
    it('8.1: mover pasta para si mesma é recusado (409 folder_cycle), hierarquia intacta', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const folder = await createFolder(app, cookieA, 'CicloSelf');

      const res = await request(app)
        .post(`/folders/${folder.id}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: folder.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('folder_cycle');

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT parent_id FROM folders WHERE id = $1', [folder.id]),
      );
      expect(row.rows[0]?.parent_id).toBeNull();
    });

    it('8.2: mover pasta para uma descendente a 3+ níveis é recusado, hierarquia intacta', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const a = await createFolder(app, cookieA, 'ProfA');
      const b = await createFolder(app, cookieA, 'ProfB', a.id);
      const c = await createFolder(app, cookieA, 'ProfC', b.id);
      const d = await createFolder(app, cookieA, 'ProfD', c.id);

      const res = await request(app)
        .post(`/folders/${a.id}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: d.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('folder_cycle');

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT parent_id FROM folders WHERE id = $1', [a.id]),
      );
      expect(row.rows[0]?.parent_id).toBeNull();
    });

    it('8.3: travessias resistentes a ciclo — buildBreadcrumb termina com erro tratado; collectSubtreeFolderIds (DELETE) não trava', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const x = await createFolder(app, cookieA, 'CicloForcadoX');
      const y = await createFolder(app, cookieA, 'CicloForcadoY', x.id);

      // Contorna a camada de aplicação e força um ciclo direto no banco
      // (linha inconsistente por qualquer via, design.md D3): X passa a
      // apontar para Y, que já aponta para X.
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE folders SET parent_id = $1 WHERE id = $2', [y.id, x.id]),
      );

      // buildBreadcrumb: guarda de visitados detecta o ciclo e lança
      // FolderCycleError, tratado como 500 pelo error handler — não trava.
      const contents = await request(app).get(`/folders/${x.id}/contents`).set('Cookie', cookieA);
      expect(contents.status).toBe(500);

      // collectSubtreeFolderIds (cláusula CYCLE): a cascata de exclusão
      // termina normalmente mesmo sobre a linha em ciclo.
      const del = await request(app).delete(`/folders/${x.id}`).set('Cookie', cookieA);
      expect(del.status).toBe(204);
    });

    it('assertNoCycleAfterMove (camada 2, design.md D3): reverificação pós-UPDATE rejeita ciclo instalado por corrida', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const p = await createFolder(app, cookieA, 'Camada2P');
      const q = await createFolder(app, cookieA, 'Camada2Q', p.id);

      // Simula o resultado de uma corrida entre dois movimentos cruzados que
      // a camada 1 (pré-UPDATE), isoladamente, não vê.
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE folders SET parent_id = $1 WHERE id = $2', [q.id, p.id]),
      );

      const ctx = { unitId: ids.unitA, userId: ids.userA, role: UserRole.COLLABORATOR };
      await expect(
        ports.database.withTenantTransaction(ctx, (client) => assertNoCycleAfterMove(client, p.id)),
      ).rejects.toThrow(FolderCycleError);
    });
  });

  describe('Colisão de nome (design.md D4/D5)', () => {
    it('8.4/8.5: colisão na raiz, sob pasta-pai, insensível a maiúsculas; homônima na lixeira é aceita', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const parent = await createFolder(app, cookieA, 'ParentColisao');
      const childToDelete = await createFolder(app, cookieA, 'Filho', parent.id);
      const otherChild = await createFolder(app, cookieA, 'OutroFilho', parent.id);

      // Colisão sob pasta-pai.
      const conflict = await request(app)
        .patch(`/folders/${otherChild.id}`)
        .set('Cookie', cookieA)
        .send({ name: 'Filho' });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error).toBe('folder_name_conflict');

      // Insensível a maiúsculas/minúsculas.
      const conflictCase = await request(app)
        .patch(`/folders/${otherChild.id}`)
        .set('Cookie', cookieA)
        .send({ name: 'FILHO' });
      expect(conflictCase.status).toBe(409);

      // Homônima na lixeira não bloqueia o nome.
      const del = await request(app).delete(`/folders/${childToDelete.id}`).set('Cookie', cookieA);
      expect(del.status).toBe(204);
      const afterTrash = await request(app)
        .patch(`/folders/${otherChild.id}`)
        .set('Cookie', cookieA)
        .send({ name: 'Filho' });
      expect(afterTrash.status).toBe(200);
      expect(afterTrash.body.name).toBe('Filho');

      // Colisão na raiz — o caso que o índice não pegava antes da 0014: uma
      // pasta homônima já existe na raiz, e mover outra pasta para lá colide.
      const rootExisting = await createFolder(app, cookieA, 'MesmoNomeRaiz');
      const nested = await createFolder(app, cookieA, 'MesmoNomeRaiz', parent.id);
      const moveToRoot = await request(app)
        .post(`/folders/${nested.id}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: null });
      expect(moveToRoot.status).toBe(409);
      expect(moveToRoot.body.error).toBe('folder_name_conflict');

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT parent_id FROM folders WHERE id = $1', [nested.id]),
      );
      expect(row.rows[0]?.parent_id).toBe(parent.id);
      void rootExisting;
    });

    it('migração 0014: o índice único cobre a raiz (NULLS NOT DISTINCT) — insert direto duplicado é rejeitado', async () => {
      await withSystemBypass(pool, (client) =>
        client.query(
          `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'IndiceRaizUnico')`,
          [ids.unitA, ids.userA],
        ),
      );
      await expect(
        withSystemBypass(pool, (client) =>
          client.query(
            `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'IndiceRaizUnico')`,
            [ids.unitA, ids.userA],
          ),
        ),
      ).rejects.toThrow(/duplicate key|unique constraint/i);
    });

    it('8.6: arquivos homônimos na mesma pasta após mover são aceitos (sem constraint)', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const p1 = await createFolder(app, cookieA, 'FilesP1');
      const p2 = await createFolder(app, cookieA, 'FilesP2');

      await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: p1.id,
        objectPath: 'unitA/mover-homonimo-1',
        fileName: 'mesmo.txt',
      });
      const fileBId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: p2.id,
        objectPath: 'unitA/mover-homonimo-2',
        fileName: 'mesmo.txt',
      });

      const move = await request(app)
        .post(`/files/${fileBId}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: p1.id });
      expect(move.status).toBe(200);

      const contents = await request(app).get(`/folders/${p1.id}/contents`).set('Cookie', cookieA);
      const names = contents.body.files.map((f: { fileName: string }) => f.fileName);
      expect(names.filter((n: string) => n === 'mesmo.txt')).toHaveLength(2);
    });
  });

  describe('Alcance dono-ou-admin, sem ramo de grant (design.md D1/D2)', () => {
    it('8.7: não-dono com grant `rename` sobre o item e `upload` sobre o destino recebe 403 nas três rotas', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);
      const cookieA2 = await sessionCookieFor(ports, userA2Id);

      const origin = await createFolder(app, cookieA, 'AlcanceOrigem');
      const destination = await createFolder(app, cookieA, 'AlcanceDestino');
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: origin.id,
        objectPath: 'unitA/alcance-1',
        fileName: 'restrito.txt',
      });

      const grantRename = await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserId: userA2Id,
          resourceType: 'file',
          resourceId: fileId,
          permissions: ['rename'],
        });
      expect(grantRename.status).toBe(201);
      const grantUpload = await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserId: userA2Id,
          resourceType: 'folder',
          resourceId: destination.id,
          permissions: ['upload'],
        });
      expect(grantUpload.status).toBe(201);

      const moveFile = await request(app)
        .post(`/files/${fileId}/move`)
        .set('Cookie', cookieA2)
        .send({ destinationFolderId: destination.id });
      expect(moveFile.status).toBe(403);

      const grantRenameFolder = await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserId: userA2Id,
          resourceType: 'folder',
          resourceId: origin.id,
          permissions: ['rename'],
        });
      expect(grantRenameFolder.status).toBe(201);

      const moveFolder = await request(app)
        .post(`/folders/${origin.id}/move`)
        .set('Cookie', cookieA2)
        .send({ destinationFolderId: destination.id });
      expect(moveFolder.status).toBe(403);

      const renameFolder = await request(app)
        .patch(`/folders/${origin.id}`)
        .set('Cookie', cookieA2)
        .send({ name: 'HackeadoPeloA2' });
      expect(renameFolder.status).toBe(403);

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT name, parent_id FROM folders WHERE id = $1', [origin.id]),
      );
      expect(row.rows[0]?.name).toBe('AlcanceOrigem');
      expect(row.rows[0]?.parent_id).toBeNull();
    });

    it('dono e admin da unidade conseguem mover/renomear sem grant algum', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieAdminA = await sessionCookieFor(ports, unitAdminAId);

      const byOwner = await createFolder(app, cookieA, 'PorDono');
      const renameByOwner = await request(app)
        .patch(`/folders/${byOwner.id}`)
        .set('Cookie', cookieA)
        .send({ name: 'PorDonoRenomeado' });
      expect(renameByOwner.status).toBe(200);

      const byAdmin = await createFolder(app, cookieA, 'PorAdminOriginal');
      const renameByAdmin = await request(app)
        .patch(`/folders/${byAdmin.id}`)
        .set('Cookie', cookieAdminA)
        .send({ name: 'PorAdminRenomeado' });
      expect(renameByAdmin.status).toBe(200);
      expect(renameByAdmin.body.name).toBe('PorAdminRenomeado');
    });
  });

  describe('Isolamento por unidade (design.md D1)', () => {
    it('8.8: global_admin não alcança pasta/arquivo de outra unidade — 403 indistinguível de inexistente', async () => {
      const app = createApp(ports);
      const cookieB = await sessionCookieFor(ports, ids.userB);
      const cookieGlobalAdmin = await sessionCookieFor(ports, ids.globalAdmin);

      const folderInB = await createFolder(app, cookieB, 'IsolamentoB');
      const fileInB = await createActiveFile({
        unitId: ids.unitB,
        ownerId: ids.userB,
        objectPath: 'unitB/isolamento-1',
        fileName: 'b.txt',
      });

      const moveFolderCrossUnit = await request(app)
        .post(`/folders/${folderInB.id}/move`)
        .set('Cookie', cookieGlobalAdmin)
        .send({ destinationFolderId: null });
      expect(moveFolderCrossUnit.status).toBe(403);
      expect(moveFolderCrossUnit.body).toEqual({ error: 'forbidden' });

      const renameFolderCrossUnit = await request(app)
        .patch(`/folders/${folderInB.id}`)
        .set('Cookie', cookieGlobalAdmin)
        .send({ name: 'TentativaAdmin' });
      expect(renameFolderCrossUnit.status).toBe(403);
      expect(renameFolderCrossUnit.body).toEqual({ error: 'forbidden' });

      const moveFileCrossUnit = await request(app)
        .post(`/files/${fileInB}/move`)
        .set('Cookie', cookieGlobalAdmin)
        .send({ destinationFolderId: null });
      expect(moveFileCrossUnit.status).toBe(403);
      expect(moveFileCrossUnit.body).toEqual({ error: 'forbidden' });

      // Mesma resposta para um id inexistente — fail-closed, sem distinguir.
      const nonExistent = await request(app)
        .post('/folders/00000000-0000-0000-0000-000000000000/move')
        .set('Cookie', cookieGlobalAdmin)
        .send({ destinationFolderId: null });
      expect(nonExistent.status).toBe(403);
      expect(nonExistent.body).toEqual({ error: 'forbidden' });
    });
  });

  describe('Lixeira (design.md D1)', () => {
    it('8.9: item na lixeira não é origem nem destino, nas três rotas', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const deletedFolder = await createFolder(app, cookieA, 'SeraExcluida');
      const otherFolder = await createFolder(app, cookieA, 'OutraPasta');
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: otherFolder.id,
        objectPath: 'unitA/lixeira-1',
        fileName: 'lixo.txt',
      });

      const del = await request(app).delete(`/folders/${deletedFolder.id}`).set('Cookie', cookieA);
      expect(del.status).toBe(204);

      // Origem na lixeira.
      const moveDeletedOrigin = await request(app)
        .post(`/folders/${deletedFolder.id}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: otherFolder.id });
      expect(moveDeletedOrigin.status).toBe(403);

      const renameDeleted = await request(app)
        .patch(`/folders/${deletedFolder.id}`)
        .set('Cookie', cookieA)
        .send({ name: 'NovoNome' });
      expect(renameDeleted.status).toBe(403);

      // Destino na lixeira.
      const moveFolderToDeletedDest = await request(app)
        .post(`/folders/${otherFolder.id}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: deletedFolder.id });
      expect(moveFolderToDeletedDest.status).toBe(403);

      const moveFileToDeletedDest = await request(app)
        .post(`/files/${fileId}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: deletedFolder.id });
      expect(moveFileToDeletedDest.status).toBe(403);
    });
  });

  describe('Preservação e auditoria (spec `gestao-arquivos`, design.md D6)', () => {
    it('8.10/8.11: mover arquivo preserva object_path/cota/concessões/histórico e audita `move`; GET /files/:id/audit não expõe `move`', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieA2 = await sessionCookieFor(ports, userA2Id);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);

      const origin = await createFolder(app, cookieA, 'PreservaOrigem');
      const destination = await createFolder(app, cookieA, 'PreservaDestino');
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: origin.id,
        objectPath: 'unitA/preserva-1',
        fileName: 'preservado.txt',
        sizeBytes: 123,
      });
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET storage_used_bytes = 123 WHERE id = $1', [ids.userA]),
      );

      const grant = await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserId: userA2Id,
          resourceType: 'file',
          resourceId: fileId,
          permissions: ['view'],
        });
      expect(grant.status).toBe(201);

      const viewBefore = await request(app)
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', cookieA);
      expect(viewBefore.status).toBe(200);

      const move = await request(app)
        .post(`/files/${fileId}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: destination.id });
      expect(move.status).toBe(200);
      expect(move.body.folderId).toBe(destination.id);

      const row = await withSystemBypass(pool, (client) =>
        client.query(
          'SELECT object_path, size_bytes, owner_id, status, file_name FROM files WHERE id = $1',
          [fileId],
        ),
      );
      expect(row.rows[0]?.object_path).toBe('unitA/preserva-1');
      expect(Number(row.rows[0]?.size_bytes)).toBe(123);
      expect(row.rows[0]?.owner_id).toBe(ids.userA);
      expect(row.rows[0]?.status).toBe('active');
      expect(row.rows[0]?.file_name).toBe('preservado.txt');

      const user = await withSystemBypass(pool, (client) =>
        client.query('SELECT storage_used_bytes FROM users WHERE id = $1', [ids.userA]),
      );
      expect(Number(user.rows[0]?.storage_used_bytes)).toBe(123);

      // Concessão preservada: userA2 continua vendo o arquivo movido.
      const viewAfterByA2 = await request(app)
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', cookieA2);
      expect(viewAfterByA2.status).toBe(200);

      // Auditoria: view anterior preservado, um `move` novo, e o `view` do
      // titular do grant checado logo acima — nada além disso.
      const audit = await withSystemBypass(pool, (client) =>
        client.query('SELECT action FROM audit_events WHERE file_id = $1 ORDER BY created_at', [
          fileId,
        ]),
      );
      expect(audit.rows.map((r) => r.action)).toEqual(['view', 'move', 'view']);

      // GET /files/:id/audit segue restrito a view/download — move não aparece.
      const auditQuery = await request(app).get(`/files/${fileId}/audit`).set('Cookie', cookieA);
      expect(auditQuery.status).toBe(200);
      const actions = auditQuery.body.events.map((e: { action: string }) => e.action);
      expect(actions).not.toContain('move');
      expect(actions.every((a: string) => a === 'view' || a === 'download')).toBe(true);
    });

    it('mover/renomear pasta não grava evento de auditoria, nem para os arquivos contidos', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const origin = await createFolder(app, cookieA, 'AuditoriaPastaOrigem');
      const destination = await createFolder(app, cookieA, 'AuditoriaPastaDestino');
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: origin.id,
        objectPath: 'unitA/auditoria-pasta-1',
        fileName: 'dentro.txt',
      });

      const move = await request(app)
        .post(`/folders/${origin.id}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: destination.id });
      expect(move.status).toBe(200);

      const rename = await request(app)
        .patch(`/folders/${origin.id}`)
        .set('Cookie', cookieA)
        .send({ name: 'AuditoriaPastaRenomeada' });
      expect(rename.status).toBe(200);

      const audit = await withSystemBypass(pool, (client) =>
        client.query('SELECT * FROM audit_events WHERE file_id = $1', [fileId]),
      );
      expect(audit.rows).toHaveLength(0);
    });
  });
});
