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
import { DocumentLifecycleState } from '@gdoc/shared';
import type { SharedWithMeItemResponse } from '@gdoc/shared';

/**
 * US 4.4 (capability `compartilhados-comigo`): a lista do que foi
 * compartilhado comigo — e, acima de tudo, **o que ela não revela**.
 *
 * Teste no nível dos testes de isolamento, por uma razão específica de desenho.
 * A lista é a única consulta de conteúdo cujo conjunto de candidatos nasce de
 * `grants`, e **não** de `visibleResourceClause`: aquele fragmento devolve
 * `TRUE` para quem é administrador da unidade da listagem, de modo que reusá-lo
 * aqui apresentaria todo o acervo da unidade ao `unit_admin` sob o título
 * "Compartilhados comigo" (design.md D1). O primeiro caso deste arquivo é
 * exatamente esse, e é o que mais importa.
 *
 * A segunda propriedade sob teste é a **composição**: as regras restritivas
 * (obsoleto, pendente de cadastro, lixeira, trava do bypass do `global_admin`)
 * não aparecem na consulta de candidatos — chegam por `hasAccess`, item a item
 * (design.md D2). Quem lê a consulta não as vê, então é o teste que verifica
 * que estão lá.
 *
 * Roda contra o Postgres real sob papel de app não-superuser, como todo teste
 * desta camada: superuser ignoraria RLS e mascararia defeito de isolamento.
 */
