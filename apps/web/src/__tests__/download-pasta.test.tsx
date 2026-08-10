import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type { FolderContentsResponse, FolderDownloadManifestResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function contents(overrides: Partial<FolderContentsResponse> = {}): FolderContentsResponse {
  return { folder: null, breadcrumb: [], folders: [], files: [], ...overrides };
}

function manifest(
  overrides: Partial<FolderDownloadManifestResponse> = {},
): FolderDownloadManifestResponse {
  return { entries: [], totalFiles: 0, allowedFiles: 0, totalBytes: 0, ...overrides };
}

/**
 * Substitui `global.fetch` por um handler arbitrário por rota (path +
 * método), casando pelo `pathname` como `mock-fetch.ts` faz — necessário
 * aqui além da tabela fixa porque as URLs assinadas de bytes (task 4.2)
 * precisam, no teste de cancelamento, ficar pendentes até o `AbortSignal`
 * disparar, o que uma resposta estática não expressa.
 */
function stubFetch(
  handler: (path: string, method: string, init?: RequestInit) => Promise<Response> | Response,
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const path = new URL(url, 'http://localhost').pathname;
      const method = (init?.method ?? 'GET').toUpperCase();
      // A central de notificações do shell (change `expiracao-permissoes`)
      // consulta `/notifications/unread-count` em qualquer página — resposta
      // neutra aqui para não cair no fallback "não deveria ser chamado" dos
      // handlers desta suíte, que é sobre URLs de bytes, não sobre o shell.
      if (path === '/notifications/unread-count') {
        return new Response(JSON.stringify({ count: 0 }), { status: 200 });
      }
      return handler(path, method, init);
    }),
  );
}

async function openRootDownloadModal() {
  renderApp(['/pastas']);
  const button = await screen.findByRole('button', { name: /baixar esta pasta/i });
  await userEvent.click(button);
}

describe('Download de pasta (web-navegacao, download-pasta-zip)', () => {
  it('6.1 aviso de recorte parcial aparece quando allowedFiles < totalFiles', async () => {
    stubFetch((path, method) => {
      if (path === '/auth/me') return new Response(JSON.stringify(IDENTITY), { status: 200 });
      if (path === '/folders/root/contents')
        return new Response(JSON.stringify(contents()), { status: 200 });
      if (path === '/folders/root/download-manifest' && method === 'POST') {
        return new Response(
          JSON.stringify(
            manifest({
              totalFiles: 3,
              allowedFiles: 2,
              totalBytes: 20,
              entries: [
                {
                  relativePath: 'a.txt',
                  fileName: 'a.txt',
                  sizeBytes: 10,
                  url: 'https://storage.test/a.txt',
                  expiresAt: '2026-01-01T00:00:00.000Z',
                },
                {
                  relativePath: 'b.txt',
                  fileName: 'b.txt',
                  sizeBytes: 10,
                  url: 'https://storage.test/b.txt',
                  expiresAt: '2026-01-01T00:00:00.000Z',
                },
              ],
            }),
          ),
          { status: 200 },
        );
      }
      if (path === '/a.txt' || path === '/b.txt') return new Response('conteudo', { status: 200 });
      return new Response(JSON.stringify({ error: 'unmocked_route' }), { status: 404 });
    });

    await openRootDownloadModal();

    await screen.findByText('2 de 3 itens disponíveis para você');
  });

  it('6.2 allowedFiles === 0 mostra mensagem explícita e não gera arquivo', async () => {
    let byteFetchCalled = false;
    stubFetch((path, method) => {
      if (path === '/auth/me') return new Response(JSON.stringify(IDENTITY), { status: 200 });
      if (path === '/auth/public-config')
        return new Response(JSON.stringify({ appName: 'PapelHub', clientName: '' }), {
          status: 200,
        });
      if (path === '/folders/root/contents')
        return new Response(JSON.stringify(contents()), { status: 200 });
      if (path === '/folders/root/download-manifest' && method === 'POST') {
        return new Response(JSON.stringify(manifest({ totalFiles: 3, allowedFiles: 0 })), {
          status: 200,
        });
      }
      byteFetchCalled = true;
      return new Response('nao deveria ser chamado', { status: 200 });
    });

    await openRootDownloadModal();

    await screen.findByText('Nenhum item disponível para download nesta pasta.');
    expect(byteFetchCalled).toBe(false);
  });

  it('6.3 cancelamento interrompe a operação', async () => {
    stubFetch((path, method, init) => {
      if (path === '/auth/me') return new Response(JSON.stringify(IDENTITY), { status: 200 });
      if (path === '/folders/root/contents')
        return new Response(JSON.stringify(contents()), { status: 200 });
      if (path === '/folders/root/download-manifest' && method === 'POST') {
        return new Response(
          JSON.stringify(
            manifest({
              totalFiles: 1,
              allowedFiles: 1,
              totalBytes: 10,
              entries: [
                {
                  relativePath: 'grande.bin',
                  fileName: 'grande.bin',
                  sizeBytes: 10,
                  url: 'https://storage.test/grande.bin',
                  expiresAt: '2026-01-01T00:00:00.000Z',
                },
              ],
            }),
          ),
          { status: 200 },
        );
      }
      if (path === '/grande.bin') {
        // Nunca resolve por conta própria — só rejeita quando o AbortSignal dispara,
        // simulando uma transferência de bytes em andamento no momento do cancelamento.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('cancelado', 'AbortError')),
          );
        });
      }
      return new Response(JSON.stringify({ error: 'unmocked_route' }), { status: 404 });
    });

    await openRootDownloadModal();

    const cancelButton = await screen.findByRole('button', { name: /cancelar/i });
    await userEvent.click(cancelButton);

    await screen.findByText('Download cancelado.');
  });

  it('6.4 recusa por limite exibe a orientação da API', async () => {
    stubFetch((path, method) => {
      if (path === '/auth/me') return new Response(JSON.stringify(IDENTITY), { status: 200 });
      if (path === '/folders/root/contents')
        return new Response(JSON.stringify(contents()), { status: 200 });
      if (path === '/folders/root/download-manifest' && method === 'POST') {
        return new Response(
          JSON.stringify({
            error: 'download_manifest_limit_exceeded',
            limit: 'maxFiles',
            found: 150,
            allowed: 100,
          }),
          { status: 413 },
        );
      }
      return new Response(JSON.stringify({ error: 'unmocked_route' }), { status: 404 });
    });

    await openRootDownloadModal();

    await screen.findByText(/150 arquivos \(limite: 100\)\. Baixe subpastas separadamente\./);
  });

  it('manifesto vazio na raiz oferece a ação normalmente (design.md D9)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
    });

    renderApp(['/pastas']);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /baixar esta pasta/i })).toBeInTheDocument(),
    );
  });
});
