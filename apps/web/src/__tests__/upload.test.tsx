import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole, UPLOAD_SLICE_MAX_ITEMS_DEFAULT } from '@gdoc/shared';
import type {
  BatchUploadItemResult,
  BatchUploadUrlResponse,
  FileSummaryResponse,
  FolderContentsResponse,
  StorageQuotaResponse,
} from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { mockXhr, mockControllableXhr } from './mock-xhr';
import { renderApp } from './render-app';
import { mockViewportWidth, NARROW_VIEWPORT } from './viewport';

const IDENTITY = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

const GIGA = 1024 * 1024 * 1024;

/** Espaço folgado: a pré-checagem aprova e o fluxo segue para a confirmação. */
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

function file(
  overrides: Partial<FileSummaryResponse> & { id: string; fileName: string },
): FileSummaryResponse {
  return {
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
  return { folder: null, breadcrumb: [], folders: [], files: [], ...overrides };
}

function makeFile(name: string, content = 'conteudo'): File {
  return new File([content], name, { type: 'text/plain' });
}

/** `File.size` é metadado — forjá-lo permite exercitar os tetos sem alocar bytes. */
function withSize(f: File, size: number): File {
  Object.defineProperty(f, 'size', { value: size, configurable: true });
  return f;
}

function withRelativePath(f: File, path: string): File {
  Object.defineProperty(f, 'webkitRelativePath', { value: path, configurable: true });
  return f;
}

/** `Upload multiple` é o 1º input do container; `Upload directory` é o 2º; a área de soltar, o 3º. */
function fileInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="file"]'));
}

function uploadUrlCalls(): unknown[][] {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
  return fetchMock.mock.calls.filter(([input]) => String(input).includes('/files/upload-urls'));
}

function corpoDaChamada(call: unknown[]): { items: { fileName: string; relativePath?: string }[] } {
  return JSON.parse((call[1] as RequestInit).body as string);
}

/** Atravessa a pré-checagem: aguarda o resumo e confirma o envio (spec `web-upload`). */
async function confirmarEnvio(): Promise<void> {
  const confirmar = await screen.findByRole('button', { name: /^enviar$/i });
  await userEvent.click(confirmar);
}

