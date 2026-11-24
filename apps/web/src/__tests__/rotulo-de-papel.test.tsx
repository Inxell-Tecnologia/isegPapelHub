import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type { MyProfileResponse, PersonResponse } from '@gdoc/shared';
import { PersonStatus } from '@gdoc/shared';
import { ROLE_LABEL } from '../shell/role-label';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

/**
 * Rótulo do papel de acesso (capability `nomenclatura-interface`, requisitos
 * "Rótulo do papel de acesso preservado" e "Rótulo do papel é idêntico em
 * toda a interface"; change `identidade-visual-isetes`, design.md D7).
 *
 * O mapa estava triplicado em `shell/AppShell`, `conta/MinhaContaPage` e
 * `pessoas/PessoaFormModal`. Esta suíte percorre as **três** telas que
 * exibem o papel e exige o mesmo texto nas três — é o que impede uma delas
 * de ficar para trás numa troca de nomenclatura futura.
 */

const UNIT_ADMIN = { id: 'user-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };

const PERFIL: MyProfileResponse = {
  fullName: 'Fulana Gestora',
  email: 'fulana@example.com',
  unitName: 'Unidade A',
  role: UserRole.UNIT_ADMIN,
};

const PESSOA: PersonResponse = {
  id: 'user-1',
  unitId: 'unit-1',
  email: 'fulana@example.com',
  fullName: 'Fulana Gestora',
  phone: null,
  jobTitle: 'Coordenação',
  sectorId: null,
  sectorName: null,
  notes: null,
  role: UserRole.UNIT_ADMIN,
  status: PersonStatus.ACTIVE,
  storageUsedBytes: 0,
  storageQuotaBytes: null,
  createdAt: '2026-07-01T10:00:00.000Z',
};

describe('Rótulo do papel de acesso (nomenclatura-interface)', () => {
  it('o papel com privilégio administrativo de unidade é rotulado "Administrador da unidade"', () => {
    expect(ROLE_LABEL[UserRole.UNIT_ADMIN]).toBe('Administrador da unidade');
  });

  it('"Gestor" não nomeia papel algum — reservado a quem acompanha leituras (design.md D3)', () => {
    expect(Object.values(ROLE_LABEL)).not.toContain('Gestor');
  });

  it('"Colaborador" e "Administrador global" permanecem inalterados', () => {
    expect(ROLE_LABEL[UserRole.COLLABORATOR]).toBe('Colaborador');
    expect(ROLE_LABEL[UserRole.GLOBAL_ADMIN]).toBe('Administrador global');
  });

  it('o shell autenticado exibe o rótulo da origem única', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [] },
    });
    renderApp(['/admin/pessoas']);

    await screen.findByText('Novo colaborador');
    const rodape = document.querySelector('.ant-layout-sider') as HTMLElement;
    expect(within(rodape).getAllByText(ROLE_LABEL[UserRole.UNIT_ADMIN]).length).toBeGreaterThan(0);
  });

  it('o perfil da própria conta exibe o mesmo rótulo do shell', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /auth/profile': { status: 200, body: PERFIL },
    });
    renderApp(['/minha-conta']);

    await screen.findByText('fulana@example.com');
    // Duas ocorrências na tela — a do shell e a do campo "Papel" —, e é
    // justamente a igualdade entre elas que o requisito exige.
    expect(screen.getAllByText(ROLE_LABEL[UserRole.UNIT_ADMIN]).length).toBeGreaterThanOrEqual(2);
  });

  it('a listagem de colaboradores e o seletor de papel exibem o mesmo rótulo', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [PESSOA] },
    });
    renderApp(['/admin/pessoas']);

    const linha = (await screen.findByText('Fulana Gestora')).closest('tr')!;
    expect(within(linha).getByText(ROLE_LABEL[UserRole.UNIT_ADMIN])).toBeInTheDocument();

    await userEvent.click(within(linha).getByRole('button', { name: 'Editar' }));
    // O formulário passou a ter dois seletores — Setor e Papel (change
    // `funcao-e-setor-na-identidade`) —, então o caso aponta o de papel pelo
    // seu campo, em vez de pelo único `combobox` que havia antes.
    const combobox = await waitFor(() => {
      const campo = document.querySelector('#role') as HTMLElement | null;
      if (campo === null) throw new Error('seletor de papel ainda não montado');
      return campo;
    });
    await userEvent.click(combobox);
    const dropdown = await waitFor(
      () => document.querySelector('.ant-select-dropdown') as HTMLElement,
    );
    expect(within(dropdown).getByText(ROLE_LABEL[UserRole.UNIT_ADMIN])).toBeInTheDocument();
  });

  /**
   * Função exibida no lugar do papel (change `funcao-e-setor-na-identidade`):
   * o requisito passou a reconhecer que o shell e a tela inicial apresentam a
   * **função**, exibindo o rótulo do papel só na recaída — e, quando o exibem,
   * pela mesma origem única.
   */
  it('a função no shell não é rótulo de papel: a listagem segue exibindo o papel da origem única', async () => {
    mockFetch({
      'GET /auth/me': {
        status: 200,
        body: { ...UNIT_ADMIN, fullName: 'Fulana Gestora', jobTitle: 'Coordenação' },
      },
      'GET /users': { status: 200, body: [PESSOA] },
    });
    renderApp(['/admin/pessoas']);

    // O nome aparece em DOIS lugares agora: na linha da tabela e no cartão do
    // rodapé. Esperar a tabela antes de localizar a linha evita casar com o
    // cartão, que renderiza primeiro.
    const tabela = await screen.findByRole('table');
    const linha = within(tabela).getByText('Fulana Gestora').closest('tr')!;
    // A listagem é a tela do cadastro: o papel continua lá, com o rótulo de
    // origem única, para distinguir quem tem privilégio administrativo.
    expect(within(linha).getByText(ROLE_LABEL[UserRole.UNIT_ADMIN])).toBeInTheDocument();

    // O shell apresenta a função. Os dois textos divergem de propósito, e
    // essa divergência não é rótulo de papel inconsistente.
    const rodape = document.querySelector('.ant-layout-sider') as HTMLElement;
    expect(within(rodape).getByText('Coordenação')).toBeInTheDocument();
  });

  it('o rótulo anterior não aparece em texto visível em nenhuma das telas', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [PESSOA] },
    });
    renderApp(['/admin/pessoas']);

    await screen.findByText('Fulana Gestora');
    // O rótulo anterior é "Gestor" (change `rotulo-administrador-da-unidade`):
    // a palavra inteira, não o nome da fixture ("Gestora") nem "Gestão".
    expect(document.body.textContent).not.toMatch(/\bGestor\b/);
    expect(document.body.textContent).toMatch(/Administrador da unidade/);
  });
});
