import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DocumentStatus, DocumentType, ReadingStatus, UserRole } from '@gdoc/shared';
import type { FileSummaryResponse, MyReadingResponse } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function arquivo(over: Partial<FileSummaryResponse> = {}): FileSummaryResponse {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
    id: 'file-1',
    ownerId: 'user-9',
    folderId: null,
    fileName: 'POP-CME-001 Limpeza.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    status: 'active',
    createdAt: '2026-10-02T10:00:00.000Z',
    documentType: DocumentType.PROCEDURE,
    documentCode: 'POP-CME-001',
    documentRevision: 3,
    documentStatus: DocumentStatus.CURRENT,
    ...over,
  };
}

function leitura(over: Partial<MyReadingResponse> = {}): MyReadingResponse {
  return {
    assignmentId: 'a-1',
    campaignId: 'c-1',
    status: ReadingStatus.PENDING,
    dueDate: '2026-11-20',
    acknowledgedAt: null,
    documentRevision: 3,
    documentCode: 'POP-CME-001',
    documentTitle: 'Limpeza',
    message: 'Leiam antes da auditoria.',
    file: arquivo(),
    ...over,
  };
}

const PENDENTE = leitura();
const ATRASADA = leitura({
  assignmentId: 'a-2',
  campaignId: 'c-2',
  status: ReadingStatus.LATE,
  dueDate: '2026-10-01',
  documentCode: 'PRT-NSP-001',
  documentTitle: 'Higienização das mãos',
  message: null,
  file: arquivo({ id: 'file-2', fileName: 'PRT-NSP-001.pdf', documentCode: 'PRT-NSP-001' }),
});
const CONCLUIDA = leitura({
  assignmentId: 'a-3',
  campaignId: 'c-3',
  status: ReadingStatus.DONE,
  acknowledgedAt: '2026-10-20T13:45:00.000Z',
  documentCode: 'POL-QUA-002',
  documentTitle: 'Política da qualidade',
  file: null,
});
const ENCERRADA = leitura({
  assignmentId: 'a-4',
  campaignId: 'c-4',
  status: ReadingStatus.CLOSED,
  documentCode: 'MAN-ADM-009',
  documentTitle: 'Manual antigo',
  file: null,
});

function minhas(items: MyReadingResponse[]) {
  return { status: 200, body: { items } };
}

/**
 * Superfícies de pendência da leitura obrigatória (US 12.4, change
 * `superficies-de-pendencia`): contador no menu, destino com abas, cartão do
 * Início e ícone na linha do explorador.
 */
describe('Item Leitura obrigatória no menu (web-shell-e-auth)', () => {
  it('aparece para colaborador, entre compartilhados e lixeira, com o contador das abertas', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /reading/mine': minhas([ATRASADA, PENDENTE, CONCLUIDA, ENCERRADA]),
    });
    renderApp(['/']);

    const item = await screen.findByRole('link', { name: 'Leitura obrigatória, 2 pendentes' });
    expect(item).toHaveAttribute('href', '/leituras');
    expect(within(item).getByText('2')).toBeInTheDocument();

    const nav = within(screen.getByRole('menu'));
    const nomes = nav.getAllByRole('link').map((l) => l.textContent ?? '');
    const pos = (texto: string) => nomes.findIndex((n) => n.startsWith(texto));
    expect(pos('Compartilhados comigo')).toBeLessThan(pos('Leitura obrigatória'));
    expect(pos('Leitura obrigatória')).toBeLessThan(pos('Lixeira'));
  });

  it('sem leitura aberta, o item aparece sem contador', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /reading/mine': minhas([CONCLUIDA, ENCERRADA]),
    });
    renderApp(['/']);

    const item = await screen.findByRole('link', { name: 'Leitura obrigatória' });
    await waitFor(() => expect(item.textContent).toBe('Leitura obrigatória'));
  });
});