describe('Envio de arquivos e pastas (web-upload)', () => {
  it('lote de vários arquivos: uma chamada upload-urls e progresso do conjunto até o fim (US 3.1 cenário 1)', async () => {
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'a.txt',
              ok: true,
              uploadUrl: 'https://storage.example/a',
              objectPath: 'a',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
            {
              fileName: 'b.txt',
              ok: true,
              uploadUrl: 'https://storage.example/b',
              objectPath: 'b',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    mockXhr({
      'https://storage.example/a': { status: 200 },
      'https://storage.example/b': { status: 200 },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a, b]);

    // Pré-checagem: resumo com quantidade e volume, antes de qualquer PUT.
    await screen.findByText(/2 arquivo\(s\)/);
    expect(uploadUrlCalls()).toHaveLength(0);

    await confirmarEnvio();

    // Um progresso só, do conjunto — nada de uma barra por arquivo.
    await waitFor(() => expect(screen.queryByText(/^2 de 2 arquivo\(s\)/)).toBeInTheDocument());
    expect(screen.queryByText(/com falha no envio/)).not.toBeInTheDocument();
    expect(uploadUrlCalls()).toHaveLength(1);
  });

  it('falha parcial por cota é sinalizada sem derrubar o lote; repetir reenvia só o item falho (US 3.1 cenário 2, RF #13)', async () => {
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': [
        {
          status: 200,
          body: {
            results: [
              {
                fileName: 'a.txt',
                ok: true,
                uploadUrl: 'https://storage.example/a',
                objectPath: 'a',
                folderId: null,
                expiresAt: '2026-07-21T10:05:00.000Z',
              },
              { fileName: 'b.txt', ok: false, error: 'quota exceeded' },
            ],
          } satisfies BatchUploadUrlResponse,
        },
        {
          status: 200,
          body: {
            results: [
              {
                fileName: 'b.txt',
                ok: true,
                uploadUrl: 'https://storage.example/b-retry',
                objectPath: 'b',
                folderId: null,
                expiresAt: '2026-07-21T10:05:00.000Z',
              },
            ],
          } satisfies BatchUploadUrlResponse,
        },
      ],
    });

    mockXhr({
      'https://storage.example/a': { status: 200 },
      'https://storage.example/b-retry': { status: 200 },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a, b]);
    await confirmarEnvio();

    // As falhas colapsam num contador; o detalhe é sob demanda (design.md D6).
    await screen.findByText('1 arquivo(s) com falha no envio.');
    await userEvent.click(await screen.findByRole('button', { name: /ver falhas/i }));
    await screen.findByText('Cota de armazenamento atingida.');

    await userEvent.click(await screen.findByRole('button', { name: /repetir/i }));

    await waitFor(() => expect(screen.queryByText(/com falha no envio/)).not.toBeInTheDocument());
  });

  it('envio de pasta deriva relativePath de webkitRelativePath, preservando a hierarquia (US 3.2)', async () => {
    const root = withRelativePath(makeFile('raiz.txt'), 'Pasta/raiz.txt');
    const nested = withRelativePath(makeFile('nested.txt'), 'Pasta/Sub/nested.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'raiz.txt',
              ok: true,
              uploadUrl: 'https://storage.example/raiz',
              objectPath: 'raiz',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
            {
              fileName: 'nested.txt',
              ok: true,
              uploadUrl: 'https://storage.example/nested',
              objectPath: 'nested',
              folderId: 'folder-sub',
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    mockXhr({
      'https://storage.example/raiz': { status: 200 },
      'https://storage.example/nested': { status: 200 },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar pasta/i });

    const [, folderInput] = fileInputs(container);
    await userEvent.upload(folderInput!, [root, nested]);
    await confirmarEnvio();

    await waitFor(() => expect(uploadUrlCalls()).toHaveLength(1));
    expect(corpoDaChamada(uploadUrlCalls()[0]!).items).toEqual([
      expect.objectContaining({ fileName: 'raiz.txt', relativePath: 'Pasta' }),
      expect.objectContaining({ fileName: 'nested.txt', relativePath: 'Pasta/Sub' }),
    ]);
  });

  it('sucesso do PUT invalida a listagem e o arquivo aparece pending, sem polling por active (design.md D6)', async () => {
    const uploaded = makeFile('novo.pdf');
    const pendingFile = file({ id: 'file-new', fileName: 'novo.pdf', status: 'pending' });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': [
        { status: 200, body: contents() },
        { status: 200, body: contents({ files: [pendingFile] }) },
      ],
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'novo.pdf',
              ok: true,
              uploadUrl: 'https://storage.example/novo',
              objectPath: 'novo',
              folderId: null,
              expiresAt: '2026-07-21T10:05:00.000Z',
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    mockXhr({ 'https://storage.example/novo': { status: 200 } });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [uploaded]);
    await confirmarEnvio();

    await waitFor(() => expect(screen.getByText('pending')).toBeInTheDocument());
    expect(screen.getAllByText('novo.pdf').length).toBeGreaterThanOrEqual(1);
  });

  it('destino sem permissão (403 no upload-urls) exibe aviso e não inicia transferência alguma (RF #10)', async () => {
    const a = makeFile('a.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': { status: 403, body: { error: 'forbidden' } },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);
    await confirmarEnvio();

    await screen.findByText('Permissão insuficiente para enviar arquivos neste destino.');
    expect(xhr.started()).toBe(0);
  });

  it('abaixo do limiar, enviar pasta é recusado no acionamento — botão continua visível (design.md D5, `web-responsividade`)', async () => {
    mockViewportWidth(NARROW_VIEWPORT);
    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
    });

    renderApp(['/pastas']);
    const folderButton = await screen.findByRole('button', { name: /enviar pasta/i });

    await userEvent.click(folderButton);

    await screen.findByText(
      'Enviar pasta não está disponível neste dispositivo. Use um computador.',
    );
    // Distinguível da recusa por permissão insuficiente do mesmo fluxo.
    expect(
      screen.queryByText('Permissão insuficiente para enviar arquivos neste destino.'),
    ).not.toBeInTheDocument();
  });
});