describe('Compartilhados comigo (US 4.4)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let adminAId: string;
  let terceiroId: string;
  let adminBId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'admin-a-comp@test.dev', 'x', 'unit_admin'),
           ($1, 'collab-a2-comp@test.dev', 'x', 'collaborator'),
           ($2, 'admin-b-comp@test.dev', 'x', 'unit_admin')
         RETURNING id`,
        [ids.unitA, ids.unitB],
      ),
    );
    adminAId = rows[0]!.id;
    terceiroId = rows[1]!.id;
    adminBId = rows[2]!.id;

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

  async function inserirPasta(opts: {
    nome: string;
    unitId?: string;
    ownerId?: string;
    parentId?: string | null;
  }): Promise<string> {
    const unitId = opts.unitId ?? ids.unitA;
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [unitId, opts.ownerId ?? ids.userA, opts.parentId ?? null, opts.nome],
      ),
    );
    return rows[0]!.id;
  }

  async function inserirArquivo(
    opts: {
      nome?: string;
      unitId?: string;
      ownerId?: string;
      folderId?: string | null;
      awaiting?: boolean;
      lifecycle?: string | null;
      excluido?: boolean;
    } = {},
  ): Promise<string> {
    const unitId = opts.unitId ?? ids.unitA;
    const ownerId = opts.ownerId ?? ids.userA;
    const nome = opts.nome ?? `comp-${Math.random().toString(36).slice(2, 10)}.pdf`;
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, content_type,
           size_bytes, status, awaiting_registration, lifecycle_state, deleted_at)
         VALUES ($1, $2, $3, $4, $5, 'application/pdf', 100, 'active', $6, $7, $8)
         RETURNING id`,
        [
          unitId,
          ownerId,
          opts.folderId ?? null,
          `${unitId}/${ownerId}/${nome}-${Math.random().toString(36).slice(2, 8)}`,
          nome,
          opts.awaiting ?? false,
          opts.lifecycle ?? null,
          opts.excluido ? new Date() : null,
        ],
      ),
    );
    return rows[0]!.id;
  }

  /**
   * Concede direto no banco, e não por `POST /grants`, nos casos em que o
   * estado a testar é justamente o que a rota de conceder **recusa** criar:
   * prazo no passado e concessão cuja unidade não é a de quem recebe. É a
   * forma de verificar que a listagem é fail-closed diante de uma linha que
   * não deveria existir, em vez de confiar que ela nunca existirá.
   */
  async function concederDireto(opts: {
    subjectUserId: string;
    resourceType: 'file' | 'folder';
    resourceId: string;
    permission: string;
    unitId?: string;
    expiresAt?: Date | null;
    createdAt?: Date;
  }): Promise<void> {
    await withSystemBypass(pool, (client) =>
      client.query(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission,
           granted_by, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()))`,
        [
          opts.unitId ?? ids.unitA,
          opts.subjectUserId,
          opts.resourceType,
          opts.resourceId,
          opts.permission,
          ids.globalAdmin,
          opts.expiresAt ?? null,
          opts.createdAt ?? null,
        ],
      ),
    );
  }

  async function revogarTudo(subjectUserId: string): Promise<void> {
    await withSystemBypass(pool, (client) =>
      client.query('DELETE FROM grants WHERE subject_user_id = $1', [subjectUserId]),
    );
  }

  async function listar(userId: string): Promise<SharedWithMeItemResponse[]> {
    const res = await request(createApp(ports))
      .get('/grants/received')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body.items as SharedWithMeItemResponse[];
  }

  describe('A lista parte da concessão, não do alcance (design.md D1)', () => {
    it('administrador de unidade com uma concessão recebida vê um item, não o acervo da unidade', async () => {
      await revogarTudo(adminAId);
      // Acervo da unidade que o admin alcança por papel, e que **não** é
      // compartilhado com ele: se a lista partisse de `visibleResourceClause`,
      // os três apareceriam.
      await inserirArquivo({ ownerId: ids.userA });
      await inserirArquivo({ ownerId: ids.userA });
      await inserirPasta({ nome: 'Acervo da unidade', ownerId: ids.userA });

      const concedido = await inserirArquivo({ ownerId: ids.userA, nome: 'o-unico.pdf' });
      await concederDireto({
        subjectUserId: adminAId,
        resourceType: 'file',
        resourceId: concedido,
        permission: 'view',
      });

      const itens = await listar(adminAId);
      expect(itens).toHaveLength(1);
      expect(itens[0]!.id).toBe(concedido);
      expect(itens[0]!.name).toBe('o-unico.pdf');
    });

    it('colaborador sem nenhuma concessão recebida vê lista vazia', async () => {
      await revogarTudo(terceiroId);
      await inserirArquivo({ ownerId: ids.userA });
      expect(await listar(terceiroId)).toEqual([]);
    });
  });

  describe('Alcance auto-escopado da rota', () => {
    it('colaborador alcança /grants/received, e continua recusado nas rotas de administrar', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, terceiroId);
      const arquivo = await inserirArquivo({ ownerId: ids.userA });

      expect((await request(app).get('/grants/received').set('Cookie', cookie)).status).toBe(200);

      const listagemDeRecurso = await request(app)
        .get('/grants')
        .query({ resourceType: 'file', resourceId: arquivo })
        .set('Cookie', cookie);
      expect(listagemDeRecurso.status).toBe(403);

      const concessao = await request(app)
        .post('/grants')
        .set('Cookie', cookie)
        .send({
          subjectUserIds: [terceiroId],
          resourceType: 'file',
          resourceId: arquivo,
          permissions: ['view'],
        });
      expect(concessao.status).toBe(403);
    });

    it('a lista não revela concessão de terceiro', async () => {
      await revogarTudo(terceiroId);
      const arquivo = await inserirArquivo({ ownerId: ids.userA, nome: 'de-outro.pdf' });
      await concederDireto({
        subjectUserId: ids.userA,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });

      const itens = await listar(terceiroId);
      expect(itens).toEqual([]);
    });
  });

  describe('Vigência pelo relógio do Postgres', () => {
    it('concessão sem prazo aparece sem vencimento, e com prazo futuro informa o vencimento', async () => {
      await revogarTudo(terceiroId);
      const permanente = await inserirArquivo({ ownerId: ids.userA, nome: 'permanente.pdf' });
      const comPrazo = await inserirArquivo({ ownerId: ids.userA, nome: 'com-prazo.pdf' });
      const vencimento = new Date(Date.now() + 86_400_000);
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: permanente,
        permission: 'view',
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: comPrazo,
        permission: 'view',
        expiresAt: vencimento,
      });

      const itens = await listar(terceiroId);
      const porId = new Map(itens.map((i) => [i.id, i]));
      expect(porId.get(permanente)!.permissions).toEqual([{ permission: 'view', expiresAt: null }]);
      expect(porId.get(comPrazo)!.permissions[0]!.expiresAt).toBe(vencimento.toISOString());
    });

    it('concessão vencida não aparece, ainda que a linha permaneça registrada', async () => {
      await revogarTudo(terceiroId);
      const arquivo = await inserirArquivo({ ownerId: ids.userA, nome: 'vencida.pdf' });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
        expiresAt: new Date(Date.now() - 1000),
      });

      expect(await listar(terceiroId)).toEqual([]);

      // A concessão continua no registro — expirar não é revogar.
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM grants WHERE subject_user_id = $1 AND resource_id = $2', [
          terceiroId,
          arquivo,
        ]),
      );
      expect(rows).toHaveLength(1);
    });

    it('o vencimento retira o item na consulta seguinte, sem rotina ter rodado', async () => {
      await revogarTudo(terceiroId);
      const arquivo = await inserirArquivo({ ownerId: ids.userA, nome: 'vence-no-meio.pdf' });
      // Prazo curto o bastante para expirar entre as duas consultas, avaliado
      // pelo relógio do banco — nenhum job participa deste corte.
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
        expiresAt: new Date(Date.now() + 700),
      });

      expect(await listar(terceiroId)).toHaveLength(1);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      expect(await listar(terceiroId)).toEqual([]);
    });

    it('concessão revogada retira o item, sem erro', async () => {
      await revogarTudo(terceiroId);
      const arquivo = await inserirArquivo({ ownerId: ids.userA, nome: 'revogada.pdf' });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });
      expect(await listar(terceiroId)).toHaveLength(1);

      await revogarTudo(terceiroId);
      expect(await listar(terceiroId)).toEqual([]);
    });
  });

  describe('Um item por recurso, com o conjunto dos verbos', () => {
    it('view e download sobre o mesmo arquivo formam um item com os dois verbos', async () => {
      await revogarTudo(terceiroId);
      const arquivo = await inserirArquivo({ ownerId: ids.userA, nome: 'dois-verbos.pdf' });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'download',
      });

      const itens = await listar(terceiroId);
      expect(itens).toHaveLength(1);
      // Ordem **canônica** do enum `Permission`, não a das linhas de `grants`:
      // sem isso a mesma consulta devolveria os verbos em ordens diferentes
      // entre execuções, e as etiquetas da tela dançariam.
      expect(itens[0]!.permissions.map((p) => p.permission)).toEqual(['view', 'download']);
    });

    it('verbo acrescentado hoje não duplica o item e passa a reger a sua posição', async () => {
      await revogarTudo(terceiroId);
      const antigo = await inserirArquivo({ ownerId: ids.userA, nome: 'antigo.pdf' });
      const recente = await inserirArquivo({ ownerId: ids.userA, nome: 'recente.pdf' });
      const mesPassado = new Date(Date.now() - 30 * 86_400_000);
      const ontem = new Date(Date.now() - 86_400_000);

      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: antigo,
        permission: 'view',
        createdAt: mesPassado,
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: recente,
        permission: 'view',
        createdAt: ontem,
      });

      // Antes: o recente vem primeiro.
      expect((await listar(terceiroId)).map((i) => i.id)).toEqual([recente, antigo]);

      // Um verbo acrescentado agora sobre o item antigo o traz ao topo, sem
      // criar um segundo item para o mesmo recurso.
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: antigo,
        permission: 'download',
      });

      const depois = await listar(terceiroId);
      expect(depois.map((i) => i.id)).toEqual([antigo, recente]);
      expect(depois[0]!.permissions).toHaveLength(2);
    });
  });

  describe('A lista não amplia alcance', () => {
    it('recurso de que a própria pessoa é dona não aparece', async () => {
      await revogarTudo(terceiroId);
      const proprio = await inserirArquivo({ ownerId: terceiroId, nome: 'meu-proprio.pdf' });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: proprio,
        permission: 'view',
      });

      expect(await listar(terceiroId)).toEqual([]);
    });

    it('item na lixeira não aparece', async () => {
      await revogarTudo(terceiroId);
      const arquivo = await inserirArquivo({
        ownerId: ids.userA,
        nome: 'na-lixeira.pdf',
        excluido: true,
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });

      expect(await listar(terceiroId)).toEqual([]);
    });

    it('documento obsoleto não aparece ao colaborador, e aparece à administração da unidade', async () => {
      await revogarTudo(terceiroId);
      await revogarTudo(adminAId);
      const arquivo = await inserirArquivo({
        ownerId: ids.userA,
        nome: 'obsoleto.pdf',
        lifecycle: DocumentLifecycleState.OBSOLETE,
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });
      await concederDireto({
        subjectUserId: adminAId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });

      expect(await listar(terceiroId)).toEqual([]);
      expect((await listar(adminAId)).map((i) => i.id)).toEqual([arquivo]);
    });

    it('arquivo pendente de cadastro não aparece a quem não o enviou, e aparece à administração', async () => {
      await revogarTudo(terceiroId);
      await revogarTudo(adminAId);
      const arquivo = await inserirArquivo({
        ownerId: ids.userA,
        nome: 'pendente.pdf',
        awaiting: true,
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });
      await concederDireto({
        subjectUserId: adminAId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });

      expect(await listar(terceiroId)).toEqual([]);
      expect((await listar(adminAId)).map((i) => i.id)).toEqual([arquivo]);
    });

    it('a lista não atravessa unidades, inclusive para o administrador global', async () => {
      await revogarTudo(terceiroId);
      await revogarTudo(ids.globalAdmin);
      const arquivoDeB = await inserirArquivo({
        unitId: ids.unitB,
        ownerId: ids.userB,
        nome: 'da-unidade-b.pdf',
      });

      // Linha que `POST /grants` recusa criar (recurso de outra unidade),
      // forjada para verificar que a listagem é fail-closed diante dela.
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivoDeB,
        permission: 'view',
        unitId: ids.unitB,
      });
      await concederDireto({
        subjectUserId: ids.globalAdmin,
        resourceType: 'file',
        resourceId: arquivoDeB,
        permission: 'view',
        unitId: ids.unitB,
      });

      expect(await listar(terceiroId)).toEqual([]);
      expect(await listar(ids.globalAdmin)).toEqual([]);

      // O administrador da unidade B, a quem o recurso pertence, continua
      // alcançando o que lhe foi concedido — a trava é de unidade, não de papel.
      await revogarTudo(adminBId);
      await concederDireto({
        subjectUserId: adminBId,
        resourceType: 'file',
        resourceId: arquivoDeB,
        permission: 'view',
        unitId: ids.unitB,
      });
      expect((await listar(adminBId)).map((i) => i.id)).toEqual([arquivoDeB]);
    });
  });

  describe('Localização é a pasta que contém o item (design.md D7)', () => {
    it('arquivo em profundidade informa só a pasta que o contém, não os ancestrais', async () => {
      await revogarTudo(terceiroId);
      const avo = await inserirPasta({ nome: 'Diretoria', ownerId: ids.userA });
      const mae = await inserirPasta({ nome: 'Governança', ownerId: ids.userA, parentId: avo });
      const arquivo = await inserirArquivo({
        ownerId: ids.userA,
        nome: 'em-profundidade.pdf',
        folderId: mae,
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: arquivo,
        permission: 'view',
      });

      const itens = await listar(terceiroId);
      expect(itens).toHaveLength(1);
      expect(itens[0]!.folderName).toBe('Governança');
      expect(JSON.stringify(itens)).not.toContain('Diretoria');
    });

    it('pasta concedida informa a pasta-mãe, e recurso na raiz informa ausência de pasta', async () => {
      await revogarTudo(terceiroId);
      const mae = await inserirPasta({ nome: 'Institucional', ownerId: ids.userA });
      const filha = await inserirPasta({ nome: 'Políticas', ownerId: ids.userA, parentId: mae });
      const naRaiz = await inserirArquivo({
        ownerId: ids.userA,
        nome: 'na-raiz.pdf',
        folderId: null,
      });

      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'folder',
        resourceId: filha,
        permission: 'view',
      });
      await concederDireto({
        subjectUserId: terceiroId,
        resourceType: 'file',
        resourceId: naRaiz,
        permission: 'view',
      });

      const itens = await listar(terceiroId);
      const pasta = itens.find((i) => i.resourceType === 'folder')!;
      expect(pasta.name).toBe('Políticas');
      expect(pasta.folderName).toBe('Institucional');
      expect(pasta.file).toBeNull();

      const arquivo = itens.find((i) => i.resourceType === 'file')!;
      expect(arquivo.folderName).toBeNull();
      // A linha de arquivo chega na forma que o visualizador consome.
      expect(arquivo.file).not.toBeNull();
      expect(arquivo.file!.fileName).toBe('na-raiz.pdf');
    });
  });
});
