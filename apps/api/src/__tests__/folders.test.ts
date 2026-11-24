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

interface FolderBody {
  id: string;
  parentId: string | null;
  name: string;
}

describe('Navegação: pastas aninhadas, trilha e visibilidade só-por-dono', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let userA2Id: string;

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
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  it('cria pasta na raiz, vinculada à unidade e ao criador como dono', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/folders')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({ name: 'Contratos' });

    expect(res.status).toBe(201);
    expect(res.body.parentId).toBeNull();
    expect(res.body.ownerId).toBe(ids.userA);
    expect(res.body.unitId).toBe(ids.unitA);
  });

  it('cria subpasta dentro de pasta própria, preservando o aninhamento, e a trilha reflete o caminho', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    const parent = await request(app)
      .post('/folders')
      .set('Cookie', cookie)
      .send({ name: 'Financeiro' });
    expect(parent.status).toBe(201);

    const child = await request(app)
      .post('/folders')
      .set('Cookie', cookie)
      .send({ name: 'Notas Fiscais', parentId: (parent.body as FolderBody).id });
    expect(child.status).toBe(201);
    expect((child.body as FolderBody).parentId).toBe((parent.body as FolderBody).id);

    const contents = await request(app)
      .get(`/folders/${(child.body as FolderBody).id}/contents`)
      .set('Cookie', cookie);
    expect(contents.status).toBe(200);
    expect(contents.body.folder.id).toBe((child.body as FolderBody).id);
    expect(contents.body.breadcrumb.map((f: FolderBody) => f.id)).toEqual([
      (parent.body as FolderBody).id,
    ]);
  });

  it('raiz devolve trilha (breadcrumb) vazia', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .get('/folders/root/contents')
      .set('Cookie', await sessionCookieFor(ports, ids.userA));

    expect(res.status).toBe(200);
    expect(res.body.folder).toBeNull();
    expect(res.body.breadcrumb).toEqual([]);
  });

  it('pasta-pai de outra unidade não é utilizável: nenhuma pasta é criada, sem vazar a existência', async () => {
    const app = createApp(ports);
    const folderInB = await request(app)
      .post('/folders')
      .set('Cookie', await sessionCookieFor(ports, ids.userB))
      .send({ name: 'Pasta B' });
    expect(folderInB.status).toBe(201);
    const folderBId = (folderInB.body as FolderBody).id;

    const attempt = await request(app)
      .post('/folders')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({ name: 'Tentativa Cross Unit', parentId: folderBId });
    // 403 (não 404): pai negado sem revelar que a pasta existe.
    expect(attempt.status).toBe(403);

    const created = await withSystemBypass(pool, (client) =>
      client.query('SELECT 1 FROM folders WHERE name = $1', ['Tentativa Cross Unit']),
    );
    expect(created.rows).toHaveLength(0);
  });

  it('RLS: usuário da unidade A não enxerga/usa pasta da unidade B nem por id direto', async () => {
    const app = createApp(ports);
    const folderInB = await request(app)
      .post('/folders')
      .set('Cookie', await sessionCookieFor(ports, ids.userB))
      .send({ name: 'Pasta B Direta' });
    const folderBId = (folderInB.body as FolderBody).id;

    const res = await request(app)
      .get(`/folders/${folderBId}/contents`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    // Pasta de outra unidade e pasta sem `view` resolvem igual: 403, sem
    // distinguir de "não existe" (fail-closed, não vaza existência).
    expect(res.status).toBe(403);
  });

  it('visibilidade próprio-ou-liberado: pasta com arquivos de dois donos lista só os do solicitante', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const cookieA2 = await sessionCookieFor(ports, userA2Id);
    const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);

    const shared = await request(app)
      .post('/folders')
      .set('Cookie', cookieA)
      .send({ name: 'Pasta Compartilhada' });
    const sharedFolderId = (shared.body as FolderBody).id;

    const uploadA = await request(app).post('/files/upload-url').set('Cookie', cookieA).send({
      fileName: 'meu.txt',
      contentType: 'text/plain',
      declaredSizeBytes: 5,
      folderId: sharedFolderId,
      documentControl: controleDeTeste(),
    });
    expect(uploadA.status).toBe(200);

    // Épico 4: enviar para pasta de outra pessoa exige grant `upload` sobre ela.
    const grant = await request(app)
      .post('/grants')
      .set('Cookie', cookieAdmin)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'folder',
        resourceId: sharedFolderId,
        permissions: ['upload'],
      });
    expect(grant.status).toBe(201);

    const uploadA2 = await request(app).post('/files/upload-url').set('Cookie', cookieA2).send({
      fileName: 'dele.txt',
      contentType: 'text/plain',
      declaredSizeBytes: 5,
      folderId: sharedFolderId,
      documentControl: controleDeTeste(),
    });
    expect(uploadA2.status).toBe(200);

    const contents = await request(app)
      .get(`/folders/${sharedFolderId}/contents`)
      .set('Cookie', cookieA);
    expect(contents.status).toBe(200);
    const fileNames = contents.body.files.map((f: { fileName: string }) => f.fileName);
    expect(fileNames).toContain('meu.txt');
    expect(fileNames).not.toContain('dele.txt');
  });

  // Veredito de `upload` resolvido pelo servidor (change
  // `identidade-visual-isetes`, design.md D10). A SPA não infere permissão no
  // cliente — a capability `web-navegacao` proíbe —, então é a resposta de
  // conteúdo que carrega o veredito. O caso decisivo é o terceiro: quem tem a
  // concessão `upload` sobre pasta de outra pessoa não é dono nem admin, e
  // ficaria sem a ação se o cliente tentasse derivá-la do DTO.
  it('a resposta de conteúdo informa o veredito de upload resolvido pelo servidor', async () => {
    const app = createApp(ports);
    const cookieA = await sessionCookieFor(ports, ids.userA);
    const cookieA2 = await sessionCookieFor(ports, userA2Id);
    const cookieAdmin = await sessionCookieFor(ports, ids.globalAdmin);

    const minhaPasta = await request(app)
      .post('/folders')
      .set('Cookie', cookieA)
      .send({ name: 'Pasta do Veredito' });
    const pastaId = (minhaPasta.body as FolderBody).id;

    // Raiz da unidade: não é recurso concedível, enviar é livre.
    const raiz = await request(app).get('/folders/root/contents').set('Cookie', cookieA2);
    expect(raiz.status).toBe(200);
    expect(raiz.body.canUpload).toBe(true);

    // Dono da pasta: pode enviar.
    const comoDono = await request(app).get(`/folders/${pastaId}/contents`).set('Cookie', cookieA);
    expect(comoDono.status).toBe(200);
    expect(comoDono.body.canUpload).toBe(true);

    // Outra pessoa da unidade, com `view` mas sem `upload`: enxerga a pasta e
    // **não** pode enviar.
    const viewGrant = await request(app)
      .post('/grants')
      .set('Cookie', cookieAdmin)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'folder',
        resourceId: pastaId,
        permissions: ['view'],
      });
    expect(viewGrant.status).toBe(201);

    const soView = await request(app).get(`/folders/${pastaId}/contents`).set('Cookie', cookieA2);
    expect(soView.status).toBe(200);
    expect(soView.body.canUpload).toBe(false);

    // A mesma pessoa, agora com a concessão `upload`: o veredito vira `true`
    // sem que ela seja dona nem admin da unidade.
    const uploadGrant = await request(app)
      .post('/grants')
      .set('Cookie', cookieAdmin)
      .send({
        subjectUserIds: [userA2Id],
        resourceType: 'folder',
        resourceId: pastaId,
        permissions: ['upload'],
      });
    expect(uploadGrant.status).toBe(201);

    const comUpload = await request(app)
      .get(`/folders/${pastaId}/contents`)
      .set('Cookie', cookieA2);
    expect(comUpload.status).toBe(200);
    expect(comUpload.body.canUpload).toBe(true);
  });

  it('conteúdo de outra unidade nunca aparece, mesmo por identificador direto de pasta', async () => {
    const app = createApp(ports);
    const folderInB = await request(app)
      .post('/folders')
      .set('Cookie', await sessionCookieFor(ports, ids.userB))
      .send({ name: 'Pasta B Isolada' });
    const folderBId = (folderInB.body as FolderBody).id;

    await request(app)
      .post('/files/upload-url')
      .set('Cookie', await sessionCookieFor(ports, ids.userB))
      .send({
        fileName: 'b.txt',
        contentType: 'text/plain',
        declaredSizeBytes: 5,
        folderId: folderBId,
        documentControl: controleDeTeste(),
      });

    const root = await request(app)
      .get('/folders/root/contents')
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    expect(root.body.folders.map((f: FolderBody) => f.id)).not.toContain(folderBId);

    const direct = await request(app)
      .get(`/folders/${folderBId}/contents`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    // 403 (não 404): acesso negado sem revelar que a pasta existe.
    expect(direct.status).toBe(403);
  });

  it('upload com folderId coloca o arquivo na pasta; sem folderId cai na raiz', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    const folder = await request(app)
      .post('/folders')
      .set('Cookie', cookie)
      .send({ name: 'Destino' });
    const folderId = (folder.body as FolderBody).id;

    await request(app).post('/files/upload-url').set('Cookie', cookie).send({
      fileName: 'na-pasta.txt',
      contentType: 'text/plain',
      declaredSizeBytes: 5,
      folderId,
      documentControl: controleDeTeste(),
    });

    await request(app).post('/files/upload-url').set('Cookie', cookie).send({
      fileName: 'na-raiz.txt',
      contentType: 'text/plain',
      declaredSizeBytes: 5,
      documentControl: controleDeTeste(),
    });

    const folderContents = await request(app)
      .get(`/folders/${folderId}/contents`)
      .set('Cookie', cookie);
    expect(folderContents.body.files.map((f: { fileName: string }) => f.fileName)).toContain(
      'na-pasta.txt',
    );

    const rootContents = await request(app).get('/folders/root/contents').set('Cookie', cookie);
    expect(rootContents.body.files.map((f: { fileName: string }) => f.fileName)).toContain(
      'na-raiz.txt',
    );
    expect(rootContents.body.files.map((f: { fileName: string }) => f.fileName)).not.toContain(
      'na-pasta.txt',
    );
  });
});
