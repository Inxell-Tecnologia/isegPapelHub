import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type {
  BatchUploadUrlResponse,
  FileSummaryResponse,
  FolderContentsResponse,
} from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { mockXhr } from './mock-xhr';
import { renderApp } from './render-app';
import { mockViewportWidth, NARROW_VIEWPORT } from './viewport';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function file(
  overrides: Partial<FileSummaryResponse> & { id: string; fileName: string },
): FileSummaryResponse {
  return {
    ownerId: 'user-1',
    folderId: null,
    contentType: 'application/pdf',
    sizeBytes: 2048,
    status: 'active',
    createdAt: '2026-07-02T10:00:00.000Z',
    ...overrides,
  };
}

function contents(overrides: Partial<FolderContentsResponse> = {}): FolderContentsResponse {
  return { folder: null, breadcrumb: [], folders: [], files: [], ...overrides };
}

function makeFile(name: string, content = 'conteudo'): File {
  return new File([content], name, { type: 'text/plain' });
}

function withRelativePath(f: File, path: string): File {
  Object.defineProperty(f, 'webkitRelativePath', { value: path, configurable: true });
  return f;
}

/** `Upload multiple` é o 1º input do container; `Upload directory` é o 2º. */
function fileInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="file"]'));
}

describe('Envio de arquivos e pastas (web-upload)', () => {
  it('lote de vários arquivos: uma chamada upload-urls, progresso e conclusão independentes (US 3.1 cenário 1)', async () => {
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'a.txt',
              ok: true,
              uploadUrl: 'https://storage.example/a',
              objectPath: 'a',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
            {
              fileName: 'b.txt',
              ok: true,
              uploadUrl: 'https://storage.example/b',
              objectPath: 'b',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockXhr({
      'https://storage.example/a': { status: 200 },
      'https://storage.example/b': { status: 200 },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a, b]);

    await screen.findByText('a.txt');
    await screen.findByText('b.txt');

    await waitFor(() =>
      expect(container.querySelectorAll('.ant-progress-status-success')).toHaveLength(2),
    );
    expect(screen.queryByRole('button', { name: /repetir/i })).not.toBeInTheDocument();

    const uploadUrlCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/files/upload-urls'),
    );
    expect(uploadUrlCalls).toHaveLength(1);
  });

  it('falha parcial por cota é sinalizada sem derrubar o lote; repetir reenvia só o item falho (US 3.1 cenário 2, RF #13)', async () => {
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'POST /files/upload-urls': [
        {
          status: 200,
          body: {
            results: [
              {
                fileName: 'a.txt',
                ok: true,
                uploadUrl: 'https://storage.example/a',
                objectPath: 'a',
                folderId: null,
                expiresAt: '2026-07-21T10:05:00.000Z',
              },
              { fileName: 'b.txt', ok: false, error: 'quota exceeded' },
            ],
          } satisfies BatchUploadUrlResponse,
        },
        {
          status: 200,
          body: {
            results: [
              {
                fileName: 'b.txt',
                ok: true,
                uploadUrl: 'https://storage.example/b-retry',
                objectPath: 'b',
                folderId: null,
                expiresAt: '2026-07-21T10:05:00.000Z',
              },
            ],
          } satisfies BatchUploadUrlResponse,
        },
      ],
    });

    mockXhr({
      'https://storage.example/a': { status: 200 },
      'https://storage.example/b-retry': { status: 200 },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a, b]);

    await screen.findByText('Cota de armazenamento atingida.');
    await waitFor(() =>
      expect(container.querySelectorAll('.ant-progress-status-success')).toHaveLength(1),
    ); // a.txt concluiu

    const retryButton = await screen.findByRole('button', { name: /repetir/i });
    await userEvent.click(retryButton);

    await waitFor(() =>
      expect(container.querySelectorAll('.ant-progress-status-success')).toHaveLength(2),
    );
    expect(screen.queryByRole('button', { name: /repetir/i })).not.toBeInTheDocument();
  });

  it('envio de pasta deriva relativePath de webkitRelativePath, preservando a hierarquia (US 3.2)', async () => {
    const root = withRelativePath(makeFile('raiz.txt'), 'Pasta/raiz.txt');
    const nested = withRelativePath(makeFile('nested.txt'), 'Pasta/Sub/nested.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'raiz.txt',
              ok: true,
              uploadUrl: 'https://storage.example/raiz',
              objectPath: 'raiz',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
            {
              fileName: 'nested.txt',
              ok: true,
              uploadUrl: 'https://storage.example/nested',
              objectPath: 'nested',
              folderId: 'folder-sub',
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockXhr({
      'https://storage.example/raiz': { status: 200 },
      'https://storage.example/nested': { status: 200 },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar pasta/i });

    const [, folderInput] = fileInputs(container);
    await userEvent.upload(folderInput!, [root, nested]);

    await screen.findByText('Pasta/raiz.txt');
    await screen.findByText('Pasta/Sub/nested.txt');

    const call = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/files/upload-urls'),
    )!;
    const body = JSON.parse(call[1].body as string);
    expect(body.items).toEqual([
      expect.objectContaining({ fileName: 'raiz.txt', relativePath: 'Pasta' }),
      expect.objectContaining({ fileName: 'nested.txt', relativePath: 'Pasta/Sub' }),
    ]);
  });

  it('sucesso do PUT invalida a listagem e o arquivo aparece pending, sem polling por active (design.md D6)', async () => {
    const uploaded = makeFile('novo.pdf');
    const pendingFile = file({ id: 'file-new', fileName: 'novo.pdf', status: 'pending' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': [
        { status: 200, body: contents() },
        { status: 200, body: contents({ files: [pendingFile] }) },
      ],
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'novo.pdf',
              ok: true,
              uploadUrl: 'https://storage.example/novo',
              objectPath: 'novo',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    mockXhr({ 'https://storage.example/novo': { status: 200 } });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [uploaded]);

    await waitFor(() => expect(screen.getByText('pending')).toBeInTheDocument());
    expect(screen.getAllByText('novo.pdf').length).toBeGreaterThanOrEqual(1);
  });

  it('destino sem permissão (403 no upload-urls) exibe aviso e não inicia transferência alguma (RF #10)', async () => {
    const a = makeFile('a.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'POST /files/upload-urls': { status: 403, body: { error: 'forbidden' } },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);

    await screen.findByText('Permissão insuficiente para enviar arquivos neste destino.');
    expect(screen.queryByText('a.txt')).not.toBeInTheDocument();
  });

  it('abaixo do limiar, enviar pasta é recusado no acionamento — botão continua visível (design.md D5, `web-responsividade`)', async () => {
    mockViewportWidth(NARROW_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
    });

    renderApp(['/pastas']);
    const folderButton = await screen.findByRole('button', { name: /enviar pasta/i });

    await userEvent.click(folderButton);

    await screen.findByText(
      'Enviar pasta não está disponível neste dispositivo. Use um computador.',
    );
    // Distinguível da recusa por permissão insuficiente do mesmo fluxo.
    expect(
      screen.queryByText('Permissão insuficiente para enviar arquivos neste destino.'),
    ).not.toBeInTheDocument();
  });
});
