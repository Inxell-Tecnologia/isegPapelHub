import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../app.js';
import { PgDatabasePort } from '../adapters/pg-database-port.js';
import { InAppNotificationPort } from '../adapters/in-app-notification-port.js';
import { EnvSecretsPort } from '../adapters/env-secrets-port.js';
import { Argon2AuthPort } from '../adapters/argon2-auth-port.js';
import { InMemoryStoragePort } from './in-memory-storage-port.js';
import {
  setupTestDatabase,
  seedTwoUnits,
  withSystemBypass,
  sessionCookieFor,
  controleDeTeste,
} from './test-db.js';
import type { Ports } from '../ports/index.js';
import { DocumentLifecycleState, DocumentStatus, DocumentType } from '@gdoc/shared';

/**
 * Épico 10 (change `controle-documental`): o domínio do documento controlado
 * — dados de controle, situação apurada na consulta, unicidade do código,
 * revisão na substituição e saída de circulação do obsoleto.
 *
 * Roda contra o Postgres real, como todo teste desta camada: a situação é
 * derivada **em SQL** pelo relógio do banco (design.md D2) e a unicidade do
 * código é garantida por **índice**, não pela aplicação (design.md D5) — nem
 * uma nem outra existiria num banco de mentira.
 */
describe('Épico 10: controle documental', () => {
  let pool: Pool;
  let ports: Ports;
  let ids: Awaited<ReturnType<typeof seedTwoUnits>>;
  let adminAId: string;
  let userA2Id: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    pool = setup.pool;
    ids = await seedTwoUnits(pool);

    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO users (unit_id, email, password_hash, role) VALUES
           ($1, 'admin-a-doc@test.dev', 'x', 'unit_admin'),
           ($1, 'collab-a2-doc@test.dev', 'x', 'collaborator')
         RETURNING id`,
        [ids.unitA],
      ),
    );
    adminAId = rows[0]!.id;
    userA2Id = rows[1]!.id;

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

  /**
   * Insere um documento já `active` com os dados de controle pedidos. A data
   * de próxima revisão entra como **deslocamento em dias sobre
   * `current_date`**, e não como literal: o que o teste afirma é a relação
   * entre a data e o relógio do banco, que é exatamente o que a derivação lê.
   */
  async function inserirDocumento(opts: {
    unitId?: string;
    ownerId?: string;
    folderId?: string | null;
    fileName?: string;
    code?: string | null;
    type?: DocumentType | null;
    revision?: number | null;
    sector?: string | null;
    diasAteRevisao?: number | null;
    lifecycle?: DocumentLifecycleState | null;
  }): Promise<string> {
    const unitId = opts.unitId ?? ids.unitA;
    const ownerId = opts.ownerId ?? ids.userA;
    const fileName = opts.fileName ?? `doc-${Math.random().toString(36).slice(2, 10)}.pdf`;
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO files (unit_id, owner_id, folder_id, object_path, file_name, content_type,
           size_bytes, status, document_type, document_code, document_revision, responsible_sector,
           next_review_at, lifecycle_state)
         VALUES ($1, $2, $3, $4, $5, 'application/pdf', 100, 'active', $6, $7, $8, $9,
           CASE WHEN $10::int IS NULL THEN NULL ELSE current_date + $10::int END, $11)
         RETURNING id`,
        [
          unitId,
          ownerId,
          opts.folderId ?? null,
          `${unitId}/${ownerId}/${fileName}-${Math.random().toString(36).slice(2, 8)}`,
          fileName,
          opts.type ?? null,
          opts.code ?? null,
          opts.revision ?? null,
          opts.sector ?? null,
          opts.diasAteRevisao ?? null,
          opts.lifecycle ?? null,
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
    subjectUserId = userA2Id,
    resourceType: 'file' | 'folder' = 'file',
  ) {
    const res = await request(createApp(ports))
      .post('/grants')
      .set('Cookie', await sessionCookieFor(ports, ids.globalAdmin))
      .send({ subjectUserIds: [subjectUserId], resourceType, resourceId, permissions });
    expect(res.status).toBe(201);
  }

  async function documentoNaListagem(userId: string, fileId: string) {
    const files = await listarRaiz(userId);
    return files.find((f) => f.id === fileId);
  }

  // --- US 10.4: situação apurada no momento da consulta --------------------

  describe('Situação é apurada no momento da consulta (US 10.4, design.md D2)', () => {
    it('deriva os seis desfechos a partir do estado declarado e da data', async () => {
      const vigente = await inserirDocumento({ diasAteRevisao: 120 });
      const aVencer = await inserirDocumento({ diasAteRevisao: 45 });
      const emRevisao = await inserirDocumento({
        diasAteRevisao: 300,
        lifecycle: DocumentLifecycleState.IN_REVIEW,
      });
      const vencido = await inserirDocumento({ diasAteRevisao: -1 });
      const semControle = await inserirDocumento({ diasAteRevisao: null });
      const obsoleto = await inserirDocumento({
        diasAteRevisao: 10,
        lifecycle: DocumentLifecycleState.OBSOLETE,
      });

      const porId = new Map((await listarRaiz(ids.userA)).map((f) => [f.id as string, f]));
      expect(porId.get(vigente)?.documentStatus).toBe(DocumentStatus.CURRENT);
      expect(porId.get(aVencer)?.documentStatus).toBe(DocumentStatus.DUE_SOON);
      // US 10.4 cenário 2: "indicando em quantos dias vence".
      expect(porId.get(aVencer)?.daysUntilReview).toBe(45);
      expect(porId.get(emRevisao)?.documentStatus).toBe(DocumentStatus.IN_REVIEW);
      expect(porId.get(vencido)?.documentStatus).toBe(DocumentStatus.OVERDUE);
      expect(porId.get(semControle)?.documentStatus).toBe(DocumentStatus.UNCONTROLLED);
      expect(porId.get(semControle)?.daysUntilReview).toBeNull();
      // O obsoleto não aparece para o colaborador (US 10.7) — quem o enxerga
      // é a gestão da unidade, e com a situação Obsoleto.
      expect(porId.has(obsoleto)).toBe(false);
      const visto = await documentoNaListagem(adminAId, obsoleto);
      expect(visto?.documentStatus).toBe(DocumentStatus.OBSOLETE);
    });

    it('a janela de "A vencer" fecha em 60 dias: 60 vence em breve, 61 ainda é vigente', async () => {
      const limite = await inserirDocumento({ diasAteRevisao: 60 });
      const fora = await inserirDocumento({ diasAteRevisao: 61 });

      const porId = new Map((await listarRaiz(ids.userA)).map((f) => [f.id as string, f]));
      expect(porId.get(limite)?.documentStatus).toBe(DocumentStatus.DUE_SOON);
      expect(porId.get(fora)?.documentStatus).toBe(DocumentStatus.CURRENT);
    });

    it('a virada de prazo não espera rotina nenhuma (US 10.4 cenário 6)', async () => {
      const fileId = await inserirDocumento({ diasAteRevisao: 1 });
      expect((await documentoNaListagem(ids.userA, fileId))?.documentStatus).toBe(
        DocumentStatus.DUE_SOON,
      );

      // Ultrapassar a data é observacionalmente idêntico a o relógio passar
      // por ela: a derivação compara `next_review_at` com `current_date`. A
      // única escrita entre as duas consultas é a da própria data — nenhuma
      // rotina programada roda neste teste, e nenhuma existe.
      await withSystemBypass(pool, (client) =>
        client.query('UPDATE files SET next_review_at = current_date - 1 WHERE id = $1', [fileId]),
      );

      expect((await documentoNaListagem(ids.userA, fileId))?.documentStatus).toBe(
        DocumentStatus.OVERDUE,
      );
    });

    it('a situação não é gravada em coluna alguma (design.md D2)', async () => {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'files'`,
        ),
      );
      const colunas = rows.map((r) => r.column_name);
      expect(colunas).toContain('lifecycle_state');
      expect(colunas).toContain('next_review_at');
      // Se alguém "otimizar" a derivação gravando a situação, é aqui que a
      // janela de mentira entre a virada da data e a rotina reaparece.
      expect(colunas).not.toContain('document_status');
      expect(colunas).not.toContain('situacao');
    });
  });

  // --- US 10.5: exigência no envio de um documento -------------------------

  describe('Dados de controle no envio (US 10.5)', () => {
    it('envio de um documento sem os dados é recusado nomeando o que falta, sem gravar nada', async () => {
      const app = createApp(ports);
      const antes = (await listarRaiz(ids.userA)).length;

      const res = await request(app)
        .post('/files/upload-url')
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({
          fileName: 'sem-controle.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: { documentType: DocumentType.POLICY },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('document_control_required');
      // Cinco campos exigidos desde a change
      // `arquivo-geral-e-pendente-de-cadastro` (design.md D5): o responsável
      // entrou por força da tabela 2.2 da demanda.
      expect(res.body.missing.sort()).toEqual([
        'documentCode',
        'documentRevision',
        'nextReviewAt',
        'responsibleSector',
      ]);
      expect((await listarRaiz(ids.userA)).length).toBe(antes);
    });

    it('tipo fora do conjunto previsto é recusado e nenhum dado de controle é gravado', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .post('/files/upload-url')
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({
          fileName: 'tipo-invalido.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: controleDeTeste({ documentType: 'ata-de-reuniao' as DocumentType }),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_document_type');
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM files WHERE file_name = $1', ['tipo-invalido.pdf']),
      );
      expect(rows).toHaveLength(0);
    });

    it('envio de um documento com os dados completos grava os cinco campos', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .post('/files/upload-url')
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({
          fileName: 'completo.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: {
            documentType: DocumentType.PROCEDURE,
            documentCode: 'POP-NSP-010',
            documentRevision: 3,
            responsibleSector: 'Núcleo de Segurança do Paciente',
            nextReviewAt: '2099-06-30',
          },
        });
      expect(res.status).toBe(200);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{
          document_type: string;
          document_code: string;
          document_revision: number;
          responsible_sector: string;
        }>(
          `SELECT document_type, document_code, document_revision, responsible_sector
           FROM files WHERE object_path = $1`,
          [res.body.objectPath],
        ),
      );
      expect(rows[0]).toEqual({
        document_type: DocumentType.PROCEDURE,
        document_code: 'POP-NSP-010',
        document_revision: 3,
        responsible_sector: 'Núcleo de Segurança do Paciente',
      });

      // E a leitura devolve os **cinco** dados, sem valor presumido
      // (requisito "Documento com dados completos devolve todos eles").
      const lido = (await listarRaiz(ids.userA)).find((f) => f.fileName === 'completo.pdf');
      expect(lido).toMatchObject({
        documentType: DocumentType.PROCEDURE,
        documentCode: 'POP-NSP-010',
        documentRevision: 3,
        responsibleSector: 'Núcleo de Segurança do Paciente',
        nextReviewAt: '2099-06-30',
        documentStatus: DocumentStatus.CURRENT,
      });
    });

    it('checklist é tipo próprio, aceito com os dados da Matriz (change tipo-checklist)', async () => {
      const app = createApp(ports);
      const res = await request(app)
        .post('/files/upload-url')
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({
          fileName: 'checklist.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          declaredSizeBytes: 10,
          documentControl: {
            documentType: DocumentType.CHECKLIST,
            documentCode: 'CHK-NSP-002',
            documentRevision: 1,
            responsibleSector: 'Núcleo de Segurança do Paciente',
            nextReviewAt: '2099-06-30',
          },
        });
      expect(res.status).toBe(200);

      const lido = (await listarRaiz(ids.userA)).find((f) => f.fileName === 'checklist.xlsx');
      expect(lido).toMatchObject({
        documentType: DocumentType.CHECKLIST,
        documentCode: 'CHK-NSP-002',
        documentStatus: DocumentStatus.CURRENT,
      });
    });

    // Este caso afirmava, até a change `arquivo-geral-e-pendente-de-cadastro`,
    // que o lote **dispensava** os dados e nascia "Sem controle de revisão".
    // A demanda do cliente (seção 2) classificou essa dispensa como defeito: é
    // o caminho de entrada mais rápido e também o único que não pedia nada. A
    // expectativa invertida é o objeto da change — o item sem dados continua
    // sendo **aceito** (não recusado), mas nasce fora de circulação, pendente
    // de cadastro, em vez de publicado sem rastreio.
    it('envio em lote sem dados é aceito e nasce pendente de cadastro', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, ids.userA);
      const res = await request(app)
        .post('/files/upload-urls')
        .set('Cookie', cookie)
        .send({
          items: [
            { fileName: 'lote-1.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
            { fileName: 'lote-2.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
            {
              fileName: 'na-subpasta.pdf',
              contentType: 'application/pdf',
              declaredSizeBytes: 10,
              relativePath: 'Procedimentos/2026',
            },
          ],
        });

      // Aceito, não recusado: é a distinção que permite exigir os dados sem
      // quebrar o lote (design.md D6).
      expect(res.status).toBe(200);
      expect(res.body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);
      // A resposta diz, por item, que ele nasceu pendente — sem isso quem
      // enviou precisaria consultar os arquivos um a um para descobrir.
      expect(
        res.body.results.every((r: { awaitingRegistration: boolean }) => r.awaitingRegistration),
      ).toBe(true);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{
          document_code: string | null;
          next_review_at: Date | null;
          awaiting_registration: boolean;
        }>(
          `SELECT document_code, next_review_at, awaiting_registration FROM files
           WHERE file_name IN ('lote-1.pdf', 'lote-2.pdf', 'na-subpasta.pdf')`,
        ),
      );
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.document_code === null && r.next_review_at === null)).toBe(true);
      expect(rows.every((r) => r.awaiting_registration)).toBe(true);

      // Para quem enviou, o arquivo aparece — é ele quem tem de completar os
      // dados. A invisibilidade para os demais é coberta em
      // `pendente-de-cadastro-acesso.test.ts`.
      const porNome = new Map((await listarRaiz(ids.userA)).map((f) => [f.fileName as string, f]));
      expect(porNome.get('lote-1.pdf')?.documentStatus).toBe(DocumentStatus.AWAITING_REGISTRATION);
      expect(porNome.get('lote-2.pdf')?.documentStatus).toBe(DocumentStatus.AWAITING_REGISTRATION);
    });

    it('acervo anterior ao controle documental permanece acessível, sem controle de revisão', async () => {
      // Linha sem nenhum dos campos novos — o retrato do que já estava lá
      // antes da migração, que não recebeu backfill por desenho.
      const fileId = await inserirDocumento({ diasAteRevisao: null, code: null, type: null });
      const visto = await documentoNaListagem(ids.userA, fileId);
      expect(visto?.documentStatus).toBe(DocumentStatus.UNCONTROLLED);
      expect(visto?.documentType).toBeNull();
      expect(visto?.documentRevision).toBeNull();

      const view = await request(createApp(ports))
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA));
      expect(view.status).toBe(200);
    });
  });

  // --- veredito de edição resolvido pelo servidor --------------------------

  describe('Veredito de edição vem do servidor (web-navegacao, mesmo padrão de canUpload)', () => {
    it('a listagem diz quem pode editar os dados de controle, sem a SPA inferir permissão', async () => {
      const fileId = await inserirDocumento({ diasAteRevisao: 90 });

      // Dono: pode. Colaborador sem concessão: não pode — e não é o cliente
      // que descobre isso, é o servidor que diz.
      expect((await documentoNaListagem(ids.userA, fileId))?.canEditControl).toBe(true);
      await conceder(fileId, ['view']);
      expect((await documentoNaListagem(userA2Id, fileId))?.canEditControl).toBe(false);

      // Concessão do verbo de substituir: passa a poder, sem round-trip extra.
      await conceder(fileId, ['rename']);
      expect((await documentoNaListagem(userA2Id, fileId))?.canEditControl).toBe(true);

      // Admin da unidade alcança por papel, não por concessão.
      expect((await documentoNaListagem(adminAId, fileId))?.canEditControl).toBe(true);
    });
  });

  // --- US 10.2: unicidade do código ---------------------------------------

  describe('Código do documento é único dentro da unidade (US 10.2)', () => {
    async function publicar(userId: string, fileName: string, code: string) {
      return request(createApp(ports))
        .post('/files/upload-url')
        .set('Cookie', await sessionCookieFor(ports, userId))
        .send({
          fileName,
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: controleDeTeste({ documentCode: code }),
        });
    }

    it('código já usado por documento ativo da mesma unidade é recusado, e nada é publicado', async () => {
      await inserirDocumento({ code: 'PRT-NSP-001', diasAteRevisao: 90 });

      const res = await publicar(ids.userA, 'duplicado.pdf', 'PRT-NSP-001');
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('document_code_in_use');
      expect(res.body.code).toBe('PRT-NSP-001');
      // A recusa de publicação não nomeia o ocupante: dizer qual documento
      // ocupa o código só é devido na restauração (design.md D5).
      expect(res.body.occupiedBy).toBeUndefined();

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query('SELECT 1 FROM files WHERE file_name = $1', ['duplicado.pdf']),
      );
      expect(rows).toHaveLength(0);
    });

    it('a unicidade é insensível a maiúsculas, como o índice', async () => {
      await inserirDocumento({ code: 'POL-GER-007', diasAteRevisao: 90 });
      const res = await publicar(ids.userA, 'caixa-baixa.pdf', 'pol-ger-007');
      expect(res.status).toBe(409);
    });

    it('o mesmo código em outra unidade é aceito, sem revelar nada do homônimo', async () => {
      await inserirDocumento({
        unitId: ids.unitB,
        ownerId: ids.userB,
        code: 'MAN-OPS-100',
        fileName: 'manual-da-unidade-b.pdf',
        diasAteRevisao: 90,
      });

      const res = await publicar(ids.userA, 'manual-da-unidade-a.pdf', 'MAN-OPS-100');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('manual-da-unidade-b');
    });

    it('duas publicações simultâneas do mesmo código: só uma passa (garantia do índice)', async () => {
      const [primeira, segunda] = await Promise.all([
        publicar(ids.userA, 'corrida-1.pdf', 'FLX-RACE-001'),
        publicar(userA2Id, 'corrida-2.pdf', 'FLX-RACE-001'),
      ]);

      const status = [primeira.status, segunda.status].sort();
      expect(status).toEqual([200, 409]);
      const perdedora = primeira.status === 409 ? primeira : segunda;
      expect(perdedora.body.error).toBe('document_code_in_use');

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query(
          `SELECT 1 FROM files WHERE lower(document_code) = 'flx-race-001' AND deleted_at IS NULL`,
        ),
      );
      expect(rows).toHaveLength(1);
    });

    it('código de documento excluído é liberado para reuso', async () => {
      const original = await inserirDocumento({ code: 'TCO-LGPD-001', diasAteRevisao: 90 });
      const del = await request(createApp(ports))
        .delete(`/files/${original}`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA));
      expect(del.status).toBe(204);

      const res = await publicar(ids.userA, 'novo-termo.pdf', 'TCO-LGPD-001');
      expect(res.status).toBe(200);
    });

    it('republicar o mesmo código com o envio anterior ainda pendente retoma a publicação', async () => {
      // Sem a retomada, um envio que falhou na transferência deixaria o
      // código preso à própria linha `pending` e a pessoa não conseguiria
      // publicar o seu documento de novo.
      const primeira = await publicar(ids.userA, 'retomado.pdf', 'COM-INT-055');
      expect(primeira.status).toBe(200);

      const segunda = await publicar(ids.userA, 'retomado.pdf', 'COM-INT-055');
      expect(segunda.status).toBe(200);
      expect(segunda.body.objectPath).not.toBe(primeira.body.objectPath);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query(
          `SELECT 1 FROM files WHERE lower(document_code) = 'com-int-055' AND deleted_at IS NULL`,
        ),
      );
      expect(rows).toHaveLength(1);
    });
  });

  // --- US 10.5: edição posterior ------------------------------------------

  describe('Dados de controle preenchidos ou corrigidos depois (US 10.5)', () => {
    it('quem pode substituir informa os dados depois, e a situação é reapurada sem reenvio', async () => {
      const fileId = await inserirDocumento({ diasAteRevisao: null });
      const res = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({
          documentType: DocumentType.FORM,
          documentCode: 'FRM-ADM-020',
          documentRevision: 1,
          responsibleSector: 'Administrativo',
          nextReviewAt: '2099-01-10',
        });

      expect(res.status).toBe(200);
      expect(res.body.documentCode).toBe('FRM-ADM-020');
      expect(res.body.documentStatus).toBe(DocumentStatus.CURRENT);
      // Nenhuma URL de envio é emitida: a edição não move bytes.
      expect(res.body.uploadUrl).toBeUndefined();
    });

    it('sem a permissão de substituir, os dados permanecem como estavam', async () => {
      const fileId = await inserirDocumento({ code: 'PRT-INTACTO-1', diasAteRevisao: 90 });
      const res = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', await sessionCookieFor(ports, userA2Id))
        .send({ documentCode: 'PRT-INVADIDO' });

      expect(res.status).toBe(403);
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ document_code: string }>('SELECT document_code FROM files WHERE id = $1', [
          fileId,
        ]),
      );
      expect(rows[0]?.document_code).toBe('PRT-INTACTO-1');
    });

    it('grant de substituir (verbo rename) habilita a edição dos dados', async () => {
      const fileId = await inserirDocumento({ diasAteRevisao: 90 });
      await conceder(fileId, ['rename']);
      const res = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', await sessionCookieFor(ports, userA2Id))
        .send({ responsibleSector: 'Qualidade' });
      expect(res.status).toBe(200);
      expect(res.body.responsibleSector).toBe('Qualidade');
    });

    it('alterar os dados de controle não avança a revisão', async () => {
      const fileId = await inserirDocumento({ revision: 4, diasAteRevisao: 90 });
      const res = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({ responsibleSector: 'Enfermagem' });

      expect(res.status).toBe(200);
      expect(res.body.documentRevision).toBe(4);
    });

    it('campo ausente não é tocado; campo enviado como nulo é limpo', async () => {
      const fileId = await inserirDocumento({
        type: DocumentType.MANUAL,
        code: 'MAN-PARCIAL-1',
        revision: 2,
        sector: 'Ensino',
        diasAteRevisao: 90,
      });
      const cookie = await sessionCookieFor(ports, ids.userA);

      const semMexer = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', cookie)
        .send({ documentRevision: 3 });
      expect(semMexer.status).toBe(200);
      expect(semMexer.body.responsibleSector).toBe('Ensino');
      expect(semMexer.body.documentCode).toBe('MAN-PARCIAL-1');

      const limpando = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', cookie)
        .send({ responsibleSector: null, nextReviewAt: null });
      expect(limpando.status).toBe(200);
      expect(limpando.body.responsibleSector).toBeNull();
      expect(limpando.body.documentStatus).toBe(DocumentStatus.UNCONTROLLED);
    });

    it('editar para um código já em uso é recusado de forma específica', async () => {
      await inserirDocumento({ code: 'POL-OCUPADO-1', diasAteRevisao: 90 });
      const fileId = await inserirDocumento({ code: 'POL-LIVRE-1', diasAteRevisao: 90 });

      const res = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({ documentCode: 'POL-OCUPADO-1' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('document_code_in_use');
    });

    it('corpo sem campo algum é recusado como requisição inválida', async () => {
      const fileId = await inserirDocumento({ diasAteRevisao: 90 });
      const res = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({});
      expect(res.status).toBe(400);
    });

    it('data de calendário inexistente é recusada', async () => {
      const fileId = await inserirDocumento({ diasAteRevisao: 90 });
      const res = await request(createApp(ports))
        .patch(`/files/${fileId}/document-control`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({ nextReviewAt: '2026-02-31' });
      expect(res.status).toBe(400);
    });
  });

  // --- US 10.6: revisão na substituição -----------------------------------

  describe('Substituir o arquivo avança a revisão (US 10.6)', () => {
    async function substituirEFinalizar(fileId: string, userId: string) {
      const app = createApp(ports);
      const replace = await request(app)
        .post(`/files/${fileId}/replace-url`)
        .set('Cookie', await sessionCookieFor(ports, userId))
        .send({ contentType: 'application/pdf', declaredSizeBytes: 150 });
      expect(replace.status).toBe(200);

      // A revisão avança com a promoção do ponteiro, no finalize — não na
      // emissão da URL (design.md D8).
      const finalize = await request(app)
        .post('/internal/storage-events')
        .send({ objectPath: replace.body.objectPath, sizeBytes: 150 });
      expect(finalize.status).toBe(200);
      return replace.body.objectPath as string;
    }

    it('documento na revisão 1 passa à 2, preservando código, tipo, responsável e data', async () => {
      const fileId = await inserirDocumento({
        type: DocumentType.PROCEDURE,
        code: 'POP-REV-001',
        revision: 1,
        sector: 'Farmácia',
        diasAteRevisao: 200,
      });
      const { rows: antes } = await withSystemBypass(pool, (client) =>
        client.query<{ object_path: string; next_review_at: Date }>(
          'SELECT object_path, next_review_at FROM files WHERE id = $1',
          [fileId],
        ),
      );

      const novoObjeto = await substituirEFinalizar(fileId, ids.userA);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{
          document_revision: number;
          document_code: string;
          document_type: string;
          responsible_sector: string;
          next_review_at: Date;
          object_path: string;
        }>(
          `SELECT document_revision, document_code, document_type, responsible_sector,
             next_review_at, object_path FROM files WHERE id = $1`,
          [fileId],
        ),
      );
      expect(rows[0]?.document_revision).toBe(2);
      expect(rows[0]?.document_code).toBe('POP-REV-001');
      expect(rows[0]?.document_type).toBe(DocumentType.PROCEDURE);
      expect(rows[0]?.responsible_sector).toBe('Farmácia');
      expect(rows[0]?.next_review_at).toEqual(antes[0]!.next_review_at);
      // A versão anterior deixa de ser o ponteiro vivo: não há histórico.
      expect(rows[0]?.object_path).toBe(novoObjeto);
      expect(rows[0]?.object_path).not.toBe(antes[0]!.object_path);
    });

    it('documento sem revisão registrada continua sem revisão — substituir não inaugura numeração', async () => {
      const fileId = await inserirDocumento({ revision: null, diasAteRevisao: null });
      await substituirEFinalizar(fileId, ids.userA);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ document_revision: number | null }>(
          'SELECT document_revision FROM files WHERE id = $1',
          [fileId],
        ),
      );
      expect(rows[0]?.document_revision).toBeNull();
    });

    it('sem permissão de substituir, a revisão permanece como estava', async () => {
      const fileId = await inserirDocumento({ revision: 7, diasAteRevisao: 90 });
      const res = await request(createApp(ports))
        .post(`/files/${fileId}/replace-url`)
        .set('Cookie', await sessionCookieFor(ports, userA2Id))
        .send({ contentType: 'application/pdf', declaredSizeBytes: 10 });
      expect(res.status).toBe(403);

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ document_revision: number }>(
          'SELECT document_revision FROM files WHERE id = $1',
          [fileId],
        ),
      );
      expect(rows[0]?.document_revision).toBe(7);
    });
  });

  // --- US 10.7: obsoleto sai de circulação --------------------------------

  describe('Documento obsoleto sai de circulação (US 10.7, design.md D6)', () => {
    it('colaborador com permissão não o alcança por listagem, por busca nem por identificador', async () => {
      const fileId = await inserirDocumento({
        fileName: 'procedimento-substituido.pdf',
        code: 'POP-OBS-001',
        diasAteRevisao: 90,
        lifecycle: DocumentLifecycleState.OBSOLETE,
      });
      await conceder(fileId, ['view', 'download']);
      const cookie = await sessionCookieFor(ports, userA2Id);
      const app = createApp(ports);

      expect(await documentoNaListagem(userA2Id, fileId)).toBeUndefined();
      expect(await buscar(userA2Id, 'procedimento-substituido')).toHaveLength(0);
      expect(await buscar(userA2Id, 'POP-OBS-001')).toHaveLength(0);

      const view = await request(app).post(`/files/${fileId}/view-url`).set('Cookie', cookie);
      const download = await request(app)
        .post(`/files/${fileId}/download-url`)
        .set('Cookie', cookie);
      // Indistinguível de recurso inexistente: o mesmo 403 sem corpo
      // informativo que um identificador inventado recebe.
      const inexistente = await request(app)
        .post('/files/11111111-1111-1111-1111-111111111111/view-url')
        .set('Cookie', cookie);
      expect(view.status).toBe(403);
      expect(download.status).toBe(403);
      expect(view.body).toEqual(inexistente.body);
      expect(view.status).toBe(inexistente.status);
    });

    it('nem o próprio dono, que não é gestão, segue alcançando o obsoleto', async () => {
      const fileId = await inserirDocumento({
        diasAteRevisao: 90,
        lifecycle: DocumentLifecycleState.OBSOLETE,
      });
      expect(await documentoNaListagem(ids.userA, fileId)).toBeUndefined();
      const view = await request(createApp(ports))
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', await sessionCookieFor(ports, ids.userA));
      expect(view.status).toBe(403);
    });

    it('administrador da unidade continua enxergando o obsoleto, identificado como tal', async () => {
      const fileId = await inserirDocumento({
        diasAteRevisao: 90,
        lifecycle: DocumentLifecycleState.OBSOLETE,
      });
      const visto = await documentoNaListagem(adminAId, fileId);
      expect(visto?.documentStatus).toBe(DocumentStatus.OBSOLETE);

      const view = await request(createApp(ports))
        .post(`/files/${fileId}/view-url`)
        .set('Cookie', await sessionCookieFor(ports, adminAId));
      expect(view.status).toBe(200);
    });

    it('a regra do obsoleto não amplia o alcance de administrador sobre outra unidade', async () => {
      const naUnidadeB = await inserirDocumento({
        unitId: ids.unitB,
        ownerId: ids.userB,
        fileName: 'obsoleto-da-unidade-b.pdf',
        code: 'PRT-UB-001',
        diasAteRevisao: 90,
        lifecycle: DocumentLifecycleState.OBSOLETE,
      });

      for (const userId of [adminAId, ids.globalAdmin]) {
        expect(await documentoNaListagem(userId, naUnidadeB)).toBeUndefined();
        expect(await buscar(userId, 'obsoleto-da-unidade-b')).toHaveLength(0);
        expect(await buscar(userId, 'PRT-UB-001')).toHaveLength(0);
        const view = await request(createApp(ports))
          .post(`/files/${naUnidadeB}/view-url`)
          .set('Cookie', await sessionCookieFor(ports, userId));
        expect(view.status).toBe(403);
      }
    });

    it('o obsoleto também não entra no pacote de download de pasta de quem não é gestão', async () => {
      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'Pasta com obsoleto') RETURNING id`,
          [ids.unitA, ids.userA],
        ),
      );
      const folderId = rows[0]!.id;
      const vivo = await inserirDocumento({ folderId, diasAteRevisao: 90 });
      await inserirDocumento({
        folderId,
        diasAteRevisao: 90,
        lifecycle: DocumentLifecycleState.OBSOLETE,
      });
      await conceder(folderId, ['view', 'download'], userA2Id, 'folder');
      await conceder(vivo, ['view', 'download']);

      const res = await request(createApp(ports))
        .post(`/folders/${folderId}/download-manifest`)
        .set('Cookie', await sessionCookieFor(ports, userA2Id));
      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.totalFiles).toBe(1);
    });
  });

  // --- design.md D5: restauração e código reusado --------------------------

  describe('Restauração que recriaria código duplicado é recusada (design.md D5)', () => {
    it('a recusa nomeia o documento que ocupa o código, e nenhum dos dois é alterado', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, ids.userA);
      const original = await inserirDocumento({
        fileName: 'original.pdf',
        code: 'PRT-REUSO-001',
        diasAteRevisao: 90,
      });
      expect((await request(app).delete(`/files/${original}`).set('Cookie', cookie)).status).toBe(
        204,
      );

      const ocupante = await inserirDocumento({
        fileName: 'ocupante.pdf',
        code: 'PRT-REUSO-001',
        diasAteRevisao: 90,
      });

      const restore = await request(app).post(`/files/${original}/restore`).set('Cookie', cookie);
      expect(restore.status).toBe(409);
      expect(restore.body.error).toBe('document_code_in_use');
      expect(restore.body.code).toBe('PRT-REUSO-001');
      expect(restore.body.occupiedBy).toEqual({ id: ocupante, fileName: 'ocupante.pdf' });

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string; deleted_at: Date | null }>(
          'SELECT id, deleted_at FROM files WHERE id = ANY($1::uuid[]) ORDER BY file_name',
          [[original, ocupante]],
        ),
      );
      // `ocupante.pdf` vem antes de `original.pdf` na ordem por nome.
      expect(rows[0]?.deleted_at).toBeNull();
      expect(rows[1]?.deleted_at).not.toBeNull();
    });

    it('restaurar a pasta é recusado quando um documento da subárvore teve o código reusado', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, ids.userA);
      const { rows: pasta } = await withSystemBypass(pool, (client) =>
        client.query<{ id: string }>(
          `INSERT INTO folders (unit_id, owner_id, name) VALUES ($1, $2, 'Pasta restaurável') RETURNING id`,
          [ids.unitA, ids.userA],
        ),
      );
      const folderId = pasta[0]!.id;
      await inserirDocumento({
        folderId,
        fileName: 'dentro.pdf',
        code: 'FRM-REUSO-002',
        diasAteRevisao: 90,
      });

      expect((await request(app).delete(`/folders/${folderId}`).set('Cookie', cookie)).status).toBe(
        204,
      );
      await inserirDocumento({
        fileName: 'tomou-o-codigo.pdf',
        code: 'FRM-REUSO-002',
        diasAteRevisao: 90,
      });

      const restore = await request(app).post(`/folders/${folderId}/restore`).set('Cookie', cookie);
      expect(restore.status).toBe(409);
      expect(restore.body.error).toBe('document_code_in_use');
      expect(restore.body.occupiedBy.fileName).toBe('tomou-o-codigo.pdf');

      const { rows } = await withSystemBypass(pool, (client) =>
        client.query<{ deleted_at: Date | null }>('SELECT deleted_at FROM folders WHERE id = $1', [
          folderId,
        ]),
      );
      expect(rows[0]?.deleted_at).not.toBeNull();
    });

    it('restaurar documento cujo código continua livre funciona normalmente', async () => {
      const app = createApp(ports);
      const cookie = await sessionCookieFor(ports, ids.userA);
      const fileId = await inserirDocumento({ code: 'PRT-LIVRE-002', diasAteRevisao: 90 });
      expect((await request(app).delete(`/files/${fileId}`).set('Cookie', cookie)).status).toBe(
        204,
      );

      const restore = await request(app).post(`/files/${fileId}/restore`).set('Cookie', cookie);
      expect(restore.status).toBe(200);
      expect(restore.body.documentCode).toBe('PRT-LIVRE-002');
    });
  });

  // --- tasks.md 10.1: o fluxo completo, numa unidade de teste -------------

  describe('Fluxo completo do Épico 10 numa unidade', () => {
    it('publicar com dados, enviar lote sem dados, editar, substituir, declarar obsoleto e sumir para o colaborador', async () => {
      const app = createApp(ports);
      const dono = await sessionCookieFor(ports, ids.userA);
      const colaborador = await sessionCookieFor(ports, userA2Id);
      const gestao = await sessionCookieFor(ports, adminAId);

      // 1. Publicar um documento, com os quatro dados exigidos.
      const publicacao = await request(app)
        .post('/files/upload-url')
        .set('Cookie', dono)
        .send({
          fileName: 'fluxo-protocolo.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 100,
          documentControl: {
            documentType: DocumentType.PROTOCOL,
            documentCode: 'PRT-FLUXO-001',
            documentRevision: 1,
            responsibleSector: 'Qualidade',
            nextReviewAt: '2099-12-31',
          },
        });
      expect(publicacao.status).toBe(200);
      const finalize = await request(app)
        .post('/internal/storage-events')
        .send({ objectPath: publicacao.body.objectPath, sizeBytes: 100 });
      expect(finalize.status).toBe(200);

      const porNome = async (userId: string) =>
        new Map((await listarRaiz(userId)).map((f) => [f.fileName as string, f]));

      let listagem = await porNome(ids.userA);
      expect(listagem.get('fluxo-protocolo.pdf')?.documentStatus).toBe(DocumentStatus.CURRENT);
      expect(listagem.get('fluxo-protocolo.pdf')?.documentRevision).toBe(1);

      // 2. Enviar um lote **sem** dados: aceito, e nasce pendente de cadastro
      // (US 10.9) — fora de circulação até ser completado, em lugar de
      // publicado sem rastreio.
      const lote = await request(app)
        .post('/files/upload-urls')
        .set('Cookie', dono)
        .send({
          items: [
            { fileName: 'fluxo-lote-1.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
            { fileName: 'fluxo-lote-2.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
          ],
        });
      expect(lote.status).toBe(200);
      listagem = await porNome(ids.userA);
      const doLote = listagem.get('fluxo-lote-1.pdf')!;
      expect(doLote.documentStatus).toBe(DocumentStatus.AWAITING_REGISTRATION);

      // 3. Editar os dados do que veio no lote — sem reenviar conteúdo. Como a
      // edição completa os cinco campos exigidos, ela também **publica** o
      // arquivo: a pendência de cadastro se encerra na mesma operação
      // (design.md D10).
      // 3a. Preenchimento **parcial** (sem o responsável): grava o que veio e
      // mantém a pendência — não é erro, é o estado correto de um cadastro
      // incompleto.
      const parcial = await request(app)
        .patch(`/files/${doLote.id}/document-control`)
        .set('Cookie', dono)
        .send({
          documentType: DocumentType.FORM,
          documentCode: 'FRM-FLUXO-002',
          documentRevision: 1,
          nextReviewAt: '2099-01-01',
        });
      expect(parcial.status).toBe(200);
      expect(parcial.body.documentCode).toBe('FRM-FLUXO-002');
      expect(parcial.body.documentStatus).toBe(DocumentStatus.AWAITING_REGISTRATION);

      // 3b. Informar **só** o campo que faltava publica o arquivo, sem
      // reinformar os quatro que já constavam: a avaliação é sobre a linha
      // resultante, não sobre a requisição (design.md D10).
      const edicao = await request(app)
        .patch(`/files/${doLote.id}/document-control`)
        .set('Cookie', dono)
        .send({ responsibleSector: 'Qualidade' });
      expect(edicao.status).toBe(200);
      expect(edicao.body.documentStatus).toBe(DocumentStatus.CURRENT);
      expect(edicao.body.documentCode).toBe('FRM-FLUXO-002');

      // 4. Substituir o documento publicado: a revisão avança no finalize.
      const docId = listagem.get('fluxo-protocolo.pdf')!.id as string;
      const replace = await request(app)
        .post(`/files/${docId}/replace-url`)
        .set('Cookie', dono)
        .send({ contentType: 'application/pdf', declaredSizeBytes: 120 });
      expect(replace.status).toBe(200);
      expect(
        (
          await request(app)
            .post('/internal/storage-events')
            .send({ objectPath: replace.body.objectPath, sizeBytes: 120 })
        ).status,
      ).toBe(200);

      listagem = await porNome(ids.userA);
      expect(listagem.get('fluxo-protocolo.pdf')?.documentRevision).toBe(2);
      expect(listagem.get('fluxo-protocolo.pdf')?.documentCode).toBe('PRT-FLUXO-001');

      // 5. Colaborador com permissão alcança o documento...
      await conceder(docId, ['view']);
      expect((await porNome(userA2Id)).has('fluxo-protocolo.pdf')).toBe(true);

      // 6. ...e deixa de alcançá-lo quando a gestão o declara obsoleto.
      const obsoleto = await request(app)
        .patch(`/files/${docId}/document-control`)
        .set('Cookie', gestao)
        .send({ lifecycleState: DocumentLifecycleState.OBSOLETE });
      expect(obsoleto.status).toBe(200);
      expect(obsoleto.body.documentStatus).toBe(DocumentStatus.OBSOLETE);

      expect((await porNome(userA2Id)).has('fluxo-protocolo.pdf')).toBe(false);
      expect(await buscar(userA2Id, 'PRT-FLUXO-001')).toHaveLength(0);
      expect(
        (await request(app).post(`/files/${docId}/view-url`).set('Cookie', colaborador)).status,
      ).toBe(403);

      // A gestão continua enxergando, identificado como obsoleto.
      expect((await porNome(adminAId)).get('fluxo-protocolo.pdf')?.documentStatus).toBe(
        DocumentStatus.OBSOLETE,
      );
    });
  });

  // --- US 10.2 cenário 1: busca pelo código -------------------------------

  describe('Busca alcança o código do documento (US 10.2 cenário 1)', () => {
    it('encontra pelo código, sem distinção de maiúsculas, e sem perder a busca por nome', async () => {
      const fileId = await inserirDocumento({
        fileName: 'protocolo-de-higiene.pdf',
        code: 'PRT-HIG-042',
        diasAteRevisao: 90,
      });

      expect((await buscar(ids.userA, 'PRT-HIG-042')).map((f) => f.id)).toContain(fileId);
      expect((await buscar(ids.userA, 'prt-hig-042')).map((f) => f.id)).toContain(fileId);
      expect((await buscar(ids.userA, 'HIG-042')).map((f) => f.id)).toContain(fileId);
      expect((await buscar(ids.userA, 'protocolo-de-higiene')).map((f) => f.id)).toContain(fileId);
    });

    it('a busca por código respeita a permissão e não revela a existência do documento', async () => {
      const fileId = await inserirDocumento({
        fileName: 'restrito.pdf',
        code: 'POL-RESTR-001',
        diasAteRevisao: 90,
      });
      expect(await buscar(userA2Id, 'POL-RESTR-001')).toHaveLength(0);

      await conceder(fileId, ['view']);
      expect((await buscar(userA2Id, 'POL-RESTR-001')).map((f) => f.id)).toContain(fileId);
    });

    it('a busca por código não atravessa unidades, qualquer que seja o papel', async () => {
      await inserirDocumento({
        unitId: ids.unitB,
        ownerId: ids.userB,
        fileName: 'so-da-b.pdf',
        code: 'MAN-SOB-999',
        diasAteRevisao: 90,
      });

      for (const userId of [ids.userA, adminAId, ids.globalAdmin]) {
        expect(await buscar(userId, 'MAN-SOB-999')).toHaveLength(0);
      }
    });
  });
});
