import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GrantResourceType, Permission, UnitStatus, UserRole } from '@gdoc/shared';
import type {
  FileSummaryResponse,
  FolderContentsResponse,
  FolderResponse,
  SharedWithMeItemResponse,
  UnitResponse,
} from '@gdoc/shared';
import { mockFetch } from './mock-fetch';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';
import { renderApp } from './render-app';

/**
 * Compartilhamento entre unidades na SPA (PRD US 5.2, change
 * `compartilhamento-entre-unidades`): specs `web-unidades`, `web-permissoes`,
 * `web-navegacao`, `compartilhados-comigo` e `auditoria`. A SPA só reflete o
 * que o servidor resolve — os testes de alcance estão na API.
 */

const GLOBAL_ADMIN = { id: 'ana', unitId: 'sede', role: UserRole.GLOBAL_ADMIN };
const RAIRA = { id: 'raira', unitId: 'norte', role: UserRole.COLLABORATOR };

function unit(overrides: Partial<UnitResponse> & { id: string; name: string }): UnitResponse {
  return {
    status: UnitStatus.ACTIVE,
    createdAt: '2026-01-01T00:00:00.000Z',
    isHeadquarters: false,
    ...overrides,
  };
}

function folder(overrides: Partial<FolderResponse> & { id: string; name: string }): FolderResponse {
  return {
    unitId: 'sede',
    ownerId: 'dono',
    parentId: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

function file(
  overrides: Partial<FileSummaryResponse> & { id: string; fileName: string },
): FileSummaryResponse {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
    ownerId: 'dono',
    folderId: null,
    contentType: 'application/pdf',
    sizeBytes: 2048,
    status: 'active',
    createdAt: '2026-07-02T10:00:00.000Z',
    ...overrides,
  };
}

function botao(label: string, scope: HTMLElement = document.body): HTMLButtonElement {
  const found = within(scope)
    .getAllByRole('button')
    .find((b) => b.textContent === label);
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found as HTMLButtonElement;
}

function postBodies(path: string): unknown[] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(
      (call) =>
        String(call[0]).includes(path) && (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

async function findDialogByTitle(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = screen.getAllByRole('dialog').find((el) => el.textContent?.startsWith(title));
    if (!dialog) throw new Error(`dialog "${title}" ainda não está no DOM`);
    return dialog;
  });
}

describe('Unidades: marcação da SEDE (web-unidades)', () => {
  it('identifica a SEDE e não oferece marcar outra enquanto ela existir', async () => {
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': {
        status: 200,
        body: [
          unit({ id: 'sede', name: 'SEDE', isHeadquarters: true }),
          unit({ id: 'norte', name: 'Unidade Norte' }),
        ],
      },
    });
    renderApp(['/admin/unidades']);
    const linhaNorte = (await screen.findByText('Unidade Norte')).closest('tr')!;
    const linhaSede = screen.getAllByText('SEDE')[0]!.closest('tr')!;

    expect(within(linhaSede).getByText('Desmarcar SEDE')).toBeInTheDocument();
    // A SEDE marcada não oferece desativar.
    expect(within(linhaSede).queryByText('Desativar')).not.toBeInTheDocument();
    expect(botao('Marcar como SEDE', linhaNorte)).toBeDisabled();
  });

  it('marcar envia isHeadquarters ao servidor', async () => {
    const patch = vi.fn(() => ({
      status: 200,
      body: unit({ id: 'norte', name: 'Unidade Norte', isHeadquarters: true }),
    }));
    mockFetch({
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /units': { status: 200, body: [unit({ id: 'norte', name: 'Unidade Norte' })] },
      'PATCH /units/norte': patch,
    });
    renderApp(['/admin/unidades']);
    await screen.findByText('Unidade Norte');
    await userEvent.click(botao('Marcar como SEDE'));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, marcar' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const chamada = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('/units/norte'),
    )!;
    expect(JSON.parse(String((chamada[1] as RequestInit).body))).toEqual({ isHeadquarters: true });
  });
});

