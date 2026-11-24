import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentStatus, DocumentType, UserRole } from '@gdoc/shared';
import type {
  FileSummaryResponse,
  MyReadingResponse,
  ReadingCampaignResponse,
  ReadingFileStateResponse,
} from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function arquivo(over: Partial<FileSummaryResponse> = {}): FileSummaryResponse {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
    id: 'file-1',
    ownerId: 'user-1',
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
    canEditControl: true,
    ...over,
  };
}

function conteudo(files: FileSummaryResponse[]) {
  return {
    status: 200,
    body: { folder: null, breadcrumb: [], folders: [], files, canUpload: true },
  };
}

function estado(over: Partial<ReadingFileStateResponse> = {}): ReadingFileStateResponse {
  return {
    canMark: true,
    ineligibleReason: null,
    currentRevision: 3,
    current: null,
    previous: null,
    ...over,
  };
}

const CAMPANHA_ANTERIOR: ReadingCampaignResponse = {
  id: 'camp-0',
  fileId: 'file-1',
  documentRevision: 2,
  documentCode: 'POP-CME-001',
  documentTitle: 'POP-CME-001 Limpeza.pdf',
  audience: { wholeUnit: false, sectorIds: ['setor-cme'], roles: [], userIds: [] },
  dueDate: '2026-09-01',
  message: null,
  createdAt: '2026-08-15T10:00:00.000Z',
  assignedCount: 4,
};

const OPCOES = {
  status: 200,
  body: {
    sectors: [{ id: 'setor-cme', name: 'CME' }],
    people: [{ id: 'p-1', name: 'Maria', sectorName: 'CME' }],
  },
};

function corposDe(method: string, path: string): Record<string, unknown>[] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(
      (c) => String(c[0]).includes(path) && (c[1] as RequestInit | undefined)?.method === method,
    )
    .map((c) => JSON.parse(String((c[1] as RequestInit).body)));
}

async function dialogo(titulo: string): Promise<HTMLElement> {
  return waitFor(() => {
    const d = screen.getAllByRole('dialog').find((el) => el.textContent?.includes(titulo));
    if (!d) throw new Error(`dialog "${titulo}" ainda não está no DOM`);
    return d;
  });
}

/**
 * Leitura obrigatória na SPA (US 12.2/12.3, change `leitura-obrigatoria`).
 */
describe('Marcar leitura obrigatória no explorador (web-navegacao)', () => {
  it('a ação só aparece para quem edita os dados de controle', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': conteudo([
        arquivo(),
        arquivo({ id: 'file-2', fileName: 'alheio.pdf', canEditControl: false }),
      ]),
    });
    renderApp(['/pastas']);

    const linha = (nome: string) => screen.getByText(nome).closest('tr') as HTMLElement;
    await screen.findByText('POP-CME-001 Limpeza.pdf');
    expect(
      within(linha('POP-CME-001 Limpeza.pdf')).getByRole('button', { name: /Leitura obrigatória/ }),
    ).toBeInTheDocument();
    expect(
      within(linha('alheio.pdf')).queryByRole('button', { name: /Leitura obrigatória/ }),
    ).toBeNull();
  });

  it('o formulário mostra a contagem antes de confirmar e envia o público escolhido', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': conteudo([arquivo()]),
      'GET /reading/files/file-1': { status: 200, body: estado() },
      'GET /reading/files/file-1/audience-options': OPCOES,
      'POST /reading/preview': { status: 200, body: { count: 37 } },
      'POST /reading/campaigns': { status: 201, body: { ...CAMPANHA_ANTERIOR, id: 'camp-1' } },
    });
    renderApp(['/pastas']);

    const linha = (await screen.findByText('POP-CME-001 Limpeza.pdf')).closest('tr') as HTMLElement;
    await userEvent.click(within(linha).getByRole('button', { name: /Leitura obrigatória/ }));
    const d = await dialogo('Leitura obrigatória — POP-CME-001');

    await userEvent.click(within(d).getByLabelText('Toda a unidade'));
    expect(await within(d).findByText('37 pessoa(s) serão incluídas.')).toBeInTheDocument();
    expect(corposDe('POST', '/reading/preview').at(-1)).toMatchObject({
      fileId: 'file-1',
      audience: { wholeUnit: true },
    });

    await userEvent.click(within(d).getByRole('button', { name: 'Marcar leitura obrigatória' }));
    await waitFor(() => expect(corposDe('POST', '/reading/campaigns')).toHaveLength(1));
    const corpo = corposDe('POST', '/reading/campaigns')[0]!;
    expect(corpo).toMatchObject({ fileId: 'file-1', audience: { wholeUnit: true } });
    expect(corpo.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('documento não elegível explica o motivo e não oferece marcar', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': conteudo([arquivo()]),
      'GET /reading/files/file-1': {
        status: 200,
        body: estado({ ineligibleReason: 'not_in_force' }),
      },
    });
    renderApp(['/pastas']);

    const linha = (await screen.findByText('POP-CME-001 Limpeza.pdf')).closest('tr') as HTMLElement;
    await userEvent.click(within(linha).getByRole('button', { name: /Leitura obrigatória/ }));
    const d = await dialogo('Leitura obrigatória — POP-CME-001');
    expect(await within(d).findByText(/Só documento em vigor/)).toBeInTheDocument();
    expect(within(d).queryByLabelText('Toda a unidade')).toBeNull();
  });

  it('revisão nova traz o público anterior e o aviso de que a revisão mudou (design.md D9)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': conteudo([arquivo()]),
      'GET /reading/files/file-1': { status: 200, body: estado({ previous: CAMPANHA_ANTERIOR }) },
      'GET /reading/files/file-1/audience-options': OPCOES,
      'POST /reading/preview': { status: 200, body: { count: 4 } },
      'POST /reading/campaigns': { status: 201, body: { ...CAMPANHA_ANTERIOR, id: 'camp-1' } },
    });
    renderApp(['/pastas']);

    const linha = (await screen.findByText('POP-CME-001 Limpeza.pdf')).closest('tr') as HTMLElement;
    await userEvent.click(within(linha).getByRole('button', { name: /Leitura obrigatória/ }));
    const d = await dialogo('Leitura obrigatória — POP-CME-001');
    expect(await within(d).findByText(/A revisão mudou: a Rev. 02/)).toBeInTheDocument();
    expect(await within(d).findByText('4 pessoa(s) serão incluídas.')).toBeInTheDocument();

    await userEvent.click(within(d).getByRole('button', { name: 'Marcar leitura obrigatória' }));
    await waitFor(() =>
      expect(corposDe('POST', '/reading/campaigns')[0]).toMatchObject({
        audience: { sectorIds: ['setor-cme'] },
      }),
    );
  });
});

