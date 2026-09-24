import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { PersonStatus, UserRole } from '@gdoc/shared';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase, seedTwoUnits, withSystemBypass, sessionCookieFor } from './test-db.js';
import type { Ports } from '../ports/index.js';

/**
 * Alcance da edição entre administradores globais (change
 * `edicao-entre-admins-globais`, spec `gestao-pessoas`).
 *
 * O invariante central deste arquivo é a **separação** dos dois alcances: a
 * edição passa a alcançar `global_admin`, e a redefinição de senha **não** —
 * são regras diferentes, e um teste que só olhasse a edição deixaria passar o
 * dia em que alguém reunisse as duas de novo numa função só.
 */
describe('Edição entre administradores globais', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let outroGlobalAdmin: string;
  let unitAdminA: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const extras = await withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{ id: string; role: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name) VALUES
           ($1, 'admin-global-2@test.dev', 'x', 'global_admin', 'Segundo Global'),
           ($1, 'admin-unidade-a@test.dev', 'x', 'unit_admin', 'Admin A')
         RETURNING id, role`,
        [ids.unitA],
      );
      return rows;
    });
    outroGlobalAdmin = extras[0]!.id;
    unitAdminA = extras[1]!.id;

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
      await client.query(
        `UPDATE users SET status = 'active', storage_quota_bytes = NULL,
                          full_name = 'Nome Original'
          WHERE id = ANY($1::uuid[])`,
        [[ids.globalAdmin, outroGlobalAdmin, unitAdminA, ids.userA]],
      );
      await client.query(`UPDATE users SET role = 'global_admin' WHERE id = ANY($1::uuid[])`, [
        [ids.globalAdmin, outroGlobalAdmin],
      ]);
      await client.query(`UPDATE users SET role = 'unit_admin' WHERE id = $1`, [unitAdminA]);
    });
  });

  function patch(atorId: string, alvoId: string, body: unknown) {
    return sessionCookieFor(ports, atorId).then((cookie) =>
      request(createApp(ports))
        .patch(`/users/${alvoId}`)
        .set('Cookie', cookie)
        .send(body as object),
    );
  }

  async function ler(userId: string) {
    return withSystemBypass(pool, async (client) => {
      const { rows } = await client.query<{
        full_name: string | null;
        role: string;
        status: string;
        storage_quota_bytes: string | null;
      }>('SELECT full_name, role, status, storage_quota_bytes FROM users WHERE id = $1', [userId]);
      return rows[0]!;
    });
  }

  describe('Alcance da edição', () => {
    it('global_admin edita outro global_admin (era 403 antes do change)', async () => {
      const res = await patch(ids.globalAdmin, outroGlobalAdmin, { fullName: 'Nome Alterado' });
      expect(res.status).toBe(200);
      expect((await ler(outroGlobalAdmin)).full_name).toBe('Nome Alterado');
    });

    it('global_admin edita os próprios dados', async () => {
      const res = await patch(ids.globalAdmin, ids.globalAdmin, { fullName: 'Eu Mesmo' });
      expect(res.status).toBe(200);
      expect((await ler(ids.globalAdmin)).full_name).toBe('Eu Mesmo');
    });

    it('global_admin concede cota individual a outro global_admin — o caso que originou o change', async () => {
      const res = await patch(ids.globalAdmin, outroGlobalAdmin, {
        storageQuotaBytes: 300 * 1024 ** 3,
      });
      expect(res.status).toBe(200);
      expect(Number((await ler(outroGlobalAdmin)).storage_quota_bytes)).toBe(300 * 1024 ** 3);
    });

    it('global_admin concede cota individual a si mesmo', async () => {
      const res = await patch(ids.globalAdmin, ids.globalAdmin, {
        storageQuotaBytes: 200 * 1024 ** 3,
      });
      expect(res.status).toBe(200);
      expect(Number((await ler(ids.globalAdmin)).storage_quota_bytes)).toBe(200 * 1024 ** 3);
    });

    it('global_admin pode rebaixar e desativar OUTRO global_admin', async () => {
      expect(
        (await patch(ids.globalAdmin, outroGlobalAdmin, { role: UserRole.UNIT_ADMIN })).status,
      ).toBe(200);
      expect((await ler(outroGlobalAdmin)).role).toBe(UserRole.UNIT_ADMIN);

      expect(
        (await patch(ids.globalAdmin, outroGlobalAdmin, { status: PersonStatus.DISABLED })).status,
      ).toBe(200);
      expect((await ler(outroGlobalAdmin)).status).toBe(PersonStatus.DISABLED);
    });

    it('unit_admin continua sem alcançar unit_admin nem global_admin', async () => {
      expect((await patch(unitAdminA, unitAdminA, { fullName: 'Eu' })).status).toBe(403);
      expect((await patch(unitAdminA, outroGlobalAdmin, { fullName: 'X' })).status).toBe(403);
      expect((await ler(outroGlobalAdmin)).full_name).toBe('Nome Original');
    });

    it('unit_admin segue alcançando colaborador da própria unidade', async () => {
      expect((await patch(unitAdminA, ids.userA, { fullName: 'Colaborador Editado' })).status).toBe(
        200,
      );
    });
  });

  describe('A edição NÃO concede alcance de senha', () => {
    async function redefinir(atorId: string, alvoId: string) {
      return request(createApp(ports))
        .post(`/users/${alvoId}/password`)
        .set('Cookie', await sessionCookieFor(ports, atorId))
        .send({});
    }

    it('global_admin não redefine a senha de outro global_admin, embora possa editá-lo', async () => {
      // pode editar…
      expect((await patch(ids.globalAdmin, outroGlobalAdmin, { fullName: 'Pode' })).status).toBe(
        200,
      );
      // …e ainda assim não redefine a senha
      expect((await redefinir(ids.globalAdmin, outroGlobalAdmin)).status).toBe(403);
    });

    it('global_admin não redefine a própria senha por esta rota', async () => {
      expect((await redefinir(ids.globalAdmin, ids.globalAdmin)).status).toBe(403);
    });

    it('global_admin continua redefinindo senha de unit_admin e de colaborador', async () => {
      expect((await redefinir(ids.globalAdmin, unitAdminA)).status).toBe(200);
      expect((await redefinir(ids.globalAdmin, ids.userA)).status).toBe(200);
    });
  });

  describe('Travas de auto-edição', () => {
    it('não rebaixa o próprio papel, e nenhum outro campo da requisição é aplicado', async () => {
      const res = await patch(ids.globalAdmin, ids.globalAdmin, {
        fullName: 'Nao Deve Passar',
        role: UserRole.COLLABORATOR,
      });
      expect(res.status).toBe(403);
      const depois = await ler(ids.globalAdmin);
      expect(depois.role).toBe(UserRole.GLOBAL_ADMIN);
      expect(depois.full_name).toBe('Nome Original');
    });

    it('não desativa a própria conta, e nenhum outro campo é aplicado', async () => {
      const res = await patch(ids.globalAdmin, ids.globalAdmin, {
        fullName: 'Nao Deve Passar',
        status: PersonStatus.DISABLED,
      });
      expect(res.status).toBe(403);
      const depois = await ler(ids.globalAdmin);
      expect(depois.status).toBe(PersonStatus.ACTIVE);
      expect(depois.full_name).toBe('Nome Original');
    });

    it('reenviar o MESMO papel na edição de si não é recusa', async () => {
      const res = await patch(ids.globalAdmin, ids.globalAdmin, {
        fullName: 'Papel Inalterado',
        role: UserRole.GLOBAL_ADMIN,
      });
      expect(res.status).toBe(200);
      expect((await ler(ids.globalAdmin)).full_name).toBe('Papel Inalterado');
    });

    it('a trava vale para qualquer papel, não só global_admin', async () => {
      // As travas rodam ANTES da transação e do alcance, então valem para
      // qualquer papel: aqui um `global_admin` rebaixado a `unit_admin` por
      // outro tenta autodesativar-se e é recusado pela própria trava, não pelo
      // alcance — que também o recusaria, logo em seguida.
      await patch(ids.globalAdmin, outroGlobalAdmin, { role: UserRole.UNIT_ADMIN });
      const res = await patch(outroGlobalAdmin, outroGlobalAdmin, {
        status: PersonStatus.DISABLED,
      });
      expect(res.status).toBe(403);
      expect((await ler(outroGlobalAdmin)).status).toBe(PersonStatus.ACTIVE);
    });

    it('resta sempre um global_admin ativo: o autor não se alcança por nenhum caminho', async () => {
      // Esgota o que é permitido sobre os demais administradores…
      await patch(ids.globalAdmin, outroGlobalAdmin, { status: PersonStatus.DISABLED });
      await patch(ids.globalAdmin, outroGlobalAdmin, { role: UserRole.COLLABORATOR });
      // …e o autor continua de pé, por construção.
      const autor = await ler(ids.globalAdmin);
      expect(autor.role).toBe(UserRole.GLOBAL_ADMIN);
      expect(autor.status).toBe(PersonStatus.ACTIVE);

      const ativos = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM users WHERE role = 'global_admin' AND status = 'active'`,
        );
        return Number(rows[0]!.n);
      });
      expect(ativos).toBeGreaterThanOrEqual(1);
    });
  });
});
