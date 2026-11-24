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

/**
 * Contagem de documentos por subpasta na resposta de conteúdo (change
 * `contagem-de-documentos-nas-pastas`, design.md D1/D4, e
 * `contagem-de-documentos-na-subarvore`, design.md D1/D2/D3; US 11.1,
 * cenário 3; `docs/demanda_cliente_3.md`, item 7).
 *
 * É teste de **não vazamento**, irmão de `isolamento-unidade.test.ts` e
 * `expiracao-permissoes-acesso.test.ts`: o número não pode dizer mais do que a
 * pessoa encontra navegando a partir da pasta. A propriedade central é a
 * igualdade recursiva
 * `documentCount(X) === files(X) + Σ documentCount(S)` sobre as subpastas `S`
 * que `GET /folders/X/contents` lista, afirmada para cada perfil e em cada
 * nível da árvore.
 */

interface ListedFolder {
  id: string;
  name: string;
  documentCount?: number;
}

const PAST = '2000-01-01T00:00:00Z';
const FUTURE = '2999-01-01T00:00:00Z';

describe('Contagem de documentos nas pastas, filtrada pelo acesso', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let adminA: string;
  let viewer: string;
  let uploader: string;

  let pastaGeral: string;
  let pastaSoSubpastas: string;
  let pastaSubpasta: string;
  let pastaAuditorias: string;
  let pastaCompras: string;
  let pastaOutraUnidade: string;
  let arquivoComView: string;
  let arquivoExpirado: string;
  let arquivoNaLixeira: string;
  let arquivoObsoleto: string;
  let arquivoPendente: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows: users } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'admin-a-contagem@test.dev', 'x', 'unit_admin'),
           ($1, 'viewer-contagem@test.dev', 'x', 'collaborator'),
           ($1, 'uploader-contagem@test.dev', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    adminA = users[0]!.id;
    viewer = users[1]!.id;
    uploader = users[2]!.id;

    async function makeFolder(
      unitId: string,
      ownerId: string,
      name: string,
      parentId: string | null = null,
    ): Promise<string> {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, $3, $4) RETURNING id`,
          [unitId, ownerId, parentId, name],
        ),
      );
      return rows[0]!.id;
    }

    async function makeFile(
      unitId: string,
      ownerId: string,
      folderId: string,
      name: string,
      extra: { deleted?: boolean; obsolete?: boolean; awaiting?: boolean } = {},
    ): Promise<string> {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, status,
             deleted_at, lifecycle_state, awaiting_registration)
           VALUES ($1, $2, $3, $4, $5, 'active',
             CASE WHEN $6 THEN now() ELSE NULL END,
             CASE WHEN $7 THEN 'obsolete' ELSE NULL END,
             $8)
           RETURNING id`,
          [
            unitId,
            ownerId,
            folderId,
            `${unitId}/${ownerId}/${name}`,
            name,
            extra.deleted ?? false,
            extra.obsolete ?? false,
            extra.awaiting ?? false,
          ],
        ),
      );
      return rows[0]!.id;
    }

    async function grant(
      subject: string,
      type: 'folder' | 'file',
      resourceId: string,
      expiresAt: string,
    ): Promise<void> {
      await withSystemBypass(pool, (client) =>
        client.query(
          `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
           VALUES ($1, $2, $3, $4, 'view', $5, $6)`,
          [ids.unitA, subject, type, resourceId, adminA, expiresAt],
        ),
      );
    }

    // "Geral" (dono: userA) com: 2 comuns (um com `view` vigente para o
    // viewer, um com `view` expirada), 1 na lixeira, 1 obsoleto e 1 pendente
    // de cadastro enviado pelo uploader.
    pastaGeral = await makeFolder(ids.unitA, ids.userA, 'Geral');
    arquivoComView = await makeFile(ids.unitA, ids.userA, pastaGeral, 'com-view.pdf');
    arquivoExpirado = await makeFile(ids.unitA, ids.userA, pastaGeral, 'expirado.pdf');
    arquivoNaLixeira = await makeFile(ids.unitA, ids.userA, pastaGeral, 'lixeira.pdf', {
      deleted: true,
    });
    arquivoObsoleto = await makeFile(ids.unitA, ids.userA, pastaGeral, 'obsoleto.pdf', {
      obsolete: true,
    });
    arquivoPendente = await makeFile(ids.unitA, uploader, pastaGeral, 'pendente.pdf', {
      awaiting: true,
    });

    // "Setores": só subpastas, com documentos dentro (subárvore, change
    // `contagem-de-documentos-na-subarvore`, design.md D3):
    //   Setores/
    //     Qualidade/            na-subpasta.pdf     (viewer: `view` no arquivo, não na pasta)
    //       Auditorias/         auditoria.pdf       (viewer: `view` na pasta e no arquivo)
    //     Compras/              compras.pdf, obsoleto, pendente do uploader
    //     Antiga/ (lixeira)     antiga.pdf vivo
    //     Temporária/           temporaria.pdf      (viewer: `view` da pasta expirada)
    pastaSoSubpastas = await makeFolder(ids.unitA, ids.userA, 'Setores');
    pastaSubpasta = await makeFolder(ids.unitA, ids.userA, 'Qualidade', pastaSoSubpastas);
    const arquivoNaSubpasta = await makeFile(
      ids.unitA,
      ids.userA,
      pastaSubpasta,
      'na-subpasta.pdf',
    );
    pastaAuditorias = await makeFolder(ids.unitA, ids.userA, 'Auditorias', pastaSubpasta);
    const arquivoAuditoria = await makeFile(ids.unitA, ids.userA, pastaAuditorias, 'auditoria.pdf');
    pastaCompras = await makeFolder(ids.unitA, ids.userA, 'Compras', pastaSoSubpastas);
    const arquivoCompras = await makeFile(ids.unitA, ids.userA, pastaCompras, 'compras.pdf');
    const obsoletoCompras = await makeFile(ids.unitA, ids.userA, pastaCompras, 'obsoleto-c.pdf', {
      obsolete: true,
    });
    const pendenteCompras = await makeFile(ids.unitA, uploader, pastaCompras, 'pendente-c.pdf', {
      awaiting: true,
    });
    const pastaAntiga = await makeFolder(ids.unitA, ids.userA, 'Antiga', pastaSoSubpastas);
    await withSystemBypass(pool, (client) =>
      client.query('UPDATE folders SET deleted_at = now() WHERE id = $1', [pastaAntiga]),
    );
    const arquivoAntigo = await makeFile(ids.unitA, ids.userA, pastaAntiga, 'antiga.pdf');
    const pastaTemporaria = await makeFolder(ids.unitA, ids.userA, 'Temporária', pastaSoSubpastas);
    const arquivoTemporario = await makeFile(
      ids.unitA,
      ids.userA,
      pastaTemporaria,
      'temporaria.pdf',
    );

    // Pasta e arquivos da outra unidade.
    pastaOutraUnidade = await makeFolder(ids.unitB, ids.userB, 'Geral B');
    await makeFile(ids.unitB, ids.userB, pastaOutraUnidade, 'b1.pdf');
    await makeFile(ids.unitB, ids.userB, pastaOutraUnidade, 'b2.pdf');

    // Viewer: `view` na pasta Geral e em Setores (sem herança), `view` vigente
    // em um arquivo, expirada em outro, e vigente nos itens que os cortes
    // restritivos (lixeira, obsoleto, pendente) devem esconder mesmo assim.
    await grant(viewer, 'folder', pastaGeral, FUTURE);
    await grant(viewer, 'folder', pastaSoSubpastas, FUTURE);
    await grant(viewer, 'file', arquivoComView, FUTURE);
    await grant(viewer, 'file', arquivoExpirado, PAST);
    await grant(viewer, 'file', arquivoNaLixeira, FUTURE);
    await grant(viewer, 'file', arquivoObsoleto, FUTURE);
    await grant(viewer, 'file', arquivoPendente, FUTURE);
    // Viewer na subárvore de Setores: `view` no arquivo de Qualidade sem `view`
    // na pasta (podado); `view` em Auditorias e no arquivo dela, abaixo de
    // Qualidade (podado com a descendência); `view` em Compras e em todos os
    // arquivos dela (só o comum conta); `view` na Antiga e no arquivo dela
    // (pasta na lixeira, podada); `view` expirada em Temporária, com `view`
    // vigente no arquivo (ramo podado sem job).
    await grant(viewer, 'file', arquivoNaSubpasta, FUTURE);
    await grant(viewer, 'folder', pastaAuditorias, FUTURE);
    await grant(viewer, 'file', arquivoAuditoria, FUTURE);
    await grant(viewer, 'folder', pastaCompras, FUTURE);
    await grant(viewer, 'file', arquivoCompras, FUTURE);
    await grant(viewer, 'file', obsoletoCompras, FUTURE);
    await grant(viewer, 'file', pendenteCompras, FUTURE);
    await grant(viewer, 'folder', pastaAntiga, FUTURE);
    await grant(viewer, 'file', arquivoAntigo, FUTURE);
    await grant(viewer, 'folder', pastaTemporaria, PAST);
    await grant(viewer, 'file', arquivoTemporario, FUTURE);
    // Uploader: `view` só nas pastas (o pendente é dele).
    await grant(uploader, 'folder', pastaGeral, FUTURE);
    await grant(uploader, 'folder', pastaSoSubpastas, FUTURE);
    await grant(uploader, 'folder', pastaCompras, FUTURE);

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

  async function root(userId: string): Promise<ListedFolder[]> {
    const res = await request(createApp(ports))
      .get('/folders/root/contents')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return res.body.folders as ListedFolder[];
  }

  async function filesIn(userId: string, folderId: string): Promise<number> {
    const res = await request(createApp(ports))
      .get(`/folders/${folderId}/contents`)
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return (res.body.files as unknown[]).length;
  }

  function countOf(folders: ListedFolder[], id: string): number | undefined {
    return folders.find((f) => f.id === id)?.documentCount;
  }

  /**
   * Igualdade recursiva (design.md D3 de `contagem-de-documentos-na-subarvore`):
   * a contagem informada para `folderId` é o número de documentos listados ao
   * abri-la mais a soma das contagens das subpastas listadas lá dentro — e o
   * mesmo vale, descendo, para cada uma delas.
   */
  async function assertRecursiveCount(
    userId: string,
    folderId: string,
    expected: number | undefined,
  ): Promise<void> {
    const res = await request(createApp(ports))
      .get(`/folders/${folderId}/contents`)
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    const subs = res.body.folders as ListedFolder[];
    const sum =
      (res.body.files as unknown[]).length + subs.reduce((t, f) => t + (f.documentCount ?? NaN), 0);
    expect(sum).toBe(expected);
    for (const sub of subs) await assertRecursiveCount(userId, sub.id, sub.documentCount);
  }

  it('dono: conta comuns, obsoleto fora, pendente de terceiro fora, lixeira fora', async () => {
    const folders = await root(ids.userA);
    // com-view + expirado (do dono). Obsoleto sai até para o dono; o pendente
    // é do uploader; a lixeira nunca conta.
    expect(countOf(folders, pastaGeral)).toBe(2);
    expect(countOf(folders, pastaGeral)).toBe(await filesIn(ids.userA, pastaGeral));
  });

  it('admin da unidade: conta todos os vivos, inclusive obsoleto e pendente, nunca a lixeira', async () => {
    const folders = await root(adminA);
    expect(countOf(folders, pastaGeral)).toBe(4);
    expect(countOf(folders, pastaGeral)).toBe(await filesIn(adminA, pastaGeral));
  });

  it('colaborador com concessões parciais: só o que pode visualizar, sem herança da pasta', async () => {
    const folders = await root(viewer);
    // Só `com-view.pdf`: a concessão sobre a pasta não libera o resto, a do
    // expirado venceu (relógio do banco, sem job), e lixeira, obsoleto e
    // pendente de terceiro saem mesmo com `view` vigente.
    expect(countOf(folders, pastaGeral)).toBe(1);
    expect(countOf(folders, pastaGeral)).toBe(await filesIn(viewer, pastaGeral));
  });

  it('quem enviou o pendente de cadastro o vê contado', async () => {
    const folders = await root(uploader);
    expect(countOf(folders, pastaGeral)).toBe(1);
    expect(countOf(folders, pastaGeral)).toBe(await filesIn(uploader, pastaGeral));
  });

  it('pasta só com subpastas soma os documentos das subpastas alcançáveis', async () => {
    // Dono: Qualidade 1 + Auditorias 1 + Compras 1 (obsoleto sai até para o
    // dono; o pendente é do uploader) + Temporária 1; Antiga está na lixeira.
    expect(countOf(await root(ids.userA), pastaSoSubpastas)).toBe(4);
    // Admin da unidade: obsoleto e pendente contam (Compras 3); a pasta na
    // lixeira é podada também para ele, com o arquivo vivo dentro.
    expect(countOf(await root(adminA), pastaSoSubpastas)).toBe(6);
    // E a contagem também vem nas subpastas de `/folders/:id/contents`.
    const res = await request(createApp(ports))
      .get(`/folders/${pastaSoSubpastas}/contents`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    const subs = res.body.folders as ListedFolder[];
    expect(countOf(subs, pastaSubpasta)).toBe(2);
    expect(countOf(subs, pastaCompras)).toBe(1);
  });

  it('subpasta sem acesso fica fora da soma, com toda a descendência', async () => {
    // Viewer: só `compras.pdf`. Qualidade não pode ser aberta (o `view` no
    // arquivo dela não basta) e leva Auditorias junto, mesmo com `view` na
    // pasta e no arquivo; Antiga está na lixeira; a concessão sobre
    // Temporária expirou; obsoleto e pendente de terceiro saem.
    expect(countOf(await root(viewer), pastaSoSubpastas)).toBe(1);
    const res = await request(createApp(ports))
      .get(`/folders/${pastaSoSubpastas}/contents`)
      .set('Cookie', await sessionCookieFor(ports, viewer));
    expect((res.body.folders as ListedFolder[]).map((f) => f.id)).toEqual([pastaCompras]);
  });

  it('quem enviou o pendente de cadastro o vê contado também dentro de subpasta', async () => {
    expect(countOf(await root(uploader), pastaSoSubpastas)).toBe(1);
  });

  it('igualdade recursiva: a contagem é a soma do que se encontra navegando', async () => {
    for (const user of [ids.userA, adminA, viewer, uploader, ids.globalAdmin, ids.userB]) {
      for (const folder of await root(user)) {
        await assertRecursiveCount(user, folder.id, folder.documentCount);
      }
    }
  });

  it('pasta sem acesso não aparece nem é contada', async () => {
    // Colaborador da mesma unidade sem concessão nenhuma.
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES ($1, 'sem-acesso-contagem@test.dev', 'x', 'collaborator') RETURNING id`,
        [ids.unitA],
      ),
    );
    const folders = await root(rows[0]!.id);
    expect(folders).toEqual([]);
  });

  it('admin global conta só a própria unidade e não vê pasta de outra', async () => {
    const folders = await root(ids.globalAdmin);
    expect(folders.map((f) => f.id)).not.toContain(pastaOutraUnidade);
    expect(countOf(folders, pastaGeral)).toBe(4);
    expect(countOf(folders, pastaGeral)).toBe(await filesIn(ids.globalAdmin, pastaGeral));
    expect(countOf(folders, pastaSoSubpastas)).toBe(6);
  });

  it('a outra unidade conta só o que é dela', async () => {
    const folders = await root(ids.userB);
    expect(folders.map((f) => f.id)).toEqual([pastaOutraUnidade]);
    expect(countOf(folders, pastaOutraUnidade)).toBe(2);
  });

  it('ciclo em parent_id não trava a requisição', async () => {
    // Linha inconsistente por qualquer via (design.md D2): X e Y apontam uma
    // para a outra. Descendo de uma pasta listada só se chega ao ciclo se a
    // própria pasta aberta estiver nele; a guarda da trilha responde com erro
    // tratado antes da contagem, e a raiz segue listando normalmente.
    const x = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, NULL, 'X') RETURNING id`,
        [ids.unitA, ids.userA],
      ),
    );
    const xId = x.rows[0]!.id;
    const y = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO folders (unit_id, owner_id, parent_id, name) VALUES ($1, $2, $3, 'Y') RETURNING id`,
        [ids.unitA, ids.userA, xId],
      ),
    );
    await withSystemBypass(pool, (client) =>
      client.query('UPDATE folders SET parent_id = $1 WHERE id = $2', [y.rows[0]!.id, xId]),
    );

    const res = await request(createApp(ports))
      .get(`/folders/${xId}/contents`)
      .set('Cookie', await sessionCookieFor(ports, ids.userA));
    expect(res.status).toBe(500);
    expect(countOf(await root(ids.userA), pastaSoSubpastas)).toBe(4);
  });
});
