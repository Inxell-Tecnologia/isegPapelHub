import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

describe('Identidade visual no shell (identidade-visual)', () => {
  it('identificação do cliente aparece no estado expandido e some no colapsado, mantendo a marca abreviada', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: 'SETES' },
      },
    });
    renderApp(['/']);

    await screen.findByRole('img', { name: 'PapelHub' });
    expect(screen.getByText('SETES')).toBeInTheDocument();

    const trigger = document.querySelector('.ant-layout-sider-trigger') as HTMLElement;
    await userEvent.click(trigger);

    await screen.findByText('PH');
    expect(screen.queryByText('SETES')).not.toBeInTheDocument();
  });

  it('no shell expandido, a logomarca tem nome acessível igual ao nome da aplicação', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': { status: 200, body: { appName: 'PapelHub', clientName: '' } },
    });
    renderApp(['/']);

    expect(await screen.findByRole('img', { name: 'PapelHub' })).toBeInTheDocument();
  });

  it('no shell colapsado, nenhuma logomarca é exibida — só a abreviação em texto', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
      'GET /auth/public-config': { status: 200, body: { appName: 'PapelHub', clientName: '' } },
    });
    renderApp(['/']);

    await screen.findByRole('img', { name: 'PapelHub' });

    const trigger = document.querySelector('.ant-layout-sider-trigger') as HTMLElement;
    await userEvent.click(trigger);

    await screen.findByText('PH');
    expect(screen.queryByRole('img', { name: 'PapelHub' })).not.toBeInTheDocument();
  });
});
