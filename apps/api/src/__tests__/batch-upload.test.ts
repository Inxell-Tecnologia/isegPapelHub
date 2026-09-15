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
import { config } from '../config.js';

interface FolderBody {
  id: string;
  parentId: string | null;
  name: string;
}

describe('Envio em lote e upload de pasta (US 3.1, US 3.2)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

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

  it('lote totalmente válido: cada item recebe URL própria e independente', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({
        items: [
          { fileName: 'um.txt', contentType: 'text/plain', declaredSizeBytes: 10 },
          { fileName: 'dois.txt', contentType: 'text/plain', declaredSizeBytes: 20 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toMatchObject({ fileName: 'um.txt', ok: true });
    expect(res.body.results[1]).toMatchObject({ fileName: 'dois.txt', ok: true });
    expect(res.body.results[0].uploadUrl).toBeTruthy();
    expect(res.body.results[0].objectPath).not.toBe(res.body.results[1].objectPath);
  });

  it('falha parcial: item recusado por cota não impede os demais; reenvio isolado do item recusado funciona', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);
    const quota = config.storageQuotaBytesPerUser;

    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', cookie)
      .send({
        items: [
          { fileName: 'cabe.txt', contentType: 'text/plain', declaredSizeBytes: 100 },
          {
            fileName: 'estoura.bin',
            contentType: 'application/octet-stream',
            declaredSizeBytes: quota + 1,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ fileName: 'cabe.txt', ok: true });
    expect(res.body.results[1]).toMatchObject({
      fileName: 'estoura.bin',
      ok: false,
      error: 'quota exceeded',
    });

    const rows = await withSystemBypass(pool, (client) =>
      client.query('SELECT file_name FROM files WHERE owner_id = $1', [ids.userA]),
    );
    const fileNames = rows.rows.map((r: { file_name: string }) => r.file_name);
    expect(fileNames).toContain('cabe.txt');
    expect(fileNames).not.toContain('estoura.bin');

    // Nova tentativa apenas do item que falhou, dentro da cota, conclui isolada.
    const retry = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', cookie)
      .send({
        items: [
          {
            fileName: 'estoura.bin',
            contentType: 'application/octet-stream',
            declaredSizeBytes: 50,
          },
        ],
      });
    expect(retry.status).toBe(200);
    expect(retry.body.results[0]).toMatchObject({ fileName: 'estoura.bin', ok: true });
  });

  it('cota consciente do lote: itens que cabem individualmente mas estouram no conjunto são recusados', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userB);
    const quota = config.storageQuotaBytesPerUser;
    const each = Math.floor(quota / 2) + 1000; // dois itens, cada um cabe sozinho, juntos não

    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', cookie)
      .send({
        items: [
          {
            fileName: 'metade-1.bin',
            contentType: 'application/octet-stream',
            declaredSizeBytes: each,
          },
          {
            fileName: 'metade-2.bin',
            contentType: 'application/octet-stream',
            declaredSizeBytes: each,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ fileName: 'metade-1.bin', ok: true });
    expect(res.body.results[1]).toMatchObject({
      fileName: 'metade-2.bin',
      ok: false,
      error: 'quota exceeded',
    });

    const rows = await withSystemBypass(pool, (client) =>
      client.query('SELECT file_name FROM files WHERE owner_id = $1', [ids.userB]),
    );
    expect(rows.rows.map((r: { file_name: string }) => r.file_name)).toEqual(['metade-1.bin']);
  });

  it('estrutura de subpastas preservada: relativePath recria a hierarquia e vincula cada arquivo à pasta-folha', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', cookie)
      .send({
        items: [
          {
            fileName: 'a.pdf',
            contentType: 'application/pdf',
            declaredSizeBytes: 10,
            relativePath: 'Relatorios/2024',
          },
          {
            fileName: 'b.pdf',
            contentType: 'application/pdf',
            declaredSizeBytes: 10,
            relativePath: 'Relatorios/2025',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);

    const root = await request(app).get('/folders/root/contents').set('Cookie', cookie);
    const relatorios = root.body.folders.find((f: FolderBody) => f.name === 'Relatorios');
    expect(relatorios).toBeTruthy();

    const relatoriosContents = await request(app)
      .get(`/folders/${relatorios.id}/contents`)
      .set('Cookie', cookie);
    const subfolderNames = relatoriosContents.body.folders.map((f: FolderBody) => f.name).sort();
    expect(subfolderNames).toEqual(['2024', '2025']);

    const folder2024 = relatoriosContents.body.folders.find((f: FolderBody) => f.name === '2024');
    const contents2024 = await request(app)
      .get(`/folders/${folder2024.id}/contents`)
      .set('Cookie', cookie);
    expect(contents2024.body.files.map((f: { fileName: string }) => f.fileName)).toEqual(['a.pdf']);
  });

  it('reaproveitamento e idempotência: reenvio do mesmo lote não duplica pastas', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    const sendBatch = () =>
      request(app)
        .post('/files/upload-urls')
        .set('Cookie', cookie)
        .send({
          items: [
            {
              fileName: 'x.txt',
              contentType: 'text/plain',
              declaredSizeBytes: 5,
              relativePath: 'Idempotente/Sub',
            },
          ],
        });

    const first = await sendBatch();
    expect(first.status).toBe(200);
    const second = await sendBatch();
    expect(second.status).toBe(200);

    const dup = await withSystemBypass(pool, (client) =>
      client.query(
        `SELECT unit_id, parent_id, lower(name) FROM folders
         WHERE unit_id = $1 AND lower(name) IN ('idempotente', 'sub')
         GROUP BY unit_id, parent_id, lower(name) HAVING count(*) > 1`,
        [ids.unitA],
      ),
    );
    expect(dup.rows).toHaveLength(0);
  });

  it('árvore ancorada na pasta de destino informada', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);

    const destination = await request(app)
      .post('/folders')
      .set('Cookie', cookie)
      .send({ name: 'Projeto' });
    const destinationId = (destination.body as FolderBody).id;

    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', cookie)
      .send({
        destinationFolderId: destinationId,
        items: [
          {
            fileName: 'ancorado.txt',
            contentType: 'text/plain',
            declaredSizeBytes: 5,
            relativePath: 'Docs',
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.results[0].ok).toBe(true);

    const projetoContents = await request(app)
      .get(`/folders/${destinationId}/contents`)
      .set('Cookie', cookie);
    const docsFolder = projetoContents.body.folders.find((f: FolderBody) => f.name === 'Docs');
    expect(docsFolder).toBeTruthy();
  });

  it('pasta de destino de outra unidade não é utilizável: nada é criado, sem vazar existência', async () => {
    const app = createApp(ports);
    const folderInB = await request(app)
      .post('/folders')
      .set('Cookie', await sessionCookieFor(ports, ids.userB))
      .send({ name: 'Pasta B Destino' });
    const folderBId = (folderInB.body as FolderBody).id;

    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({
        destinationFolderId: folderBId,
        items: [{ fileName: 'cross.txt', contentType: 'text/plain', declaredSizeBytes: 5 }],
      });

    expect(res.status).toBe(404);

    const created = await withSystemBypass(pool, (client) =>
      client.query('SELECT 1 FROM files WHERE file_name = $1', ['cross.txt']),
    );
    expect(created.rows).toHaveLength(0);
  });

  it('relativePath com path traversal é recusado por item, sem abortar o lote', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({
        items: [
          { fileName: 'ok.txt', contentType: 'text/plain', declaredSizeBytes: 5 },
          {
            fileName: 'malicioso.txt',
            contentType: 'text/plain',
            declaredSizeBytes: 5,
            relativePath: '../escape',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ fileName: 'ok.txt', ok: true });
    expect(res.body.results[1]).toMatchObject({
      fileName: 'malicioso.txt',
      ok: false,
      error: 'invalid path',
    });
  });
});

describe('Defeitos do envio em lote (change corrige-defeitos-envio-lote)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

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

  function itemsOfLength(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      fileName: `arquivo-${i}.txt`,
      contentType: 'text/plain',
      declaredSizeBytes: 10,
    }));
  }

  // design.md D2 — o teto recusa antes de qualquer efeito.
  it('recusa lote acima do teto com código próprio e sem efeito colateral', async () => {
    const app = createApp(ports);
    const before = await withSystemBypass(pool, (client) =>
      client.query('SELECT count(*)::int AS n FROM files WHERE owner_id = $1', [ids.userA]),
    );
    const foldersBefore = await withSystemBypass(pool, (client) =>
      client.query('SELECT count(*)::int AS n FROM folders WHERE owner_id = $1', [ids.userA]),
    );

    const excedente = config.uploadBatch.maxItems + 1;
    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({
        items: itemsOfLength(excedente).map((item) => ({
          ...item,
          relativePath: 'Pasta Que Nao Deve Nascer',
        })),
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'upload_batch_limit_exceeded',
      found: excedente,
      allowed: config.uploadBatch.maxItems,
    });

    const after = await withSystemBypass(pool, (client) =>
      client.query('SELECT count(*)::int AS n FROM files WHERE owner_id = $1', [ids.userA]),
    );
    const foldersAfter = await withSystemBypass(pool, (client) =>
      client.query('SELECT count(*)::int AS n FROM folders WHERE owner_id = $1', [ids.userA]),
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(foldersAfter.rows[0].n).toBe(foldersBefore.rows[0].n);
  });

  // Fronteira inclusiva: exatamente o teto passa.
  it('aceita lote com exatamente o teto de itens', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({ items: itemsOfLength(config.uploadBatch.maxItems) });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(config.uploadBatch.maxItems);
    expect(res.body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);
  });

  // O teto novo não pode ter absorvido a recusa de lista vazia já existente.
  it('lista vazia continua recusada como corpo inválido, não como teto', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid request body' });
  });

  // design.md D3 — o prazo de envio não é mais emprestado do download.
  it('prazo da URL de envio é o próprio, não o de download', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .send({
        items: [{ fileName: 'prazo.txt', contentType: 'text/plain', declaredSizeBytes: 10 }],
      });

    expect(res.status).toBe(200);
    const janelaMs = new Date(res.body.results[0].expiresAt).getTime() - Date.now();
    const esperadoMs = config.signedUrlUploadTtlSeconds * 1000;
    const downloadMs = config.signedUrlDownloadTtlSeconds * 1000;

    expect(esperadoMs).not.toBe(downloadMs);
    expect(janelaMs).toBeGreaterThan(esperadoMs - 60_000);
    expect(janelaMs).toBeLessThanOrEqual(esperadoMs);
  });

  // A independência de verdade: mexer no TTL de download não pode mover o
  // prazo de envio um milissegundo (spec `platform-infrastructure`, cenário
  // "Prazo de envio é independente do de download"). O teste acima mostra que
  // os valores diferem hoje; este mostra que não há acoplamento.
  it('alterar o TTL de download não altera o prazo devolvido pelo envio', async () => {
    const app = createApp(ports);
    const cookie = await sessionCookieFor(ports, ids.userA);
    const pedir = async (nome: string) =>
      request(app)
        .post('/files/upload-urls')
        .set('Cookie', cookie)
        .send({ items: [{ fileName: nome, contentType: 'text/plain', declaredSizeBytes: 10 }] });

    const original = config.signedUrlDownloadTtlSeconds;
    try {
      const antes = await pedir('antes.txt');
      const janelaAntes = new Date(antes.body.results[0].expiresAt).getTime() - Date.now();

      config.signedUrlDownloadTtlSeconds = original * 4;
      const depois = await pedir('depois.txt');
      const janelaDepois = new Date(depois.body.results[0].expiresAt).getTime() - Date.now();

      // Mesma janela nas duas, a menos do tempo decorrido entre as chamadas.
      expect(Math.abs(janelaDepois - janelaAntes)).toBeLessThan(5_000);
      expect(janelaDepois).toBeLessThanOrEqual(config.signedUrlUploadTtlSeconds * 1000);
    } finally {
      config.signedUrlDownloadTtlSeconds = original;
    }
  });
});

