import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, NARROW_VIEWPORT, WIDE_VIEWPORT } from './viewport';
import { APOIO_BUSCA, PISO_LARGURA_BUSCA, TETO_LARGURA_BUSCA } from '../shell/BuscaNoCabecalho';
import { ALTURA_MINIMA_ACIONAMENTO } from '../app/theme';

const IDENTIFICADOR = '66e1b0f2-0000-4000-8000-000000000001';

const COLABORADOR = {
  id: IDENTIFICADOR,
  unitId: 'unit-1',
  role: UserRole.COLLABORATOR,
  fullName: 'Maria Silva',
  unitName: 'Unidade Centro',
};

function destinos(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.ant-menu-item')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function cabecalho(): HTMLElement {
  return document.querySelector('.ant-layout-header') as HTMLElement;
}

function navegacao(): HTMLElement {
  return document.querySelector('.ant-layout-sider') as HTMLElement;
}

/**
 * Identidade real no shell e busca na barra superior (capabilities
 * `web-shell-e-auth` e `web-busca`).
 *
 * Dois requisitos de origem — a proibição do identificador interno em
 * **qualquer** lugar do shell e o acionamento explícito da busca — seguem
 * travados aqui; a change `menu-lateral-e-barra-superior` muda **onde** a
 * identidade é apresentada (do cabeçalho para o rodapé da navegação) e
 * acrescenta o teto de largura e o acionador interno do campo.
 */
