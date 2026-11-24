import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';
import { montarPassos } from '../tour/TourGuiado';
import { PASSOS_DO_TOUR } from '../tour/passos';

const MANUAL_URL = 'https://manual.exemplo/';

const PESSOA = {
  id: 'user-1',
  unitId: 'unit-1',
  role: UserRole.COLLABORATOR,
  fullName: 'Maria Silva',
  unitName: 'Unidade Centro',
  tourCompleted: false,
};

function rotas(overrides: Record<string, unknown> = {}, comManual = true) {
  return {
    ...ROTAS_DA_TELA_INICIAL,
    'GET /auth/me': { status: 200, body: { ...PESSOA, ...overrides } },
    ...(comManual
      ? {
          'GET /auth/public-config': {
            status: 200,
            body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
          },
        }
      : {}),
    'POST /auth/tour-completed': { status: 204 },
    'GET /folders/root/contents': {
      status: 200,
      body: { folder: null, breadcrumb: [], folders: [], files: [], canUpload: true },
    },
  };
}

const CONVITE = 'Primeira vez aqui? Faça o tour de 2 minutos';

function chamadas(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.map(
      ([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url), 'http://x').pathname}`,
    );
}

/**
 * Tour guiado (US 11.3, change `tour-guiado`): acionado pelo menu ou pelo
 * convite, só aponta o que está na tela, vale uma vez por pedido e é lembrado
 * por pessoa no servidor.
 */
describe('Tour guiado (capability tour-guiado)', () => {
  it('quem não fez o tour vê o convite à direita da saudação; quem fez não vê', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas());
    const primeira = renderApp(['/']);
    expect(await primeira.findByRole('link', { name: CONVITE })).toHaveAttribute(
      'href',
      '/?tour=1',
    );
    primeira.unmount();

    mockFetch(rotas({ tourCompleted: true }));
    const segunda = renderApp(['/']);
    await segunda.findByText('Pastas da unidade');
    expect(segunda.queryByRole('link', { name: CONVITE })).toBeNull();
  });

  it('o tour não começa sozinho', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas());
    renderApp(['/']);
    await screen.findByText('Pastas da unidade');
    expect(document.querySelector('.ant-tour')).toBeNull();
  });

  it('na forma larga com manual, monta todos os passos — cada um com o seu alvo presente', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas());
    renderApp(['/']);
    await screen.findByText('Pastas da unidade');
    await screen.findByRole('link', { name: /Ajuda/ });

    const passos = montarPassos();
    expect(passos.map((p) => p.title)).toEqual(PASSOS_DO_TOUR.map((p) => p.titulo));
  });

  it('sem manual configurado, o passo da ajuda é omitido e os demais seguem', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas({}, false));
    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const titulos = montarPassos().map((p) => p.title);
    expect(titulos).not.toContain('Ajuda');
    expect(titulos).toHaveLength(PASSOS_DO_TOUR.length - 1);
  });

  it('acionado pelo menu de outra tela, o tour começa no Início e o pedido sai do endereço', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas());
    const { router } = renderApp(['/pastas']);

    await screen.findByRole('button', { name: /Nova pasta/ });
    const menu = document.querySelector('.ant-layout-sider') as HTMLElement;
    const item = await within(menu).findByRole('link', { name: 'Tour guiado' });
    // Acesso auxiliar interno: não anuncia saída da aplicação.
    expect(item.getAttribute('aria-label') ?? '').not.toMatch(/fora da aplicação/);
    await userEvent.click(item);

    expect(await screen.findByText('Menu', { selector: '.ant-tour-title' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await waitFor(() => expect(router.state.location.search).not.toContain('tour'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('fechar o tour registra na conta e tira o convite da saudação', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas());
    renderApp(['/']);

    await userEvent.click(await screen.findByRole('link', { name: CONVITE }));
    await screen.findByText('Menu', { selector: '.ant-tour-title' });
    await userEvent.click(document.querySelector('.ant-tour-close') as HTMLElement);

    await waitFor(() => expect(chamadas()).toContain('POST /auth/tour-completed'));
    await waitFor(() => expect(screen.queryByRole('link', { name: CONVITE })).toBeNull());
  });
});
