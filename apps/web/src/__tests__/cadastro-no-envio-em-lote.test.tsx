import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  UPLOAD_BATCH_MAX_ITEMS_DEFAULT,
  UPLOAD_SLICE_MAX_ITEMS_DEFAULT,
  UserRole,
} from '@gdoc/shared';
import type { FolderContentsResponse, StorageQuotaResponse } from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { mockXhr } from './mock-xhr';
import { renderApp } from './render-app';

/**
 * Tabela de cadastro do envio em lote (demanda 2.1 e 2.2; capability
 * `web-upload`, change `tabela-de-cadastro-no-envio-em-lote`).
 *
 * O que estes casos travam, acima de tudo: a tabela é a **confirmação** do
 * envio e vem depois do veredito de espaço; nenhuma URL é pedida antes dela; e
 * as linhas incompletas são enviadas como pendentes em vez de descartadas.
 */

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

function makeFile(name: string, size = 8): File {
  const file = new File(['conteudo'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

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

/** Resposta de lote que aceita todos os itens, ecoando a pendência de cada um. */
function urlsOk(nomes: string[], pendentes: string[] = []) {
  return {
    status: 200,
    body: {
      results: nomes.map((fileName) => ({
        fileName,
        ok: true,
        uploadUrl: `https://storage.example/${encodeURIComponent(fileName)}`,
        objectPath: fileName,
        folderId: null,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        awaitingRegistration: pendentes.includes(fileName),
      })),
    },
  };
}

function ambiente(extra: Record<string, unknown> = {}) {
  mockFetch({
    'GET /auth/me': { status: 200, body: IDENTITY },
    'GET /folders/root/contents': { status: 200, body: contents() },
    'GET /files/quota': { status: 200, body: quota() },
    ...extra,
  });
}

async function selecionar(container: HTMLElement, arquivos: File[]) {
  const [filesInput] = fileInputs(container);
  await userEvent.upload(filesInput!, arquivos);
}

async function abrirTabela(arquivos: File[]) {
  const { container } = renderApp(['/pastas']);
  await screen.findByRole('button', { name: /enviar arquivos/i });
  await selecionar(container, arquivos);
  const tabela = await screen.findByText('Dados dos documentos');
  return { container, painel: tabela.closest('.ant-card') as HTMLElement };
}

/**
 * Escolhe uma opção num `Select` identificado por `aria-label`. O `Select` do
 * Ant replica o `aria-label` no contêiner e no campo de busca interno, então
 * `getByLabelText` acharia dois — o que interessa é o que tem papel
 * `combobox`. (As tabelas em `Form` usam o helper por `.ant-form-item`; aqui
 * não há formulário, por design.md D2.)
 */
async function escolherTipo(escopo: HTMLElement, label: string, opcao: RegExp) {
  const combobox = within(escopo)
    .getAllByLabelText(label)
    .find((el) => el.getAttribute('role') === 'combobox') as HTMLElement;
  await userEvent.click(combobox);
  const dropdown = await waitFor(() => {
    const id = combobox.getAttribute('aria-controls') ?? combobox.getAttribute('aria-owns');
    const container = id ? document.getElementById(id)?.closest('.ant-select-dropdown') : null;
    if (!container) throw new Error('dropdown ainda não está no DOM');
    return container as HTMLElement;
  });
  await userEvent.click(await within(dropdown).findByText(opcao));
}

describe('A tabela de cadastro é a confirmação do envio (design.md D1)', () => {
  it('seleção de vários arquivos abre a tabela com uma linha por arquivo', async () => {
    ambiente();
    const { painel } = await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);

    expect(within(painel).getByText(/2 arquivo\(s\)/)).toBeTruthy();
    expect(within(painel).getByLabelText('Título de a.pdf')).toBeTruthy();
    expect(within(painel).getByLabelText('Título de b.pdf')).toBeTruthy();
  });

  it('nenhuma URL de envio é pedida antes da confirmação', async () => {
    ambiente();
    await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);

    expect(chamadas('/files/upload-urls')).toHaveLength(0);
    expect(chamadas('/files/upload-url')).toHaveLength(0);
  });

  it('seleção que não cabe no espaço não apresenta a tabela', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota({ availableBytes: 1 }) },
    });
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });
    await selecionar(container, [makeFile('a.pdf', 1024), makeFile('b.pdf', 1024)]);

    await screen.findByText(/não cabe no seu espaço disponível/i);
    expect(screen.queryByText('Dados dos documentos')).toBeNull();
    expect(chamadas('/files/upload-urls')).toHaveLength(0);
  });

  it('quantidade de arquivos muito acima do teto da requisição não impede abrir a tabela', async () => {
    ambiente();
    const muitos = Array.from({ length: UPLOAD_BATCH_MAX_ITEMS_DEFAULT + 20 }, (_, i) =>
      makeFile(`f${i}.pdf`),
    );
    const { painel } = await abrirTabela(muitos);

    expect(within(painel).getByText(new RegExp(`${muitos.length} arquivo\\(s\\)`))).toBeTruthy();
    expect(screen.queryByText(/quantidade.*(excedeu|limite)/i)).toBeNull();
  });

  it('seleção grande não renderiza uma linha por arquivo (design.md D2)', async () => {
    ambiente();
    const muitos = Array.from({ length: 600 }, (_, i) => makeFile(`f${i}.pdf`));
    const { painel } = await abrirTabela(muitos);

    // A virtualização renderiza só a janela visível: se houvesse uma linha por
    // arquivo, haveria 600 campos de título no DOM.
    const titulos = within(painel).queryAllByLabelText(/^Título de f\d+\.pdf$/);
    expect(titulos.length).toBeGreaterThan(0);
    expect(titulos.length).toBeLessThan(100);
  });
});

