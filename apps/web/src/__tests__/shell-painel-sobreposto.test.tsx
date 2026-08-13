import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, NARROW_VIEWPORT, WIDE_VIEWPORT } from './viewport';

const MANUAL_URL = 'https://carlossalesnaturaltec.github.io/GDoc/';
const GLOBAL_ADMIN = { id: 'admin-g', unitId: 'unit-1', role: UserRole.GLOBAL_ADMIN };

function menuItemLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.ant-menu-item')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

/**
 * Painel sobreposto e origem única de itens (design.md D2/D3 de
 * `responsividade-mobile-tablet`) — o risco estrutural desta change é os
 * dois contêineres de navegação divergirem em silêncio; os testes abaixo
 * travam a paridade e os dois comportamentos do painel.
 */
describe('Painel sobreposto de navegação (responsividade-mobile-tablet)', () => {
  it('mesmo papel (global_admin), os dois contêineres oferecem os mesmos itens, na mesma ordem (design.md D2)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
      'GET /folders/root/contents': {
        status: 200,
        body: { folder: null, breadcrumb: [], folders: [], files: [] },
      },
    });

    mockViewportWidth(WIDE_VIEWPORT);
    const wide = renderApp(['/pastas']);
    await wide.findByRole('img', { name: 'PapelHub' });
    const wideItems = menuItemLabels(wide.container.querySelector('.ant-layout-sider')!);
    wide.unmount();

    mockViewportWidth(NARROW_VIEWPORT);
    const narrow = renderApp(['/pastas']);
    await userEvent.click(await narrow.findByRole('button', { name: 'Abrir navegação' }));
    await screen.findByRole('link', { name: /manual do usuário/i });
    const narrowItems = menuItemLabels(
      document.querySelector('.ant-drawer-content') as HTMLElement,
    );

    expect(narrowItems).toEqual(wideItems);
    expect(wideItems).toEqual([
      'Início',
      'Arquivos',
      'Buscar',
      'Lixeira',
      'Pessoas',
      'Painel',
      'Unidades',
      'Manual do usuário',
    ]);
  });

  it('acionar um destino interno no painel sobreposto navega e fecha o painel', async () => {
    mockViewportWidth(NARROW_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
      'GET /folders/root/contents': {
        status: 200,
        body: { folder: null, breadcrumb: [], folders: [], files: [] },
      },
    });

    renderApp(['/']);
    await screen.findByText('Bem-vindo ao PapelHub');

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir navegação' }));
    const drawerLink = await screen.findByRole('link', { name: 'Arquivos' });
    await userEvent.click(drawerLink);

    await screen.findByText('Nova pasta');
    expect(document.querySelector('.ant-drawer-open')).not.toBeInTheDocument();
  });

  it('acionar o manual no painel sobreposto não fecha o painel — abre outra aba', async () => {
    mockViewportWidth(NARROW_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
      'GET /folders/root/contents': {
        status: 200,
        body: { folder: null, breadcrumb: [], folders: [], files: [] },
      },
    });

    renderApp(['/']);
    await screen.findByText('Bem-vindo ao PapelHub');

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir navegação' }));
    const manualLink = await screen.findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    await userEvent.click(manualLink);

    // Não há navegação interna a refletir — a aplicação permanece na Início,
    // e o painel continua aberto.
    expect(document.querySelector('.ant-drawer-open')).toBeInTheDocument();
    expect(screen.getByText('Bem-vindo ao PapelHub')).toBeInTheDocument();
  });

  it('acima do limiar, não há gatilho de navegação no cabeçalho — o Sider permanece como hoje', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /folders/root/contents': {
        status: 200,
        body: { folder: null, breadcrumb: [], folders: [], files: [] },
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('Nova pasta');

    expect(screen.queryByRole('button', { name: 'Abrir navegação' })).not.toBeInTheDocument();
    expect(document.querySelector('.ant-layout-sider')).toBeInTheDocument();
  });
});
