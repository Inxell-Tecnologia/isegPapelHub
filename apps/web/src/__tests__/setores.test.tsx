import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PersonStatus, UserRole } from '@gdoc/shared';
import type { PersonResponse, SectorResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

/**
 * Setor na gestão de pessoas (change `funcao-e-setor-na-identidade`,
 * capability `web-pessoas`: requisitos "Cadastro de pessoa com senha inicial"
 * — lista fechada —, "Edição de perfil, papel e status da pessoa" e
 * "Manutenção da lista de setores alcançável pela gestão de pessoas").
 *
 * O que estes casos precisam provar não é visual: que o setor é **escolhido**
 * e não digitado (resposta 5a do cliente — grafia divergente deixaria gente
 * fora do público da leitura obrigatória), que trocar a unidade não deixa o
 * formulário enviar vínculo cross-unit, e que a recusa de remoção se apresenta
 * como impedimento nomeado em vez de falha genérica.
 */

const UNIT_ADMIN = {
  id: 'user-1',
  unitId: 'unit-1',
  role: UserRole.UNIT_ADMIN,
  fullName: 'Admin da Unidade',
  unitName: 'Sede ISETES',
};

const GLOBAL_ADMIN = {
  id: 'user-9',
  unitId: 'unit-1',
  role: UserRole.GLOBAL_ADMIN,
  fullName: 'Governança',
  unitName: 'Sede ISETES',
};

function setor(overrides: Partial<SectorResponse> & { id: string; name: string }): SectorResponse {
  return {
    unitId: 'unit-1',
    createdAt: '2026-11-01T10:00:00.000Z',
    peopleCount: 0,
    ...overrides,
  };
}

function pessoa(overrides: Partial<PersonResponse> & { id: string }): PersonResponse {
  return {
    unitId: 'unit-1',
    fullName: 'Pessoa de Teste',
    email: `${overrides.id}@example.com`,
    phone: null,
    jobTitle: null,
    sectorId: null,
    sectorName: null,
    notes: null,
    role: UserRole.COLLABORATOR,
    status: PersonStatus.ACTIVE,
    createdAt: '2026-01-01T00:00:00.000Z',
    storageUsedBytes: 0,
    storageQuotaBytes: null,
    ...overrides,
  };
}

/**
 * O `Select` do Ant Design monta a lista num portal, fora do formulário — e o
 * portal do seletor **anterior** continua montado. Por isso a busca é pelo
 * `listbox` daquele campo (`<id>_list`), não pelo primeiro dropdown visível:
 * com dois seletores no mesmo formulário, o primeiro visível pode ser o outro.
 */
async function dropdownDoCampo(id: string): Promise<HTMLElement> {
  return waitFor(() => {
    const lista = document.querySelector(`#${id}_list`);
    const dropdown = lista?.closest('.ant-select-dropdown');
    if (!dropdown || dropdown.classList.contains('ant-select-dropdown-hidden')) {
      throw new Error(`dropdown de ${id} ainda não aberto`);
    }
    return dropdown as HTMLElement;
  });
}

function campo(id: string): HTMLElement {
  return document.querySelector(`#${id}`) as HTMLElement;
}

describe('Setor no cadastro de pessoa (web-pessoas)', () => {
  it('o setor é escolhido de lista, não digitado', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [] },
      'GET /sectors': {
        status: 200,
        body: [
          setor({ id: 'sec-1', name: 'CME' }),
          setor({ id: 'sec-2', name: 'Centro Cirúrgico' }),
        ],
      },
    });
    renderApp(['/admin/pessoas']);

    await userEvent.click(await screen.findByRole('button', { name: /Novo colaborador/ }));

    // Campo de setor é um seletor (combobox), não um campo de texto livre.
    const seletor = await waitFor(() => campo('sectorId'));
    expect(seletor.getAttribute('role')).toBe('combobox');
    // E o rótulo antigo de texto livre não existe mais.
    expect(screen.queryByLabelText('Área de trabalho')).not.toBeInTheDocument();

    await userEvent.click(seletor);
    const lista = await dropdownDoCampo('sectorId');
    expect(within(lista).getByText('CME')).toBeInTheDocument();
    expect(within(lista).getByText('Centro Cirúrgico')).toBeInTheDocument();
  });

  it('sem setor cadastrado na unidade, o formulário orienta onde cadastrar', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [] },
      'GET /sectors': { status: 200, body: [] },
    });
    renderApp(['/admin/pessoas']);

    await userEvent.click(await screen.findByRole('button', { name: /Novo colaborador/ }));
    // "Sem setor" é estado válido — o formulário não trava; só diz onde a
    // lista se mantém.
    expect(await screen.findByText(/Nenhum setor cadastrado nesta unidade/)).toBeInTheDocument();
  });

  it('trocar a unidade repõe a lista e descarta o setor já escolhido', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /users': { status: 200, body: [] },
      'GET /units': {
        status: 200,
        body: [
          {
            id: 'unit-1',
            name: 'Sede ISETES',
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'unit-2',
            name: 'Unidade Norte',
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      // A unidade do contexto (sem `unitId`) e a outra unidade são listas
      // distintas; a chave de cache inclui a unidade justamente por isso.
      'GET /sectors': { status: 200, body: [setor({ id: 'sec-1', name: 'CME' })] },
    });
    renderApp(['/admin/pessoas']);

    await userEvent.click(await screen.findByRole('button', { name: /Novo colaborador/ }));

    await userEvent.click(await waitFor(() => campo('unitId')));
    await userEvent.click(within(await dropdownDoCampo('unitId')).getByText('Sede ISETES'));

    await userEvent.click(campo('sectorId'));
    await userEvent.click(within(await dropdownDoCampo('sectorId')).getByText('CME'));
    await waitFor(() => {
      const escolhido = document
        .querySelector('#sectorId')
        ?.closest('.ant-select')
        ?.querySelector('.ant-select-selection-item');
      expect(escolhido?.textContent).toBe('CME');
    });

    // Troca de unidade: a escolha anterior não pode sobreviver, ou o
    // formulário enviaria setor de outra unidade e o servidor recusaria a
    // requisição inteira.
    await userEvent.click(campo('unitId'));
    await userEvent.click(within(await dropdownDoCampo('unitId')).getByText('Unidade Norte'));

    await waitFor(() => {
      const selecionado = document.querySelector('#sectorId')?.closest('.ant-select');
      expect(selecionado?.querySelector('.ant-select-selection-item')).toBeNull();
    });
  });
});

