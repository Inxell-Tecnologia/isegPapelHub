import { describe, expect, it } from 'vitest';
import { DOCUMENT_TYPES, DocumentType, requiredFieldsForType } from '@gdoc/shared';
import {
  aplicarATodas,
  codigosEmConflito,
  contarDesfecho,
  editarLinha,
  faltantesDaLinha,
  linhaCompleta,
  linhaDeArquivo,
  linhaEnviavel,
  nomeDoArquivo,
  sugerirPeloNome,
  type LinhaDeCadastro,
} from '../upload/cadastro-em-lote';

function linha(nome: string, patch: Partial<LinhaDeCadastro> = {}): LinhaDeCadastro {
  const base = linhaDeArquivo(nome, new File(['x'], nome, { type: 'application/pdf' }));
  return { ...base, ...patch };
}

/** Linha de documento controlado com os cinco campos preenchidos. */
function completa(nome: string, patch: Partial<LinhaDeCadastro> = {}): LinhaDeCadastro {
  return linha(nome, {
    documentType: DocumentType.PROTOCOL,
    documentCode: 'PRT-NSP-900',
    documentRevision: 1,
    responsibleSector: 'Governança',
    nextReviewAt: '2030-12-31',
    ...patch,
  });
}

describe('Sugestão de tipo e código pelo nome do arquivo (design.md D4)', () => {
  it('reconhece o padrão SIGLA-AREA-Nº e exclui o sufixo descritivo do código', () => {
    expect(sugerirPeloNome('PRT-NSP-001_Identificacao.pdf')).toEqual({
      documentType: DocumentType.PROTOCOL,
      documentCode: 'PRT-NSP-001',
    });
  });

  it('reconhece as siglas como o cliente as escreve, não só as da interface', () => {
    // A tabela 2.2 da demanda usa FOR/CHK, TC e CI; a interface apresenta
    // FOR, TC e COM. Um reconhecedor só com as da interface falharia justamente
    // nos nomes que o acervo do cliente traz.
    expect(sugerirPeloNome('FOR-NSP-002.xlsx')?.documentType).toBe(DocumentType.FORM);
    expect(sugerirPeloNome('CHK-NSP-002.xlsx')?.documentType).toBe(DocumentType.CHECKLIST);
    expect(sugerirPeloNome('CI-NSP-003.pdf')?.documentType).toBe(DocumentType.INTERNAL_NOTICE);
    expect(sugerirPeloNome('TC-NSP-004.pdf')?.documentType).toBe(DocumentType.CONSENT_TERM);
    expect(sugerirPeloNome('NOR-NSP-005.pdf')?.documentType).toBe(DocumentType.POLICY);
    // E FRM, sigla anterior da interface, continua valendo.
    expect(sugerirPeloNome('FRM-NSP-006.xlsx')?.documentType).toBe(DocumentType.FORM);
    // E TCO, sigla anterior do termo de consentimento, também.
    expect(sugerirPeloNome('TCO-NSP-007.pdf')?.documentType).toBe(DocumentType.CONSENT_TERM);
  });

  it('distingue checklist de formulário (change tipo-checklist, design.md D4)', () => {
    expect(sugerirPeloNome('CHK-NSP-002.xlsx')).toEqual({
      documentType: DocumentType.CHECKLIST,
      documentCode: 'CHK-NSP-002',
    });
    expect(sugerirPeloNome('FOR-NSP-003.xlsx')).toEqual({
      documentType: DocumentType.FORM,
      documentCode: 'FOR-NSP-003',
    });
  });

  it('não sugere nada para nome fora do padrão', () => {
    expect(sugerirPeloNome('Ata da reunião de março.docx')).toBeNull();
    expect(sugerirPeloNome('relatorio-final.pdf')).toBeNull();
    expect(sugerirPeloNome('XYZ-NSP-001.pdf')).toBeNull(); // sigla desconhecida
  });

  it('preserva a caixa do código como escrita no nome', () => {
    expect(sugerirPeloNome('prt-nsp-001_x.pdf')).toEqual({
      documentType: DocumentType.PROTOCOL,
      documentCode: 'prt-nsp-001',
    });
  });

  it('marca os campos sugeridos como sugestão, para a interface distingui-los', () => {
    const sugerida = linha('PRT-NSP-001_Identificacao.pdf');
    expect([...sugerida.sugeridos].sort()).toEqual(['documentCode', 'documentType']);

    const sem = linha('Ata.docx');
    expect(sugerida.documentCode).toBe('PRT-NSP-001');
    expect(sem.sugeridos.size).toBe(0);
    expect(sem.documentType ?? null).toBeNull();
  });

  it('editar um campo sugerido deixa de marcá-lo como sugestão', () => {
    const editada = editarLinha(linha('PRT-NSP-001.pdf'), 'documentCode', 'PRT-NSP-777');
    expect(editada.sugeridos.has('documentCode')).toBe(false);
    expect(editada.sugeridos.has('documentType')).toBe(true);
  });
});

