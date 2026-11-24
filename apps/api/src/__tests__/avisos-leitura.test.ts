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
import type { NotificationPort } from '../ports/notification-port.js';
import type { ReadingAudience } from '@gdoc/shared';
import { runNotifyReadings } from '../jobs/notify-readings.js';

/**
 * Avisos de leitura obrigatória (US 12.5, change `avisos-e-atrasos`).
 *
 * Fixa os três avisos, a idempotência (uma vez por leitura e prazo), o alcance
 * do gestor (setor, unidade, e nunca outra unidade) e a reconciliação diária
 * de quem entra depois no público.
 */
describe('Avisos de leitura obrigatória (lib/reading-notices.ts, jobs/notify-readings.ts)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let leitora: string;
  let leitor2: string;
  let leitor3: string;
  let desativado: string;
  let gestorCme: string;
  let gestorUti: string;
  let gestorUnidade: string;
  let governancaB: string;
  let setorCme: string;
  let setorUti: string;
  let doc: string;

  const publico = (over: Partial<ReadingAudience> = {}): ReadingAudience => ({
    wholeUnit: false,
    sectorIds: [],
    roles: [],
    userIds: [],
    ...over,
  });

  async function marcar(audience: ReadingAudience, p: Ports = ports) {
    const app = createApp(p);
    const cookie = await sessionCookieFor(p, ids.userA);
    return request(app)
      .post('/reading/campaigns')
      .set('Cookie', cookie)
      .send({ fileId: doc, audience });
  }

  async function avisos(userId: string, kind?: string) {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{
        kind: string;
        payload: Record<string, unknown>;
        unit_id: string;
        source_ref: string;
      }>(
        `SELECT kind, payload, unit_id, source_ref FROM notifications
         WHERE recipient_user_id = $1 ${kind ? 'AND kind = $2' : ''} ORDER BY created_at`,
        kind ? [userId, kind] : [userId],
      ),
    );
    return rows;
  }

  async function atrasar() {
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE reading_assignments SET due_date = current_date - 2`),
    );
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);
    const { rows: setores } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO sectors (unit_id, name) VALUES ($1, 'CME'), ($1, 'UTI') RETURNING id`,
        [ids.unitA],
      ),
    );
    [setorCme, setorUti] = setores.map((s) => s.id) as [string, string];
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role, full_name, sector_id, status, reading_oversight) VALUES
           ($1, 'leitora@avisos.test', 'x', 'collaborator', 'Ana Leitora', $2, 'active', NULL),
           ($1, 'leitor2@avisos.test', 'x', 'collaborator', 'Bruno Leitor', $2, 'active', NULL),
           ($1, 'leitor3@avisos.test', 'x', 'collaborator', 'Carla Leitora', $3, 'active', NULL),
           ($1, 'desativado@avisos.test', 'x', 'collaborator', 'Desativado', $2, 'active', NULL),
           ($1, 'gestor.cme@avisos.test', 'x', 'collaborator', 'Gestor CME', $2, 'active', 'sector'),
           ($1, 'gestor.uti@avisos.test', 'x', 'collaborator', 'Gestor UTI', $3, 'active', 'sector'),
           ($1, 'gestor.unidade@avisos.test', 'x', 'collaborator', 'Gestor Unidade', NULL, 'active', 'unit'),
           ($4, 'governanca.b@avisos.test', 'x', 'collaborator', 'Governança B', NULL, 'active', 'all_units')
         RETURNING id`,
        [ids.unitA, setorCme, setorUti, ids.unitB],
      ),
    );
    [leitora, leitor2, leitor3, desativado, gestorCme, gestorUti, gestorUnidade, governancaB] =
      rows.map((r) => r.id) as [string, string, string, string, string, string, string, string];
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

  beforeEach(async () => {
    await withSystemBypass(pool, async (c) => {
      await c.query('DELETE FROM notifications');
      await c.query('DELETE FROM reading_assignments');
      await c.query('DELETE FROM reading_campaigns');
      await c.query('DELETE FROM files');
      await c.query(
        `UPDATE users SET status = 'active', sector_id = $1 WHERE id = ANY($2::uuid[])`,
        [setorCme, [leitora, leitor2, desativado]],
      );
      await c.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorUti, leitor3]);
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, status, document_type,
           document_code, document_revision, responsible_sector, next_review_at, content_type)
         VALUES ($1, $2, 'avisos/doc', 'PRT-NSP-001 Higienização.pdf', 'active', 'protocol',
           'PRT-NSP-001', 2, 'CME', '2099-01-01', 'application/pdf') RETURNING id`,
        [ids.unitA, ids.userA],
      );
      doc = rows[0]!.id;
    });
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  it('marcar avisa cada pessoa do público, com documento e prazo; a rotina não reavisa', async () => {
    const res = await marcar(publico({ userIds: [leitora, leitor2] }));
    expect(res.status).toBe(201);

    for (const pessoa of [leitora, leitor2]) {
      const [aviso, ...resto] = await avisos(pessoa, 'reading_assigned');
      expect(resto).toHaveLength(0);
      expect(aviso!.unit_id).toBe(ids.unitA);
      expect(aviso!.payload).toMatchObject({
        documentCode: 'PRT-NSP-001',
        documentTitle: 'PRT-NSP-001 Higienização.pdf',
        documentRevision: 2,
        dueDate: res.body.dueDate,
      });
    }
    expect(await avisos(leitor3)).toHaveLength(0);

    const resumo = await runNotifyReadings(ports);
    expect(resumo.assignedNotified).toBe(0);
    expect(await avisos(leitora, 'reading_assigned')).toHaveLength(1);
  });

  it('falha ao avisar não desfaz a marcação; a rotina emite o que faltou', async () => {
    const quebrado: NotificationPort = {
      notify: async () => {
        throw new Error('canal fora do ar');
      },
    };
    const res = await marcar(publico({ userIds: [leitora] }), {
      ...ports,
      notifications: quebrado,
    });
    expect(res.status).toBe(201);
    expect(await avisos(leitora)).toHaveLength(0);

    expect((await runNotifyReadings(ports)).assignedNotified).toBe(1);
    expect(await avisos(leitora, 'reading_assigned')).toHaveLength(1);
  });

  it('a rotina alcança quem trocou de setor, com 15 dias de prazo e aviso', async () => {
    await marcar(publico({ sectorIds: [setorCme] }));
    expect(await avisos(leitor3)).toHaveLength(0);

    await withSystemBypass(pool, (c) =>
      c.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorCme, leitor3]),
    );
    const resumo = await runNotifyReadings(ports);
    expect(resumo.reconciled).toBe(1);

    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ ok: boolean }>(
        `SELECT due_date = current_date + 15 AS ok FROM reading_assignments WHERE user_id = $1`,
        [leitor3],
      ),
    );
    expect(rows[0]!.ok).toBe(true);
    expect(await avisos(leitor3, 'reading_assigned')).toHaveLength(1);
    // Reexecutar não cria de novo nem reavisa.
    expect((await runNotifyReadings(ports)).reconciled).toBe(0);
    expect(await avisos(leitor3, 'reading_assigned')).toHaveLength(1);
  });

  it('quem entra depois e consulta as próprias leituras é avisado ali', async () => {
    await marcar(publico({ sectorIds: [setorCme] }));
    await withSystemBypass(pool, (c) =>
      c.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorCme, leitor3]),
    );
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, leitor3);
    expect((await request(app).get('/reading/mine').set('Cookie', cookie)).status).toBe(200);
    expect(await avisos(leitor3, 'reading_assigned')).toHaveLength(1);
    await request(app).get('/reading/mine').set('Cookie', cookie);
    expect(await avisos(leitor3, 'reading_assigned')).toHaveLength(1);
  });

  it('marcação encerrada (nova revisão) não alcança ninguém pela rotina', async () => {
    await marcar(publico({ sectorIds: [setorCme] }));
    await withSystemBypass(pool, async (c) => {
      await c.query('UPDATE files SET document_revision = 3 WHERE id = $1', [doc]);
      await c.query('UPDATE users SET sector_id = $1 WHERE id = $2', [setorCme, leitor3]);
    });
    expect((await runNotifyReadings(ports)).reconciled).toBe(0);
    expect(await avisos(leitor3)).toHaveLength(0);
  });

  it('atraso: leitor e gestores do alcance avisados uma vez, agregado e sem atravessar unidade', async () => {
    await marcar(publico({ userIds: [leitora, leitor2, leitor3, desativado] }));
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE users SET status = 'disabled' WHERE id = $1`, [desativado]),
    );
    await atrasar();

    await runNotifyReadings(ports);

    for (const pessoa of [leitora, leitor2, leitor3]) {
      expect(await avisos(pessoa, 'reading_overdue')).toHaveLength(1);
    }
    expect(await avisos(desativado, 'reading_overdue')).toHaveLength(0);

    // Gestor do setor CME: um aviso, com os dois do setor (não o desativado).
    const [cme, ...maisCme] = await avisos(gestorCme, 'reading_overdue_team');
    expect(maisCme).toHaveLength(0);
    expect(cme!.payload).toMatchObject({
      documentCode: 'PRT-NSP-001',
      lateCount: 2,
      people: [
        { name: 'Ana Leitora', sectorName: 'CME' },
        { name: 'Bruno Leitor', sectorName: 'CME' },
      ],
    });
    // Gestor da UTI só vê a Carla; gestor da unidade vê os três.
    expect((await avisos(gestorUti, 'reading_overdue_team'))[0]!.payload).toMatchObject({
      lateCount: 1,
      people: [{ name: 'Carla Leitora', sectorName: 'UTI' }],
    });
    expect((await avisos(gestorUnidade, 'reading_overdue_team'))[0]!.payload).toMatchObject({
      lateCount: 3,
    });
    // "Todas as unidades" em outra unidade não recebe nome desta.
    expect(await avisos(governancaB)).toHaveLength(0);

    // Reexecução não reavisa ninguém.
    const segunda = await runNotifyReadings(ports);
    expect(segunda.overdueNotified + segunda.teamNotified).toBe(0);
    expect(await avisos(gestorCme, 'reading_overdue_team')).toHaveLength(1);
    expect(await avisos(leitora, 'reading_overdue')).toHaveLength(1);
  });

  it('quem confirmou antes da rotina não gera aviso de atraso, nem para o gestor', async () => {
    await marcar(publico({ userIds: [leitora] }));
    await atrasar();
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE reading_assignments SET acknowledged_at = now() WHERE user_id = $1`, [
        leitora,
      ]),
    );
    await runNotifyReadings(ports);
    expect(await avisos(leitora, 'reading_overdue')).toHaveLength(0);
    expect(await avisos(gestorCme, 'reading_overdue_team')).toHaveLength(0);
  });

  it('o gestor não é avisado do próprio atraso como gestor', async () => {
    await marcar(publico({ userIds: [gestorCme] }));
    await atrasar();
    await runNotifyReadings(ports);
    expect(await avisos(gestorCme, 'reading_overdue')).toHaveLength(1);
    expect(await avisos(gestorCme, 'reading_overdue_team')).toHaveLength(0);
    expect((await avisos(gestorUnidade, 'reading_overdue_team'))[0]!.payload).toMatchObject({
      lateCount: 1,
      people: [{ name: 'Gestor CME' }],
    });
  });

  it('o sino lista os avisos de leitura da própria pessoa', async () => {
    await marcar(publico({ userIds: [leitora] }));
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, leitora);
    const res = await request(app).get('/notifications').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.notifications.map((n: { kind: string }) => n.kind)).toEqual([
      'reading_assigned',
    ]);
  });
});
