import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import * as argon2 from 'argon2';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { setupTestDatabase, withSystemBypass, sessionCookieFor } from './test-db.js';
import type { Ports } from '../ports/index.js';

/**
 * Troca de e-mail em `PATCH /users/:id` (change `edicao-email-pessoa`;
 * capability `gestao-pessoas`, PRD US 1.1). Alcance = o da edição
 * (`canEditTarget`, design.md D1); e-mail em uso → 409 com recusa total
 * (D2); o novo e-mail vale para o login na requisição seguinte.
 */
describe('Troca de e-mail na edição de pessoa', () => {
  let pool: Pool;
  let ports: Ports;
  let passwordHash: string;
  let unitA: string;
  let unitB: string;
  let globalAdminA: string;
  let unitAdminA: string;
  let contador = 0;

  async function novaPessoa(unitId: string, role: string): Promise<{ id: string; email: string }> {
    contador += 1;
    const email = `pessoa-${contador}@test.dev`;
    const id = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role, full_name)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [unitId, email, passwordHash, role, `Pessoa ${contador}`],
        )
        .then((r) => r.rows[0]!.id),
    );
    return { id, email };
  }

  async function emailDe(id: string): Promise<string> {
    return withSystemBypass(pool, (client) =>
      client
        .query<{ email: string }>('SELECT email FROM users WHERE id = $1', [id])
        .then((r) => r.rows[0]!.email),
    );
  }

  async function patch(actorId: string, targetId: string, body: Record<string, unknown>) {
    return request(createApp(ports))
      .patch(`/users/${targetId}`)
      .set('Cookie', await sessionCookieFor(ports, actorId))
      .send(body);
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    passwordHash = await argon2.hash('correct-password', { type: argon2.argon2id });

    const units = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO units (name) VALUES ('Unidade A'), ('Unidade B') RETURNING id`,
        )
        .then((r) => r.rows),
    );
    unitA = units[0]!.id;
    unitB = units[1]!.id;

    const secrets = new EnvSecretsPort();
    const database = new PgDatabasePort();
    ports = {
      database,
      notifications: new InAppNotificationPort(database),
      storage: new InMemoryStoragePort(),
      secrets,
      auth: new Argon2AuthPort(secrets),
    };

    globalAdminA = (await novaPessoa(unitA, 'global_admin')).id;
    unitAdminA = (await novaPessoa(unitA, 'unit_admin')).id;
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  describe('alcance', () => {
    it('unit_admin troca o e-mail de colaborador da própria unidade', async () => {
      const alvo = await novaPessoa(unitA, 'collaborator');
      const res = await patch(unitAdminA, alvo.id, { email: 'corrigido-1@test.dev' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('corrigido-1@test.dev');
      expect(await emailDe(alvo.id)).toBe('corrigido-1@test.dev');
    });

    it('unit_admin não troca o e-mail de unit_admin nem de global_admin da própria unidade', async () => {
      for (const role of ['unit_admin', 'global_admin']) {
        const alvo = await novaPessoa(unitA, role);
        const res = await patch(unitAdminA, alvo.id, { email: `nao-${role}@test.dev` });
        expect(res.status).toBe(403);
        expect(await emailDe(alvo.id)).toBe(alvo.email);
      }
    });

    it('unit_admin não troca o e-mail de pessoa de outra unidade', async () => {
      const alvo = await novaPessoa(unitB, 'collaborator');
      const res = await patch(unitAdminA, alvo.id, { email: 'nao-outra-unidade@test.dev' });
      expect(res.status).toBe(403);
      expect(await emailDe(alvo.id)).toBe(alvo.email);
    });

    it('global_admin troca o e-mail de qualquer pessoa, de qualquer unidade', async () => {
      for (const role of ['collaborator', 'unit_admin', 'global_admin']) {
        const alvo = await novaPessoa(unitB, role);
        const novo = `global-troca-${role}@test.dev`;
        const res = await patch(globalAdminA, alvo.id, { email: novo });
        expect(res.status).toBe(200);
        expect(await emailDe(alvo.id)).toBe(novo);
      }
    });

    it('global_admin troca o próprio e-mail', async () => {
      const eu = await novaPessoa(unitA, 'global_admin');
      const res = await patch(eu.id, eu.id, { email: 'eu-mesmo@test.dev' });
      expect(res.status).toBe(200);
      expect(await emailDe(eu.id)).toBe('eu-mesmo@test.dev');
    });
  });

  describe('validação e unicidade', () => {
    it('e-mail vazio ou só com espaços é 400, sem alterar dado algum', async () => {
      const alvo = await novaPessoa(unitA, 'collaborator');
      for (const email of ['', '   ']) {
        const res = await patch(globalAdminA, alvo.id, { email, fullName: 'Não Aplica' });
        expect(res.status).toBe(400);
      }
      const nome = await withSystemBypass(pool, (client) =>
        client
          .query<{ full_name: string }>('SELECT full_name FROM users WHERE id = $1', [alvo.id])
          .then((r) => r.rows[0]!.full_name),
      );
      expect(await emailDe(alvo.id)).toBe(alvo.email);
      expect(nome).not.toBe('Não Aplica');
    });

    it('e-mail de outra pessoa é 409 "email already in use" e nenhum campo é aplicado', async () => {
      const outra = await novaPessoa(unitB, 'collaborator');
      const alvo = await novaPessoa(unitA, 'collaborator');
      const res = await patch(unitAdminA, alvo.id, {
        email: outra.email,
        fullName: 'Nome Que Não Fica',
      });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'email already in use' });
      const linha = await withSystemBypass(pool, (client) =>
        client
          .query<{ email: string; full_name: string }>(
            'SELECT email, full_name FROM users WHERE id = $1',
            [alvo.id],
          )
          .then((r) => r.rows[0]!),
      );
      expect(linha.email).toBe(alvo.email);
      expect(linha.full_name).not.toBe('Nome Que Não Fica');
    });

    it('reenviar o próprio e-mail vigente não é conflito', async () => {
      const alvo = await novaPessoa(unitA, 'collaborator');
      const res = await patch(unitAdminA, alvo.id, { email: alvo.email, fullName: 'Novo Nome' });
      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe('Novo Nome');
    });
  });

  describe('efeito no login', () => {
    it('novo e-mail autentica com a senha antiga; o antigo é recusado como credencial inválida', async () => {
      const alvo = await novaPessoa(unitA, 'collaborator');
      const app = createApp(ports);

      const antesErrado = await request(app)
        .post('/auth/login')
        .send({ email: 'login-novo@test.dev', password: 'correct-password' });
      expect(antesErrado.status).toBe(401);

      expect((await patch(unitAdminA, alvo.id, { email: 'login-novo@test.dev' })).status).toBe(200);

      const novo = await request(app)
        .post('/auth/login')
        .send({ email: 'login-novo@test.dev', password: 'correct-password' });
      expect(novo.status).toBe(200);

      const antigo = await request(app)
        .post('/auth/login')
        .send({ email: alvo.email, password: 'correct-password' });
      expect(antigo.status).toBe(401);
      // Mesma resposta de qualquer credencial errada — sem revelar a troca.
      expect(antigo.body).toEqual(antesErrado.body);
    });

    it('sessão aberta antes da troca continua válida', async () => {
      const alvo = await novaPessoa(unitA, 'collaborator');
      const cookie = await sessionCookieFor(ports, alvo.id);
      const app = createApp(ports);

      expect((await request(app).get('/auth/me').set('Cookie', cookie)).status).toBe(200);
      expect((await patch(unitAdminA, alvo.id, { email: 'sessao-viva@test.dev' })).status).toBe(
        200,
      );
      expect((await request(app).get('/auth/me').set('Cookie', cookie)).status).toBe(200);
    });
  });
});