describe('Sugestão, título e Arquivo geral na tabela', () => {
  it('título vem do nome do arquivo e o nome gravado reanexa a extensão', async () => {
    ambiente({ 'POST /files/upload-urls': urlsOk(['Ata de março.pdf', 'b.pdf'], ['b.pdf']) });
    mockXhr({});
    const { painel } = await abrirTabela([makeFile('Ata.pdf'), makeFile('b.pdf')]);

    const titulo = within(painel).getByLabelText('Título de Ata.pdf');
    expect(titulo).toHaveValue('Ata');
    await userEvent.clear(titulo);
    await userEvent.type(titulo, 'Ata de março');

    await userEvent.click(within(painel).getByRole('button', { name: /^Publicar completos/ }));
    await waitFor(() => expect(chamadas('/files/upload-urls')).toHaveLength(1));

    const itens = corpo(chamadas('/files/upload-urls')[0]!).items as { fileName: string }[];
    expect(itens.map((i) => i.fileName)).toEqual(['Ata de março.pdf', 'b.pdf']);
  });

  it('sugere tipo e código pelo nome no padrão, e marca que são sugestão', async () => {
    ambiente();
    const { painel } = await abrirTabela([
      makeFile('PRT-NSP-001_Identificacao.pdf'),
      makeFile('Ata.pdf'),
    ]);

    expect(within(painel).getByLabelText('Código de PRT-NSP-001_Identificacao')).toHaveValue(
      'PRT-NSP-001',
    );
    expect(within(painel).getByLabelText('Código de Ata')).toHaveValue('');
    // A célula sugerida é distinguível da confirmada por **texto**, não por cor
    // (design.md D4): são duas marcas, uma para o tipo e uma para o código da
    // linha cujo nome seguia o padrão — e nenhuma na linha sem sugestão.
    const marcas = within(painel).getAllByText('sugerido pelo nome do arquivo');
    expect(marcas).toHaveLength(2);
  });

  it('valor confirmado pela pessoa deixa de ser apresentado como sugestão', async () => {
    ambiente();
    const { painel } = await abrirTabela([
      makeFile('PRT-NSP-001_Identificacao.pdf'),
      makeFile('Ata.pdf'),
    ]);

    const codigo = within(painel).getByLabelText('Código de PRT-NSP-001_Identificacao');
    await userEvent.clear(codigo);
    await userEvent.type(codigo, 'PRT-NSP-777');

    // Sobra a marca do tipo; a do código saiu com a edição.
    await waitFor(() =>
      expect(within(painel).getAllByText('sugerido pelo nome do arquivo')).toHaveLength(1),
    );
  });

  it('Arquivo geral indisponibiliza código, revisão e próxima revisão, e a linha fica completa', async () => {
    ambiente();
    const { painel } = await abrirTabela([makeFile('PRT-NSP-001.pdf'), makeFile('Ata.pdf')]);

    await escolherTipo(painel, 'Tipo de Ata', /Arquivo geral/);

    expect(within(painel).getByLabelText('Código de Ata')).toBeDisabled();
    expect(within(painel).getByLabelText('Revisão de Ata')).toBeDisabled();
    expect(within(painel).getByLabelText('Próxima revisão de Ata')).toBeDisabled();
    // Um completo (o Arquivo geral) e um pendente (o PRT sem os demais dados).
    await waitFor(() =>
      expect(
        within(painel).getByText(
          /1 arquivo\(s\) serão publicados; 1 ficarão Pendentes de cadastro/,
        ),
      ).toBeTruthy(),
    );
  });

  it('trocar para Arquivo geral não envia código, revisão nem data', async () => {
    ambiente({ 'POST /files/upload-urls': urlsOk(['PRT-NSP-001.pdf']) });
    mockXhr({});
    const { painel } = await abrirTabela([makeFile('PRT-NSP-001.pdf'), makeFile('b.pdf')]);

    await escolherTipo(painel, 'Tipo de PRT-NSP-001', /Arquivo geral/);
    await waitFor(() =>
      expect(within(painel).getByLabelText('Código de PRT-NSP-001')).toHaveValue(''),
    );

    await userEvent.click(within(painel).getByRole('button', { name: /^Publicar completos/ }));
    await waitFor(() => expect(chamadas('/files/upload-urls')).toHaveLength(1));

    const itens = corpo(chamadas('/files/upload-urls')[0]!).items as {
      documentControl?: Record<string, unknown>;
    }[];
    expect(itens[0]!.documentControl).toEqual({ documentType: 'general_file' });
  });
});

