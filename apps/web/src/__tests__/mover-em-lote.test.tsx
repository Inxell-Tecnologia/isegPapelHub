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

async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen
      .getAllByRole('dialog')
      .find((el) => el.textContent?.startsWith(title) || el.textContent?.includes(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

function rowCheckbox(text: string): HTMLElement {
  const row = screen.getByText(text).closest('tr')!;
  return within(row).getByRole('checkbox');
}

/**
 * Testes de `mover-itens-em-lote` (US 2.4): seleção múltipla no explorador e
 * mover em lote na SPA — tasks.md seções 6 e 7.
 */
describe('Mover itens em lote (US 2.4, web-navegacao)', () => {
  describe('Seleção múltipla no explorador (design.md D3/D8)', () => {
    it('6.1/6.3: marcar arquivos e pastas juntos mostra a contagem e a barra de ação em lote', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });
      const fileX = file({ id: 'file-x', fileName: 'relatorio.pdf' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': {
          status: 200,
          body: contents({ folders: [folderA], files: [fileX] }),
        },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      expect(screen.queryByRole('button', { name: /mover selecionados/i })).not.toBeInTheDocument();

      await userEvent.click(rowCheckbox('Pasta A'));
      await screen.findByText('1 item selecionado');
      expect(screen.getByRole('button', { name: /mover selecionados/i })).toBeInTheDocument();

      await userEvent.click(rowCheckbox('relatorio.pdf'));
      await screen.findByText('2 itens selecionados');
    });

    it('6.2: seleção é esvaziada ao navegar para uma subpasta', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents({ folders: [folderA] }) },
        'GET /folders/folder-a/contents': { status: 200, body: contents({ folder: folderA }) },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      await userEvent.click(rowCheckbox('Pasta A'));
      await screen.findByText('1 item selecionado');

      await userEvent.click(screen.getByRole('link', { name: 'Pasta A' }));

      await waitFor(() => expect(screen.queryByText('1 item selecionado')).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /mover selecionados/i })).not.toBeInTheDocument();
    });

    it('6.4: seleção permanece alcançável abaixo do ponto de ruptura (design.md D8)', async () => {
      mockViewportWidth(NARROW_VIEWPORT);
      const fileX = file({ id: 'file-x', fileName: 'estreito.pdf' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      });

      renderApp(['/pastas']);

      await screen.findByText('estreito.pdf');
      await userEvent.click(rowCheckbox('estreito.pdf'));
      await screen.findByText('1 item selecionado');
      expect(screen.getByRole('button', { name: /mover selecionados/i })).toBeInTheDocument();
    });
  });

  describe('Mover em lote na SPA (design.md D2/D4/D7)', () => {
    it('7.1: o seletor de destino indica quantos itens serão movidos', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });
      const fileX = file({ id: 'file-x', fileName: 'um.pdf' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': {
          status: 200,
          body: contents({ folders: [folderA], files: [fileX] }),
        },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      await userEvent.click(rowCheckbox('Pasta A'));
      await userEvent.click(rowCheckbox('um.pdf'));
      await screen.findByText('2 itens selecionados');

      await userEvent.click(screen.getByRole('button', { name: /mover selecionados/i }));

      const dialog = await findDialogByTitle('Mover 2 itens para...');
      expect(within(dialog).getByText('2 itens selecionados')).toBeInTheDocument();
    });

    it('7.2/7.5: seleção mista dispara as duas rotas de lote, consolida um aviso e esvazia a seleção', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });
      const folderB = folder({ id: 'folder-b', name: 'Pasta B' });
      const fileX = file({ id: 'file-x', fileName: 'um.pdf' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': [
          {
            status: 200,
            body: contents({ folders: [folderA, folderB], files: [fileX] }),
          },
          { status: 200, body: contents({ folders: [folderB] }) },
        ],
        'GET /folders/folder-b/contents': {
          status: 200,
          body: contents({ folder: folderB }),
        },
        'POST /folders/move': { status: 200, body: { results: [{ id: folderA.id, ok: true }] } },
        'POST /files/move': { status: 200, body: { results: [{ id: fileX.id, ok: true }] } },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      await userEvent.click(rowCheckbox('Pasta A'));
      await userEvent.click(rowCheckbox('um.pdf'));
      await screen.findByText('2 itens selecionados');

      await userEvent.click(screen.getByRole('button', { name: /mover selecionados/i }));
      const dialog = await findDialogByTitle('Mover 2 itens para...');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }));
      await within(dialog).findByRole('button', { name: 'Mover para "Pasta B"' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Mover para "Pasta B"' }));

      await screen.findByText('2 itens movidos com sucesso.');

      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const foldersMoveCall = calls.find((call) => String(call[0]).endsWith('/folders/move'));
      const filesMoveCall = calls.find((call) => String(call[0]).endsWith('/files/move'));
      expect(foldersMoveCall).toBeDefined();
      expect(filesMoveCall).toBeDefined();
      const foldersBody = JSON.parse((foldersMoveCall![1] as RequestInit).body as string);
      const filesBody = JSON.parse((filesMoveCall![1] as RequestInit).body as string);
      expect(foldersBody).toEqual({ ids: [folderA.id], destinationFolderId: folderB.id });
      expect(filesBody).toEqual({ ids: [fileX.id], destinationFolderId: folderB.id });

      // Seleção esvaziada ao fim da operação de lote.
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: /mover selecionados/i }),
        ).not.toBeInTheDocument(),
      );
    });

    it('7.3: falha parcial informa quantos foram movidos e lista os recusados com o motivo', async () => {
      const fileOk = file({ id: 'file-ok', fileName: 'ok.pdf' });
      const fileBlocked = file({ id: 'file-blocked', fileName: 'bloqueado.pdf' });
      const destination = folder({ id: 'folder-dest', name: 'Destino' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': [
          {
            status: 200,
            body: contents({ folders: [destination], files: [fileOk, fileBlocked] }),
          },
          { status: 200, body: contents({ folders: [destination] }) },
        ],
        'GET /folders/folder-dest/contents': {
          status: 200,
          body: contents({ folder: destination }),
        },
        'POST /files/move': {
          status: 200,
          body: {
            results: [
              { id: fileOk.id, ok: true },
              { id: fileBlocked.id, ok: false, error: 'forbidden' },
            ],
          },
        },
      });

      renderApp(['/pastas']);

      await screen.findByText('ok.pdf');
      await userEvent.click(rowCheckbox('ok.pdf'));
      await userEvent.click(rowCheckbox('bloqueado.pdf'));
      await screen.findByText('2 itens selecionados');

      await userEvent.click(screen.getByRole('button', { name: /mover selecionados/i }));
      const dialog = await findDialogByTitle('Mover 2 itens para...');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }));
      await within(dialog).findByRole('button', { name: 'Mover para "Destino"' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Mover para "Destino"' }));

      // Nem sucesso total, nem falha total, com o motivo de cada recusado.
      await screen.findByText('1 de 2 itens movidos.');
      expect(screen.queryByText('2 itens movidos com sucesso.')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Nenhum item foi movido. Verifique a permissão sobre o destino.'),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/bloqueado\.pdf.*permissão insuficiente/)).toBeInTheDocument();
    });

    it('7.4: seleção acima do teto é recusada antes do envio, nada é enviado', async () => {
      const files = Array.from({ length: 101 }, (_, i) =>
        file({ id: `file-${i}`, fileName: `arquivo-${i}.pdf` }),
      );

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': { status: 200, body: contents({ files }) },
      });

      renderApp(['/pastas']);

      await screen.findByText('arquivo-0.pdf');
      // Checkbox de cabeçalho seleciona todas as linhas de uma vez.
      const headerCheckbox = screen.getAllByRole('checkbox')[0]!;
      await userEvent.click(headerCheckbox);
      await screen.findByText('101 itens selecionados');

      // `getByRole('button', { name })` calcula o nome acessível de **todo**
      // botão do DOM, e com 101 linhas de tabela (cada uma com seus próprios
      // botões de ação) isso custava ~17 s — 80% do tempo deste teste, que
      // batia no limite de 30 s em runner carregado. Localizar pelo texto e
      // subir ao botão custa ~0,1 s e continua provando que o acionador é um
      // `button`. Os demais casos deste arquivo usam poucas linhas e seguem
      // com `getByRole`.
      const acaoMover = screen.getByText('Mover selecionados').closest('button');
      expect(acaoMover).toBeInTheDocument();
      await userEvent.click(acaoMover!);

      await screen.findByText(/excede o teto de 100 por operação/);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const moveCalled = calls.some(
        (call) =>
          String(call[0]).endsWith('/files/move') || String(call[0]).endsWith('/folders/move'),
      );
      expect(moveCalled).toBe(false);
    }, 30000);

    it('7.6: escolher como destino uma pasta selecionada não é bloqueado na interface — a recusa vem do servidor', async () => {
      const folderA = folder({ id: 'folder-a', name: 'Pasta A' });
      const folderB = folder({ id: 'folder-b', name: 'Pasta B' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /folders/root/contents': {
          status: 200,
          body: contents({ folders: [folderA, folderB] }),
        },
        'GET /folders/folder-a/contents': { status: 200, body: contents({ folder: folderA }) },
        'POST /folders/move': {
          status: 200,
          body: {
            results: [
              { id: folderA.id, ok: false, error: 'folder_cycle' },
              { id: folderB.id, ok: true },
            ],
          },
        },
      });

      renderApp(['/pastas']);

      await screen.findByText('Pasta A');
      await userEvent.click(rowCheckbox('Pasta A'));
      await userEvent.click(rowCheckbox('Pasta B'));
      await screen.findByText('2 itens selecionados');

      await userEvent.click(screen.getByRole('button', { name: /mover selecionados/i }));
      const dialog = await findDialogByTitle('Mover 2 itens para...');

      // Entrar na própria pasta selecionada não é bloqueado pela interface.
      await userEvent.click(within(dialog).getAllByRole('button', { name: 'Entrar' })[0]!);
      await within(dialog).findByRole('button', { name: 'Mover para "Pasta A"' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Mover para "Pasta A"' }));

      await screen.findByText('1 de 2 itens movidos.');
      expect(screen.getByText(/Pasta A.*ciclo/)).toBeInTheDocument();
    });
  });
});
