import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';

const MANUAL_URL = 'https://carlossalesnaturaltec.github.io/GDoc/';

/**
 * Acesso ao manual na navegação (change `responsividade-mobile-tablet`,
 * design.md D2/D3 — reverte D6/D8 de `acesso-ao-manual-no-shell`, que o
 * colocava em `<Menu>` próprio ao pé) — item presente/ausente conforme
 * `publicConfig.manualUrl`, sempre com `href`/`target`/`rel` corretos, sem
 * participar de `selectedKeys` e com nome acessível anunciando a saída da
 * aplicação.
 *
 * A change `menu-lateral-e-barra-superior` o reúne no grupo **AJUDA**, de modo
 * que o nome acessível deixa de ser a **única** portadora da distinção — o
 * rótulo do grupo acrescenta a visual. O nome acessível continua obrigatório:
 * afrouxá-lo seria regressão para quem não enxerga a tela. Ele segue sendo o
 * último item da navegação, agora por consequência de AJUDA vir depois de
 * NAVEGAÇÃO.
 *
 * `manualUrl` vazia não é mais um estado alcançável por configuração (change
 * corrige-alcance-do-manual, design.md D3): a API sempre resolve para o
 * endereço canônico quando a implantação não define um override. O ramo
 * `manualUrl ? item : nada` da SPA continua existindo só para a degradação
 * de `GET /auth/public-config` indisponível (`DEFAULT_PUBLIC_CONFIG`) — os
 * dois casos abaixo cobrem essa degradação, não mais "não configurado".
 */
describe('Acesso ao manual no grupo AJUDA da navegação (responsividade-mobile-tablet)', () => {
  it('item presente com href, target e rel corretos quando manualUrl está configurada', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });
    renderApp(['/recentes']);

    const link = await screen.findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    expect(link).toHaveAttribute('href', MANUAL_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('item ausente quando manualUrl chega vazia (degradação de configuração, não mais estado alcançável em produção)', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: '' },
      },
    });
    renderApp(['/recentes']);

    await screen.findByText('PapelHub');
    expect(screen.queryByRole('link', { name: /Manual do usuário/ })).not.toBeInTheDocument();
  });

  it('item ausente quando a configuração pública falha', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': { status: 500 },
    });
    renderApp(['/recentes']);

    await screen.findByText('PapelHub');
    expect(screen.queryByRole('link', { name: /Manual do usuário/ })).not.toBeInTheDocument();
  });

  it('não varia por papel: presente também para unit_admin', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });
    renderApp(['/recentes']);

    expect(
      await screen.findByRole('link', {
        name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
      }),
    ).toBeInTheDocument();
  });

  it('nunca recebe marcação de seleção, em qualquer rota', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });
    renderApp(['/lixeira']);

    const link = await screen.findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    const manualMenuItem = link.closest('.ant-menu-item');
    expect(manualMenuItem).not.toHaveClass('ant-menu-item-selected');
  });

  it('fica no grupo AJUDA, depois de todos os destinos internos e antes do tour (design.md D3)', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });
    renderApp(['/recentes']);

    await screen.findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    const labels = Array.from(document.querySelectorAll('.ant-layout-sider .ant-menu-item')).map(
      (el) => el.textContent?.trim(),
    );
    // O tour guiado (change `tour-guiado`) fecha o grupo AJUDA, depois do manual.
    expect(labels.slice(-2)).toEqual(['Manual do usuário', 'Tour guiado']);
  });
});
