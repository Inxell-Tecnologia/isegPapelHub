import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { DocumentStatus } from '@gdoc/shared';

/**
 * US 10.9 (change `arquivo-geral-e-pendente-de-cadastro`, design.md D3): o
 * arquivo **pendente de cadastro** não circula até ser completado.
 *
 * Teste próprio, no nível dos testes do obsoleto, por um motivo específico. A
 * regra do obsoleto **só subtrai**, e isso é verificável lendo
 * `nonObsoleteClause`: o fragmento nunca tem um ramo que conceda. A regra do
 * pendente **relaxa** — `OR owner_id = …` faz o arquivo reaparecer para quem o
 * enviou, porque é ele quem precisa completar os dados. A propriedade "não
 * amplia alcance" deixou de ser verificável por inspeção da função e passou a
 * depender da **composição** com `visibleResourceClause`, que já recortou por
 * dono/concessão/admin e por unidade.
 *
 * Daí a cobertura: os quatro caminhos por onde um arquivo alcança alguém
 * (listagem, busca, identificador direto, manifesto de download de pasta), as
 * três posições de quem consulta (terceiro, remetente, administração) e o caso
 * cross-unit, que é onde uma relaxação mal composta apareceria.
 *
 * Roda contra o Postgres real sob papel de app não-superuser, como todo teste
 * desta camada: superuser ignoraria RLS e mascararia defeito de isolamento.
 */
