import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type { FileSummaryResponse, FolderContentsResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { renderApp } from './render-app';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function file(
  overrides: Partial<FileSummaryResponse> & { id: string; fileName: string },
): FileSummaryResponse {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
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
  // `canUpload` vem resolvido pelo servidor (design.md D10 de
  // `identidade-visual-isetes`); o padrão aqui é a pessoa poder enviar, que é
  // o caso do dono da pasta — os casos de recusa o sobrescrevem.
  return { folder: null, breadcrumb: [], folders: [], files: [], canUpload: true, ...overrides };
}

async function openPreview(fileName: string): Promise<HTMLElement> {
  const row = screen.getByText(fileName).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /visualizar/i }));
  return waitFor(() => screen.getByRole('dialog'));
}

describe('Visualização e download de arquivos (web-visualizacao)', () => {
  it('imagem renderiza inline via <img> a partir da URL assinada (US 9.2 cenário 1)', async () => {
    const image = file({ id: 'file-img', fileName: 'foto.png', contentType: 'image/png' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [image] }) },
      'POST /files/file-img/view-url': {
        status: 200,
        body: {
          previewAvailable: true,
          url: 'https://storage.example/foto.png?sig=abc',
          expiresAt: '2026-07-21T10:05:00.000Z',
          action: 'view',
        },
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('foto.png');
    const dialog = await openPreview('foto.png');

    const img = await within(dialog).findByRole('img', { name: 'foto.png' });
    expect(img).toHaveAttribute('src', 'https://storage.example/foto.png?sig=abc');
  });

  it('PDF renderiza em visualizador embutido (<iframe>) a partir da URL assinada (US 9.2 cenário 1)', async () => {
    const pdf = file({ id: 'file-pdf', fileName: 'relatorio.pdf', contentType: 'application/pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [pdf] }) },
      'POST /files/file-pdf/view-url': {
        status: 200,
        body: {
          previewAvailable: true,
          url: 'https://storage.example/relatorio.pdf?sig=abc',
          expiresAt: '2026-07-21T10:05:00.000Z',
          action: 'view',
        },
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    const dialog = await openPreview('relatorio.pdf');

    await waitFor(() => {
      const iframe = dialog.querySelector('iframe');
      expect(iframe).toHaveAttribute('src', 'https://storage.example/relatorio.pdf?sig=abc');
    });
  });

  it('formato não suportado com download.available:true mostra mensagem + botão de download (US 9.2 cenário 2)', async () => {
    const doc = file({
      id: 'file-doc',
      fileName: 'planilha.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [doc] }) },
      'POST /files/file-doc/view-url': {
        status: 200,
        body: {
          previewAvailable: false,
          reason: 'unsupported_format',
          download: { available: true },
        },
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('planilha.xlsx');
    const dialog = await openPreview('planilha.xlsx');

    await within(dialog).findByText('Pré-visualização indisponível');
    expect(within(dialog).getByRole('button', { name: 'Baixar' })).toBeInTheDocument();
  });

  it('formato não suportado com download.available:false mostra a mensagem sem botão de download (US 9.2 cenário 2)', async () => {
    const doc = file({
      id: 'file-doc2',
      fileName: 'oculto.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [doc] }) },
      'POST /files/file-doc2/view-url': {
        status: 200,
        body: {
          previewAvailable: false,
          reason: 'unsupported_format',
          download: { available: false },
        },
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('oculto.xlsx');
    const dialog = await openPreview('oculto.xlsx');

    await within(dialog).findByText('Pré-visualização indisponível');
    expect(within(dialog).queryByRole('button', { name: 'Baixar' })).not.toBeInTheDocument();
  });

  it('clicar em "Baixar" dispara POST /files/:id/download-url e a navegação para a URL assinada (RF #16)', async () => {
    const doc = file({ id: 'file-dl', fileName: 'contrato.pdf' });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [doc] }) },
      'POST /files/file-dl/download-url': {
        status: 200,
        body: {
          url: 'https://storage.example/contrato.pdf?sig=xyz',
          expiresAt: '2026-07-21T10:30:00.000Z',
          action: 'download',
        },
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('contrato.pdf');

    const row = screen.getByText('contrato.pdf').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /baixar/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    clickSpy.mockRestore();
  });

  it('403 em view-url exibe aviso de permissão insuficiente, sem expor conteúdo (RF #10)', async () => {
    const doc = file({ id: 'file-np', fileName: 'protegido.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [doc] }) },
      'POST /files/file-np/view-url': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/pastas']);
    await screen.findByText('protegido.pdf');
    const dialog = await openPreview('protegido.pdf');

    await within(dialog).findByText('Permissão insuficiente');
    expect(dialog.querySelector('iframe')).not.toBeInTheDocument();
    expect(dialog.querySelector('img')).not.toBeInTheDocument();
  });

  it('403 em download-url exibe aviso de permissão insuficiente (RF #10)', async () => {
    const doc = file({ id: 'file-np2', fileName: 'bloqueado.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [doc] }) },
      'POST /files/file-np2/download-url': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/pastas']);
    await screen.findByText('bloqueado.pdf');

    const row = screen.getByText('bloqueado.pdf').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /baixar/i }));

    await screen.findByText('Permissão insuficiente para baixar este arquivo.');
  });
});
