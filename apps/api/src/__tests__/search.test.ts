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
import type { FileSummaryResponse } from '@gdoc/shared';

describe('Busca transversal de arquivos (routes/search.ts, GET /files/search, US 9.1)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let unitAdminAId: string;
  let userA2Id: string;

  async function insertFile(params: {
    unitId: string;
    ownerId: string;
    fileName: string;
    contentType?: string | null;
    createdAt?: string;
    deletedAt?: string;
    deletedBy?: string;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, content_type, status, created_at, deleted_at, deleted_by, trash_root_id)
         VALUES ($1, $2, $3, $4, $5, 'active', COALESCE($6::timestamptz, now()), $7::timestamptz, $8, (CASE WHEN $7::timestamptz IS NOT NULL THEN gen_random_uuid() ELSE NULL END))
         RETURNING id`,
        [
          params.unitId,
          params.ownerId,
          `search-test/${params.fileName}-${Math.random()}`,
          params.fileName,
          params.contentType ?? null,
          params.createdAt ?? null,
          params.deletedAt ?? null,
          params.deletedBy ?? null,
        ],
      ),
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'unit-admin-a@search.test', 'x', 'unit_admin'),
           ($1, 'collab-a2@search.test', 'x', 'collaborator')
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

  it('busca por nome parcial, insensível a caixa; sem correspondência devolve vazio', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'Relatorio-Financeiro-2024.pdf',
    });
    await insertFile({ unitId: ids.unitA, ownerId: ids.userA, fileName: 'outro-arquivo.txt' });

    const res = await request(app)
      .get('/files/search')
      .query({ q: 'financeiro' })
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const names = (res.body.files as FileSummaryResponse[]).map((f) => f.fileName);
    expect(names).toContain('Relatorio-Financeiro-2024.pdf');
    expect(names).not.toContain('outro-arquivo.txt');

    const empty = await request(app)
      .get('/files/search')
      .query({ q: 'nome-que-nao-existe-xyz' })
      .set('Cookie', cookie);
    expect(empty.status).toBe(200);
    expect(empty.body.files).toEqual([]);
  });

  it('filtro de tipo por categoria: um arquivo de cada categoria, MIME desconhecido/nulo cai em other', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);
    const tag = `cat-${Date.now()}`;

    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-img.png`,
      contentType: 'image/png',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-vid.mp4`,
      contentType: 'video/mp4',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-aud.mp3`,
      contentType: 'audio/mpeg',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-doc.pdf`,
      contentType: 'application/pdf',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-office.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-text.txt`,
      contentType: 'text/plain',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-unknown.bin`,
      contentType: 'application/x-unknown',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-null`,
      contentType: null,
    });

    const expectations: [string, string][] = [
      ['image', `${tag}-img.png`],
      ['video', `${tag}-vid.mp4`],
      ['audio', `${tag}-aud.mp3`],
      ['pdf', `${tag}-doc.pdf`],
      ['office', `${tag}-office.docx`],
      ['text', `${tag}-text.txt`],
    ];
    for (const [type, expectedName] of expectations) {
      const res = await request(app)
        .get('/files/search')
        .query({ q: tag, type })
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect((res.body.files as FileSummaryResponse[]).map((f) => f.fileName)).toEqual([
        expectedName,
      ]);
    }

    const other = await request(app)
      .get('/files/search')
      .query({ q: tag, type: 'other' })
      .set('Cookie', cookie);
    expect(other.status).toBe(200);
    const otherNames = (other.body.files as FileSummaryResponse[]).map((f) => f.fileName).sort();
    expect(otherNames).toEqual([`${tag}-null`, `${tag}-unknown.bin`].sort());
  });

  it('filtros combinados (AND): nome + tipo + autor + data restringem para a interseção', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);
    const tag = `combo-${Date.now()}`;

    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-match.pdf`,
      contentType: 'application/pdf',
      createdAt: '2024-06-15T12:00:00Z',
    });
    // Mesmo nome/tipo, mas de outro autor — não deve entrar no filtro de autor.
    await insertFile({
      unitId: ids.unitA,
      ownerId: userA2Id,
      fileName: `${tag}-match.pdf`,
      contentType: 'application/pdf',
      createdAt: '2024-06-15T12:00:00Z',
    });
    // Mesmo nome/autor, mas fora do intervalo de data.
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-match.pdf`,
      contentType: 'application/pdf',
      createdAt: '2024-01-01T00:00:00Z',
    });
    // Mesmo nome/autor/data, mas tipo diferente.
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-match.pdf`,
      contentType: 'image/png',
      createdAt: '2024-06-15T12:00:00Z',
    });

    const res = await request(app)
      .get('/files/search')
      .query({
        q: tag,
        type: 'pdf',
        author: ids.userA,
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      })
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    const files = res.body.files as FileSummaryResponse[];
    expect(files).toHaveLength(1);
    expect(files[0]!.ownerId).toBe(ids.userA);
    expect(files[0]!.contentType).toBe('application/pdf');
  });

  it('alcance de permissão: colaborador não acha arquivo de terceiro sem grant; acha com grant view; admin da unidade acha', async () => {
    const app = createApp(ports);
    const cookieOther = await sessionCookieFor(ports, userA2Id);
    const cookieAdmin = await sessionCookieFor(ports, unitAdminAId);
    const tag = `perm-${Date.now()}`;

    const fileId = await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-privado.txt`,
    });

    const beforeGrant = await request(app)
      .get('/files/search')
      .query({ q: tag })
      .set('Cookie', cookieOther);
    expect(beforeGrant.body.files).toEqual([]);

    const adminSearch = await request(app)
      .get('/files/search')
      .query({ q: tag })
      .set('Cookie', cookieAdmin);
    expect((adminSearch.body.files as FileSummaryResponse[]).map((f) => f.fileName)).toContain(
      `${tag}-privado.txt`,
    );

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

    const afterGrant = await request(app)
      .get('/files/search')
      .query({ q: tag })
      .set('Cookie', cookieOther);
    expect((afterGrant.body.files as FileSummaryResponse[]).map((f) => f.fileName)).toContain(
      `${tag}-privado.txt`,
    );
  });

  it('isolamento entre unidades: nome idêntico em outra unidade não aparece, mesmo para global_admin', async () => {
    const app = createApp(ports);
    const tag = `iso-${Date.now()}`;

    await insertFile({ unitId: ids.unitA, ownerId: ids.userA, fileName: `${tag}-igual.txt` });
    await insertFile({ unitId: ids.unitB, ownerId: ids.userB, fileName: `${tag}-igual.txt` });

    const resA = await request(app)
      .get('/files/search')
      .query({ q: tag })
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    expect((resA.body.files as FileSummaryResponse[]).map((f) => f.fileName)).toEqual([
      `${tag}-igual.txt`,
    ]);

    const resGlobal = await request(app)
      .get('/files/search')
      .query({ q: tag })
      .set('Cookie', await sessionCookieFor(ports, ids.globalAdmin));
    // global_admin do contexto está na unidade A (seedTwoUnits) — só 1 resultado, nunca os dois.
    expect(resGlobal.body.files).toHaveLength(1);
  });

  it('item na lixeira não aparece; busca sem filtros devolve todo o visível ordenado por created_at desc', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);
    const tag = `trash-order-${Date.now()}`;

    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-antigo`,
      createdAt: '2024-01-01T00:00:00Z',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-recente`,
      createdAt: '2024-12-01T00:00:00Z',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: `${tag}-excluido`,
      createdAt: '2024-06-01T00:00:00Z',
      deletedAt: '2024-06-02T00:00:00Z',
      deletedBy: ids.userA,
    });

    const res = await request(app).get('/files/search').query({ q: tag }).set('Cookie', cookie);
    expect(res.status).toBe(200);
    const names = (res.body.files as FileSummaryResponse[]).map((f) => f.fileName);
    expect(names).not.toContain(`${tag}-excluido`);
    expect(names).toEqual([`${tag}-recente`, `${tag}-antigo`]);
  });

  it('entrada malformada é recusada com 400, sem executar a busca', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    const badType = await request(app)
      .get('/files/search')
      .query({ type: 'not-a-category' })
      .set('Cookie', cookie);
    expect(badType.status).toBe(400);

    const badAuthor = await request(app)
      .get('/files/search')
      .query({ author: 'not-a-uuid' })
      .set('Cookie', cookie);
    expect(badAuthor.status).toBe(400);

    const badDate = await request(app)
      .get('/files/search')
      .query({ dateFrom: 'not-a-date' })
      .set('Cookie', cookie);
    expect(badDate.status).toBe(400);
  });
});