/**
 * Defeitos consertados pelo change `corrige-defeitos-envio-lote`: fila de
 * concorrência (D4) e renovação da URL vencida no retry (D5). A recusa
 * antecipada por quantidade daquele change foi **removida** por
 * `envio-multiplas-pastas-com-prechecagem` (D5): com o envio fatiado, o teto
 * por requisição deixou de ser alcançável por uso normal.
 */
describe('Envio em lote — fila e vigência da URL (corrige-defeitos-envio-lote)', () => {
  const FUTURO = new Date(Date.now() + 3_600_000).toISOString();
  const PASSADO = new Date(Date.now() - 60_000).toISOString();

  function okResult(name: string, url: string, expiresAt = FUTURO): BatchUploadItemResult {
    return {
      fileName: name,
      ok: true,
      uploadUrl: url,
      objectPath: name,
      folderId: null,
      expiresAt,
    };
  }

  it('no máximo 4 PUTs simultâneos, e a fila drena por completo (design.md D4)', async () => {
    const total = 10;
    const files = Array.from({ length: total }, (_, i) => makeFile(`f${i}.txt`));

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: files.map((f, i) => okResult(f.name, `https://storage.example/f${i}`)),
        } satisfies BatchUploadUrlResponse,
      },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, files);
    await confirmarEnvio();

    // A fila abre exatamente 4 vagas, não as 10 aceitas.
    await waitFor(() => expect(xhr.inFlight()).toBe(4));
    expect(xhr.started()).toBe(4);

    // Cada conclusão libera uma vaga, e só uma.
    let concluidos = 0;
    while (xhr.inFlight() > 0) {
      xhr.succeedOldest();
      concluidos += 1;
      await waitFor(() => expect(xhr.inFlight()).toBeLessThanOrEqual(4));
      if (concluidos < total) {
        await waitFor(() => expect(xhr.started()).toBe(Math.min(concluidos + 4, total)));
      }
    }

    // A fila drenou inteira: todos os 10 foram efetivamente transferidos.
    expect(concluidos).toBe(total);
    expect(xhr.started()).toBe(total);
    expect(new Set(xhr.startedUrls()).size).toBe(total);
  });

  it('item que falha libera a vaga imediatamente para o próximo (design.md D4)', async () => {
    const files = Array.from({ length: 6 }, (_, i) => makeFile(`g${i}.txt`));

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: files.map((f, i) => okResult(f.name, `https://storage.example/g${i}`)),
        } satisfies BatchUploadUrlResponse,
      },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, files);
    await confirmarEnvio();
    await waitFor(() => expect(xhr.inFlight()).toBe(4));

    xhr.failOldest();

    // A vaga liberada por FALHA é ocupada igual à liberada por sucesso.
    await waitFor(() => expect(xhr.started()).toBe(5));
    expect(xhr.inFlight()).toBe(4);
    await screen.findByText('1 arquivo(s) com falha no envio.');
  });

  it('repetir com URL vencida pede URL nova em vez de reusar a vencida (design.md D5)', async () => {
    const a = makeFile('vencida.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': [
        {
          status: 200,
          body: {
            results: [okResult('vencida.txt', 'https://storage.example/velha', PASSADO)],
          } satisfies BatchUploadUrlResponse,
        },
        {
          status: 200,
          body: {
            results: [okResult('vencida.txt', 'https://storage.example/nova', FUTURO)],
          } satisfies BatchUploadUrlResponse,
        },
      ],
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);
    await confirmarEnvio();

    await waitFor(() => expect(xhr.inFlight()).toBe(1));
    xhr.failOldest();
    await userEvent.click(await screen.findByRole('button', { name: /ver falhas/i }));
    const repetir = await screen.findByRole('button', { name: /repetir/i });

    const chamadasAntes = uploadUrlCalls().length;
    await userEvent.click(repetir);

    // Pediu URL nova...
    await waitFor(() => expect(uploadUrlCalls()).toHaveLength(chamadasAntes + 1));
    // ...e transferiu para ela, não para a vencida.
    await waitFor(() => expect(xhr.startedUrls()).toContain('https://storage.example/nova'));
  });

  it('repetir com URL vigente reusa a URL, sem requisição adicional (design.md D5)', async () => {
    const a = makeFile('vigente.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [okResult('vigente.txt', 'https://storage.example/mesma', FUTURO)],
        } satisfies BatchUploadUrlResponse,
      },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);
    await confirmarEnvio();

    await waitFor(() => expect(xhr.inFlight()).toBe(1));
    xhr.failOldest();
    await userEvent.click(await screen.findByRole('button', { name: /ver falhas/i }));
    const repetir = await screen.findByRole('button', { name: /repetir/i });

    const chamadasAntes = uploadUrlCalls().length;
    await userEvent.click(repetir);
    await waitFor(() => expect(xhr.started()).toBe(2));

    expect(uploadUrlCalls()).toHaveLength(chamadasAntes);
    expect(xhr.startedUrls()).toEqual([
      'https://storage.example/mesma',
      'https://storage.example/mesma',
    ]);
  });

  it('recusa por teto vinda do servidor não vira "tente novamente" (rede de segurança, design.md D5)', async () => {
    const a = makeFile('h.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 400,
        body: { error: 'upload_batch_limit_exceeded', found: 300, allowed: 200 },
      },
    });

    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);
    await confirmarEnvio();

    await screen.findByText('Seleção acima do limite por envio');
    await screen.findByText(
      'Você selecionou 300 arquivos e o limite é 200 por envio. Envie em partes.',
    );
    expect(
      screen.queryByText('Não foi possível solicitar o envio. Tente novamente.'),
    ).not.toBeInTheDocument();
  });
});

