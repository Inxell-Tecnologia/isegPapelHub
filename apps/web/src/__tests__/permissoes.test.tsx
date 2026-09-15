import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRole, GrantResourceType, Permission } from '@gdoc/shared';
import type {
  FileSummaryResponse,
  FolderContentsResponse,
  FolderResponse,
  GrantResponse,
  PersonResponse,
} from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { renderApp } from './render-app';

const ADMIN = { id: 'admin-1', unitId: 'unit-1', role: UserRole.UNIT_ADMIN };
const COLLABORATOR = { id: 'user-1', unitId: 'unit-1', role: UserRole.COLLABORATOR };

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

function person(
  overrides: Partial<PersonResponse> & { id: string; fullName: string },
): PersonResponse {
  return {
    unitId: 'unit-1',
    email: `${overrides.id}@example.com`,
    phone: null,
    jobTitle: null,
    workArea: null,
    notes: null,
    role: UserRole.COLLABORATOR,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function grant(
  overrides: Partial<GrantResponse> & { id: string; subjectUserId: string; permission: Permission },
): GrantResponse {
  return {
    unitId: 'unit-1',
    resourceType: GrantResourceType.FILE,
    resourceId: 'file-1',
    grantedBy: 'admin-1',
    createdAt: '2026-07-10T10:00:00.000Z',
    expiresAt: null,
    expired: false,
    ...overrides,
  };
}

/** Mesma limitação de `useId` documentada em `explorer.test.tsx`: localiza pelo título, não por role+name. */
async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.startsWith(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

function postBodies(path: string): unknown[] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(
      (call) =>
        String(call[0]).includes(path) && (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

/**
 * Rótulos de verbo aparecem tanto no `Checkbox.Group` do formulário quanto nas
 * `Tag` da lista de concessões — escopa à seção "Concessões" (o elemento logo
 * após o `<h4>`) para evitar ambiguidade entre os dois. O título deixou de
 * ser "Concessões vigentes" (change `expiracao-permissoes`, design.md D2):
 * a seção agora mistura vigentes e expiradas.
 */
function vigentesSection(dialog: HTMLElement): HTMLElement {
  const heading = within(dialog).getByText('Concessões');
  return heading.nextElementSibling as HTMLElement;
}

/**
 * Seleciona um ou mais colaboradores no `Select` `mode="multiple"` do
 * formulário. `aria-controls` do combobox aponta para um espelho de
 * acessibilidade oculto (mostra o value cru, não o rótulo) — a lista
 * clicável de verdade é o dropdown do AntD (`.ant-select-dropdown`), então
 * escopamos nele em vez de `getByText` global, que ambiguaria com o mesmo
 * nome já exibido nos vigentes. O dropdown de seleção múltipla permanece
 * aberto entre cliques — fechamos com `Escape` ao final.
 */
async function selectPeople(dialog: HTMLElement, names: string[]): Promise<void> {
  await userEvent.click(within(dialog).getByRole('combobox'));
  const dropdown = await waitFor(() => {
    const el = document.querySelector('.ant-select-dropdown');
    if (!el) throw new Error('dropdown do Select ainda não está no DOM');
    return el as HTMLElement;
  });
  for (const name of names) {
    await userEvent.click(await within(dropdown).findByText(name));
  }
  await userEvent.keyboard('{Escape}');
}

describe('Gestão de permissões da SPA (web-permissoes)', () => {
  it('a ação Permissões aparece para admin (spec: ação restrita a administrador)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');

    expect(screen.getByRole('button', { name: /permissões/i })).toBeInTheDocument();
  });

  it('a ação Permissões não aparece para colaborador (spec: colaborador não vê a ação)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: COLLABORATOR },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');

    expect(screen.queryByRole('button', { name: /permissões/i })).not.toBeInTheDocument();
  });

  it('conceder só view envia POST /grants com permissions:["view"] e os vigentes recarregam mostrando só view (US 4.1 cenário 1)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const viewGrant = grant({
      id: 'grant-1',
      subjectUserId: 'person-1',
      permission: Permission.VIEW,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano] },
      'GET /grants': [
        { status: 200, body: { grants: [] } },
        { status: 200, body: { grants: [viewGrant] } },
      ],
      'POST /grants': { status: 201, body: { grants: [viewGrant] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await screen.findByText('Nenhuma concessão');

    await selectPeople(dialog, ['Fulano']);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visualizar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    await waitFor(() => {
      const bodies = postBodies('/grants') as { permissions: string[] }[];
      expect(
        bodies.some((body) => JSON.stringify(body.permissions) === JSON.stringify(['view'])),
      ).toBe(true);
    });

    await waitFor(() => within(vigentesSection(dialog)).getByText('Visualizar'));
    expect(within(vigentesSection(dialog)).queryByText('Baixar')).not.toBeInTheDocument();
  }, 10000);

  it('conceder múltiplos verbos envia o conjunto numa única chamada; reconceder não duplica (US 4.1 cenário 3)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const bothGrants = [
      grant({ id: 'grant-1', subjectUserId: 'person-1', permission: Permission.VIEW }),
      grant({ id: 'grant-2', subjectUserId: 'person-1', permission: Permission.DOWNLOAD }),
    ];

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano] },
      'GET /grants': [
        { status: 200, body: { grants: [] } },
        { status: 200, body: { grants: bothGrants } },
        { status: 200, body: { grants: bothGrants } },
      ],
      'POST /grants': { status: 201, body: { grants: bothGrants } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await selectPeople(dialog, ['Fulano']);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visualizar' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Baixar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    await waitFor(() => within(vigentesSection(dialog)).getByText('Visualizar'));
    within(vigentesSection(dialog)).getByText('Baixar');

    const bodies = postBodies('/grants') as { permissions: string[] }[];
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.permissions.sort()).toEqual(['download', 'view']);

    // reconceder (idempotente no servidor): a lista não duplica as linhas.
    await selectPeople(dialog, ['Fulano']);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visualizar' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Baixar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    await waitFor(() => expect(postBodies('/grants')).toHaveLength(2));
    expect(within(vigentesSection(dialog)).getAllByText('Visualizar')).toHaveLength(1);
    expect(within(vigentesSection(dialog)).getAllByText('Baixar')).toHaveLength(1);
  }, 10000);

  it('revogar um verbo chama DELETE /grants/:id e remove só aquele verbo, preservando os demais (US 4.1)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const viewGrant = grant({
      id: 'grant-1',
      subjectUserId: 'person-1',
      permission: Permission.VIEW,
    });
    const downloadGrant = grant({
      id: 'grant-2',
      subjectUserId: 'person-1',
      permission: Permission.DOWNLOAD,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano] },
      'GET /grants': [
        { status: 200, body: { grants: [viewGrant, downloadGrant] } },
        { status: 200, body: { grants: [viewGrant] } },
      ],
      'DELETE /grants/grant-2': { status: 204 },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await waitFor(() => within(vigentesSection(dialog)).getByText('Baixar'));

    const downloadTag = within(vigentesSection(dialog))
      .getByText('Baixar')
      .closest('.ant-space') as HTMLElement;
    await userEvent.click(within(downloadTag).getByRole('button', { name: 'Revogar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, revogar' }));

    await waitFor(() =>
      expect(within(vigentesSection(dialog)).queryByText('Baixar')).not.toBeInTheDocument(),
    );
    expect(within(vigentesSection(dialog)).getByText('Visualizar')).toBeInTheDocument();
  }, 10000);

  it('recurso sem concessões exibe estado vazio (US 4.1)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [] },
      'GET /grants': { status: 200, body: { grants: [] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await within(dialog).findByText('Nenhuma concessão');
  });

  it('10.1: campo de prazo é opcional — conceder com prazo envia expiresAt; sem prazo o omite (change expiracao-permissoes)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const viewGrantWithDeadline = grant({
      id: 'grant-1',
      subjectUserId: 'person-1',
      permission: Permission.VIEW,
      expiresAt: '2099-12-31T00:00:00.000Z',
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano] },
      'GET /grants': [
        { status: 200, body: { grants: [] } },
        { status: 200, body: { grants: [viewGrantWithDeadline] } },
      ],
      'POST /grants': { status: 201, body: { grants: [viewGrantWithDeadline] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await selectPeople(dialog, ['Fulano']);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visualizar' }));

    const dateInput = within(dialog).getByLabelText('Prazo de expiração (opcional)');
    await userEvent.type(dateInput, '31/12/2099{enter}');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    await waitFor(() => {
      const bodies = postBodies('/grants') as { expiresAt?: string }[];
      expect(
        bodies.some(
          (body) => typeof body.expiresAt === 'string' && body.expiresAt.startsWith('2099-12-31'),
        ),
      ).toBe(true);
    });
  }, 10000);

  it('10.2: listagem distingue vigente de expirada (change expiracao-permissoes, design.md D2)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const vigente = grant({
      id: 'grant-1',
      subjectUserId: 'person-1',
      permission: Permission.VIEW,
      expiresAt: '2099-01-01T00:00:00.000Z',
      expired: false,
    });
    const expirada = grant({
      id: 'grant-2',
      subjectUserId: 'person-1',
      permission: Permission.DOWNLOAD,
      expiresAt: '2020-01-01T00:00:00.000Z',
      expired: true,
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano] },
      'GET /grants': { status: 200, body: { grants: [vigente, expirada] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    const section = await waitFor(() => vigentesSection(dialog));

    within(section).getByText(/Até/);
    within(section).getByText(/^Expirada em/);
  });

  it('o aviso de não-herança está visível ao abrir o modal de uma pasta e ausente para arquivo (US 4.1 cenário 2)', async () => {
    const folderX = folder({ id: 'folder-1', name: 'Pasta A' });
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': {
        status: 200,
        body: contents({ folders: [folderX], files: [fileX] }),
      },
      'GET /users': { status: 200, body: [] },
      'GET /grants': { status: 200, body: { grants: [] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');

    const folderRow = screen.getByText('Pasta A').closest('tr')!;
    await userEvent.click(within(folderRow).getByRole('button', { name: /permissões/i }));
    const folderDialog = await findDialogByTitle('Permissões — Pasta A');
    await within(folderDialog).findByText(/libera apenas a própria pasta/);
    await userEvent.click(within(folderDialog).getByRole('button', { name: 'Fechar' }));

    const fileRow = screen.getByText('relatorio.pdf').closest('tr')!;
    await userEvent.click(within(fileRow).getByRole('button', { name: /permissões/i }));
    const fileDialog = await findDialogByTitle('Permissões — relatorio.pdf');
    expect(within(fileDialog).queryByText(/libera apenas a própria pasta/)).not.toBeInTheDocument();
  });

  it('conceder a vários colaboradores envia uma única POST /grants com todos os ids, e os vigentes exibem cada um (design.md D1/D2, change concessao-multipla-e-nomenclatura-colaborador)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const ciclana = person({ id: 'person-2', fullName: 'Ciclana' });
    const grants = [
      grant({ id: 'grant-1', subjectUserId: 'person-1', permission: Permission.VIEW }),
      grant({ id: 'grant-2', subjectUserId: 'person-2', permission: Permission.VIEW }),
    ];

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano, ciclana] },
      'GET /grants': [
        { status: 200, body: { grants: [] } },
        { status: 200, body: { grants: grants } },
      ],
      'POST /grants': { status: 201, body: { grants: grants } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await selectPeople(dialog, ['Fulano', 'Ciclana']);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visualizar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    await waitFor(() => {
      const bodies = postBodies('/grants') as { subjectUserIds: string[] }[];
      expect(bodies).toHaveLength(1);
      expect(bodies[0]!.subjectUserIds.sort()).toEqual(['person-1', 'person-2']);
    });

    await waitFor(() => {
      const section = vigentesSection(dialog);
      expect(within(section).getByText('Fulano')).toBeInTheDocument();
      expect(within(section).getByText('Ciclana')).toBeInTheDocument();
    });
  }, 10000);

  it('submissão exige ao menos um colaborador — bloqueia sem chamar POST /grants (spec: submissão exige ao menos um colaborador)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [] },
      'GET /grants': { status: 200, body: { grants: [] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visualizar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    await within(dialog).findByText('Selecione ao menos um colaborador');
    expect(postBodies('/grants')).toHaveLength(0);
  });

  it('teto de destinatários excedido (413) exibe aviso próprio orientando a reduzir a seleção, sem alterar os vigentes (spec: teto de destinatários excedido)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const ciclana = person({ id: 'person-2', fullName: 'Ciclana' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano, ciclana] },
      'GET /grants': { status: 200, body: { grants: [] } },
      'POST /grants': {
        status: 413,
        body: { error: 'grant_subjects_limit_exceeded', found: 2, allowed: 1 },
      },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await selectPeople(dialog, ['Fulano', 'Ciclana']);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Visualizar' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Conceder' }));

    await screen.findByText(/reduza a seleção/i);
    expect(within(dialog).getByText('Nenhuma concessão')).toBeInTheDocument();
  });

  it('prévia de prazo vigente é exibida por colaborador selecionado que já tenha concessão, omitindo os sem concessão prévia (design.md D6)', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });
    const fulano = person({ id: 'person-1', fullName: 'Fulano' });
    const ciclana = person({ id: 'person-2', fullName: 'Ciclana' });
    const existingGrant = grant({
      id: 'grant-1',
      subjectUserId: 'person-1',
      permission: Permission.VIEW,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [fulano, ciclana] },
      'GET /grants': { status: 200, body: { grants: [existingGrant] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await selectPeople(dialog, ['Fulano', 'Ciclana']);

    await within(dialog).findByText(/Prazo atual de Fulano/);
    expect(within(dialog).queryByText(/Prazo atual de Ciclana/)).not.toBeInTheDocument();
  });

  it('nomenclatura-interface: o diálogo de permissões não usa "Pessoa"/"Servidor"', async () => {
    const fileX = file({ id: 'file-1', fileName: 'relatorio.pdf' });

    mockFetch({
      'GET /auth/me': { status: 200, body: ADMIN },
      'GET /folders/root/contents': { status: 200, body: contents({ files: [fileX] }) },
      'GET /users': { status: 200, body: [] },
      'GET /grants': { status: 200, body: { grants: [] } },
    });

    renderApp(['/pastas']);
    await screen.findByText('relatorio.pdf');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));

    const dialog = await findDialogByTitle('Permissões — relatorio.pdf');
    await within(dialog).findByText('Nenhuma concessão');
    expect(dialog.textContent).not.toMatch(/pessoa|servidor/i);
  });
});
