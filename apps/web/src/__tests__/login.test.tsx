import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { LOGIN_BACKGROUND_COLOR } from '../auth/LoginPage';
import { paleta } from '../app/theme';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { WIDE_VIEWPORT, mockViewportWidth } from './viewport';

/** Converte hex `#rrggbb` para o formato `rgb(r, g, b)` que o jsdom normaliza em `style.backgroundColor`. */
function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('Login (US 1.2)', () => {
  it('credenciais válidas navegam ao shell autenticado (cenário 1)', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'POST /auth/login': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await fillAndSubmit('ana@example.com', 'senha-correta');

    await screen.findByText('Pastas da unidade');
  });

  it('credenciais inválidas mostram mensagem genérica e permanecem no login (cenário 2)', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'POST /auth/login': { status: 401, body: { error: 'invalid credentials' } },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await fillAndSubmit('ana@example.com', 'senha-errada');

    await screen.findByText('E-mail ou senha inválidos.');
    expect(screen.getByRole('heading', { name: 'PapelHub' })).toBeInTheDocument();
  });

  it('conta desativada mostra aviso específico, distinto da mensagem genérica (cenário 3)', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'POST /auth/login': { status: 403, body: { error: 'account disabled' } },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await fillAndSubmit('ana@example.com', 'senha-correta');

    await screen.findByText('Esta conta está desativada. Procure a administração.');
    expect(screen.queryByText('E-mail ou senha inválidos.')).not.toBeInTheDocument();
  });

  it('recusa por falta de capacidade (429) orienta a tentar de novo, sem acusar a credencial', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      // O 429 do Cloud Run não traz JSON nosso — o corpo é o `Rate
      // exceeded.` em texto puro do Google Front End.
      'POST /auth/login': { status: 429 },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await fillAndSubmit('ana@example.com', 'senha-correta');

    await screen.findByText(
      'Serviço momentaneamente indisponível. Tente novamente em alguns instantes.',
    );
    expect(screen.queryByText('E-mail ou senha inválidos.')).not.toBeInTheDocument();
  });
});

describe('Identidade visual na tela de login (identidade-visual)', () => {
  it('identificação do cliente configurada aparece abaixo do heading, que mantém o nome acessível puro', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: 'SETES', manualUrl: '' },
      },
    });
    renderApp(['/login']);

    await screen.findByText('SETES');
    expect(screen.getByRole('heading', { name: 'PapelHub' })).toBeInTheDocument();
  });

  it("a marca d'água da área principal não aparece no login (só no shell autenticado)", async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: 'SETES', manualUrl: '' },
      },
    });
    renderApp(['/login']);

    await screen.findByText('SETES');
    expect(document.querySelector('[data-marca-dagua-area-principal]')).toBeNull();
  });

  it('sem identificação de cliente configurada, nenhum subtítulo aparece e o login segue funcional', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: '' },
      },
      'POST /auth/login': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    expect(screen.queryByText('SETES')).not.toBeInTheDocument();

    await fillAndSubmit('ana@example.com', 'senha-correta');
    await screen.findByText('Pastas da unidade');
  });

  it('falha ao obter a identidade visual não bloqueia o bootstrap nem o login', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': { status: 500, body: { error: 'unavailable' } },
      'POST /auth/login': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    expect(screen.queryByText('SETES')).not.toBeInTheDocument();

    await fillAndSubmit('ana@example.com', 'senha-correta');
    await screen.findByText('Pastas da unidade');
  });

  it('título do documento compõe "PapelHub - SETES" com identificação configurada', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: 'SETES', manualUrl: '' },
      },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await waitFor(() => expect(document.title).toBe('PapelHub - SETES'));
  });

  it('sem identificação de cliente, o título do documento permanece "PapelHub"', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: '' },
      },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await waitFor(() => expect(document.title).toBe('PapelHub'));
  });

  // Recomposto em dois campos (change `identidade-visual-isetes`, design.md
  // D4): o heading saiu do cartão para o campo escuro, então o fundo deixou
  // de ser o pai do cartão — a composição é que é a moldura dos dois campos.
  it('aplica a cor de marca da paleta como fundo da composição e também ao elemento raiz', async () => {
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    const heading = await screen.findByRole('heading', { name: 'PapelHub' });
    const composicao = heading.closest('div[style*="min-height"]') as HTMLElement | null;

    expect(composicao?.style.backgroundColor).toBe(hexToRgb(LOGIN_BACKGROUND_COLOR));
    // design.md D4: a raiz continua com uma cor só — é dela que a rolagem
    // elástica do iOS revela o fundo, e ela segue azul-marinho.
    expect(document.documentElement.style.backgroundColor).toBe(hexToRgb(LOGIN_BACKGROUND_COLOR));
  });

  it('a cor de marca vem da paleta da identidade, não mais da amostragem da arte', async () => {
    expect(LOGIN_BACKGROUND_COLOR).toBe(paleta.marinhoEscuro);
  });

  it('o cartão de acesso é fluido com teto, sem largura fixa que estoure telas estreitas', async () => {
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    const card = document.querySelector('.ant-card') as HTMLElement;

    expect(card.style.width).toBe('100%');
    expect(card.style.maxWidth).toBe('360px');
  });

  it('a logomarca permanece contida no campo escuro, e não solta sobre o cartão claro', async () => {
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    const heading = await screen.findByRole('heading', { name: 'PapelHub' });
    const logo = document.querySelector('img[src="/isetes-logo-branca.png"]') as HTMLElement;
    const campoEscuro = heading.parentElement as HTMLElement;

    expect(campoEscuro.contains(logo)).toBe(true);
    expect(logo.closest('.ant-card')).toBeNull();
    // Decorativa no login (design.md D3): o heading e a identificação do
    // cliente já estão em texto, e a logo não ganha nome acessível.
    expect(logo.getAttribute('alt')).toBe('');
  });
});