/**
 * Cenário "Segunda falha renova a URL mesmo se julgada vigente" da spec
 * `web-upload` (design.md D5): o relógio do navegador pode estar errado, e
 * por isso a vigência é otimização — poupar uma requisição —, nunca a
 * garantia de correção.
 */
describe('Renovação forçada após falhas consecutivas (design.md D5)', () => {
  it('segunda falha pede URL nova mesmo com expiresAt folgado', async () => {
    const FUTURO = new Date(Date.now() + 3_600_000).toISOString();
    const a = makeFile('teimosa.txt');

    const result = (url: string): BatchUploadItemResult => ({
      fileName: 'teimosa.txt',
      ok: true,
      uploadUrl: url,
      objectPath: 'teimosa.txt',
      folderId: null,
      expiresAt: FUTURO,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': [
        { status: 200, body: { results: [result('https://storage.example/velha')] } },
        { status: 200, body: { results: [result('https://storage.example/renovada')] } },
      ],
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);
    await confirmarEnvio();

    // 1ª falha.
    await waitFor(() => expect(xhr.inFlight()).toBe(1));
    xhr.failOldest();
    await userEvent.click(await screen.findByRole('button', { name: /ver falhas/i }));

    const pedidosAposEnvio = uploadUrlCalls().length;

    // 1º Repetir: URL julgada vigente, então reusa — sem pedir nada.
    await userEvent.click(await screen.findByRole('button', { name: /repetir/i }));
    await waitFor(() => expect(xhr.started()).toBe(2));
    expect(uploadUrlCalls()).toHaveLength(pedidosAposEnvio);
    expect(xhr.startedUrls()[1]).toBe('https://storage.example/velha');

    // 2ª falha — a URL "vigente" já falhou duas vezes.
    xhr.failOldest();

    // 2º Repetir: agora renova, apesar do expiresAt folgado.
    await userEvent.click(await screen.findByRole('button', { name: /repetir/i }));
    await waitFor(() => expect(uploadUrlCalls()).toHaveLength(pedidosAposEnvio + 1));
    await waitFor(() => expect(xhr.startedUrls()).toContain('https://storage.example/renovada'));
  });
});

/**
 * Seleção por arrastar e soltar (change
 * `envio-multiplas-pastas-com-prechecagem`, design.md D1) — a **única**
 * interação da plataforma que entrega N pastas de uma vez.
 */