describe('Título mapeia para o nome do arquivo (design.md D3)', () => {
  it('vem preenchido com o nome do arquivo sem a extensão', () => {
    expect(linha('Ata da reunião.docx').titulo).toBe('Ata da reunião');
  });

  it('título editado reanexa a extensão original', () => {
    const editada = editarLinha(linha('Ata da reunião.docx'), 'titulo', 'Ata de março');
    expect(nomeDoArquivo(editada)).toBe('Ata de março.docx');
  });

  it('não duplica a extensão quando a pessoa já a digitou', () => {
    const editada = editarLinha(linha('Ata.docx'), 'titulo', 'Ata de março.docx');
    expect(nomeDoArquivo(editada)).toBe('Ata de março.docx');
  });

  it('arquivo sem extensão continua sem extensão', () => {
    const editada = editarLinha(linha('LEIAME'), 'titulo', 'Leia-me');
    expect(nomeDoArquivo(editada)).toBe('Leia-me');
  });
});

describe('Completude da linha deriva do contrato compartilhado (design.md D9)', () => {
  it('documento controlado com os cinco campos está completo', () => {
    expect(linhaCompleta(completa('PRT-NSP-900.pdf'))).toBe(true);
  });

  it('faltar só o responsável mantém a linha incompleta', () => {
    const semResponsavel = completa('PRT-NSP-900.pdf', { responsibleSector: null });
    expect(linhaCompleta(semResponsavel)).toBe(false);
    expect(faltantesDaLinha(semResponsavel)).toEqual(['responsibleSector']);
  });

  it('Arquivo geral com título está completo, sem código, revisão nem data', () => {
    const geral = editarLinha(linha('Ata.docx'), 'documentType', DocumentType.GENERAL_FILE);
    expect(faltantesDaLinha(geral)).toEqual([]);
    expect(linhaCompleta(geral)).toBe(true);
  });

  it('linha sem título é incompleta por título e não é enviável', () => {
    const semTitulo = editarLinha(completa('PRT-NSP-900.pdf'), 'titulo', '  ');
    expect(faltantesDaLinha(semTitulo)).toContain('titulo');
    expect(linhaEnviavel(semTitulo)).toBe(false);
    // Linha incompleta nos dados de controle segue enviável: nasce pendente.
    expect(linhaEnviavel(linha('Ata.docx'))).toBe(true);
  });

  it('conta os dois grupos para a confirmação declarar o desfecho', () => {
    expect(contarDesfecho([completa('a.pdf'), linha('b.pdf'), linha('c.pdf')])).toEqual({
      publicam: 1,
      pendentes: 2,
    });
  });
});

describe('Arquivo geral esvazia os campos que não admite (design.md D8)', () => {
  it('trocar o tipo para Arquivo geral limpa código, revisão e próxima revisão', () => {
    const geral = editarLinha(
      completa('PRT-NSP-900.pdf'),
      'documentType',
      DocumentType.GENERAL_FILE,
    );
    expect(geral.documentCode).toBeNull();
    expect(geral.documentRevision).toBeNull();
    expect(geral.nextReviewAt).toBeNull();
    // O responsável permanece: não está entre os campos recusados.
    expect(geral.responsibleSector).toBe('Governança');
  });
});

describe('Código repetido dentro da própria seleção (design.md D7)', () => {
  it('aponta todas as linhas do grupo em conflito, não só a repetição', () => {
    const linhas = [
      completa('a.pdf', { uid: 'a', documentCode: 'PRT-NSP-001' }),
      completa('b.pdf', { uid: 'b', documentCode: 'PRT-NSP-001' }),
      completa('c.pdf', { uid: 'c', documentCode: 'PRT-NSP-002' }),
    ];
    expect(codigosEmConflito(linhas)).toEqual(new Set(['a', 'b']));
  });

  it('diferença só de caixa ou de espaços nas pontas é a mesma colisão', () => {
    const linhas = [
      completa('a.pdf', { uid: 'a', documentCode: 'prt-nsp-001' }),
      completa('b.pdf', { uid: 'b', documentCode: '  PRT-NSP-001 ' }),
    ];
    expect(codigosEmConflito(linhas)).toEqual(new Set(['a', 'b']));
  });

  it('linhas sem código não conflitam entre si', () => {
    const linhas = [linha('a.pdf', { uid: 'a' }), linha('b.pdf', { uid: 'b' })];
    expect(codigosEmConflito(linhas).size).toBe(0);
  });
});