describe('Identidade do shell vive no rodapé da navegação (web-shell-e-auth)', () => {
  it('apresenta nome, papel e unidade no rodapé, sem o identificador interno em lugar nenhum do shell', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const rodape = navegacao();
    expect(within(rodape).getByText('Maria Silva')).toBeInTheDocument();
    expect(within(rodape).getByText('MS')).toBeInTheDocument();
    // Função e unidade em linhas próprias (identidade-isetes-e-menu-compacto, D5).
    expect(within(rodape).getByText('Colaborador')).toBeInTheDocument();
    expect(within(rodape).getByText('Unidade Centro')).toBeInTheDocument();

    // Nem o identificador inteiro, nem o fragmento que era exibido antes.
    expect(document.body.textContent).not.toContain(IDENTIFICADOR);
    expect(within(rodape).queryByText('66')).not.toBeInTheDocument();
  });

  /**
   * Função no lugar do papel (change `funcao-e-setor-na-identidade`,
   * design.md D6/D7; resposta 1a do cliente). O cartão é a única superfície do
   * shell que apresenta o dado, então a troca fica contida nele.
   */
  it('o rodapé apresenta a função do cadastro, e o setor no texto íntegro', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { ...COLABORADOR, jobTitle: 'Gerente de Governança', sectorName: 'Governança' },
      },
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const rodape = navegacao();
    // Linhas visíveis: função e unidade, cada uma na sua. O setor **não**
    // entra — não há linha livre no cartão de 264px (design.md D7).
    expect(within(rodape).getByText('Gerente de Governança')).toBeInTheDocument();
    expect(within(rodape).getByText('Unidade Centro')).toBeInTheDocument();
    expect(
      within(rodape).queryByText(/Gerente de Governança · Governança/),
    ).not.toBeInTheDocument();

    // Mas segue alcançável por quem aponta o cartão ou usa leitor de tela.
    const link = within(rodape).getByRole('link', { name: /Minha conta/ });
    expect(link.getAttribute('aria-label')).toContain('Governança');
    expect(link.getAttribute('title')).toContain('Governança');

    // E o rótulo do papel não aparece no lugar da função.
    expect(within(rodape).queryByText(/^Colaborador ·/)).not.toBeInTheDocument();
  });

  it('conta sem função no cadastro recai no rótulo do papel', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: { ...COLABORADOR, jobTitle: '', sectorName: '' } },
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    // Mesmo texto que a listagem de colaboradores e o perfil da própria conta
    // exibem — a origem única é o que `nomenclatura-interface` exige.
    expect(within(navegacao()).getByText('Colaborador')).toBeInTheDocument();
  });

  it('a identidade não ocupa a barra superior', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    expect(within(cabecalho()).queryByText('Maria Silva')).not.toBeInTheDocument();
    expect(within(cabecalho()).queryByText('MS')).not.toBeInTheDocument();
    expect(within(cabecalho()).queryByText('Colaborador')).not.toBeInTheDocument();
  });

  it('conta sem nome recorre a tratamento genérico, nunca ao identificador', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: { ...COLABORADOR, fullName: '' } },
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    // O papel é o tratamento genérico: informação que a pessoa reconhece como
    // sua, ao contrário de um fragmento de uuid.
    const rodape = navegacao();
    expect(within(rodape).getAllByText(/Colaborador/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(IDENTIFICADOR);
    expect(within(rodape).queryByText('66')).not.toBeInTheDocument();
  });

  it('o rodapé dá acesso a Minha conta e a Sair, para qualquer papel', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const rodape = navegacao();
    // Sem exigir acionamento: as duas ações estão visíveis, não escondidas
    // atrás de um menu suspenso.
    expect(within(rodape).getByRole('link', { name: /Minha conta/ })).toBeInTheDocument();
    expect(within(rodape).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('Sair é controle compacto próprio, fora do link de Minha conta, com o alvo de 44 px', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const rodape = navegacao();
    const sair = within(rodape).getByRole('button', { name: 'Sair' });
    const minhaConta = within(rodape).getByRole('link', { name: /Minha conta/ });
    // Irmão do link, nunca dentro dele (design.md D5).
    expect(minhaConta.contains(sair)).toBe(false);
    // Só ícone: o nome vem do `aria-label`, não de texto visível.
    expect(sair.textContent?.trim()).toBe('');
    expect(sair.style.height).toBe('44px');
    expect(sair.style.width).toBe('44px');
  });

  it('nome mais longo que o cartão preserva o valor íntegro no nome acessível', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    const nomeLongo = 'Maria Aparecida Conceição de Albuquerque Mendonça Filha';
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: { ...COLABORADOR, fullName: nomeLongo } },
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const link = within(navegacao()).getByRole('link', { name: /Minha conta/ });
    // O jsdom não tem layout para medir o truncamento; o que se trava aqui é a
    // decisão: o valor íntegro acompanha o cartão para apontador e leitor de
    // tela, de modo que o corte visual nunca é perda de informação.
    expect(link).toHaveAttribute('title', expect.stringContaining(nomeLongo));
  });

  it('colapsada, a navegação mantém a identidade alcançável sem expor o identificador', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    await userEvent.click(screen.getByRole('button', { name: 'Recolher navegação' }));
    await screen.findByRole('button', { name: 'Expandir navegação' });

    const rodape = navegacao();
    expect(within(rodape).getByRole('link', { name: /Minha conta/ })).toBeInTheDocument();
    expect(within(rodape).getByText('MS')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(IDENTIFICADOR);
  });
});

describe('Navegação agrupada por natureza (web-shell-e-auth)', () => {
  it('destinos internos sob NAVEGAÇÃO e o manual sob AJUDA', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: 'https://exemplo/manual' },
      },
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const titulos = Array.from(navegacao().querySelectorAll('.ant-menu-item-group-title')).map(
      (el) => el.textContent?.trim(),
    );
    expect(titulos).toEqual(['NAVEGAÇÃO', 'AJUDA']);
  });

  it('o rótulo de grupo não é acionável e não entra na seleção', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: 'https://exemplo/manual' },
      },
    });

    const { router } = renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const rotulo = navegacao().querySelector('.ant-menu-item-group-title') as HTMLElement;
    // O design system o marca como apresentação — não é item de menu nem
    // destino, então nem recebe seleção nem navega.
    expect(rotulo).toHaveAttribute('role', 'presentation');
    expect(rotulo).not.toHaveClass('ant-menu-item');
    await userEvent.click(rotulo);
    expect(router.state.location.pathname).toBe('/');
  });

  // Com o tour guiado (change `tour-guiado`, design.md D7) o grupo AJUDA nunca
  // fica vazio: sem manual, ele segue com o tour. A regra "grupo sem item não
  // apresenta rótulo" continua no código para grupos futuros.
  it('sem manualUrl, o grupo AJUDA segue só com o tour guiado', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: '' },
      },
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const titulos = Array.from(navegacao().querySelectorAll('.ant-menu-item-group-title')).map(
      (el) => el.textContent?.trim(),
    );
    expect(titulos).toEqual(['NAVEGAÇÃO', 'AJUDA']);
    expect(within(navegacao()).queryByRole('link', { name: /Manual do usuário/ })).toBeNull();
    expect(within(navegacao()).getByRole('link', { name: 'Tour guiado' })).toBeInTheDocument();
  });
});