describe('Manutenção da lista de setores (web-pessoas)', () => {
  it('a manutenção é alcançável da página de colaboradores', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [] },
      'GET /sectors': { status: 200, body: [setor({ id: 'sec-1', name: 'Governança' })] },
    });
    renderApp(['/admin/pessoas']);

    await userEvent.click(await screen.findByRole('button', { name: 'Setores' }));

    const painel = await waitFor(() => {
      const el = document.querySelector('.ant-drawer-content');
      if (el === null) throw new Error('painel ainda não aberto');
      return el as HTMLElement;
    });
    expect(within(painel).getByText('Setores da unidade')).toBeInTheDocument();
    expect(within(painel).getByText('Governança')).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Renomear' })).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Remover' })).toBeInTheDocument();
  });

  it('setor recém-cadastrado passa a ser oferecido no formulário de pessoa', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [] },
      // Fila: antes do cadastro, vazia; depois da invalidação, com o novo.
      'GET /sectors': [
        { status: 200, body: [] },
        { status: 200, body: [setor({ id: 'sec-novo', name: 'Farmácia' })] },
      ],
      'POST /sectors': { status: 201, body: setor({ id: 'sec-novo', name: 'Farmácia' }) },
    });
    renderApp(['/admin/pessoas']);

    await userEvent.click(await screen.findByRole('button', { name: 'Setores' }));
    const entrada = await screen.findByLabelText('Nome do novo setor');
    await userEvent.type(entrada, 'Farmácia');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    // Sem recarregar a aplicação: a mutação invalida a listagem.
    await waitFor(() => expect(screen.getByText('Farmácia')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(await screen.findByRole('button', { name: /Novo colaborador/ }));
    await userEvent.click(await waitFor(() => campo('sectorId')));
    expect(within(await dropdownDoCampo('sectorId')).getByText('Farmácia')).toBeInTheDocument();
  });

  it('remoção de setor em uso é apresentada como impedimento, não como falha genérica', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': {
        status: 200,
        body: [pessoa({ id: 'p1', sectorId: 'sec-1', sectorName: 'CME' })],
      },
      'GET /sectors': { status: 200, body: [setor({ id: 'sec-1', name: 'CME', peopleCount: 3 })] },
      'DELETE /sectors/sec-1': {
        status: 409,
        body: { error: 'sector_has_people', peopleCount: 3 },
      },
    });
    renderApp(['/admin/pessoas']);

    await userEvent.click(await screen.findByRole('button', { name: 'Setores' }));
    const painel = await waitFor(() => {
      const el = document.querySelector('.ant-drawer-content');
      if (el === null) throw new Error('painel ainda não aberto');
      return el as HTMLElement;
    });
    await userEvent.click(within(painel).getByRole('button', { name: 'Remover' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, remover' }));

    // Diz **quantas** pessoas impedem, e não "não foi possível concluir".
    expect(await screen.findByText(/3 colaborador\(es\) vinculado\(s\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível concluir a ação/)).not.toBeInTheDocument();
    // E a lista permanece intacta (escopado ao painel: "CME" aparece também na
    // coluna de setor da pessoa listada).
    expect(within(painel).getByText('CME')).toBeInTheDocument();
  });

  it('nome já usado na unidade é sinalizado no campo do cadastro', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [] },
      'GET /sectors': { status: 200, body: [setor({ id: 'sec-1', name: 'CME' })] },
      'POST /sectors': { status: 409, body: { error: 'sector_name_in_use' } },
    });
    renderApp(['/admin/pessoas']);

    await userEvent.click(await screen.findByRole('button', { name: 'Setores' }));
    await userEvent.type(await screen.findByLabelText('Nome do novo setor'), 'cme');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(
      await screen.findByText(/Já existe um setor com esse nome nesta unidade/),
    ).toBeInTheDocument();
  });

  it('a página de colaboradores segue barrada a quem não é administração', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { ...UNIT_ADMIN, role: UserRole.COLLABORATOR },
      },
      ...{},
    });
    renderApp(['/admin/pessoas']);

    // Barrado pela guarda de rota, antes de qualquer chamada — logo não
    // alcança a manutenção de setores.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Setores' })).not.toBeInTheDocument();
    });
  });
});