describe('Arrastar e soltar várias pastas (design.md D1)', () => {
  /**
   * Solta na área do `Dragger` o que o rc-upload entrega depois da travessia
   * por `webkitGetAsEntry()`: um array achatado de `File`, cada um já com
   * `webkitRelativePath` preenchido a partir do `fullPath`. A travessia é do
   * rc-upload e não é reimplementada aqui — o que este teste verifica é o
   * contrato a jusante dela, que é onde mora o código desta fatia.
   */
  function soltar(container: HTMLElement, files: File[]) {
    const [, , dropInput] = fileInputs(container);
    const zona = container.querySelector('.ant-upload-drag')!;
    fireEvent.dragOver(zona);
    fireEvent.drop(zona, { dataTransfer: { files: [], items: [], types: ['Files'] } });
    // A entrega da seleção achatada segue o mesmo caminho do seletor nativo.
    return userEvent.upload(dropInput!, files);
  }

  it('duas pastas soltas juntas viram um envio só, com a hierarquia de cada uma preservada', async () => {
    const daPastaA = withRelativePath(makeFile('a1.txt'), 'PastaA/a1.txt');
    const daSubDeA = withRelativePath(makeFile('a2.txt'), 'PastaA/Sub/a2.txt');
    const daPastaB = withRelativePath(makeFile('b1.txt'), 'PastaB/b1.txt');
    const solto = makeFile('solto.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: ['a1.txt', 'a2.txt', 'b1.txt', 'solto.txt'].map((nome) => ({
            fileName: nome,
            ok: true as const,
            uploadUrl: `https://storage.example/${nome}`,
            objectPath: nome,
            folderId: null,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          })),
        } satisfies BatchUploadUrlResponse,
      },
    });

    mockXhr({});
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    await soltar(container, [daPastaA, daSubDeA, daPastaB, solto]);

    // Uma seleção única, com os quatro arquivos das duas pastas mais o solto.
    await screen.findByText(/4 arquivo\(s\)/);
    await confirmarEnvio();

    await waitFor(() => expect(uploadUrlCalls()).toHaveLength(1));
    // `deriveRelativePath` permanece inalterado e resolve o `fullPath` do
    // drop exatamente como resolve o do seletor de pasta; o arquivo solto
    // não pertence a pasta alguma e vai direto para o destino.
    const enviados = corpoDaChamada(uploadUrlCalls()[0]!).items;
    expect(enviados.slice(0, 3)).toEqual([
      expect.objectContaining({ fileName: 'a1.txt', relativePath: 'PastaA' }),
      expect.objectContaining({ fileName: 'a2.txt', relativePath: 'PastaA/Sub' }),
      expect.objectContaining({ fileName: 'b1.txt', relativePath: 'PastaB' }),
    ]);
    expect(enviados[3]).toMatchObject({ fileName: 'solto.txt' });
    expect(enviados[3]).not.toHaveProperty('relativePath');
  });

  it('em modo estreito a área de soltar não é montada, e o envio de arquivos avulsos segue íntegro', async () => {
    mockViewportWidth(NARROW_VIEWPORT);
    const a = makeFile('avulso.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'avulso.txt',
              ok: true,
              uploadUrl: 'https://storage.example/avulso',
              objectPath: 'avulso',
              folderId: null,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    mockXhr({ 'https://storage.example/avulso': { status: 200 } });
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    // Arrastar e soltar não existe em aparelho de toque: a área não é
    // anunciada. Os dois botões permanecem.
    expect(container.querySelector('.ant-upload-drag')).toBeNull();
    expect(screen.getByRole('button', { name: /enviar pasta/i })).toBeInTheDocument();

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);
    await confirmarEnvio();

    await waitFor(() => expect(screen.queryByText(/^1 de 1 arquivo\(s\)/)).toBeInTheDocument());
  });
});

/**
 * Pré-checagem e veredito (change `envio-multiplas-pastas-com-prechecagem`,
 * design.md D3/D4): decidir **antes** de transferir, e dizer com precisão
 * onde o espaço está preso quando não cabe.
 */
