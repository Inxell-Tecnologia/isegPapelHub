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
    expect(res.body).toEqual({
      id: activeUserId,
      unitId,
      role: 'collaborator',
      fullName: 'Pessoa Ativa',
      unitName: 'Unidade Auth',
      jobTitle: '',
      sectorName: '',
      tourCompleted: false,
      readingOversight: null,
    });

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
    expect(res.body).toEqual({
      id: activeUserId,
      unitId,
      role: 'collaborator',
      fullName: 'Pessoa Ativa',
      unitName: 'Unidade Auth',
      jobTitle: '',
      sectorName: '',
      tourCompleted: false,
      readingOversight: null,
    });
    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  /**
   * Identidade com nome, unidade, função e setor (changes `shell-e-inicio` e
   * `funcao-e-setor-na-identidade`, capability `autenticacao`; US 11.1). O
   * requisito existe porque o shell apresentava os dois primeiros caracteres
   * do identificador interno como identidade da pessoa; função e setor entram
   * pela mesma porta, e pelo mesmo motivo de origem — a releitura por
   * requisição, nunca o token.
   */
  describe('Identidade devolvida à interface carrega nome, unidade, função e setor (US 11.1)', () => {
    it('o login devolve a identidade na mesma forma de /auth/me, com nome e unidade', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ativo@test.dev', password: 'correct-password' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: activeUserId,
        unitId,
        role: 'collaborator',
        fullName: 'Pessoa Ativa',
        unitName: 'Unidade Auth',
        jobTitle: '',
        sectorName: '',
        tourCompleted: false,
        readingOversight: null,
      });
    });

    it('nome alterado no cadastro aparece na requisição seguinte, sem novo login (design.md D3)', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, activeUserId);

      const antes = await request(app).get('/auth/me').set('Cookie', cookie);
      expect(antes.body.fullName).toBe('Pessoa Ativa');

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET full_name = $1 WHERE id = $2', [
          'Pessoa Renomeada',
          activeUserId,
        ]),
      );

      // Mesma sessão, nenhum novo login: a releitura por requisição é o que
      // faz o nome novo chegar já aqui.
      const depois = await request(app).get('/auth/me').set('Cookie', cookie);
      expect(depois.status).toBe(200);
      expect(depois.body.fullName).toBe('Pessoa Renomeada');

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET full_name = $1 WHERE id = $2', [
          'Pessoa Ativa',
          activeUserId,
        ]),
      );
    });

    it('conta sem nome cadastrado devolve o nome vazio, sem recorrer ao identificador', async () => {
      const semNomeId = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role, full_name, status)
           VALUES ($1, 'sem-nome@test.dev', 'x', 'collaborator', NULL, 'active')
           RETURNING id`,
          [unitId],
        );
        return rows[0]!.id;
      });

      const app = createApp(ports);
      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', await sessionCookieFor(ports, semNomeId));

      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe('');
      expect(res.body.unitName).toBe('Unidade Auth');
      // O vazio nunca é substituído por fragmento do identificador interno.
      expect(res.body.fullName).not.toContain(semNomeId.slice(0, 2));
    });

    it('função e setor do cadastro chegam à identidade', async () => {
      const setorId = await withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO sectors (unit_id, name) VALUES ($1, 'Governança') RETURNING id`,
          [unitId],
        );
        return rows[0]!.id;
      });
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET job_title = $1, sector_id = $2 WHERE id = $3', [
          'Gerente de Governança',
          setorId,
          activeUserId,
        ]),
      );

      const app = createApp(ports);
      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', await sessionCookieFor(ports, activeUserId));

      expect(res.status).toBe(200);
      expect(res.body.jobTitle).toBe('Gerente de Governança');
      expect(res.body.sectorName).toBe('Governança');
      // O papel segue na identidade: a interface decide o que apresentar, o
      // servidor não esconde o dado de autorização.
      expect(res.body.role).toBe('collaborator');

      // E o login devolve a mesma forma, pela mesma leitura que autenticou.
      const login = await request(app)
        .post('/auth/login')
        .send({ email: 'ativo@test.dev', password: 'correct-password' });
      expect(login.body.jobTitle).toBe('Gerente de Governança');
      expect(login.body.sectorName).toBe('Governança');

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET job_title = NULL, sector_id = NULL WHERE id = $1', [
          activeUserId,
        ]),
      );
      await withSystemBypass(pool, (client) =>
        client.query('DELETE FROM sectors WHERE id = $1', [setorId]),
      );
    });

    it('função corrigida no cadastro aparece na requisição seguinte, sem novo login', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, activeUserId);

      const antes = await request(app).get('/auth/me').set('Cookie', cookie);
      expect(antes.body.jobTitle).toBe('');

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET job_title = $1 WHERE id = $2', [
          'Gerente de Governança',
          activeUserId,
        ]),
      );

      // É esta a queixa do cliente que a fatia resolve: a tela mostrava
      // "Colaborador" para a gerente de Governança. Com o cargo preenchido, a
      // requisição seguinte já o carrega — sem novo login.
      const depois = await request(app).get('/auth/me').set('Cookie', cookie);
      expect(depois.status).toBe(200);
      expect(depois.body.jobTitle).toBe('Gerente de Governança');

      await withSystemBypass(pool, (client) =>
        client.query('UPDATE users SET job_title = NULL WHERE id = $1', [activeUserId]),
      );
    });

    it('conta sem função e sem setor devolve os dois campos vazios, sem omiti-los', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', await sessionCookieFor(ports, activeUserId));

      expect(res.status).toBe(200);
      // Presentes e vazios — não ausentes. É o que mantém a forma da resposta
      // estável, independentemente do preenchimento do cadastro.
      expect(Object.keys(res.body)).toContain('jobTitle');
      expect(Object.keys(res.body)).toContain('sectorName');
      expect(res.body.jobTitle).toBe('');
      expect(res.body.sectorName).toBe('');
    });
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

  describe('GET /auth/public-config (change rebranding-doc7-setes; manualUrl pela change acesso-ao-manual-no-shell, corrige-alcance-do-manual; supportContact pela change identidade-visual-isetes)', () => {
    it('responde 200 sem cookie de sessão, com apenas appName, clientName, manualUrl e supportContact (design.md D4, D3 de acesso-ao-manual-no-shell, D8 de identidade-visual-isetes)', async () => {
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
      // por chaves exatas, nunca afrouxar para `toMatchObject`. `supportContact`
      // é o quarto e último valor da allowlist nominal (change
      // identidade-visual-isetes, design.md D8): um quinto exige modificar o
      // requisito de `identidade-visual`, não é extensão natural do contrato.
      expect(res.body).toEqual({
        appName: 'PapelHub',
        clientName: config.appClientName,
        manualUrl: CANONICAL_MANUAL_URL,
        supportContact: config.appSupportContact,
      });
      expect(Object.keys(res.body)).toEqual([
        'appName',
        'clientName',
        'manualUrl',
        'supportContact',
      ]);
    });

    // Os dois casos normatizados pelo requisito "Contato do suporte é
    // configurado por implantação" (tasks 4.3). A variável é lida no
    // carregamento de `config`, então o teste manipula o valor resolvido —
    // é o mesmo caminho que o Cloud Run percorre ao injetar a env var.
    it('devolve o contato do suporte configurado pela implantação', async () => {
      const original = config.appSupportContact;
      config.appSupportContact = 'suporte@setes.org.br';
      try {
        const res = await request(createApp(ports)).get('/auth/public-config');

        expect(res.status).toBe(200);
        expect(res.body.supportContact).toBe('suporte@setes.org.br');
      } finally {
        config.appSupportContact = original;
      }
    });

    it('contato ausente é devolvido vazio, mantendo a forma da resposta estável', async () => {
      const original = config.appSupportContact;
      config.appSupportContact = '';
      try {
        const res = await request(createApp(ports)).get('/auth/public-config');

        expect(res.status).toBe(200);
        expect(res.body.supportContact).toBe('');
        // Vazio é **ausência de valor**, nunca ausência da chave: a forma da
        // resposta não muda, para o consumidor não precisar distinguir os
        // dois casos.
        expect(Object.keys(res.body)).toContain('supportContact');
      } finally {
        config.appSupportContact = original;
      }
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

  describe('memória do tour guiado (POST /auth/tour-completed, change tour-guiado)', () => {
    it('grava na própria conta, reflete em /auth/me e preserva a primeira data (design.md D4)', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, activeUserId);
      await withSystemBypass(pool, (c) =>
        c.query('UPDATE users SET tour_completed_at = NULL WHERE unit_id = $1', [unitId]),
      );

      expect((await request(app).get('/auth/me').set('Cookie', cookie)).body.tourCompleted).toBe(
        false,
      );
      expect((await request(app).post('/auth/tour-completed').set('Cookie', cookie)).status).toBe(
        204,
      );
      expect((await request(app).get('/auth/me').set('Cookie', cookie)).body.tourCompleted).toBe(
        true,
      );

      const primeira = await withSystemBypass(pool, (c) =>
        c.query<{ t: string }>('SELECT tour_completed_at AS t FROM users WHERE id = $1', [
          activeUserId,
        ]),
      );
      await request(app).post('/auth/tour-completed').set('Cookie', cookie);
      const segunda = await withSystemBypass(pool, (c) =>
        c.query<{ t: string }>('SELECT tour_completed_at AS t FROM users WHERE id = $1', [
          activeUserId,
        ]),
      );
      expect(String(segunda.rows[0]!.t)).toBe(String(primeira.rows[0]!.t));

      // Só a própria conta: nenhuma outra pessoa da unidade foi marcada.
      const outras = await withSystemBypass(pool, (c) =>
        c.query<{ n: string }>(
          'SELECT count(*) AS n FROM users WHERE unit_id = $1 AND id <> $2 AND tour_completed_at IS NOT NULL',
          [unitId, activeUserId],
        ),
      );
      expect(Number(outras.rows[0]!.n)).toBe(0);
    });

    it('sem sessão retorna 401', async () => {
      const res = await request(createApp(ports)).post('/auth/tour-completed');
      expect(res.status).toBe(401);
    });
  });
});
