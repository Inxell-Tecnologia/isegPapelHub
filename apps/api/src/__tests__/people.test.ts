import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import * as argon2 from 'argon2';
import { UserRole } from '@gdoc/shared';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase, withSystemBypass, sessionCookieFor } from './test-db.js';
import type { Ports } from '../ports/index.js';

describe('Gestão de pessoas: POST/GET/PATCH /users', () => {
  let pool: Pool;
  let ports: Ports;
  let unitA: string;
  let unitB: string;
  let globalAdminId: string;
  let unitAdminAId: string;
  let unitAdminBId: string;
  let collaboratorAId: string;
  let collaboratorA2Id: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;

    const passwordHash = await argon2.hash('correct-password', { type: argon2.argon2id });

    const ids = await withSystemBypass(pool, async (client) => {
      const { rows: unitRows } = await client.query<{ id: string }>(
        `INSERT INTO units (name) VALUES ('Unidade A'), ('Unidade B') RETURNING id`,
      );
      const [uA, uB] = unitRows;

      const { rows: userRows } = await client.query<{ id: string; role: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name) VALUES
           ($1, 'global-admin@test.dev', $3, 'global_admin', 'Global Admin'),
           ($1, 'unit-admin-a@test.dev', $3, 'unit_admin', 'Admin A'),
           ($2, 'unit-admin-b@test.dev', $3, 'unit_admin', 'Admin B'),
           ($1, 'collab-a@test.dev', $3, 'collaborator', 'Colaborador A'),
           ($1, 'collab-a2@test.dev', $3, 'collaborator', 'Colaborador A2')
         RETURNING id, role`,
        [uA!.id, uB!.id, passwordHash],
      );

      return { unitA: uA!.id, unitB: uB!.id, users: userRows };
    });

    unitA = ids.unitA;
    unitB = ids.unitB;
    globalAdminId = ids.users[0]!.id;
    unitAdminAId = ids.users[1]!.id;
    unitAdminBId = ids.users[2]!.id;
    collaboratorAId = ids.users[3]!.id;
    collaboratorA2Id = ids.users[4]!.id;

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

  it('admin cadastra pessoa com e-mail ainda não utilizado: conta fica apta a login', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({
        fullName: 'Nova Pessoa',
        email: 'nova-pessoa@test.dev',
        password: 'initial-password',
        phone: '+55 11 90000-0000',
        jobTitle: 'Analista',
        notes: 'observação',
      });

    expect(res.status).toBe(201);
    expect(res.body.unitId).toBe(unitA);
    expect(res.body.email).toBe('nova-pessoa@test.dev');
    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'nova-pessoa@test.dev', password: 'initial-password' });
    expect(login.status).toBe(200);
  });

  it('e-mail duplicado é recusado sem criar conta', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({ fullName: 'Duplicado', email: 'collab-a@test.dev', password: 'whatever-password' });

    expect(res.status).toBe(409);
  });

  it('collaborator não pode cadastrar pessoas', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, collaboratorAId))
      .send({ fullName: 'X', email: 'x@test.dev', password: 'whatever-password' });

    expect(res.status).toBe(403);
  });

  it('unit_admin que tenta criar em outra unidade é forçado à própria unidade', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({
        fullName: 'Cross Unit',
        email: 'cross-unit@test.dev',
        password: 'whatever-password',
        unitId: unitB,
      });

    expect(res.status).toBe(201);
    expect(res.body.unitId).toBe(unitA);
  });

  it('unit_admin não pode criar pessoa com papel global_admin', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({
        fullName: 'Tentativa Elevação',
        email: 'elevacao@test.dev',
        password: 'whatever-password',
        role: UserRole.GLOBAL_ADMIN,
      });

    expect(res.status).toBe(403);
  });

  it('unit_admin lista apenas pessoas da própria unidade', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .get('/users')
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId));

    expect(res.status).toBe(200);
    expect(res.body.every((p: { unitId: string }) => p.unitId === unitA)).toBe(true);
    expect(res.body.some((p: { unitId: string }) => p.unitId === unitB)).toBe(false);
  });

  it('global_admin agrega pessoas de todas as unidades', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .get('/users')
      .set('Cookie', await sessionCookieFor(ports, globalAdminId));

    expect(res.status).toBe(200);
    expect(res.body.some((p: { unitId: string }) => p.unitId === unitA)).toBe(true);
    expect(res.body.some((p: { unitId: string }) => p.unitId === unitB)).toBe(true);
  });

  it('collaborator recebe 403 em GET /users', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .get('/users')
      .set('Cookie', await sessionCookieFor(ports, collaboratorAId));
    expect(res.status).toBe(403);
  });

  it('desativação impede novo login preservando os dados da pessoa', async () => {
    const app = createApp(ports);
    const patch = await request(app)
      .patch(`/users/${collaboratorAId}`)
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({ status: 'disabled' });

    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe('disabled');
    expect(patch.body.fullName).toBe('Colaborador A');

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'collab-a@test.dev', password: 'correct-password' });
    expect(login.status).toBe(403);
  });

  it('unit_admin não pode editar pessoa de outra unidade', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .patch(`/users/${unitAdminBId}`)
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({ fullName: 'Tentativa de edição' });

    expect(res.status).toBe(403);

    const unchanged = await withSystemBypass(pool, (client) =>
      client.query('SELECT full_name FROM users WHERE id = $1', [unitAdminBId]),
    );
    expect(unchanged.rows[0]?.full_name).toBe('Admin B');
  });

  it('collaborator recebe 403 em PATCH /users/:id', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .patch(`/users/${unitAdminAId}`)
      .set('Cookie', await sessionCookieFor(ports, collaboratorA2Id))
      .send({ fullName: 'Não deveria funcionar' });

    expect(res.status).toBe(403);
  });

  it('cadastro com senha inicial curta é recusado sem criar conta', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/users')
      .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
      .send({ fullName: 'Senha Curta', email: 'senha-curta@test.dev', password: 'ab' });

    expect(res.status).toBe(400);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'senha-curta@test.dev', password: 'ab' });
    expect(login.status).toBe(401);
  });

  describe('PATCH /users/:id — trava de alvo por papel (regressão, design.md (troca-de-senha) D5)', () => {
    it('unit_admin não desativa nem edita administrador da própria unidade', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .patch(`/users/${globalAdminId}`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({ status: 'disabled' });

      expect(res.status).toBe(403);

      const unchanged = await withSystemBypass(pool, (client) =>
        client.query('SELECT status FROM users WHERE id = $1', [globalAdminId]),
      );
      expect(unchanged.rows[0]?.status).toBe('active');
    });
  });

  describe('POST /users/:id/password — alcance por papel do alvo (US 1.4, design.md D5)', () => {
    async function createPerson(unitId: string, role: string, email: string): Promise<string> {
      const passwordHash = await argon2.hash('senha-original', { type: argon2.argon2id });
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
          [unitId, email, passwordHash, role],
        ),
      );
      return rows[0]!.id;
    }

    it('unit_admin redefine senha de colaborador da própria unidade', async () => {
      const app = createApp(ports);
      const targetId = await createPerson(unitA, 'collaborator', 'reset-collab-a@test.dev');
      const res = await request(app)
        .post(`/users/${targetId}/password`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({});

      expect(res.status).toBe(200);
      expect(typeof res.body.generatedPassword).toBe('string');
    });

    it('unit_admin não redefine senha de outro unit_admin', async () => {
      const app = createApp(ports);
      const targetId = await createPerson(unitA, 'unit_admin', 'reset-unit-admin-a2@test.dev');
      const res = await request(app)
        .post(`/users/${targetId}/password`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({});

      expect(res.status).toBe(403);
    });

    it('unit_admin não redefine senha de global_admin da própria unidade', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .post(`/users/${globalAdminId}/password`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({});

      expect(res.status).toBe(403);
    });

    it('unit_admin não alcança pessoa de outra unidade (indistinguível do alvo inexistente)', async () => {
      const app = createApp(ports);
      const targetId = await createPerson(unitB, 'collaborator', 'reset-outra-unidade@test.dev');
      const res = await request(app)
        .post(`/users/${targetId}/password`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({});

      expect(res.status).toBe(403);
    });

    it('global_admin redefine senha de unit_admin', async () => {
      const app = createApp(ports);
      const targetId = await createPerson(unitB, 'unit_admin', 'reset-unit-admin-b2@test.dev');
      const res = await request(app)
        .post(`/users/${targetId}/password`)
        .set('Cookie', await sessionCookieFor(ports, globalAdminId))
        .send({});

      expect(res.status).toBe(200);
      expect(typeof res.body.generatedPassword).toBe('string');
    });

    it('nenhum global_admin tem a senha redefinida por outrem, nem por outro global_admin', async () => {
      const app = createApp(ports);
      const otherGlobalAdminId = await createPerson(
        unitA,
        'global_admin',
        'outro-global-admin@test.dev',
      );
      const res = await request(app)
        .post(`/users/${otherGlobalAdminId}/password`)
        .set('Cookie', await sessionCookieFor(ports, globalAdminId))
        .send({});

      expect(res.status).toBe(403);
    });

    it('collaborator não redefine senha de ninguém', async () => {
      const app = createApp(ports);
      const targetId = await createPerson(
        unitA,
        'collaborator',
        'reset-alvo-de-collaborator@test.dev',
      );
      const res = await request(app)
        .post(`/users/${targetId}/password`)
        .set('Cookie', await sessionCookieFor(ports, collaboratorA2Id))
        .send({});

      expect(res.status).toBe(403);
    });

    it('senha informada pelo solicitante é ignorada — o sistema sempre gera a própria', async () => {
      const app = createApp(ports);
      const targetId = await createPerson(unitA, 'collaborator', 'reset-ignora-senha@test.dev');
      const res = await request(app)
        .post(`/users/${targetId}/password`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({ password: 'senha-escolhida-pelo-atacante' });

      expect(res.status).toBe(200);
      expect(res.body.generatedPassword).not.toBe('senha-escolhida-pelo-atacante');
    });

    it('efeito do reset: todas as sessões do alvo são recusadas, a senha anterior deixa de autenticar e a senha devolvida autentica', async () => {
      const app = createApp(ports);
      const targetId = await createPerson(unitA, 'collaborator', 'reset-efeito@test.dev');
      const oldCookie = await sessionCookieFor(
        ports,
        targetId,
        new Date(Date.now() - 60 * 60 * 1000),
      );

      const res = await request(app)
        .post(`/users/${targetId}/password`)
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({});
      expect(res.status).toBe(200);
      const generatedPassword = res.body.generatedPassword as string;

      const meWithOldCookie = await request(app).get('/auth/me').set('Cookie', oldCookie);
      expect(meWithOldCookie.status).toBe(401);

      const loginOld = await request(app)
        .post('/auth/login')
        .send({ email: 'reset-efeito@test.dev', password: 'senha-original' });
      expect(loginOld.status).toBe(401);

      const loginNew = await request(app)
        .post('/auth/login')
        .send({ email: 'reset-efeito@test.dev', password: generatedPassword });
      expect(loginNew.status).toBe(200);
    });
  });
  /**
   * Setor por referência (change `funcao-e-setor-na-identidade`, capability
   * `gestao-pessoas`). O campo substitui `workArea`, que era texto livre —
   * ver o requisito "Cadastro de pessoa pela administração" e
   * "Edição altera ou remove o vínculo de setor".
   */
  describe('setor da pessoa (US 1.1; respostas 5a e 6a do cliente)', () => {
    async function criaSetor(unitId: string, nome: string): Promise<string> {
      return withSystemBypass(pool, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO sectors (unit_id, name) VALUES ($1, $2) RETURNING id`,
          [unitId, nome],
        );
        return rows[0]!.id;
      });
    }

    it('cadastro com setor da unidade vincula e devolve o NOME do setor', async () => {
      const setorId = await criaSetor(unitA, 'Centro Cirúrgico');
      const app = createApp(ports);

      const res = await request(app)
        .post('/users')
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({
          fullName: 'Pessoa com Setor',
          email: 'com-setor@test.dev',
          password: 'initial-password',
          sectorId: setorId,
        });

      expect(res.status).toBe(201);
      expect(res.body.sectorId).toBe(setorId);
      // O nome, não o identificador cru: é o que a interface apresenta.
      expect(res.body.sectorName).toBe('Centro Cirúrgico');
    });

    it('cadastro sem setor é aceito e devolve os dois campos nulos', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .post('/users')
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({
          fullName: 'Pessoa sem Setor',
          email: 'sem-setor@test.dev',
          password: 'initial-password',
        });

      expect(res.status).toBe(201);
      expect(res.body.sectorId).toBeNull();
      expect(res.body.sectorName).toBeNull();
    });

    it('setor de OUTRA unidade recusa o cadastro, sem criar conta', async () => {
      const setorDaB = await criaSetor(unitB, 'Setor da B');
      const app = createApp(ports);

      const res = await request(app)
        .post('/users')
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({
          fullName: 'Não Deve Existir',
          email: 'nao-deve-existir@test.dev',
          password: 'initial-password',
          sectorId: setorDaB,
        });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'invalid_sector' });

      // Fail-closed: a resposta é a mesma de um setor inexistente.
      const inexistente = await request(app)
        .post('/users')
        .set('Cookie', await sessionCookieFor(ports, unitAdminAId))
        .send({
          fullName: 'Também Não',
          email: 'tambem-nao@test.dev',
          password: 'initial-password',
          sectorId: '00000000-0000-0000-0000-000000000000',
        });
      expect(inexistente.status).toBe(409);
      expect(inexistente.body).toEqual(res.body);

      const criadas = await withSystemBypass(pool, (client) =>
        client
          .query(
            "SELECT count(*)::int AS n FROM users WHERE email IN ('nao-deve-existir@test.dev', 'tambem-nao@test.dev')",
          )
          .then((r) => r.rows[0]!.n),
      );
      expect(criadas).toBe(0);
    });

    it('edição troca o setor da pessoa', async () => {
      const antes = await criaSetor(unitA, 'Setor Antigo');
      const depois = await criaSetor(unitA, 'Setor Novo');
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, unitAdminAId);

      await request(app)
        .patch(`/users/${collaboratorAId}`)
        .set('Cookie', cookie)
        .send({ sectorId: antes });

      const res = await request(app)
        .patch(`/users/${collaboratorAId}`)
        .set('Cookie', cookie)
        .send({ sectorId: depois });

      expect(res.status).toBe(200);
      expect(res.body.sectorId).toBe(depois);
      expect(res.body.sectorName).toBe('Setor Novo');
    });

    it('edição com null remove o vínculo, sem mexer no resto', async () => {
      const setorId = await criaSetor(unitA, 'Para Remover');
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, unitAdminAId);

      await request(app)
        .patch(`/users/${collaboratorA2Id}`)
        .set('Cookie', cookie)
        .send({ sectorId: setorId, jobTitle: 'Coordenadora' });

      const res = await request(app)
        .patch(`/users/${collaboratorA2Id}`)
        .set('Cookie', cookie)
        .send({ sectorId: null });

      expect(res.status).toBe(200);
      expect(res.body.sectorId).toBeNull();
      expect(res.body.sectorName).toBeNull();
      // A remoção do vínculo não é "limpar a pessoa": a função segue lá.
      expect(res.body.jobTitle).toBe('Coordenadora');
    });

    it('edição SEM o campo preserva o vínculo vigente', async () => {
      const setorId = await criaSetor(unitA, 'Preservado');
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, unitAdminAId);

      await request(app)
        .patch(`/users/${collaboratorAId}`)
        .set('Cookie', cookie)
        .send({ sectorId: setorId });

      const res = await request(app)
        .patch(`/users/${collaboratorAId}`)
        .set('Cookie', cookie)
        .send({ phone: '+55 11 91111-1111' });

      expect(res.status).toBe(200);
      expect(res.body.sectorId).toBe(setorId);
      expect(res.body.sectorName).toBe('Preservado');
    });

    it('setor de outra unidade recusa a edição INTEIRA: nenhum campo é aplicado', async () => {
      const setorDaB = await criaSetor(unitB, 'Outro Setor da B');
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, unitAdminAId);

      const antes = await request(app)
        .patch(`/users/${collaboratorAId}`)
        .set('Cookie', cookie)
        .send({ jobTitle: 'Antes da Tentativa' });
      expect(antes.status).toBe(200);
      const setorVigente = antes.body.sectorId;

      const res = await request(app)
        .patch(`/users/${collaboratorAId}`)
        .set('Cookie', cookie)
        .send({ jobTitle: 'NÃO DEVE SER APLICADO', sectorId: setorDaB });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'invalid_sector' });

      // A recusa é total — e é esta a diferença entre recusar e "aplicar o que
      // deu": devolver 409 depois de ter gravado a função seria sucesso
      // parcial disfarçado de erro. O vínculo vigente é lido de `antes`, não
      // presumido: os casos deste describe compartilham o `beforeAll`.
      const depois = await request(app)
        .get('/users')
        .set('Cookie', cookie)
        .then((r) => r.body.find((p: { id: string }) => p.id === collaboratorAId));
      expect(depois.jobTitle).toBe('Antes da Tentativa');
      expect(depois.sectorId).toBe(setorVigente);
      expect(depois.sectorId).not.toBe(setorDaB);
    });

    it('global_admin vincula pessoa de outra unidade a setor DAQUELA unidade', async () => {
      const setorDaB = await criaSetor(unitB, 'Setor Legítimo da B');
      const app = createApp(ports);

      const res = await request(app)
        .patch(`/users/${unitAdminBId}`)
        .set('Cookie', await sessionCookieFor(ports, globalAdminId))
        .send({ sectorId: setorDaB });

      // A unidade de referência é a da pessoa EDITADA, não a de quem edita.
      expect(res.status).toBe(200);
      expect(res.body.sectorName).toBe('Setor Legítimo da B');
    });
  });
});
