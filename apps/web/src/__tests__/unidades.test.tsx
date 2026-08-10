import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UnitStatus, UserRole } from '@gdoc/shared';
import type { UnitResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const GLOBAL_ADMIN = { id: 'admin-g', unitId: 'unit-1', role: UserRole.GLOBAL_ADMIN };
const UNIT_ADMIN = { id: 'admin-u', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };

function unit(overrides: Partial<UnitResponse> & { id: string; name: string }): UnitResponse {
  return {
    status: UnitStatus.ACTIVE,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Mesma limitação de `useId`: localiza o diálogo pelo título, não por role+name. */
async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.startsWith(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

function requestBodies(method: string, path: string): unknown[] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(
      (call) =>
        String(call[0]).includes(path) && (call[1] as RequestInit | undefined)?.method === method,
    )
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

function confirmButton(label: string): HTMLElement {
  const button = screen.getAllByRole('button').find((b) => b.textContent === label);
  if (!button) throw new Error(`botão "${label}" não encontrado`);
  return button;
}

describe('Gestão de unidades da SPA (web-unidades)', () => {
  it('global_admin lista as unidades com nome e status; não há ação de exclusão (spec: global_admin lista / não há exclusão permanente)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': {
        status: 200,
        body: [
          unit({ id: 'u-1', name: 'Administração' }),
          unit({ id: 'u-2', name: 'Unidade Desativada', status: UnitStatus.DISABLED }),
        ],
      },
    });

    renderApp(['/admin/unidades']);

    await screen.findByText('Administração');
    const rowAtiva = screen.getByText('Administração').closest('tr')!;
    expect(within(rowAtiva).getByText('Ativa')).toBeInTheDocument();

    const rowInativa = screen.getByText('Unidade Desativada').closest('tr')!;
    expect(within(rowInativa).getByText('Desativada')).toBeInTheDocument();

    // não há ação de exclusão permanente
    expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();
  });

  it('unit_admin não acessa a página de unidades (spec: guarda de papel bloqueia a rota)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
    });

    renderApp(['/admin/unidades']);

    // guarda de papel redireciona para a home; a gestão de unidades nunca renderiza
    await screen.findByText('Bem-vindo ao PapelHub');
    expect(screen.queryByText('Nova unidade')).not.toBeInTheDocument();
    expect(screen.queryByText('Unidades')).not.toBeInTheDocument();
  });

  it('criar unidade chama POST /units, fecha o formulário e a unidade aparece (spec: criar unidade com nome novo)', async () => {
    const nova = unit({ id: 'u-nova', name: 'Nova Unidade' });

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': [
        { status: 200, body: [unit({ id: 'u-1', name: 'Administração' })] },
        { status: 200, body: [unit({ id: 'u-1', name: 'Administração' }), nova] },
      ],
      'POST /units': { status: 201, body: nova },
    });

    renderApp(['/admin/unidades']);
    await screen.findByText('Nova unidade');
    await userEvent.click(screen.getByRole('button', { name: /nova unidade/i }));

    const dialog = await findDialogByTitle('Nova unidade');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Nova Unidade');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      const bodies = requestBodies('POST', '/units') as Record<string, unknown>[];
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({ name: 'Nova Unidade' });
    });

    await screen.findByText('Nova Unidade');
  });

  it('nome duplicado (409) sinaliza no campo e mantém o formulário aberto (spec: nome duplicado é sinalizado sem perder o preenchimento)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': { status: 200, body: [unit({ id: 'u-1', name: 'Administração' })] },
      'POST /units': { status: 409, body: { error: 'name already in use' } },
    });

    renderApp(['/admin/unidades']);
    await screen.findByText('Nova unidade');
    await userEvent.click(screen.getByRole('button', { name: /nova unidade/i }));

    const dialog = await findDialogByTitle('Nova unidade');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Administração');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));

    await within(dialog).findByText('Nome já está em uso');
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Administração');
  });

  it('renomear unidade chama PATCH /units/:id e reflete o novo nome (spec: renomear unidade)', async () => {
    const renomeada = unit({ id: 'u-1', name: 'Administração Central' });

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': [
        { status: 200, body: [unit({ id: 'u-1', name: 'Administração' })] },
        { status: 200, body: [renomeada] },
      ],
      'PATCH /units/u-1': { status: 200, body: renomeada },
    });

    renderApp(['/admin/unidades']);
    await screen.findByText('Administração');
    const row = screen.getByText('Administração').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Renomear' }));

    const dialog = await findDialogByTitle('Renomear unidade');
    const nameInput = within(dialog).getByLabelText('Nome');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Administração Central');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const bodies = requestBodies('PATCH', '/units/u-1') as Record<string, unknown>[];
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({ name: 'Administração Central' });
    });
    await screen.findByText('Administração Central');
  });

  it('desativar unidade vazia chama PATCH com status desativado após confirmação (spec: desativar unidade vazia)', async () => {
    const ativa = unit({ id: 'u-2', name: 'Unidade Vazia' });
    const inativa = { ...ativa, status: UnitStatus.DISABLED };

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': [
        { status: 200, body: [ativa] },
        { status: 200, body: [inativa] },
      ],
      'PATCH /units/u-2': { status: 200, body: inativa },
    });

    renderApp(['/admin/unidades']);
    await screen.findByText('Unidade Vazia');
    const row = screen.getByText('Unidade Vazia').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Desativar' }));
    await userEvent.click(confirmButton('Sim, desativar'));

    await waitFor(() => {
      const bodies = requestBodies('PATCH', '/units/u-2') as Record<string, unknown>[];
      expect(bodies).toEqual([{ status: 'desativado' }]);
    });
    await waitFor(() => expect(screen.getByText('Desativada')).toBeInTheDocument());
  });

  it('desativar unidade com pessoas (409 "unit not empty") exibe aviso e mantém ativa (spec: desativar com pessoas é bloqueado com aviso)', async () => {
    const ativa = unit({ id: 'u-3', name: 'Unidade Cheia' });

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': { status: 200, body: [ativa] },
      'PATCH /units/u-3': { status: 409, body: { error: 'unit not empty' } },
    });

    renderApp(['/admin/unidades']);
    await screen.findByText('Unidade Cheia');
    const row = screen.getByText('Unidade Cheia').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Desativar' }));
    await userEvent.click(confirmButton('Sim, desativar'));

    await screen.findByText(/ainda tem pessoas vinculadas/i);
    // status permanece "Ativa" na listagem
    expect(
      within(screen.getByText('Unidade Cheia').closest('tr')!).getByText('Ativa'),
    ).toBeInTheDocument();
  });

  it('reativar unidade desativada chama PATCH com status active (spec: reativar unidade)', async () => {
    const inativa = unit({ id: 'u-4', name: 'Unidade Desativada', status: UnitStatus.DISABLED });
    const ativa = { ...inativa, status: UnitStatus.ACTIVE };

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': [
        { status: 200, body: [inativa] },
        { status: 200, body: [ativa] },
      ],
      'PATCH /units/u-4': { status: 200, body: ativa },
    });

    renderApp(['/admin/unidades']);
    await screen.findByText('Unidade Desativada');
    const row = screen.getByText('Unidade Desativada').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Ativar' }));

    await waitFor(() => {
      const bodies = requestBodies('PATCH', '/units/u-4') as Record<string, unknown>[];
      expect(bodies).toEqual([{ status: 'active' }]);
    });
    await waitFor(() => expect(screen.getByText('Ativa')).toBeInTheDocument());
  });
});
