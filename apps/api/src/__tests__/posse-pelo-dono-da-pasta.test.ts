import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { GrantResourceType, Permission } from '@gdoc/shared';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import { authorshipPermissions, resolveNewItemOwner } from '../lib/authorship.js';
import {
  setupTestDatabase,
  seedTwoUnits,
  withSystemBypass,
  sessionCookieFor,
  controleDeTeste,
} from './test-db.js';
import type { Ports } from '../ports/index.js';

/**
 * Change `posse-pelo-dono-da-pasta` (PRD US 2.1, US 3.1/3.2, US 8.1): item
 * criado dentro de uma pasta pertence ao dono imediato dela; a autoria fica
 * registrada à parte; o autor que não é dono recebe `view`/`download`/`rename`
 * (+ `upload` em pasta), nunca `delete`; a cota decidida é a do dono.
 *
 * Personagens (todos da Unidade A, salvo `outraUnidade`):
 * - `daniel`  — colaborador dono da pasta "Contratos";
 * - `carlos`  — colaborador com `upload` sobre "Contratos" (o caso do chamado);
 * - `olivia`  — colaboradora sem concessão alguma;
 * - `gestora` — `unit_admin` da Unidade A;
 * - `ids.globalAdmin` — concede as permissões nos arranjos.
 */
