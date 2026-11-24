import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GrantResourceType, NotificationKind, Permission, UserRole } from '@gdoc/shared';
import type { NotificationResponse } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

const DOCUMENTO = {
  campaignId: 'c-1',
  documentCode: 'PRT-NSP-001',
  documentTitle: 'Higienização das mãos',
  documentRevision: 2,
};

const ATRASO_DA_EQUIPE: NotificationResponse = {
  id: 'n-3',
  kind: NotificationKind.READING_OVERDUE_TEAM,
  payload: {
    ...DOCUMENTO,
    dueDate: '2026-11-01',
    lateCount: 3,
    people: [
      { name: 'Ana Leitora', sectorName: 'CME' },
      { name: 'Bruno Leitor', sectorName: null },
    ],
  },
  createdAt: '2026-11-05T06:45:00.000Z',
  readAt: null,
};
const ATRASO: NotificationResponse = {
  id: 'n-2',
  kind: NotificationKind.READING_OVERDUE,
  payload: { ...DOCUMENTO, assignmentId: 'a-1', dueDate: '2026-11-01' },
  createdAt: '2026-11-04T06:45:00.000Z',
  readAt: null,
};
const NOVA: NotificationResponse = {
  id: 'n-1',
  kind: NotificationKind.READING_ASSIGNED,
  payload: { ...DOCUMENTO, assignmentId: 'a-1', dueDate: '2026-11-01' },
  createdAt: '2026-10-17T13:00:00.000Z',
  readAt: '2026-10-17T14:00:00.000Z',
};
const CONCESSAO: NotificationResponse = {
  id: 'n-0',
  kind: NotificationKind.GRANT_CREATED,
  payload: {
    resourceType: GrantResourceType.FILE,
    resourceId: 'f-9',
    permissions: [Permission.VIEW],
    expiresAt: '2026-12-01T00:00:00.000Z',
  },
  createdAt: '2026-11-05T07:00:00.000Z',
  readAt: null,
};

function rotas(notifications: NotificationResponse[]) {
  return {
    ...ROTAS_DA_TELA_INICIAL,
    'GET /auth/me': { status: 200, body: IDENTITY },
    'GET /notifications': { status: 200, body: { notifications } },
    'GET /notifications/unread-count': {
      status: 200,
      body: { count: notifications.filter((n) => !n.readAt).length },
    },
  };
}

/** Avisos de leitura obrigatória na SPA (US 12.5, change `avisos-e-atrasos`). */
describe('Avisos de leitura obrigatória no sino (notificacoes)', () => {
  it('apresenta os três avisos, e os do leitor levam às próprias leituras', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas([ATRASO_DA_EQUIPE, ATRASO, NOVA]));
    renderApp(['/recentes']);

    await userEvent.click(await screen.findByRole('button', { name: /^Notificações/ }));
    const equipe = await screen.findByText(
      '3 pessoas da sua equipe estão com a leitura obrigatória de PRT-NSP-001 - Higienização das mãos, Rev. 02 atrasada (prazo 01/11/2026): Ana Leitora (CME), Bruno Leitor e mais 1.',
    );
    const atraso = screen.getByText(
      'Sua leitura obrigatória de PRT-NSP-001 - Higienização das mãos, Rev. 02 está atrasada: o prazo era 01/11/2026. Ela continua aberta para você confirmar a ciência.',
    );
    expect(
      screen.getByText(
        'Nova leitura obrigatória: PRT-NSP-001 - Higienização das mãos, Rev. 02. Prazo: 01/11/2026.',
      ),
    ).toBeInTheDocument();

    // O do gestor leva ao relatório da marcação (change
    // `acompanhamento-de-leituras`, design.md D7); o do leitor, às leituras.
    const itemDe = (el: HTMLElement) => el.closest('li') as HTMLElement;
    expect(
      within(itemDe(equipe)).getByRole('link', { name: 'Abrir acompanhamento' }),
    ).toHaveAttribute('href', '/leituras?aba=acompanhamento&marcacao=c-1');
    const link = within(itemDe(atraso)).getByRole('link', { name: 'Abrir leituras' });
    expect(link).toHaveAttribute('href', '/leituras');
  });
});

describe('Cartão Avisos do Início (tela-inicial)', () => {
  it('lista só os avisos de leitura, o mais recente primeiro, até três', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas([CONCESSAO, ATRASO_DA_EQUIPE, ATRASO, NOVA]));
    renderApp(['/']);

    const coluna = await screen.findByRole('complementary', {
      name: 'Leitura obrigatória e avisos',
    });
    const cartao = (await within(coluna).findByText('Avisos')).closest('.ant-card') as HTMLElement;
    const itens = await within(cartao).findAllByRole('listitem');
    expect(itens).toHaveLength(3);
    expect(itens[0]!.textContent).toMatch(/^3 pessoas da sua equipe/);
    expect(itens[1]!.textContent).toMatch(/^Sua leitura obrigatória/);
    expect(itens[2]!.textContent).toMatch(/^Nova leitura obrigatória/);
    expect(cartao.textContent).not.toMatch(/Você recebeu acesso/);
    expect(within(itens[1]!).getByRole('link', { name: 'Abrir leituras' })).toHaveAttribute(
      'href',
      '/leituras',
    );
  });

  it('sem aviso de leitura, diz que não há e aponta o sino para os demais', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas([CONCESSAO]));
    renderApp(['/']);

    const coluna = await screen.findByRole('complementary', {
      name: 'Leitura obrigatória e avisos',
    });
    expect(
      await within(coluna).findByText(
        'Nenhum aviso de leitura obrigatória. Os demais avisos continuam no sino, no topo da tela.',
      ),
    ).toBeInTheDocument();
  });
});
