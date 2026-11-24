import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type { FolderContentsResponse, StorageQuotaResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { mockXhr, mockControllableXhr } from './mock-xhr';
import { renderApp } from './render-app';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };
const GIGA = 1024 * 1024 * 1024;

function contents(overrides: Partial<FolderContentsResponse> = {}): FolderContentsResponse {
  return { folder: null, breadcrumb: [], folders: [], files: [], canUpload: true, ...overrides };
}

function quota(overrides: Partial<StorageQuotaResponse> = {}): StorageQuotaResponse {
  return {
    quotaBytes: 10 * GIGA,
    usedBytes: 0,
    trashedBytes: 0,
    trashedFiles: 0,
    pendingBytes: 0,
    availableBytes: 10 * GIGA,
    ...overrides,
  };
}

function makeFile(name: string): File {
  return new File(['conteudo'], name, { type: 'application/pdf' });
}

function withRelativePath(f: File, path: string): File {
  Object.defineProperty(f, 'webkitRelativePath', { value: path, configurable: true });
  return f;
}

/** `Upload multiple` é o 1º input; `Upload directory` é o 2º; a área de soltar, o 3º. */
function fileInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="file"]'));
}

function chamadas(caminho: string): unknown[][] {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
  return fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input), 'http://x').pathname === caminho,
  );
}

function corpo(call: unknown[]): Record<string, unknown> {
  return JSON.parse((call[1] as RequestInit).body as string);
}

