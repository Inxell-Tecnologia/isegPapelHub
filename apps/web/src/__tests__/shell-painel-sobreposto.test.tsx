import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, NARROW_VIEWPORT, WIDE_VIEWPORT } from './viewport';
import { LARGURA_NAVEGACAO } from '../app/theme';

const MANUAL_URL = 'https://carlossalesnaturaltec.github.io/GDoc/';
const GLOBAL_ADMIN = { id: 'admin-g', unitId: 'unit-1', role: UserRole.GLOBAL_ADMIN };

function menuItemLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.ant-menu-item')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

/** Rótulos dos grupos, na ordem — NAVEGAÇÃO e AJUDA. */
function groupLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.ant-menu-item-group-title')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

/** Nome apresentado no cartão de identidade do rodapé. */
function identidadeDoRodape(container: HTMLElement): string | null {
  const link = container.querySelector('a[href="/minha-conta"]');
  return link?.getAttribute('title') ?? null;
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
      ...ROTAS_DA_TELA_INICIAL,
    });

    mockViewportWidth(WIDE_VIEWPORT);
    const wide = renderApp(['/pastas']);
    await wide.findByText('PapelHub');
    const sider = wide.container.querySelector('.ant-layout-sider') as HTMLElement;
    const wideItems = menuItemLabels(sider);
    const wideGroups = groupLabels(sider);
    const wideIdentidade = identidadeDoRodape(sider);
    wide.unmount();

    mockViewportWidth(NARROW_VIEWPORT);
    const narrow = renderApp(['/pastas']);
    await userEvent.click(await narrow.findByRole('button', { name: 'Abrir navegação' }));
    await screen.findByRole('link', { name: /manual do usuário/i });
    const painel = document.querySelector('.ant-drawer-content') as HTMLElement;
    const narrowItems = menuItemLabels(painel);

    expect(narrowItems).toEqual(wideItems);
    // A change `menu-lateral-e-barra-superior` acrescentou duas coisas à
    // paridade: os **grupos** e a **identidade no rodapé**. As duas vêm da
    // mesma origem única que os itens — uma segunda composição divergiria em
    // silêncio, que é o risco estrutural que estes casos existem para travar.
    expect(groupLabels(painel)).toEqual(wideGroups);
    expect(wideGroups).toEqual(['NAVEGAÇÃO', 'AJUDA']);
    expect(identidadeDoRodape(painel)).toEqual(wideIdentidade);
    expect(wideIdentidade).toContain('Administrador global');
    // Conjunto de destinos da change `shell-e-inicio`: a busca saiu da
    // navegação (está na barra superior), "Arquivos" virou "Documentos" e
    // "Recentes" entrou. "Compartilhados comigo" entrou com a change
    // `compartilhados-comigo` (fatia A5), junto com o seu destino. O manual
    // segue por último, por estar no grupo AJUDA — Favoritos, Leitura
    // obrigatória e Tour guiado entraram com as fatias A4, C2 e A6.
    expect(wideItems).toEqual([
      'Início',
      'Documentos',
      'Recentes',
      'Favoritos',
      'Compartilhados comigo',
      'Leitura obrigatória',
      'Lixeira',
      'Colaboradores',
      'Painel',
      'Unidades',
      'Manual do usuário',
      'Tour guiado',
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
      ...ROTAS_DA_TELA_INICIAL,
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir navegação' }));
    const drawerLink = await screen.findByRole('link', { name: 'Documentos' });
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
      ...ROTAS_DA_TELA_INICIAL,
    });

    // Fora da Início de propósito: ali o atalho "Manual do usuário" da tela
    // (change `conteudo-da-tela-inicio`) seria um segundo link de mesmo nome.
    renderApp(['/recentes']);
    await screen.findByRole('heading', { name: 'Documentos recentes' });

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir navegação' }));
    const manualLink = await screen.findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    await userEvent.click(manualLink);

    // Não há navegação interna a refletir — a aplicação permanece onde
    // estava, e o painel continua aberto.
    expect(document.querySelector('.ant-drawer-open')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Documentos recentes' })).toBeInTheDocument();
  });

  it('a largura da navegação vem de uma origem única, igual nos dois modos (design.md D1)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
      ...ROTAS_DA_TELA_INICIAL,
    });

    mockViewportWidth(WIDE_VIEWPORT);
    const wide = renderApp(['/pastas']);
    await wide.findByText('PapelHub');
    const sider = wide.container.querySelector('.ant-layout-sider') as HTMLElement;
    // O design system escreve a largura do `Sider` no estilo inline.
    expect(sider.style.width).toBe(`${LARGURA_NAVEGACAO}px`);
    wide.unmount();

    mockViewportWidth(NARROW_VIEWPORT);
    renderApp(['/pastas']);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir navegação' }));
    await screen.findByRole('link', { name: /manual do usuário/i });
    const painel = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement;
    // Antes desta change o painel usava 280 e a coluna a largura padrão, não
    // declarada: dois números para o mesmo menu, de modo que um rótulo podia
    // caber num modo e cortar no outro.
    expect(painel.style.width).toBe(`${LARGURA_NAVEGACAO}px`);
  });

  it('acima do limiar, não há gatilho de navegação no cabeçalho — o Sider permanece como hoje', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      ...ROTAS_DA_TELA_INICIAL,
    });

    renderApp(['/pastas']);
    await screen.findByText('Nova pasta');

    expect(screen.queryByRole('button', { name: 'Abrir navegação' })).not.toBeInTheDocument();
    expect(document.querySelector('.ant-layout-sider')).toBeInTheDocument();
  });
});
