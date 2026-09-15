import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole, GrantResourceType } from '@gdoc/shared';
import type { FileSummaryResponse, TrashEntryResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

const DAY_MS = 24 * 60 * 60 * 1000;

/** `expiresAt` relativo a agora, em dias — evita depender de hora real do sistema no teste. */
function inDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function trashEntry(
  overrides: Partial<TrashEntryResponse> & { id: string; name: string },
): TrashEntryResponse {
  return {
    type: GrantResourceType.FILE,
    deletedAt: '2026-07-10T10:00:00.000Z',
    expiresAt: inDays(15),
    ...overrides,
  };
}

function fileRestoreResponse(
  overrides: Partial<FileSummaryResponse> & {
    id: string;
    fileName: string;
    redirectedToRoot: boolean;
  },
) {
  return {
    ownerId: 'user-1',
    folderId: null,
    contentType: 'application/pdf',
    sizeBytes: 2048,
    status: 'active',
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('Lixeira da SPA (web-lixeira)', () => {
  it('lista os itens de GET /trash com a Tag de dias restantes correta, inclusive vermelho em ≤3 dias (US 6.1 cenário 1)', async () => {
    const urgente = trashEntry({
      id: 'file-urgente',
      name: 'urgente.pdf',
      expiresAt: inDays(2),
    });
    const tranquilo = trashEntry({
      id: 'file-tranquilo',
      name: 'tranquilo.pdf',
      type: GrantResourceType.FOLDER,
      expiresAt: inDays(25),
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /trash': { status: 200, body: { items: [urgente, tranquilo] } },
    });

    renderApp(['/lixeira']);

    await screen.findByText('urgente.pdf');
    await screen.findByText('tranquilo.pdf');

    const urgenteRow = screen.getByText('urgente.pdf').closest('tr')!;
    const urgenteTag = within(urgenteRow).getByText('2 dia(s)');
    expect(urgenteTag.closest('.ant-tag')).toHaveClass('ant-tag-red');

    const tranquiloRow = screen.getByText('tranquilo.pdf').closest('tr')!;
    const tranquiloTag = within(tranquiloRow).getByText('25 dia(s)');
    expect(tranquiloTag.closest('.ant-tag')).not.toHaveClass('ant-tag-red');
    expect(tranquiloTag.closest('.ant-tag')).not.toHaveClass('ant-tag-orange');
  });

  it('lixeira vazia exibe Empty (spec: lixeira vazia)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /trash': { status: 200, body: { items: [] } },
    });

    renderApp(['/lixeira']);

    await screen.findByText('A lixeira está vazia');
  });

  it('restaurar um arquivo despacha para POST /files/:id/restore, exibe "local de origem" e some da lista (US 6.1 cenário 1)', async () => {
    const entry = trashEntry({ id: 'file-1', name: 'relatorio.pdf', type: GrantResourceType.FILE });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /trash': [
        { status: 200, body: { items: [entry] } },
        { status: 200, body: { items: [] } },
      ],
      'POST /files/file-1/restore': {
        status: 200,
        body: fileRestoreResponse({
          id: 'file-1',
          fileName: 'relatorio.pdf',
          redirectedToRoot: false,
        }),
      },
    });

    renderApp(['/lixeira']);
    await screen.findByText('relatorio.pdf');

    await userEvent.click(screen.getByRole('button', { name: /restaurar/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, restaurar' }));

    await screen.findByText('Arquivo restaurado ao local de origem.');
    await waitFor(() => expect(screen.queryByText('relatorio.pdf')).not.toBeInTheDocument());
  });

  it('restaurar uma pasta despacha para POST /folders/:id/restore e sempre exibe "local de origem" (US 6.1 cenário 1)', async () => {
    const entry = trashEntry({ id: 'folder-1', name: 'Pasta A', type: GrantResourceType.FOLDER });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /trash': [
        { status: 200, body: { items: [entry] } },
        { status: 200, body: { items: [] } },
      ],
      'POST /folders/folder-1/restore': {
        status: 200,
        body: {
          id: 'folder-1',
          unitId: 'unit-1',
          ownerId: 'user-1',
          parentId: null,
          name: 'Pasta A',
          createdAt: '2026-07-01T10:00:00.000Z',
        },
      },
    });

    renderApp(['/lixeira']);
    await screen.findByText('Pasta A');

    await userEvent.click(screen.getByRole('button', { name: /restaurar/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, restaurar' }));

    await screen.findByText('Pasta restaurada ao local de origem.');
    await waitFor(() => expect(screen.queryByText('Pasta A')).not.toBeInTheDocument());
  });

  it('redirectedToRoot: true exibe a mensagem distinta de raiz da unidade (spec: aviso quando o arquivo volta à raiz)', async () => {
    const entry = trashEntry({ id: 'file-2', name: 'orfao.pdf', type: GrantResourceType.FILE });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /trash': [
        { status: 200, body: { items: [entry] } },
        { status: 200, body: { items: [] } },
      ],
      'POST /files/file-2/restore': {
        status: 200,
        body: fileRestoreResponse({ id: 'file-2', fileName: 'orfao.pdf', redirectedToRoot: true }),
      },
    });

    renderApp(['/lixeira']);
    await screen.findByText('orfao.pdf');

    await userEvent.click(screen.getByRole('button', { name: /restaurar/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, restaurar' }));

    await screen.findByText(
      'A pasta de origem não existe mais; o arquivo foi restaurado na raiz da unidade.',
    );
  });

  it('403 na restauração exibe aviso de permissão insuficiente e recarrega a lista (spec: 403 na restauração)', async () => {
    const entry = trashEntry({ id: 'file-3', name: 'protegido.pdf', type: GrantResourceType.FILE });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /trash': [
        { status: 200, body: { items: [entry] } },
        { status: 200, body: { items: [] } },
      ],
      'POST /files/file-3/restore': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/lixeira']);
    await screen.findByText('protegido.pdf');

    await userEvent.click(screen.getByRole('button', { name: /restaurar/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, restaurar' }));

    await screen.findByText('Permissão insuficiente para restaurar este item.');
    await waitFor(() => expect(screen.queryByText('protegido.pdf')).not.toBeInTheDocument());
  });
  /**
   * Esvaziar a lixeira — change `esvaziar-lixeira`. Os números da confirmação
   * vêm de `GET /files/quota` (`trashedFiles`/`trashedBytes`), os mesmos que a
   * rota apaga.
   */
  describe('Esvaziar lixeira', () => {
    const MEGA = 1024 * 1024;

    function quota(trashedFiles: number, trashedBytes: number) {
      return {
        status: 200,
        body: {
          quotaBytes: 10 * 1024 * MEGA,
          usedBytes: trashedBytes,
          trashedBytes,
          trashedFiles,
          pendingBytes: 0,
          availableBytes: 10 * 1024 * MEGA - trashedBytes,
        },
      };
    }

    function purgeRequests(): string[] {
      const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      return calls
        .map(
          ([input, init]) =>
            `${(init as RequestInit | undefined)?.method ?? 'GET'} ${String(input)}`,
        )
        .filter((call) => call.includes('/trash/purge'));
    }

    it('quantifica a troca na confirmação e só envia depois do "sim" (design.md D4)', async () => {
      const entry = trashEntry({ id: 'file-1', name: 'antigo.pdf' });

      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /trash': [
          { status: 200, body: { items: [entry] } },
          { status: 200, body: { items: [] } },
        ],
        'GET /files/quota': [quota(3, 3 * MEGA), quota(0, 0)],
        'POST /trash/purge': {
          status: 200,
          body: { purgedFiles: 3, reclaimedBytes: 3 * MEGA, failedFiles: 0 },
        },
      });

      renderApp(['/lixeira']);

      const botao = await screen.findByRole('button', { name: /esvaziar lixeira/i });
      await userEvent.click(botao);

      // Quantos arquivos, quanto espaço e o aviso de irreversibilidade.
      const confirmacao = await screen.findByText(/3 arquivo\(s\) seu\(s\) serão apagados/i);
      expect(confirmacao).toHaveTextContent('3.0 MB');
      expect(confirmacao).toHaveTextContent(/não tem volta/i);
      // Nada foi enviado só por abrir a confirmação.
      expect(purgeRequests()).toHaveLength(0);

      await userEvent.click(
        await screen.findByRole('button', { name: /sim, apagar definitivamente/i }),
      );

      await screen.findByText(/3 arquivo\(s\) apagado\(s\) permanentemente\. 3\.0 MB/i);
      expect(purgeRequests()).toHaveLength(1);

      // Lixeira e cota reconsultadas: a ação desaparece e a lista esvazia.
      await screen.findByText('A lixeira está vazia');
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: /esvaziar lixeira/i })).not.toBeInTheDocument(),
      );
    });

    it('cancelar não envia nada (design.md D4)', async () => {
      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /trash': { status: 200, body: { items: [trashEntry({ id: 'f', name: 'a.pdf' })] } },
        'GET /files/quota': quota(1, MEGA),
      });

      renderApp(['/lixeira']);

      await userEvent.click(await screen.findByRole('button', { name: /esvaziar lixeira/i }));
      await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

      expect(purgeRequests()).toHaveLength(0);
    });

    it('informa quantos arquivos falharam e continuam na lixeira (tolerância por item)', async () => {
      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /trash': { status: 200, body: { items: [trashEntry({ id: 'f', name: 'a.pdf' })] } },
        'GET /files/quota': quota(2, 2 * MEGA),
        'POST /trash/purge': {
          status: 200,
          body: { purgedFiles: 1, reclaimedBytes: MEGA, failedFiles: 1 },
        },
      });

      renderApp(['/lixeira']);

      await userEvent.click(await screen.findByRole('button', { name: /esvaziar lixeira/i }));
      await userEvent.click(
        await screen.findByRole('button', { name: /sim, apagar definitivamente/i }),
      );

      await screen.findByText(/1 arquivo\(s\) apagado\(s\) permanentemente/i);
      await screen.findByText(/1 arquivo\(s\) não pôde\(puderam\) ser apagado\(s\)/i);
    });

    it('sem arquivo próprio na lixeira a ação não aparece (só pasta não devolve espaço — D1)', async () => {
      mockFetch({
        'GET /auth/me': { status: 200, body: IDENTITY },
        'GET /trash': {
          status: 200,
          body: {
            items: [
              trashEntry({ id: 'folder-1', name: 'Pasta A', type: GrantResourceType.FOLDER }),
            ],
          },
        },
        'GET /files/quota': quota(0, 0),
      });

      renderApp(['/lixeira']);

      await screen.findByText('Pasta A');
      expect(screen.queryByRole('button', { name: /esvaziar lixeira/i })).not.toBeInTheDocument();
    });
  });
});
