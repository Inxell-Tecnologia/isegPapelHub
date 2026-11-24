import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DocumentLifecycleState, DocumentStatus, DocumentType, UserRole } from '@gdoc/shared';
import type { FileSummaryResponse, FolderContentsResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { renderApp } from './render-app';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function file(
  overrides: Partial<FileSummaryResponse> & { id: string; fileName: string },
): FileSummaryResponse {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
    ownerId: 'user-1',
    folderId: null,
    contentType: 'application/pdf',
    sizeBytes: 2048,
    status: 'active',
    createdAt: '2026-07-02T10:00:00.000Z',
    ...overrides,
  };
}

function contents(overrides: Partial<FolderContentsResponse> = {}): FolderContentsResponse {
  return { folder: null, breadcrumb: [], folders: [], files: [], canUpload: true, ...overrides };
}

/** Mesma limitação de `useId` documentada em `explorer.test.tsx`. */
async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.startsWith(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

function linhaDe(fileName: string): HTMLElement {
  const celula = screen.getByText(fileName);
  const linha = celula.closest('tr');
  if (!linha) throw new Error(`linha de "${fileName}" não encontrada`);
  return linha;
}

/**
 * Apresentação do controle documental no explorador (Épico 10, capability
 * `web-navegacao`): os dados de controle por linha, a situação **apurada pelo
 * servidor** e o caminho de edição posterior.
 */
describe('Controle documental no explorador (web-navegacao)', () => {
  it('documento controlado exibe sigla do tipo, código, revisão, responsável, prazo e situação (US 10.1, 10.3, 10.4)', async () => {
    const documento = file({
      id: 'file-1',
      fileName: 'protocolo-de-higiene.pdf',
      documentType: DocumentType.PROTOCOL,
      documentCode: 'PRT-NSP-001',
      documentRevision: 2,
      responsibleSector: 'Núcleo de Segurança do Paciente',
      nextReviewAt: '2027-03-15',
      documentStatus: DocumentStatus.DUE_SOON,
      daysUntilReview: 45,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [documento] }) },
    });

    renderApp(['/pastas']);
    const linha = await waitFor(() => linhaDe('protocolo-de-higiene.pdf'));

    // A sigla é texto, ao lado do nome: informação completa para quem não
    // distingue as cores (US 10.1 cenário 2).
    expect(within(linha).getByText('PRT')).toBeInTheDocument();
    expect(within(linha).getByText('PRT-NSP-001')).toBeInTheDocument();
    expect(within(linha).getByText('Rev. 02')).toBeInTheDocument();
    expect(within(linha).getByText('Núcleo de Segurança do Paciente')).toBeInTheDocument();
    expect(within(linha).getByText('15/03/2027')).toBeInTheDocument();
    expect(within(linha).getByText('Vence em 45 dias')).toBeInTheDocument();
  });

  it('a situação apresentada é a do servidor — a SPA não a recalcula pelo relógio do dispositivo', async () => {
    // Data **no passado** com situação `current` vinda do servidor: um
    // recálculo no cliente diria "Revisão vencida". A tela tem de dizer
    // exatamente o que o servidor apurou — dois navegadores com relógios
    // diferentes não podem discordar sobre o mesmo documento.
    const documento = file({
      id: 'file-1',
      fileName: 'relogio.pdf',
      documentType: DocumentType.POLICY,
      nextReviewAt: '2000-01-01',
      documentStatus: DocumentStatus.CURRENT,
      daysUntilReview: 900,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [documento] }) },
    });

    renderApp(['/pastas']);
    const linha = await waitFor(() => linhaDe('relogio.pdf'));
    expect(within(linha).getByText('Vigente')).toBeInTheDocument();
    expect(within(linha).queryByText('Revisão vencida')).not.toBeInTheDocument();
  });

  it('cada situação devolvida pelo servidor tem rótulo próprio', async () => {
    const files = [
      file({
        id: 'f1',
        fileName: 'vigente.pdf',
        documentStatus: DocumentStatus.CURRENT,
        nextReviewAt: '2030-01-01',
      }),
      file({
        id: 'f2',
        fileName: 'em-revisao.pdf',
        documentStatus: DocumentStatus.IN_REVIEW,
        lifecycleState: DocumentLifecycleState.IN_REVIEW,
      }),
      file({
        id: 'f3',
        fileName: 'vencida.pdf',
        documentStatus: DocumentStatus.OVERDUE,
        nextReviewAt: '2020-01-01',
        daysUntilReview: -30,
      }),
      file({
        id: 'f4',
        fileName: 'obsoleto.pdf',
        documentStatus: DocumentStatus.OBSOLETE,
        lifecycleState: DocumentLifecycleState.OBSOLETE,
      }),
      file({ id: 'f5', fileName: 'sem-controle.pdf' }),
    ];

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files }) },
    });

    renderApp(['/pastas']);
    await waitFor(() => linhaDe('vigente.pdf'));
    expect(within(linhaDe('vigente.pdf')).getByText('Vigente')).toBeInTheDocument();
    expect(within(linhaDe('em-revisao.pdf')).getByText('Em revisão')).toBeInTheDocument();
    expect(within(linhaDe('vencida.pdf')).getByText('Revisão vencida')).toBeInTheDocument();
    expect(within(linhaDe('obsoleto.pdf')).getByText('Obsoleto')).toBeInTheDocument();
    expect(
      within(linhaDe('sem-controle.pdf')).getByText('Sem controle de revisão'),
    ).toBeInTheDocument();
  });

  it('arquivo pendente de cadastro tem etiqueta própria, distinta de sem controle (US 10.9)', async () => {
    // As duas linhas têm código, revisão e prazo vazios. O que as distingue é
    // a condição apurada pelo servidor: uma está fora de circulação à espera
    // de cadastro, a outra é acervo legítimo sem controle de revisão.
    const files = [
      file({
        id: 'f1',
        fileName: 'pendente.pdf',
        documentStatus: DocumentStatus.AWAITING_REGISTRATION,
      }),
      file({ id: 'f2', fileName: 'sem-controle.pdf' }),
    ];

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files }) },
    });

    renderApp(['/pastas']);
    await waitFor(() => linhaDe('pendente.pdf'));

    expect(within(linhaDe('pendente.pdf')).getByText('Pendente de cadastro')).toBeInTheDocument();
    expect(
      within(linhaDe('pendente.pdf')).queryByText('Sem controle de revisão'),
    ).not.toBeInTheDocument();
    expect(
      within(linhaDe('sem-controle.pdf')).getByText('Sem controle de revisão'),
    ).toBeInTheDocument();
  });

  it('Arquivo geral aparece com a sua sigla e sem situação de revisão (US 10.8)', async () => {
    const geral = file({
      id: 'f1',
      fileName: 'ata-da-reuniao.pdf',
      documentType: DocumentType.GENERAL_FILE,
      documentStatus: DocumentStatus.NOT_APPLICABLE,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [geral] }) },
    });

    renderApp(['/pastas']);
    const linha = await waitFor(() => linhaDe('ata-da-reuniao.pdf'));

    // A sigla é apresentada: sem ela, o Arquivo geral pareceria arquivo **sem**
    // tipo, que é a condição da qual ele precisa se distinguir.
    expect(within(linha).getByText('ARQ')).toBeInTheDocument();
    // Nenhuma etiqueta de situação — nem "Sem controle de revisão", que seria
    // uma afirmação falsa sobre um arquivo que declara não ter prazo.
    for (const rotulo of [
      'Vigente',
      'A vencer',
      'Em revisão',
      'Revisão vencida',
      'Obsoleto',
      'Sem controle de revisão',
      'Pendente de cadastro',
    ]) {
      expect(within(linha).queryByText(rotulo)).not.toBeInTheDocument();
    }
  });

  it('situação desconhecida não quebra a listagem', async () => {
    // Servidor mais novo que esta SPA. Antes, o `default` do rótulo respondia
    // "Sem controle de revisão" a qualquer valor não previsto — uma afirmação
    // sobre o documento em lugar de um fallback neutro.
    const files = [
      file({
        id: 'f1',
        fileName: 'situacao-do-futuro.pdf',
        documentStatus: 'situacao_que_ainda_nao_existe' as never,
      }),
      file({
        id: 'f2',
        fileName: 'vizinha-vigente.pdf',
        documentStatus: DocumentStatus.CURRENT,
        nextReviewAt: '2030-01-01',
      }),
    ];

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files }) },
    });

    renderApp(['/pastas']);
    const linha = await waitFor(() => linhaDe('situacao-do-futuro.pdf'));

    expect(within(linha).queryByText('Sem controle de revisão')).not.toBeInTheDocument();
    // A linha é apresentada, e a vizinha também: o valor desconhecido não
    // impede a apresentação do restante da listagem.
    expect(within(linhaDe('vizinha-vigente.pdf')).getByText('Vigente')).toBeInTheDocument();
  });

  it('arquivo sem dados de controle mostra ausência explícita, sem valor presumido (US 10.3 cenário 2)', async () => {
    const semControle = file({ id: 'file-1', fileName: 'enviado-em-lote.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [semControle] }) },
    });

    renderApp(['/pastas']);
    const linha = await waitFor(() => linhaDe('enviado-em-lote.pdf'));

    // Nenhuma revisão presumida: nem `Rev. 01`, nem `Rev. 00`.
    expect(within(linha).queryByText(/^Rev\./)).not.toBeInTheDocument();
    expect(within(linha).getByText('Sem controle de revisão')).toBeInTheDocument();
    // Três ausências explícitas (revisão, responsável, próxima revisão).
    expect(within(linha).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('a ação de editar os dados de controle só é oferecida a quem o servidor autoriza (US 10.5)', async () => {
    const podeEditar = file({ id: 'f1', fileName: 'meu.pdf', canEditControl: true });
    const naoPodeEditar = file({ id: 'f2', fileName: 'de-outro.pdf', canEditControl: false });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': {
        status: 200,
        body: contents({ files: [podeEditar, naoPodeEditar] }),
      },
    });

    renderApp(['/pastas']);
    await waitFor(() => linhaDe('meu.pdf'));

    expect(
      within(linhaDe('meu.pdf')).getByRole('button', { name: /dados de controle/i }),
    ).toBeInTheDocument();
    expect(
      within(linhaDe('de-outro.pdf')).queryByRole('button', { name: /dados de controle/i }),
    ).not.toBeInTheDocument();
  });

  it('editar os dados de controle envia só o que mudou e informa o sucesso', async () => {
    const documento = file({
      id: 'file-1',
      fileName: 'sem-dados.pdf',
      canEditControl: true,
    });
    const atualizado = file({
      id: 'file-1',
      fileName: 'sem-dados.pdf',
      canEditControl: true,
      documentType: DocumentType.FORM,
      documentCode: 'FRM-ADM-020',
      documentRevision: 1,
      nextReviewAt: '2030-01-10',
      documentStatus: DocumentStatus.CURRENT,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': [
        { status: 200, body: contents({ files: [documento] }) },
        { status: 200, body: contents({ files: [atualizado] }) },
      ],
      'PATCH /files/file-1/document-control': { status: 200, body: atualizado },
    });

    renderApp(['/pastas']);
    await waitFor(() => linhaDe('sem-dados.pdf'));
    await userEvent.click(
      within(linhaDe('sem-dados.pdf')).getByRole('button', { name: /dados de controle/i }),
    );

    const dialog = await findDialogByTitle('Dados de controle — sem-dados.pdf');
    await userEvent.type(within(dialog).getByLabelText('Código'), 'FRM-ADM-020');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Dados de controle atualizados.');
    await waitFor(() => expect(linhaDe('sem-dados.pdf')).toBeInTheDocument());
    expect(within(linhaDe('sem-dados.pdf')).getByText('FRM-ADM-020')).toBeInTheDocument();
  });

  it('recusa por código em uso é distinguível da recusa por permissão (US 10.2, web-navegacao)', async () => {
    const documento = file({ id: 'file-1', fileName: 'duplicando.pdf', canEditControl: true });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [documento] }) },
      'PATCH /files/file-1/document-control': [
        {
          status: 409,
          body: {
            error: 'document_code_in_use',
            code: 'PRT-NSP-001',
            occupiedBy: { id: 'file-9', fileName: 'ja-existe.pdf' },
          },
        },
        { status: 403, body: { error: 'forbidden' } },
      ],
    });

    renderApp(['/pastas']);
    await waitFor(() => linhaDe('duplicando.pdf'));
    await userEvent.click(
      within(linhaDe('duplicando.pdf')).getByRole('button', { name: /dados de controle/i }),
    );

    const dialog = await findDialogByTitle('Dados de controle — duplicando.pdf');
    await userEvent.type(within(dialog).getByLabelText('Código'), 'PRT-NSP-001');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    // Nomeia o ocupante e diz o que corrigir — nunca "tente novamente".
    await screen.findByText(
      'Código já em uso nesta unidade por "ja-existe.pdf". Escolha outro código.',
    );

    // A segunda tentativa recebe 403: aviso **diferente**, de permissão.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await screen.findByText(
      'Permissão insuficiente para alterar os dados de controle deste documento.',
    );
  });
});