describe('Aplicar a todos (demanda 2.1 item 5; design.md D5)', () => {
  it('preenche tipo, revisão, responsável e próxima revisão de todas as linhas', async () => {
    ambiente({ 'POST /files/upload-urls': urlsOk(['a.pdf', 'b.pdf']) });
    mockXhr({});
    const { painel } = await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);
    const aplicacao = within(painel).getByTestId('aplicar-a-todos');

    await escolherTipo(aplicacao, 'Tipo para todos', /Procedimento/);
    await userEvent.type(within(aplicacao).getByLabelText('Revisão para todos'), '0');
    await userEvent.type(within(aplicacao).getByLabelText('Responsável para todos'), 'Qualidade');
    await userEvent.type(
      within(aplicacao).getByLabelText('Próxima revisão para todos'),
      '31/12/2031{enter}',
    );
    await userEvent.click(within(aplicacao).getByRole('button', { name: 'Aplicar a todos' }));

    // Falta só o código, que é individual — então as duas seguem incompletas.
    await waitFor(() =>
      expect(within(painel).getByLabelText('Responsável de a')).toHaveValue('Qualidade'),
    );
    await userEvent.type(within(painel).getByLabelText('Código de a'), 'POP-NSP-001');
    await userEvent.type(within(painel).getByLabelText('Código de b'), 'POP-NSP-002');

    await userEvent.click(
      within(painel).getByRole('button', { name: /^Publicar completos \(2\)/ }),
    );
    await waitFor(() => expect(chamadas('/files/upload-urls')).toHaveLength(1));

    const itens = corpo(chamadas('/files/upload-urls')[0]!).items as {
      documentControl: Record<string, unknown>;
    }[];
    expect(itens[0]!.documentControl).toEqual({
      documentType: 'procedure',
      documentCode: 'POP-NSP-001',
      documentRevision: 0,
      responsibleSector: 'Qualidade',
      nextReviewAt: '2031-12-31',
    });
    expect(itens[1]!.documentControl.documentCode).toBe('POP-NSP-002');
  });

  it('digitar na linha de aplicação sem acioná-la não altera nenhuma linha', async () => {
    ambiente();
    const { painel } = await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);
    const aplicacao = within(painel).getByTestId('aplicar-a-todos');

    await userEvent.type(within(aplicacao).getByLabelText('Responsável para todos'), 'Qualidade');

    expect(within(painel).getByLabelText('Responsável de a')).toHaveValue('');
    expect(within(painel).getByLabelText('Responsável de b')).toHaveValue('');
  });

  it('a linha alterada depois prevalece sobre o valor aplicado', async () => {
    ambiente();
    const { painel } = await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);
    const aplicacao = within(painel).getByTestId('aplicar-a-todos');

    await userEvent.type(within(aplicacao).getByLabelText('Responsável para todos'), 'Qualidade');
    await userEvent.click(within(aplicacao).getByRole('button', { name: 'Aplicar a todos' }));
    await waitFor(() =>
      expect(within(painel).getByLabelText('Responsável de a')).toHaveValue('Qualidade'),
    );

    const campo = within(painel).getByLabelText('Responsável de b');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Governança');

    expect(within(painel).getByLabelText('Responsável de a')).toHaveValue('Qualidade');
    expect(within(painel).getByLabelText('Responsável de b')).toHaveValue('Governança');
  });
});