describe('Verificação de viabilidade antes de transferir (design.md D3/D4)', () => {
  const MEGA = 1024 * 1024;

  it('seleção inviável não pede URL alguma e não transfere byte algum', async () => {
    const grande = withSize(makeFile('grande.bin'), 900 * MEGA);

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': {
        status: 200,
        body: quota({
          usedBytes: 9.5 * GIGA,
          trashedBytes: 2 * GIGA,
          trashedFiles: 1,
          pendingBytes: 100 * MEGA,
          availableBytes: 10 * GIGA - 9.5 * GIGA - 100 * MEGA,
        }),
      },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [grande]);

    await screen.findByText('A seleção não cabe no seu espaço disponível');
    expect(uploadUrlCalls()).toHaveLength(0);
    expect(xhr.started()).toBe(0);
  });

  it('a recusa decompõe o espaço entre ativos, lixeira e pendentes (design.md D4)', async () => {
    const grande = withSize(makeFile('grande.bin'), 900 * MEGA);

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': {
        status: 200,
        body: quota({
          usedBytes: 9 * GIGA,
          trashedBytes: 3 * GIGA,
          trashedFiles: 1,
          pendingBytes: 512 * MEGA,
          availableBytes: 10 * GIGA - 9 * GIGA - 512 * MEGA,
        }),
      },
    });

    mockXhr({});
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [grande]);

    await screen.findByText('A seleção não cabe no seu espaço disponível');
    // 9 GB usados menos 3 GB na lixeira = 6 GB em arquivos ativos.
    await screen.findByText(
      /6\.0 GB em arquivos ativos, 3\.0 GB na lixeira e 512\.0 MB em envios pendentes/,
    );
  });

  it('a recusa desmente a expectativa de liberação imediata por exclusão (design.md D4)', async () => {
    const grande = withSize(makeFile('grande.bin'), 900 * MEGA);

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': {
        status: 200,
        body: quota({
          usedBytes: 9.8 * GIGA,
          trashedBytes: 4 * GIGA,
          trashedFiles: 1,
          availableBytes: 10 * GIGA - 9.8 * GIGA,
        }),
      },
    });

    mockXhr({});
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [grande]);

    // A frase é obrigatória: sem ela a recusa induz a ação inútil que o
    // manual antigo ensinava.
    await screen.findByText(/Excluir arquivos não libera espaço de imediato/);
    await screen.findByText(/até o expurgo automático, ao fim do prazo de retenção da lixeira/);
  });

  it('"enviar só o que cabe" envia o subconjunto e declara o que ficou de fora (design.md D4)', async () => {
    const cabe1 = withSize(makeFile('cabe1.bin'), 100 * MEGA);
    const cabe2 = withSize(makeFile('cabe2.bin'), 100 * MEGA);
    const naoCabe = withSize(makeFile('sobra.bin'), 400 * MEGA);

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota({ availableBytes: 250 * MEGA }) },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: ['cabe1.bin', 'cabe2.bin'].map((nome) => ({
            fileName: nome,
            ok: true as const,
            uploadUrl: `https://storage.example/${nome}`,
            objectPath: nome,
            folderId: null,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          })),
        } satisfies BatchUploadUrlResponse,
      },
    });

    mockXhr({});
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [cabe1, cabe2, naoCabe]);

    await screen.findByText('A seleção não cabe no seu espaço disponível');
    // O que ficou de fora é declarado com clareza, em quantidade e volume.
    await screen.findByText(/Ficam de fora 1 arquivo\(s\), 400\.0 MB/);

    await userEvent.click(await screen.findByRole('button', { name: /enviar só o que cabe/i }));

    await waitFor(() => expect(uploadUrlCalls()).toHaveLength(1));
    expect(corpoDaChamada(uploadUrlCalls()[0]!).items.map((i) => i.fileName)).toEqual([
      'cabe1.bin',
      'cabe2.bin',
    ]);
  });

  it('a análise é visível e cancelável, e o cancelamento não transfere nada', async () => {
    const files = Array.from({ length: 3 }, (_, i) => makeFile(`z${i}.txt`));

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const zona = container.querySelector('.ant-upload-drag')!;
    fireEvent.drop(zona, { dataTransfer: { files: [], items: [], types: ['Files'] } });

    // O estado de análise aparece já no `drop`, antes de qualquer requisição:
    // a travessia de milhares de entradas leva tempo perceptível.
    await screen.findByText('Analisando seleção…');
    expect(uploadUrlCalls()).toHaveLength(0);

    await userEvent.click(await screen.findByRole('button', { name: /cancelar/i }));
    expect(screen.queryByText('Analisando seleção…')).not.toBeInTheDocument();
    expect(xhr.started()).toBe(0);
    expect(files).toHaveLength(3);
  });

  it('nada é transferido antes da confirmação, mesmo cabendo', async () => {
    const a = makeFile('confirma.txt');

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: {
          results: [
            {
              fileName: 'confirma.txt',
              ok: true,
              uploadUrl: 'https://storage.example/confirma',
              objectPath: 'confirma',
              folderId: null,
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            },
          ],
        } satisfies BatchUploadUrlResponse,
      },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [a]);

    await screen.findByText('Confirmar envio');
    expect(uploadUrlCalls()).toHaveLength(0);
    expect(xhr.started()).toBe(0);

    await confirmarEnvio();
    await waitFor(() => expect(xhr.started()).toBe(1));
  });
});

