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

interface AdminEvent {
  unit_id: string;
  actor_user_id: string;
  target_user_id: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

/**
 * Registro administrativo da edição de pessoa (change `edicao-email-pessoa`,
 * capability `auditoria-administrativa`, design.md D3/D5): só edição
 * **efetiva** gera evento, com anterior e novo de cada campo alterado, na
 * mesma transação da edição e na unidade da pessoa editada.
 */
describe('Registro administrativo da edição de pessoa', () => {
  let pool: Pool;
  let ports: Ports;
  let passwordHash: string;
  let unitA: string;
  let unitB: string;
  let globalAdminA: string;
  let unitAdminA: string;
  let setorA: string;
  let contador = 0;

  async function novaPessoa(
    unitId: string,
    role: string,
    extra: { sectorId?: string } = {},
  ): Promise<{ id: string; email: string }> {
    contador += 1;
    const email = `audit-${contador}@test.dev`;
    const id = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO users (unit_id, email, password_hash, role, full_name, sector_id)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [unitId, email, passwordHash, role, `Pessoa ${contador}`, extra.sectorId ?? null],
        )
        .then((r) => r.rows[0]!.id),
    );
    return { id, email };
  }

  async function eventosDe(targetId: string): Promise<AdminEvent[]> {
    return withSystemBypass(pool, (client) =>
      client
        .query<AdminEvent>(
          `SELECT unit_id, actor_user_id, target_user_id, action, changes
             FROM admin_events WHERE target_user_id = $1 ORDER BY created_at`,
          [targetId],
        )
        .then((r) => r.rows),
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
    setorA = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO sectors (unit_id, name) VALUES ($1, 'RH') RETURNING id`,
          [unitA],
        )
        .then((r) => r.rows[0]!.id),
    );

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

  it('troca de e-mail registra autor, pessoa, unidade e o e-mail anterior e o novo', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator');
    expect((await patch(unitAdminA, alvo.id, { email: 'novo-audit@test.dev' })).status).toBe(200);

    const eventos = await eventosDe(alvo.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      unit_id: unitA,
      actor_user_id: unitAdminA,
      target_user_id: alvo.id,
      action: 'person_updated',
      changes: { email: { from: alvo.email, to: 'novo-audit@test.dev' } },
    });
    expect(Object.keys(eventos[0]!.changes)).toEqual(['email']);
  });

  it('papel e status alterados na mesma requisição geram um evento com os dois', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator');
    const res = await patch(globalAdminA, alvo.id, { role: 'unit_admin', status: 'disabled' });
    expect(res.status).toBe(200);

    const eventos = await eventosDe(alvo.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.changes).toEqual({
      role: { from: 'collaborator', to: 'unit_admin' },
      status: { from: 'active', to: 'disabled' },
    });
  });

  it('campos reenviados com o valor vigente não entram no registro', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator');
    const res = await patch(unitAdminA, alvo.id, {
      fullName: 'Nome Novo',
      role: 'collaborator',
      status: 'active',
      email: alvo.email,
    });
    expect(res.status).toBe(200);
    const eventos = await eventosDe(alvo.id);
    expect(eventos).toHaveLength(1);
    expect(Object.keys(eventos[0]!.changes)).toEqual(['fullName']);
  });

  it('edição sem nenhuma mudança efetiva não grava registro', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator');
    const res = await patch(unitAdminA, alvo.id, { role: 'collaborator', status: 'active' });
    expect(res.status).toBe(200);
    expect(await eventosDe(alvo.id)).toEqual([]);
  });

  it('cota concedida e removida aparecem em bytes, com "sem exceção" como null', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator');
    expect((await patch(globalAdminA, alvo.id, { storageQuotaBytes: 5_000 })).status).toBe(200);
    expect((await patch(globalAdminA, alvo.id, { storageQuotaBytes: null })).status).toBe(200);
    const eventos = await eventosDe(alvo.id);
    expect(eventos.map((e) => e.changes)).toEqual([
      { storageQuotaBytes: { from: null, to: 5000 } },
      { storageQuotaBytes: { from: 5000, to: null } },
    ]);
  });

  it('remoção de setor registra o setor anterior e null', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator', { sectorId: setorA });
    expect((await patch(unitAdminA, alvo.id, { sectorId: null })).status).toBe(200);
    const eventos = await eventosDe(alvo.id);
    expect(eventos.map((e) => e.changes)).toEqual([{ sectorId: { from: setorA, to: null } }]);
  });

  it('global_admin da unidade A editando pessoa da unidade B grava o evento na unidade B', async () => {
    const alvo = await novaPessoa(unitB, 'collaborator');
    expect((await patch(globalAdminA, alvo.id, { phone: '71 9999-0000' })).status).toBe(200);
    const eventos = await eventosDe(alvo.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.unit_id).toBe(unitB);
    expect(eventos[0]!.actor_user_id).toBe(globalAdminA);
  });

  it('edições recusadas não gravam registro', async () => {
    const outra = await novaPessoa(unitB, 'collaborator');
    const admin = await novaPessoa(unitA, 'unit_admin');
    const alvo = await novaPessoa(unitA, 'collaborator');
    const setorB = await withSystemBypass(pool, (client) =>
      client
        .query<{ id: string }>(
          `INSERT INTO sectors (unit_id, name) VALUES ($1, 'TI') RETURNING id`,
          [unitB],
        )
        .then((r) => r.rows[0]!.id),
    );

    // fora do alcance (unit_admin sobre unit_admin)
    expect((await patch(unitAdminA, admin.id, { fullName: 'X' })).status).toBe(403);
    // e-mail em uso
    expect((await patch(unitAdminA, alvo.id, { email: outra.email, fullName: 'Y' })).status).toBe(
      409,
    );
    // setor de outra unidade
    expect((await patch(unitAdminA, alvo.id, { sectorId: setorB, fullName: 'Z' })).status).toBe(
      409,
    );
    // trava de auto-edição
    expect((await patch(admin.id, admin.id, { status: 'disabled' })).status).toBe(403);

    expect(await eventosDe(admin.id)).toEqual([]);
    expect(await eventosDe(alvo.id)).toEqual([]);
  });

  it('nenhum campo de senha aparece no registro', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator');
    await patch(unitAdminA, alvo.id, { fullName: 'Nome Qualquer', password: 'Outra-Senha-123!' });
    const eventos = await eventosDe(alvo.id);
    expect(eventos).toHaveLength(1);
    expect(Object.keys(eventos[0]!.changes)).toEqual(['fullName']);
    expect(JSON.stringify(eventos[0]!.changes)).not.toContain('Outra-Senha-123!');
  });

  it('falha ao gravar o registro desfaz a edição inteira', async () => {
    const alvo = await novaPessoa(unitA, 'collaborator');
    // Trigger só deste teste, que faz o INSERT em `admin_events` falhar.
    await pool.query(`
      CREATE OR REPLACE FUNCTION test_admin_events_falha() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'falha simulada do registro'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER test_admin_events_falha BEFORE INSERT ON admin_events
        FOR EACH ROW EXECUTE FUNCTION test_admin_events_falha();
    `);
    try {
      const res = await patch(unitAdminA, alvo.id, {
        email: 'nao-deve-ficar@test.dev',
        fullName: 'Também Não',
      });
      expect(res.status).toBe(500);
    } finally {
      await pool.query(`
        DROP TRIGGER test_admin_events_falha ON admin_events;
        DROP FUNCTION test_admin_events_falha();
      `);
    }
    const linha = await withSystemBypass(pool, (client) =>
      client
        .query<{ email: string; full_name: string }>(
          'SELECT email, full_name FROM users WHERE id = $1',
          [alvo.id],
        )
        .then((r) => r.rows[0]!),
    );
    expect(linha.email).toBe(alvo.email);
    expect(linha.full_name).not.toBe('Também Não');
    expect(await eventosDe(alvo.id)).toEqual([]);
  });
});
