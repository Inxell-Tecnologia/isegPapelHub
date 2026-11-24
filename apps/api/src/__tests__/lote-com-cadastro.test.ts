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
import { DocumentStatus, DocumentType, NotificationKind } from '@gdoc/shared';

/**
 * US 10.5 e US 10.9 (change `arquivo-geral-e-pendente-de-cadastro`): a
 * exigência dos dados de controle passa a valer **por item** no envio em lote,
 * e o item incompleto é aceito como pendente de cadastro em vez de publicado
 * sem rastreio.
 *
 * O ponto central, e o que distingue esta change da dispensa que ela substitui
 * (design.md D6): dado **ausente** não recusa — produz pendência; dado
 * **inválido** recusa, e só o seu item. É essa assimetria que permite exigir os
 * dados sem quebrar nem a falha independente do lote nem a repetição de um item
 * cuja transferência falhou.
 */
describe('Envio em lote com cadastro por arquivo (US 10.5, US 10.9)', () => {
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

  let sequencia = 0;
  /** Dados completos para um item de lote; código distinto a cada chamada. */
  function completo(overrides: Record<string, unknown> = {}) {
    sequencia += 1;
    return {
      documentType: DocumentType.PROTOCOL,
      documentCode: `LOTE-${sequencia}`,
      documentRevision: 1,
      responsibleSector: 'Governança',
      nextReviewAt: '2099-12-31',
      ...overrides,
    };
  }

  async function enviarLote(items: unknown[], userId = ids.userA) {
    return request(createApp(ports))
      .post('/files/upload-urls')
      .set('Cookie', await sessionCookieFor(ports, userId))
      .send({ items });
  }

  async function linhaPorNome(fileName: string) {
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query<{
        id: string;
        document_code: string | null;
        document_type: string | null;
        responsible_sector: string | null;
        awaiting_registration: boolean;
      }>(
        `SELECT id, document_code, document_type, responsible_sector, awaiting_registration
         FROM files WHERE file_name = $1 AND deleted_at IS NULL`,
        [fileName],
      ),
    );
    return rows[0];
  }

  async function listarRaiz(userId: string) {
    const res = await request(createApp(ports))
      .get('/folders/root/contents')
      .set('Cookie', await sessionCookieFor(ports, userId));
    expect(res.status).toBe(200);
    return new Map(
      (res.body.files as Record<string, unknown>[]).map((f) => [f.fileName as string, f]),
    );
  }

  it('lote misto publica os completos e deixa os incompletos pendentes', async () => {
    const res = await enviarLote([
      {
        fileName: 'misto-completo.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo(),
      },
      { fileName: 'misto-vazio.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
    ]);

    expect(res.status).toBe(200);
    const porNome = new Map(
      (res.body.results as { fileName: string; ok: boolean; awaitingRegistration?: boolean }[]).map(
        (r) => [r.fileName, r],
      ),
    );
    // Os dois são aceitos — a exigência não virou recusa.
    expect(porNome.get('misto-completo.pdf')?.ok).toBe(true);
    expect(porNome.get('misto-vazio.pdf')?.ok).toBe(true);
    expect(porNome.get('misto-completo.pdf')?.awaitingRegistration).toBe(false);
    expect(porNome.get('misto-vazio.pdf')?.awaitingRegistration).toBe(true);

    expect((await linhaPorNome('misto-completo.pdf'))?.awaiting_registration).toBe(false);
    expect((await linhaPorNome('misto-vazio.pdf'))?.awaiting_registration).toBe(true);
  });

  it('cada item recebe os seus próprios dados, sem que os de um alcancem outro', async () => {
    const res = await enviarLote([
      {
        fileName: 'proprio-a.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ documentCode: 'PRT-A-900', responsibleSector: 'Setor A' }),
      },
      {
        fileName: 'proprio-b.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ documentCode: 'PRT-B-900', responsibleSector: 'Setor B' }),
      },
    ]);
    expect(res.status).toBe(200);

    const a = await linhaPorNome('proprio-a.pdf');
    const b = await linhaPorNome('proprio-b.pdf');
    expect(a?.document_code).toBe('PRT-A-900');
    expect(a?.responsible_sector).toBe('Setor A');
    expect(b?.document_code).toBe('PRT-B-900');
    expect(b?.responsible_sector).toBe('Setor B');
  });

  it('item com dado inválido é recusado sem virar pendência, e só ele', async () => {
    const res = await enviarLote([
      {
        fileName: 'invalido-tipo.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ documentType: 'tipo-que-nao-existe' }),
      },
      {
        fileName: 'invalido-data.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ nextReviewAt: '2026-02-31' }),
      },
      {
        fileName: 'valido-ao-lado.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo(),
      },
    ]);
    expect(res.status).toBe(200);

    const porNome = new Map(
      (res.body.results as { fileName: string; ok: boolean; error?: string }[]).map((r) => [
        r.fileName,
        r,
      ]),
    );
    expect(porNome.get('invalido-tipo.pdf')?.ok).toBe(false);
    expect(porNome.get('invalido-data.pdf')?.ok).toBe(false);
    // Falha independente preservada (`envio-lote`): o válido ao lado passa.
    expect(porNome.get('valido-ao-lado.pdf')?.ok).toBe(true);

    // Recusado é recusado: nada gravado, nem como pendente.
    expect(await linhaPorNome('invalido-tipo.pdf')).toBeUndefined();
    expect(await linhaPorNome('invalido-data.pdf')).toBeUndefined();
  });

  it('dois itens do mesmo lote com o mesmo código: o segundo é recusado, o lote sobrevive', async () => {
    // Sem a guarda intra-lote, nenhum dos dois existiria no banco na hora da
    // checagem individual, os dois passariam, e a colisão no índice único
    // abortaria a transação — derrubando o lote inteiro, inclusive o terceiro
    // item, contra "falha parcial não derruba o lote".
    const res = await enviarLote([
      {
        fileName: 'dup-1.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ documentCode: 'PRT-DUP-001' }),
      },
      {
        fileName: 'dup-2.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ documentCode: 'PRT-DUP-001' }),
      },
      {
        fileName: 'dup-vizinho.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo(),
      },
    ]);
    expect(res.status).toBe(200);

    const porNome = new Map(
      (res.body.results as { fileName: string; ok: boolean; error?: string }[]).map((r) => [
        r.fileName,
        r,
      ]),
    );
    expect(porNome.get('dup-1.pdf')?.ok).toBe(true);
    expect(porNome.get('dup-2.pdf')?.ok).toBe(false);
    expect(porNome.get('dup-2.pdf')?.error).toBe('document_code_conflict');
    expect(porNome.get('dup-vizinho.pdf')?.ok).toBe(true);

    expect(await linhaPorNome('dup-1.pdf')).toBeDefined();
    expect(await linhaPorNome('dup-2.pdf')).toBeUndefined();
  });

  it('código já publicado na unidade recusa o item do lote', async () => {
    const primeiro = await enviarLote([
      {
        fileName: 'ocupa-codigo.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ documentCode: 'PRT-OCUP-001' }),
      },
    ]);
    expect(primeiro.status).toBe(200);
    // Promove a linha a `active`: `pending` seria lido como retomada.
    await withSystemBypass(pool, (client) =>
      client.query(`UPDATE files SET status = 'active' WHERE file_name = 'ocupa-codigo.pdf'`),
    );

    const segundo = await enviarLote([
      {
        fileName: 'tenta-mesmo-codigo.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo({ documentCode: 'PRT-OCUP-001' }),
      },
    ]);
    expect(segundo.status).toBe(200);
    expect(segundo.body.results[0].ok).toBe(false);
    expect(segundo.body.results[0].error).toBe('document_code_conflict');
  });

  it('repetir item que falhou é aceito, com e sem dados', async () => {
    // Sem dados: nunca barrado por falta deles — era o motivo da decisão D9
    // que esta change supera.
    const semDados = await enviarLote([
      { fileName: 'repete-sem.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
    ]);
    expect(semDados.body.results[0].ok).toBe(true);
    const outraVez = await enviarLote([
      { fileName: 'repete-sem.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
    ]);
    expect(outraVez.body.results[0].ok).toBe(true);
    expect(outraVez.body.results[0].awaitingRegistration).toBe(true);

    // Com código: a linha `pending` anterior do próprio solicitante é retomada,
    // não duplicata — senão repetir um item de lote que falhou na transferência
    // colidiria com a sua própria linha.
    const comCodigo = {
      fileName: 'repete-com.pdf',
      contentType: 'application/pdf',
      declaredSizeBytes: 10,
      documentControl: completo({ documentCode: 'PRT-RETOM-001' }),
    };
    expect((await enviarLote([comCodigo])).body.results[0].ok).toBe(true);
    const retomada = await enviarLote([comCodigo]);
    expect(retomada.body.results[0].ok).toBe(true);

    // Uma linha só: a retomada reaproveita o código em vez de duplicá-lo.
    const { rows } = await withSystemBypass(pool, (client) =>
      client.query(
        `SELECT id FROM files WHERE document_code = 'PRT-RETOM-001' AND deleted_at IS NULL`,
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('a retomada preserva o identificador do arquivo', async () => {
    // A linha é reaproveitada, não substituída. Trocar o identificador levaria
    // embora as concessões que apontam para o id antigo, o histórico de
    // auditoria e a identidade do evento de origem do aviso de pendência —
    // que passaria a avisar duas vezes do mesmo arquivo.
    const item = {
      fileName: 'retoma-identidade.pdf',
      contentType: 'application/pdf',
      declaredSizeBytes: 10,
      documentControl: completo({ documentCode: 'PRT-IDENT-001' }),
    };
    expect((await enviarLote([item])).body.results[0].ok).toBe(true);
    const antes = await linhaPorNome('retoma-identidade.pdf');

    expect((await enviarLote([item])).body.results[0].ok).toBe(true);
    const depois = await linhaPorNome('retoma-identidade.pdf');

    expect(depois?.id).toBe(antes?.id);
  });

  /**
   * Cenários do requisito que o change `tabela-de-cadastro-no-envio-em-lote`
   * escreveu em `envio-lote` — comportamento implementado na B1 e até então
   * não especificado. A pré-checagem da tabela de cadastro espelha esta regra,
   * e é por isso que ela precisa estar travada por teste.
   */
  describe('Unicidade do código no lote, nas três origens (envio-lote)', () => {
    it('diferença só de caixa é a mesma colisão dentro do lote', async () => {
      // A unicidade no banco é por `lower(...)`: aceitar o par aqui faria a
      // gravação colidir e abortar a transação, derrubando o lote inteiro.
      const res = await enviarLote([
        {
          fileName: 'caixa-1.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: completo({ documentCode: 'PRT-CASE-001' }),
        },
        {
          fileName: 'caixa-2.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: completo({ documentCode: 'prt-case-001' }),
        },
        {
          fileName: 'caixa-vizinho.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: completo(),
        },
      ]);
      expect(res.status).toBe(200);

      const [primeiro, segundo, vizinho] = res.body.results as {
        ok: boolean;
        error?: string;
      }[];
      expect(primeiro!.ok).toBe(true);
      expect(segundo!.ok).toBe(false);
      expect(segundo!.error).toBe('document_code_conflict');
      // A colisão interna não derruba o lote: o item válido recebe sua URL.
      expect(vizinho!.ok).toBe(true);
    });

    it('código que existe apenas em outra unidade não conflita', async () => {
      const codigo = 'PRT-CROSS-001';
      // Unidade B publica o código e o promove a `active`.
      const naUnidadeB = await enviarLote(
        [
          {
            fileName: 'cross-b.pdf',
            contentType: 'application/pdf',
            declaredSizeBytes: 10,
            documentControl: completo({ documentCode: codigo }),
          },
        ],
        ids.userB,
      );
      expect(naUnidadeB.body.results[0].ok).toBe(true);
      await withSystemBypass(pool, (client) =>
        client.query(`UPDATE files SET status = 'active' WHERE file_name = 'cross-b.pdf'`),
      );

      // Unidade A usa o mesmo código: a RLS filtra o homônimo por baixo, nada
      // dele é revelado, e o item é aceito.
      const naUnidadeA = await enviarLote([
        {
          fileName: 'cross-a.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: completo({ documentCode: codigo }),
        },
      ]);
      expect(naUnidadeA.status).toBe(200);
      expect(naUnidadeA.body.results[0].ok).toBe(true);
    });

    it('código preso a envio pendente de outra pessoa não é retomada', async () => {
      // A retomada existe para a pessoa repetir o **próprio** item que falhou.
      // Estendê-la a envio pendente de terceiro deixaria uma pessoa assumir a
      // linha de outra — e o `globalAdmin` do seed está na mesma unidade, o que
      // torna o caso alcançável.
      const codigo = 'PRT-ALHEIO-001';
      const deOutraPessoa = await enviarLote(
        [
          {
            fileName: 'pendente-alheio.pdf',
            contentType: 'application/pdf',
            declaredSizeBytes: 10,
            documentControl: completo({ documentCode: codigo }),
          },
        ],
        ids.globalAdmin,
      );
      expect(deOutraPessoa.body.results[0].ok).toBe(true);

      const tentativa = await enviarLote([
        {
          fileName: 'tenta-codigo-alheio.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: completo({ documentCode: codigo }),
        },
      ]);
      expect(tentativa.status).toBe(200);
      expect(tentativa.body.results[0].ok).toBe(false);
      expect(tentativa.body.results[0].error).toBe('document_code_conflict');
      // A linha da outra pessoa segue intacta: nada foi reaproveitado.
      expect((await linhaPorNome('pendente-alheio.pdf'))?.document_code).toBe(codigo);
    });
  });

  it('Arquivo geral é publicado só com o título e sem situação de revisão', async () => {
    const res = await enviarLote([
      {
        fileName: 'ata-reuniao.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: { documentType: DocumentType.GENERAL_FILE },
      },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.results[0].ok).toBe(true);
    // Não fica pendente: declarar o tipo já é cadastrá-lo.
    expect(res.body.results[0].awaitingRegistration).toBe(false);

    const linha = await linhaPorNome('ata-reuniao.pdf');
    expect(linha?.awaiting_registration).toBe(false);
    expect(linha?.document_code).toBeNull();

    const listagem = await listarRaiz(ids.userA);
    expect(listagem.get('ata-reuniao.pdf')?.documentStatus).toBe(DocumentStatus.NOT_APPLICABLE);
  });

  it('Arquivo geral com código, revisão ou prazo é recusado', async () => {
    for (const [campo, valor] of [
      ['documentCode', 'PRT-X-001'],
      ['documentRevision', 2],
      ['nextReviewAt', '2099-01-01'],
    ] as const) {
      const res = await enviarLote([
        {
          fileName: `geral-com-${campo}.pdf`,
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: { documentType: DocumentType.GENERAL_FILE, [campo]: valor },
        },
      ]);
      expect(res.status).toBe(200);
      expect(res.body.results[0].ok).toBe(false);
      expect(res.body.results[0].error).toBe('general_file_rejects_control_fields');
      expect(await linhaPorNome(`geral-com-${campo}.pdf`)).toBeUndefined();
    }
  });

  it('declarar Arquivo geral exige a mesma permissão dos demais dados de controle', async () => {
    // Declarar o tipo é alterar dado de controle, e exige o verbo de
    // substituir — não é um atalho para mexer em documento de terceiro.
    await enviarLote([
      {
        fileName: 'alheio-para-declarar.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: completo(),
      },
    ]);
    const alheio = await linhaPorNome('alheio-para-declarar.pdf');

    const res = await request(createApp(ports))
      .patch(`/files/${alheio!.id}/document-control`)
      .set('Cookie', await sessionCookieFor(ports, ids.userB))
      .send({ documentType: DocumentType.GENERAL_FILE });

    expect(res.status).toBe(403);
    // O tipo permanece como estava.
    expect((await linhaPorNome('alheio-para-declarar.pdf'))?.document_type).toBe(
      DocumentType.PROTOCOL,
    );
  });

  it('Arquivo geral é distinguível de arquivo pendente de cadastro', async () => {
    await enviarLote([
      {
        fileName: 'distingue-geral.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: { documentType: DocumentType.GENERAL_FILE },
      },
      { fileName: 'distingue-pendente.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
    ]);

    const listagem = await listarRaiz(ids.userA);
    // As duas linhas têm código, revisão e prazo vazios; o que as distingue é
    // a condição apurada, não as colunas.
    expect(listagem.get('distingue-geral.pdf')?.documentStatus).toBe(DocumentStatus.NOT_APPLICABLE);
    expect(listagem.get('distingue-pendente.pdf')?.documentStatus).toBe(
      DocumentStatus.AWAITING_REGISTRATION,
    );
  });

  describe('Aviso a quem enviou (US 10.9)', () => {
    async function avisos(userId: string) {
      const res = await request(createApp(ports))
        .get('/notifications')
        .set('Cookie', await sessionCookieFor(ports, userId));
      expect(res.status).toBe(200);
      return (
        res.body.notifications as {
          kind: string;
          payload: { fileId?: string; fileName?: string };
        }[]
      ).filter((n) => n.kind === NotificationKind.REGISTRATION_PENDING);
    }

    it('quem enviou é avisado de cada arquivo pendente, uma vez por arquivo', async () => {
      const antes = (await avisos(ids.userA)).length;
      await enviarLote([
        { fileName: 'aviso-1.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
        { fileName: 'aviso-2.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
      ]);

      const depois = await avisos(ids.userA);
      expect(depois.length).toBe(antes + 2);
      const nomes = depois.map((n) => n.payload.fileName);
      expect(nomes).toContain('aviso-1.pdf');
      expect(nomes).toContain('aviso-2.pdf');
    });

    it('repetir a emissão de URL do mesmo arquivo não duplica o aviso', async () => {
      // O evento de origem é o **arquivo**, e a retomada preserva o seu
      // identificador — é a combinação das duas coisas que dá a idempotência.
      const item = {
        fileName: 'aviso-idempotente.pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: 10,
        documentControl: { documentType: DocumentType.PROTOCOL, documentCode: 'PRT-IDEM-001' },
      };
      const antes = (await avisos(ids.userA)).length;

      await enviarLote([item]);
      const depoisDoPrimeiro = (await avisos(ids.userA)).length;
      expect(depoisDoPrimeiro).toBe(antes + 1);

      await enviarLote([item]);
      expect((await avisos(ids.userA)).length).toBe(depoisDoPrimeiro);
    });

    it('item completo e Arquivo geral não geram aviso', async () => {
      const antes = (await avisos(ids.userA)).length;
      await enviarLote([
        {
          fileName: 'sem-aviso-completo.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: completo(),
        },
        {
          fileName: 'sem-aviso-geral.pdf',
          contentType: 'application/pdf',
          declaredSizeBytes: 10,
          documentControl: { documentType: DocumentType.GENERAL_FILE },
        },
      ]);
      expect((await avisos(ids.userA)).length).toBe(antes);
    });

    it('falha ao avisar não impede o envio', async () => {
      // A emissão é engolida de propósito: o arquivo foi transferido, e perder
      // o aviso não pode desfazer isso. Com um port que sempre falha, o lote
      // conclui e o arquivo fica pendente como deveria — só o aviso se perde.
      const quebrado: Ports = {
        ...ports,
        notifications: {
          notify: async () => {
            throw new Error('falha simulada na emissão do aviso');
          },
        },
      };

      const res = await request(createApp(quebrado))
        .post('/files/upload-urls')
        .set('Cookie', await sessionCookieFor(ports, ids.userA))
        .send({
          items: [
            {
              fileName: 'aviso-que-falha.pdf',
              contentType: 'application/pdf',
              declaredSizeBytes: 10,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].ok).toBe(true);
      expect(res.body.results[0].awaitingRegistration).toBe(true);
      expect((await linhaPorNome('aviso-que-falha.pdf'))?.awaiting_registration).toBe(true);
    });

    it('o aviso não alcança quem não enviou, nem outra unidade', async () => {
      await enviarLote([
        { fileName: 'aviso-isolado.pdf', contentType: 'application/pdf', declaredSizeBytes: 10 },
      ]);

      for (const outro of [ids.userB, ids.globalAdmin]) {
        const nomes = (await avisos(outro)).map((n) => n.payload.fileName);
        expect(nomes).not.toContain('aviso-isolado.pdf');
      }
    });
  });
});
