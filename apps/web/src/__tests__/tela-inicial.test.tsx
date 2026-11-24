import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { DocumentStatus, DocumentType, UserRole } from '@gdoc/shared';
import { mockFetch, ROTAS_DA_TELA_INICIAL } from './mock-fetch';
import { renderApp } from './render-app';
import { atalhosDoPapel } from '../inicio/atalhos';
import { saudacao, saudacaoDoHorario } from '../shell/identidade';
import { textoDeNovos } from '../inicio/queries';
import {
  CLASSE_GRADE_ATALHOS,
  ESTILO_GLOBAL,
  LIMIAR_ATALHOS_DUAS_COLUNAS,
  LIMIAR_ATALHOS_QUATRO_COLUNAS,
} from '../app/theme';
import { LARGURA_ROTULO_DE_TIPO } from '../app/RotuloDeTipoDocumental';
import { DESTINO_PEDIDO_DE_TOUR } from '../tour/pedido-de-tour';

/** Saudação do horário com o primeiro nome — o horário real do teste é qualquer um. */
const SAUDACAO_MARIA = /^(Bom dia|Boa tarde|Boa noite), Maria!$/;

/** URL do manual que `renderApp` não configura por padrão. */
const MANUAL_URL = 'https://manual.exemplo/';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';
import { SEM_CONTROLE_DOCUMENTAL } from './document-control-fixture';

const COLABORADOR = {
  id: 'user-1',
  unitId: 'unit-1',
  role: UserRole.COLLABORATOR,
  fullName: 'Maria Silva',
  unitName: 'Unidade Centro',
};

function pasta(id: string, name: string) {
  return {
    id,
    unitId: 'unit-1',
    ownerId: 'user-1',
    parentId: null,
    name,
    createdAt: '2026-10-01T10:00:00.000Z',
  };
}

