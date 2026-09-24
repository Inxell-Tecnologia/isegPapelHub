import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { config } from '../config.js';

/**
 * Cota individual por pessoa (change `cota-por-usuario`, spec
 * `cota-individual`). Os invariantes aqui são os que o design declara como
 * deliberados: `NULL` é "segue o padrão da plataforma" e não "sem cota"; a
 * exceção prevalece sem alcançar mais ninguém; a concessão é exclusiva do
 * `global_admin` e a recusa é total; e rebaixar abaixo do consumo bloqueia
 * escrita sem apagar nada.
 */
describe('Cota individual por pessoa', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let unitAdminA: string;

  const PADRAO = config.storageQuotaBytesPerUser;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    unitAdminA = await withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role)
         VALUES ($1, 'admin-unidade-a@test.dev', 'x', 'unit_admin') RETURNING id`,
        [ids.unitA],
      );
      return rows[0]!.id;
    });

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
      await client.query('UPDATE users SET storage_used_bytes = 0, storage_quota_bytes = NULL');
    });
  });

  async function setQuota(userId: string, bytes: number | null) {
    await withSystemBypass(pool, async (client) => {
      await client.query('UPDATE users SET storage_quota_bytes = $1 WHERE id = $2', [
        bytes,
        userId,
      ]);
    });
  }

  async function setUsage(userId: string, bytes: number) {
    await withSystemBypass(pool, async (client) => {
      await client.query('UPDATE users SET storage_used_bytes = $1 WHERE id = $2', [bytes, userId]);
    });
  }

  async function quotaDe(userId: string) {
    const res = await request(createApp(ports))
      .get('/files/quota')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body as { quotaBytes: number; availableBytes: number };
  }

  describe('Resolução da cota efetiva', () => {
    it('pessoa sem exceção segue o padrão da plataforma', async () => {
      expect((await quotaDe(ids.userA)).quotaBytes).toBe(PADRAO);
    });

    it('exceção nominal prevalece sobre o padrão, sem alcançar mais ninguém', async () => {
      const excecao = PADRAO * 30;
      await setQuota(ids.userA, excecao);

      expect((await quotaDe(ids.userA)).quotaBytes).toBe(excecao);
      // A pessoa de outra unidade, sem exceção, continua no padrão.
      expect((await quotaDe(ids.userB)).quotaBytes).toBe(PADRAO);
    });

    it('cota zero é exceção válida e zera o disponível', async () => {
      await setQuota(ids.userA, 0);
      const body = await quotaDe(ids.userA);
      expect(body.quotaBytes).toBe(0);
      expect(body.availableBytes).toBe(0);
    });

    it('mudança do padrão alcança quem está em NULL e não quem tem exceção', async () => {
      const excecao = PADRAO * 30;
      await setQuota(ids.userA, excecao);
      const original = config.storageQuotaBytesPerUser;
      try {
        config.storageQuotaBytesPerUser = 12345;
        expect((await quotaDe(ids.userB)).quotaBytes).toBe(12345);
        expect((await quotaDe(ids.userA)).quotaBytes).toBe(excecao);
      } finally {
        config.storageQuotaBytesPerUser = original;
      }
    });
  });

  describe('Envio governado pela cota efetiva', () => {
    async function pedirUrl(userId: string, declaredSizeBytes: number) {
      return request(createApp(ports))
        .post('/files/upload-url')
        .set('Cookie', await sessionCookieFor(ports, userId))
        .send({
          fileName: 'grande.bin',
          contentType: 'application/octet-stream',
          declaredSizeBytes,
        });
    }

    it('autoriza envio acima do padrão quando cabe na exceção nominal', async () => {
      await setQuota(ids.userA, PADRAO * 30);
      const res = await pedirUrl(ids.userA, PADRAO + 1);
      expect(res.status).toBe(200);
    });

    it('recusa o mesmo envio para quem segue o padrão', async () => {
      const res = await pedirUrl(ids.userB, PADRAO + 1);
      expect(res.status).toBe(400);
    });

    it('recusa envio enquanto o uso exceder a cota efetiva', async () => {
      await setQuota(ids.userA, 1000);
      await setUsage(ids.userA, 5000);
      const res = await pedirUrl(ids.userA, 1);
      expect(res.status).toBe(400);
    });

    it('lote usa a cota efetiva de quem envia', async () => {
      await setQuota(ids.userA, PADRAO * 30);
      const res = await request(createApp(ports))
        .post('/files/upload-urls')
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({
          items: [
            {
              fileName: 'a.bin',
              contentType: 'application/octet-stream',
              declaredSizeBytes: PADRAO,
            },
            {
              fileName: 'b.bin',
              contentType: 'application/octet-stream',
              declaredSizeBytes: PADRAO,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results.every((item: { ok: boolean }) => item.ok)).toBe(true);
    });
  });

  describe('Concessão restrita ao global_admin', () => {
    async function patch(atorId: string, alvoId: string, body: unknown) {
      return request(createApp(ports))
        .patch(`/users/${alvoId}`)
        .set('Cookie', await sessionCookieFor(ports, atorId))
        .send(body as object);
    }

    async function cotaGravada(userId: string) {
      return withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ storage_quota_bytes: string | null }>(
          'SELECT storage_quota_bytes FROM users WHERE id = $1',
          [userId],
        );
        const raw = rows[0]?.storage_quota_bytes;
        return raw === null || raw === undefined ? null : Number(raw);
      });
    }

    it('global_admin concede a exceção e a resposta a reflete', async () => {
      const res = await patch(ids.globalAdmin, ids.userA, { storageQuotaBytes: 999_000 });
      expect(res.status).toBe(200);
      expect(res.body.storageQuotaBytes).toBe(999_000);
      expect(await cotaGravada(ids.userA)).toBe(999_000);
    });

    it('null remove a exceção e devolve a pessoa ao padrão', async () => {
      await setQuota(ids.userA, 999_000);
      const res = await patch(ids.globalAdmin, ids.userA, { storageQuotaBytes: null });
      expect(res.status).toBe(200);
      expect(res.body.storageQuotaBytes).toBeNull();
      expect((await quotaDe(ids.userA)).quotaBytes).toBe(PADRAO);
    });

    it('campo ausente preserva a cota vigente', async () => {
      await setQuota(ids.userA, 777_000);
      const res = await patch(ids.globalAdmin, ids.userA, { fullName: 'Nome Novo' });
      expect(res.status).toBe(200);
      expect(await cotaGravada(ids.userA)).toBe(777_000);
    });

    it('unit_admin é recusado e NENHUM campo da mesma requisição é aplicado', async () => {
      await withSystemBypass(pool, async (client) => {
        await client.query(`UPDATE users SET full_name = 'Nome Original' WHERE id = $1`, [
          ids.userA,
        ]);
      });

      const res = await patch(unitAdminA, ids.userA, {
        fullName: 'Nome Que Nao Deve Passar',
        storageQuotaBytes: 999_000,
      });

      expect(res.status).toBe(403);
      expect(await cotaGravada(ids.userA)).toBeNull();
      const nome = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ full_name: string | null }>(
          'SELECT full_name FROM users WHERE id = $1',
          [ids.userA],
        );
        return rows[0]?.full_name;
      });
      expect(nome).toBe('Nome Original');
    });

    it('colaborador não altera a própria cota', async () => {
      const res = await patch(ids.userA, ids.userA, { storageQuotaBytes: 999_000 });
      expect(res.status).toBe(403);
      expect(await cotaGravada(ids.userA)).toBeNull();
    });

    it('valor negativo e não inteiro são recusados sem efeito', async () => {
      for (const invalido of [-1, 1.5, 'muito']) {
        const res = await patch(ids.globalAdmin, ids.userA, { storageQuotaBytes: invalido });
        expect(res.status).toBe(400);
      }
      expect(await cotaGravada(ids.userA)).toBeNull();
    });

    it('cota e consumo de terceiro não vazam entre unidades (spec: exceção de terceiro não vaza)', async () => {
      await setQuota(ids.userB, 999_000);
      await setUsage(ids.userB, 4242);

      const res = await request(createApp(ports))
        .get('/users')
        .set('Cookie', await sessionCookieFor(ports, unitAdminA));

      expect(res.status).toBe(200);
      const ids_vistos = (res.body as { id: string }[]).map((p) => p.id);
      expect(ids_vistos).toContain(ids.userA);
      expect(ids_vistos).not.toContain(ids.userB);
      // e o que ele vê traz os campos novos, sob o alcance que a RLS impôs
      const visto = (res.body as { id: string; storageUsedBytes: number }[]).find(
        (p) => p.id === ids.userA,
      );
      expect(visto?.storageUsedBytes).toBe(0);
    });

    it('a resposta de pessoa expõe o volume utilizado', async () => {
      await setUsage(ids.userA, 4242);
      const res = await patch(ids.globalAdmin, ids.userA, { fullName: 'Com Consumo' });
      expect(res.status).toBe(200);
      expect(res.body.storageUsedBytes).toBe(4242);
    });
  });

  describe('Painel agrega as cotas efetivas', () => {
    it('capacidade soma exceção nominal em vez de multiplicar o padrão', async () => {
      const excecao = PADRAO * 30;
      await setQuota(ids.userA, excecao);

      const res = await request(createApp(ports))
        .get('/dashboard')
        .set('Cookie', await sessionCookieFor(ports, ids.globalAdmin));

      expect(res.status).toBe(200);
      const { storage } = res.body;
      // Capacidade = exceção de A + padrão para cada uma das demais pessoas.
      expect(storage.capacityBytes).toBe(excecao + PADRAO * (storage.userCount - 1));
      expect(storage.quotaBytesPerUser).toBe(PADRAO);
    });
  });

  describe('Rebaixar a cota bloqueia escrita sem destruir dado', () => {
    it('substituição é recusada mesmo por arquivo menor quando o uso excede a cota', async () => {
      const fileId = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, content_type, size_bytes, status)
           VALUES ($1, $2, 'p/antigo.bin', 'antigo.bin', 'application/octet-stream', 5000, 'active')
           RETURNING id`,
          [ids.unitA, ids.userA],
        );
        return rows[0]!.id;
      });
      // O uso total inclui MUITO mais que este arquivo: é isso que mantém a
      // projeção (`uso − antigo + novo`) acima da cota mesmo trocando por um
      // arquivo menor. Se este fosse o único arquivo da pessoa, a troca por um
      // menor baixaria a projeção e seria — corretamente — aceita.
      await setUsage(ids.userA, 100_000);
      await setQuota(ids.userA, 1000);

      const res = await request(createApp(ports))
        .post(`/files/${fileId}/replace-url`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({ contentType: 'application/octet-stream', declaredSizeBytes: 10 });

      expect(res.status).toBe(400);

      // Nada foi apagado: o arquivo continua íntegro e consultável.
      const aindaExiste = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query('SELECT id FROM files WHERE id = $1', [fileId]);
        return rows.length;
      });
      expect(aindaExiste).toBe(1);
    });

    it('elevar a cota de volta devolve a capacidade de envio na requisição seguinte', async () => {
      await setUsage(ids.userA, 5000);
      await setQuota(ids.userA, 1000);

      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, ids.userA);
      const corpo = {
        fileName: 'novo.bin',
        contentType: 'application/octet-stream',
        declaredSizeBytes: 10,
      };

      expect(
        (await request(app).post('/files/upload-url').set('Cookie', cookie).send(corpo)).status,
      ).toBe(400);

      await setQuota(ids.userA, 1_000_000);

      expect(
        (await request(app).post('/files/upload-url').set('Cookie', cookie).send(corpo)).status,
      ).toBe(200);
    });
  });

  describe('Reconciliação do finalize usa a cota do dono', () => {
    it('não marca over_quota quando o dono tem exceção que comporta o objeto', async () => {
      await setQuota(ids.userA, PADRAO * 30);
      const objectPath = `${ids.unitA}/${ids.userA}/obj-excecao.bin`;
      await withSystemBypass(pool, async (client) => {
        await client.query(
          `INSERT INTO files (unit_id, owner_id, object_path, file_name, content_type, size_bytes, status)
           VALUES ($1, $2, $3, 'obj-excecao.bin', 'application/octet-stream', $4, 'pending')`,
          [ids.unitA, ids.userA, objectPath, PADRAO + 1],
        );
      });

      const res = await request(createApp(ports))
        .post('/internal/storage-events')
        .send({ bucket: 'test-bucket', objectPath, sizeBytes: PADRAO + 1 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });
  });

  it('papel do ator é lido do banco, não do corpo da requisição', async () => {
    const res = await request(createApp(ports))
      .patch(`/users/${ids.userA}`)
      .set('Cookie', await sessionCookieFor(ports, unitAdminA))
      .send({ role: UserRole.GLOBAL_ADMIN, storageQuotaBytes: 999_000 });

    expect(res.status).toBe(403);
  });
});