/**
 * Envio fatiado (design.md D5) e progresso macro (D6) — os dois efeitos da
 * fatia que o usuário sente: nenhum limite próprio de quantidade, e uma barra
 * que anda proporcional ao trabalho real.
 */
describe('Envio fatiado e progresso macro (design.md D5/D6)', () => {
  const MEGA = 1024 * 1024;

  function okResults(nomes: string[]): BatchUploadUrlResponse {
    return {
      results: nomes.map((nome) => ({
        fileName: nome,
        ok: true as const,
        uploadUrl: `https://storage.example/${nome}`,
        objectPath: nome,
        folderId: null,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      })),
    };
  }

  it('seleção muito acima do teto por requisição não é recusada por quantidade — é fatiada', async () => {
    const total = UPLOAD_SLICE_MAX_ITEMS_DEFAULT + 50;
    const files = Array.from({ length: total }, (_, i) => makeFile(`x${i}.txt`));

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': [
        {
          status: 200,
          body: okResults(files.slice(0, UPLOAD_SLICE_MAX_ITEMS_DEFAULT).map((f) => f.name)),
        },
        {
          status: 200,
          body: okResults(files.slice(UPLOAD_SLICE_MAX_ITEMS_DEFAULT).map((f) => f.name)),
        },
      ],
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, files);

    // Nenhuma recusa por quantidade: a única recusa legítima é a do espaço.
    expect(screen.queryByText('Seleção acima do limite por envio')).not.toBeInTheDocument();
    await screen.findByText(new RegExp(`${total} arquivo\\(s\\)`));
    await confirmarEnvio();

    // As URLs da 1ª fatia são pedidas pouco antes de usá-las — nunca todas
    // no início (design.md D5).
    await waitFor(() => expect(xhr.inFlight()).toBe(4));

    // Um envio de centenas de arquivos não renderiza um indicador por
    // arquivo: com 2.000 itens isso travaria a aba antes do envio, e o envio
    // ainda precisaria rodar por dezenas de minutos nela (design.md D6).
    expect(container.querySelectorAll('.ant-progress')).toHaveLength(1);
    expect(container.querySelectorAll('.ant-list-item')).toHaveLength(0);

    expect(uploadUrlCalls()).toHaveLength(1);
    expect(corpoDaChamada(uploadUrlCalls()[0]!).items).toHaveLength(UPLOAD_SLICE_MAX_ITEMS_DEFAULT);

    // A fila atravessa a fronteira entre fatias sem nunca secar: a fatia
    // seguinte é buscada enquanto os últimos itens desta ainda transferem.
    let minimoEmVoo = 4;
    while (xhr.started() < total) {
      xhr.succeedOldest();
      await waitFor(() => expect(xhr.inFlight()).toBeGreaterThan(0));
      minimoEmVoo = Math.min(minimoEmVoo, xhr.inFlight());
    }
    expect(minimoEmVoo).toBeGreaterThan(0);
    expect(uploadUrlCalls()).toHaveLength(2);
    expect(corpoDaChamada(uploadUrlCalls()[1]!).items).toHaveLength(50);
  });

  it('o progresso avança proporcional aos bytes, não em saltos por arquivo (design.md D6)', async () => {
    // Um arquivo pequeno ao lado de um grande: por contagem a barra iria a
    // 50% ao concluir o pequeno; por bytes, a ~2%.
    const pequeno = withSize(makeFile('pequeno.txt'), 1 * MEGA);
    const grande = withSize(makeFile('grande.bin'), 49 * MEGA);

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': { status: 200, body: quota() },
      'POST /files/upload-urls': {
        status: 200,
        body: okResults(['pequeno.txt', 'grande.bin']),
      },
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [pequeno, grande]);
    await confirmarEnvio();

    await waitFor(() => expect(xhr.inFlight()).toBe(2));
    xhr.succeedOldest(); // conclui o pequeno (1 de 2 arquivos, 1/50 dos bytes)

    const barra = () => container.querySelector('.ant-progress-bg') as HTMLElement | null;
    await waitFor(() => expect(screen.getByText(/^1 de 2 arquivo\(s\)/)).toBeInTheDocument());
    // 2%, não 50%.
    await waitFor(() => expect(barra()!.style.width).toBe('2%'));
  });
});