describe('Ações da barra superior (web-shell-e-auth)', () => {
  it('a ação de envio leva ao explorador com o pedido anunciado, para qualquer papel', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    const { router } = renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    // Oferecida a `collaborator`: permissão de envio é por pasta e vem do
    // servidor, nunca do papel.
    await userEvent.click(within(cabecalho()).getByRole('button', { name: 'Enviar documento' }));
    expect(router.state.location.pathname).toBe('/pastas');

    // O pedido conduz ao **envio em si**, e não a uma tela onde o envio ainda
    // precise ser localizado: a área de envio recebe o foco assim que o
    // veredito do servidor (`canUpload`) chega. O parâmetro sai do endereço
    // depois de atendido — asserção sobre ele seria corrida com o efeito que o
    // consome (change `cartoes-de-atalho-acionaveis`, design.md D5).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Enviar arquivos/i })).toHaveFocus(),
    );
  });

  it('a ajuda da barra aponta para o mesmo recurso do grupo AJUDA, e some sem configuração', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    const MANUAL = 'https://exemplo/manual';
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL },
      },
    });

    const comAjuda = renderApp(['/']);
    await comAjuda.findByText('Pastas da unidade');

    const ajuda = within(cabecalho()).getByRole('link', { name: /^Ajuda/ });
    expect(ajuda).toHaveAttribute('href', MANUAL);
    expect(ajuda).toHaveAttribute('target', '_blank');
    // Nome acessível anuncia a saída da aplicação, como o item do menu.
    expect(ajuda.getAttribute('aria-label')).toContain('fora da aplicação');
    // Mesma origem: o item do menu aponta para o mesmo endereço.
    expect(within(navegacao()).getByRole('link', { name: /Manual do usuário/ })).toHaveAttribute(
      'href',
      MANUAL,
    );
    comAjuda.unmount();

    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: '' },
      },
    });
    renderApp(['/']);
    await screen.findByText('Pastas da unidade');
    expect(within(cabecalho()).queryByRole('link', { name: /^Ajuda/ })).not.toBeInTheDocument();
  });
});

