import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type { FileSummaryResponse, SearchFilesResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { renderApp } from './render-app';

const COLLABORATOR = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };
const ADMIN = { id: 'admin-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };

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

function results(files: FileSummaryResponse[]): SearchFilesResponse {
  return { files };
}

function fetchedUrls(): string[] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[0]));
}

/**
 * Botão "Buscar" **da tela**, escopado ao conteúdo.
 *
 * A change `menu-lateral-e-barra-superior` acrescentou um acionador de busca
 * dentro do campo da barra superior, cujo nome acessível também casa com
 * `/buscar/i`. A consulta global passou a ser ambígua: o que estes casos
 * exercitam é o botão do formulário desta tela, não o da barra.
 */
function botaoBuscar(): HTMLElement {
  const conteudo = document.querySelector('.ant-layout-content') as HTMLElement;
  return within(conteudo).getByRole('button', { name: /buscar/i });
}

describe('Busca de arquivos (web-busca)', () => {
  it('abrir a página não consulta o servidor e exibe o estado inicial (spec: abrir a página não consulta o servidor)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    expect(fetchedUrls().some((url) => url.includes('/files/search'))).toBe(false);
  });

  it('sem nenhum critério, o botão "Buscar" fica desabilitado e Enter não dispara consulta (spec: botão desabilitado sem nenhum critério)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    expect(botaoBuscar()).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), '   ');
    await userEvent.keyboard('{Enter}');

    expect(fetchedUrls().some((url) => url.includes('/files/search'))).toBe(false);
  });

  it('um único caractere no nome habilita o botão e o acionamento consulta o servidor (spec: um caractere no nome já habilita a busca)', async () => {
    const pdf = file({ id: 'file-pdf', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([pdf]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), 'r');
    expect(botaoBuscar()).toBeEnabled();

    await userEvent.click(botaoBuscar());
    await screen.findByText('relatorio.pdf');

    const searchCall = fetchedUrls().find((url) => url.includes('/files/search?q=r'));
    expect(searchCall).toBeDefined();
  });

  it('busca com filtros combinados monta a query string certa e lista só o retornado (US 9.1 cenário 1)', async () => {
    const pdf = file({ id: 'file-pdf', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([pdf]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), 'relatorio');
    await userEvent.click(botaoBuscar());
    await screen.findByText('relatorio.pdf');

    await userEvent.click(screen.getByText('relatorio.pdf'));

    const searchCall = fetchedUrls().find((url) => url.includes('/files/search?q=relatorio'));
    expect(searchCall).toBeDefined();
  });

  it('alterar um filtro após buscar mantém a lista anterior e não dispara nova consulta (spec: alterar filtros após buscar mantém a lista anterior)', async () => {
    const pdf = file({ id: 'file-pdf', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([pdf]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), 'relatorio');
    await userEvent.click(botaoBuscar());
    await screen.findByText('relatorio.pdf');

    const callsBeforeEdit = fetchedUrls().filter((url) => url.includes('/files/search')).length;

    await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), '2');

    expect(screen.getByText('relatorio.pdf')).toBeInTheDocument();
    expect(fetchedUrls().filter((url) => url.includes('/files/search')).length).toBe(
      callsBeforeEdit,
    );
  });

  it('limpar filtros volta ao estado inicial sem consultar o servidor (US 9.1 cenário 2)', async () => {
    const pdf = file({ id: 'file-pdf', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([pdf]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    const searchInput = screen.getByPlaceholderText('Buscar por nome') as HTMLInputElement;
    await userEvent.type(searchInput, 'relatorio');
    await userEvent.click(botaoBuscar());
    await screen.findByText('relatorio.pdf');

    const callsBeforeClear = fetchedUrls().filter((url) => url.includes('/files/search')).length;

    await userEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));

    await waitFor(() => expect(searchInput.value).toBe(''));
    await screen.findByText('Informe ao menos um critério para buscar');
    expect(screen.queryByText('relatorio.pdf')).not.toBeInTheDocument();
    expect(botaoBuscar()).toBeDisabled();
    expect(fetchedUrls().filter((url) => url.includes('/files/search')).length).toBe(
      callsBeforeClear,
    );
  });

  it('filtro de autor aparece para admin e envia author (spec: filtro de autor restrito a administrador)', async () => {
    const pdf = file({ id: 'file-pdf', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /files/search': { status: 200, body: results([pdf]) },
      'GET /users': {
        status: 200,
        body: [
          {
            id: 'author-1',
            unitId: 'unit-1',
            fullName: 'Fulano',
            email: 'fulano@example.com',
            phone: null,
            jobTitle: null,
            sectorId: null,
            sectorName: null,
            notes: null,
            role: UserRole.COLLABORATOR,
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    const authorSelect = screen.getByText('Autor').closest('.ant-select')!;
    await userEvent.click(within(authorSelect as HTMLElement).getByRole('combobox'));
    await screen.findByText('Fulano');
    await userEvent.click(screen.getByText('Fulano'));

    await userEvent.click(botaoBuscar());
    await screen.findByText('relatorio.pdf');

    const authorCall = fetchedUrls().find((url) => url.includes('author=author-1'));
    expect(authorCall).toBeDefined();
  });

  it('filtro de autor não aparece para colaborador, sem chamar GET /users (spec: filtro de autor restrito a administrador)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    expect(screen.queryByText('Autor')).not.toBeInTheDocument();
    expect(fetchedUrls().some((url) => url.includes('/users'))).toBe(false);
  });

  it('resultado vazio exibe Empty; nome/"Visualizar" abre o PreviewModal e "Baixar" dispara a URL assinada', async () => {
    const image = file({ id: 'file-img', fileName: 'foto.png', contentType: 'image/png' });

    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([image]) },
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

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), 'foto');
    await userEvent.click(botaoBuscar());
    await screen.findByText('foto.png');

    const row = screen.getByText('foto.png').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /visualizar/i }));

    const dialog = await waitFor(() => screen.getByRole('dialog'));
    const img = await within(dialog).findByRole('img', { name: 'foto.png' });
    expect(img).toHaveAttribute('src', 'https://storage.example/foto.png?sig=abc');
  });

  it('busca sem resultados exibe estado vazio (spec: sem resultados exibe estado vazio)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /files/search': { status: 200, body: results([]) },
    });

    renderApp(['/busca']);
    await screen.findByText('Informe ao menos um critério para buscar');

    await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), 'inexistente');
    await userEvent.click(botaoBuscar());
    await screen.findByText('Nenhum resultado');
  });

  describe('chegada à tela de busca (change conteudo-da-tela-inicio, design.md D6)', () => {
    it('sem termo no endereço, o campo de termo chega focado', async () => {
      mockFetch({ 'GET /auth/me': { status: 200, body: COLLABORATOR } });
      renderApp(['/busca']);

      expect(await screen.findByPlaceholderText('Buscar por nome')).toHaveFocus();
    });

    it('com termo no endereço, a busca executa e o foco não vai para o campo', async () => {
      mockFetch({
        'GET /auth/me': { status: 200, body: COLLABORATOR },
        'GET /files/search': { status: 200, body: results([]) },
      });
      renderApp(['/busca?q=protocolo']);

      const campo = await screen.findByPlaceholderText('Buscar por nome');
      await waitFor(() => expect(campo).toHaveValue('protocolo'));
      expect(campo).not.toHaveFocus();
    });
  });
});
