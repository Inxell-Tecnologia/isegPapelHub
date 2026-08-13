import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { LOGIN_BACKGROUND_COLOR } from '../auth/LoginPage';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

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
      'GET /auth/me': { status: 401 },
      'POST /auth/login': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await fillAndSubmit('ana@example.com', 'senha-correta');

    await screen.findByText('Bem-vindo ao PapelHub');
  });

  it('credenciais inválidas mostram mensagem genérica e permanecem no login (cenário 2)', async () => {
    mockFetch({
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
      'GET /auth/me': { status: 401 },
      'POST /auth/login': { status: 403, body: { error: 'account disabled' } },
    });
    renderApp(['/login']);

    await screen.findByRole('heading', { name: 'PapelHub' });
    await fillAndSubmit('ana@example.com', 'senha-correta');

    await screen.findByText('Esta conta está desativada. Procure a administração.');
    expect(screen.queryByText('E-mail ou senha inválidos.')).not.toBeInTheDocument();
  });
});

describe('Identidade visual na tela de login (identidade-visual)', () => {
  it('identificação do cliente configurada aparece abaixo do heading, que mantém o nome acessível puro', async () => {
    mockFetch({
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

  it('sem identificação de cliente configurada, nenhum subtítulo aparece e o login segue funcional', async () => {
    mockFetch({
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
    await screen.findByText('Bem-vindo ao PapelHub');
  });

  it('falha ao obter a identidade visual não bloqueia o bootstrap nem o login', async () => {
    mockFetch({
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
    await screen.findByText('Bem-vindo ao PapelHub');
  });

  it('título do documento compõe "PapelHub - SETES" com identificação configurada', async () => {
    mockFetch({
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

  it('aplica a cor de marca como fundo da tela de login', async () => {
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    const card = (await screen.findByRole('heading', { name: 'PapelHub' })).closest('.ant-card');
    const background = card?.parentElement;

    expect(background?.style.backgroundColor).toBe(hexToRgb(LOGIN_BACKGROUND_COLOR));
  });

  it('o cartão de acesso é fluido com teto, sem largura fixa que estoure telas estreitas', async () => {
    mockFetch({ 'GET /auth/me': { status: 401 } });
    renderApp(['/login']);

    const card = (await screen.findByRole('heading', { name: 'PapelHub' })).closest(
      '.ant-card',
    ) as HTMLElement;

    expect(card.style.width).toBe('100%');
    expect(card.style.maxWidth).toBe('360px');
  });
});
