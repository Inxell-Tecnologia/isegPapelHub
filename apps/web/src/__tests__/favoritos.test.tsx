import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GrantResourceType, Permission, UserRole } from '@gdoc/shared';
import type { FavoriteItemResponse, FileSummaryResponse } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { renderApp } from './render-app';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';

const COLLABORATOR = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function arquivo(id: string, fileName: string): FileSummaryResponse {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
    id,
    fileName,
    ownerId: 'user-1',
    folderId: 'folder-1',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    status: 'active',
    createdAt: '2026-10-02T10:00:00.000Z',
  };
}

function itemDeArquivo(
  id: string,
  name: string,
  permissions: Permission[] = [Permission.VIEW, Permission.DOWNLOAD],
): FavoriteItemResponse {
  return {
    resourceType: GrantResourceType.FILE,
    id,
    name,
    folderName: 'Protocolos',
    permissions,
    favoritedAt: '2026-11-04T10:00:00.000Z',
    file: arquivo(id, name),
  };
}

function itemDePasta(id: string, name: string): FavoriteItemResponse {
  return {
    resourceType: GrantResourceType.FOLDER,
    id,
    name,
    folderName: null,
    permissions: [Permission.VIEW],
    favoritedAt: '2026-11-03T10:00:00.000Z',
    file: null,
  };
}

function linha(nome: string): HTMLElement {
  return screen.getByText(nome).closest('tr') as HTMLElement;
}

/**
 * Destino "Favoritos" (US 2.5, change `favoritos`): mesma forma da lista de
 * compartilhados (design.md D8) — localização é a pasta que contém o item, e
 * as ações são só as dos verbos que o servidor devolveu.
 */
