import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type { FileSummaryResponse, FolderContentsResponse, FolderResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, NARROW_VIEWPORT } from './viewport';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function folder(overrides: Partial<FolderResponse> & { id: string; name: string }): FolderResponse {
  return {
    unitId: 'unit-1',
    ownerId: 'user-1',
    parentId: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

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

/**
 * `rc-util`'s `useId` sempre devolve o literal `"test-id"` em ambiente de
 * teste (`process.env.NODE_ENV === 'test'`), então todo `Modal` do AntD
 * recebe o mesmo `aria-labelledby` — role+name não distingue diálogos
 * simultâneos aqui. Localiza pelo texto do título em vez disso.
 */
async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.startsWith(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

describe('Explorador de pastas/arquivos (web-navegacao)', () => {
  it('navegação em subpasta atualiza conteúdo e trilha; clique em nível anterior volta (US 2.1 cenário 1)', async () => {
    const folderA = folder({ id: 'folder-a', name: 'Pasta A' });
    const fileX = file({ id: 'file-x', fileName: 'relatorio.pdf', folderId: 'folder-a' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ folders: [folderA] }) },
      'GET /folders/folder-a/contents': {
        status: 200,
        body: contents({ folder: folderA, files: [fileX] }),
      },
    });

    renderApp(['/pastas']);

    await screen.findByText('Pasta A');
    await userEvent.click(screen.getByRole('link', { name: 'Pasta A' }));

    await screen.findByText('relatorio.pdf');
    expect(screen.queryByRole('link', { name: 'Pasta A' })).not.toBeInTheDocument();
    expect(screen.getByText('Pasta A')).toBeInTheDocument(); // agora só na trilha, sem link

    // "Arquivos" também é item do menu lateral — escopa à trilha (`<nav>`).
    const breadcrumb = screen.getByRole('navigation');
    await userEvent.click(within(breadcrumb).getByRole('link', { name: 'Arquivos' }));

    await screen.findByRole('link', { name: 'Pasta A' });
    expect(screen.queryByText('relatorio.pdf')).not.toBeInTheDocument();
  });

  it('item sem permissão não é listado — a API já filtra por dono-ou-grant (US 2.1 cenário 2)', async () => {
    const visibleFolder = folder({ id: 'folder-v', name: 'Visível' });
    const visibleFile = file({ id: 'file-v', fileName: 'visivel.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': {
        status: 200,
        body: contents({ folders: [visibleFolder], files: [visibleFile] }),
      },
    });

    renderApp(['/pastas']);

    await screen.findByText('Visível');
    await screen.findByText('visivel.pdf');
    // cabeçalho + as 2 linhas retornadas pela API — nada além disso é renderizado.
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('criar pasta e renomear arquivo refletem na listagem (US 2.2 cenário 1)', async () => {
    const newFolder = folder({ id: 'folder-new', name: 'Relatórios' });
    const fileOld = file({ id: 'file-1', fileName: 'antigo.pdf' });
    const fileRenamed = { ...fileOld, fileName: 'novo.pdf' };

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': [
        { status: 200, body: contents({ files: [fileOld] }) },
        { status: 200, body: contents({ folders: [newFolder], files: [fileOld] }) },
        { status: 200, body: contents({ folders: [newFolder], files: [fileRenamed] }) },
      ],
      'POST /folders': { status: 201, body: newFolder },
      'PATCH /files/file-1': { status: 200, body: fileRenamed },
    });

    renderApp(['/pastas']);

    await screen.findByText('antigo.pdf');

    await userEvent.click(screen.getByRole('button', { name: /nova pasta/i }));
    const createDialog = await findDialogByTitle('Nova pasta');
    await userEvent.type(within(createDialog).getByLabelText('Nome'), 'Relatórios');
    await userEvent.click(within(createDialog).getByRole('button', { name: 'Criar' }));

    await screen.findByText('Relatórios');

    // Pasta também ganhou "Renomear" nesta mudança (US 2.3) — escopa à linha
    // do arquivo para não colidir com o botão homônimo da linha da pasta.
    const fileRow = screen.getByText('antigo.pdf').closest('tr')!;
    await userEvent.click(within(fileRow).getByRole('button', { name: /renomear/i }));
    const renameDialog = await findDialogByTitle('Renomear arquivo');
    const nameInput = within(renameDialog).getByLabelText('Nome');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'novo.pdf');
    await userEvent.click(within(renameDialog).getByRole('button', { name: 'Renomear' }));

    await screen.findByText('novo.pdf');
    expect(screen.queryByText('antigo.pdf')).not.toBeInTheDocument();
  });

  it('excluir arquivo e excluir pasta (com confirmação) removem o item da listagem', async () => {
    const folderToDelete = folder({ id: 'folder-del', name: 'Descartável' });
    const fileToDelete = file({ id: 'file-del', fileName: 'temp.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': [
        { status: 200, body: contents({ folders: [folderToDelete], files: [fileToDelete] }) },
        { status: 200, body: contents({ folders: [folderToDelete] }) },
        { status: 200, body: contents() },
      ],
      'DELETE /files/file-del': { status: 204 },
      'DELETE /folders/folder-del': { status: 204 },
    });

    renderApp(['/pastas']);

    await screen.findByText('temp.pdf');

    const fileRow = screen.getByText('temp.pdf').closest('tr')!;
    await userEvent.click(within(fileRow).getByRole('button', { name: /excluir/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, excluir' }));

    await screen.findByText('Descartável');
    expect(screen.queryByText('temp.pdf')).not.toBeInTheDocument();

    const folderRow = screen.getByText('Descartável').closest('tr')!;
    await userEvent.click(within(folderRow).getByRole('button', { name: /excluir/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, excluir' }));

    await waitFor(() => expect(screen.queryByText('Descartável')).not.toBeInTheDocument());
  });

  it('403 em ação de gestão exibe aviso de permissão insuficiente, sem aplicar a mudança (US 2.2 cenário 2)', async () => {
    const fileNoPerm = file({ id: 'file-np', fileName: 'protegido.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileNoPerm] }) },
      'DELETE /files/file-np': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/pastas']);

    await screen.findByText('protegido.pdf');

    const fileRow = screen.getByText('protegido.pdf').closest('tr')!;
    await userEvent.click(within(fileRow).getByRole('button', { name: /excluir/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, excluir' }));

    await screen.findByText('Permissão insuficiente para executar esta ação.');
    expect(screen.getByText('protegido.pdf')).toBeInTheDocument();
  });

  it('deep-link a pasta que responde 403 mostra bloqueio, sem conteúdo (US 4.2 cenário 1)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/folder-blocked/contents': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/pastas/folder-blocked']);

    await screen.findByText('Sem permissão');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('folder-blocked')).not.toBeInTheDocument();
  });

  describe('Mover e renomear pasta (US 2.3, mover-e-renomear-itens)', () => {
    it('renomear pasta com permissão reflete o novo nome na listagem', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });
      const folderRenamed = { ...folderA, name: 'Pasta A Renomeada' };

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': [
          { status: 200, body: contents({ folders: [folderA] }) },
          { status: 200, body: contents({ folders: [folderRenamed] }) },
        ],
        'PATCH /folders/folder-a': { status: 200, body: folderRenamed },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      const row = screen.getByText('Pasta A').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: /renomear/i }));

      const dialog = await findDialogByTitle('Renomear pasta');
      const nameInput = within(dialog).getByLabelText('Nome');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Pasta A Renomeada');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Renomear' }));

      await screen.findByText('Pasta A Renomeada');
      expect(screen.queryByRole('link', { name: 'Pasta A' })).not.toBeInTheDocument();
    });

    it('mover arquivo: navega até uma subpasta no seletor e confirma o destino (US 2.3 cenário 1)', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });
      const fileX = file({ id: 'file-x', fileName: 'relatorio.pdf' });
      const fileMoved = { ...fileX, folderId: 'folder-a' };

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': [
          { status: 200, body: contents({ folders: [folderA], files: [fileX] }) },
          { status: 200, body: contents({ folders: [folderA] }) },
        ],
        'GET /folders/folder-a/contents': {
          status: 200,
          body: contents({ folder: folderA, files: [] }),
        },
        'POST /files/file-x/move': { status: 200, body: fileMoved },
      });

      renderApp(['/pastas']);

      await screen.findByText('relatorio.pdf');
      const row = screen.getByText('relatorio.pdf').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: /mover para/i }));

      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }));

      await within(dialog).findByRole('button', { name: 'Mover para "Pasta A"' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Mover para "Pasta A"' }));

      await waitFor(() => expect(screen.queryByText('relatorio.pdf')).not.toBeInTheDocument());
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const moveCall = calls.find((call) => String(call[0]).includes('/files/file-x/move'));
      expect(moveCall).toBeDefined();
      const body = JSON.parse((moveCall![1] as RequestInit).body as string) as {
        destinationFolderId: string | null;
      };
      expect(body.destinationFolderId).toBe('folder-a');
    });

    it('mover pasta para a raiz: destino nulo é enviado sem navegar', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': [
          { status: 200, body: contents({ folders: [folderA] }) },
          { status: 200, body: contents({ folders: [folderA] }) },
        ],
        'POST /folders/folder-a/move': { status: 200, body: folderA },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      const row = screen.getByText('Pasta A').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: /mover para/i }));

      const dialog = await screen.findByRole('dialog');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Mover para a raiz da unidade' }),
      );

      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const moveCall = calls.find((call) => String(call[0]).includes('/folders/folder-a/move'));
      expect(moveCall).toBeDefined();
      const body = JSON.parse((moveCall![1] as RequestInit).body as string) as {
        destinationFolderId: string | null;
      };
      expect(body.destinationFolderId).toBeNull();
    });

    it('recusa por ciclo é distinguível do aviso de permissão insuficiente (design.md D5 de web-navegacao)', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents({ folders: [folderA] }) },
        'POST /folders/folder-a/move': { status: 409, body: { error: 'folder_cycle' } },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      const row = screen.getByText('Pasta A').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: /mover para/i }));

      const dialog = await screen.findByRole('dialog');
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Mover para a raiz da unidade' }),
      );

      await screen.findByText(
        'Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta dela.',
      );
      // "Pasta A" também aparece no seletor de destino do modal (ainda
      // aberto após a recusa) — escopa à tabela da listagem.
      expect(within(screen.getByRole('table')).getByText('Pasta A')).toBeInTheDocument();
    });

    it('recusa por conflito de nome é distinguível do aviso de ciclo (design.md D5 de web-navegacao)', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents({ folders: [folderA] }) },
        'PATCH /folders/folder-a': { status: 409, body: { error: 'folder_name_conflict' } },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      const row = screen.getByText('Pasta A').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: /renomear/i }));

      const dialog = await findDialogByTitle('Renomear pasta');
      const nameInput = within(dialog).getByLabelText('Nome');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Já Existe');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Renomear' }));

      await screen.findByText('Já existe uma pasta com esse nome no destino.');
      expect(screen.getByText('Pasta A')).toBeInTheDocument();
    });
  });

  describe('Modo estreito (responsividade-mobile-tablet, design.md D4/D5)', () => {
    it('abaixo do limiar, Visualizar permanece direta e as demais ações do arquivo agrupam num menu', async () => {
      mockViewportWidth(NARROW_VIEWPORT);
      const fileX = file({ id: 'file-x', fileName: 'relatorio.pdf' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      });

      renderApp(['/pastas']);

      await screen.findByText('relatorio.pdf');
      const row = screen.getByText('relatorio.pdf').closest('tr')!;

      // Visualizar é o verbo central da consulta e permanece direta.
      expect(within(row).getByRole('button', { name: /visualizar/i })).toBeInTheDocument();
      // As demais não ficam soltas na linha — só o gatilho do menu agrupado.
      expect(within(row).queryByRole('button', { name: /renomear/i })).not.toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: /^baixar$/i })).not.toBeInTheDocument();

      await userEvent.click(within(row).getByRole('button', { name: 'Mais ações' }));

      // O popup do menu agrupado é renderizado fora da linha, num portal
      // (`.ant-dropdown`) — nenhuma ação foi suprimida, só reagrupada ali.
      await screen.findByText(/renomear/i);
      const menu = within(document.querySelector('.ant-dropdown')!);
      expect(menu.getByRole('button', { name: /renomear/i })).toBeInTheDocument();
      expect(menu.getByRole('button', { name: /baixar/i })).toBeInTheDocument();
      expect(menu.getByRole('button', { name: /excluir/i })).toBeInTheDocument();
    });

    it('a confirmação de exclusão continua exigida dentro do menu agrupado', async () => {
      mockViewportWidth(NARROW_VIEWPORT);
      const fileX = file({ id: 'file-x', fileName: 'descartavel.pdf' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': [
          { status: 200, body: contents({ files: [fileX] }) },
          { status: 200, body: contents() },
        ],
        'DELETE /files/file-x': { status: 204 },
      });

      renderApp(['/pastas']);

      await screen.findByText('descartavel.pdf');
      const row = screen.getByText('descartavel.pdf').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Mais ações' }));

      await userEvent.click(await screen.findByRole('button', { name: /excluir/i }));
      // Ainda não excluído: a confirmação do Popconfirm segue exigida.
      expect(screen.getByText('descartavel.pdf')).toBeInTheDocument();

      await userEvent.click(await screen.findByRole('button', { name: 'Sim, excluir' }));
      await waitFor(() => expect(screen.queryByText('descartavel.pdf')).not.toBeInTheDocument());
    });

    it('abaixo do limiar, mover e renomear pasta continuam alcançáveis no menu agrupado', async () => {
      mockViewportWidth(NARROW_VIEWPORT);
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents({ folders: [folderA] }) },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      const row = screen.getByText('Pasta A').closest('tr')!;

      expect(within(row).queryByRole('button', { name: /renomear/i })).not.toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: /mover para/i })).not.toBeInTheDocument();

      await userEvent.click(within(row).getByRole('button', { name: 'Mais ações' }));

      await screen.findByText(/mover para/i);
      const menu = within(document.querySelector('.ant-dropdown')!);
      expect(menu.getByRole('button', { name: /renomear/i })).toBeInTheDocument();
      expect(menu.getByRole('button', { name: /mover para/i })).toBeInTheDocument();
    });

    it('abaixo do limiar, baixar pasta é recusado no acionamento, sem chamar o manifesto (design.md D5)', async () => {
      mockViewportWidth(NARROW_VIEWPORT);
      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents() },
      });

      renderApp(['/pastas']);

      const downloadButton = await screen.findByRole('button', { name: /baixar esta pasta/i });
      await userEvent.click(downloadButton);

      await screen.findByText(
        'Baixar pasta não está disponível neste dispositivo. Use um computador.',
      );

      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const manifestCalled = calls.some((call) => String(call[0]).includes('/download-manifest'));
      expect(manifestCalled).toBe(false);
    });
  });
});