/** Mesmo padrão de `pessoas.test.tsx`: segue `aria-controls` até o dropdown certo. */
async function escolherNoCampo(
  escopo: HTMLElement,
  fieldLabel: string,
  optionLabel: string | RegExp,
): Promise<void> {
  const item = within(escopo).getByText(fieldLabel).closest('.ant-form-item') as HTMLElement;
  const combobox = within(item).getByRole('combobox');
  await userEvent.click(combobox);
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

/**
 * Preenche o conjunto exigido de um documento **controlado** — cinco campos,
 * com o responsável, desde que a tabela 2.2 da demanda o tornou obrigatório
 * (change `arquivo-geral-e-pendente-de-cadastro`, design.md D5). Sem ele o
 * formulário bloqueia antes da requisição, que é o comportamento esperado.
 */
async function preencherControle(painel: HTMLElement, codigo: string): Promise<void> {
  await escolherNoCampo(painel, 'Tipo', /Protocolo/);
  await userEvent.type(within(painel).getByLabelText('Código'), codigo);
  await userEvent.type(within(painel).getByLabelText('Revisão'), '1');
  await userEvent.type(within(painel).getByLabelText('Setor responsável'), 'Governança');
  await userEvent.type(within(painel).getByLabelText('Próxima revisão'), '31/12/2030{enter}');
}

/**
 * Envio de **um** documento (Épico 10, capability `web-upload`).
 *
 * A exigência não liga mais pela contagem da operação: **todo** envio pede os
 * dados, e o que a contagem decide é só a **forma** — um arquivo recebe o
 * formulário, vários ou uma pasta recebem a tabela de cadastro, uma linha por
 * arquivo (change `tabela-de-cadastro-no-envio-em-lote`; demanda 2.1). O
 * conjunto exigido é o do **tipo** escolhido: cinco campos para documento
 * controlado, só o título para Arquivo geral.
 */
describe('Envio de um documento pede os dados de controle (web-upload)', () => {
  it('seleção de um único arquivo apresenta o formulário e publica pela rota unitária (US 10.5 cenário 1)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-url': {
        status: 200,
        body: {
          uploadUrl: 'https://storage.example/doc',
          objectPath: 'doc',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      },
    });
    mockXhr({ 'https://storage.example/doc': { status: 200 } });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [makeFile('protocolo.pdf')]);

    const painel = await screen.findByText('Dados do documento');
    const area = painel.closest('.ant-alert') as HTMLElement;

    // Nada é pedido ao servidor antes de a pessoa confirmar os dados.
    expect(chamadas('/files/upload-url')).toHaveLength(0);

    await preencherControle(area, 'PRT-NSP-001');
    await userEvent.click(within(area).getByRole('button', { name: /publicar documento/i }));

    await waitFor(() => expect(chamadas('/files/upload-url')).toHaveLength(1));
    const enviado = corpo(chamadas('/files/upload-url')[0]!);
    expect(enviado.fileName).toBe('protocolo.pdf');
    expect(enviado.documentControl).toMatchObject({
      documentType: 'protocol',
      documentCode: 'PRT-NSP-001',
      documentRevision: 1,
      nextReviewAt: '2030-12-31',
    });
    // O lote não é acionado: um documento não é um lote de um.
    expect(chamadas('/files/upload-urls')).toHaveLength(0);
    await screen.findByText('Envio concluído.');
  });

  it('o formulário exige os cinco campos antes de publicar, inclusive o responsável', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
    });
    const xhr = mockControllableXhr();

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [makeFile('sem-dados.pdf')]);

    const painel = await screen.findByText('Dados do documento');
    const area = painel.closest('.ant-alert') as HTMLElement;
    await userEvent.click(within(area).getByRole('button', { name: /publicar documento/i }));

    await screen.findByText('Informe o código do documento');
    // O responsável entrou no conjunto exigido pela tabela 2.2 da demanda, e o
    // servidor já o exigia: a tela precisa sinalizá-lo antes da requisição.
    await screen.findByText('Informe o setor ou a pessoa responsável');
    expect(chamadas('/files/upload-url')).toHaveLength(0);
    expect(xhr.started()).toBe(0);
  });

  it('o envio de um Arquivo geral conclui pedindo só o título (US 10.8)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-url': {
        status: 200,
        body: {
          uploadUrl: 'https://storage.example/ata',
          objectPath: 'ata',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      },
    });
    mockXhr({ 'https://storage.example/ata': { status: 200 } });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [makeFile('Ata de março.pdf')]);

    const painel = await screen.findByText('Dados do documento');
    const area = painel.closest('.ant-alert') as HTMLElement;

    await escolherNoCampo(area, 'Tipo', /Arquivo geral/);
    // Os três campos que o tipo recusa ficam indisponíveis, em vez de exigidos
    // — antes desta fatia o formulário os exigia e tornava o tipo inalcançável.
    await waitFor(() => expect(within(area).getByLabelText('Código')).toBeDisabled());
    expect(within(area).getByLabelText('Revisão')).toBeDisabled();

    await userEvent.click(within(area).getByRole('button', { name: /publicar documento/i }));

    await waitFor(() => expect(chamadas('/files/upload-url')).toHaveLength(1));
    const enviado = corpo(chamadas('/files/upload-url')[0]!);
    expect(enviado.documentControl).toEqual({
      documentType: 'general_file',
      documentCode: null,
      documentRevision: null,
      responsibleSector: null,
      nextReviewAt: null,
    });
  });

  it('vários arquivos pedem os dados por arquivo, na tabela de cadastro (US 10.5 cenário 2)', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'a.pdf',
              ok: true,
              awaitingRegistration: false,
              uploadUrl: 'https://storage.example/a',
              objectPath: 'a',
              folderId: null,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            },
            {
              fileName: 'b.pdf',
              ok: true,
              awaitingRegistration: false,
              uploadUrl: 'https://storage.example/b',
              objectPath: 'b',
              folderId: null,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            },
          ],
        },
      },
    });
    mockXhr({
      'https://storage.example/a': { status: 200 },
      'https://storage.example/b': { status: 200 },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [makeFile('a.pdf'), makeFile('b.pdf')]);

    // A tabela entra no lugar do painel "Confirmar envio": ela **é** a
    // confirmação, agora com o cadastro por arquivo (design.md D1).
    const tabela = await screen.findByText('Dados dos documentos');
    const painel = tabela.closest('.ant-card') as HTMLElement;
    expect(screen.queryByText('Dados do documento')).not.toBeInTheDocument();
    expect(within(painel).getByLabelText('Título de a.pdf')).toBeTruthy();
    expect(within(painel).getByLabelText('Título de b.pdf')).toBeTruthy();

    await userEvent.click(within(painel).getByRole('button', { name: /^Publicar completos/ }));

    await waitFor(() => expect(chamadas('/files/upload-urls')).toHaveLength(1));
    expect(chamadas('/files/upload-url')).toHaveLength(0);
  });

  it('uma pasta com um único arquivo recebe a tabela, não o formulário de um documento', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'dentro.pdf',
              ok: true,
              awaitingRegistration: false,
              uploadUrl: 'https://storage.example/dentro',
              objectPath: 'dentro',
              folderId: null,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            },
          ],
        },
      },
    });
    mockXhr({ 'https://storage.example/dentro': { status: 200 } });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar pasta/i });

    // O envio de pasta é a outra entrada da plataforma: a operação é "uma
    // pasta", não "um arquivo", mesmo quando a pasta tem um só item.
    const [, folderInput] = fileInputs(container);
    await userEvent.upload(folderInput!, [
      withRelativePath(makeFile('dentro.pdf'), 'Procedimentos/dentro.pdf'),
    ]);

    // A operação é "uma pasta", não "um arquivo": a hierarquia que o item
    // carrega é a prova. Recebe a tabela de cadastro, com uma linha.
    await screen.findByText('Dados dos documentos');
    expect(screen.queryByText('Dados do documento')).not.toBeInTheDocument();
  });

  it('código já em uso é apresentado como recusa específica, com o formulário preservado', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-url': {
        status: 409,
        body: { error: 'document_code_in_use', code: 'PRT-NSP-001' },
      },
    });
    const xhr = mockControllableXhr();

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [makeFile('duplicado.pdf')]);

    const painel = await screen.findByText('Dados do documento');
    const area = painel.closest('.ant-alert') as HTMLElement;
    await preencherControle(area, 'PRT-NSP-001');
    await userEvent.click(within(area).getByRole('button', { name: /publicar documento/i }));

    expect(
      await screen.findAllByText(
        'Código já em uso por outro documento desta unidade. Escolha outro código.',
      ),
    ).not.toHaveLength(0);
    // Nenhum byte foi transferido, e o formulário continua na tela com o que
    // a pessoa digitou — a recusa é acionável, não um beco sem saída.
    expect(xhr.started()).toBe(0);
    expect((within(area).getByLabelText('Código') as HTMLInputElement).value).toBe('PRT-NSP-001');
  });

  it('recusa por dado faltante vinda do servidor nomeia o que falta, sem virar "tente novamente"', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-url': {
        status: 400,
        body: { error: 'document_control_required', missing: ['documentRevision'] },
      },
    });
    mockControllableXhr();

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [makeFile('faltando.pdf')]);

    const painel = await screen.findByText('Dados do documento');
    const area = painel.closest('.ant-alert') as HTMLElement;
    await preencherControle(area, 'PRT-NSP-002');
    await userEvent.click(within(area).getByRole('button', { name: /publicar documento/i }));

    expect(await screen.findAllByText('Faltam dados de controle: revisão.')).not.toHaveLength(0);
    expect(
      screen.queryByText('Não foi possível concluir a ação. Tente novamente.'),
    ).not.toBeInTheDocument();
  });
});
