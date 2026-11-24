import { describe, expect, it } from 'vitest';
import { tituloDoDocumento } from '../shell/document-control-labels';

/**
 * Change `marca-dagua-e-inicio-rodada-3`, design.md D9 (`tela-inicial`, "Linha
 * de recentes destaca o título do documento").
 */
describe('Título limpo do documento (marca-dagua-e-inicio-rodada-3)', () => {
  it('código e extensão saem do título', () => {
    expect(
      tituloDoDocumento('POP-ASS-004 - Emissão da declaração de óbito.pdf', 'POP-ASS-004'),
    ).toBe('Emissão da declaração de óbito');
  });

  it('nome sem o prefixo do código perde só a extensão', () => {
    expect(tituloDoDocumento('Passagem de plantão.docx', 'PRT-ASS-002')).toBe(
      'Passagem de plantão',
    );
  });

  it('prefixo que difere do código é preservado', () => {
    expect(tituloDoDocumento('POP-ASS-005 rascunho.pdf', 'POP-ASS-004')).toBe(
      'POP-ASS-005 rascunho',
    );
    expect(tituloDoDocumento('POP-ASS-0041 rascunho.pdf', 'POP-ASS-004')).toBe(
      'POP-ASS-0041 rascunho',
    );
  });

  it('nome igual ao código não deixa a linha sem título', () => {
    expect(tituloDoDocumento('POP-ASS-004.pdf', 'POP-ASS-004')).toBe('POP-ASS-004');
  });

  it('sem código, só a extensão sai', () => {
    expect(tituloDoDocumento('Ata da reunião.pdf', null)).toBe('Ata da reunião');
  });

  it('o prefixo é comparado sem distinguir maiúsculas, com outros separadores', () => {
    expect(tituloDoDocumento('pop-ass-004_Higienização.pdf', 'POP-ASS-004')).toBe('Higienização');
    expect(tituloDoDocumento('POP-ASS-004 – Higienização.pdf', 'POP-ASS-004')).toBe('Higienização');
  });

  it('nome sem extensão e com ponto no meio', () => {
    expect(tituloDoDocumento('Relatório 2026', null)).toBe('Relatório 2026');
    expect(tituloDoDocumento('Rev.2 do protocolo.pdf', null)).toBe('Rev.2 do protocolo');
    expect(tituloDoDocumento('.pdf', null)).toBe('.pdf');
  });
});
