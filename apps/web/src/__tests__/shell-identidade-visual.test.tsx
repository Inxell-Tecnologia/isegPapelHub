import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, NARROW_VIEWPORT, WIDE_VIEWPORT } from './viewport';
import { ATIVOS_DA_MARCA } from '../shell/BrandMark';
import { OPACIDADE_MARCA_DAGUA_AREA_PRINCIPAL } from '../shell/MarcaDaguaDaAreaPrincipal';
import {
  CLASSE_SOMENTE_LEITOR,
  ESTILO_GLOBAL,
  LARGURA_NAVEGACAO,
  LARGURA_NAVEGACAO_COLAPSADA,
} from '../app/theme';

/**
 * Marca do shell (capability `identidade-visual`), na forma da change
 * `identidade-isetes-e-menu-compacto`:
 *
 * - expandida: a logo branca do Instituto SETES (anunciada pelo nome da
 *   organização, por ter texto escrito), "PapelHub" e o descritor em texto,
 *   sem a linha da identificação do cliente (design.md D3);
 * - colapsada: o símbolo, anunciado como PapelHub;
 * - controle de recolher no **topo** da coluna, não no pé (design.md D4);
 * - marca d'água decorativa no pé, só na expandida (design.md D6).
 *
 * `coluna()` só pode ser chamada **depois** de esperar o nome pela árvore
 * inteira: a coluna lateral não existe antes de `GET /auth/me` resolver.
 */
function coluna(): HTMLElement {
  return document.querySelector('.ant-layout-sider') as HTMLElement;
}

function marca(): HTMLElement {
  return coluna().querySelector('[data-marca]') as HTMLElement;
}

function configComCliente(clientName: string) {
  return {
    ...ROTAS_DA_TELA_INICIAL,
    'GET /auth/me': {
      status: 200,
      body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
    },
    'GET /auth/public-config': {
      status: 200,
      body: { appName: 'PapelHub', clientName, manualUrl: '' },
    },
  };
}

async function recolher() {
  await userEvent.click(screen.getByRole('button', { name: 'Recolher navegação' }));
  await screen.findByRole('button', { name: 'Expandir navegação' });
}

describe('Identidade visual no shell (identidade-visual)', () => {
  it('expandida: logo da organização, nome do produto uma vez e descritor, sem repetir o cliente', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente('SETES'));
    renderApp(['/']);

    await screen.findByText('PapelHub');

    const logo = within(marca()).getByRole('img', { name: 'Instituto SETES' });
    expect(logo).toHaveAttribute('src', ATIVOS_DA_MARCA.logo.src);
    // 150 px de largura (demanda nº 2), altura pela proporção do ativo.
    expect(logo).toHaveAttribute('width', '150');
    // O nome do produto é anunciado uma única vez — pelo texto.
    expect(within(marca()).getAllByText('PapelHub')).toHaveLength(1);
    expect(within(marca()).queryByRole('img', { name: 'PapelHub' })).not.toBeInTheDocument();
    expect(within(marca()).getByText('Gestão de Documentos')).toBeInTheDocument();
    // A logo já identifica a organização: a linha "SETES" não se repete.
    expect(within(marca()).queryByText('SETES')).not.toBeInTheDocument();
  });

  it('a logomarca não tem moldura própria: é a imagem transparente, direto sobre o degradê', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente(''));
    renderApp(['/']);

    await screen.findByText('PapelHub');
    const logo = within(marca()).getByRole('img', { name: 'Instituto SETES' });
    expect(logo.parentElement?.style.background ?? '').toBe('');
    expect(document.querySelector('img[src="/logo-papelhub.jpg"]')).toBeNull();
  });

  it('colapsada: só o símbolo, anunciado como PapelHub, sem logo, descritor nem cliente', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente('SETES'));
    renderApp(['/']);

    await screen.findByText('PapelHub');
    await recolher();

    const simbolo = within(marca()).getByRole('img', { name: 'PapelHub' });
    expect(simbolo).toHaveAttribute('src', ATIVOS_DA_MARCA.simbolo.src);
    expect(
      within(coluna()).queryByRole('img', { name: 'Instituto SETES' }),
    ).not.toBeInTheDocument();
    expect(within(coluna()).queryByText('Gestão de Documentos')).not.toBeInTheDocument();
    expect(within(coluna()).queryByText('SETES')).not.toBeInTheDocument();
  });
});

describe('Controle de recolher no topo da navegação (web-shell-e-auth)', () => {
  it('fica junto da marca, alterna o nome com o estado e o gatilho do pé não existe', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente(''));
    renderApp(['/']);

    await screen.findByText('PapelHub');
    const recolherBotao = screen.getByRole('button', { name: 'Recolher navegação' });
    expect(marca().contains(recolherBotao)).toBe(true);
    expect(document.querySelector('.ant-layout-sider-trigger')).toBeNull();

    await recolher();
    const expandir = screen.getByRole('button', { name: 'Expandir navegação' });
    expect(marca().contains(expandir)).toBe(true);
    await userEvent.click(expandir);
    expect(await screen.findByRole('button', { name: 'Recolher navegação' })).toBeInTheDocument();
  });

  it('o painel sobreposto (modo estreito) não oferece o controle de recolher', async () => {
    mockViewportWidth(NARROW_VIEWPORT);
    mockFetch(configComCliente(''));
    renderApp(['/']);

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir navegação' }));
    await screen.findByText('Gestão de Documentos');
    expect(screen.queryByRole('button', { name: 'Recolher navegação' })).not.toBeInTheDocument();
  });

  it('só a lista de itens rola: marca e cartão ficam fora do contêiner rolável', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente(''));
    renderApp(['/']);

    await screen.findByText('PapelHub');
    const menu = coluna().querySelector('.ant-menu') as HTMLElement;
    expect(menu.style.overflowY).toBe('auto');
    expect(menu.contains(marca())).toBe(false);
    const minhaConta = within(coluna()).getByRole('link', { name: /Minha conta/ });
    expect(menu.contains(minhaConta)).toBe(false);
  });
});