describe('Arquivo pendente de cadastro não circula (US 10.9)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let adminAId: string;
  let terceiroId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'admin-a-pend@test.dev', 'x', 'unit_admin'),
           ($1, 'collab-a2-pend@test.dev', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    adminAId = rows[0]!.id;
    terceiroId = rows[1]!.id;

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

  /** Insere um arquivo `active` já marcado (ou não) como pendente de cadastro. */
  async function inserirArquivo(opts: {
    unitId?: string;
    ownerId?: string;
    folderId?: string | null;
    fileName?: string;
    awaiting?: boolean;
  }): Promise<string> {
    const unitId = opts.unitId ?? ids.unitA;
    const ownerId = opts.ownerId ?? ids.userA;
    const fileName = opts.fileName ?? `pend-${Math.random().toString(36).slice(2, 10)}.pdf`;
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, content_type,
           size_bytes, status, awaiting_registration)
         VALUES ($1, $2, $3, $4, $5, 'application/pdf', 100, 'active', $6)
         RETURNING id`,
        [
          unitId,
          ownerId,
          opts.folderId ?? null,
          `${unitId}/${ownerId}/${fileName}-${Math.random().toString(36).slice(2, 8)}`,
          fileName,
          opts.awaiting ?? true,
        ],
      ),
    );
    return rows[0]!.id;
  }

  async function listarRaiz(userId: string) {
    const res = await request(createApp(ports))
      .get('/folders/root/contents')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body.files as Record<string, unknown>[];
  }

  async function naListagem(userId: string, fileId: string) {
    return (await listarRaiz(userId)).find((f) => f.id === fileId);
  }

  async function buscar(userId: string, q: string) {
    const res = await request(createApp(ports))
      .get('/files/search')
      .query({ q })
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body.files as Record<string, unknown>[];
  }

  async function conceder(
    resourceId: string,
    permissions: string[],
    resourceType: 'file' | 'folder' = 'file',
    subjectUserId = terceiroId,
  ) {
    const res = await request(createApp(ports))
      .post('/grants')
      .set('Cookie', await sessionCookieFor(ports, ids.globalAdmin))
      .send({ subjectUserIds: [subjectUserId], resourceType, resourceId, permissions });
    expect(res.status).toBe(201);
  }

  it('colaborador com permissão não o alcança por nenhum dos quatro caminhos', async () => {
    const fileId = await inserirArquivo({ fileName: 'ata-sem-cadastro.pdf' });
    // Concessão **vigente** de view e download: é o caso que importa, porque
    // prova que a pendência não é vencida por permissão. A regra subtrai.
    await conceder(fileId, ['view', 'download']);
    const cookie = await sessionCookieFor(ports, terceiroId);
    const app = createApp(ports);

    expect(await naListagem(terceiroId, fileId)).toBeUndefined();
    expect(await buscar(terceiroId, 'ata-sem-cadastro')).toHaveLength(0);

    const view = await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookie);
    const download = await request(app).post(`/files/${fileId}/download-url`).set('Cookie', cookie);
    // Indistinguível de recurso inexistente: mesmo status e mesmo corpo que um
    // identificador inventado recebe.
    const inexistente = await request(app)
      .post('/files/11111111-1111-1111-1111-111111111111/view-url')
      .set('Cookie', cookie);
    expect(view.status).toBe(403);
    expect(download.status).toBe(403);
    expect(view.status).toBe(inexistente.status);
    expect(view.body).toEqual(inexistente.body);
  });

  it('quem enviou continua enxergando o próprio pendente, identificado como tal', async () => {
    const fileId = await inserirArquivo({ fileName: 'meu-pendente.pdf' });

    const visto = await naListagem(ids.userA, fileId);
    expect(visto?.documentStatus).toBe(DocumentStatus.AWAITING_REGISTRATION);

    // Alcança o conteúdo: sem isso não haveria como conferir o que enviou
    // antes de cadastrá-lo.
    const view = await request(createApp(ports))
      .post(`/files/${fileId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    expect(view.status).toBe(200);
  });

  it('administrador da unidade enxerga pendente enviado por outra pessoa', async () => {
    const fileId = await inserirArquivo({ fileName: 'pendente-de-terceiro.pdf' });

    const visto = await naListagem(adminAId, fileId);
    expect(visto?.documentStatus).toBe(DocumentStatus.AWAITING_REGISTRATION);
    expect(await buscar(adminAId, 'pendente-de-terceiro')).toHaveLength(1);

    const view = await request(createApp(ports))
      .post(`/files/${fileId}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, adminAId));
    expect(view.status).toBe(200);
  });

  it('a regra do pendente não amplia alcance de administrador sobre outra unidade', async () => {
    const naUnidadeB = await inserirArquivo({
      unitId: ids.unitB,
      ownerId: ids.userB,
      fileName: 'pendente-da-unidade-b.pdf',
    });

    // Inclui o `global_admin`: é para ele que a trava do bypass de RLS vale,
    // e `resourceScopeClause` compara `unit_id` explicitamente nesse ramo.
    for (const userId of [adminAId, ids.globalAdmin]) {
      expect(await naListagem(userId, naUnidadeB)).toBeUndefined();
      expect(await buscar(userId, 'pendente-da-unidade-b')).toHaveLength(0);
      const view = await request(createApp(ports))
        .post(`/files/${naUnidadeB}/view-url`)
        .set('Cookie', await sessionCookieFor(ports, userId));
      expect(view.status).toBe(403);
    }
  });

  it('ser remetente não amplia alcance: pendente de outra unidade segue fora', async () => {
    // O ramo relaxado é `owner_id = <quem consulta>`. Este caso prova que ele
    // não atravessa unidade — a pessoa é dona do arquivo, mas o arquivo está
    // noutra unidade, e o recorte externo por unidade continua decidindo.
    const forasteiro = await inserirArquivo({
      unitId: ids.unitB,
      ownerId: ids.userA,
      fileName: 'pendente-dono-cross-unit.pdf',
    });

    expect(await naListagem(ids.userA, forasteiro)).toBeUndefined();
    expect(await buscar(ids.userA, 'pendente-dono-cross-unit')).toHaveLength(0);
    const view = await request(createApp(ports))
      .post(`/files/${forasteiro}/view-url`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    expect(view.status).toBe(403);
  });

  it('pendente excluído deixa de ser alcançado inclusive por quem o enviou', async () => {
    const fileId = await inserirArquivo({ fileName: 'pendente-excluido.pdf' });
    const cookie = await sessionCookieFor(ports, ids.userA);
    const app = createApp(ports);

    const del = await request(app).delete(`/files/${fileId}`).set('Cookie', cookie);
    expect(del.status).toBe(204);

    expect(await naListagem(ids.userA, fileId)).toBeUndefined();
    expect(await buscar(ids.userA, 'pendente-excluido')).toHaveLength(0);
    const view = await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookie);
    expect(view.status).toBe(403);
  });

  it('o pendente não entra no manifesto de download de pasta de quem não é gestão', async () => {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'Pasta com pendente') RETURNING id`,
        [ids.unitA, ids.userA],
      ),
    );
    const folderId = rows[0]!.id;
    const publicado = await inserirArquivo({
      folderId,
      fileName: 'publicado-na-pasta.pdf',
      awaiting: false,
    });
    const pendente = await inserirArquivo({
      folderId,
      fileName: 'pendente-na-pasta.pdf',
    });
    // A concessão sobre a **pasta** libera o acesso ao manifesto; as
    // concessões por arquivo são o que faz cada item entrar nele. Dar as três
    // é deliberado: o pendente fica de fora apesar de ter permissão própria,
    // que é precisamente o ponto.
    await conceder(folderId, ['view', 'download'], 'folder');
    await conceder(publicado, ['view', 'download']);
    await conceder(pendente, ['view', 'download']);

    const res = await request(createApp(ports))
      .post(`/folders/${folderId}/download-manifest`)
      .set('Cookie', await sessionCookieFor(ports, terceiroId));
    expect(res.status).toBe(200);

    const nomes = (res.body.entries as { fileName: string }[]).map((f) => f.fileName);
    expect(nomes).toContain('publicado-na-pasta.pdf');
    expect(nomes).not.toContain('pendente-na-pasta.pdf');
    // O pendente não é contado nem como "disponível" no recorte parcial: ele
    // não está na subárvore alcançável, não é um item filtrado por permissão.
    expect(res.body.allowedFiles).toBe(1);
  });
});
