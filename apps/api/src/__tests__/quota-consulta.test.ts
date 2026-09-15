import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

/**
 * `GET /files/quota` — consulta do espaço do **próprio** solicitante
 * (change `envio-multiplas-pastas-com-prechecagem`, spec `envio-lote`,
 * design.md D2). Os invariantes verificados aqui são os que o design
 * declara como deliberados: o retido na lixeira é explicação e não desconto,
 * o pendente é desconto, e não existe superfície para consultar terceiro.
 */
describe('Consulta do espaço de armazenamento do próprio solicitante', () => {
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

  beforeEach(async () => {
    await withSystemBypass(pool, async (client) => {
      await client.query('DELETE FROM files');
      await client.query('UPDATE users SET storage_used_bytes = 0');
    });
  });

  async function insertFile(
    fields: {
      unitId: string;
      ownerId: string;
      sizeBytes: number;
      status?: string;
      deletedAt?: string | null;
    },
    nome = `arq-${Math.random().toString(36).slice(2)}.txt`,
  ) {
    await withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, content_type, size_bytes, status, deleted_at)
         VALUES ($1, $2, $3, $4, 'text/plain', $5, $6, $7) RETURNING id`,
        [
          fields.unitId,
          fields.ownerId,
          `path/${nome}`,
          nome,
          fields.sizeBytes,
          fields.status ?? 'active',
          fields.deletedAt ?? null,
        ],
      );
      if (fields.deletedAt) {
        await client.query('UPDATE files SET trash_root_id = id WHERE id = $1', [rows[0]!.id]);
      }
    });
  }

  async function setUsage(userId: string, bytes: number) {
    await withSystemBypass(pool, async (client) => {
      await client.query('UPDATE users SET storage_used_bytes = $1 WHERE id = $2', [bytes, userId]);
    });
  }

  it('devolve a decomposição do espaço da própria pessoa (tasks 2.1)', async () => {
    await setUsage(ids.userA, 3000);
    const app = createApp(ports);

    const res = await request(app)
      .get('/files/quota')
      .set('Cookie', await sessionCookieFor(ports, ids.userA));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      quotaBytes: config.storageQuotaBytesPerUser,
      usedBytes: 3000,
      trashedBytes: 0,
      trashedFiles: 0,
      pendingBytes: 0,
      availableBytes: config.storageQuotaBytesPerUser - 3000,
    });
  });

  it('arquivo na lixeira aparece como retido e NÃO aumenta o disponível (tasks 2.2)', async () => {
    // O expurgo é que decrementa `storage_used_bytes` (job purge-trash, 30
    // dias): até lá o arquivo na lixeira continua dentro do usado.
    await setUsage(ids.userA, 5000);
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      sizeBytes: 2000,
      deletedAt: new Date().toISOString(),
    });

    const app = createApp(ports);
    const res = await request(app)
      .get('/files/quota')
      .set('Cookie', await sessionCookieFor(ports, ids.userA));

    expect(res.status).toBe(200);
    expect(res.body.trashedBytes).toBe(2000);
    // O par de contagem, que a confirmação do expurgo sob demanda usa (change
    // `esvaziar-lixeira`, design.md D4).
    expect(res.body.trashedFiles).toBe(1);
    expect(res.body.usedBytes).toBe(5000);
    // O ponto do teste: 2000 não é subtraído duas vezes.
    expect(res.body.availableBytes).toBe(config.storageQuotaBytesPerUser - 5000);
  });

  it('envio pendente é descontado do disponível (tasks 2.3)', async () => {
    await setUsage(ids.userA, 1000);
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      sizeBytes: 700,
      status: 'pending',
    });
    await insertFile({
      unitId: ids.unitA,
      ownerId: ids.userA,
      sizeBytes: 300,
      status: 'replacing',
    });

    const app = createApp(ports);
    const res = await request(app)
      .get('/files/quota')
      .set('Cookie', await sessionCookieFor(ports, ids.userA));

    expect(res.body.pendingBytes).toBe(1000);
    expect(res.body.availableBytes).toBe(config.storageQuotaBytesPerUser - 1000 - 1000);
  });

  it('não há como consultar o espaço de outra pessoa, nem por parâmetro (tasks 2.1)', async () => {
    await setUsage(ids.userA, 4242);
    await setUsage(ids.userB, 999_999);

    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    // Query string com identificador de terceiro é simplesmente ignorada:
    // a identidade vem só de `ctx.userId`.
    const comParametro = await request(app)
      .get(`/files/quota?userId=${ids.userB}`)
      .set('Cookie', cookie);
    expect(comParametro.status).toBe(200);
    expect(comParametro.body.usedBytes).toBe(4242);

    // E não existe rota por caminho para pessoa alguma.
    const porCaminho = await request(app).get(`/files/quota/${ids.userB}`).set('Cookie', cookie);
    expect(porCaminho.status).toBe(404);
  });

  it('admin global recebe a própria cota, sem bypass e sem agregado de unidade (tasks 2.4)', async () => {
    await setUsage(ids.globalAdmin, 11);
    await setUsage(ids.userA, 7_000_000);
    await insertFile({ unitId: ids.unitA, ownerId: ids.userA, sizeBytes: 500, status: 'pending' });

    const app = createApp(ports);
    const res = await request(app)
      .get('/files/quota')
      .set('Cookie', await sessionCookieFor(ports, ids.globalAdmin));

    expect(res.status).toBe(200);
    expect(res.body.usedBytes).toBe(11);
    expect(res.body.pendingBytes).toBe(0);
    expect(res.body.trashedBytes).toBe(0);
  });

  it('sem sessão, a consulta é recusada (fail-closed)', async () => {
    const app = createApp(ports);
    const res = await request(app).get('/files/quota');
    expect(res.status).toBe(401);
  });
});
