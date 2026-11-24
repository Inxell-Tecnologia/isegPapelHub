import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReadingStatus, UserRole } from '@gdoc/shared';
import type { OversightCampaignResponse, OversightPersonResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';
import { filtrarPessoas, montarRelatorio } from '../leitura/exportar-relatorio';

// A geração do arquivo é do navegador (design.md D6); aqui só se verifica o
// que a tela manda exportar — a montagem real, as bibliotecas substituídas.
const exportados = vi.hoisted(() => ({ excel: vi.fn(), pdf: vi.fn() }));
vi.mock('../leitura/exportar-relatorio', async (original) => ({
  ...(await original<typeof import('../leitura/exportar-relatorio')>()),
  exportarExcel: exportados.excel,
  exportarPdf: exportados.pdf,
}));

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

const MARCACAO: OversightCampaignResponse = {
  id: 'c-1',
  unitId: 'unit-1',
  unitName: 'Sede ISETES',
  documentCode: 'PRT-NSP-001',
  documentTitle: 'Higienização das mãos',
  documentRevision: 2,
  dueDate: '2026-11-20',
  createdAt: '2026-11-05T10:00:00.000Z',
  inProgress: true,
  scope: 'full',
  scopeSectorName: null,
  total: 4,
  done: 2,
  pending: 1,
  late: 1,
  closed: 0,
  adherence: 50,
};

function pessoa(over: Partial<OversightPersonResponse>): OversightPersonResponse {
  return {
    assignmentId: 'a-x',
    name: 'X',
    unitName: 'Sede ISETES',
    sectorName: 'CME',
    status: ReadingStatus.PENDING,
    dueDate: '2026-11-20',
    acknowledgedAt: null,
    ...over,
  };
}

const PESSOAS = [
  pessoa({
    assignmentId: 'a-1',
    name: 'Ana',
    status: ReadingStatus.DONE,
    acknowledgedAt: '2026-11-06T13:45:00.000Z',
  }),
  pessoa({
    assignmentId: 'a-2',
    name: 'Bruno',
    status: ReadingStatus.DONE,
    acknowledgedAt: '2026-11-07T09:00:00.000Z',
  }),
  pessoa({ assignmentId: 'a-3', name: 'Carla', sectorName: 'UTI', status: ReadingStatus.LATE }),
  pessoa({ assignmentId: 'a-4', name: 'Davi', sectorName: null }),
];

function rotas(available: boolean) {
  return {
    'GET /auth/me': { status: 200, body: IDENTITY },
    'GET /reading/mine': { status: 200, body: { items: [] } },
    'GET /reading/oversight': {
      status: 200,
      body: { available, campaigns: available ? [MARCACAO] : [] },
    },
    'GET /reading/oversight/campaigns/c-1': {
      status: 200,
      body: { campaign: MARCACAO, people: PESSOAS },
    },
  };
}

async function escolher(rotulo: string, opcao: string) {
  const combobox = screen.getByRole('combobox', { name: rotulo });
  await userEvent.click(combobox);
  const dropdown = await waitFor(() => {
    const id = combobox.getAttribute('aria-controls') ?? combobox.getAttribute('aria-owns');
    const el = id ? document.getElementById(id)?.closest('.ant-select-dropdown') : null;
    if (!el) throw new Error('dropdown ainda não está no DOM');
    return el as HTMLElement;
  });
  await userEvent.click(await within(dropdown).findByText(opcao));
}

const linhasDaTabela = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.textContent ?? '');

/** Acompanhamento de leituras na SPA (US 12.6, change `acompanhamento-de-leituras`). */
describe('Aba Acompanhamento (leitura-obrigatoria)', () => {
  beforeEach(() => {
    exportados.excel.mockReset();
    exportados.pdf.mockReset();
  });

  it('sem nada a acompanhar, só Pendentes e Concluídas', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas(false));
    renderApp(['/leituras?aba=acompanhamento']);
    expect(await screen.findByRole('tab', { name: /Pendentes/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Acompanhamento' })).toBeNull());
  });

  it('lista a marcação com os números e abre o relatório', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas(true));
    renderApp(['/leituras']);

    await userEvent.click(await screen.findByRole('tab', { name: 'Acompanhamento' }));
    const linha = (await screen.findByText(/PRT-NSP-001 - Higienização das mãos/)).closest(
      'tr',
    ) as HTMLElement;
    expect(linha.textContent).toContain('Sede ISETES');
    expect(linha.textContent).toContain('Em curso');
    expect(linha.textContent).toContain('50%');

    await userEvent.click(
      within(linha).getByRole('button', { name: 'Ver relatório: PRT-NSP-001' }),
    );
    expect(await screen.findByText('4 de 4 pessoa(s)')).toBeInTheDocument();
    expect(linhasDaTabela()).toHaveLength(4);
    expect(screen.getByText('Sem setor')).toBeInTheDocument();
  });

  it('o endereço abre direto o relatório, e filtrar restringe a lista e a exportação', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas(true));
    renderApp(['/leituras?aba=acompanhamento&marcacao=c-1']);

    expect(await screen.findByText('4 de 4 pessoa(s)')).toBeInTheDocument();
    await escolher('Filtrar por situação', 'Atrasada');
    expect(await screen.findByText('1 de 4 pessoa(s)')).toBeInTheDocument();
    expect(linhasDaTabela()[0]).toContain('Carla');

    await userEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    await waitFor(() => expect(exportados.excel).toHaveBeenCalledTimes(1));
    const montado = exportados.excel.mock.calls[0]![0];
    expect(montado.nomeDoArquivo).toBe('acompanhamento-PRT-NSP-001-rev02');
    expect(montado.linhas).toEqual([
      ['Carla', 'Sede ISETES', 'UTI', 'Atrasada', '20/11/2026', '—'],
    ]);
    expect(montado.cabecalho).toContainEqual(['Filtros', 'Situação: Atrasada']);
    expect(montado.cabecalho).toContainEqual(['Adesão', '50%']);

    await userEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    await waitFor(() => expect(exportados.pdf).toHaveBeenCalledTimes(1));
    expect(exportados.pdf.mock.calls[0]![0].linhas).toHaveLength(1);
  });

  it('marcação fora do alcance mostra que o relatório não está disponível', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...rotas(true),
      'GET /reading/oversight/campaigns/c-9': { status: 404, body: { error: 'not_found' } },
    });
    renderApp(['/leituras?aba=acompanhamento&marcacao=c-9']);
    expect(await screen.findByText('Relatório não disponível')).toBeInTheDocument();
  });
});

describe('Montagem do relatório (exportar-relatorio.ts)', () => {
  it('filtra por unidade, setor e situação combinados, e descreve os filtros', () => {
    const filtros = { unidade: 'Sede ISETES', setor: 'CME', situacao: ReadingStatus.DONE };
    const filtradas = filtrarPessoas(PESSOAS, filtros);
    expect(filtradas.map((p) => p.name)).toEqual(['Ana', 'Bruno']);
    const r = montarRelatorio(
      { ...MARCACAO, scope: 'sector', scopeSectorName: 'CME' },
      filtradas,
      filtros,
    );
    expect(r.cabecalho).toContainEqual([
      'Filtros',
      'Unidade: Sede ISETES; Setor: CME; Situação: Concluída',
    ]);
    expect(r.cabecalho).toContainEqual(['Alcance', 'Sua equipe (setor CME)']);
    expect(r.colunas).toEqual(['Nome', 'Unidade', 'Setor', 'Situação', 'Prazo', 'Ciência em']);
    expect(r.linhas[0]![5]).toMatch(/06\/11\/2026/);
  });
});
