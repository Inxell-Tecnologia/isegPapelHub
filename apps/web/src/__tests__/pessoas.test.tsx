import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App as AntdApp, ConfigProvider } from 'antd';
import { PersonStatus, UnitStatus, UserRole } from '@gdoc/shared';
import type { PersonResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';
import { SenhaGeradaModal } from '../pessoas/SenhaGeradaModal';

const UNIT_ADMIN = { id: 'admin-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };
const GLOBAL_ADMIN = { id: 'admin-g', unitId: 'unit-1', role: UserRole.GLOBAL_ADMIN };

const UNIT_A = {
  id: 'unit-a',
  name: 'Unidade A',
  status: UnitStatus.ACTIVE,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const UNIT_B = {
  id: 'unit-b',
  name: 'Unidade B',
  status: UnitStatus.ACTIVE,
  createdAt: '2026-01-02T00:00:00.000Z',
};

function person(overrides: Partial<PersonResponse> & { id: string }): PersonResponse {
  return {
    unitId: 'unit-1',
    fullName: 'Fulano de Tal',
    email: `${overrides.id}@example.com`,
    phone: null,
    jobTitle: null,
    workArea: null,
    notes: null,
    role: UserRole.COLLABORATOR,
    status: PersonStatus.ACTIVE,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Mesma limitação de `useId` documentada em `explorer.test.tsx`: localiza pelo título, não por role+name. */
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

/**
 * Botão de confirmação do `Popconfirm` pelo texto exato. Usa a lista já
 * resolvida de `getAllByRole` (síncrona) em vez de `findByRole`/`waitFor` —
 * ao reabrir um segundo `Popconfirm` na mesma linha (mesma posição na
 * árvore, só props diferentes), a busca assíncrona nunca resolve em jsdom.
 */
function confirmButton(label: string): HTMLElement {
  const button = screen.getAllByRole('button').find((b) => b.textContent === label);
  if (!button) throw new Error(`botão "${label}" não encontrado`);
  return button;
}

/**
 * Abre o `Select` de um `Form.Item` (localizado pelo rótulo) dentro do diálogo
 * e clica na opção pelo texto. Escopar pelo `.ant-form-item` do rótulo torna a
 * seleção robusta quando há mais de um `combobox` no formulário (ex.: o
 * `global_admin` vê Unidade + Papel — gestao-de-unidades D7).
 */
async function selectFromField(
  dialog: HTMLElement,
  fieldLabel: string,
  optionLabel: string,
): Promise<void> {
  const item = within(dialog).getByText(fieldLabel).closest('.ant-form-item') as HTMLElement;
  const combobox = within(item).getByRole('combobox');
  await userEvent.click(combobox);
  // Com mais de um `Select` no formulário há vários `.ant-select-dropdown` no
  // DOM; localizar por `querySelector` global pegaria o primeiro (errado). O
  // AntD liga o combobox ao seu próprio dropdown via `aria-controls`/`aria-owns`
  // — seguimos essa associação para abrir exatamente o dropdown clicado.
  const dropdown = await waitFor(() => {
    const listboxId = combobox.getAttribute('aria-controls') ?? combobox.getAttribute('aria-owns');
    const container = listboxId
      ? document.getElementById(listboxId)?.closest('.ant-select-dropdown')
      : null;
    if (!container) throw new Error('dropdown do Select ainda não está no DOM');
    return container as HTMLElement;
  });
  await userEvent.click(await within(dropdown).findByText(optionLabel));
}

/** Atalho para o seletor de papel (rótulo "Papel"). */
async function selectRole(dialog: HTMLElement, label: string): Promise<void> {
  await selectFromField(dialog, 'Papel', label);
}

describe('Gestão de pessoas da SPA (web-pessoas)', () => {
  it('administrador lista as pessoas do seu alcance; pessoa sem nome cai no e-mail (spec: administrador lista / pessoa sem nome cai no e-mail)', async () => {
    const comNome = person({
      id: 'person-1',
      fullName: 'Beltrano Silva',
      email: 'beltrano@example.com',
      jobTitle: 'Analista',
      role: UserRole.UNIT_ADMIN,
    });
    const semNome = person({ id: 'person-2', fullName: null, email: 'semnome@example.com' });

    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [comNome, semNome] },
    });

    renderApp(['/admin/pessoas']);

    await screen.findByText('Beltrano Silva');
    const row = screen.getByText('Beltrano Silva').closest('tr')!;
    expect(within(row).getByText('beltrano@example.com')).toBeInTheDocument();
    expect(within(row).getByText('Analista')).toBeInTheDocument();
    expect(within(row).getByText('Administrador da unidade')).toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();

    // pessoa sem nome cai no e-mail
    expect(screen.getAllByText('semnome@example.com').length).toBeGreaterThan(0);

    // nomenclatura-interface: nenhum literal de tela usa "Pessoa"/"Servidor"
    expect(document.body.textContent).not.toMatch(/pessoa|servidor/i);
  });

  it('cadastro válido chama POST /users, fecha o modal e a nova pessoa aparece; confirmar sem senha é bloqueado (spec: cadastro válido / senha é exigida)', async () => {
    const novaPessoa = person({
      id: 'person-novo',
      fullName: 'Ciclana Souza',
      email: 'ciclana@example.com',
      role: UserRole.COLLABORATOR,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': [
        { status: 200, body: [] },
        { status: 200, body: [novaPessoa] },
      ],
      'POST /users': { status: 201, body: novaPessoa },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Novo colaborador');
    await userEvent.click(screen.getByRole('button', { name: /novo colaborador/i }));

    const dialog = await findDialogByTitle('Novo colaborador');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Ciclana Souza');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'ciclana@example.com');
    await selectRole(dialog, 'Colaborador');

    // confirmar sem senha é bloqueado
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));
    await within(dialog).findByText('Informe uma senha');
    expect(requestBodies('POST', '/users')).toHaveLength(0);

    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'segredo123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => {
      const bodies = requestBodies('POST', '/users') as Record<string, unknown>[];
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({
        fullName: 'Ciclana Souza',
        email: 'ciclana@example.com',
        password: 'segredo123',
        role: 'collaborator',
      });
      expect(bodies[0]!.unitId).toBeUndefined();
    });

    await screen.findByText('Ciclana Souza');
  });

  it('e-mail duplicado (409) exibe "e-mail já está em uso" e mantém o modal aberto com os campos preenchidos (spec: e-mail duplicado)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [] },
      'POST /users': { status: 409, body: { error: 'email already in use' } },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Novo colaborador');
    await userEvent.click(screen.getByRole('button', { name: /novo colaborador/i }));

    const dialog = await findDialogByTitle('Novo colaborador');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Fulano Repetido');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'ja-existe@example.com');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'segredo123');
    await selectRole(dialog, 'Colaborador');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await within(dialog).findByText('E-mail já está em uso');
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Fulano Repetido');
    expect(within(dialog).getByLabelText('E-mail')).toHaveValue('ja-existe@example.com');
  });

  it('edição altera os dados da pessoa via PATCH /users/:id; o formulário não tem senha e o e-mail é somente-leitura (spec: edição altera os dados / não expõe senha nem e-mail)', async () => {
    const pessoa = person({
      id: 'person-1',
      fullName: 'Beltrano Silva',
      email: 'beltrano@example.com',
    });
    const pessoaEditada = { ...pessoa, fullName: 'Beltrano Souza' };

    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': [
        { status: 200, body: [pessoa] },
        { status: 200, body: [pessoaEditada] },
      ],
      'PATCH /users/person-1': { status: 200, body: pessoaEditada },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Beltrano Silva');
    const row = screen.getByText('Beltrano Silva').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Editar' }));

    const dialog = await findDialogByTitle('Editar colaborador');
    expect(within(dialog).queryByLabelText('Senha inicial')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('E-mail')).toBeDisabled();

    const nameInput = within(dialog).getByLabelText('Nome');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Beltrano Souza');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const bodies = requestBodies('PATCH', '/users/person-1') as Record<string, unknown>[];
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({ fullName: 'Beltrano Souza' });
      expect(bodies[0]!.email).toBeUndefined();
      expect(bodies[0]!.password).toBeUndefined();
    });

    await screen.findByText('Beltrano Souza');
  });

  it('desativar chama PATCH com status disabled após confirmação; reativar chama com status active; não há ação de exclusão (spec: desativar / reativar / não há exclusão permanente)', async () => {
    const ativa = person({
      id: 'person-1',
      fullName: 'Beltrano Silva',
      status: PersonStatus.ACTIVE,
    });
    const inativa = { ...ativa, status: PersonStatus.DISABLED };

    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': [
        { status: 200, body: [ativa] },
        { status: 200, body: [inativa] },
        { status: 200, body: [ativa] },
      ],
      'PATCH /users/person-1': [
        { status: 200, body: inativa },
        { status: 200, body: ativa },
      ],
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Beltrano Silva');

    let row = screen.getByText('Beltrano Silva').closest('tr')!;
    expect(within(row).queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Desativar' }));
    await userEvent.click(confirmButton('Sim, desativar'));

    await waitFor(() => expect(screen.getByText('Inativo')).toBeInTheDocument());

    row = screen.getByText('Beltrano Silva').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Ativar' }));
    await userEvent.click(confirmButton('Sim, ativar'));

    await waitFor(() => expect(screen.getByText('Ativo')).toBeInTheDocument());

    const bodies = requestBodies('PATCH', '/users/person-1') as Record<string, unknown>[];
    expect(bodies).toEqual([{ status: 'disabled' }, { status: 'active' }]);
  });

  it('trava de papel: unit_admin não vê global_admin no seletor, global_admin vê; própria linha esconde desativar/rebaixar; 403 exibe aviso neutro (spec: travas de papel / 403 fail-closed neutro)', async () => {
    const selfAsUnitAdmin = person({
      id: 'admin-1',
      fullName: 'Admin Um',
      email: 'admin1@example.com',
      role: UserRole.UNIT_ADMIN,
    });
    const outraPessoa = person({ id: 'person-2', fullName: 'Outro Colaborador' });

    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [selfAsUnitAdmin, outraPessoa] },
      'PATCH /users/person-2': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Admin Um');

    // própria linha: sem ação de desativar
    const selfRow = screen.getByText('Admin Um').closest('tr')!;
    expect(within(selfRow).queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();

    // própria linha, modo editar: seletor de papel não oferece rebaixar (Colaborador) nem global_admin
    await userEvent.click(within(selfRow).getByRole('button', { name: 'Editar' }));
    const selfDialog = await findDialogByTitle('Editar colaborador');
    await userEvent.click(within(selfDialog).getByRole('combobox'));
    let dropdown = await waitFor(
      () => document.querySelector('.ant-select-dropdown') as HTMLElement,
    );
    expect(within(dropdown).queryByText('Colaborador')).not.toBeInTheDocument();
    expect(within(dropdown).queryByText('Administrador global')).not.toBeInTheDocument();
    expect(within(dropdown).getByText('Administrador da unidade')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(selfDialog).getByRole('button', { name: 'Cancelar' }));

    // cadastro: unit_admin não vê global_admin
    await userEvent.click(screen.getByRole('button', { name: /novo colaborador/i }));
    const createDialog = await findDialogByTitle('Novo colaborador');
    await userEvent.click(within(createDialog).getByRole('combobox'));
    dropdown = await waitFor(() => document.querySelector('.ant-select-dropdown') as HTMLElement);
    expect(within(dropdown).queryByText('Administrador global')).not.toBeInTheDocument();
    expect(within(dropdown).getByText('Colaborador')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(createDialog).getByRole('button', { name: 'Cancelar' }));

    // 403 ao editar outra pessoa exibe aviso neutro, sem aplicar mudança
    const otherRow = screen.getByText('Outro Colaborador').closest('tr')!;
    await userEvent.click(within(otherRow).getByRole('button', { name: 'Editar' }));
    const otherDialog = await findDialogByTitle('Editar colaborador');
    await userEvent.click(within(otherDialog).getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Permissão insuficiente para executar esta ação.');
  });

  it('global_admin vê a opção global_admin no seletor de papel (spec: global_admin vê a opção global_admin)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /users': { status: 200, body: [] },
      'GET /units': { status: 200, body: [UNIT_A, UNIT_B] },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Novo colaborador');
    await userEvent.click(screen.getByRole('button', { name: /novo colaborador/i }));

    const dialog = await findDialogByTitle('Novo colaborador');
    // O global_admin vê 2 comboboxes (Unidade + Papel); escopar pelo rótulo.
    const roleItem = within(dialog).getByText('Papel').closest('.ant-form-item') as HTMLElement;
    await userEvent.click(within(roleItem).getByRole('combobox'));
    const dropdown = await waitFor(
      () =>
        document.querySelector(
          '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
        ) as HTMLElement,
    );
    expect(within(dropdown).getByText('Administrador global')).toBeInTheDocument();
  });

  it('global_admin: seletor de unidade (só ativas) é exibido e POST /users envia o unitId escolhido (spec: cadastro por global_admin com seletor)', async () => {
    const novaPessoa = person({ id: 'person-g', fullName: 'Novo GA', unitId: 'unit-b' });

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /users': [
        { status: 200, body: [] },
        { status: 200, body: [novaPessoa] },
      ],
      'GET /units': { status: 200, body: [UNIT_A, UNIT_B] },
      'POST /users': { status: 201, body: novaPessoa },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Novo colaborador');
    await userEvent.click(screen.getByRole('button', { name: /novo colaborador/i }));

    const dialog = await findDialogByTitle('Novo colaborador');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Novo GA');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'novo-ga@example.com');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'segredo123');
    await selectFromField(dialog, 'Unidade', 'Unidade B');
    await selectRole(dialog, 'Colaborador');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => {
      const bodies = requestBodies('POST', '/users') as Record<string, unknown>[];
      expect(bodies).toHaveLength(1);
      expect(bodies[0]).toMatchObject({ fullName: 'Novo GA', unitId: 'unit-b' });
    });
  });

  it('global_admin: 409 "unit is disabled" sinaliza no seletor de unidade, não no e-mail (spec: cadastro em unidade desativada é recusado)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /users': { status: 200, body: [] },
      'GET /units': { status: 200, body: [UNIT_A, UNIT_B] },
      'POST /users': { status: 409, body: { error: 'unit is disabled' } },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Novo colaborador');
    await userEvent.click(screen.getByRole('button', { name: /novo colaborador/i }));

    const dialog = await findDialogByTitle('Novo colaborador');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Fulano');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'fulano@example.com');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'segredo123');
    await selectFromField(dialog, 'Unidade', 'Unidade A');
    await selectRole(dialog, 'Colaborador');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar' }));

    await within(dialog).findByText('Unidade desativada; escolha outra');
    expect(within(dialog).queryByText('E-mail já está em uso')).not.toBeInTheDocument();
  });

  it('global_admin: a listagem exibe o NOME da unidade (não o UUID), resolvido via GET /units (spec: unidade exibida pelo nome)', async () => {
    const pessoaA = person({ id: 'p-a', fullName: 'Colaborador A', unitId: 'unit-a' });
    const pessoaB = person({ id: 'p-b', fullName: 'Colaborador B', unitId: 'unit-b' });

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /users': { status: 200, body: [pessoaA, pessoaB] },
      'GET /units': { status: 200, body: [UNIT_A, UNIT_B] },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Colaborador A');

    const rowA = screen.getByText('Colaborador A').closest('tr')!;
    expect(within(rowA).getByText('Unidade A')).toBeInTheDocument();
    expect(within(rowA).queryByText('unit-a')).not.toBeInTheDocument();

    const rowB = screen.getByText('Colaborador B').closest('tr')!;
    expect(within(rowB).getByText('Unidade B')).toBeInTheDocument();
  });

  it('unit_admin: sem seletor de unidade no cadastro e sem coluna de unidade na listagem (spec: cadastro por unit_admin não mostra seletor)', async () => {
    const pessoa = person({ id: 'p-1', fullName: 'Alguém' });

    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [pessoa] },
    });

    renderApp(['/admin/pessoas']);
    await screen.findByText('Alguém');

    // sem coluna "Unidade" no cabeçalho da tabela
    expect(screen.queryByRole('columnheader', { name: 'Unidade' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /novo colaborador/i }));
    const dialog = await findDialogByTitle('Novo colaborador');
    // sem campo "Unidade" no formulário
    expect(within(dialog).queryByText('Unidade')).not.toBeInTheDocument();
  });

  describe('Redefinição de senha (US 1.4, design.md (troca-de-senha) D5) — visibilidade é UX, não defesa', () => {
    it('unit_admin vê a ação só em colaboradores', async () => {
      const collaborator = person({
        id: 'p-collab',
        fullName: 'Um Colaborador',
        role: UserRole.COLLABORATOR,
      });
      const unitAdmin = person({
        id: 'p-unit-admin',
        fullName: 'Outro Unit Admin',
        role: UserRole.UNIT_ADMIN,
      });
      const globalAdmin = person({
        id: 'p-global-admin',
        fullName: 'Um Global Admin',
        role: UserRole.GLOBAL_ADMIN,
      });

      mockFetch({
        'GET /auth/me': { status: 200, body: UNIT_ADMIN },
        'GET /users': { status: 200, body: [collaborator, unitAdmin, globalAdmin] },
      });

      renderApp(['/admin/pessoas']);
      await screen.findByText('Um Colaborador');

      const collabRow = screen.getByText('Um Colaborador').closest('tr')!;
      expect(
        within(collabRow).getByRole('button', { name: 'Redefinir senha' }),
      ).toBeInTheDocument();

      const unitAdminRow = screen.getByText('Outro Unit Admin').closest('tr')!;
      expect(
        within(unitAdminRow).queryByRole('button', { name: 'Redefinir senha' }),
      ).not.toBeInTheDocument();

      const globalAdminRow = screen.getByText('Um Global Admin').closest('tr')!;
      expect(
        within(globalAdminRow).queryByRole('button', { name: 'Redefinir senha' }),
      ).not.toBeInTheDocument();
    });

    it('global_admin vê a ação em colaboradores e administradores de unidade; nenhuma linha de global_admin oferece a ação', async () => {
      const collaborator = person({
        id: 'p-collab',
        fullName: 'Um Colaborador',
        role: UserRole.COLLABORATOR,
      });
      const unitAdmin = person({
        id: 'p-unit-admin',
        fullName: 'Um Unit Admin',
        role: UserRole.UNIT_ADMIN,
      });
      const globalAdmin = person({
        id: 'p-global-admin',
        fullName: 'Outro Global Admin',
        role: UserRole.GLOBAL_ADMIN,
      });

      mockFetch({
        'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
        'GET /users': { status: 200, body: [collaborator, unitAdmin, globalAdmin] },
      });

      renderApp(['/admin/pessoas']);
      await screen.findByText('Um Colaborador');

      const collabRow = screen.getByText('Um Colaborador').closest('tr')!;
      expect(
        within(collabRow).getByRole('button', { name: 'Redefinir senha' }),
      ).toBeInTheDocument();

      const unitAdminRow = screen.getByText('Um Unit Admin').closest('tr')!;
      expect(
        within(unitAdminRow).getByRole('button', { name: 'Redefinir senha' }),
      ).toBeInTheDocument();

      const globalAdminRow = screen.getByText('Outro Global Admin').closest('tr')!;
      expect(
        within(globalAdminRow).queryByRole('button', { name: 'Redefinir senha' }),
      ).not.toBeInTheDocument();
    });

    it('confirma e exibe a senha gerada uma única vez, com aviso de que não será mostrada de novo', async () => {
      const collaborator = person({
        id: 'p-collab',
        fullName: 'Um Colaborador',
        role: UserRole.COLLABORATOR,
      });

      mockFetch({
        'GET /auth/me': { status: 200, body: UNIT_ADMIN },
        'GET /users': { status: 200, body: [collaborator] },
        'POST /users/p-collab/password': {
          status: 200,
          body: { generatedPassword: 'Senha-Gerada-123' },
        },
      });

      renderApp(['/admin/pessoas']);
      await screen.findByText('Um Colaborador');

      const row = screen.getByText('Um Colaborador').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Redefinir senha' }));
      await userEvent.click(confirmButton('Sim, redefinir'));

      await screen.findByText('Senha-Gerada-123');
      expect(screen.getByText(/não será exibida novamente/i)).toBeInTheDocument();
    });

    it('senha some ao fechar o modal: "Concluir" descarta o valor do estado do pai (design.md D7)', () => {
      // Testa o `SenhaGeradaModal` isolado do restante da página: a animação de
      // fechamento do AntD `Modal` não completa sob jsdom (sem `animationend`
      // real), então a asserção relevante é o contrato de descarte — "Concluir"
      // chama `onClose`, e é *esse* callback que zera o estado no componente pai
      // (`PessoasPage`), tornando a senha irrecuperável.
      const onClose = vi.fn();
      render(
        <ConfigProvider>
          <AntdApp>
            <SenhaGeradaModal generatedPassword="Senha-Gerada-123" onClose={onClose} />
          </AntdApp>
        </ConfigProvider>,
      );

      expect(screen.getByText('Senha-Gerada-123')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('403 ao redefinir exibe o mesmo aviso neutro das demais operações', async () => {
      const collaborator = person({
        id: 'p-collab',
        fullName: 'Um Colaborador',
        role: UserRole.COLLABORATOR,
      });

      mockFetch({
        'GET /auth/me': { status: 200, body: UNIT_ADMIN },
        'GET /users': { status: 200, body: [collaborator] },
        'POST /users/p-collab/password': { status: 403, body: { error: 'forbidden' } },
      });

      renderApp(['/admin/pessoas']);
      await screen.findByText('Um Colaborador');

      const row = screen.getByText('Um Colaborador').closest('tr')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Redefinir senha' }));
      await userEvent.click(confirmButton('Sim, redefinir'));

      await screen.findByText('Permissão insuficiente para executar esta ação.');
    });
  });
});
