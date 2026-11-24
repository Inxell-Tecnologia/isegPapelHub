import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GrantResourceType, Permission, UserRole } from '@gdoc/shared';
import type { FileSummaryResponse, SharedWithMeItemResponse } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { renderApp } from './render-app';

const COLLABORATOR = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function arquivo(
  overrides: Partial<FileSummaryResponse> & { id: string; fileName: string },
): FileSummaryResponse {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
    ownerId: 'outra-pessoa',
    folderId: null,
    contentType: 'application/pdf',
    sizeBytes: 2048,
    status: 'active',
    createdAt: '2026-07-02T10:00:00.000Z',
    ...overrides,
  };
}

function itemDeArquivo(
  overrides: Partial<SharedWithMeItemResponse> & { id: string; name: string },
): SharedWithMeItemResponse {
  return {
    resourceType: GrantResourceType.FILE,
    folderName: 'Governança',
    permissions: [{ permission: Permission.VIEW, expiresAt: null }],
    sharedAt: '2026-07-02T10:00:00.000Z',
    file: arquivo({ id: overrides.id, fileName: overrides.name }),
    ...overrides,
  };
}

function itemDePasta(
  overrides: Partial<SharedWithMeItemResponse> & { id: string; name: string },
): SharedWithMeItemResponse {
  return {
    resourceType: GrantResourceType.FOLDER,
    folderName: 'Institucional',
    permissions: [{ permission: Permission.VIEW, expiresAt: null }],
    sharedAt: '2026-07-02T10:00:00.000Z',
    file: null,
    ...overrides,
  };
}

function rotas(itens: SharedWithMeItemResponse[]) {
  return {
    'GET /auth/me': { status: 200, body: COLLABORATOR },
    'GET /grants/received': { status: 200, body: { items: itens } },
  };
}

/** A linha da tabela cujo nome de recurso é `nome`. */
function linha(nome: string): HTMLElement {
  return screen.getByText(nome).closest('tr') as HTMLElement;
}

/**
 * A **etiqueta** do verbo, na coluna "O que você pode fazer".
 *
 * Escopada ao `.ant-tag` de propósito: a etiqueta (informação, com o prazo) e
 * o botão da coluna "Ações" (acionador) carregam o mesmo texto para `view` e
 * `download`, e uma consulta por texto apanharia os dois. São papéis
 * distintos na mesma linha — a etiqueta diz o que vale e até quando, o botão
 * executa.
 */
function etiqueta(alvo: HTMLElement, texto: string | RegExp): HTMLElement {
  return within(alvo).getByText(texto, { selector: '.ant-tag' });
}

/**
 * US 4.4 (capability `compartilhados-comigo`): o destino "Compartilhados
 * comigo".
 *
 * O que estes casos protegem, acima da renderização: a tela oferece **apenas**
 * as ações cujos verbos vieram na resposta. Os verbos são veredito do
 * servidor; a SPA não os deduz do papel nem os antecipa, mesmo padrão do botão
 * de envio da barra superior.
 */
