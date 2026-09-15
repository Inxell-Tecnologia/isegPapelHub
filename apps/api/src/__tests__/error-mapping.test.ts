import { describe, it, expect } from 'vitest';
import { mapErrorResponse } from '../app.js';

/**
 * Superfície fechada do tratamento de erro (change
 * `corrige-defeitos-envio-lote`, design.md D1). O ponto destes casos não é só
 * que o 413 chega ao cliente — é que **nada além** dos dois `err.type`
 * reconhecidos consegue mudar o status ou vazar conteúdo interno.
 */
describe('mapErrorResponse (design.md D1)', () => {
  it('corpo grande demais vira 413 com código próprio', () => {
    const err = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
    });
    expect(mapErrorResponse(err)).toEqual({
      status: 413,
      body: { error: 'request_body_too_large' },
    });
  });

  it('JSON inválido vira 400 com código próprio', () => {
    const err = Object.assign(new SyntaxError('Unexpected token i in JSON'), {
      type: 'entity.parse.failed',
      status: 400,
    });
    expect(mapErrorResponse(err)).toEqual({ status: 400, body: { error: 'invalid_json' } });
  });

  it('erro comum permanece 500 opaco', () => {
    expect(mapErrorResponse(new Error('boom'))).toEqual({
      status: 500,
      body: { error: 'internal_error' },
    });
  });

  it('NÃO propaga `err.status` arbitrário sem `type` reconhecido', () => {
    // O caso que a superfície fechada existe para impedir: uma biblioteca
    // qualquer decora o erro com status, e o handler passaria a expô-lo.
    const err = Object.assign(new Error('detalhe interno que não pode vazar'), { status: 403 });
    expect(mapErrorResponse(err)).toEqual({ status: 500, body: { error: 'internal_error' } });
  });

  it('NÃO propaga `type` desconhecido, mesmo com status 4xx', () => {
    const err = Object.assign(new Error('falha de outra camada'), {
      type: 'entity.verify.failed',
      status: 400,
    });
    expect(mapErrorResponse(err)).toEqual({ status: 500, body: { error: 'internal_error' } });
  });

  it('nunca repassa a mensagem do erro original', () => {
    const segredo = 'senha=hunter2 host=interno.local';
    for (const err of [
      new Error(segredo),
      Object.assign(new Error(segredo), { type: 'entity.too.large' }),
      Object.assign(new Error(segredo), { type: 'entity.parse.failed' }),
    ]) {
      expect(JSON.stringify(mapErrorResponse(err))).not.toContain(segredo);
    }
  });

  it('tolera valores que não são Error', () => {
    expect(mapErrorResponse(null)).toEqual({ status: 500, body: { error: 'internal_error' } });
    expect(mapErrorResponse(undefined)).toEqual({ status: 500, body: { error: 'internal_error' } });
    expect(mapErrorResponse('string solta')).toEqual({
      status: 500,
      body: { error: 'internal_error' },
    });
  });
});
