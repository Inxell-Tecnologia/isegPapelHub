import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type {
  BatchUploadUrlResponse,
  FolderContentsResponse,
  StorageQuotaResponse,
} from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { mockXhr } from './mock-xhr';
import { renderApp } from './render-app';

/**
 * Change `posse-pelo-dono-da-pasta` (spec `web-upload`): envio para pasta de
 * outra pessoa consome o espaço do **dono**, que não é consultável — a SPA não
 * compara a seleção com o espaço próprio e apresenta a recusa do servidor por
 * espaço do dono sem números.
 */
const IDENTITY = { id: 'carlos', unitId: 'unit-1', role: UserRole.COLLABORATOR };

/** Espaço próprio esgotado: se a SPA o consultasse, recusaria a seleção. */
const SEM_ESPACO_PROPRIO: StorageQuotaResponse = {
  quotaBytes: 100,
  usedBytes: 100,
  trashedBytes: 0,
  trashedFiles: 0,
  pendingBytes: 0,
  availableBytes: 0,
};

function contents(overrides: Partial<FolderContentsResponse> = {}): FolderContentsResponse {
  return { folder: null, breadcrumb: [], folders: [], files: [], canUpload: true, ...overrides };
}

function fileInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="file"]'));
}

function chamadas(trecho: string): unknown[][] {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
  return fetchMock.mock.calls.filter(([input]) => String(input).includes(trecho));
}

describe('Envio para pasta de outra pessoa (posse-pelo-dono-da-pasta)', () => {
  it('não usa o espaço próprio como limite e apresenta a recusa por espaço do dono sem números', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': {
        status: 200,
        body: contents({ ownedByRequester: false }),
      },
      'GET /files/quota': { status: 200, body: SEM_ESPACO_PROPRIO },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'a.txt',
              ok: true,
              awaitingRegistration: true,
              uploadUrl: 'https://storage.example/a',
              objectPath: 'a',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
            { fileName: 'b.txt', ok: false, error: 'owner_quota_exceeded' },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });
    mockXhr({ 'https://storage.example/a': { status: 200 } });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [
      new File(['x'], 'a.txt', { type: 'text/plain' }),
      new File(['y'], 'b.txt', { type: 'text/plain' }),
    ]);

    // Vai direto à confirmação, sem consultar nem recusar pelo espaço próprio.
    const publicar = await screen.findByRole('button', { name: /^Publicar completos/ });
    expect(chamadas('/files/quota')).toHaveLength(0);
    expect(screen.queryByText(/não cabe/i)).not.toBeInTheDocument();
    await userEvent.click(publicar);

    await screen.findByText(/espaço do responsável por esta pasta não comporta/i);
    await waitFor(() => expect(chamadas('/files/upload-urls')).toHaveLength(1));
    // A recusa não pausa o envio para mostrar o espaço próprio.
    expect(chamadas('/files/quota')).toHaveLength(0);
  });

  it('destino próprio mantém a verificação de viabilidade pelo espaço próprio', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ ownedByRequester: true }) },
      'GET /files/quota': { status: 200, body: SEM_ESPACO_PROPRIO },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });
    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [
      new File(['x'], 'a.txt', { type: 'text/plain' }),
      new File(['y'], 'b.txt', { type: 'text/plain' }),
    ]);

    await waitFor(() => expect(chamadas('/files/quota')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /^Publicar completos/ })).not.toBeInTheDocument();
    expect(chamadas('/files/upload-urls')).toHaveLength(0);
  });
});