// design.md D1 — erro de leitura do corpo ganha status próprio; o resto segue
// 500 opaco. Um describe separado porque não precisa de banco.
describe('Tratamento de erro de requisição malformada (design.md D1)', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

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

  it('corpo acima do limite responde 413, não 500', async () => {
    const app = createApp(ports);
    const gordo = 'x'.repeat(config.requestBodyMaxBytes + 1024);

    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ items: [{ fileName: gordo }] }));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'request_body_too_large' });
  });

  it('JSON inválido responde 400, não 500', async () => {
    const app = createApp(ports);
    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .set('Content-Type', 'application/json')
      .send('{ isto nao e json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_json' });
  });

  it('um lote no teto de itens cabe no limite de corpo, com nomes e caminhos reais', async () => {
    // A razão de ser do teto de corpo: o pior caso medido (nome real +
    // relativePath) do maior lote aceito precisa passar folgado.
    const app = createApp(ports);
    const items = Array.from({ length: config.uploadBatch.maxItems }, (_, i) => ({
      fileName: `Relatorio Trimestral 2024 - Q${i}.pdf`,
      contentType: 'application/pdf',
      declaredSizeBytes: 1024,
      relativePath: 'Relatorios/2024/Trimestre 1',
    }));
    const corpo = JSON.stringify({ items });
    expect(Buffer.byteLength(corpo)).toBeLessThan(config.requestBodyMaxBytes);

    const res = await request(app)
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, ids.userA))
      .set('Content-Type', 'application/json')
      .send(corpo);

    expect(res.status).toBe(200);
  });
});
