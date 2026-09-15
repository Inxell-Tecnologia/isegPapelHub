import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../lib/api-client';

/**
 * Recusa por falta de capacidade do Cloud Run: o Google Front End responde
 * `429` com o corpo em texto puro `Rate exceeded.` — nunca um JSON nosso —
 * antes mesmo de a requisição chegar ao container. Estes testes travam o
 * contrato do cliente HTTP diante dessa resposta.
 */

function rateExceeded(): Response {
  return new Response('Rate exceeded.', {
    status: 429,
    headers: { 'Content-Type': 'text/plain' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cliente HTTP diante de recusa por capacidade (429 "Rate exceeded.")', () => {
  it('retenta um GET e devolve a resposta da tentativa bem-sucedida', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateExceeded())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/auth/me')).resolves.toEqual({ id: 'user-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('desiste depois das tentativas extras, com código próprio em vez de "unknown_error"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(rateExceeded());
    vi.stubGlobal('fetch', fetchMock);

    const err = await apiClient.get('/auth/me').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(429);
    // O corpo é `text/plain`: sem este fallback a mensagem viraria
    // `unknown_error` e a tela não teria como distinguir falta de capacidade
    // de um erro de verdade.
    expect((err as ApiError).message).toBe('service_unavailable');
    // Uma tentativa original + duas extras; nada além disso, para não
    // empilhar carga sobre um serviço que já está sem capacidade.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('não retenta POST — retry duplicaria efeito e gastaria capacidade', async () => {
    const fetchMock = vi.fn().mockResolvedValue(rateExceeded());
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.post('/auth/login', { email: 'a@b.c', password: 'x' })).rejects.toThrow(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
