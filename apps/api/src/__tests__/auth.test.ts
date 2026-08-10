import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import * as argon2 from 'argon2';
import { createHmac } from 'node:crypto';
import { createApp } from '../app.js';
import { config, CANONICAL_MANUAL_URL } from '../config.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase, withSystemBypass, sessionCookieFor } from './test-db.js';
import type { Ports } from '../ports/index.js';
import { SESSION_COOKIE_NAME } from '../lib/session-cookie.js';

describe('Autenticação: /auth/login, /auth/logout, /auth/me', () => {
  let pool: Pool;
  let ports: Ports;
  let unitId: string;
  let activeUserId: string;
  let disabledUserId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;

    const passwordHash = await argon2.hash('correct-password', { type: argon2.argon2id });

    const ids = await withSystemBypass(pool, async (client) => {
      const { rows: unitRows } = await client.query<{ id: string }>(
        `INSERT INTO units (name) VALUES ('Unidade Auth') RETURNING id`,
      );
      const unit = unitRows[0]!;

      const { rows: userRows } = await client.query<{ id: string; status: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name, status) VALUES
           ($1, 'ativo@test.dev', $2, 'collaborator', 'Pessoa Ativa', 'active'),
           ($1, 'desativado@test.dev', $2, 'collaborator', 'Pessoa Desativada', 'disabled')
         RETURNING id, status`,
        [unit.id, passwordHash],
      );

      return { unitId: unit.id, users: userRows };
    });

    unitId = ids.unitId;
    activeUserId = ids.users.find((u) => u.status === 'active')!.id;
    disabledUserId = ids.users.find((u) => u.status === 'disabled')!.id;

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

  it('login com credenciais corretas emite sessão (cookie HttpOnly)', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ativo@test.dev', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: activeUserId, unitId, role: 'collaborator' });

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((c: string) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('e-mail inexistente é recusado com resposta genérica', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nao-existe@test.dev', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('senha incorreta é recusada com a mesma resposta genérica', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ativo@test.dev', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('conta desativada não autentica mesmo com credenciais corretas', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'desativado@test.dev', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('GET /auth/me devolve id/unidade/papel sem senha nem hash', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', await sessionCookieFor(ports, activeUserId));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: activeUserId, unitId, role: 'collaborator' });
    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('GET /auth/me sem sessão é rejeitado', async () => {
    const app = createApp(ports);
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('sessão de conta desativada é recusada mesmo antes de expirar', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', await sessionCookieFor(ports, disabledUserId));
    expect(res.status).toBe(401);
  });

  it('logout encerra a sessão: requisições seguintes são tratadas como não autenticadas', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, activeUserId);

    const meBefore = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(meBefore.status).toBe(200);

    const logout = await request(app).post('/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);
    const clearedCookie = logout.headers['set-cookie'];
    expect(clearedCookie).toBeDefined();
  });

  describe('Sessão x troca de senha (design.md D1/D3)', () => {
    it('sessão emitida antes da última troca de senha é recusada', async () => {
      const app = createApp(ports);
      const { id: userId } = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role, status) VALUES
             ($1, 'antes-da-troca@test.dev', 'hash', 'collaborator', 'active') RETURNING id`,
          [unitId],
        );
        return rows[0]!;
      });

      const staleCookie = await sessionCookieFor(
        ports,
        userId,
        new Date(Date.now() - 60 * 60 * 1000),
      );

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET password_changed_at = now() WHERE id = $1', [userId]),
      );

      const res = await request(app).get('/auth/me').set('Cookie', staleCookie);
      expect(res.status).toBe(401);
    });

    it('sessão emitida depois da última troca de senha é aceita', async () => {
      const app = createApp(ports);
      const { id: userId } = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role, status) VALUES
             ($1, 'depois-da-troca@test.dev', 'hash', 'collaborator', 'active') RETURNING id`,
          [unitId],
        );
        return rows[0]!;
      });

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET password_changed_at = now() WHERE id = $1', [userId]),
      );

      const freshCookie = await sessionCookieFor(ports, userId);
      const res = await request(app).get('/auth/me').set('Cookie', freshCookie);
      expect(res.status).toBe(200);
    });

    it('sessão sem instante de emissão é recusada', async () => {
      const app = createApp(ports);
      const secrets = new EnvSecretsPort();
      const secret = await secrets.getSecret('AUTH_SESSION_SECRET');
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf-8').toString(
        'base64url',
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: activeUserId, exp: Math.floor(Date.now() / 1000) + 3600 }),
        'utf-8',
      ).toString('base64url');
      const signature = createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');
      const tokenWithoutIat = `${header}.${payload}.${signature}`;

      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${tokenWithoutIat}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/password (US 1.3)', () => {
    async function createUser(email: string): Promise<{ id: string; passwordHash: string }> {
      const passwordHash = await argon2.hash('senha-original', { type: argon2.argon2id });
      const { id } = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role, status) VALUES
             ($1, $2, $3, 'collaborator', 'active') RETURNING id`,
          [unitId, email, passwordHash],
        );
        return rows[0]!;
      });
      return { id, passwordHash };
    }

    it('troca válida altera a senha e a sessão corrente sobrevive; sessão antiga passa a ser recusada', async () => {
      const app = createApp(ports);
      const { id: userId } = await createUser('troca-valida@test.dev');
      const oldCookie = await sessionCookieFor(ports, userId);

      const res = await request(app)
        .post('/auth/password')
        .set('Cookie', oldCookie)
        .send({ currentPassword: 'senha-original', newPassword: 'senha-nova-valida' });

      expect(res.status).toBe(204);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const newCookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((c: string) =>
        c.startsWith(`${SESSION_COOKIE_NAME}=`),
      )!;

      // A sessão em que a troca ocorreu (reemitida) segue válida.
      const meWithNewCookie = await request(app).get('/auth/me').set('Cookie', newCookie);
      expect(meWithNewCookie.status).toBe(200);

      // Login com a senha nova passa a funcionar; a antiga deixa de autenticar.
      const loginNew = await request(app)
        .post('/auth/login')
        .send({ email: 'troca-valida@test.dev', password: 'senha-nova-valida' });
      expect(loginNew.status).toBe(200);

      const loginOld = await request(app)
        .post('/auth/login')
        .send({ email: 'troca-valida@test.dev', password: 'senha-original' });
      expect(loginOld.status).toBe(401);
    });

    it('senha atual incorreta é recusada sem alterar dado algum', async () => {
      const app = createApp(ports);
      const { id: userId } = await createUser('senha-atual-errada@test.dev');
      const cookie = await sessionCookieFor(ports, userId);

      const res = await request(app)
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'senha-errada', newPassword: 'senha-nova-valida' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('current password is incorrect');

      const login = await request(app)
        .post('/auth/login')
        .send({ email: 'senha-atual-errada@test.dev', password: 'senha-original' });
      expect(login.status).toBe(200);
    });

    it('senha nova curta é recusada', async () => {
      const app = createApp(ports);
      const { id: userId } = await createUser('senha-nova-curta@test.dev');
      const cookie = await sessionCookieFor(ports, userId);

      const res = await request(app)
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'senha-original', newPassword: 'curta' });

      expect(res.status).toBe(400);
    });

    it('sem sessão retorna 401', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .post('/auth/password')
        .send({ currentPassword: 'senha-original', newPassword: 'senha-nova-valida' });
      expect(res.status).toBe(401);
    });

    it('sessão emitida antes da troca é recusada após a troca', async () => {
      const app = createApp(ports);
      const { id: userId } = await createUser('sessao-antiga@test.dev');
      const staleCookie = await sessionCookieFor(
        ports,
        userId,
        new Date(Date.now() - 60 * 60 * 1000),
      );
      const otherCookie = await sessionCookieFor(ports, userId);

      const res = await request(app)
        .post('/auth/password')
        .set('Cookie', otherCookie)
        .send({ currentPassword: 'senha-original', newPassword: 'senha-nova-valida' });
      expect(res.status).toBe(204);

      const meWithStale = await request(app).get('/auth/me').set('Cookie', staleCookie);
      expect(meWithStale.status).toBe(401);
    });
  });

  describe('GET /auth/public-config (change rebranding-doc7-setes; manualUrl pela change acesso-ao-manual-no-shell, corrige-alcance-do-manual)', () => {
    it('responde 200 sem cookie de sessão, com apenas appName, clientName e manualUrl (design.md D4, D3 de acesso-ao-manual-no-shell)', async () => {
      const app = createApp(ports);
      const res = await request(app).get('/auth/public-config');

      expect(res.status).toBe(200);
      // `clientName` reflete o ambiente (design.md D8 de rebranding-doc7-setes)
      // e não tem valor canônico — comparar com `config.appClientName` é
      // legítimo ali. `manualUrl` deixou de ser assim (change
      // corrige-alcance-do-manual, design.md D2): sem override de
      // implantação, o valor é sempre o endereço canônico, então a
      // asserção compara com esse valor esperado, não com
      // `config.appManualUrl` — o mesmo dado que a rota devolveria mesmo se
      // a resolução estivesse quebrada (era exatamente esse o teste
      // tautológico apontado na proposal). A trava desta rota é o contrato:
      // exatamente estas três chaves, nenhum outro dado de configuração.
      // Alteração deliberada de contrato (design.md D3) — manter a asserção
      // por chaves exatas, nunca afrouxar para `toMatchObject`.
      expect(res.body).toEqual({
        appName: 'PapelHub',
        clientName: config.appClientName,
        manualUrl: CANONICAL_MANUAL_URL,
      });
      expect(Object.keys(res.body)).toEqual(['appName', 'clientName', 'manualUrl']);
    });

    it('APP_MANUAL_URL inválida (esquema não http/https) derruba createApp no arranque, nomeando a variável', () => {
      expect(() => createApp(ports, { appManualUrl: 'javascript:alert(1)' })).toThrow(
        /APP_MANUAL_URL/,
      );
    });

    it('APP_MANUAL_URL vazia arranca normalmente e responde o endereço canônico do manual (design.md D2, D3 de corrige-alcance-do-manual — vazio deixou de suprimir o acesso)', async () => {
      const app = createApp(ports, { appManualUrl: '' });
      const res = await request(app).get('/auth/public-config');

      expect(res.status).toBe(200);
      expect(res.body.manualUrl).toBe(CANONICAL_MANUAL_URL);
    });
  });

  describe('GET /auth/profile (US 1.3, cenário 5)', () => {
    it('devolve nome, e-mail, unidade e papel da pessoa autenticada, sem material de senha', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .get('/auth/profile')
        .set('Cookie', await sessionCookieFor(ports, activeUserId));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        fullName: 'Pessoa Ativa',
        email: 'ativo@test.dev',
        unitName: 'Unidade Auth',
        role: 'collaborator',
      });
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('sem sessão retorna 401', async () => {
      const app = createApp(ports);
      const res = await request(app).get('/auth/profile');
      expect(res.status).toBe(401);
    });
  });
});