describe('Destino Leitura obrigatória (leitura-obrigatoria)', () => {
  it('Pendentes traz atrasada primeiro e sinalizada; encerrada não aparece; Concluídas traz a data', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /reading/mine': minhas([ATRASADA, PENDENTE, CONCLUIDA, ENCERRADA]),
    });
    renderApp(['/leituras']);

    expect(await screen.findByRole('tab', { name: 'Pendentes (2)' })).toBeInTheDocument();
    const linhas = (await screen.findAllByRole('row')).slice(1);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.textContent).toContain('PRT-NSP-001 - Higienização das mãos · Rev. 03');
    expect(within(linhas[0]!).getByText('Atrasada')).toBeInTheDocument();
    expect(linhas[0]!.textContent).toContain('01/10/2026');
    expect(within(linhas[1]!).getByText('Pendente')).toBeInTheDocument();
    expect(linhas[1]!.textContent).toContain('Leiam antes da auditoria.');
    expect(screen.queryByText(/Manual antigo/)).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Concluídas (1)' }));
    const concluida = (await screen.findByText(/POL-QUA-002 - Política da qualidade/)).closest(
      'tr',
    ) as HTMLElement;
    expect(concluida.textContent).toMatch(/20\/10\/2026/);
    expect(screen.queryByText(/Manual antigo/)).toBeNull();
  });

  it('"Ler e confirmar ciência" abre o visualizador; confirmada, a leitura vai para Concluídas', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    let confirmou = false;
    const concluida = {
      ...PENDENTE,
      status: ReadingStatus.DONE,
      acknowledgedAt: new Date().toISOString(),
    };
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /reading/mine': () => minhas([confirmou ? concluida : PENDENTE]),
      'POST /files/file-1/view-url': {
        status: 200,
        body: {
          previewAvailable: true,
          url: 'https://storage.example/pop.pdf?sig=abc',
          expiresAt: '2026-11-05T10:05:00.000Z',
          action: 'view',
        },
      },
      'POST /reading/assignments/a-1/acknowledge': () => {
        confirmou = true;
        return { status: 204 };
      },
    });
    renderApp(['/leituras']);

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Ler e confirmar ciência: POP-CME-001 - Limpeza',
      }),
    );
    const dialogo = await screen.findByRole('dialog');
    const botao = await within(dialogo).findByRole('button', { name: 'Confirmar ciência' });
    // O atalho só abriu: a ciência continua esperando o documento carregar.
    expect(botao).toBeDisabled();
    fireEvent.load(await within(dialogo).findByTitle('POP-CME-001 Limpeza.pdf'));
    await waitFor(() => expect(botao).toBeEnabled());
    await userEvent.click(botao);
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('tab', { name: 'Pendentes (0)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Concluídas (1)' })).toBeInTheDocument();
  });

  it('leitura aberta sem documento alcançável não oferece o botão', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /reading/mine': minhas([{ ...PENDENTE, file: null }]),
    });
    renderApp(['/leituras']);

    expect(await screen.findByText('Documento indisponível')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ler e confirmar ciência/ })).toBeNull();
  });
});

describe('Cartão Leitura obrigatória do Início (tela-inicial)', () => {
  it('lista as abertas com prazo, atrasada sinalizada, e o botão abre o visualizador', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /reading/mine': minhas([ATRASADA, PENDENTE, CONCLUIDA]),
      'POST /files/file-1/view-url': {
        status: 200,
        body: { previewAvailable: false, reason: 'unsupported_format' },
      },
    });
    renderApp(['/']);

    const coluna = await screen.findByRole('complementary', {
      name: 'Leitura obrigatória e avisos',
    });
    expect(
      await within(coluna).findByText('PRT-NSP-001 - Higienização das mãos · Rev. 03'),
    ).toBeInTheDocument();
    expect(within(coluna).getByText('Atrasada')).toBeInTheDocument();
    expect(within(coluna).getByText('Prazo: 20/11/2026')).toBeInTheDocument();
    expect(within(coluna).queryByText(/Política da qualidade/)).toBeNull();
    expect(within(coluna).getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/leituras',
    );

    await userEvent.click(
      within(coluna).getByRole('button', {
        name: 'Ler e confirmar ciência: POP-CME-001 - Limpeza',
      }),
    );
    expect(await screen.findByRole('dialog')).toHaveTextContent('POP-CME-001 Limpeza.pdf');
  });

  it('sem pendências, diz que não há nenhuma', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /reading/mine': minhas([CONCLUIDA]),
    });
    renderApp(['/']);

    const coluna = await screen.findByRole('complementary', {
      name: 'Leitura obrigatória e avisos',
    });
    expect(
      await within(coluna).findByText('Nenhuma leitura obrigatória pendente.'),
    ).toBeInTheDocument();
  });
});

describe('Ícone de leitura obrigatória no explorador (web-navegacao)', () => {
  it('só a linha com a revisão vigente marcada mostra o ícone; sem veredito, sem ícone', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': {
        status: 200,
        body: {
          folder: null,
          breadcrumb: [],
          folders: [],
          files: [
            arquivo({ requiredReading: true }),
            arquivo({ id: 'file-2', fileName: 'outro.pdf', requiredReading: false }),
            arquivo({ id: 'file-3', fileName: 'antigo.pdf' }),
          ],
          canUpload: false,
        },
      },
    });
    renderApp(['/pastas']);

    const linha = (nome: string) => screen.getByText(nome).closest('tr') as HTMLElement;
    await screen.findByText('POP-CME-001 Limpeza.pdf');
    expect(
      within(linha('POP-CME-001 Limpeza.pdf')).getByRole('img', { name: 'Leitura obrigatória' }),
    ).toBeInTheDocument();
    expect(
      within(linha('outro.pdf')).queryByRole('img', { name: 'Leitura obrigatória' }),
    ).toBeNull();
    expect(
      within(linha('antigo.pdf')).queryByRole('img', { name: 'Leitura obrigatória' }),
    ).toBeNull();
  });
});
