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
import type { FavoritesResponse, FolderContentsResponse } from '@gdoc/shared';
import { DocumentLifecycleState, Permission, UserRole } from '@gdoc/shared';
import { config } from '../config.js';
import { runPurge } from '../jobs/purge-trash.js';

/**
 * Favoritos (US 2.5, change `favoritos`, `routes/favorites.ts`).
 *
 * O risco da rota é de **alcance**, como na lista de compartilhados: favorito
 * não é permissão (design.md D3). Os casos abaixo codificam que marcar exige
 * `view` com recusa indistinguível de inexistente, que a lista é pessoal
 * (inclusive diante do administrador), que perder o acesso oculta sem apagar
 * e que o expurgo não deixa marca órfã.
 */
describe('Favoritos (routes/favorites.ts, US 2.5)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let adminA: string;
  let outroA: string;

  async function arquivo(p: {
    unitId: string;
    ownerId: string;
    nome: string;
    folderId?: string | null;
    lifecycleState?: string;
    deletedAt?: string;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, folder_id, status, lifecycle_state, deleted_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, $7::timestamptz) RETURNING id`,
        [
          p.unitId,
          p.ownerId,
          `fav-test/${p.nome}-${Math.random()}`,
          p.nome,
          p.folderId ?? null,
          p.lifecycleState ?? null,
          p.deletedAt ?? null,
        ],
      ),
    );
    return rows[0]!.id;
  }

  async function pasta(p: {
    unitId: string;
    ownerId: string;
    nome: string;
    parentId?: string | null;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, $3, $4) RETURNING id`,
        [p.unitId, p.ownerId, p.parentId ?? null, p.nome],
      ),
    );
    return rows[0]!.id;
  }

  async function conceder(p: {
    subject: string;
    resourceType: 'file' | 'folder';
    resourceId: string;
    permission?: Permission;
    expiresAt?: string | null;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz) RETURNING id`,
        [
          ids.unitA,
          p.subject,
          p.resourceType,
          p.resourceId,
          p.permission ?? Permission.VIEW,
          adminA,
          p.expiresAt ?? null,
        ],
      ),
    );
    return rows[0]!.id;
  }

  async function marcar(userId: string, tipo: string, id: string) {
    return request(createApp(ports))
      .put(`/favorites/${tipo}/${id}`)
      .set('Cookie', await sessionCookieFor(ports, userId));
  }

  async function desmarcar(userId: string, tipo: string, id: string) {
    return request(createApp(ports))
      .delete(`/favorites/${tipo}/${id}`)
      .set('Cookie', await sessionCookieFor(ports, userId));
  }

  async function listar(userId: string): Promise<FavoritesResponse> {
    const res = await request(createApp(ports))
      .get('/favorites')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body as FavoritesResponse;
  }

  async function marcasNoBanco(): Promise<number> {
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ n: string }>('SELECT count(*) AS n FROM favorites'),
    );
    return Number(rows[0]!.n);
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);
    const { rows } = await withSystemBypass(pool, (c) =>
      c.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'admin-a@favoritos.test', 'x', 'unit_admin'),
           ($1, 'outro-a@favoritos.test', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    [adminA, outroA] = rows.map((r) => r.id) as [string, string];
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
      await c.query('DELETE FROM favorites');
      await c.query('DELETE FROM grants');
      await c.query('DELETE FROM audit_events');
      await c.query('DELETE FROM files');
      await c.query('DELETE FROM folders');
    });
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  it('marca arquivo e pasta alcançáveis, e a lista os traz do mais recente para o mais antigo', async () => {
    const p = await pasta({ unitId: ids.unitA, ownerId: ids.userA, nome: 'Protocolos' });
    const a = await arquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      nome: 'pop.pdf',
      folderId: p,
    });

    expect((await marcar(ids.userA, 'folder', p)).status).toBe(200);
    expect((await marcar(ids.userA, 'file', a)).status).toBe(200);

    const { items } = await listar(ids.userA);
    expect(items.map((i) => [i.resourceType, i.id])).toEqual([
      ['file', a],
      ['folder', p],
    ]);
    expect(items[0]!.folderName).toBe('Protocolos');
    expect(items[0]!.file?.fileName).toBe('pop.pdf');
    expect(items[1]!.folderName).toBeNull();
    // Dono visualiza e baixa: os verbos vêm do servidor (design.md D3).
    expect(items[0]!.permissions).toEqual([Permission.VIEW, Permission.DOWNLOAD]);
  });

  it('marcar duas vezes é idempotente, e desmarcar o que não é favorito também', async () => {
    const a = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome: 'x.pdf' });
    const primeira = await marcar(ids.userA, 'file', a);
    const segunda = await marcar(ids.userA, 'file', a);
    expect(segunda.status).toBe(200);
    expect(segunda.body.favoritedAt).toBe(primeira.body.favoritedAt);
    expect(await marcasNoBanco()).toBe(1);

    expect((await desmarcar(ids.userA, 'file', a)).status).toBe(204);
    expect((await desmarcar(ids.userA, 'file', a)).status).toBe(204);
    expect(await marcasNoBanco()).toBe(0);
  });

  it('marcar sem alcance é recusado como inexistente: sem permissão, outra unidade, lixeira, id inválido (design.md D2)', async () => {
    const alheio = await arquivo({ unitId: ids.unitA, ownerId: outroA, nome: 'alheio.pdf' });
    const deB = await arquivo({ unitId: ids.unitB, ownerId: ids.userB, nome: 'b.pdf' });
    const naLixeira = await arquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      nome: 'lixo.pdf',
      deletedAt: new Date().toISOString(),
    });
    const inexistente = '00000000-0000-4000-8000-000000000000';

    const respostas = await Promise.all([
      marcar(ids.userA, 'file', alheio),
      marcar(ids.userA, 'file', deB),
      marcar(ids.userA, 'file', naLixeira),
      marcar(ids.userA, 'file', inexistente),
      marcar(ids.userA, 'arquivo', alheio),
      marcar(ids.userA, 'file', 'nao-e-uuid'),
    ]);
    for (const res of respostas) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'not_found' });
    }
    // Inclusive para o admin global, que pertence à unidade A: a trava do
    // bypass vale aqui como em toda rota de conteúdo.
    expect((await marcar(ids.globalAdmin, 'file', deB)).status).toBe(404);
    expect(await marcasNoBanco()).toBe(0);
  });

  it('a lista é pessoal: favorito de outra pessoa não aparece, nem ao administrador da unidade', async () => {
    const a = await arquivo({ unitId: ids.unitA, ownerId: outroA, nome: 'dele.pdf' });
    expect((await marcar(outroA, 'file', a)).status).toBe(200);

    expect((await listar(adminA)).items).toEqual([]);
    expect((await listar(ids.userA)).items).toEqual([]);
    // E desmarcar alheio não toca a marca da outra pessoa.
    await desmarcar(adminA, 'file', a);
    expect(await marcasNoBanco()).toBe(1);
  });

  it('concessão vencida oculta o favorito sem apagar a marca, e nova concessão o devolve (design.md D3)', async () => {
    const a = await arquivo({ unitId: ids.unitA, ownerId: outroA, nome: 'concedido.pdf' });
    const grant = await conceder({ subject: ids.userA, resourceType: 'file', resourceId: a });
    expect((await marcar(ids.userA, 'file', a)).status).toBe(200);
    // Só `view`: a ação de baixar não é devolvida.
    expect((await listar(ids.userA)).items[0]!.permissions).toEqual([Permission.VIEW]);

    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE grants SET expires_at = now() - interval '1 minute' WHERE id = $1`, [grant]),
    );
    expect((await listar(ids.userA)).items).toEqual([]);
    expect(await marcasNoBanco()).toBe(1);

    await conceder({
      subject: ids.userA,
      resourceType: 'file',
      resourceId: a,
      permission: Permission.DOWNLOAD,
    });
    await withSystemBypass(pool, (c) =>
      c.query(`UPDATE grants SET expires_at = NULL WHERE id = $1`, [grant]),
    );
    expect((await listar(ids.userA)).items.map((i) => i.id)).toEqual([a]);
  });

  it('desmarcar não exige alcance: quem perdeu o acesso limpa a própria marca (design.md D2)', async () => {
    const a = await arquivo({ unitId: ids.unitA, ownerId: outroA, nome: 'perdido.pdf' });
    const grant = await conceder({ subject: ids.userA, resourceType: 'file', resourceId: a });
    await marcar(ids.userA, 'file', a);
    await withSystemBypass(pool, (c) => c.query('DELETE FROM grants WHERE id = $1', [grant]));

    expect((await desmarcar(ids.userA, 'file', a)).status).toBe(204);
    expect(await marcasNoBanco()).toBe(0);
  });

  it('documento obsoleto some para o colaborador e permanece para o administrador', async () => {
    const a = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome: 'velho.pdf' });
    await marcar(ids.userA, 'file', a);
    await marcar(adminA, 'file', a);
    await withSystemBypass(pool, (c) =>
      c.query('UPDATE files SET lifecycle_state = $1 WHERE id = $2', [
        DocumentLifecycleState.OBSOLETE,
        a,
      ]),
    );

    expect((await listar(ids.userA)).items).toEqual([]);
    expect((await listar(adminA)).items.map((i) => i.id)).toEqual([a]);
  });

  it('ir para a lixeira oculta; restaurar devolve; o expurgo apaga a marca (design.md D7)', async () => {
    const a = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome: 'ciclo.pdf' });
    const p = await pasta({ unitId: ids.unitA, ownerId: ids.userA, nome: 'Velha' });
    await marcar(ids.userA, 'file', a);
    await marcar(ids.userA, 'folder', p);

    await withSystemBypass(pool, (c) =>
      c.query('UPDATE files SET deleted_at = now() WHERE id = $1', [a]),
    );
    expect((await listar(ids.userA)).items.map((i) => i.id)).toEqual([p]);

    await withSystemBypass(pool, (c) =>
      c.query('UPDATE files SET deleted_at = NULL WHERE id = $1', [a]),
    );
    expect((await listar(ids.userA)).items.map((i) => i.id).sort()).toEqual([a, p].sort());

    await withSystemBypass(pool, async (c) => {
      await c.query(`UPDATE files SET deleted_at = now() - interval '400 days' WHERE id = $1`, [a]);
      await c.query(`UPDATE folders SET deleted_at = now() - interval '400 days' WHERE id = $1`, [
        p,
      ]);
    });
    await runPurge(ports);
    expect(await marcasNoBanco()).toBe(0);
  });

  it('a localização é só a pasta que contém o item, nunca as ancestrais', async () => {
    const raiz = await pasta({ unitId: ids.unitA, ownerId: outroA, nome: 'Reservada' });
    const meio = await pasta({
      unitId: ids.unitA,
      ownerId: outroA,
      nome: 'Intermediaria',
      parentId: raiz,
    });
    const a = await arquivo({
      unitId: ids.unitA,
      ownerId: outroA,
      nome: 'fundo.pdf',
      folderId: meio,
    });
    await conceder({ subject: ids.userA, resourceType: 'file', resourceId: a });
    await marcar(ids.userA, 'file', a);

    const corpo = await listar(ids.userA);
    expect(corpo.items[0]!.folderName).toBe('Intermediaria');
    expect(JSON.stringify(corpo)).not.toContain('Reservada');
  });

  it('acima do teto por pessoa a marcação é recusada com motivo próprio (design.md D4)', async () => {
    const teto = config.favorites.maxPerUser;
    config.favorites.maxPerUser = 2;
    try {
      for (const nome of ['um.pdf', 'dois.pdf']) {
        const id = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome });
        expect((await marcar(ids.userA, 'file', id)).status).toBe(200);
      }
      const terceiro = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome: 'tres.pdf' });
      const res = await marcar(ids.userA, 'file', terceiro);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'favorites_limit_exceeded', allowed: 2 });
    } finally {
      config.favorites.maxPerUser = teto;
    }
  });

  it('a listagem de pasta indica o que é favorito de quem consulta (design.md D5)', async () => {
    const p = await pasta({ unitId: ids.unitA, ownerId: ids.userA, nome: 'Minha' });
    const a = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome: 'raiz.pdf' });
    const b = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome: 'outro.pdf' });
    await marcar(ids.userA, 'folder', p);
    await marcar(ids.userA, 'file', a);
    await marcar(adminA, 'file', b);

    const res = await request(createApp(ports))
      .get('/folders/root/contents')
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    const body = res.body as FolderContentsResponse;
    expect(body.favoriteFolderIds).toEqual([p]);
    // A marca do administrador sobre `b` não aparece para quem consulta.
    expect(body.favoriteFileIds).toEqual([a]);
  });

  it('a RLS isola a tabela por unidade', async () => {
    const a = await arquivo({ unitId: ids.unitA, ownerId: ids.userA, nome: 'rls.pdf' });
    await marcar(ids.userA, 'file', a);
    const visto = await ports.database.withTenantTransaction(
      { userId: ids.userB, unitId: ids.unitB, role: UserRole.COLLABORATOR },
      (c) => c.query('SELECT * FROM favorites'),
    );
    expect(visto.rows).toEqual([]);
  });

  it('sem sessão retorna 401', async () => {
    expect((await request(createApp(ports)).get('/favorites')).status).toBe(401);
  });
});