describe('Publicação dos dois grupos e código repetido (design.md D6/D7)', () => {
  it('envia as completas e as incompletas na mesma operação, declarando o desfecho', async () => {
    ambiente({
      'POST /files/upload-urls': urlsOk(['completo.pdf', 'incompleto.pdf'], ['incompleto.pdf']),
    });
    mockXhr({});
    const { painel } = await abrirTabela([makeFile('completo.pdf'), makeFile('incompleto.pdf')]);

    await escolherTipo(painel, 'Tipo de completo', /Protocolo/);
    await userEvent.type(within(painel).getByLabelText('Código de completo'), 'PRT-NSP-500');
    await userEvent.type(within(painel).getByLabelText('Revisão de completo'), '1');
    await userEvent.type(within(painel).getByLabelText('Responsável de completo'), 'Governança');
    await userEvent.type(
      within(painel).getByLabelText('Próxima revisão de completo'),
      '31/12/2030{enter}',
    );

    // A confirmação declara os dois grupos **antes** de transferir.
    await waitFor(() =>
      expect(
        within(painel).getByText(
          /1 arquivo\(s\) serão publicados; 1 ficarão Pendentes de cadastro/,
        ),
      ).toBeTruthy(),
    );
    expect(chamadas('/files/upload-urls')).toHaveLength(0);

    await userEvent.click(
      within(painel).getByRole('button', { name: /^Publicar completos \(1\)/ }),
    );
    await waitFor(() => expect(chamadas('/files/upload-urls')).toHaveLength(1));

    // As duas vão no mesmo envio: a incompleta não é descartada.
    const itens = corpo(chamadas('/files/upload-urls')[0]!).items as { fileName: string }[];
    expect(itens.map((i) => i.fileName)).toEqual(['completo.pdf', 'incompleto.pdf']);
  });

  it('código repetido no próprio envio impede confirmar e aponta as duas linhas', async () => {
    ambiente();
    const { painel } = await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);

    await userEvent.type(within(painel).getByLabelText('Código de a'), 'PRT-NSP-001');
    await userEvent.type(within(painel).getByLabelText('Código de b'), 'prt-nsp-001 ');

    await screen.findByText(/Código repetido neste envio/);
    expect(within(painel).getByText(/2 arquivo\(s\) declaram um código já usado/)).toBeTruthy();
    expect(within(painel).getByRole('button', { name: /^Publicar completos/ })).toBeDisabled();
    expect(chamadas('/files/upload-urls')).toHaveLength(0);
  });

  it('título apagado impede confirmar', async () => {
    ambiente();
    const { painel } = await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);

    await userEvent.clear(within(painel).getByLabelText('Título de a.pdf'));

    await screen.findByText('Título obrigatório');
    expect(within(painel).getByRole('button', { name: /^Publicar completos/ })).toBeDisabled();
  });

  it('item recusado por conflito de código é apresentado como tal, com o cadastro preservado', async () => {
    ambiente({
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            { fileName: 'a.pdf', ok: false, error: 'document_code_conflict' },
            {
              fileName: 'b.pdf',
              ok: true,
              uploadUrl: 'https://storage.example/b',
              objectPath: 'b',
              folderId: null,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
              awaitingRegistration: true,
            },
          ],
        },
      },
    });
    mockXhr({ 'https://storage.example/b': { status: 200 } });
    const { painel } = await abrirTabela([makeFile('a.pdf'), makeFile('b.pdf')]);

    await userEvent.type(within(painel).getByLabelText('Código de a'), 'PRT-NSP-001');
    await userEvent.click(within(painel).getByRole('button', { name: /^Publicar completos/ }));

    await screen.findByText(/1 arquivo\(s\) com falha no envio/);
    await userEvent.click(screen.getByRole('button', { name: /ver falhas/i }));

    expect(
      screen.getByText(/Código já usado por outro documento desta unidade ou por outro arquivo/),
    ).toBeTruthy();
    // O cadastro da linha recusada é preservado: só o código precisa mudar.
    expect(screen.getByLabelText('Novo código de a.pdf')).toHaveValue('PRT-NSP-001');
  });
});

