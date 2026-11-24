import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api-client';
import { descreverRecusaDeControle } from '../navegacao/document-control-errors';

/**
 * Recusas do controle documental traduzidas em avisos **distinguíveis entre
 * si** (`web-upload`: "apresentada de forma distinguível, indicando o que
 * corrigir"). Nenhuma delas pode ser o "tente novamente" genérico: repetir a
 * mesma operação falharia de forma idêntica.
 */

const GENERICO = 'Não foi possível concluir a ação. Tente novamente.';

function recusa(status: number, details: unknown): ApiError {
  return new ApiError(status, 'recusa', details);
}

describe('Conflito de código por item do lote (design.md D7)', () => {
  it('nomeia as duas origens possíveis do conflito, em vez do texto genérico', () => {
    const mensagem = descreverRecusaDeControle(recusa(409, { error: 'document_code_conflict' }));
    expect(mensagem).not.toBe(GENERICO);
    expect(mensagem).toMatch(/Código já usado/);
    expect(mensagem).toMatch(/deste envio/);
  });

  it('é distinguível da recusa de código em uso da rota unitária', () => {
    const doLote = descreverRecusaDeControle(recusa(409, { error: 'document_code_conflict' }));
    const unitaria = descreverRecusaDeControle(
      recusa(409, { error: 'document_code_in_use', code: 'PRT-NSP-001' }),
    );
    expect(doLote).not.toBe(unitaria);
  });
});

describe('Campo incompatível com Arquivo geral (design.md D8)', () => {
  it.each([
    ['documentCode', 'código'],
    ['documentRevision', 'revisão'],
    ['nextReviewAt', 'data da próxima revisão'],
  ])('nomeia o campo rejeitado %s', (campo, rotulo) => {
    const mensagem = descreverRecusaDeControle(
      recusa(400, { error: 'general_file_rejects_control_fields', rejected: [campo] }),
    );
    expect(mensagem).not.toBe(GENERICO);
    expect(mensagem).toContain(rotulo);
  });

  it('sem a lista de rejeitados, ainda diz o que o tipo não aceita', () => {
    const mensagem = descreverRecusaDeControle(
      recusa(400, { error: 'general_file_rejects_control_fields' }),
    );
    expect(mensagem).not.toBe(GENERICO);
    expect(mensagem).toMatch(/Arquivo geral não aceita/);
  });
});

describe('As recusas já existentes continuam distinguíveis', () => {
  it('dado faltante nomeia os campos que faltam', () => {
    expect(
      descreverRecusaDeControle(
        recusa(400, { error: 'document_control_required', missing: ['responsibleSector'] }),
      ),
    ).toBe('Faltam dados de controle: setor responsável.');
  });

  it('permissão insuficiente não se confunde com dado faltante', () => {
    expect(descreverRecusaDeControle(recusa(403, undefined))).toMatch(/Permissão insuficiente/);
  });

  it('erro desconhecido cai no genérico, e só ele', () => {
    expect(descreverRecusaDeControle(recusa(500, { error: 'outra_coisa' }))).toBe(GENERICO);
  });
});