describe('Permissões: compartilhar com outra unidade (web-permissoes)', () => {
  const governanca = folder({ id: 'gov', name: 'Governança' });

  function rotasBase(extra: Record<string, unknown> = {}) {
    return {
      'GET /auth/me': { status: 200, body: GLOBAL_ADMIN },
      'GET /folders/root/contents': {
        status: 200,
        body: {
          folder: null,
          breadcrumb: [],
          folders: [{ ...governanca, documentCount: 1 }],
          files: [],
          canUpload: true,
        } satisfies FolderContentsResponse,
      },
      'GET /users': { status: 200, body: [] },
      'GET /grants': { status: 200, body: { grants: [] } },
      ...extra,
    } as Parameters<typeof mockFetch>[0];
  }

  async function abrirSecao(): Promise<HTMLElement> {
    renderApp(['/pastas']);
    await screen.findByText('Governança');
    await userEvent.click(screen.getByRole('button', { name: /permissões/i }));
    const dialog = await findDialogByTitle('Permissões — Governança');
    await userEvent.click(within(dialog).getByText('Compartilhar com outra unidade'));
    return dialog;
  }

  it('compartilha a pasta com a unidade inteira, com aviso de subárvore', async () => {
    mockFetch(
      rotasBase({
        'GET /grants/cross-unit/destinations': {
          status: 200,
          body: {
            headquartersDefined: true,
            destinations: [{ id: 'norte', name: 'Unidade Norte', isHeadquarters: false }],
          },
        },
        'GET /grants/cross-unit': { status: 200, body: { grants: [] } },
        'POST /grants/cross-unit': { status: 201, body: { grants: [] } },
      }),
    );
    const dialog = await abrirSecao();
    expect(
      await within(dialog).findByText('Todo o conteúdo da pasta será compartilhado'),
    ).toBeInTheDocument();

    const secao = within(dialog).getByRole('region', { name: 'Compartilhar com outra unidade' });
    await userEvent.click(within(secao).getByRole('combobox'));
    await userEvent.click(
      await waitFor(() => {
        const opcao = Array.from(document.querySelectorAll('.ant-select-item-option')).find(
          (el) => el.textContent === 'Unidade Norte',
        );
        if (!opcao) throw new Error('opção ainda não renderizada');
        return opcao as HTMLElement;
      }),
    );
    await userEvent.click(within(secao).getByRole('button', { name: 'Compartilhar' }));

    await waitFor(() => {
      const corpos = postBodies('/grants/cross-unit') as Record<string, unknown>[];
      expect(corpos).toHaveLength(1);
      expect(corpos[0]).toMatchObject({
        resourceType: GrantResourceType.FOLDER,
        resourceId: 'gov',
        subjectUnitId: 'norte',
        subjectUserIds: [],
        permissions: [Permission.VIEW],
      });
    });
  });

  it('sem SEDE marcada, explica em vez de oferecer destinos vazios', async () => {
    mockFetch(
      rotasBase({
        'GET /grants/cross-unit/destinations': {
          status: 200,
          body: { headquartersDefined: false, destinations: [] },
        },
        'GET /grants/cross-unit': { status: 200, body: { grants: [] } },
      }),
    );
    const dialog = await abrirSecao();
    expect(
      await within(dialog).findByText('Nenhuma unidade está marcada como SEDE'),
    ).toBeInTheDocument();
  });

  it('lista os compartilhamentos do recurso com o destino', async () => {
    mockFetch(
      rotasBase({
        'GET /grants/cross-unit/destinations': {
          status: 200,
          body: { headquartersDefined: true, destinations: [] },
        },
        'GET /grants/cross-unit': {
          status: 200,
          body: {
            grants: [
              {
                id: 'cg-1',
                unitId: 'sede',
                resourceType: 'folder',
                resourceId: 'gov',
                subjectUnitId: 'norte',
                subjectUnitName: 'Unidade Norte',
                subjectUserId: null,
                subjectUserName: null,
                permission: 'view',
                grantedBy: 'ana',
                createdAt: '2026-11-18T10:00:00.000Z',
                expiresAt: null,
                expired: false,
              },
            ],
          },
        },
      }),
    );
    const dialog = await abrirSecao();
    expect(await within(dialog).findByText('Unidade Norte (unidade inteira)')).toBeInTheDocument();
  });
});

