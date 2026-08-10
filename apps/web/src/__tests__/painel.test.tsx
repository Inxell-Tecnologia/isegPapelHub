import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileCategory, UserRole } from '@gdoc/shared';
import type { DashboardResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const UNIT_ADMIN = { id: 'admin-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };

const MONTHS = [
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
];

const MONTH_LABELS = [
  'ago/25',
  'set/25',
  'out/25',
  'nov/25',
  'dez/25',
  'jan/26',
  'fev/26',
  'mar/26',
  'abr/26',
  'mai/26',
  'jun/26',
  'jul/26',
];

const CATEGORY_LABELS = [
  'Imagens',
  'Vídeos',
  'Áudios',
  'PDFs',
  'Documentos de escritório',
  'Texto',
  'Outros',
];

function dashboardResponse(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    cards: { totalFiles: 10, totalPeople: 3, usedBytes: 50 * 1024 * 1024, quotaUsedPct: 0.25 },
    filesByType: [
      { category: FileCategory.PDF, count: 6 },
      { category: FileCategory.IMAGE, count: 4 },
    ],
    uploadsByMonth: MONTHS.map((month) => ({ month, count: 0 })),
    storage: {
      usedBytes: 10 * 1024 ** 3,
      quotaBytesPerUser: 10 * 1024 ** 3,
      userCount: 4,
      capacityBytes: 40 * 1024 ** 3,
      availableBytes: 30 * 1024 ** 3,
    },
    ...overrides,
  };
}

/** Linha do `GraficoBarras`: `label` e valor visível são os dois primeiros/últimos filhos do container da linha. */
function barValue(card: HTMLElement, label: string): string {
  const row = within(card).getByText(label).parentElement!;
  return row.lastElementChild!.textContent ?? '';
}

describe('Painel gerencial da SPA (web-painel)', () => {
  it('administrador vê os quatro cartões e os três blocos com os números do servidor (US 8.2 cenário 1)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /dashboard': { status: 200, body: dashboardResponse() },
    });

    renderApp(['/admin/painel']);

    await screen.findByText('Total de arquivos');
    expect(screen.getByText('Total de arquivos').closest('.ant-statistic')).toHaveTextContent('10');
    expect(screen.getByText('Total de pessoas').closest('.ant-statistic')).toHaveTextContent('3');
    expect(screen.getByText('Espaço utilizado').closest('.ant-statistic')).toHaveTextContent(
      '50.0 MB',
    );
    expect(screen.getByText('Cota utilizada').closest('.ant-statistic')).toHaveTextContent('25.0');

    expect(screen.getByText('Arquivos por tipo')).toBeInTheDocument();
    expect(screen.getByText('Envios por mês')).toBeInTheDocument();
    expect(screen.getByText('Espaço utilizado × disponível')).toBeInTheDocument();
  });

  it('exibe um indicador de carregamento antes de GET /dashboard responder, sem cartões nem gráficos parciais (spec: estado de carregamento)', async () => {
    let resolveDashboard!: (response: Response) => void;
    const dashboardPromise = new Promise<Response>((resolve) => {
      resolveDashboard = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const path = new URL(url, 'http://localhost').pathname;
        const method = (init?.method ?? 'GET').toUpperCase();
        if (method === 'GET' && path === '/auth/me') {
          return new Response(JSON.stringify(UNIT_ADMIN), { status: 200 });
        }
        if (method === 'GET' && path === '/dashboard') {
          return dashboardPromise;
        }
        return new Response(JSON.stringify({ error: 'unmocked_route' }), { status: 404 });
      }),
    );

    renderApp(['/admin/painel']);

    // marca que a autenticação já resolveu e o shell (com o próprio Painel) montou
    await screen.findByRole('img', { name: 'PapelHub' });
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
    expect(screen.queryByText('Total de arquivos')).not.toBeInTheDocument();

    resolveDashboard(new Response(JSON.stringify(dashboardResponse()), { status: 200 }));

    await screen.findByText('Total de arquivos');
    expect(document.querySelector('.ant-spin')).not.toBeInTheDocument();
  });

  it('série de 12 meses: 12 barras, ordem cronológica, rótulos pt-BR, zeros visíveis (spec: série de 12 meses)', async () => {
    const uploadsByMonth = MONTHS.map((month, index) => ({ month, count: index === 11 ? 5 : 0 }));
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /dashboard': { status: 200, body: dashboardResponse({ uploadsByMonth }) },
    });

    renderApp(['/admin/painel']);
    await screen.findByText('Envios por mês');

    const card = screen.getByText('Envios por mês').closest('.ant-card') as HTMLElement;
    const labelEls = within(card).getAllByText((content) => MONTH_LABELS.includes(content));
    expect(labelEls.map((el) => el.textContent)).toEqual(MONTH_LABELS);

    expect(barValue(card, 'ago/25')).toBe('0');
    expect(barValue(card, 'jul/26')).toBe('5');
  });

  it('categorias: sete rótulos pt-BR na ordem fixa, zero nas ausentes da resposta (spec: categorias com rótulo pt-BR)', async () => {
    // servidor retorna só um subconjunto, fora da ordem de apresentação
    const filesByType = [
      { category: FileCategory.TEXT, count: 2 },
      { category: FileCategory.IMAGE, count: 5 },
    ];
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /dashboard': { status: 200, body: dashboardResponse({ filesByType }) },
    });

    renderApp(['/admin/painel']);
    await screen.findByText('Arquivos por tipo');

    const card = screen.getByText('Arquivos por tipo').closest('.ant-card') as HTMLElement;
    const labelEls = within(card).getAllByText((content) => CATEGORY_LABELS.includes(content));
    expect(labelEls.map((el) => el.textContent)).toEqual(CATEGORY_LABELS);

    expect(barValue(card, 'Imagens')).toBe('5');
    expect(barValue(card, 'Texto')).toBe('2');
    expect(barValue(card, 'Vídeos')).toBe('0');
    expect(barValue(card, 'Áudios')).toBe('0');
    expect(barValue(card, 'PDFs')).toBe('0');
    expect(barValue(card, 'Documentos de escritório')).toBe('0');
    expect(barValue(card, 'Outros')).toBe('0');
  });

  it('usado × disponível coerente com `storage` — proporção e absolutos, sem recálculo (spec: usado × disponível coerente com storage)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /dashboard': { status: 200, body: dashboardResponse() },
    });

    renderApp(['/admin/painel']);
    await screen.findByText('Espaço utilizado × disponível');

    const card = screen
      .getByText('Espaço utilizado × disponível')
      .closest('.ant-card') as HTMLElement;
    expect(
      within(card).getByText('10.0 GB usados de 40.0 GB — 30.0 GB disponíveis'),
    ).toBeInTheDocument();
    expect(within(card).getByText('25%')).toBeInTheDocument();
  });

  it('repositório vazio: cartões e barras zerados, sem mensagem de erro (spec: repositório vazio não é erro)', async () => {
    const empty = dashboardResponse({
      cards: { totalFiles: 0, totalPeople: 0, usedBytes: 0, quotaUsedPct: 0 },
      filesByType: [],
      uploadsByMonth: MONTHS.map((month) => ({ month, count: 0 })),
      storage: {
        usedBytes: 0,
        quotaBytesPerUser: 10 * 1024 ** 3,
        userCount: 0,
        capacityBytes: 0,
        availableBytes: 0,
      },
    });
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /dashboard': { status: 200, body: empty },
    });

    renderApp(['/admin/painel']);
    await screen.findByText('Total de arquivos');

    expect(screen.getByText('Total de arquivos').closest('.ant-statistic')).toHaveTextContent('0');
    const tipoCard = screen.getByText('Arquivos por tipo').closest('.ant-card') as HTMLElement;
    expect(barValue(tipoCard, 'Imagens')).toBe('0');
    expect(barValue(tipoCard, 'Outros')).toBe('0');

    expect(screen.queryByText(/não foi possível/i)).not.toBeInTheDocument();
  });

  it('403 em GET /dashboard exibe o aviso neutro, sem números (spec: 403 exibe aviso neutro sem dados)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: UNIT_ADMIN },
      'GET /dashboard': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/admin/painel']);

    await screen.findByText('Sem permissão');
    expect(screen.queryByText('Total de arquivos')).not.toBeInTheDocument();
    expect(screen.queryByText('Arquivos por tipo')).not.toBeInTheDocument();
  });
});