describe('A tabela não altera fatiamento, tetos nem reserva de cota (design.md D11)', () => {
  it('envio acima do tamanho da fatia continua pedindo URLs por fatia, com o cadastro de cada item', async () => {
    const total = UPLOAD_SLICE_MAX_ITEMS_DEFAULT + 3;
    const arquivos = Array.from({ length: total }, (_, i) => makeFile(`f${i}.pdf`));
    // Resposta fixa com uma vaga por item da maior fatia: a SPA casa resultado
    // com item por **índice**, então a mesma resposta serve às duas fatias.
    const vagas = Array.from({ length: UPLOAD_SLICE_MAX_ITEMS_DEFAULT }, (_, i) => ({
      fileName: `f${i}.pdf`,
      ok: true as const,
      uploadUrl: `https://storage.example/slice-${i}`,
      objectPath: `slice-${i}`,
      folderId: null,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      awaitingRegistration: true,
    }));
    ambiente({ 'POST /files/upload-urls': { status: 200, body: { results: vagas } } });
    mockXhr(Object.fromEntries(vagas.map((v) => [v.uploadUrl, { status: 200 }])));

    const { painel } = await abrirTabela(arquivos);
    const aplicacao = within(painel).getByTestId('aplicar-a-todos');

    // Um gesto só cadastra o lote inteiro — é o caminho de massa de D5.
    await userEvent.type(within(aplicacao).getByLabelText('Responsável para todos'), 'Qualidade');
    await userEvent.click(within(aplicacao).getByRole('button', { name: 'Aplicar a todos' }));

    await userEvent.click(within(painel).getByRole('button', { name: /^Publicar completos/ }));

    // Duas fatias, não uma requisição com `total` itens: o fatiamento segue
    // intacto, e cada item leva o seu próprio cadastro.
    await waitFor(() => expect(chamadas('/files/upload-urls').length).toBeGreaterThan(1), {
      timeout: 5000,
    });
    const primeira = corpo(chamadas('/files/upload-urls')[0]!).items as {
      documentControl: { responsibleSector?: string };
    }[];
    expect(primeira).toHaveLength(UPLOAD_SLICE_MAX_ITEMS_DEFAULT);
    expect(primeira[0]!.documentControl.responsibleSector).toBe('Qualidade');
    // A consulta de espaço continua sendo uma, antes de tudo.
    expect(chamadas('/files/quota')).toHaveLength(1);
  });
});
