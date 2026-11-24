import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import type {
  AuditQueryResponse,
  FolderContentsResponse,
  SharedWithMeItemResponse,
} from '@gdoc/shared';

/**
 * PRD US 5.2 (change `compartilhamento-entre-unidades`): a exceção controlada
 * ao isolamento por unidade — e, acima de tudo, **o que ela não abre**.
 *
 * Cenário do cliente: a pasta Governança é da SEDE; a Administradora Global
 * (Ana) a compartilhou com a Raíra, de outra unidade, e a Raíra não a abria.
 *
 * Mesmo nível dos testes de isolamento: Postgres real sob papel de app
 * não-superuser — superuser ignoraria a RLS e mascararia o defeito.
 */
describe('Compartilhamento entre unidades (US 5.2)', () => {
  let pool: Pool;
  let ports: Ports;
  let sede: string;
  let norte: string;
  let sul: string;
  let ana: string; // global_admin da SEDE
  let donoSede: string; // colaborador da SEDE, dono do acervo
  let raira: string; // colaboradora da Norte
  let colegaNorte: string;
  let adminNorte: string;
  let pessoaSul: string;
  let governanca: string;
  let atas: string;
  let ataProfunda: string;
  let foraDaGovernanca: string;

  const app = () => createApp(ports);
  const cookie = (userId: string) => sessionCookieFor(ports, userId);

  async function sql<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
    const { rows } = await withSystemBypass(pool, (client) => client.query<T>(text, params));
    return rows;
  }

  async function pasta(nome: string, unitId: string, ownerId: string, parentId: string | null) {
    const rows = await sql<{ id: string }>(
      `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, $3, $4) RETURNING id`,
      [unitId, ownerId, parentId, nome],
    );
    return rows[0]!.id;
  }

  async function arquivo(opts: {
    unitId: string;
    ownerId: string;
    folderId: string | null;
    nome?: string;
    lifecycle?: string | null;
    awaiting?: boolean;
    excluido?: boolean;
  }) {
    const nome = opts.nome ?? `doc-${Math.random().toString(36).slice(2, 10)}.pdf`;
    const rows = await sql<{ id: string }>(
      `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, content_type,
         size_bytes, status, awaiting_registration, lifecycle_state, deleted_at)
       VALUES ($1, $2, $3, $4, $5, 'application/pdf', 100, 'active', $6, $7, $8)
       RETURNING id`,
      [
        opts.unitId,
        opts.ownerId,
        opts.folderId,
        `${opts.unitId}/${opts.ownerId}/${nome}`,
        nome,
        opts.awaiting ?? false,
        opts.lifecycle ?? null,
        opts.excluido ? new Date() : null,
      ],
    );
    return rows[0]!.id;
  }

  async function pessoa(unitId: string, email: string, role = 'collaborator', nome?: string) {
    const rows = await sql<{ id: string }>(
      `INSERT INTO users (unit_id, email, password_hash, role, full_name)
       VALUES ($1, $2, 'x', $3, $4) RETURNING id`,
      [unitId, email, role, nome ?? null],
    );
    return rows[0]!.id;
  }

  async function marcarSede(unitId: string, valor: boolean) {
    return request(app())
      .patch(`/units/${unitId}`)
      .set('Cookie', await cookie(ana))
      .send({ isHeadquarters: valor });
  }

  async function compartilhar(
    autor: string,
    body: Record<string, unknown>,
  ): Promise<request.Response> {
    return request(app())
      .post('/grants/cross-unit')
      .set('Cookie', await cookie(autor))
      .send(body);
  }

  async function verUrl(userId: string, fileId: string) {
    return request(app())
      .post(`/files/${fileId}/view-url`)
      .set('Cookie', await cookie(userId));
  }

  async function baixarUrl(userId: string, fileId: string) {
    return request(app())
      .post(`/files/${fileId}/download-url`)
      .set('Cookie', await cookie(userId));
  }

  async function conteudo(userId: string, folderId: string) {
    return request(app())
      .get(`/folders/${folderId}/contents`)
      .set('Cookie', await cookie(userId));
  }

  async function recebidos(userId: string): Promise<SharedWithMeItemResponse[]> {
    const res = await request(app())
      .get('/grants/received')
      .set('Cookie', await cookie(userId));
    expect(res.status).toBe(200);
    return res.body.items as SharedWithMeItemResponse[];
  }

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    const seed = await seedTwoUnits(pool);
    sede = seed.unitA;
    norte = seed.unitB;
    ana = seed.globalAdmin;
    donoSede = seed.userA;
    raira = seed.userB;
    await sql(`UPDATE users SET full_name = 'Raíra Damasceno' WHERE id = $1`, [raira]);
    await sql(`UPDATE units SET name = 'SEDE' WHERE id = $1`, [sede]);
    await sql(`UPDATE units SET name = 'Unidade Norte' WHERE id = $1`, [norte]);
    sul = (
      await sql<{ id: string }>(`INSERT INTO units (name) VALUES ('Unidade Sul') RETURNING id`)
    )[0]!.id;
    colegaNorte = await pessoa(norte, 'colega-norte@test.dev');
    adminNorte = await pessoa(norte, 'admin-norte@test.dev', 'unit_admin');
    pessoaSul = await pessoa(sul, 'pessoa-sul@test.dev');

    governanca = await pasta('Governança', sede, donoSede, null);
    atas = await pasta('Atas', sede, donoSede, governanca);
    ataProfunda = await arquivo({
      unitId: sede,
      ownerId: donoSede,
      folderId: atas,
      nome: 'ata.pdf',
    });
    foraDaGovernanca = await arquivo({ unitId: sede, ownerId: donoSede, folderId: null });

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

  describe('Marcação da SEDE (design.md D11)', () => {
    it('global_admin marca a SEDE; segunda SEDE, desativação e unit_admin são recusados', async () => {
      const marcada = await marcarSede(sede, true);
      expect(marcada.status).toBe(200);
      expect(marcada.body.isHeadquarters).toBe(true);

      const segunda = await marcarSede(norte, true);
      expect(segunda.status).toBe(409);
      expect(segunda.body.error).toBe('headquarters_already_set');

      const desativar = await request(app())
        .patch(`/units/${sede}`)
        .set('Cookie', await cookie(ana))
        .send({ status: 'desativado' });
      expect(desativar.status).toBe(409);

      const porAdminDeUnidade = await request(app())
        .patch(`/units/${norte}`)
        .set('Cookie', await cookie(adminNorte))
        .send({ isHeadquarters: true });
      expect(porAdminDeUnidade.status).toBe(403);
    });
  });

  describe('Concessão comum não atravessa unidades (design.md D10)', () => {
    it('recusa com 422 a concessão da Ana à Raíra, sem gravar nada', async () => {
      const res = await request(app())
        .post('/grants')
        .set('Cookie', await cookie(ana))
        .send({
          subjectUserIds: [raira],
          resourceType: 'folder',
          resourceId: governanca,
          permissions: ['view'],
        });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('cross_unit_subject');
      const rows = await sql('SELECT 1 FROM grants WHERE subject_user_id = $1', [raira]);
      expect(rows).toHaveLength(0);
    });

    it('lote misto é recusado por inteiro: nem a pessoa da própria unidade recebe', async () => {
      const res = await request(app())
        .post('/grants')
        .set('Cookie', await cookie(ana))
        .send({
          subjectUserIds: [donoSede, raira],
          resourceType: 'folder',
          resourceId: governanca,
          permissions: ['view'],
        });
      expect(res.status).toBe(422);
      const rows = await sql('SELECT 1 FROM grants WHERE resource_id = $1', [governanca]);
      expect(rows).toHaveLength(0);
    });
  });

  describe('Validação da concessão (design.md D7)', () => {
    it('verbo de escrita é recusado com 400', async () => {
      const res = await compartilhar(ana, {
        resourceType: 'folder',
        resourceId: governanca,
        subjectUnitId: norte,
        permissions: ['view', 'upload'],
      });
      expect(res.status).toBe(400);
    });

    it('colaborador não compartilha', async () => {
      const res = await compartilhar(donoSede, {
        resourceType: 'folder',
        resourceId: governanca,
        subjectUnitId: norte,
        permissions: ['view'],
      });
      expect(res.status).toBe(403);
    });

    it('global_admin não compartilha item de outra unidade (404)', async () => {
      const daNorte = await arquivo({ unitId: norte, ownerId: raira, folderId: null });
      const res = await compartilhar(ana, {
        resourceType: 'file',
        resourceId: daNorte,
        subjectUnitId: sul,
        permissions: ['view'],
      });
      expect(res.status).toBe(404);
    });

    it('pessoa que não é do destino é recusada, tudo ou nada', async () => {
      const res = await compartilhar(ana, {
        resourceType: 'folder',
        resourceId: governanca,
        subjectUnitId: norte,
        subjectUserIds: [raira, pessoaSul],
        permissions: ['view'],
      });
      expect(res.status).toBe(404);
      const rows = await sql('SELECT 1 FROM cross_unit_grants WHERE resource_id = $1', [
        governanca,
      ]);
      expect(rows).toHaveLength(0);
    });

    it('unidade que não é a SEDE só compartilha com a SEDE', async () => {
      const daNorte = await arquivo({ unitId: norte, ownerId: raira, folderId: null });
      const paraSul = await compartilhar(adminNorte, {
        resourceType: 'file',
        resourceId: daNorte,
        subjectUnitId: sul,
        permissions: ['view'],
      });
      expect(paraSul.status).toBe(422);
      expect(paraSul.body.error).toBe('cross_unit_destination_not_allowed');

      const destinos = await request(app())
        .get('/grants/cross-unit/destinations')
        .set('Cookie', await cookie(adminNorte));
      expect(destinos.status).toBe(200);
      expect(destinos.body.destinations.map((d: { id: string }) => d.id)).toEqual([sede]);

      const destinosDaSede = await request(app())
        .get('/grants/cross-unit/destinations')
        .set('Cookie', await cookie(ana));
      expect(destinosDaSede.body.destinations.map((d: { id: string }) => d.id).sort()).toEqual(
        [norte, sul].sort(),
      );
    });

    it('destinatários: só pessoas ativas de destino permitido, sem e-mail', async () => {
      const res = await request(app())
        .get(`/grants/cross-unit/recipients?unitId=${norte}`)
        .set('Cookie', await cookie(ana));
      expect(res.status).toBe(200);
      const ids = res.body.recipients.map((r: { id: string }) => r.id);
      expect(ids).toContain(raira);
      expect(ids).not.toContain(pessoaSul);
      expect(JSON.stringify(res.body)).not.toContain('@test.dev');

      const proibido = await request(app())
        .get(`/grants/cross-unit/recipients?unitId=${sul}`)
        .set('Cookie', await cookie(adminNorte));
      expect(proibido.status).toBe(404);
    });
  });

  describe('Governança da SEDE compartilhada com a Unidade Norte inteira', () => {
    let concessaoId: string;

    beforeAll(async () => {
      const res = await compartilhar(ana, {
        resourceType: 'folder',
        resourceId: governanca,
        subjectUnitId: norte,
        permissions: ['view'],
      });
      expect(res.status).toBe(201);
      expect(res.body.grants).toHaveLength(1);
      expect(res.body.grants[0].subjectUserId).toBeNull();
      expect(res.body.grants[0].subjectUnitName).toBe('Unidade Norte');
      concessaoId = res.body.grants[0].id;
    });

    it('a Raíra visualiza um documento profundo e o acesso é auditado na SEDE', async () => {
      const res = await verUrl(raira, ataProfunda);
      expect(res.status).toBe(200);
      expect(res.body.previewAvailable).toBe(true);

      const eventos = await sql<{ unit_id: string; actor_name: string; actor_unit_name: string }>(
        `SELECT unit_id, actor_name, actor_unit_name FROM audit_events
         WHERE file_id = $1 AND user_id = $2`,
        [ataProfunda, raira],
      );
      expect(eventos).toHaveLength(1);
      expect(eventos[0]!.unit_id).toBe(sede);
      expect(eventos[0]!.actor_name).toBe('Raíra Damasceno');
      expect(eventos[0]!.actor_unit_name).toBe('Unidade Norte');
    });

    it('a auditoria da origem mostra a Raíra com a unidade e sem e-mail', async () => {
      const res = await request(app())
        .get(`/files/${ataProfunda}/audit`)
        .set('Cookie', await cookie(donoSede));
      expect(res.status).toBe(200);
      const evento = (res.body as AuditQueryResponse).events.find((e) => e.actor.id === raira);
      expect(evento).toBeDefined();
      expect(evento!.actor.name).toBe('Raíra Damasceno');
      expect(evento!.actor.unitName).toBe('Unidade Norte');
      expect(evento!.actor.email).toBeNull();

      const peloDestino = await request(app())
        .get(`/files/${ataProfunda}/audit`)
        .set('Cookie', await cookie(raira));
      expect(peloDestino.status).toBe(403);
    });

    it('download sem o verbo é recusado', async () => {
      const res = await baixarUrl(raira, ataProfunda);
      expect(res.status).toBe(403);
    });

    it('pessoa cadastrada depois na unidade de destino também alcança', async () => {
      const nova = await pessoa(norte, 'nova-norte@test.dev');
      expect((await verUrl(nova, ataProfunda)).status).toBe(200);
    });

    it('terceira unidade e item fora da pasta seguem recusados', async () => {
      expect((await verUrl(pessoaSul, ataProfunda)).status).toBe(403);
      expect((await verUrl(raira, foraDaGovernanca)).status).toBe(403);
      expect((await conteudo(pessoaSul, governanca)).status).toBe(403);
    });

    it('item adicionado depois entra; item movido para fora sai', async () => {
      const novo = await arquivo({ unitId: sede, ownerId: donoSede, folderId: governanca });
      expect((await verUrl(raira, novo)).status).toBe(200);
      await sql('UPDATE files SET folder_id = NULL WHERE id = $1', [novo]);
      expect((await verUrl(raira, novo)).status).toBe(403);
    });

    it('obsoleto, pendente de cadastro e lixeira ficam de fora', async () => {
      const obsoleto = await arquivo({
        unitId: sede,
        ownerId: donoSede,
        folderId: governanca,
        lifecycle: 'obsolete',
      });
      const pendente = await arquivo({
        unitId: sede,
        ownerId: donoSede,
        folderId: governanca,
        awaiting: true,
      });
      const excluido = await arquivo({
        unitId: sede,
        ownerId: donoSede,
        folderId: governanca,
        excluido: true,
      });
      for (const id of [obsoleto, pendente, excluido]) {
        expect((await verUrl(raira, id)).status).toBe(403);
      }
      const lista = await conteudo(raira, governanca);
      const nomes = (lista.body as FolderContentsResponse).files.map((f) => f.id);
      expect(nomes).not.toContain(obsoleto);
      expect(nomes).not.toContain(pendente);
      expect(nomes).not.toContain(excluido);
    });

    it('navegação somente leitura, com trilha a partir da raiz compartilhada', async () => {
      const raiz = await conteudo(raira, governanca);
      expect(raiz.status).toBe(200);
      const corpo = raiz.body as FolderContentsResponse;
      expect(corpo.readOnly).toBe(true);
      expect(corpo.canUpload).toBe(false);
      expect(corpo.sharedFrom).toEqual({ unitId: sede, unitName: 'SEDE' });
      expect(corpo.breadcrumb).toEqual([]);
      expect(corpo.folders.map((f) => f.name)).toContain('Atas');

      const sub = await conteudo(raira, atas);
      expect(sub.status).toBe(200);
      expect((sub.body as FolderContentsResponse).breadcrumb.map((f) => f.name)).toEqual([
        'Governança',
      ]);
      expect((sub.body as FolderContentsResponse).files.map((f) => f.id)).toContain(ataProfunda);
    });

    it('escrita sobre conteúdo compartilhado é recusada', async () => {
      const renomear = await request(app())
        .patch(`/files/${ataProfunda}`)
        .set('Cookie', await cookie(raira))
        .send({ fileName: 'renomeado.pdf' });
      expect([403, 404]).toContain(renomear.status);
      const excluir = await request(app())
        .delete(`/files/${ataProfunda}`)
        .set('Cookie', await cookie(raira));
      expect([403, 404]).toContain(excluir.status);
      const envio = await request(app())
        .post('/files/upload-url')
        .set('Cookie', await cookie(raira))
        .send({
          fileName: 'x.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1,
          folderId: governanca,
        });
      expect([400, 403, 404]).toContain(envio.status);
      const linha = await sql<{ file_name: string; deleted_at: Date | null }>(
        'SELECT file_name, deleted_at FROM files WHERE id = $1',
        [ataProfunda],
      );
      expect(linha[0]!.file_name).toBe('ata.pdf');
      expect(linha[0]!.deleted_at).toBeNull();
    });

    it('busca não alcança conteúdo de outra unidade', async () => {
      const res = await request(app())
        .get('/files/search?q=ata')
        .set('Cookie', await cookie(raira));
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(ataProfunda);
    });

    it('a Governança aparece em "Compartilhados comigo" identificada com a SEDE', async () => {
      const itens = await recebidos(raira);
      const item = itens.find((i) => i.id === governanca);
      expect(item).toBeDefined();
      expect(item!.originUnit).toEqual({ id: sede, name: 'SEDE' });
      expect(item!.folderName).toBeNull();
      expect(item!.permissions.map((p) => p.permission)).toEqual(['view']);
      // Só a raiz: o conteúdo interno não vira item.
      expect(itens.find((i) => i.id === ataProfunda)).toBeUndefined();
    });

    it('o destino não lista nem revoga; a origem lista', async () => {
      const lista = await request(app())
        .get(`/grants/cross-unit?resourceType=folder&resourceId=${governanca}`)
        .set('Cookie', await cookie(adminNorte));
      expect(lista.status).toBe(404);
      const revogar = await request(app())
        .delete(`/grants/cross-unit/${concessaoId}`)
        .set('Cookie', await cookie(adminNorte));
      expect(revogar.status).toBe(404);

      const daOrigem = await request(app())
        .get(`/grants/cross-unit?resourceType=folder&resourceId=${governanca}`)
        .set('Cookie', await cookie(ana));
      expect(daOrigem.status).toBe(200);
      expect(daOrigem.body.grants.map((g: { id: string }) => g.id)).toEqual([concessaoId]);
    });

    it('SEDE desmarcada adormece o compartilhamento; remarcada, ele volta', async () => {
      expect((await marcarSede(sede, false)).status).toBe(200);
      expect((await verUrl(raira, ataProfunda)).status).toBe(403);
      expect((await recebidos(raira)).find((i) => i.id === governanca)).toBeUndefined();
      expect((await marcarSede(sede, true)).status).toBe(200);
      expect((await verUrl(raira, ataProfunda)).status).toBe(200);
    });

    it('revogação encerra o acesso na requisição seguinte', async () => {
      const res = await request(app())
        .delete(`/grants/cross-unit/${concessaoId}`)
        .set('Cookie', await cookie(ana));
      expect(res.status).toBe(204);
      expect((await verUrl(raira, ataProfunda)).status).toBe(403);
      expect((await conteudo(raira, governanca)).status).toBe(403);
    });
  });

  describe('Concessão a uma pessoa', () => {
    let documento: string;

    beforeAll(async () => {
      documento = await arquivo({ unitId: sede, ownerId: donoSede, folderId: null, nome: 'p.pdf' });
      const res = await compartilhar(ana, {
        resourceType: 'file',
        resourceId: documento,
        subjectUnitId: norte,
        subjectUserIds: [colegaNorte],
        permissions: ['download'],
      });
      expect(res.status).toBe(201);
    });

    it('só a pessoa alcança; o colega de unidade não', async () => {
      expect((await baixarUrl(colegaNorte, documento)).status).toBe(200);
      expect((await baixarUrl(raira, documento)).status).toBe(403);
      expect((await recebidos(raira)).find((i) => i.id === documento)).toBeUndefined();
    });

    it('a política do destino não entrega a concessão pessoal de um colega', async () => {
      const vistas = await ports.database.withTenantTransaction(
        { unitId: norte, userId: raira, role: 'collaborator' },
        async (client) => {
          const { rows } = await client.query(
            'SELECT 1 FROM cross_unit_grants WHERE resource_id = $1',
            [documento],
          );
          return rows.length;
        },
      );
      expect(vistas).toBe(0);
    });

    it('RLS: terceira unidade não lê nada; sem app.current_user_id o ramo pessoal nega', async () => {
      const daSul = await ports.database.withTenantTransaction(
        { unitId: sul, userId: pessoaSul, role: 'collaborator' },
        async (client) => (await client.query('SELECT 1 FROM cross_unit_grants')).rows.length,
      );
      expect(daSul).toBe(0);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_unit', $1, true)", [norte]);
        await client.query("SELECT set_config('app.user_role', 'collaborator', true)");
        const { rows } = await client.query(
          'SELECT 1 FROM cross_unit_grants WHERE resource_id = $1',
          [documento],
        );
        expect(rows).toHaveLength(0);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      const daOrigem = await ports.database.withTenantTransaction(
        { unitId: sede, userId: donoSede, role: 'collaborator' },
        async (c) =>
          (await c.query('SELECT 1 FROM cross_unit_grants WHERE resource_id = $1', [documento]))
            .rows.length,
      );
      expect(daOrigem).toBe(1);
    });

    it('prazo vencido encerra o acesso', async () => {
      await sql(
        `UPDATE cross_unit_grants SET expires_at = now() - interval '1 minute'
                 WHERE resource_id = $1`,
        [documento],
      );
      expect((await baixarUrl(colegaNorte, documento)).status).toBe(403);
      // Vencido também sai de "Compartilhados comigo" (spec compartilhados-comigo).
      expect((await recebidos(colegaNorte)).find((i) => i.id === documento)).toBeUndefined();
      await sql('UPDATE cross_unit_grants SET expires_at = NULL WHERE resource_id = $1', [
        documento,
      ]);
      expect((await baixarUrl(colegaNorte, documento)).status).toBe(200);
    });

    it('pessoa transferida de unidade perde a concessão pessoal', async () => {
      await sql('UPDATE users SET unit_id = $1 WHERE id = $2', [sul, colegaNorte]);
      expect((await baixarUrl(colegaNorte, documento)).status).toBe(403);
      await sql('UPDATE users SET unit_id = $1 WHERE id = $2', [norte, colegaNorte]);
    });
  });

  describe('Caminho comum primeiro (design.md D4)', () => {
    it('o dono acessa sem abrir transação de visita', async () => {
      const spy = vi.spyOn(ports.database, 'withSharedVisitTransaction');
      try {
        expect((await verUrl(donoSede, ataProfunda)).status).toBe(200);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('Sentido inverso: unidade → SEDE', () => {
    it('o admin da Norte compartilha com a SEDE, e a SEDE alcança', async () => {
      const relatorio = await arquivo({ unitId: norte, ownerId: raira, folderId: null });
      expect((await verUrl(donoSede, relatorio)).status).toBe(403);
      const res = await compartilhar(adminNorte, {
        resourceType: 'file',
        resourceId: relatorio,
        subjectUnitId: sede,
        permissions: ['view', 'download'],
      });
      expect(res.status).toBe(201);
      expect((await verUrl(donoSede, relatorio)).status).toBe(200);
      expect((await baixarUrl(ana, relatorio)).status).toBe(200);
      // A Sul continua de fora.
      expect((await verUrl(pessoaSul, relatorio)).status).toBe(403);
    });
  });

  describe('Transação de visita (design.md D3)', () => {
    it('é somente leitura por imposição do banco', async () => {
      const tentativa = ports.database.withSharedVisitTransaction(
        { userId: raira, originUnitId: sede },
        (client) =>
          client.query(
            `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, NULL, 'invasão')`,
            [sede, raira],
          ),
      );
      await expect(tentativa).rejects.toThrow();

      const atualizadas = await ports.database.withSharedVisitTransaction(
        { userId: raira, originUnitId: sede },
        async (client) => {
          const { rowCount } = await client.query(
            `UPDATE files SET file_name = 'x' WHERE unit_id = $1`,
            [sede],
          );
          return rowCount;
        },
      );
      expect(atualizadas).toBe(0);
    });

    it('não enxerga terceira unidade nem a unidade da própria pessoa', async () => {
      const visiveis = await ports.database.withSharedVisitTransaction(
        { userId: raira, originUnitId: sede },
        async (client) => {
          const { rows } = await client.query<{ unit_id: string }>(
            'SELECT DISTINCT unit_id FROM files',
          );
          return rows.map((row) => row.unit_id);
        },
      );
      expect(visiveis).toEqual([sede]);
    });

    it('só lib/cross-unit-share.ts (e o seam) abre visita', () => {
      const src = join(fileURLToPath(new URL('.', import.meta.url)), '..');
      const permitidos = new Set([
        'lib/cross-unit-share.ts',
        'ports/database-port.ts',
        'adapters/pg-database-port.ts',
      ]);
      const ofensores: string[] = [];
      const visitar = (dir: string) => {
        for (const nome of readdirSync(dir)) {
          const caminho = join(dir, nome);
          if (statSync(caminho).isDirectory()) {
            if (nome !== '__tests__') visitar(caminho);
            continue;
          }
          if (!nome.endsWith('.ts')) continue;
          const rel = relative(src, caminho).split('\\').join('/');
          if (permitidos.has(rel)) continue;
          if (readFileSync(caminho, 'utf8').includes('withSharedVisitTransaction')) {
            ofensores.push(rel);
          }
        }
      };
      visitar(src);
      expect(ofensores).toEqual([]);
    });
  });

  describe('Migração das concessões sem efeito (design.md D10)', () => {
    it('view vira compartilhamento por pessoa; todas saem de grants', async () => {
      const alvo = await arquivo({ unitId: sede, ownerId: donoSede, folderId: null });
      await sql(
        `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by)
         VALUES ($1, $2, 'file', $3, 'view', $4), ($1, $2, 'file', $3, 'delete', $4)`,
        [sede, pessoaSul, alvo, ana],
      );
      const migracao = readFileSync(
        join(
          fileURLToPath(new URL('.', import.meta.url)),
          '..',
          'db',
          'migrations',
          '0026_cross_unit_grants.sql',
        ),
        'utf8',
      );
      const blocos = migracao.match(/DO \$\$[\s\S]*?\$\$;/g) ?? [];
      const dados = blocos.find((bloco) => bloco.includes('copiadas'));
      expect(dados).toBeDefined();
      await withSystemBypass(pool, (client) => client.query(dados!));

      const restantes = await sql('SELECT 1 FROM grants WHERE subject_user_id = $1', [pessoaSul]);
      expect(restantes).toHaveLength(0);
      const copiadas = await sql<{ permission: string; subject_unit_id: string }>(
        'SELECT permission, subject_unit_id FROM cross_unit_grants WHERE resource_id = $1',
        [alvo],
      );
      expect(copiadas).toEqual([{ permission: 'view', subject_unit_id: sul }]);
      // Com a SEDE marcada (origem), a cópia já vale.
      expect((await verUrl(pessoaSul, alvo)).status).toBe(200);
    });
  });
});
