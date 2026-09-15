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

interface FolderBody {
  id: string;
  parentId: string | null;
  name: string;
}

/**
 * Testes de `mover-itens-em-lote` (US 2.4): `POST /files/move` e
 * `POST /folders/move` — pré-condição global de destino, veredito por item,
 * ciclo (camada 1 por item, camada 2 tudo-ou-nada), colisão de nome,
 * auditoria e o não-casamento com as rotas por item (tasks.md seções 3-5).
 */
describe('Mover itens em lote (US 2.4)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

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

  describe('POST /files/move — pré-condição global (design.md D2)', () => {
    it('3.1: destino sem alcance derruba o lote inteiro, sem mover nada', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieB = await sessionCookieFor(ports, ids.userB);
      const destinationOfB = await createFolder(app, cookieB, 'DestinoDeB');
      const origin = await createFolder(app, cookieA, 'OrigemLoteArquivos');
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: origin.id,
        objectPath: 'unitA/lote-precondicao-1',
        fileName: 'a.txt',
      });

      const res = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({ ids: [fileId], destinationFolderId: destinationOfB.id });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'forbidden' });

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT folder_id FROM files WHERE id = $1', [fileId]),
      );
      expect(row.rows[0]?.folder_id).toBe(origin.id);
    });

    it('3.1: destino de outra unidade produz a mesma recusa que destino inexistente', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        objectPath: 'unitA/lote-precondicao-2',
        fileName: 'b.txt',
      });

      const crossUnit = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({ ids: [fileId], destinationFolderId: ids.unitB });
      expect(crossUnit.status).toBe(403);

      const nonExistent = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({ ids: [fileId], destinationFolderId: '00000000-0000-0000-0000-000000000000' });
      expect(nonExistent.status).toBe(403);
      expect(nonExistent.body).toEqual(crossUnit.body);
    });

    it('3.1: teto de itens excedido recusa o lote inteiro com aviso próprio, distinguível de permissão', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const maxItems = config.moveBatch.maxItems;
      const tooMany = Array.from({ length: maxItems + 1 }, (_, i) => `id-fake-${i}`);

      const res = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({ ids: tooMany, destinationFolderId: null });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'move_batch_limit_exceeded',
        found: tooMany.length,
        allowed: maxItems,
      });
    });

    it('conjunto vazio é recusado (400, corpo inválido)', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const res = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({ ids: [], destinationFolderId: null });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /files/move — veredito por item (design.md D2)', () => {
    it('3.2/3.3: item sem alcance é recusado sem impedir os demais; auditoria só dos movidos', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const destination = await createFolder(app, cookieA, 'DestinoLoteVeredito');

      const fileOk1 = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        objectPath: 'unitA/veredito-1',
        fileName: 'ok1.txt',
      });
      const fileOk2 = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        objectPath: 'unitA/veredito-2',
        fileName: 'ok2.txt',
      });
      const fileOk3 = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        objectPath: 'unitA/veredito-3',
        fileName: 'ok3.txt',
      });
      // Sem alcance: pertence à unidade B, invisível pela RLS de A.
      const fileForbidden = await createActiveFile({
        unitId: ids.unitB,
        ownerId: ids.userB,
        objectPath: 'unitB/veredito-4',
        fileName: 'proibido.txt',
      });

      const res = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({
          ids: [fileOk1, fileOk2, fileOk3, fileForbidden],
          destinationFolderId: destination.id,
        });

      expect(res.status).toBe(200);
      const results = res.body.results as { id: string; ok: boolean; error?: string }[];
      expect(results).toHaveLength(4);
      expect(results.find((r) => r.id === fileForbidden)).toEqual({
        id: fileForbidden,
        ok: false,
        error: 'forbidden',
      });
      for (const okId of [fileOk1, fileOk2, fileOk3]) {
        expect(results.find((r) => r.id === okId)).toEqual({ id: okId, ok: true });
      }

      const moved = await withSystemBypass(pool, (client) =>
        client.query('SELECT id, folder_id FROM files WHERE id = ANY($1::uuid[])', [
          [fileOk1, fileOk2, fileOk3],
        ]),
      );
      for (const row of moved.rows) {
        expect(row.folder_id).toBe(destination.id);
      }

      const untouched = await withSystemBypass(pool, (client) =>
        client.query('SELECT folder_id FROM files WHERE id = $1', [fileForbidden]),
      );
      expect(untouched.rows[0]?.folder_id).toBeNull();

      // Auditoria: exatamente 3 eventos `move`, nenhum para o item recusado.
      const auditOk = await withSystemBypass(pool, (client) =>
        client.query('SELECT file_id, action FROM audit_events WHERE file_id = ANY($1::uuid[])', [
          [fileOk1, fileOk2, fileOk3],
        ]),
      );
      expect(auditOk.rows).toHaveLength(3);
      expect(auditOk.rows.every((r) => r.action === 'move')).toBe(true);

      const auditForbidden = await withSystemBypass(pool, (client) =>
        client.query('SELECT * FROM audit_events WHERE file_id = $1', [fileForbidden]),
      );
      expect(auditForbidden.rows).toHaveLength(0);
    });

    it('3.4: preserva object_path, owner_id, file_name, size_bytes, cota e concessões', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);
      const { rows: subjectRows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role) VALUES ($1, 'colega-lote-a@mover.test', 'x', 'collaborator') RETURNING id`,
          [ids.unitA],
        ),
      );
      const subjectId = subjectRows[0]!.id;
      const cookieSubject = await sessionCookieFor(ports, subjectId);

      const destination = await createFolder(app, cookieA, 'PreservaLote');
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        objectPath: 'unitA/preserva-lote-1',
        fileName: 'preservado-lote.txt',
        sizeBytes: 321,
      });
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET storage_used_bytes = 321 WHERE id = $1', [ids.userA]),
      );

      const grant = await request(app)
        .post('/grants')
        .set('Cookie', cookieAdmin)
        .send({
          subjectUserIds: [subjectId],
          resourceType: 'file',
          resourceId: fileId,
          permissions: ['view'],
        });
      expect(grant.status).toBe(201);

      const move = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({ ids: [fileId], destinationFolderId: destination.id });
      expect(move.status).toBe(200);
      expect(move.body.results).toEqual([{ id: fileId, ok: true }]);

      const row = await withSystemBypass(pool, (client) =>
        client.query(
          'SELECT object_path, size_bytes, owner_id, file_name, folder_id FROM files WHERE id = $1',
          [fileId],
        ),
      );
      expect(row.rows[0]?.object_path).toBe('unitA/preserva-lote-1');
      expect(Number(row.rows[0]?.size_bytes)).toBe(321);
      expect(row.rows[0]?.owner_id).toBe(ids.userA);
      expect(row.rows[0]?.file_name).toBe('preservado-lote.txt');
      expect(row.rows[0]?.folder_id).toBe(destination.id);

      const user = await withSystemBypass(pool, (client) =>
        client.query('SELECT storage_used_bytes FROM users WHERE id = $1', [ids.userA]),
      );
      expect(Number(user.rows[0]?.storage_used_bytes)).toBe(321);

      const viewAfter = await request(app)
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', cookieSubject);
      expect(viewAfter.status).toBe(200);
    });
  });

  describe('POST /folders/move — pré-condição global (design.md D2)', () => {
    it('4.1: destino sem alcance e destino de outra unidade produzem a mesma recusa, nada move', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const cookieB = await sessionCookieFor(ports, ids.userB);
      const destinationOfB = await createFolder(app, cookieB, 'DestinoPastasDeB');
      const folderToMove = await createFolder(app, cookieA, 'PastaLoteDestinoRuim');

      const noAccess = await request(app)
        .post('/folders/move')
        .set('Cookie', cookieA)
        .send({ ids: [folderToMove.id], destinationFolderId: destinationOfB.id });
      expect(noAccess.status).toBe(403);

      const crossUnit = await request(app)
        .post('/folders/move')
        .set('Cookie', cookieA)
        .send({ ids: [folderToMove.id], destinationFolderId: ids.unitB });
      expect(crossUnit.status).toBe(403);
      expect(crossUnit.body).toEqual(noAccess.body);

      const row = await withSystemBypass(pool, (client) =>
        client.query('SELECT parent_id FROM folders WHERE id = $1', [folderToMove.id]),
      );
      expect(row.rows[0]?.parent_id).toBeNull();
    });
  });

  describe('POST /folders/move — veredito por item (design.md D2/D3)', () => {
    it('4.2: ciclo recusa só a pasta culpada, distinguível da colisão de nome', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const destination = await createFolder(app, cookieA, 'DestinoCicloEColisao');
      const okFolder = await createFolder(app, cookieA, 'PastaLoteOk');
      const cyclic = await createFolder(app, cookieA, 'PastaLoteCiclica');
      // Destino é descendente da própria pasta ciclica -> ciclo se movida pra lá.
      const cyclicChild = await createFolder(app, cookieA, 'FilhaCiclica', cyclic.id);
      // Homônima já viva no destino -> colisão de nome.
      const homonymSource = await createFolder(app, cookieA, 'DestinoCicloEColisaoHomonima');
      await createFolder(app, cookieA, 'Homonima', destination.id);
      const homonymToMove = await createFolder(app, cookieA, 'Homonima', homonymSource.id);

      const res = await request(app)
        .post('/folders/move')
        .set('Cookie', cookieA)
        .send({
          ids: [okFolder.id, cyclic.id, homonymToMove.id],
          destinationFolderId: destination.id,
        });

      expect(res.status).toBe(200);
      const results = res.body.results as { id: string; ok: boolean; error?: string }[];
      expect(results.find((r) => r.id === okFolder.id)).toEqual({ id: okFolder.id, ok: true });
      expect(results.find((r) => r.id === homonymToMove.id)).toEqual({
        id: homonymToMove.id,
        ok: false,
        error: 'folder_name_conflict',
      });

      // Ciclo de verdade: mover `cyclic` para dentro de `cyclicChild` (sua própria filha).
      const cycleRes = await request(app)
        .post('/folders/move')
        .set('Cookie', cookieA)
        .send({ ids: [okFolder.id, cyclic.id], destinationFolderId: cyclicChild.id });
      expect(cycleRes.status).toBe(200);
      const cycleResults = cycleRes.body.results as { id: string; ok: boolean; error?: string }[];
      expect(cycleResults.find((r) => r.id === cyclic.id)).toEqual({
        id: cyclic.id,
        ok: false,
        error: 'folder_cycle',
      });
      expect(cycleResults.find((r) => r.id === okFolder.id)?.ok).toBe(true);

      // `cyclic` já havia sido movida para `destination` no lote anterior —
      // a tentativa de ciclo acima não a move, então segue lá.
      const cyclicRow = await withSystemBypass(pool, (client) =>
        client.query('SELECT parent_id FROM folders WHERE id = $1', [cyclic.id]),
      );
      expect(cyclicRow.rows[0]?.parent_id).toBe(destination.id);
    });

    it('4.3: corrida detectada pela camada 2 derruba o lote de pastas inteiro, hierarquia intacta', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const p = await createFolder(app, cookieA, 'Camada2LoteP');
      const q = await createFolder(app, cookieA, 'Camada2LoteQ', p.id);
      const independent = await createFolder(app, cookieA, 'Camada2LoteIndependente');

      // Simula uma corrida: entre a verificação camada 1 e o commit, outra
      // transação já tornou p filha de q — a camada 2, ao fim do lote, deve
      // pegar isso e desfazer TODO o lote (mesmo o item independente).
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE folders SET parent_id = $1 WHERE id = $2', [q.id, p.id]),
      );

      const res = await request(app)
        .post('/folders/move')
        .set('Cookie', cookieA)
        .send({ ids: [independent.id, q.id], destinationFolderId: p.id });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'folder_cycle' });

      const rows = await withSystemBypass(pool, (client) =>
        client.query('SELECT id, parent_id FROM folders WHERE id = ANY($1::uuid[])', [
          [independent.id, q.id],
        ]),
      );
      const independentRow = rows.rows.find((r) => r.id === independent.id);
      const qRow = rows.rows.find((r) => r.id === q.id);
      expect(independentRow?.parent_id).toBeNull();
      expect(qRow?.parent_id).toBe(p.id);
    });

    it('4.4: mover pasta em lote não grava evento de auditoria, nem para arquivos das subárvores', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);

      const destination = await createFolder(app, cookieA, 'DestinoLoteSemAuditoria');
      const origin = await createFolder(app, cookieA, 'OrigemLoteSemAuditoria');
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        folderId: origin.id,
        objectPath: 'unitA/lote-sem-auditoria-1',
        fileName: 'dentro-lote.txt',
      });

      const res = await request(app)
        .post('/folders/move')
        .set('Cookie', cookieA)
        .send({ ids: [origin.id], destinationFolderId: destination.id });
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([{ id: origin.id, ok: true }]);

      const audit = await withSystemBypass(pool, (client) =>
        client.query('SELECT * FROM audit_events WHERE file_id = $1', [fileId]),
      );
      expect(audit.rows).toHaveLength(0);
    });
  });

  describe('Roteamento (design.md D1, Risks)', () => {
    it('5.1: POST /files/move e POST /folders/move resolvem para o lote, não para a rota por item', async () => {
      const app = createApp(ports);
      const cookieA = await sessionCookieFor(ports, ids.userA);
      const fileId = await createActiveFile({
        unitId: ids.unitA,
        ownerId: ids.userA,
        objectPath: 'unitA/roteamento-1',
        fileName: 'roteamento.txt',
      });
      const folder = await createFolder(app, cookieA, 'RoteamentoLote');

      // Se `/files/move` casasse com `/files/:id/move`, "move" seria tratado
      // como um id de arquivo inexistente — a rota por item devolveria 403,
      // não a validação de corpo 400 da rota de lote.
      const filesRes = await request(app)
        .post('/files/move')
        .set('Cookie', cookieA)
        .send({ ids: [fileId], destinationFolderId: null });
      expect(filesRes.status).toBe(200);
      expect(filesRes.body.results).toEqual([{ id: fileId, ok: true }]);

      const foldersRes = await request(app)
        .post('/folders/move')
        .set('Cookie', cookieA)
        .send({ ids: [folder.id], destinationFolderId: null });
      expect(foldersRes.status).toBe(200);
      expect(foldersRes.body.results).toEqual([{ id: folder.id, ok: true }]);

      // A rota por item continua respondendo normalmente, sem sombra do lote.
      const singleRes = await request(app)
        .post(`/files/${fileId}/move`)
        .set('Cookie', cookieA)
        .send({ destinationFolderId: null });
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.id).toBe(fileId);
    });
  });
});