function documento(overrides: Record<string, unknown> = {}) {
  return {
    ...SEM_CONTROLE_DOCUMENTAL,
    id: 'file-1',
    ownerId: 'user-1',
    folderId: 'folder-1',
    folderName: 'Protocolos',
    fileName: 'documento.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    status: 'active',
    createdAt: '2026-10-20T10:00:00.000Z',
    changedAt: '2026-10-26T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * Tela inicial (Épico 11, capability `tela-inicial`).
 *
 * A tela substitui um `Result` decorativo, e o que ela precisa provar não é
 * visual: que identifica a pessoa **pelo nome** e nunca pelo identificador
 * interno, que não oferece atalho que resultaria em recusa, e que as áreas de
 * pastas e de recentes orientam quando não têm o que mostrar, em vez de ficar
 * vazias sem explicação.
 */
/** Área de conteúdo da tela, sem o shell em volta. */
function conteudo(): HTMLElement {
  return document.querySelector('.ant-layout-content') as HTMLElement;
}

describe('Tela inicial (US 11.1 e 11.2)', () => {
  it('apresenta nome, função e unidade de quem entrou (US 11.1, cenário 1)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    expect(await screen.findByText(SAUDACAO_MARIA)).toBeInTheDocument();
    // Escopado ao conteúdo: a change `menu-lateral-e-barra-superior` passou a
    // apresentar papel e unidade também no cartão do usuário, no rodapé da
    // navegação. O que este caso exercita é a linha de contexto da **tela**.
    // `COLABORADOR` não tem cargo cadastrado, então a linha recai no rótulo do
    // papel — pela mesma origem única das outras telas (change
    // `funcao-e-setor-na-identidade`, design.md D6).
    expect(within(conteudo()).getByText('Colaborador · Unidade Centro')).toBeInTheDocument();
    // O identificador interno não aparece em lugar nenhum da tela.
    expect(document.body.textContent).not.toContain('user-1');
  });

  /**
   * Função e setor na linha de contexto (change
   * `funcao-e-setor-na-identidade`; `docs/respostas_a1_funcao_e_setor.txt`,
   * resposta 1a). A queixa do cliente era literal: *"para a gerente de
   * Governança aparece Colaborador"*.
   */
  describe('função e setor do cadastro na linha abaixo da saudação', () => {
    it('a função do cadastro prevalece sobre o rótulo do papel', async () => {
      mockViewportWidth(WIDE_VIEWPORT);
      mockFetch({
        ...ROTAS_DA_TELA_INICIAL,
        'GET /auth/me': {
          status: 200,
          body: {
            ...COLABORADOR,
            jobTitle: 'Gerente de Governança',
            sectorName: 'Governança',
          },
        },
      });

      renderApp(['/']);

      await screen.findByText(SAUDACAO_MARIA);
      expect(
        within(conteudo()).getByText('Gerente de Governança · Governança · Unidade Centro'),
      ).toBeInTheDocument();
      // E o rótulo do papel **não** aparece no lugar da função: era este o
      // defeito relatado.
      expect(within(conteudo()).queryByText(/^Colaborador ·/)).not.toBeInTheDocument();
    });

    it('conta sem cargo recai no rótulo do papel, com o setor preservado', async () => {
      mockViewportWidth(WIDE_VIEWPORT);
      mockFetch({
        ...ROTAS_DA_TELA_INICIAL,
        'GET /auth/me': {
          status: 200,
          body: { ...COLABORADOR, jobTitle: '', sectorName: 'CME' },
        },
      });

      renderApp(['/']);

      await screen.findByText(SAUDACAO_MARIA);
      expect(
        within(conteudo()).getByText('Colaborador · CME · Unidade Centro'),
      ).toBeInTheDocument();
    });

    it('pessoa sem setor não deixa separador solto na linha', async () => {
      mockViewportWidth(WIDE_VIEWPORT);
      mockFetch({
        ...ROTAS_DA_TELA_INICIAL,
        'GET /auth/me': {
          status: 200,
          body: { ...COLABORADOR, jobTitle: 'Analista', sectorName: '' },
        },
      });

      renderApp(['/']);

      await screen.findByText(SAUDACAO_MARIA);
      // Sem rótulo vazio e sem espaço reservado: o termo simplesmente não
      // entra (capability `setores`).
      expect(within(conteudo()).getByText('Analista · Unidade Centro')).toBeInTheDocument();
      expect(within(conteudo()).queryByText(/· ·/)).not.toBeInTheDocument();
    });
  });

  it('conta sem nome cadastrado recorre a tratamento genérico, nunca ao identificador (US 11.1, cenário 1)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: { ...COLABORADOR, fullName: '' } },
    });

    renderApp(['/']);

    expect(await screen.findByText(/^(Bom dia|Boa tarde|Boa noite)!$/)).toBeInTheDocument();
    // Função e unidade continuam presentes — o que falta é só o nome.
    expect(within(conteudo()).getByText('Colaborador · Unidade Centro')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('user-1');
    expect(document.body.textContent).not.toContain('US');
  });

  it('apresenta os quatro atalhos da demanda, soltos e sem título de seção (US 11.1, cenário 2)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /auth/public-config': {
        status: 200,
        body: { appName: 'PapelHub', clientName: '', manualUrl: MANUAL_URL },
      },
    });

    renderApp(['/']);

    await screen.findByText(SAUDACAO_MARIA);
    const area = conteudo();
    for (const nome of ['Enviar documento', 'Nova pasta', 'Buscar documento']) {
      expect(await within(area).findByRole('link', { name: nome })).toBeInTheDocument();
    }
    // O manual sai da aplicação, e o nome acessível diz isso — mesmo texto do
    // menu (design.md D4).
    const manual = await within(area).findByRole('link', {
      name: 'Manual do usuário (abre em nova aba, fora da aplicação)',
    });
    expect(manual).toHaveAttribute('href', MANUAL_URL);
    expect(manual).toHaveAttribute('target', '_blank');
    // Sem título de seção acima dos cartões, e os atalhos de administração
    // saíram da tela — estão no menu.
    expect(within(area).queryByText('O que você pode fazer')).not.toBeInTheDocument();
    expect(within(area).queryByRole('link', { name: 'Lixeira' })).not.toBeInTheDocument();
  });

  it('sem manual configurado, o atalho do manual não aparece', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    await screen.findByText(SAUDACAO_MARIA);
    expect(await within(conteudo()).findByRole('link', { name: 'Nova pasta' })).toBeInTheDocument();
    expect(within(conteudo()).queryByRole('link', { name: /Manual do usuário/ })).toBeNull();
  });

  it('atalho fora do alcance do perfil não é apresentado — o filtro por papel continua valendo', () => {
    // Os quatro atalhos atuais servem a qualquer papel; o mecanismo de filtro
    // permanece para o atalho que vier a exigir papel (design.md D4).
    for (const role of [UserRole.COLLABORATOR, UserRole.UNIT_ADMIN, UserRole.GLOBAL_ADMIN]) {
      expect(atalhosDoPapel(role, MANUAL_URL).map((a) => a.chave)).toEqual([
        'enviar',
        'nova-pasta',
        'buscar',
        'manual',
      ]);
    }
    expect(atalhosDoPapel(UserRole.COLLABORATOR, '').map((a) => a.chave)).not.toContain('manual');
  });

  /**
   * "Cartão da tela inicial é acionável em toda a sua área" (change
   * `cartoes-de-atalho-acionaveis`, design.md D7): o link é **ancestral** do
   * cartão, e a descrição está dentro dele.
   */
  it('cada cartão de atalho está contido no seu link, com o rótulo por nome acessível', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    await screen.findByText(SAUDACAO_MARIA);
    for (const atalho of atalhosDoPapel(UserRole.COLLABORATOR, '')) {
      const link = await within(conteudo()).findByRole('link', { name: atalho.rotulo });
      expect(link).toHaveAttribute('href', atalho.destino);
      const cartao = within(conteudo())
        .getByText(atalho.descricao)
        .closest('.ant-card') as HTMLElement;
      expect(cartao.closest('a')).toBe(link);
    }
  });

  it('cada cartão de pasta está contido no seu link (acesso rápido)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /folders/root/contents': {
        status: 200,
        body: {
          folder: null,
          breadcrumb: [],
          folders: [pasta('folder-1', 'Protocolos')],
          files: [],
          canUpload: true,
        },
      },
    });

    renderApp(['/']);

    const cartoes = (await screen.findByText('Pastas da unidade')).closest(
      '.ant-card',
    ) as HTMLElement;
    // Sem `aria-label` aqui (design.md D2): o ícone é decorativo, então o nome
    // acessível do link continua a ser o nome da pasta.
    const link = await within(cartoes).findByRole('link', { name: 'Protocolos' });
    expect(link).toHaveAttribute('href', '/pastas/folder-1');
    const cartao = within(cartoes).getByText('Protocolos').closest('.ant-card') as HTMLElement;
    expect(cartao.closest('a')).toBe(link);
  });

  /**
   * "Atalho apresentado conduz a uma ação executável, sem recusa por
   * permissão" (US 11.1, cenário 2), e "atalhos distintos têm destinos
   * distintos". Cada destino interno é alcançado de fato, e o atalho conduz à
   * ação — o formulário de nova pasta aberto, o campo de busca focado.
   */
  it('os destinos dos atalhos são distintos e conduzem à ação anunciada', async () => {
    const destinos = atalhosDoPapel(UserRole.COLLABORATOR, MANUAL_URL).map((a) => a.destino);
    expect(destinos).toHaveLength(new Set(destinos).size);
    expect(destinos).toEqual(['/pastas?enviar=1', '/pastas?nova-pasta=1', '/busca', MANUAL_URL]);

    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });
    const novaPasta = renderApp(['/pastas?nova-pasta=1']);
    expect(await novaPasta.findByRole('dialog', { name: 'Nova pasta' })).toBeInTheDocument();
    novaPasta.unmount();

    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });
    const busca = renderApp(['/busca']);
    const campo = await busca.findByPlaceholderText('Buscar por nome');
    expect(campo).toHaveFocus();
    busca.unmount();
  });

  it('apresenta acesso rápido apenas às pastas que o servidor devolveu (US 11.1, cenário 3)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /folders/root/contents': {
        status: 200,
        body: {
          folder: null,
          breadcrumb: [],
          folders: [pasta('folder-1', 'Protocolos'), pasta('folder-2', 'Formulários')],
          files: [],
          canUpload: true,
        },
      },
    });

    renderApp(['/']);

    const cartoes = (await screen.findByText('Pastas da unidade')).closest(
      '.ant-card',
    ) as HTMLElement;
    expect(await within(cartoes).findByRole('link', { name: 'Protocolos' })).toHaveAttribute(
      'href',
      '/pastas/folder-1',
    );
    expect(within(cartoes).getByRole('link', { name: 'Formulários' })).toBeInTheDocument();
    // A SPA nunca inventa pasta: o que não vem do servidor não existe aqui.
    expect(within(cartoes).queryByRole('link', { name: 'Reservada' })).not.toBeInTheDocument();
  });

  it('cartão de pasta mostra a contagem do servidor, com o nome da pasta como nome acessível (demanda nº 3, item 7)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /folders/root/contents': {
        status: 200,
        body: {
          folder: null,
          breadcrumb: [],
          folders: [
            { ...pasta('folder-1', 'Geral'), documentCount: 12 },
            { ...pasta('folder-2', 'Governança'), documentCount: 1 },
            { ...pasta('folder-3', 'Setores'), documentCount: 0 },
            // API anterior a esta change: sem o campo, a linha é omitida.
            pasta('folder-4', 'Antiga'),
          ],
          files: [],
          canUpload: true,
        },
      },
    });

    renderApp(['/']);

    const cartoes = (await screen.findByText('Pastas da unidade')).closest(
      '.ant-card',
    ) as HTMLElement;
    const geral = await within(cartoes).findByRole('link', { name: 'Geral' });
    expect(geral).toHaveAttribute('href', '/pastas/folder-1');
    expect(geral).toHaveAccessibleDescription('12 documentos');
    expect(within(cartoes).getByRole('link', { name: 'Governança' })).toHaveAccessibleDescription(
      '1 documento',
    );
    expect(within(cartoes).getByRole('link', { name: 'Setores' })).toHaveAccessibleDescription(
      'Nenhum documento',
    );
    const antiga = within(cartoes).getByRole('link', { name: 'Antiga' });
    expect(antiga).not.toHaveAttribute('aria-describedby');
    expect(within(antiga).queryByText(/documento/)).not.toBeInTheDocument();
    // O ícone colorido é decorativo: não entra no nome nem é anunciado.
    expect(geral.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('sem pastas acessíveis a área orienta, em vez de ficar vazia sem explicação', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    const cartoes = (await screen.findByText('Pastas da unidade')).closest(
      '.ant-card',
    ) as HTMLElement;
    expect(
      await within(cartoes).findByText('Nenhuma pasta disponível para você no momento'),
    ).toBeInTheDocument();
  });

  it('lista os recentes na ordem do servidor, com a data de cada alteração (US 11.2, cenário 1)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /files/recent': {
        status: 200,
        body: {
          documents: [
            documento({
              id: 'file-recente',
              fileName: 'recente.pdf',
              changedAt: '2026-10-27T10:00:00.000Z',
              documentType: DocumentType.PROTOCOL,
              documentCode: 'PRT-001',
              documentRevision: 3,
              documentStatus: DocumentStatus.CURRENT,
            }),
            documento({
              id: 'file-antigo',
              fileName: 'antigo.pdf',
              changedAt: '2026-10-01T10:00:00.000Z',
            }),
          ],
        },
      },
    });

    renderApp(['/']);

    const recentes = (await screen.findByText('Documentos recentes')).closest(
      '.ant-card',
    ) as HTMLElement;
    await within(recentes).findByRole('table');
    const linhas = within(recentes).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(2);
    // Título limpo, sem extensão (demanda nº 3, item 12); o nome íntegro do
    // arquivo é o nome acessível do link do visualizador.
    expect(within(linhas[0]!).getByRole('button', { name: 'recente.pdf' })).toHaveTextContent(
      'recente',
    );
    expect(within(linhas[1]!).getByRole('button', { name: 'antigo.pdf' })).toBeInTheDocument();

    // Data da alteração, não a da publicação.
    expect(linhas[0]!.textContent).toContain('27/10/2026');
    expect(linhas[1]!.textContent).toContain('01/10/2026');

    // Tipo, código e situação vêm do servidor, como na listagem de pasta.
    expect(linhas[0]!.textContent).toContain('PRT');
    expect(linhas[0]!.textContent).toContain('PRT-001');
    expect(linhas[0]!.textContent).toContain('Vigente');
    // Unidade (da identidade, design.md D7) e revisão formatada.
    expect(linhas[0]!.textContent).toContain('Unidade Centro');
    expect(linhas[0]!.textContent).toContain('Rev. 03');
    // Colunas na ordem da demanda nº 2, seção 1.3.
    const cabecalhos = within(recentes)
      .getAllByRole('columnheader')
      .map((c) => c.textContent);
    expect(cabecalhos).toEqual([
      'Tipo',
      'Documento',
      'Unidade',
      'Revisão',
      'Situação',
      'Atualizado',
    ]);
  });

  it('ausência de alterações é informada, em vez de tabela vazia sem explicação (US 11.2, cenário 4)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    const recentes = (await screen.findByText('Documentos recentes')).closest(
      '.ant-card',
    ) as HTMLElement;
    expect(
      await within(recentes).findByText('Nenhuma alteração recente nos seus documentos'),
    ).toBeInTheDocument();
  });

  it('uma consulta lenta não bloqueia as demais áreas da tela (design.md, Risks)', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    // `/files/recent` nunca responde nesta montagem: as demais áreas precisam
    // aparecer de todo modo, porque as consultas são independentes.
    const nuncaResolve = new Promise<Response>(() => {});
    const fetchOriginal = globalThis.fetch;
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /folders/root/contents': {
        status: 200,
        body: {
          folder: null,
          breadcrumb: [],
          folders: [pasta('folder-1', 'Protocolos')],
          files: [],
          canUpload: true,
        },
      },
    });
    const comRecentesPendente = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (new URL(url, 'http://localhost').pathname === '/files/recent') return nuncaResolve;
      return comRecentesPendente(input, init);
    }) as typeof fetch;

    try {
      renderApp(['/']);

      // Saudação, atalhos e pastas resolvem mesmo com a lista de recentes
      // ainda pendurada.
      expect(await screen.findByText(SAUDACAO_MARIA)).toBeInTheDocument();
      const cartoes = (await screen.findByText('Pastas da unidade')).closest(
        '.ant-card',
      ) as HTMLElement;
      expect(await within(cartoes).findByRole('link', { name: 'Protocolos' })).toBeInTheDocument();
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('o destino "Recentes" da navegação apresenta a mesma lista', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /files/recent': {
        status: 200,
        body: { documents: [documento({ fileName: 'mudou.pdf' })] },
      },
    });

    renderApp(['/recentes']);

    expect(await screen.findByRole('heading', { name: 'Documentos recentes' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'mudou.pdf' })).toBeInTheDocument();
  });

  it('a tela inicial apresenta no máximo cinco documentos, e o histórico completo leva aos demais', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    const seis = Array.from({ length: 6 }, (_, i) =>
      documento({ id: `file-${i}`, fileName: `doc-${i}.pdf` }),
    );
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /files/recent': { status: 200, body: { documents: seis } },
    });

    renderApp(['/']);

    const recentes = (await screen.findByText('Documentos recentes')).closest(
      '.ant-card',
    ) as HTMLElement;
    await within(recentes).findByRole('button', { name: 'doc-0.pdf' });
    expect(within(recentes).getAllByRole('row').slice(1)).toHaveLength(5);
    expect(within(recentes).queryByRole('button', { name: 'doc-5.pdf' })).not.toBeInTheDocument();
    const historico = within(recentes).getByRole('link', { name: 'Ver histórico completo' });
    expect(historico).toHaveAttribute('href', '/recentes');

    fireEvent.click(historico);
    expect(await screen.findByRole('button', { name: 'doc-5.pdf' })).toBeInTheDocument();
  });

  it('"Ver todas as pastas" conduz à raiz do explorador', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    const pastas = (await screen.findByText('Pastas da unidade')).closest(
      '.ant-card',
    ) as HTMLElement;
    expect(within(pastas).getByRole('link', { name: 'Ver todas as pastas' })).toHaveAttribute(
      'href',
      '/pastas',
    );
  });

  describe('contagem de documentos novos na linha abaixo da saudação', () => {
    it('acrescenta a contagem que o servidor devolveu à linha de contexto', async () => {
      mockViewportWidth(WIDE_VIEWPORT);
      mockFetch({
        ...ROTAS_DA_TELA_INICIAL,
        'GET /auth/me': { status: 200, body: COLABORADOR },
        'GET /files/recent/new-count': {
          status: 200,
          body: { days: 7, count: 4, capped: false },
        },
      });

      renderApp(['/']);

      await screen.findByText(SAUDACAO_MARIA);
      expect(
        await within(conteudo()).findByText(
          'Colaborador · Unidade Centro — 4 documentos novos nos últimos 7 dias',
        ),
      ).toBeInTheDocument();
    });

    it('falha da contagem não impede a linha de contexto nem o resto da tela', async () => {
      mockViewportWidth(WIDE_VIEWPORT);
      mockFetch({
        ...ROTAS_DA_TELA_INICIAL,
        'GET /auth/me': { status: 200, body: COLABORADOR },
        'GET /files/recent/new-count': { status: 500, body: { error: 'x' } },
      });

      renderApp(['/']);

      await screen.findByText(SAUDACAO_MARIA);
      expect(
        await within(conteudo()).findByText('Colaborador · Unidade Centro'),
      ).toBeInTheDocument();
      expect(screen.getByText('Pastas da unidade')).toBeInTheDocument();
    });

    it('o texto da contagem trata zero, um, vários e o teto ("pelo menos")', () => {
      expect(textoDeNovos({ days: 7, count: 0, capped: false })).toBe(
        'nenhum documento novo nos últimos 7 dias',
      );
      expect(textoDeNovos({ days: 7, count: 1, capped: false })).toBe(
        '1 documento novo nos últimos 7 dias',
      );
      expect(textoDeNovos({ days: 7, count: 12, capped: false })).toBe(
        '12 documentos novos nos últimos 7 dias',
      );
      // O teto nunca é apresentado como contagem exata (design.md D3).
      expect(textoDeNovos({ days: 7, count: 300, capped: true })).toBe(
        'pelo menos 300 documentos novos nos últimos 7 dias',
      );
    });
  });

  describe('saudação por horário (design.md D9)', () => {
    const as = (hora: number) => new Date(2026, 10, 5, hora, 30);

    it.each([
      [5, 'Bom dia'],
      [11, 'Bom dia'],
      [12, 'Boa tarde'],
      [17, 'Boa tarde'],
      [18, 'Boa noite'],
      [0, 'Boa noite'],
      [4, 'Boa noite'],
    ])('às %ih a saudação é "%s"', (hora, esperado) => {
      expect(saudacaoDoHorario(as(hora))).toBe(esperado);
    });

    it('saúda pelo primeiro nome, e sem nome só pelo horário', () => {
      expect(saudacao('Mariana Bispo Santos', as(9))).toBe('Bom dia, Mariana!');
      expect(saudacao(null, as(20))).toBe('Boa noite!');
    });
  });

  it('coluna de leitura obrigatória e avisos: sem pendências nem avisos, os dois cartões dizem isso', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    const coluna = await screen.findByRole('complementary', {
      name: 'Leitura obrigatória e avisos',
    });
    expect(within(coluna).getByText('Leitura obrigatória')).toBeInTheDocument();
    expect(within(coluna).getByText('Avisos')).toBeInTheDocument();
    // Os dois cartões deixaram de ser reservados (changes
    // `superficies-de-pendencia` e `avisos-e-atrasos`): agora é verdade dizer
    // que não há.
    expect(await within(coluna).findByText('Nenhuma leitura obrigatória pendente.')).toBeVisible();
    expect(
      await within(coluna).findByText(/Nenhum aviso de leitura obrigatória\. Os demais avisos/),
    ).toBeVisible();
  });
});