describe('Compartilhados comigo: itens de outra unidade', () => {
  it('identifica a unidade de origem', async () => {
    const item: SharedWithMeItemResponse = {
      resourceType: GrantResourceType.FOLDER,
      id: 'gov',
      name: 'Governança',
      folderName: null,
      permissions: [{ permission: Permission.VIEW, expiresAt: null }],
      sharedAt: '2026-11-18T10:00:00.000Z',
      file: null,
      originUnit: { id: 'sede', name: 'SEDE' },
    };
    mockFetch({
      'GET /auth/me': { status: 200, body: RAIRA },
      'GET /grants/received': { status: 200, body: { items: [item] } },
    });
    renderApp(['/compartilhados']);
    expect(await screen.findByText('Governança')).toBeInTheDocument();
    expect(screen.getByText('da unidade SEDE')).toBeInTheDocument();
  });
});

describe('Explorador: pasta compartilhada por outra unidade (web-navegacao)', () => {
  it('navega somente leitura, com trilha a partir de Compartilhados comigo', async () => {
    const atas = folder({ id: 'atas', name: 'Atas', parentId: 'gov' });
    mockFetch({
      'GET /auth/me': { status: 200, body: RAIRA },
      'GET /folders/atas/contents': {
        status: 200,
        body: {
          folder: atas,
          breadcrumb: [folder({ id: 'gov', name: 'Governança' })],
          folders: [],
          files: [file({ id: 'ata', fileName: 'ata.pdf', folderId: 'atas' })],
          canUpload: false,
          readOnly: true,
          sharedFrom: { unitId: 'sede', unitName: 'SEDE' },
          canDownload: false,
        } satisfies FolderContentsResponse,
      },
    });
    renderApp(['/pastas/atas']);
    expect(await screen.findByText('ata.pdf')).toBeInTheDocument();
    expect(screen.getByText('Compartilhada pela unidade SEDE')).toBeInTheDocument();
    const trilha = document.querySelector('.ant-breadcrumb') as HTMLElement;
    expect(within(trilha).getByRole('link', { name: 'Compartilhados comigo' })).toBeInTheDocument();
    expect(within(trilha).getByRole('link', { name: 'Governança' })).toBeInTheDocument();
    expect(within(trilha).queryByText('Documentos')).not.toBeInTheDocument();

    const linha = screen.getByText('ata.pdf').closest('tr')!;
    expect(within(linha).getByRole('button', { name: /visualizar/i })).toBeInTheDocument();
    for (const acao of [/baixar/i, /renomear/i, /excluir/i, /mover/i, /permissões/i]) {
      expect(within(linha).queryByRole('button', { name: acao })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /nova pasta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('Auditoria: acesso de outra unidade', () => {
  it('mostra o nome com a unidade de quem acessou', async () => {
    const DONO = { id: 'dono', unitId: 'sede', role: UserRole.COLLABORATOR };
    mockFetch({
      'GET /auth/me': { status: 200, body: DONO },
      'GET /folders/root/contents': {
        status: 200,
        body: {
          folder: null,
          breadcrumb: [],
          folders: [],
          files: [file({ id: 'ata', fileName: 'ata.pdf' })],
          canUpload: true,
        } satisfies FolderContentsResponse,
      },
      'GET /files/ata/audit': {
        status: 200,
        body: {
          events: [
            {
              actor: {
                id: 'raira',
                name: 'Raíra Damasceno',
                email: null,
                unitName: 'Unidade Norte',
              },
              action: 'view',
              createdAt: '2026-11-18T10:00:00.000Z',
            },
          ],
        },
      },
    });
    renderApp(['/pastas']);
    await screen.findByText('ata.pdf');
    await userEvent.click(screen.getByRole('button', { name: /auditoria/i }));
    expect(await screen.findByText('Raíra Damasceno (Unidade Norte)')).toBeInTheDocument();
  });
});
