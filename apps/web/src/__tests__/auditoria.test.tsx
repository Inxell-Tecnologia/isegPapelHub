import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserRole } from '@gdoc/shared';
import type {
  AuditQueryResponse,
  FileSummaryResponse,
  FolderContentsResponse,
  FolderResponse,
} from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const ADMIN = { id: 'admin-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };
const OWNER = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };
const OTHER_COLLABORATOR = { id: 'user-2', unitId: 'unit-1', role: UserRole.COLLABORATOR };

function folder(overrides: Partial<FolderResponse> & { id: string; name: string }): FolderResponse {
  return {
    unitId: 'unit-1',
    ownerId: 'user-1',
    parentId: null,
    createdAt: '2026-07-01T10:00:00.000Z',
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

function audit(overrides: Partial<AuditQueryResponse> = {}): AuditQueryResponse {
  return { events: [], ...overrides };
}

/** Mesma limitação de `useId` documentada em `explorer.test.tsx`: localiza pelo título, não por role+name. */
async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.startsWith(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

describe('Auditoria de acesso na SPA (web-auditoria)', () => {
  it('administrador vê a ação "Auditoria" em qualquer arquivo da unidade', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');

    expect(screen.getByRole('button', { name: /auditoria/i })).toBeInTheDocument();
  });

  it('dono vê a ação "Auditoria" no próprio arquivo (US 7.2)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf', ownerId: OWNER.id });

    mockFetch({
      'GET /auth/me': { status: 200, body: OWNER },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');

    expect(screen.getByRole('button', { name: /auditoria/i })).toBeInTheDocument();
  });

  it('colaborador não vê a ação "Auditoria" em arquivo do qual não é dono (US 7.2)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf', ownerId: OWNER.id });

    mockFetch({
      'GET /auth/me': { status: 200, body: OTHER_COLLABORATOR },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');

    expect(screen.queryByRole('button', { name: /auditoria/i })).not.toBeInTheDocument();
  });

  it('pasta não tem ação de auditoria', async () => {
    const folderX = folder({ id: 'folder-1', name: 'Pasta A' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ folders: [folderX] }) },
    });

    renderApp(['/pastas']);
    await screen.findByText('Pasta A');

    expect(screen.queryByRole('button', { name: /auditoria/i })).not.toBeInTheDocument();
  });

  it('abrir a auditoria exibe cada acesso com pessoa, ação (Tag) e data/hora, do mais recente ao mais antigo (US 7.1 cenário 1)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /files/file-1/audit': {
        status: 200,
        body: audit({
          events: [
            {
              actor: { id: 'user-2', name: 'Fulano', email: 'fulano@example.com' },
              action: 'download',
              createdAt: '2026-07-15T14:00:00.000Z',
            },
            {
              actor: { id: 'user-3', name: 'Ciclana', email: 'ciclana@example.com' },
              action: 'view',
              createdAt: '2026-07-10T09:00:00.000Z',
            },
          ],
        }),
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /auditoria/i }));

    const dialog = await findDialogByTitle('Auditoria — relatorio.pdf');
    await within(dialog).findByText('Fulano');

    // nomenclatura-interface: cabeçalho de coluna usa "Colaborador"
    expect(within(dialog).getByRole('columnheader', { name: 'Colaborador' })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/pessoa|servidor/i);

    // cabeçalho + as 2 linhas retornadas pelo servidor, na ordem em que vieram.
    const rows = within(dialog).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Fulano')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Baixar')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Ciclana')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Visualizar')).toBeInTheDocument();
  });

  it('ator sem nome exibe o e-mail em seu lugar', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /files/file-1/audit': {
        status: 200,
        body: audit({
          events: [
            {
              actor: { id: 'user-2', name: null, email: 'semnome@example.com' },
              action: 'view',
              createdAt: '2026-07-15T14:00:00.000Z',
            },
          ],
        }),
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /auditoria/i }));

    const dialog = await findDialogByTitle('Auditoria — relatorio.pdf');
    await within(dialog).findByText('semnome@example.com');
  });

  it('arquivo sem acessos exibe estado vazio "Nenhum acesso registrado", sem erro', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /files/file-1/audit': { status: 200, body: audit() },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /auditoria/i }));

    const dialog = await findDialogByTitle('Auditoria — relatorio.pdf');
    await within(dialog).findByText('Nenhum acesso registrado');
  });

  it('consulta negada (403) exibe aviso neutro de permissão insuficiente, sem distinguir subcasos', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /files/file-1/audit': { status: 403, body: { error: 'forbidden' } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /auditoria/i }));

    const dialog = await findDialogByTitle('Auditoria — relatorio.pdf');
    await within(dialog).findByText('Permissão insuficiente');
  });
});