describe('Confirmar ciência no visualizador (web-visualizacao)', () => {
  const LEITURA: MyReadingResponse = {
    assignmentId: 'a-1',
    campaignId: 'camp-1',
    status: 'pending',
    dueDate: '2026-11-20',
    acknowledgedAt: null,
    documentRevision: 3,
    documentCode: 'POP-CME-001',
    documentTitle: 'POP-CME-001 Limpeza.pdf',
    message: null,
    file: arquivo({ canEditControl: false }),
  };

  function rotas(itens: MyReadingResponse[]) {
    // A lista muda quando a ciência é registrada — não na N-ésima consulta: o
    // contador do menu lê a mesma consulta (change `superficies-de-pendencia`).
    let confirmada = false;
    return {
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': conteudo([arquivo({ canEditControl: false })]),
      'POST /files/file-1/view-url': {
        status: 200,
        body: {
          previewAvailable: true,
          url: 'https://storage.example/pop.pdf?sig=abc',
          expiresAt: '2026-11-05T10:05:00.000Z',
          action: 'view',
        },
      },
      'GET /reading/mine': () => ({ status: 200, body: { items: confirmada ? [] : itens } }),
      'POST /reading/assignments/a-1/acknowledge': () => {
        confirmada = true;
        return { status: 204 };
      },
    };
  }

  async function abrir() {
    const linha = (await screen.findByText('POP-CME-001 Limpeza.pdf')).closest('tr') as HTMLElement;
    await userEvent.click(within(linha).getByRole('button', { name: 'POP-CME-001 Limpeza.pdf' }));
    return dialogo('POP-CME-001 Limpeza.pdf');
  }

  it('o botão espera o documento abrir, mostra a declaração nominal e registra a ciência', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas([LEITURA]));
    renderApp(['/pastas']);

    const d = await abrir();
    const botao = await within(d).findByRole('button', { name: 'Confirmar ciência' });
    expect(botao).toBeDisabled();

    fireEvent.load(await within(d).findByTitle('POP-CME-001 Limpeza.pdf'));
    await waitFor(() => expect(botao).toBeEnabled());

    await userEvent.click(botao);
    expect(
      await screen.findByText(
        'Declaro que li e compreendi o documento POP-CME-001 - POP-CME-001 Limpeza.pdf, Rev. 03.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.some(
          (c) =>
            String(c[0]).includes('/reading/assignments/a-1/acknowledge') &&
            (c[1] as RequestInit).method === 'POST',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(within(d).queryByRole('button', { name: 'Confirmar ciência' })).toBeNull(),
    );
  });

  it('sem leitura aberta, o rodapé não oferece confirmar ciência', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch(rotas([{ ...LEITURA, status: 'done', acknowledgedAt: '2026-11-04T10:00:00Z' }]));
    renderApp(['/pastas']);

    const d = await abrir();
    await within(d).findByTitle('POP-CME-001 Limpeza.pdf');
    expect(within(d).queryByRole('button', { name: 'Confirmar ciência' })).toBeNull();
  });
});