describe('Composição em dois campos da tela de login (identidade-visual)', () => {
  it('em tela larga apresenta, ao lado do cartão, a proposta de valor do produto', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    expect(screen.getByText(/repositório de documentos da sua instituição/i)).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('o conteúdo de apresentação não varia por quem acessa — é constante versionada', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: 'SETES', manualUrl: '', supportContact: '' },
      },
    });
    const primeira = renderApp(['/login']);
    await screen.findByRole('heading', { name: 'PapelHub' });
    const textoPrimeira = screen.getByText(
      /repositório de documentos da sua instituição/i,
    ).textContent;
    primeira.unmount();

    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: 'OUTRA', manualUrl: '', supportContact: '' },
      },
    });
    renderApp(['/login']);
    await screen.findByRole('heading', { name: 'PapelHub' });

    expect(screen.getByText(/repositório de documentos da sua instituição/i).textContent).toBe(
      textoPrimeira,
    );
  });

  it('em 375px os campos empilham, o cartão permanece alcançável e não há rolagem horizontal', async () => {
    mockViewportWidth(375);
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    const heading = await screen.findByRole('heading', { name: 'PapelHub' });
    const composicao = heading.closest('div[style*="min-height"]') as HTMLElement;

    // Empilhamento: a composição passa a coluna, e o cartão de acesso segue
    // presente e fluido — sem largura fixa que force rolagem horizontal.
    expect(composicao.style.flexDirection).toBe('column');
    const card = document.querySelector('.ant-card') as HTMLElement;
    expect(card.style.width).toBe('100%');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();

    // O conteúdo de apresentação não empurra o cartão para fora da área
    // visível: no modo estreito a tela apresenta a marca, não o texto longo.
    expect(
      screen.queryByText(/repositório de documentos da sua instituição/i),
    ).not.toBeInTheDocument();
  });
});

describe('Aviso de contato do suporte na tela de login (identidade-visual)', () => {
  it('contato configurado é apresentado como orientação a quem tem dificuldade para entrar', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: {
          appName: 'PapelHub',
          clientName: '',
          manualUrl: '',
          supportContact: 'suporte@setes.org.br',
        },
      },
    });
    renderApp(['/login']);

    await screen.findByText(/Fale com o suporte: suporte@setes.org.br/);
  });

  it('sem contato configurado, nenhum aviso é exibido e o login segue plenamente funcional', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 401 },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: '', supportContact: '' },
      },
      'POST /auth/login': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    expect(screen.queryByText(/Fale com o suporte/)).not.toBeInTheDocument();

    await fillAndSubmit('ana@example.com', 'senha-correta');
    await screen.findByText('Pastas da unidade');
  });

  // O contato do suporte é o caminho que **de fato** redefine a senha: não há
  // auto-atendimento no servidor, e a tela não oferece controle inerte.
  it('a tela não oferece "manter conectado" nem "esqueci minha senha"', async () => {
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });

    expect(screen.queryByText(/manter.{0,3}(me)? conectad/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/esqueci|esqueceu|recuperar senha|redefinir senha/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /senha/i })).toBeNull();
  });
});
