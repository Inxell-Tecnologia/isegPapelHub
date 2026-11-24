import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';

function rodape(): HTMLElement {
  return document.querySelector('.ant-layout-sider') as HTMLElement;
}

describe('Guarda de rota por papel e shell condicionado ao papel', () => {
  it('collaborator não vê itens de administração e é impedido de acessar /admin/pessoas', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR },
      },
    });
    renderApp(['/admin/pessoas']);

    // guarda por papel: navegado de volta para a home, a tela de admin nunca renderiza
    await screen.findByText('Pastas da unidade');
    expect(screen.queryByText('Novo colaborador')).not.toBeInTheDocument();
    expect(screen.queryByText('Colaboradores')).not.toBeInTheDocument();
    expect(screen.queryByText('Painel')).not.toBeInTheDocument();
    // Papel no rodapé da navegação (cartão do usuário), na linha da função.
    // Conta sem nome: o papel ocupa a linha do nome e a da função.
    expect(within(rodape()).getAllByText('Colaborador').length).toBeGreaterThan(0);
  });

  it('admin da unidade vê os itens de administração e acessa /admin/pessoas', async () => {
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': {
        status: 200,
        body: { id: 'user-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN },
      },
      'GET /users': { status: 200, body: [] },
    });
    renderApp(['/admin/pessoas']);

    await screen.findByText('Novo colaborador');
    expect(screen.getByText('Colaboradores')).toBeInTheDocument();
    expect(screen.getByText('Painel')).toBeInTheDocument();
    expect(within(rodape()).getAllByText('Administrador da unidade').length).toBeGreaterThan(0);
    expect(screen.queryByText('Gestor')).toBeNull();

    // nomenclatura-interface: nenhum literal de tela usa "Pessoa"/"Servidor"
    expect(document.body.textContent).not.toMatch(/pessoa|servidor/i);
  });
});