describe("Marca d'água no pé da navegação (identidade-visual)", () => {
  it('é decorativa, não captura o ponteiro e some na navegação colapsada', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente(''));
    renderApp(['/']);

    await screen.findByText('PapelHub');
    const marcaDagua = coluna().querySelector('[data-marca-dagua]') as HTMLImageElement;
    expect(marcaDagua).not.toBeNull();
    expect(marcaDagua.getAttribute('alt')).toBe('');
    expect(marcaDagua).toHaveAttribute('aria-hidden', 'true');
    expect(marcaDagua.style.pointerEvents).toBe('none');
    expect(marcaDagua.getAttribute('src')).toBe(ATIVOS_DA_MARCA.simbolo.src);

    await recolher();
    expect(coluna().querySelector('[data-marca-dagua]')).toBeNull();
  });
});

/**
 * Change `marca-dagua-e-inicio-rodada-3` (`identidade-visual`, "Marca d'água do
 * símbolo na área principal"; design.md D1).
 */
describe("Marca d'água da área principal (identidade-visual)", () => {
  function marcaDagua(): HTMLElement | null {
    return document.querySelector('[data-marca-dagua-area-principal]');
  }

  it('aparece em mais de uma tela, decorativa, sem capturar o ponteiro e a 6%', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente('SETES'));
    const inicio = renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const camada = marcaDagua()!;
    expect(camada).not.toBeNull();
    expect(camada).toHaveAttribute('aria-hidden', 'true');
    expect(camada.style.pointerEvents).toBe('none');
    expect(camada.style.position).toBe('fixed');
    expect(camada.style.overflow).toBe('hidden');
    const img = camada.querySelector('img')!;
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('src', ATIVOS_DA_MARCA.simbolo.src);
    expect(img.style.opacity).toBe(String(OPACIDADE_MARCA_DAGUA_AREA_PRINCIPAL));
    // Atrás do conteúdo.
    const conteudo = document.querySelector('.ant-layout-content') as HTMLElement;
    expect(Number(conteudo.style.zIndex)).toBeGreaterThan(Number(camada.style.zIndex));
    inicio.unmount();

    mockFetch(configComCliente('SETES'));
    renderApp(['/pastas']);
    await screen.findByRole('button', { name: /^Notificações/ });
    expect(marcaDagua()).not.toBeNull();
  });

  it('acompanha a largura da navegação: expandida, colapsada e modo estreito', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente('SETES'));
    const largo = renderApp(['/']);
    await screen.findByText('Pastas da unidade');
    expect(marcaDagua()!.style.left).toBe(`${LARGURA_NAVEGACAO}px`);
    await userEvent.click(screen.getByRole('button', { name: 'Recolher navegação' }));
    expect(marcaDagua()!.style.left).toBe(`${LARGURA_NAVEGACAO_COLAPSADA}px`);
    largo.unmount();

    mockViewportWidth(NARROW_VIEWPORT);
    mockFetch(configComCliente('SETES'));
    renderApp(['/']);
    await screen.findByText('Pastas da unidade');
    expect(marcaDagua()!.style.left).toBe('0px');
  });
});

/**
 * Change `marca-dagua-e-inicio-rodada-3` (`web-shell-e-auth`, "Navegação
 * colapsada não apresenta rótulo de grupo cortado"; design.md D10).
 */
describe('Rótulo de grupo na navegação colapsada (web-shell-e-auth)', () => {
  it('colapsada, o rótulo fica só para tecnologia assistiva; expandida, volta inteiro', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(configComCliente('SETES'));
    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const titulos = () =>
      Array.from(coluna().querySelectorAll('.ant-menu-item-group-title')) as HTMLElement[];
    expect(titulos().map((t) => t.textContent)).toEqual(['NAVEGAÇÃO', 'AJUDA']);
    expect(titulos().some((t) => t.querySelector(`.${CLASSE_SOMENTE_LEITOR}`))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Recolher navegação' }));
    // O texto continua no DOM (nome do grupo), oculto só visualmente.
    expect(titulos().map((t) => t.textContent)).toEqual(['NAVEGAÇÃO', 'AJUDA']);
    for (const titulo of titulos()) {
      expect(titulo.querySelector(`.${CLASSE_SOMENTE_LEITOR}`)).not.toBeNull();
    }
    expect(ESTILO_GLOBAL).toContain('.ant-menu-inline-collapsed .ant-menu-item-group-title::after');

    await userEvent.click(screen.getByRole('button', { name: 'Expandir navegação' }));
    expect(titulos().some((t) => t.querySelector(`.${CLASSE_SOMENTE_LEITOR}`))).toBe(false);
  });
});