/**
 * Falta de espaço **durante** o envio (design.md D7): com a pré-checagem isso
 * virou exceção — outra aba consumiu espaço no intervalo —, e a resposta é
 * pausar com o estado legível, nunca insistir nas fatias seguintes.
 */
describe('Estouro de cota durante o envio pausa e reapresenta o veredito (design.md D7)', () => {
  const MEGA = 1024 * 1024;

  it('fatia recusada por cota pausa o envio, preserva o já transferido e reapresenta o painel', async () => {
    // Dois arquivos de 300 MB: o teto de bytes da fatia (500 MB) fecha a
    // primeira com um item só, então há duas fatias e uma fronteira onde a
    // cota pode acabar.
    const primeiro = withSize(makeFile('primeiro.bin'), 300 * MEGA);
    const segundo = withSize(makeFile('segundo.bin'), 300 * MEGA);

    mockFetch({
      'GET /auth/me': { status: 200, body: IDENTITY },
      'GET /folders/root/contents': { status: 200, body: contents() },
      'GET /files/quota': [
        { status: 200, body: quota() },
        // Reconsulta após a recusa: o retrato agora é o real.
        {
          status: 200,
          body: quota({
            usedBytes: 10 * GIGA,
            trashedBytes: 1 * GIGA,
            trashedFiles: 1,
            availableBytes: 0,
          }),
        },
      ],
      'POST /files/upload-urls': [
        {
          status: 200,
          body: {
            results: [
              {
                fileName: 'primeiro.bin',
                ok: true,
                uploadUrl: 'https://storage.example/primeiro',
                objectPath: 'primeiro',
                folderId: null,
                expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
              },
            ],
          } satisfies BatchUploadUrlResponse,
        },
        {
          status: 200,
          body: {
            results: [{ fileName: 'segundo.bin', ok: false, error: 'quota exceeded' }],
          } satisfies BatchUploadUrlResponse,
        },
      ],
    });

    const xhr = mockControllableXhr();
    const { container } = renderApp(['/pastas']);
    await screen.findByRole('button', { name: /enviar arquivos/i });

    const [filesInput] = fileInputs(container);
    await userEvent.upload(filesInput!, [primeiro, segundo]);
    await confirmarEnvio();

    // A 1ª fatia sobe normalmente.
    await waitFor(() => expect(xhr.inFlight()).toBe(1));
    xhr.succeedOldest();

    // A 2ª é recusada por cota: o envio pausa e se declara incompleto.
    await screen.findByText('Envio incompleto: o espaço acabou durante a transferência');
    await screen.findByText(/1 arquivo\(s\) não foram enviados/);
    await screen.findByText(/Os que já subiram permanecem enviados/);

    // O painel detalhado é o mesmo da recusa, com o espaço reconsultado.
    await screen.findByText(/Excluir arquivos não libera espaço de imediato/);
    await screen.findByText(/9\.0 GB em arquivos ativos, 1\.0 GB na lixeira/);

    // O que já subiu permanece: um PUT concluído, nenhum outro iniciado.
    expect(xhr.started()).toBe(1);
    expect(screen.getByText(/^1 de 2 arquivo\(s\)/)).toBeInTheDocument();
  });
});