describe('Busca fora da navegação e permanente na barra superior (web-busca)', () => {
  it('a busca não ocupa destino da navegação, nos dois modos de apresentação', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    const largo = renderApp(['/']);
    await largo.findByText('Pastas da unidade');
    const doModoLargo = destinos(navegacao());
    expect(doModoLargo).not.toContain('Buscar');
    expect(doModoLargo).toEqual([
      'Início',
      'Documentos',
      'Recentes',
      'Favoritos',
      'Compartilhados comigo',
      'Leitura obrigatória',
      'Lixeira',
      'Tour guiado',
    ]);
    largo.unmount();

    mockViewportWidth(NARROW_VIEWPORT);
    const estreito = renderApp(['/']);
    await userEvent.click(await estreito.findByRole('button', { name: 'Abrir navegação' }));
    await screen.findByRole('link', { name: 'Documentos' });
    const doPainel = destinos(document.querySelector('.ant-drawer-content') as HTMLElement);
    expect(doPainel).toEqual(doModoLargo);
  });

  it('o campo da barra está presente em qualquer tela autenticada, com o texto de apoio pedido', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /trash': { status: 200, body: { items: [] } },
    });

    renderApp(['/lixeira']);

    // A sessão resolve antes do shell montar: esperar o campo pela árvore
    // inteira e só então afirmar que ele está na barra superior.
    const campo = await screen.findByRole('searchbox', { name: 'Buscar documentos' });
    expect(cabecalho()).toContainElement(campo);
    expect(campo).toHaveAttribute('placeholder', APOIO_BUSCA);
    // O apoio nomeia os três critérios, com a forma do código exemplificada.
    expect(APOIO_BUSCA).toContain('nome');
    expect(APOIO_BUSCA).toContain('PRT-NSP-001');
    expect(APOIO_BUSCA).toContain('palavra-chave');
  });

  it('o acionador fica DENTRO do campo, sem botão adjacente ocupando largura da barra', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    const campo = await screen.findByRole('searchbox', { name: 'Buscar documentos' });

    // O `Input.Search` do design system renderiza o botão num
    // `ant-input-group-addon`, **fora** da caixa do campo — é o que o
    // requisito proíbe. Aqui o acionador é `suffix` do campo.
    expect(cabecalho().querySelector('.ant-input-group-addon')).toBeNull();
    const envoltorio = campo.closest('.ant-input-affix-wrapper') as HTMLElement;
    expect(envoltorio).not.toBeNull();
    expect(within(envoltorio).getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('a largura do campo é teto, não medida fixa', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    const campo = await screen.findByRole('searchbox', { name: 'Buscar documentos' });
    const envoltorio = campo.closest('.ant-input-affix-wrapper') as HTMLElement;

    // O jsdom não tem layout; o que se trava é a decisão de D3 — teto com
    // elasticidade, nunca `width` fixo, que estouraria a barra no limiar de
    // 992px e produziria rolagem horizontal.
    expect(envoltorio.style.maxWidth).toBe(`${TETO_LARGURA_BUSCA}px`);
    expect(envoltorio.style.flex).toContain('1');
    expect(envoltorio.style.width).toBe('');
  });

  // Change `marca-dagua-e-inicio-rodada-3`, design.md D6: medido na app, o
  // campo tinha 66 px e o botão de envio 44. O jsdom não tem layout; trava-se
  // a decisão — caixa de 44 px sem preenchimento vertical e acionador com os
  // mesmos 44 px, estendido sobre a borda.
  it('o campo tem a altura da ação de envio, sem baixar o acionador do piso de 44 px', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    const campo = await screen.findByRole('searchbox', { name: 'Buscar documentos' });
    const envoltorio = campo.closest('.ant-input-affix-wrapper') as HTMLElement;

    expect(envoltorio.style.height).toBe(`${ALTURA_MINIMA_ACIONAMENTO}px`);
    expect(envoltorio.style.paddingBlock).toBe('0px');
    const acionador = within(envoltorio).getByRole('button', { name: 'Buscar' });
    expect(acionador.style.height).toBe(`${ALTURA_MINIMA_ACIONAMENTO}px`);
    expect(acionador.style.marginBlock).toBe('-1px');
  });

  it('digitar no campo não dispara consulta ao servidor — o acionamento permanece explícito', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const campo = within(cabecalho()).getByRole('searchbox', { name: 'Buscar documentos' });

    const chamadasAntes = vi.mocked(globalThis.fetch).mock.calls.length;
    await userEvent.type(campo, 'protocolo');

    const novas = vi
      .mocked(globalThis.fetch)
      .mock.calls.slice(chamadasAntes)
      .map((call) => String(call[0]));
    expect(novas.filter((url) => url.includes('/files/search'))).toEqual([]);
  });

  it('acionar o campo conduz aos resultados com o termo já aplicado, sem redigitar', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /files/search': { status: 200, body: { files: [] } },
    });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const campo = within(cabecalho()).getByRole('searchbox', { name: 'Buscar documentos' });
    await userEvent.type(campo, 'protocolo{Enter}');

    // Chegou à tela de busca com o termo aplicado — e consultado.
    expect(await screen.findByRole('button', { name: /Limpar filtros/ })).toBeInTheDocument();
    const campoDaBusca = screen.getByPlaceholderText('Buscar por nome');
    expect(campoDaBusca).toHaveValue('protocolo');

    const consultas = vi
      .mocked(globalThis.fetch)
      .mock.calls.map((call) => String(call[0]))
      .filter((url) => url.includes('/files/search'));
    expect(consultas.length).toBeGreaterThan(0);
    expect(consultas[0]).toContain('q=protocolo');
  });

  it('acionar pela lupa interna conduz aos resultados, como o Enter', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /files/search': { status: 200, body: { files: [] } },
    });

    const { router } = renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    const campo = within(cabecalho()).getByRole('searchbox', { name: 'Buscar documentos' });
    await userEvent.type(campo, 'protocolo');
    await userEvent.click(within(cabecalho()).getByRole('button', { name: 'Buscar' }));

    expect(router.state.location.pathname).toBe('/busca');
    expect(router.state.location.search).toContain('q=protocolo');
  });

  it('em 375px a barra acomoda o campo sem perder o acionador da navegação', async () => {
    mockViewportWidth(375);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    // O veredito do breakpoint chega um render depois da montagem: esperar a
    // marca do modo estreito antes de afirmar o resto (ver `viewport.ts`).
    const acionador = await screen.findByRole('button', { name: 'Abrir navegação' });

    expect(acionador).toBeInTheDocument();
    const campo = within(cabecalho()).getByRole('searchbox', { name: 'Buscar documentos' });
    expect(campo).toBeInTheDocument();

    // Nada no cabeçalho declara largura em pixel que estouraria a linha: o
    // campo ocupa o espaço restante até o teto. A economia que antes vinha de
    // suprimir o botão adjacente deixou de ser necessária — não há botão
    // adjacente em nenhuma largura (design.md D3).
    const envoltorio = campo.closest('.ant-input-affix-wrapper') as HTMLElement;
    expect(envoltorio.style.width).toBe('');
    expect(cabecalho().querySelector('.ant-input-group-addon')).toBeNull();

    // A identidade não está no cabeçalho em nenhuma largura.
    expect(within(cabecalho()).queryByText('Maria Silva')).not.toBeInTheDocument();
    expect(within(cabecalho()).queryByText('MS')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(IDENTIFICADOR);

    // Piso de largura útil: a medição na app mostrou o campo colapsando para
    // **24px** sem ele — caixa visível em que não se digita.
    expect(envoltorio.style.minWidth).toBe(`${PISO_LARGURA_BUSCA}px`);
  });

  it('em 375px a ação de envio fica só com o ícone, preservando o nome acessível', async () => {
    mockViewportWidth(375);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByRole('button', { name: 'Abrir navegação' });

    // A largura que o rótulo ocupava é o que o campo de busca precisa: a
    // medição em 375px é o que decidiu isto, não a estética.
    const envio = within(cabecalho()).getByRole('button', { name: 'Enviar documento' });
    expect(envio).toBeInTheDocument();
    expect(envio.textContent).toBe('');
  });

  it('em 375px a ajuda sai da barra, e o mesmo recurso continua no painel', async () => {
    mockViewportWidth(375);
    const MANUAL = 'https://exemplo/manual';
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL },
      },
    });

    // Fora da Início: lá o atalho do manual seria um segundo link de mesmo nome.
    renderApp(['/recentes']);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir navegação' }));
    await within(document.querySelector('.ant-drawer') as HTMLElement).findByRole('link', {
      name: /Manual do usuário/,
    });

    // Nenhum acesso é perdido: a ajuda sai da barra pela largura, e o mesmo
    // recurso está a um toque no grupo AJUDA do painel sobreposto.
    expect(within(cabecalho()).queryByRole('link', { name: /^Ajuda/ })).not.toBeInTheDocument();
    const painel = document.querySelector('.ant-drawer-content') as HTMLElement;
    expect(within(painel).getByRole('link', { name: /Manual do usuário/ })).toHaveAttribute(
      'href',
      MANUAL,
    );
  });

  it('a navegação é fixa à viewport, para que o rodapé seja rodapé', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);
    await screen.findByText('Pastas da unidade');

    // Sem isto a coluna cresce com o conteúdo da página e o cartão do rodapé
    // vai parar abaixo da dobra — a medição na app o encontrou em y=977 numa
    // viewport de 900px, isto é, fora da tela.
    expect(navegacao().style.position).toBe('sticky');
    expect(navegacao().style.height).toBe('100vh');
  });
});