describe('Aplicar a todos (design.md D5)', () => {
  const selecao = [
    linha('a.pdf', { uid: 'a' }),
    linha('PRT-NSP-010_x.pdf', { uid: 'b' }),
    linha('c.pdf', { uid: 'c', documentRevision: 7 }),
  ];

  it('preenche tipo, revisão, responsável e próxima revisão em todas as linhas', () => {
    const aplicadas = aplicarATodas(selecao, {
      documentType: DocumentType.PROCEDURE,
      documentRevision: 0,
      responsibleSector: 'Qualidade',
      nextReviewAt: '2031-01-31',
    });
    for (const l of aplicadas) {
      expect(l.documentType).toBe(DocumentType.PROCEDURE);
      expect(l.documentRevision).toBe(0);
      expect(l.responsibleSector).toBe('Qualidade');
      expect(l.nextReviewAt).toBe('2031-01-31');
    }
  });

  it('sobrescreve a linha já editada, em vez de só preencher o que está vazio', () => {
    const aplicadas = aplicarATodas(selecao, { documentRevision: 2 });
    expect(aplicadas.find((l) => l.uid === 'c')?.documentRevision).toBe(2);
  });

  it('não toca no código de nenhuma linha', () => {
    const aplicadas = aplicarATodas(selecao, { documentType: DocumentType.PROCEDURE });
    expect(aplicadas.find((l) => l.uid === 'b')?.documentCode).toBe('PRT-NSP-010');
    expect(aplicadas.find((l) => l.uid === 'a')?.documentCode ?? null).toBeNull();
  });

  it('campo em branco na linha de aplicação não apaga o que as linhas já têm', () => {
    const aplicadas = aplicarATodas(selecao, { documentRevision: null, responsibleSector: '' });
    expect(aplicadas.find((l) => l.uid === 'c')?.documentRevision).toBe(7);
  });

  it('aplicar Arquivo geral esvazia os campos recusados de todas as linhas', () => {
    const comCodigo = [completa('a.pdf', { uid: 'a' }), completa('b.pdf', { uid: 'b' })];
    const aplicadas = aplicarATodas(comCodigo, { documentType: DocumentType.GENERAL_FILE });
    for (const l of aplicadas) {
      expect(l.documentCode).toBeNull();
      expect(l.nextReviewAt).toBeNull();
      expect(linhaCompleta(l)).toBe(true);
    }
  });

  it('valor aplicado deixa de ser sugestão', () => {
    const aplicadas = aplicarATodas(selecao, { documentType: DocumentType.PROCEDURE });
    expect(aplicadas.find((l) => l.uid === 'b')?.sugeridos.has('documentType')).toBe(false);
    // O código continua sendo sugestão: "Aplicar a todos" não o alcança.
    expect(aplicadas.find((l) => l.uid === 'b')?.sugeridos.has('documentCode')).toBe(true);
  });
});

describe('O conjunto exigido é o do servidor, para todo tipo (design.md D9)', () => {
  it.each(DOCUMENT_TYPES)('o que falta em %s é exatamente requiredFieldsForType', (tipo) => {
    // Guarda estrutural: se alguém reintroduzir uma lista escrita à mão no
    // cliente, ela divergirá do contrato em algum dos tipos e este caso
    // falha. Foi assim que o formulário ficou exigindo quatro campos enquanto o
    // servidor passou a exigir cinco.
    const vazia = editarLinha(linha('arquivo.pdf'), 'documentType', tipo);
    // O tipo já está preenchido (é o que a linha declara); falta o resto do
    // conjunto que **aquele tipo** exige, na mesma ordem do contrato.
    const esperado = requiredFieldsForType(tipo).filter((campo) => campo !== 'documentType');
    expect(faltantesDaLinha(vazia)).toEqual([...esperado]);
  });

  it('o Arquivo geral não exige nenhum dado de controle, só o título', () => {
    expect(requiredFieldsForType(DocumentType.GENERAL_FILE)).toEqual([]);
    const semTitulo = editarLinha(
      editarLinha(linha('ata.pdf'), 'documentType', DocumentType.GENERAL_FILE),
      'titulo',
      '',
    );
    expect(faltantesDaLinha(semTitulo)).toEqual(['titulo']);
  });
});
