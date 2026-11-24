import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { NotificationKind } from '@gdoc/shared';
import type { NotificationPort, NotifyInput } from '../ports/notification-port.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { runNotifyExpiringGrants } from '../jobs/notify-expiring-grants.js';
import { setupTestDatabase, seedTwoUnits, withSystemBypass } from './test-db.js';

/**
 * Change `expiracao-permissoes` — rotina de avisos (design.md D6/D7,
 * tasks.md 9.6-9.9). Testada diretamente contra `runNotifyExpiringGrants`,
 * sem passar pelo HTTP: o job é infraestrutura de manutenção (Cloud Run
 * Job), não uma rota de usuário.
 */
describe('Rotina de avisos de expiração (jobs/notify-expiring-grants.ts)', () => {
  let pool: Pool;
  let database: PgDatabasePort;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let recipientId: string;
  let unitAdminAId: string;
  let unitAdminBId: string;

  async function makeFile(unitId: string, ownerId: string, name: string): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status) VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
        [unitId, ownerId, `unit/${name}`, `${name}.txt`],
      ),
    );
    return rows[0]!.id;
  }

  async function insertGrant(resourceId: string, expiresAt: string) {
    await withSystemBypass(pool, (client) =>
      client.query(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
         VALUES ($1, $2, 'file', $3, 'view', $4, $5)`,
        [ids.unitA, recipientId, resourceId, unitAdminAId, expiresAt],
      ),
    );
  }

  async function notificationsOf(recipient: string, kind: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query(
        'SELECT payload, source_ref FROM notifications WHERE recipient_user_id = $1 AND kind = $2',
        [recipient, kind],
      ),
    );
    return rows;
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows: users } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'collab-notify@test.dev', 'x', 'collaborator'),
           ($1, 'unit-admin-notify-a@test.dev', 'x', 'unit_admin'),
           ($2, 'unit-admin-notify-b@test.dev', 'x', 'unit_admin')
         RETURNING id`,
        [ids.unitA, ids.unitB],
      ),
    );
    [recipientId, unitAdminAId, unitAdminBId] = users.map((u) => u.id) as [string, string, string];

    database = new PgDatabasePort();
  });

  afterAll(async () => {
    await database.close();
    await pool.end();
  });

  it('9.6/9.6 (janela): avisa vencimento dentro da janela; ignora fora da janela e sem prazo', async () => {
    const notifications = new InAppNotificationPort(database);
    const withinWindow = await makeFile(ids.unitA, ids.userA, 'dentro-da-janela');
    const outsideWindow = await makeFile(ids.unitA, ids.userA, 'fora-da-janela');
    const permanentFile = await makeFile(ids.unitA, ids.userA, 'permanente');

    await insertGrant(withinWindow, new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());
    await insertGrant(outsideWindow, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    // Sem prazo: nunca aparece na varredura de vencimento (grant permanente).
    await withSystemBypass(pool, (client) =>
      client.query(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by)
         VALUES ($1, $2, 'file', $3, 'view', $4)`,
        [ids.unitA, recipientId, permanentFile, unitAdminAId],
      ),
    );

    const summary = await runNotifyExpiringGrants({ database, notifications });
    expect(summary.expiringFailed).toBe(0);

    const notified = await notificationsOf(recipientId, NotificationKind.GRANT_EXPIRING);
    const resourceIds = notified.map((n) => n.payload.resourceId);
    expect(resourceIds).toContain(withinWindow);
    expect(resourceIds).not.toContain(outsideWindow);
    expect(resourceIds).not.toContain(permanentFile);
  });

  it('9.7: aviso de corte vai só ao unit_admin da unidade do grant; pessoa afetada não é avisada de novo', async () => {
    const notifications = new InAppNotificationPort(database);
    const expiredFile = await makeFile(ids.unitA, ids.userA, 'ja-vencido');
    await insertGrant(expiredFile, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    await runNotifyExpiringGrants({ database, notifications });

    const adminANotified = await notificationsOf(unitAdminAId, NotificationKind.GRANT_EXPIRED);
    expect(
      adminANotified.some(
        (n) => n.payload.resourceId === expiredFile && n.payload.subjectUserId === recipientId,
      ),
    ).toBe(true);

    const adminBNotified = await notificationsOf(unitAdminBId, NotificationKind.GRANT_EXPIRED);
    expect(adminBNotified.some((n) => n.payload.resourceId === expiredFile)).toBe(false);

    const recipientCutNotice = await notificationsOf(recipientId, NotificationKind.GRANT_EXPIRED);
    expect(recipientCutNotice.some((n) => n.payload.resourceId === expiredFile)).toBe(false);
  });

  it('9.8: job idempotente — duas execuções produzem uma única notificação por evento', async () => {
    const notifications = new InAppNotificationPort(database);
    const file = await makeFile(ids.unitA, ids.userA, 'idempotente');
    await insertGrant(file, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    await runNotifyExpiringGrants({ database, notifications });
    const afterFirst = await notificationsOf(unitAdminAId, NotificationKind.GRANT_EXPIRED);
    const countFirst = afterFirst.filter((n) => n.payload.resourceId === file).length;

    await runNotifyExpiringGrants({ database, notifications });
    const afterSecond = await notificationsOf(unitAdminAId, NotificationKind.GRANT_EXPIRED);
    const countSecond = afterSecond.filter((n) => n.payload.resourceId === file).length;

    expect(countFirst).toBe(1);
    expect(countSecond).toBe(1);
  });

  it('9.9: falha parcial na emissão não interrompe os demais avisos, e o sumário registra a falha', async () => {
    const fileOk = await makeFile(ids.unitA, ids.userA, 'sumario-ok');
    const fileFails = await makeFile(ids.unitA, ids.userA, 'sumario-falha');
    await insertGrant(fileOk, new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString());
    await insertGrant(fileFails, new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString());

    const real = new InAppNotificationPort(database);
    const flaky: NotificationPort = {
      notify: async (input: NotifyInput) => {
        // `payload` é união discriminada por `kind` desde a change
        // `arquivo-geral-e-pendente-de-cadastro`; estreitar antes de ler o
        // campo é o que mantém o canal aberto a assuntos que não são
        // concessão.
        if ('resourceId' in input.payload && input.payload.resourceId === fileFails) {
          throw new Error('falha simulada');
        }
        return real.notify(input);
      },
    };

    const summary = await runNotifyExpiringGrants({ database, notifications: flaky });
    expect(summary.expiringFailed).toBeGreaterThanOrEqual(1);

    const notified = await notificationsOf(recipientId, NotificationKind.GRANT_EXPIRING);
    expect(notified.some((n) => n.payload.resourceId === fileOk)).toBe(true);
    expect(notified.some((n) => n.payload.resourceId === fileFails)).toBe(false);
  });
});