/**
 * Change `marca-dagua-e-inicio-rodada-3` (demanda nº 3, itens 6, 8, 11 e 12).
 * A disposição real da grade (container query) é medida na app: o jsdom não
 * avalia `@container`, então aqui se afirma a estrutura.
 */
describe('Tela inicial — rodada 3 (marca-dagua-e-inicio-rodada-3)', () => {
  it('atalhos em grade por container query, fora do conteúdo principal', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({ ...ROTAS_DA_TELA_INICIAL, 'GET /auth/me': { status: 200, body: COLABORADOR } });

    renderApp(['/']);

    await screen.findByText(SAUDACAO_MARIA);
    const grade = conteudo().querySelector(`.${CLASSE_GRADE_ATALHOS}`) as HTMLElement;
    expect(grade).not.toBeNull();
    expect(grade).toHaveAttribute('data-tour', 'atalhos');
    // Os cartões são filhos diretos da grade interna (um link por atalho).
    const celulas = Array.from(grade.firstElementChild!.children);
    expect(celulas).toHaveLength(atalhosDoPapel(UserRole.COLLABORATOR, '').length);
    expect(celulas.every((c) => c.tagName === 'A')).toBe(true);
    // Largura total: a grade não está dentro do conteúdo principal.
    expect(grade.closest('[data-conteudo-principal]')).toBeNull();
    // A folha global declara as duas regras de container query.
    expect(ESTILO_GLOBAL).toContain(`@container (min-width: ${LIMIAR_ATALHOS_DUAS_COLUNAS}px)`);
    expect(ESTILO_GLOBAL).toContain(`@container (min-width: ${LIMIAR_ATALHOS_QUATRO_COLUNAS}px)`);
  });

  it('descrições curtas, e a da busca não promete o conteúdo dos arquivos', () => {
    const descricoes = atalhosDoPapel(UserRole.COLLABORATOR, MANUAL_URL).map((a) => a.descricao);
    expect(descricoes).toEqual([
      'Arraste ou selecione o arquivo',
      'Organize por setor ou tema',
      'Por nome ou código',
      'Passo a passo de cada tela',
    ]);
    const busca = atalhosDoPapel(UserRole.COLLABORATOR, '').find((a) => a.chave === 'buscar')!;
    expect(busca.descricao).not.toMatch(/conteúdo/i);
  });

  it('os quatro atalhos têm matizes distintos', () => {
    const tons = atalhosDoPapel(UserRole.COLLABORATOR, MANUAL_URL).map((a) => a.tom);
    expect(new Set(tons).size).toBe(4);
  });

  it('convite ao tour em cápsula: link pelo texto, ícone decorativo, destino do pedido de tour', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: { ...COLABORADOR, tourCompleted: false } },
    });

    renderApp(['/']);

    const convite = await screen.findByRole('link', {
      name: 'Primeira vez aqui? Faça o tour de 2 minutos',
    });
    expect(convite).toHaveAttribute('data-convite-ao-tour');
    expect(convite).toHaveAttribute('href', DESTINO_PEDIDO_DE_TOUR);
    expect(convite.style.borderRadius).toBe('999px');
    expect(convite.style.minHeight).toBe('44px');
    const icone = convite.querySelector('svg');
    expect(icone).not.toBeNull();
    expect(icone).toHaveAttribute('aria-hidden', 'true');
  });

  it('linha de recentes: título limpo em destaque, código embaixo, nome íntegro no nome acessível', async () => {
    mockViewportWidth(WIDE_VIEWPORT);
    mockFetch({
      ...ROTAS_DA_TELA_INICIAL,
      'GET /auth/me': { status: 200, body: COLABORADOR },
      'GET /files/recent': {
        status: 200,
        body: {
          documents: [
            documento({
              fileName: 'POP-ASS-004 - Emissão da declaração de óbito.pdf',
              documentType: DocumentType.PROCEDURE,
              documentCode: 'POP-ASS-004',
              documentRevision: 0,
              documentStatus: DocumentStatus.CURRENT,
            }),
          ],
        },
      },
    });

    renderApp(['/']);

    const titulo = await screen.findByRole('button', {
      name: 'POP-ASS-004 - Emissão da declaração de óbito.pdf',
    });
    expect(titulo).toHaveTextContent(/^Emissão da declaração de óbito$/);
    expect(titulo).toHaveAttribute('title', 'POP-ASS-004 - Emissão da declaração de óbito.pdf');
    const linha = titulo.closest('tr') as HTMLElement;
    expect(within(linha).getByText('POP-ASS-004')).toBeInTheDocument();

    // Etiqueta do tipo com largura uniforme e nome completo na dica.
    const etiqueta = within(linha).getByText('POP');
    expect(etiqueta.style.minWidth).toBe(`${LARGURA_ROTULO_DE_TIPO}px`);
    expect(etiqueta.style.fontWeight).toBe('600');
    expect(etiqueta).toHaveAttribute('title');

    fireEvent.click(titulo);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