describe('Posse pelo dono da pasta', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let daniel: string;
  let carlos: string;
  let olivia: string;
  let gestora: string;
  let contratos: string;
  let pastaUnidadeB: string;

  const app = () => createApp(ports);
  const cookie = (userId: string) => sessionCookieFor(ports, userId);

  async function grant(userId: string, resourceType: string, resourceId: string, perms: string[]) {
    const res = await request(app())
      .post('/grants')
      .set('Cookie', await cookie(ids.globalAdmin))
      .send({ subjectUserIds: [userId], resourceType, resourceId, permissions: perms });
    expect(res.status).toBe(201);
  }

  async function grantsOf(userId: string, resourceId: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ permission: string; origin: string; expires_at: string | null }>(
        'SELECT permission, origin, expires_at FROM grants WHERE subject_user_id = $1 AND resource_id = $2 ORDER BY permission',
        [userId, resourceId],
      ),
    );
    return rows;
  }

  async function fileRow(fileId: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ owner_id: string; uploaded_by: string; object_path: string }>(
        'SELECT owner_id, uploaded_by, object_path FROM files WHERE id = $1',
        [fileId],
      ),
    );
    return rows[0]!;
  }

  async function fileIdByName(name: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>('SELECT id FROM files WHERE file_name = $1', [name]),
    );
    return rows[0]!.id;
  }

  async function setQuota(userId: string, bytes: number | null, used = 0) {
    await withSystemBypass(pool, (client) =>
      client.query(
        'UPDATE users SET storage_quota_bytes = $1, storage_used_bytes = $2 WHERE id = $3',
        [bytes, used, userId],
      ),
    );
  }

  async function usedBytes(userId: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ storage_used_bytes: string }>(
        'SELECT storage_used_bytes FROM users WHERE id = $1',
        [userId],
      ),
    );
    return Number(rows[0]!.storage_used_bytes);
  }

  async function novaPasta(asUser: string, name: string, parentId?: string) {
    return request(app())
      .post('/folders')
      .set('Cookie', await cookie(asUser))
      .send({ name, parentId });
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string; email: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'daniel@test.dev', 'x', 'collaborator'),
           ($1, 'carlos@test.dev', 'x', 'collaborator'),
           ($1, 'olivia@test.dev', 'x', 'collaborator'),
           ($1, 'gestora@test.dev', 'x', 'unit_admin')
         RETURNING id, email`,
        [ids.unitA],
      ),
    );
    const byEmail = (e: string) => rows.find((r) => r.email === e)!.id;
    daniel = byEmail('daniel@test.dev');
    carlos = byEmail('carlos@test.dev');
    olivia = byEmail('olivia@test.dev');
    gestora = byEmail('gestora@test.dev');

    const secrets = new EnvSecretsPort();
    const database = new PgDatabasePort();
    ports = {
      database,
      notifications: new InAppNotificationPort(database),
      storage: new InMemoryStoragePort(),
      secrets,
      auth: new Argon2AuthPort(secrets),
    };

    const res = await novaPasta(daniel, 'Contratos');
    expect(res.status).toBe(201);
    contratos = res.body.id;
    await grant(carlos, 'folder', contratos, ['upload']);

    pastaUnidadeB = (await novaPasta(ids.userB, 'Pasta B')).body.id;
  });

  afterAll(async () => {
    await ports.database.close();
    await pool.end();
  });

  describe('helpers de posse e autoria', () => {
    it('dono do item novo é o dono imediato da pasta-pai; na raiz, quem cria', () => {
      expect(resolveNewItemOwner({ owner_id: 'd' }, { userId: 'c' })).toBe('d');
      expect(resolveNewItemOwner(null, { userId: 'c' })).toBe('c');
    });

    it('verbos automáticos nunca incluem delete; upload só em pasta', () => {
      expect(authorshipPermissions(GrantResourceType.FILE).sort()).toEqual(
        [Permission.DOWNLOAD, Permission.RENAME, Permission.VIEW].sort(),
      );
      expect(authorshipPermissions(GrantResourceType.FOLDER).sort()).toEqual(
        [Permission.DOWNLOAD, Permission.RENAME, Permission.UPLOAD, Permission.VIEW].sort(),
      );
    });
  });

  describe('POST /folders', () => {
    it('colaborador com upload cria subpasta na pasta alheia: dono = dono da pasta-pai, autor = quem criou', async () => {
      const res = await novaPasta(
        carlos,
        'PRESTAÇÃO DE CONTAS ITABUNA - TF N° 001/2025',
        contratos,
      );
      expect(res.status).toBe(201);
      expect(res.body.ownerId).toBe(daniel);
      // O nome com acentos, `°` e `/` vira uma única pasta, não um caminho.
      expect(res.body.name).toBe('PRESTAÇÃO DE CONTAS ITABUNA - TF N° 001/2025');
      expect(res.body.parentId).toBe(contratos);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ created_by: string }>('SELECT created_by FROM folders WHERE id = $1', [
          res.body.id,
        ]),
      );
      expect(rows[0]!.created_by).toBe(carlos);

      const concedidos = await grantsOf(carlos, res.body.id);
      expect(concedidos.map((g) => g.permission)).toEqual(['download', 'rename', 'upload', 'view']);
      expect(concedidos.every((g) => g.origin === 'autoria' && g.expires_at === null)).toBe(true);
    });

    it('concessão automática não gera aviso ao autor', async () => {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ n: string }>(
          "SELECT count(*) AS n FROM notifications WHERE recipient_user_id = $1 AND kind LIKE 'grant%'",
          [carlos],
        ),
      );
      // Só o aviso da concessão **manual** de `upload` sobre "Contratos".
      expect(Number(rows[0]!.n)).toBeLessThanOrEqual(1);
    });

    it('autor continua enviando dentro da subpasta que criou e a lista', async () => {
      const sub = await novaPasta(carlos, 'Sub do Carlos', contratos);
      const neta = await novaPasta(carlos, 'Neta', sub.body.id);
      expect(neta.status).toBe(201);
      // Cascata: a neta nasce na pasta de Daniel → dona é Daniel.
      expect(neta.body.ownerId).toBe(daniel);

      const contents = await request(app())
        .get(`/folders/${sub.body.id}/contents`)
        .set('Cookie', await cookie(carlos));
      expect(contents.status).toBe(200);
      expect(contents.body.folders.map((f: { name: string }) => f.name)).toContain('Neta');
      expect(contents.body.ownedByRequester).toBe(false);
    });

    it('administrador da unidade cria subpasta em pasta de outra pessoa', async () => {
      const res = await novaPasta(gestora, 'Da gestão', contratos);
      expect(res.status).toBe(201);
      expect(res.body.ownerId).toBe(daniel);
    });

    it('sem posse, administração ou upload → 403, sem criar nada', async () => {
      const res = await novaPasta(olivia, 'Intrusa', contratos);
      expect(res.status).toBe(403);
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query("SELECT 1 FROM folders WHERE name = 'Intrusa'"),
      );
      expect(rows).toHaveLength(0);
    });

    it('concessão de upload expirada não autoriza', async () => {
      const pasta = (await novaPasta(daniel, 'Expirada')).body.id;
      await withSystemBypass(pool, (client) =>
        client.query(
          `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
           VALUES ($1, $2, 'folder', $3, 'upload', $4, now() - interval '1 day')`,
          [ids.unitA, olivia, pasta, ids.globalAdmin],
        ),
      );
      expect((await novaPasta(olivia, 'Tardia', pasta)).status).toBe(403);
    });

    it('pasta-pai de outra unidade ou inexistente → 403 indistinguível', async () => {
      const outra = await novaPasta(carlos, 'X', pastaUnidadeB);
      const inexistente = await novaPasta(carlos, 'X', '00000000-0000-0000-0000-000000000000');
      expect(outra.status).toBe(403);
      expect(inexistente.status).toBe(403);
      expect(outra.body).toEqual(inexistente.body);
    });

    it('na raiz e em pasta própria, quem cria é dono e não recebe concessão automática', async () => {
      const raiz = await novaPasta(carlos, 'Raiz do Carlos');
      expect(raiz.body.ownerId).toBe(carlos);
      const propria = await novaPasta(carlos, 'Filha própria', raiz.body.id);
      expect(propria.body.ownerId).toBe(carlos);
      expect(await grantsOf(carlos, raiz.body.id)).toHaveLength(0);
      expect(await grantsOf(carlos, propria.body.id)).toHaveLength(0);
    });
  });

  describe('envio de arquivos para pasta alheia', () => {
    it('envio avulso: dono = dono da pasta, autor = quem enviou, concessões sem delete', async () => {
      const res = await request(app())
        .post('/files/upload-url')
        .set('Cookie', await cookie(carlos))
        .send({
          fileName: 'avulso.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          folderId: contratos,
          documentControl: controleDeTeste(),
        });
      expect(res.status).toBe(200);

      const id = await fileIdByName('avulso.pdf');
      const row = await fileRow(id);
      expect(row.owner_id).toBe(daniel);
      expect(row.uploaded_by).toBe(carlos);
      expect((await grantsOf(carlos, id)).map((g) => g.permission)).toEqual([
        'download',
        'rename',
        'view',
      ]);
    });

    it('reconciliação soma no dono, registra upload com o autor e não duplica o evento', async () => {
      const id = await fileIdByName('avulso.pdf');
      const { object_path } = await fileRow(id);
      const antesCarlos = await usedBytes(carlos);
      const antesDaniel = await usedBytes(daniel);

      for (let i = 0; i < 2; i++) {
        const res = await request(app())
          .post('/internal/storage-events')
          .send({ bucket: 'test-bucket', objectPath: object_path, sizeBytes: 10 });
        expect(res.status).toBe(200);
      }

      expect(await usedBytes(carlos)).toBe(antesCarlos);
      expect(await usedBytes(daniel)).toBeGreaterThan(antesDaniel);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ user_id: string }>(
          "SELECT user_id FROM audit_events WHERE file_id = $1 AND action = 'upload'",
          [id],
        ),
      );
      expect(rows).toEqual([{ user_id: carlos }]);

      // A consulta de acesso do arquivo segue restrita a view/download.
      const audit = await request(app())
        .get(`/files/${id}/audit`)
        .set('Cookie', await cookie(gestora));
      expect(audit.status).toBe(200);
      expect(JSON.stringify(audit.body)).not.toContain('"upload"');
    });

    it('dono não-admin vê e exclui o depositado; autor vê mas não exclui', async () => {
      const id = await fileIdByName('avulso.pdf');

      const lista = await request(app())
        .get(`/folders/${contratos}/contents`)
        .set('Cookie', await cookie(daniel));
      expect(lista.body.files.map((f: { fileName: string }) => f.fileName)).toContain('avulso.pdf');
      expect(lista.body.ownedByRequester).toBe(true);

      const ver = await request(app())
        .post(`/files/${id}/view-url`)
        .set('Cookie', await cookie(carlos));
      expect(ver.status).toBe(200);

      const excluirAutor = await request(app())
        .delete(`/files/${id}`)
        .set('Cookie', await cookie(carlos));
      expect(excluirAutor.status).toBe(403);

      const excluirDono = await request(app())
        .delete(`/files/${id}`)
        .set('Cookie', await cookie(daniel));
      expect(excluirDono.status).toBeLessThan(300);
    });

    it('envio de árvore: níveis criados com o dono da pasta, reenvio não duplica pasta nem concessão', async () => {
      const lote = {
        destinationFolderId: contratos,
        items: [
          {
            fileName: 'r.pdf',
            contentType: 'application/pdf',
            declaredSizeBytes: 5,
            relativePath: 'Relatorios/2025',
            documentControl: controleDeTeste(),
          },
        ],
      };
      const um = await request(app())
        .post('/files/upload-urls')
        .set('Cookie', await cookie(carlos))
        .send(lote);
      expect(um.status).toBe(200);
      expect(um.body.results[0].ok).toBe(true);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string; name: string; owner_id: string; created_by: string }>(
          "SELECT id, name, owner_id, created_by FROM folders WHERE name IN ('Relatorios', '2025')",
        ),
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.owner_id === daniel && r.created_by === carlos)).toBe(true);
      const file = await fileRow(await fileIdByName('r.pdf'));
      expect(file.owner_id).toBe(daniel);
      expect(file.uploaded_by).toBe(carlos);

      const relatorios = rows.find((r) => r.name === 'Relatorios')!.id;
      const antes = (await grantsOf(carlos, relatorios)).length;
      const dois = await request(app())
        .post('/files/upload-urls')
        .set('Cookie', await cookie(carlos))
        .send({
          ...lote,
          items: [{ ...lote.items[0], fileName: 'r2.pdf', documentControl: controleDeTeste() }],
        });
      expect(dois.body.results[0].ok).toBe(true);
      const { rows: depois } = await withSystemBypass(pool, (client) =>
        client.query("SELECT 1 FROM folders WHERE name IN ('Relatorios', '2025')"),
      );
      expect(depois).toHaveLength(2);
      expect(await grantsOf(carlos, relatorios)).toHaveLength(antes);
    });

    it('retomada de envio pending pelo autor não é conflito de código', async () => {
      const controle = controleDeTeste();
      const corpo = {
        fileName: 'retomada.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 5,
        folderId: contratos,
        documentControl: controle,
      };
      const c = await cookie(carlos);
      expect(
        (await request(app()).post('/files/upload-url').set('Cookie', c).send(corpo)).status,
      ).toBe(200);
      expect(
        (await request(app()).post('/files/upload-url').set('Cookie', c).send(corpo)).status,
      ).toBe(200);
    });
  });

  describe('pendente de cadastro', () => {
    let sub: string;

    beforeAll(async () => {
      sub = (await novaPasta(carlos, 'Pendentes', contratos)).body.id;
      const res = await request(app())
        .post('/files/upload-urls')
        .set('Cookie', await cookie(carlos))
        .send({
          destinationFolderId: sub,
          items: [
            { fileName: 'sem-cadastro.pdf', contentType: 'application/pdf', declaredSizeBytes: 3 },
          ],
        });
      expect(res.body.results[0].ok).toBe(true);
      expect(res.body.results[0].awaitingRegistration).toBe(true);
    });

    async function nomes(userId: string) {
      const res = await request(app())
        .get(`/folders/${sub}/contents`)
        .set('Cookie', await cookie(userId));
      return res.body.files.map((f: { fileName: string }) => f.fileName);
    }

    it('autor não-dono enxerga o próprio pendente', async () => {
      expect(await nomes(carlos)).toContain('sem-cadastro.pdf');
    });

    it('dono que não enviou não alcança o pendente; administrador alcança', async () => {
      expect(await nomes(daniel)).not.toContain('sem-cadastro.pdf');
      expect(await nomes(gestora)).toContain('sem-cadastro.pdf');
      const id = await fileIdByName('sem-cadastro.pdf');
      const direto = await request(app())
        .post(`/files/${id}/view-url`)
        .set('Cookie', await cookie(daniel));
      expect(direto.status).toBe(403);
    });
  });

  describe('cota do dono', () => {
    it('colaborador sem espaço próprio envia para a pasta de quem tem espaço', async () => {
      await setQuota(carlos, 1, 1);
      await setQuota(daniel, null);
      const res = await request(app())
        .post('/files/upload-url')
        .set('Cookie', await cookie(carlos))
        .send({
          fileName: 'cabe-no-daniel.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 1000,
          folderId: contratos,
          documentControl: controleDeTeste(),
        });
      expect(res.status).toBe(200);
    });

    it('espaço do dono insuficiente → owner_quota_exceeded, sem números (avulso e lote)', async () => {
      await setQuota(carlos, null);
      await setQuota(daniel, 100, 100);

      const avulso = await request(app())
        .post('/files/upload-url')
        .set('Cookie', await cookie(carlos))
        .send({
          fileName: 'nao-cabe.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          folderId: contratos,
          documentControl: controleDeTeste(),
        });
      expect(avulso.status).toBe(400);
      expect(avulso.body).toEqual({ error: 'owner_quota_exceeded' });

      const lote = await request(app())
        .post('/files/upload-urls')
        .set('Cookie', await cookie(carlos))
        .send({
          destinationFolderId: contratos,
          items: [
            {
              fileName: 'nao-cabe-lote.pdf',
              contentType: 'application/pdf',
              declaredSizeBytes: 10,
            },
          ],
        });
      expect(lote.body.results[0]).toEqual({
        fileName: 'nao-cabe-lote.pdf',
        ok: false,
        error: 'owner_quota_exceeded',
      });

      // O dono enviando para a própria pasta recebe a recusa de cota própria.
      const proprio = await request(app())
        .post('/files/upload-urls')
        .set('Cookie', await cookie(daniel))
        .send({
          destinationFolderId: contratos,
          items: [
            {
              fileName: 'nao-cabe-dono.pdf',
              contentType: 'application/pdf',
              declaredSizeBytes: 10,
            },
          ],
        });
      expect(proprio.body.results[0].error).toBe('quota exceeded');
    });

    it('substituição de versão usa a cota do dono do arquivo', async () => {
      await setQuota(daniel, null, 0);
      const up = await request(app())
        .post('/files/upload-url')
        .set('Cookie', await cookie(carlos))
        .send({
          fileName: 'versionado.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 5,
          folderId: contratos,
          documentControl: controleDeTeste(),
        });
      expect(up.status).toBe(200);
      const id = await fileIdByName('versionado.pdf');
      await request(app())
        .post('/internal/storage-events')
        .send({ bucket: 'test-bucket', objectPath: up.body.objectPath, sizeBytes: 5 });

      await setQuota(carlos, 1, 1);
      await setQuota(daniel, 50, 5);
      const cabe = await request(app())
        .post(`/files/${id}/replace-url`)
        .set('Cookie', await cookie(carlos))
        .send({ contentType: 'application/pdf', declaredSizeBytes: 20 });
      expect(cabe.status).toBe(200);
      // Substituir versão não troca autor nem dono (spec `posse-e-autoria`).
      const depois = await fileRow(id);
      expect(depois.uploaded_by).toBe(carlos);
      expect(depois.owner_id).toBe(daniel);

      await setQuota(daniel, 10, 5);
      const naoCabe = await request(app())
        .post(`/files/${id}/replace-url`)
        .set('Cookie', await cookie(carlos))
        .send({ contentType: 'application/pdf', declaredSizeBytes: 20 });
      expect(naoCabe.status).toBe(400);
      expect(naoCabe.body).toEqual({ error: 'owner_quota_exceeded' });
      await setQuota(carlos, null);
      await setQuota(daniel, null);
    });

    it('a consulta do próprio espaço não inclui o que foi enviado para pasta alheia', async () => {
      await setQuota(carlos, null, 0);
      const res = await request(app())
        .get('/files/quota')
        .set('Cookie', await cookie(carlos));
      expect(res.body.usedBytes).toBe(0);
    });
  });

  describe('concessões automáticas na gestão e na busca', () => {
    it('listagem marca a origem; revogar view corta o acesso do autor na requisição seguinte', async () => {
      const up = await request(app())
        .post('/files/upload-url')
        .set('Cookie', await cookie(carlos))
        .send({
          fileName: 'revogavel.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 5,
          folderId: contratos,
          documentControl: controleDeTeste(),
        });
      expect(up.status).toBe(200);
      const id = await fileIdByName('revogavel.pdf');
      await request(app())
        .post('/internal/storage-events')
        .send({ bucket: 'test-bucket', objectPath: up.body.objectPath, sizeBytes: 5 });

      const lista = await request(app())
        .get('/grants')
        .query({ resourceType: 'file', resourceId: id })
        .set('Cookie', await cookie(gestora));
      expect(lista.status).toBe(200);
      const doCarlos = lista.body.grants.filter(
        (g: { subjectUserId: string }) => g.subjectUserId === carlos,
      );
      expect(doCarlos).toHaveLength(3);
      expect(
        doCarlos.every(
          (g: { origin: string; expiresAt: string | null }) =>
            g.origin === 'autoria' && g.expiresAt === null,
        ),
      ).toBe(true);

      expect(
        (
          await request(app())
            .post(`/files/${id}/view-url`)
            .set('Cookie', await cookie(carlos))
        ).status,
      ).toBe(200);
      const view = doCarlos.find((g: { permission: string }) => g.permission === 'view');
      const revoga = await request(app())
        .delete(`/grants/${view.id}`)
        .set('Cookie', await cookie(gestora));
      expect(revoga.status).toBeLessThan(300);
      expect(
        (
          await request(app())
            .post(`/files/${id}/view-url`)
            .set('Cookie', await cookie(carlos))
        ).status,
      ).toBe(403);
    });

    it('filtro de autor da busca considera quem enviou, não o dono', async () => {
      const porCarlos = await request(app())
        .get('/files/search')
        .query({ author: carlos })
        .set('Cookie', await cookie(gestora));
      expect(porCarlos.status).toBe(200);
      const nomesCarlos = porCarlos.body.files.map((f: { fileName: string }) => f.fileName);
      expect(nomesCarlos).toContain('revogavel.pdf');

      const porDaniel = await request(app())
        .get('/files/search')
        .query({ author: daniel })
        .set('Cookie', await cookie(gestora));
      const nomesDaniel = porDaniel.body.files.map((f: { fileName: string }) => f.fileName);
      expect(nomesDaniel).not.toContain('revogavel.pdf');
    });
  });

  describe('sem herança', () => {
    it('ser dono da pasta não dá acesso a item antigo de terceiro dentro dela', async () => {
      await withSystemBypass(pool, (client) =>
        client.query(
          `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, content_type, size_bytes, status)
           VALUES ($1, $2, $3, 'legado/obj', 'legado.pdf', 'application/pdf', 1, 'active')`,
          [ids.unitA, olivia, contratos],
        ),
      );
      const id = await fileIdByName('legado.pdf');
      expect((await fileRow(id)).uploaded_by).toBe(olivia);

      const lista = await request(app())
        .get(`/folders/${contratos}/contents`)
        .set('Cookie', await cookie(daniel));
      expect(lista.body.files.map((f: { fileName: string }) => f.fileName)).not.toContain(
        'legado.pdf',
      );
      expect(
        (
          await request(app())
            .post(`/files/${id}/view-url`)
            .set('Cookie', await cookie(daniel))
        ).status,
      ).toBe(403);
    });

    it('raiz informa posse do solicitante', async () => {
      const raiz = await request(app())
        .get('/folders/root/contents')
        .set('Cookie', await cookie(carlos));
      expect(raiz.body.ownedByRequester).toBe(true);
    });
  });
});
