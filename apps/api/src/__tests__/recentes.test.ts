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
import type { NewDocumentsCountResponse, RecentDocumentsResponse } from '@gdoc/shared';
import { config } from '../config.js';
import { AuditAction, DocumentLifecycleState } from '@gdoc/shared';

/**
 * Documentos alterados recentemente (US 11.2, change `shell-e-inicio`,
 * `GET /files/recent`).
 *
 * O risco desta rota não é funcional, é de **alcance**: ela apresenta numa
 * tela inicial documentos que a pessoa não pediu para ver, e por isso precisa
 * provar que não amplia nada do que a navegação já concederia. Os testes
 * abaixo codificam esse contrato — permissão item a item, isolamento por
 * unidade inclusive para o administrador global, expiração de concessão pelo
 * relógio do banco e a decisão D1 (leitura não é alteração).
 */
describe('Documentos recentes (routes/recent.ts, GET /files/recent, US 11.2)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let unitAdminAId: string;
  let outroColaboradorAId: string;

  async function inserirArquivo(params: {
    unitId: string;
    ownerId: string;
    fileName: string;
    folderId?: string;
    createdAt?: string;
    lifecycleState?: string;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, object_path, file_name, folder_id, status, created_at, lifecycle_state)
         VALUES ($1, $2, $3, $4, $5, 'active', COALESCE($6::timestamptz, now()), $7)
         RETURNING id`,
        [
          params.unitId,
          params.ownerId,
          `recentes-test/${params.fileName}-${Math.random()}`,
          params.fileName,
          params.folderId ?? null,
          params.createdAt ?? null,
          params.lifecycleState ?? null,
        ],
      ),
    );
    return rows[0]!.id;
  }

  async function inserirPasta(params: {
    unitId: string;
    ownerId: string;
    name: string;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, NULL, $3) RETURNING id`,
        [params.unitId, params.ownerId, params.name],
      ),
    );
    return rows[0]!.id;
  }

  async function registrarEvento(params: {
    unitId: string;
    userId: string;
    fileId: string;
    action: AuditAction;
    createdAt: string;
  }): Promise<void> {
    await withSystemBypass(pool, (client) =>
      client.query(
        `INSERT INTO audit_events (unit_id, user_id, file_id, action, created_at)
         VALUES ($1, $2, $3, $4, $5::timestamptz)`,
        [params.unitId, params.userId, params.fileId, params.action, params.createdAt],
      ),
    );
  }

  async function conceder(params: {
    unitId: string;
    subjectUserId: string;
    fileId: string;
    grantedBy: string;
    expiresAt?: string | null;
  }): Promise<string> {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
         VALUES ($1, $2, 'file', $3, 'view', $4, $5::timestamptz)
         RETURNING id`,
        [
          params.unitId,
          params.subjectUserId,
          params.fileId,
          params.grantedBy,
          params.expiresAt ?? null,
        ],
      ),
    );
    return rows[0]!.id;
  }

  /** Limpa o acervo entre casos: cada teste monta exatamente o cenário que afirma. */
  async function limparAcervo(): Promise<void> {
    await withSystemBypass(pool, async (client) => {
      await client.query('DELETE FROM audit_events');
      await client.query('DELETE FROM grants');
      await client.query('DELETE FROM files');
      await client.query('DELETE FROM folders');
    });
  }

  async function consultar(userId: string): Promise<RecentDocumentsResponse> {
    const app = createApp(ports);
    const res = await request(app)
      .get('/files/recent')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body as RecentDocumentsResponse;
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'gestor-a@recentes.test', 'x', 'unit_admin'),
           ($1, 'collab-a2@recentes.test', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    [unitAdminAId, outroColaboradorAId] = rows.map((r) => r.id) as [string, string];

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

  it('ordena da alteração mais recente para a mais antiga, derivando o instante da publicação e da auditoria (design.md D1)', async () => {
    await limparAcervo();

    // Publicado há muito tempo, mas **substituído** ontem: o instante
    // relevante é o do evento, não o da publicação.
    const substituido = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'substituido.pdf',
      createdAt: '2026-01-01T10:00:00Z',
    });
    await registrarEvento({
      unitId: ids.unitA,
      userId: ids.userA,
      fileId: substituido,
      action: AuditAction.REPLACE,
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    });

    // Publicado há duas horas e nunca tocado: entra pelo `created_at`.
    const publicado = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'publicado.pdf',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    });

    // Publicado antes da janela e nunca alterado: fica fora do recorte.
    await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'antigo.pdf',
      createdAt: '2020-01-01T10:00:00Z',
    });

    const body = await consultar(ids.userA);

    expect(body.documents.map((d) => d.id)).toEqual([publicado, substituido]);
    expect(body.documents.map((d) => d.fileName)).toEqual(['publicado.pdf', 'substituido.pdf']);
    // A data da alteração acompanha cada documento (US 11.2, cenário 1).
    expect(new Date(body.documents[0]!.changedAt).getTime()).toBeGreaterThan(
      new Date(body.documents[1]!.changedAt).getTime(),
    );
  });

  it('consolida por documento: várias alterações do mesmo arquivo produzem uma linha só (Risks)', async () => {
    await limparAcervo();

    const alvo = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'muito-alterado.pdf',
      createdAt: '2026-05-01T10:00:00Z',
    });
    for (const action of [AuditAction.RENAME, AuditAction.REPLACE, AuditAction.MOVE]) {
      await registrarEvento({
        unitId: ids.unitA,
        userId: ids.userA,
        fileId: alvo,
        action,
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      });
    }
    const outro = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'outro.pdf',
      createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    });

    const body = await consultar(ids.userA);
    expect(body.documents.map((d) => d.id)).toEqual([alvo, outro]);
  });

  it('ações de leitura (view, download) não produzem linha na lista — trava a decisão D1', async () => {
    await limparAcervo();

    const lido = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'apenas-lido.pdf',
      createdAt: '2026-01-01T10:00:00Z',
    });
    for (const action of [AuditAction.VIEW, AuditAction.DOWNLOAD]) {
      await registrarEvento({
        unitId: ids.unitA,
        userId: ids.userA,
        fileId: lido,
        action,
        createdAt: new Date().toISOString(),
      });
    }

    const body = await consultar(ids.userA);
    // A publicação está fora da janela e só houve leitura: nada a listar.
    expect(body.documents).toEqual([]);
  });

  it('ausência de alterações devolve lista vazia, não erro (US 11.2, cenário 4)', async () => {
    await limparAcervo();
    const body = await consultar(ids.userA);
    expect(body.documents).toEqual([]);
  });

  it('documento sem permissão não aparece, nem seu nome, nem a pasta que o contém (US 11.2, cenário 2)', async () => {
    await limparAcervo();

    const pastaAlheia = await inserirPasta({
      unitId: ids.unitA,
      ownerId: outroColaboradorAId,
      name: 'Pasta Reservada',
    });
    await inserirArquivo({
      unitId: ids.unitA,
      ownerId: outroColaboradorAId,
      fileName: 'confidencial.pdf',
      folderId: pastaAlheia,
      createdAt: new Date().toISOString(),
    });

    const body = await consultar(ids.userA);
    expect(body.documents).toEqual([]);
    const serializado = JSON.stringify(body);
    expect(serializado).not.toContain('confidencial.pdf');
    expect(serializado).not.toContain('Pasta Reservada');
  });

  it('documento liberado por concessão vigente aparece, com o nome da pasta que o contém', async () => {
    await limparAcervo();

    const pasta = await inserirPasta({
      unitId: ids.unitA,
      ownerId: outroColaboradorAId,
      name: 'Compartilhada',
    });
    const liberado = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: outroColaboradorAId,
      fileName: 'liberado.pdf',
      folderId: pasta,
      createdAt: new Date().toISOString(),
    });
    await conceder({
      unitId: ids.unitA,
      subjectUserId: ids.userA,
      fileId: liberado,
      grantedBy: unitAdminAId,
    });

    const body = await consultar(ids.userA);
    expect(body.documents.map((d) => d.id)).toEqual([liberado]);
    expect(body.documents[0]!.folderName).toBe('Compartilhada');
  });

  it('a lista não atravessa unidades, inclusive para o administrador global (US 11.2, cenário 3)', async () => {
    await limparAcervo();

    await inserirArquivo({
      unitId: ids.unitB,
      ownerId: ids.userB,
      fileName: 'de-outra-unidade.pdf',
      createdAt: new Date().toISOString(),
    });
    const daPropriaUnidade = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.globalAdmin,
      fileName: 'da-unidade-do-admin.pdf',
      createdAt: new Date().toISOString(),
    });

    // O admin global pertence à unidade A: o bypass de RLS dele vale só para
    // agregados, nunca para bytes/itens de outra unidade (CLAUDE.md).
    const doAdmin = await consultar(ids.globalAdmin);
    expect(doAdmin.documents.map((d) => d.id)).toEqual([daPropriaUnidade]);
    expect(JSON.stringify(doAdmin)).not.toContain('de-outra-unidade.pdf');

    // E a pessoa da unidade B continua vendo só o da sua.
    const daUnidadeB = await consultar(ids.userB);
    expect(daUnidadeB.documents.map((d) => d.fileName)).toEqual(['de-outra-unidade.pdf']);
  });

  it('documento sai da lista na consulta seguinte quando a concessão expira, pelo relógio do banco (design.md D2)', async () => {
    await limparAcervo();

    const liberado = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: outroColaboradorAId,
      fileName: 'temporario.pdf',
      createdAt: new Date().toISOString(),
    });
    const grantId = await conceder({
      unitId: ids.unitA,
      subjectUserId: ids.userA,
      fileId: liberado,
      grantedBy: unitAdminAId,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    const antes = await consultar(ids.userA);
    expect(antes.documents.map((d) => d.id)).toEqual([liberado]);

    // Vencimento no passado: nenhum job roda — a vigência é avaliada no SQL,
    // a cada consulta.
    await withSystemBypass(pool, (client) =>
      client.query(`UPDATE grants SET expires_at = now() - interval '1 second' WHERE id = $1`, [
        grantId,
      ]),
    );

    const depois = await consultar(ids.userA);
    expect(depois.documents).toEqual([]);
  });

  it('documento declarado obsoleto desaparece para quem não é administrador da unidade (herdado de hasAccess)', async () => {
    await limparAcervo();

    const obsoleto = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'obsoleto.pdf',
      createdAt: new Date().toISOString(),
      lifecycleState: DocumentLifecycleState.OBSOLETE,
    });

    // Para o dono colaborador, "sai de circulação" vale (US 10.7)…
    const doDono = await consultar(ids.userA);
    expect(doDono.documents).toEqual([]);

    // …e para o administrador da unidade, não.
    const doGestor = await consultar(unitAdminAId);
    expect(doGestor.documents.map((d) => d.id)).toEqual([obsoleto]);
  });

  it('documento na lixeira não produz linha, mesmo com evento de alteração recente (Risks)', async () => {
    await limparAcervo();

    const excluido = await inserirArquivo({
      unitId: ids.unitA,
      ownerId: ids.userA,
      fileName: 'na-lixeira.pdf',
      createdAt: new Date().toISOString(),
    });
    await registrarEvento({
      unitId: ids.unitA,
      userId: ids.userA,
      fileId: excluido,
      action: AuditAction.RENAME,
      createdAt: new Date().toISOString(),
    });
    await withSystemBypass(pool, (client) =>
      client.query(
        `UPDATE files SET deleted_at = now(), deleted_by = $2, trash_root_id = gen_random_uuid() WHERE id = $1`,
        [excluido, ids.userA],
      ),
    );

    const body = await consultar(ids.userA);
    expect(body.documents).toEqual([]);
  });

  async function contarNovos(userId: string): Promise<NewDocumentsCountResponse> {
    const app = createApp(ports);
    const res = await request(app)
      .get('/files/recent/new-count')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body as NewDocumentsCountResponse;
  }

  const diasAtras = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();

  describe('contagem de documentos novos (GET /files/recent/new-count, change conteudo-da-tela-inicio)', () => {
    it('conta só o que a pessoa alcança, publicado na janela de 7 dias (design.md D1/D3)', async () => {
      await limparAcervo();
      await inserirArquivo({ unitId: ids.unitA, ownerId: ids.userA, fileName: 'meu.pdf' });
      const liberado = await inserirArquivo({
        unitId: ids.unitA,
        ownerId: outroColaboradorAId,
        fileName: 'liberado.pdf',
        createdAt: diasAtras(2),
      });
      await conceder({
        unitId: ids.unitA,
        subjectUserId: ids.userA,
        fileId: liberado,
        grantedBy: unitAdminAId,
      });
      // Sem concessão: existe, é novo, e não pode entrar na contagem.
      await inserirArquivo({
        unitId: ids.unitA,
        ownerId: outroColaboradorAId,
        fileName: 'reservado.pdf',
      });

      expect(await contarNovos(ids.userA)).toEqual({ days: 7, count: 2, capped: false });
      // O administrador da unidade alcança os três.
      expect((await contarNovos(unitAdminAId)).count).toBe(3);
    });

    it('publicado antes da janela e alterado depois aparece nos recentes, mas não é novo', async () => {
      await limparAcervo();
      const antigo = await inserirArquivo({
        unitId: ids.unitA,
        ownerId: ids.userA,
        fileName: 'antigo.pdf',
        createdAt: diasAtras(20),
      });
      await registrarEvento({
        unitId: ids.unitA,
        userId: ids.userA,
        fileId: antigo,
        action: AuditAction.RENAME,
        createdAt: diasAtras(1),
      });

      expect((await consultar(ids.userA)).documents.map((d) => d.id)).toEqual([antigo]);
      expect((await contarNovos(ids.userA)).count).toBe(0);
    });

    it('não atravessa unidades, inclusive para o administrador global (trava do bypass)', async () => {
      await limparAcervo();
      await inserirArquivo({ unitId: ids.unitB, ownerId: ids.userB, fileName: 'b.pdf' });
      await inserirArquivo({ unitId: ids.unitA, ownerId: ids.globalAdmin, fileName: 'a.pdf' });

      expect((await contarNovos(ids.globalAdmin)).count).toBe(1);
      expect((await contarNovos(ids.userB)).count).toBe(1);
    });

    it('documento obsoleto não conta para quem não administra a unidade (herdado de hasAccess)', async () => {
      await limparAcervo();
      await inserirArquivo({
        unitId: ids.unitA,
        ownerId: ids.userA,
        fileName: 'obsoleto.pdf',
        lifecycleState: DocumentLifecycleState.OBSOLETE,
      });

      expect((await contarNovos(ids.userA)).count).toBe(0);
      expect((await contarNovos(unitAdminAId)).count).toBe(1);
    });

    it('acima do teto de candidatos responde capped, sem apresentar o teto como exato (design.md D3)', async () => {
      await limparAcervo();
      const tetoOriginal = config.recentDocuments.candidateLimit;
      config.recentDocuments.candidateLimit = 2;
      try {
        for (const nome of ['um.pdf', 'dois.pdf', 'tres.pdf']) {
          await inserirArquivo({ unitId: ids.unitA, ownerId: ids.userA, fileName: nome });
        }
        expect(await contarNovos(ids.userA)).toEqual({ days: 7, count: 2, capped: true });
      } finally {
        config.recentDocuments.candidateLimit = tetoOriginal;
      }
    });

    it('sem sessão retorna 401', async () => {
      const app = createApp(ports);
      const res = await request(app).get('/files/recent/new-count');
      expect(res.status).toBe(401);
    });
  });

  it('sem sessão retorna 401', async () => {
    const app = createApp(ports);
    const res = await request(app).get('/files/recent');
    expect(res.status).toBe(401);
  });
});
