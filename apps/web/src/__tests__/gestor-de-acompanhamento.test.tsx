import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PersonStatus, ReadingOversight, UserRole } from '@gdoc/shared';
import type { PersonResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const UNIT_ADMIN = { id: 'admin-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };
const GLOBAL_ADMIN = { id: 'admin-g', unitId: 'unit-1', role: UserRole.GLOBAL_ADMIN };

function person(overrides: Partial<PersonResponse> & { id: string }): PersonResponse {
  return {
    unitId: 'unit-1',
    fullName: 'Fulano de Tal',
    email: `${overrides.id}@example.com`,
    phone: null,
    jobTitle: null,
    sectorId: null,
    sectorName: null,
    notes: null,
    readingOversight: null,
    role: UserRole.COLLABORATOR,
    status: PersonStatus.ACTIVE,
    createdAt: '2026-01-01T00:00:00.000Z',
    storageUsedBytes: 0,
    storageQuotaBytes: null,
    ...overrides,
  };
}

async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.startsWith(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

async function abrirCampo(dialog: HTMLElement, rotulo: string): Promise<HTMLElement> {
  const item = within(dialog).getByText(rotulo).closest('.ant-form-item') as HTMLElement;
  const combobox = within(item).getByRole('combobox');
  await userEvent.click(combobox);
  return waitFor(() => {
    const id = combobox.getAttribute('aria-controls') ?? combobox.getAttribute('aria-owns');
    const dropdown = id ? document.getElementById(id)?.closest('.ant-select-dropdown') : null;
    if (!dropdown) throw new Error(`dropdown de ${rotulo} ainda não está no DOM`);
    return dropdown as HTMLElement;
  });
}

function corposDe(method: string, path: string): Record<string, unknown>[] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(
      (call) =>
        String(call[0]).includes(path) && (call[1] as RequestInit | undefined)?.method === method,
    )
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

async function editar(nome: string): Promise<HTMLElement> {
  const linha = (await screen.findByText(nome)).closest('tr')!;
  await userEvent.click(within(linha).getByRole('button', { name: 'Editar' }));
  return findDialogByTitle('Editar colaborador');
}

/**
 * Acompanhamento de leituras no cadastro (US 12.1, change
 * `gestor-de-acompanhamento`, capability `web-pessoas`).
 */
describe('Acompanhamento de leituras na gestão de pessoas (web-pessoas)', () => {
  it('a listagem mostra o alcance de cada pessoa pelo rótulo de origem única', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': {
        status: 200,
        body: [
          person({ id: 'p1', fullName: 'Coordenadora CME', readingOversight: 'sector' }),
          person({ id: 'p2', fullName: 'Diretor', readingOversight: 'unit' }),
          person({ id: 'p3', fullName: 'Analista' }),
        ],
      },
    });
    renderApp(['/admin/pessoas']);

    const linha = (nome: string) => screen.getByText(nome).closest('tr') as HTMLElement;
    await screen.findByText('Coordenadora CME');
    expect(within(linha('Coordenadora CME')).getByText('Gestor do setor')).toBeInTheDocument();
    expect(within(linha('Diretor')).getByText('Gestor da unidade')).toBeInTheDocument();
    expect(within(linha('Analista')).queryByText(/Gestor/)).toBeNull();
  });

  it('o administrador da unidade não vê a opção de todas as unidades; o global vê', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [person({ id: 'p1', fullName: 'Pessoa Um' })] },
    });
    const primeira = renderApp(['/admin/pessoas']);
    let dropdown = await abrirCampo(await editar('Pessoa Um'), 'Acompanhamento de leituras');
    expect(within(dropdown).getByText('Não acompanha')).toBeInTheDocument();
    expect(within(dropdown).getByText('Gestor do setor')).toBeInTheDocument();
    expect(within(dropdown).getByText('Gestor da unidade')).toBeInTheDocument();
    expect(within(dropdown).queryByText('Gestor de todas as unidades')).toBeNull();
    primeira.unmount();

    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /users': { status: 200, body: [person({ id: 'p1', fullName: 'Pessoa Um' })] },
      'GET /units': { status: 200, body: [] },
    });
    renderApp(['/admin/pessoas']);
    dropdown = await abrirCampo(await editar('Pessoa Um'), 'Acompanhamento de leituras');
    expect(within(dropdown).getByText('Gestor de todas as unidades')).toBeInTheDocument();
  });

  it('marcar envia o alcance; a recusa por falta de setor é explicada no campo', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [person({ id: 'p1', fullName: 'Pessoa Um' })] },
      'PATCH /users/p1': { status: 409, body: { error: 'reading_oversight_requires_sector' } },
    });
    renderApp(['/admin/pessoas']);

    const dialog = await editar('Pessoa Um');
    const dropdown = await abrirCampo(dialog, 'Acompanhamento de leituras');
    await userEvent.click(within(dropdown).getByText('Gestor do setor'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(corposDe('PATCH', '/users/p1')[0]).toMatchObject({
        readingOversight: ReadingOversight.SECTOR,
      }),
    );
    expect(await within(dialog).findByText(/Gestor do setor precisa de um setor/)).toBeTruthy();
    // O formulário continua aberto, com o preenchimento.
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Pessoa Um');
  });

  it('"Não acompanha" envia null, retirando a marcação', async () => {
    const marcada = person({ id: 'p1', fullName: 'Pessoa Um', readingOversight: 'unit' });
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [marcada] },
      'PATCH /users/p1': { status: 200, body: { ...marcada, readingOversight: null } },
    });
    renderApp(['/admin/pessoas']);

    const dialog = await editar('Pessoa Um');
    const dropdown = await abrirCampo(dialog, 'Acompanhamento de leituras');
    await userEvent.click(within(dropdown).getByText('Não acompanha'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(corposDe('PATCH', '/users/p1')[0]).toMatchObject({ readingOversight: null }),
    );
  });

  it('o administrador da unidade não mexe em quem tem todas as unidades: campo travado e não enviado', async () => {
    const governanca = person({ id: 'p1', fullName: 'Mariana', readingOversight: 'all_units' });
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /users': { status: 200, body: [governanca] },
      'PATCH /users/p1': { status: 200, body: governanca },
    });
    renderApp(['/admin/pessoas']);

    const dialog = await editar('Mariana');
    const item = within(dialog)
      .getByText('Acompanhamento de leituras')
      .closest('.ant-form-item') as HTMLElement;
    expect(within(item).getByText('Gestor de todas as unidades')).toBeInTheDocument();
    expect(item.querySelector('.ant-select-disabled')).not.toBeNull();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corposDe('PATCH', '/users/p1')).toHaveLength(1));
    expect(corposDe('PATCH', '/users/p1')[0]).not.toHaveProperty('readingOversight');
  });
});
