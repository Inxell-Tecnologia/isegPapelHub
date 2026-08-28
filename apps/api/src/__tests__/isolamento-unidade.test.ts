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
 * Épico 5 (US 5.1): ramo "admin da unidade do recurso" em `hasAccess` /
 * `visibleResourceClause` (design.md D1/D2/D3). Cobre as tarefas 3.1-3.4 do
 * tasks.md; a tarefa 3.5 (regressão dono-ou-grant do colaborador) já é
 * coberta por `permission.test.ts` e continua passando com esta mudança.
 */
describe('Épico 5: alcance administrativo por unidade', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let unitAdminAId: string;
  let userA2Id: string;
  let fileOwnedByUserAId: string;
  let fileOwnedByUserA2Id: string;
  let folderOwnedByUserAId: string;
  let fileInUnitBId: string;
  let folderInUnitBId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows: adminRows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES ($1, 'unit-admin-a@test.dev', 'x', 'unit_admin') RETURNING id`,
        [ids.unitA],
      ),
    );
    unitAdminAId = adminRows[0]!.id;

    const { rows: a2Rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES ($1, 'collab-a2-iso@test.dev', 'x', 'collaborator') RETURNING id`,
        [ids.unitA],
      ),
    );
    userA2Id = a2Rows[0]!.id;

    const { rows: folderRows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'Pasta userA') RETURNING id`,
        [ids.unitA, ids.userA],
      ),
    );
    folderOwnedByUserAId = folderRows[0]!.id;

    const { rows: fileRows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, status)
         VALUES ($1, $2, $3, 'unitA/admin-1', 'admin1.txt', 'active') RETURNING id`,
        [ids.unitA, ids.userA, folderOwnedByUserAId],
      ),
    );
    fileOwnedByUserAId = fileRows[0]!.id;

    // Segundo dono no mesmo diretório, sem grant algum sobre ele — prova que
    // o admin vê itens de "vários donos" (spec: cenário "Admin da unidade
    // lista todos os itens da unidade"), não só um item não-próprio isolado.
    const { rows: fileA2Rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, status)
         VALUES ($1, $2, $3, 'unitA/admin-2', 'admin2.txt', 'active') RETURNING id`,
        [ids.unitA, userA2Id, folderOwnedByUserAId],
      ),
    );
    fileOwnedByUserA2Id = fileA2Rows[0]!.id;

    const { rows: folderBRows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'Pasta userB') RETURNING id`,
        [ids.unitB, ids.userB],
      ),
    );
    folderInUnitBId = folderBRows[0]!.id;

    const { rows: fileBRows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status)
         VALUES ($1, $2, 'unitB/f1', 'b1.txt', 'active') RETURNING id`,
        [ids.unitB, ids.userB],
      ),
    );
    fileInUnitBId = fileBRows[0]!.id;

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

  it('3.1: unit_admin acessa, renomeia/substitui e lista conteúdo não-próprio da própria unidade, sem grant', async () => {
    const app = createApp(ports);
    const cookieAdminA = await sessionCookieFor(ports, unitAdminAId);

    const view = await request(app)
      .post(`/files/${fileOwnedByUserAId}/view-url`)
      .set('Cookie', cookieAdminA);
    expect(view.status).toBe(200);

    const download = await request(app)
      .post(`/files/${fileOwnedByUserAId}/download-url`)
      .set('Cookie', cookieAdminA);
    expect(download.status).toBe(200);

    const rename = await request(app)
      .patch(`/files/${fileOwnedByUserAId}`)
      .set('Cookie', cookieAdminA)
      .send({ fileName: 'renomeado-pelo-admin.txt' });
    expect(rename.status).toBe(200);
    expect(rename.body.fileName).toBe('renomeado-pelo-admin.txt');

    const replace = await request(app)
      .post(`/files/${fileOwnedByUserAId}/replace-url`)
      .set('Cookie', cookieAdminA)
      .send({ contentType: 'text/plain', declaredSizeBytes: 5 });
    expect(replace.status).toBe(200);

    // Segundo dono, sem grant: também acessível pelo ramo admin.
    const viewA2 = await request(app)
      .post(`/files/${fileOwnedByUserA2Id}/view-url`)
      .set('Cookie', cookieAdminA);
    expect(viewA2.status).toBe(200);

    const contents = await request(app)
      .get(`/folders/${folderOwnedByUserAId}/contents`)
      .set('Cookie', cookieAdminA);
    expect(contents.status).toBe(200);
    const fileNames = contents.body.files.map((f: { fileName: string }) => f.fileName);
    expect(fileNames).toContain('renomeado-pelo-admin.txt');
    expect(fileNames).toContain('admin2.txt');
  });

  it('3.2: unit_admin e collaborator recebem 403 ao tentar recurso de outra unidade, sem vazar existência', async () => {
    const app = createApp(ports);
    const cookieAdminA = await sessionCookieFor(ports, unitAdminAId);
    const cookieUserA = await sessionCookieFor(ports, ids.userA);

    const adminViewOtherUnit = await request(app)
      .post(`/files/${fileInUnitBId}/view-url`)
      .set('Cookie', cookieAdminA);
    expect(adminViewOtherUnit.status).toBe(403);
    expect(adminViewOtherUnit.body.error).toBe('forbidden');

    const collaboratorViewOtherUnit = await request(app)
      .post(`/files/${fileInUnitBId}/view-url`)
      .set('Cookie', cookieUserA);
    expect(collaboratorViewOtherUnit.status).toBe(403);

    const adminOpenOtherFolder = await request(app)
      .get(`/folders/${folderInUnitBId}/contents`)
      .set('Cookie', cookieAdminA);
    expect(adminOpenOtherFolder.status).toBe(403);
  });

  it('3.3: global_admin recebe 403 em view-url de arquivo de outra unidade (sem URL, sem auditoria), mas acessa a própria unidade', async () => {
    const app = createApp(ports);
    const storage = ports.storage as InMemoryStoragePort;
    const callsBefore = storage.calls.length;
    const cookieGlobalAdmin = await sessionCookieFor(ports, ids.globalAdmin);

    const crossUnit = await request(app)
      .post(`/files/${fileInUnitBId}/view-url`)
      .set('Cookie', cookieGlobalAdmin);
    expect(crossUnit.status).toBe(403);
    expect(storage.calls).toHaveLength(callsBefore);

    const audit = await withSystemBypass(pool, (client) =>
      client.query('SELECT * FROM audit_events WHERE file_id = $1', [fileInUnitBId]),
    );
    expect(audit.rows).toHaveLength(0);

    const ownUnit = await request(app)
      .post(`/files/${fileOwnedByUserAId}/view-url`)
      .set('Cookie', cookieGlobalAdmin);
    expect(ownUnit.status).toBe(200);
  });

  it('3.4: listagem do global_admin não traz itens de outra unidade (bypass travado na consulta)', async () => {
    const app = createApp(ports);
    const cookieGlobalAdmin = await sessionCookieFor(ports, ids.globalAdmin);

    const root = await request(app).get('/folders/root/contents').set('Cookie', cookieGlobalAdmin);
    expect(root.status).toBe(200);
    const folderNames = root.body.folders.map((f: { name: string }) => f.name);
    expect(folderNames).toContain('Pasta userA');
    expect(folderNames).not.toContain('Pasta userB');
  });

  it('3.5 (mover-e-renomear-itens, design.md D1): unit_admin e global_admin não movem/renomeiam pasta de outra unidade, mesmo bypassando RLS na listagem', async () => {
    const app = createApp(ports);
    const cookieAdminA = await sessionCookieFor(ports, unitAdminAId);
    const cookieGlobalAdmin = await sessionCookieFor(ports, ids.globalAdmin);

    const moveByUnitAdmin = await request(app)
      .post(`/folders/${folderInUnitBId}/move`)
      .set('Cookie', cookieAdminA)
      .send({ destinationFolderId: null });
    expect(moveByUnitAdmin.status).toBe(403);

    const moveByGlobalAdmin = await request(app)
      .post(`/folders/${folderInUnitBId}/move`)
      .set('Cookie', cookieGlobalAdmin)
      .send({ destinationFolderId: null });
    expect(moveByGlobalAdmin.status).toBe(403);

    const renameByGlobalAdmin = await request(app)
      .patch(`/folders/${folderInUnitBId}`)
      .set('Cookie', cookieGlobalAdmin)
      .send({ name: 'Tentativa Cross Unit' });
    expect(renameByGlobalAdmin.status).toBe(403);

    // canReorganize (design.md D1/D2) não abre exceção alguma pelo mesmo
    // bypass que a listagem trava explicitamente — só admin dentro da
    // própria unidade alcança.
    const row = await withSystemBypass(pool, (client) =>
      client.query('SELECT name, parent_id FROM folders WHERE id = $1', [folderInUnitBId]),
    );
    expect(row.rows[0]?.name).toBe('Pasta userB');
    expect(row.rows[0]?.parent_id).toBeNull();
  });
});
