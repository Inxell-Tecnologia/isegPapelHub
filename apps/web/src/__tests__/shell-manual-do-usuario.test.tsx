import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const MANUAL_URL = 'https://carlossalesnaturaltec.github.io/GDoc/';

/**
 * Acesso ao manual como último item da navegação (change
 * `responsividade-mobile-tablet`, design.md D2/D3 — reverte D6/D8 de
 * `acesso-ao-manual-no-shell`, que o colocava em `<Menu>` próprio ao pé) —
 * item presente/ausente conforme `publicConfig.manualUrl`, sempre com
 * `href`/`target`/`rel` corretos, sem participar de `selectedKeys` e com
 * nome acessível anunciando a saída da aplicação — agora a **única**
 * portadora dessa distinção, sem a separação visual de antes.
 *
 * `manualUrl` vazia não é mais um estado alcançável por configuração (change
 * corrige-alcance-do-manual, design.md D3): a API sempre resolve para o
 * endereço canônico quando a implantação não define um override. O ramo
 * `manualUrl ? item : nada` da SPA continua existindo só para a degradação
 * de `GET /auth/public-config` indisponível (`DEFAULT_PUBLIC_CONFIG`) — os
 * dois casos abaixo cobrem essa degradação, não mais "não configurado".
 */
describe('Acesso ao manual como último item da navegação (responsividade-mobile-tablet)', () => {
  it('item presente com href, target e rel corretos quando manualUrl está configurada', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });
    renderApp(['/']);

    const link = await screen.findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    expect(link).toHaveAttribute('href', MANUAL_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('item ausente quando manualUrl chega vazia (degradação de configuração, não mais estado alcançável em produção)', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: '' },
      },
    });
    renderApp(['/']);

    await screen.findByRole('img', { name: 'PapelHub' });
    expect(screen.queryByRole('link', { name: /Manual do usuário/ })).not.toBeInTheDocument();
  });

  it('item ausente quando a configuração pública falha', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': { status: 500 },
    });
    renderApp(['/']);

    await screen.findByRole('img', { name: 'PapelHub' });
    expect(screen.queryByRole('link', { name: /Manual do usuário/ })).not.toBeInTheDocument();
  });

  it('não varia por papel: presente também para unit_admin', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });
    renderApp(['/']);

    expect(
      await screen.findByRole('link', {
        name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
      }),
    ).toBeInTheDocument();
  });

  it('nunca recebe marcação de seleção, em qualquer rota', async () => {
    mockFetch({
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

  it('ocupa a última posição da navegação, depois de todos os destinos internos (design.md D3)', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });
    renderApp(['/']);

    await screen.findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    const labels = Array.from(document.querySelectorAll('.ant-layout-sider .ant-menu-item')).map(
      (el) => el.textContent?.trim(),
    );
    expect(labels[labels.length - 1]).toBe('Manual do usuário');
  });
});