describe('Compartilhados comigo (US 4.4)', () => {
  it('apresenta pasta e arquivo com localização, verbos e data do compartilhamento', async () => {
    mockFetch(
      rotas([
        itemDeArquivo({ id: 'file-1', name: 'politica.pdf' }),
        itemDePasta({ id: 'folder-1', name: 'Políticas' }),
      ]),
    );

    renderApp(['/compartilhados']);

    await screen.findByText('politica.pdf');
    expect(within(linha('politica.pdf')).getByText('Governança')).toBeInTheDocument();
    expect(etiqueta(linha('politica.pdf'), 'Visualizar')).toBeInTheDocument();
    expect(
      within(linha('politica.pdf')).getByRole('button', { name: /visualizar/i }),
    ).toBeInTheDocument();

    const dePasta = linha('Políticas');
    expect(within(dePasta).getByText('Pasta')).toBeInTheDocument();
    expect(within(dePasta).getByText('Institucional')).toBeInTheDocument();
    // A pasta navega para o explorador dela, sem percorrer a árvore.
    expect(screen.getByRole('link', { name: 'Políticas' })).toHaveAttribute(
      'href',
      '/pastas/folder-1',
    );
  });

  it('pasta com view abre o explorador daquela pasta, sem percorrer a árvore', async () => {
    mockFetch({
      ...rotas([itemDePasta({ id: 'folder-9', name: 'Protocolos' })]),
      'GET /folders/folder-9/contents': {
        status: 200,
        body: {
          folder: { id: 'folder-9', name: 'Protocolos', parentId: null },
          breadcrumb: [],
          folders: [],
          files: [],
          canUpload: false,
        },
      },
    });

    const { router } = renderApp(['/compartilhados']);
    await userEvent.click(await screen.findByRole('link', { name: 'Protocolos' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/pastas/folder-9'));
    // O explorador abriu **naquela** pasta, e não na raiz: a lista alcança o
    // recurso sem que a pessoa precise percorrer as pastas que o contêm.
    expect(
      (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) =>
        String(c[0]),
      ),
    ).toContain('/folders/folder-9/contents');
  });

  it('arquivo com view abre o visualizador a partir da lista', async () => {
    mockFetch({
      ...rotas([itemDeArquivo({ id: 'file-1', name: 'manual.pdf' })]),
      'POST /files/file-1/view-url': {
        status: 200,
        body: { kind: 'inline', url: 'https://storage.example/manual.pdf' },
      },
    });

    renderApp(['/compartilhados']);
    await userEvent.click(await screen.findByRole('button', { name: 'manual.pdf' }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(
      (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) =>
        String(c[0]),
      ),
    ).toContain('/files/file-1/view-url');
  });

  it('concessão apenas de download oferece baixar e não oferece visualizar', async () => {
    mockFetch(
      rotas([
        itemDeArquivo({
          id: 'file-2',
          name: 'planilha.xlsx',
          permissions: [{ permission: Permission.DOWNLOAD, expiresAt: null }],
        }),
      ]),
    );

    renderApp(['/compartilhados']);
    await screen.findByText('planilha.xlsx');

    const alvo = linha('planilha.xlsx');
    expect(within(alvo).getByRole('button', { name: /baixar/i })).toBeInTheDocument();
    expect(within(alvo).queryByRole('button', { name: /visualizar/i })).toBeNull();
    // Sem `view`, o nome também não é acionável — acionador que conduz a
    // recusa é o que `tela-inicial` proíbe.
    expect(within(alvo).queryByRole('button', { name: 'planilha.xlsx' })).toBeNull();
  });

  it('concessão apenas de visualizar não oferece baixar', async () => {
    mockFetch(rotas([itemDeArquivo({ id: 'file-3', name: 'ata.pdf' })]));

    renderApp(['/compartilhados']);
    await screen.findByText('ata.pdf');

    const alvo = linha('ata.pdf');
    expect(within(alvo).getByRole('button', { name: /visualizar/i })).toBeInTheDocument();
    expect(within(alvo).queryByRole('button', { name: /baixar/i })).toBeNull();
  });

  it('o prazo acompanha o verbo a que pertence', async () => {
    mockFetch(
      rotas([
        itemDeArquivo({
          id: 'file-4',
          name: 'temporario.pdf',
          permissions: [
            { permission: Permission.VIEW, expiresAt: null },
            { permission: Permission.DOWNLOAD, expiresAt: '2026-12-31T00:00:00.000Z' },
          ],
        }),
      ]),
    );

    renderApp(['/compartilhados']);
    await screen.findByText('temporario.pdf');

    const alvo = linha('temporario.pdf');
    // Visualizar é permanente e não ganha prazo; baixar vence, e o prazo
    // aparece junto dele — não como prazo "do item".
    expect(etiqueta(alvo, 'Visualizar')).toBeInTheDocument();
    expect(etiqueta(alvo, /^Baixar \(até/)).toBeInTheDocument();
  });

  it('recurso na raiz informa a raiz em vez de deixar a localização vazia', async () => {
    mockFetch(rotas([itemDeArquivo({ id: 'file-5', name: 'na-raiz.pdf', folderName: null })]));

    renderApp(['/compartilhados']);
    await screen.findByText('na-raiz.pdf');
    expect(within(linha('na-raiz.pdf')).getByText('Raiz da unidade')).toBeInTheDocument();
  });

  it('sem nenhuma concessão recebida, orienta em vez de apresentar tabela vazia', async () => {
    mockFetch(rotas([]));

    renderApp(['/compartilhados']);
    await screen.findByText(/Nada foi compartilhado com você ainda/);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('o item de menu aparece para colaborador e leva ao destino', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      ...rotas([itemDeArquivo({ id: 'file-6', name: 'do-menu.pdf' })]),
    });

    const { router } = renderApp(['/']);
    const item = await screen.findByRole('link', { name: 'Compartilhados comigo' });

    await userEvent.click(item);
    await waitFor(() => expect(router.state.location.pathname).toBe('/compartilhados'));
    await screen.findByText('do-menu.pdf');
  });
});