describe('Favoritos (capability favoritos)', () => {
  it('sem favoritos, a tela orienta como marcar', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /favorites': { status: 200, body: { items: [] } },
    });
    renderApp(['/favoritos']);

    expect(await screen.findByText(/Você ainda não tem favoritos/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('lista pastas e arquivos na ordem do servidor, com a pasta que os contém ou a raiz', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /favorites': {
        status: 200,
        body: { items: [itemDeArquivo('file-1', 'pop.pdf'), itemDePasta('folder-9', 'Normas')] },
      },
    });
    renderApp(['/favoritos']);

    await screen.findByText('pop.pdf');
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas[0]!.textContent).toContain('pop.pdf');
    expect(linhas[0]!.textContent).toContain('Protocolos');
    expect(linhas[1]!.textContent).toContain('Normas');
    expect(linhas[1]!.textContent).toContain('Raiz da unidade');
    // Pasta abre o explorador dela.
    expect(within(linhas[1]!).getByRole('link', { name: 'Normas' })).toHaveAttribute(
      'href',
      '/pastas/folder-9',
    );
  });

  it('sem o verbo de baixar, a ação de baixar não aparece', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /favorites': {
        status: 200,
        body: {
          items: [
            itemDeArquivo('file-1', 'so-ver.pdf', [Permission.VIEW]),
            itemDeArquivo('file-2', 'ver-e-baixar.pdf'),
          ],
        },
      },
    });
    renderApp(['/favoritos']);

    await screen.findByText('so-ver.pdf');
    expect(within(linha('so-ver.pdf')).queryByRole('button', { name: /Baixar/ })).toBeNull();
    expect(within(linha('so-ver.pdf')).getByRole('button', { name: /Visualizar/ })).toBeTruthy();
    expect(within(linha('ver-e-baixar.pdf')).getByRole('button', { name: /Baixar/ })).toBeTruthy();
  });

  it('"Remover dos favoritos" desmarca e o item sai da lista', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /favorites': [
        { status: 200, body: { items: [itemDeArquivo('file-1', 'pop.pdf')] } },
        { status: 200, body: { items: [] } },
      ],
      'DELETE /favorites/file/file-1': { status: 204 },
    });
    renderApp(['/favoritos']);

    await screen.findByText('pop.pdf');
    await userEvent.click(
      within(linha('pop.pdf')).getByRole('button', { name: /Remover dos favoritos/ }),
    );

    expect(await screen.findByText(/Você ainda não tem favoritos/)).toBeInTheDocument();
    const chamadas = vi
      .mocked(fetch)
      .mock.calls.map(
        ([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url), 'http://x').pathname}`,
      );
    expect(chamadas).toContain('DELETE /favorites/file/file-1');
  });

  it('Favoritos é destino de qualquer papel, entre Recentes e Compartilhados comigo', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLLABORATOR } });
    renderApp(['/']);

    await screen.findByText('Pastas da unidade');
    const menu = document.querySelector('.ant-layout-sider') as HTMLElement;
    const nomes = within(menu)
      .getAllByRole('link')
      .map((l) => l.textContent);
    const i = nomes.indexOf('Favoritos');
    expect(i).toBeGreaterThan(-1);
    expect(nomes[i - 1]).toBe('Recentes');
    expect(nomes[i + 1]).toBe('Compartilhados comigo');
  });
});

describe('Explorador oferece marcar e desmarcar favorito (web-navegacao)', () => {
  function conteudo(overrides: Record<string, unknown> = {}) {
    return {
      folder: null,
      breadcrumb: [],
      folders: [
        {
          id: 'folder-1',
          unitId: 'unit-1',
          ownerId: 'user-1',
          parentId: null,
          name: 'Protocolos',
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
      files: [{ ...arquivo('file-1', 'pop.pdf'), folderId: null }],
      canUpload: true,
      favoriteFolderIds: [],
      favoriteFileIds: [],
      ...overrides,
    };
  }

  it('item não favorito oferece "Favoritar"; marcar atualiza a indicação', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /folders/root/contents': [
        { status: 200, body: conteudo() },
        { status: 200, body: conteudo({ favoriteFileIds: ['file-1'] }) },
      ],
      'PUT /favorites/file/file-1': {
        status: 200,
        body: { resourceType: 'file', resourceId: 'file-1', favoritedAt: '2026-11-05T10:00:00Z' },
      },
    });
    renderApp(['/pastas']);

    const linhaDoArquivo = (await screen.findByText('pop.pdf')).closest('tr') as HTMLElement;
    expect(within(linhaDoArquivo).queryByRole('img', { name: 'Favorito' })).toBeNull();
    await userEvent.click(within(linhaDoArquivo).getByRole('button', { name: /Favoritar/ }));

    await waitFor(() =>
      expect(
        within(screen.getByText('pop.pdf').closest('tr') as HTMLElement).getByRole('img', {
          name: 'Favorito',
        }),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByText('pop.pdf').closest('tr') as HTMLElement).getByRole('button', {
        name: /Remover dos favoritos/,
      }),
    ).toBeInTheDocument();
  });

  it('item favorito oferece "Remover dos favoritos", com indicação por nome acessível', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /folders/root/contents': {
        status: 200,
        body: conteudo({ favoriteFolderIds: ['folder-1'] }),
      },
    });
    renderApp(['/pastas']);

    const linhaDaPasta = (await screen.findByRole('link', { name: 'Protocolos' })).closest(
      'tr',
    ) as HTMLElement;
    expect(within(linhaDaPasta).getByRole('img', { name: 'Favorito' })).toBeInTheDocument();
    expect(
      within(linhaDaPasta).getByRole('button', { name: /Remover dos favoritos/ }),
    ).toBeInTheDocument();
  });

  it('recusa por teto informa o limite atingido', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /folders/root/contents': { status: 200, body: conteudo() },
      'PUT /favorites/file/file-1': {
        status: 409,
        body: { error: 'favorites_limit_exceeded', allowed: 200 },
      },
    });
    renderApp(['/pastas']);

    const linhaDoArquivo = (await screen.findByText('pop.pdf')).closest('tr') as HTMLElement;
    await userEvent.click(within(linhaDoArquivo).getByRole('button', { name: /Favoritar/ }));
    expect(await screen.findByText(/limite de 200 favoritos/)).toBeInTheDocument();
  });
});
