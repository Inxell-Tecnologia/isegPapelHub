import type { Key, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Dropdown,
  Empty,
  List,
  Popconfirm,
  Result,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  IconeArquivo,
  IconeAuditoria,
  IconeBaixar,
  IconeBaixarVarios,
  IconeControleDocumental,
  IconeExcluir,
  IconeFavorito,
  IconeLeituraObrigatoria,
  IconeMaisAcoes,
  IconeMover,
  IconeNovaPasta,
  IconePasta,
  IconePermissoes,
  IconeEnviar,
  IconeRenomear,
  IconeVisualizar,
} from '../app/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { FileSummaryResponse, FolderResponse, MoveBatchItemResult } from '@gdoc/shared';
import { GrantResourceType, MOVE_BATCH_MAX_ITEMS_DEFAULT, UserRole } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useSession } from '../auth/session-context';
import { useNarrowMode } from '../app/responsive';
import { EtiquetaDeSituacao } from '../app/EtiquetaDeSituacao';
import { RotuloDeTipoDocumental } from '../app/RotuloDeTipoDocumental';
import { AUSENTE, formatarDataDeRevisao, formatarRevisao } from '../shell/document-control-labels';
import { DocumentControlModal } from './DocumentControlModal';
import { AuditoriaModal } from '../auditoria/AuditoriaModal';
import { PermissoesModal } from '../permissoes/PermissoesModal';
import { PreviewModal } from '../visualizacao/PreviewModal';
import { useDownloadFile } from '../visualizacao/useDownloadFile';
import { UploadArea } from '../upload/UploadArea';
import { PARAM_PEDIDO_DE_ENVIO } from './pedido-de-envio';
import { PARAM_PEDIDO_DE_NOVA_PASTA } from './pedido-de-nova-pasta';
import { paleta } from '../app/theme';
import { useToggleFavorite } from '../favoritos/queries';
import { MarcarLeituraModal } from '../leitura/MarcarLeituraModal';
import { mensagemDeFalhaAoFavoritar } from '../favoritos/acao-de-favorito';
import { DownloadFolderModal } from './DownloadFolderModal';
import {
  useCreateFolder,
  useDeleteFile,
  useDeleteFolder,
  useFolderContents,
  useMoveFile,
  useMoveFilesBatch,
  useMoveFolder,
  useMoveFoldersBatch,
  useRenameFile,
  useRenameFolder,
} from './queries';
import { NewFolderModal } from './NewFolderModal';
import { MoverItemModal, type MovingItem } from './MoverItemModal';
import { RenameItemModal, type RenamingItem } from './RenameItemModal';
import { formatDate, formatFileSize } from './format';

function isFolderCycleError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    typeof err.details === 'object' &&
    err.details !== null &&
    (err.details as { error?: unknown }).error === 'folder_cycle'
  );
}

function isFolderNameConflictError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    typeof err.details === 'object' &&
    err.details !== null &&
    (err.details as { error?: unknown }).error === 'folder_name_conflict'
  );
}

/** Mensagem da recusa de download de pasta por dispositivo (design.md D5, `web-responsividade`)
 * — texto distinguível da recusa por limite (`DownloadFolderModal`) e da recusa por permissão. */
const DOWNLOAD_FOLDER_DEVICE_REFUSAL =
  'Baixar pasta não está disponível neste dispositivo. Use um computador.';

/** Motivo legível de uma recusa por item do lote (design.md D2 do change `mover-itens-em-lote`). */
function describeMoveBatchError(error: string | undefined): string {
  if (error === 'folder_cycle') return 'destino dentro da própria pasta (ciclo)';
  if (error === 'folder_name_conflict') return 'já existe uma pasta com esse nome no destino';
  if (error === 'move_batch_limit_exceeded') return 'teto de itens por operação excedido';
  return 'permissão insuficiente';
}

/**
 * Uma perna do lote (arquivos OU pastas, design.md D4): dispara a requisição
 * quando há ids, e traduz uma recusa em nível de requisição inteira (destino
 * sem alcance, teto) num veredito por item — nenhum id deste sub-lote foi
 * movido, mas o relato ao usuário continua item a item, mesmo quando a causa
 * é a pré-condição global, não o item em si.
 */
async function runMoveBatchLeg(
  ids: string[],
  destinationFolderId: string | null,
  mutateAsync: (body: {
    ids: string[];
    destinationFolderId: string | null;
  }) => Promise<{ results: MoveBatchItemResult[] }>,
): Promise<MoveBatchItemResult[]> {
  if (ids.length === 0) return [];
  try {
    const response = await mutateAsync({ ids, destinationFolderId });
    return response.results;
  } catch (err) {
    const limitExceeded =
      err instanceof ApiError &&
      typeof err.details === 'object' &&
      err.details !== null &&
      (err.details as { error?: unknown }).error === 'move_batch_limit_exceeded';
    const error = limitExceeded ? 'move_batch_limit_exceeded' : 'forbidden';
    return ids.map((id) => ({ id, ok: false, error }));
  }
}

/**
 * Ações agrupadas do item (design.md D4, tasks.md 4.1): abaixo do limiar, as
 * ações que não são "Visualizar" colapsam num único menu por linha, sem que
 * nenhuma deixe de ser oferecida — inclusive a confirmação de exclusão
 * (Popconfirm) continua dentro do agrupamento (tasks.md 4.3). Usa
 * `popupRender` (mesmo padrão de `NotificationCenter`) em vez do `items` do
 * `Menu`, para o clique num botão interno (ex.: abrir o Popconfirm) não
 * fechar o Dropdown sozinho.
 */
function GroupedActions({ actions }: { actions: ReactNode[] }) {
  return (
    <Dropdown
      trigger={['click']}
      popupRender={() => (
        <Space
          direction="vertical"
          style={{
            padding: 8,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {actions}
        </Space>
      )}
    >
      <Button size="small" icon={<IconeMaisAcoes />} aria-label="Mais ações" />
    </Dropdown>
  );
}

interface ManagingResource {
  resourceType: GrantResourceType;
  resourceId: string;
  resourceName: string;
}

interface DownloadingFolder {
  folderId: string | null;
  folderName: string;
}

type Row =
  | { key: string; kind: 'folder'; folder: FolderResponse }
  | { key: string; kind: 'file'; file: FileSummaryResponse };

/**
 * Explorador de pastas/arquivos (US 2.1, US 2.2, US 4.2 — `web-navegacao`).
 * `:folderId` ausente = raiz da unidade; deep-link a pasta sem `view` recebe
 * 403 do servidor e não renderiza conteúdo (design.md D6).
 */
export function ExplorerPage() {
  const { folderId } = useParams<{ folderId?: string }>();
  const currentFolderId = folderId ?? null;
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { identity } = useSession();
  const isNarrow = useNarrowMode();
  // US 4.1 / design.md D2 (`web-permissoes`): ação "Permissões" só para admin,
  // espelhando o admin-only das rotas de `grants` no backend.
  const isAdmin =
    identity?.role === UserRole.UNIT_ADMIN || identity?.role === UserRole.GLOBAL_ADMIN;

  const { data, isLoading, isError, error } = useFolderContents(currentFolderId);
  // Pasta compartilhada por outra unidade (change
  // `compartilhamento-entre-unidades`, design.md D6, spec `web-navegacao`):
  // navegação somente leitura. O veredito vem do servidor (`readOnly`,
  // `canDownload`) — a SPA não o infere, e o servidor recusaria a escrita de
  // todo modo.
  const somenteLeitura = data?.readOnly === true;
  const podeBaixarCompartilhado = data?.canDownload === true;
  const createFolder = useCreateFolder();
  const renameFile = useRenameFile();
  const renameFolder = useRenameFolder();
  const moveFile = useMoveFile();
  const moveFolder = useMoveFolder();
  const moveFilesBatch = useMoveFilesBatch();
  const moveFoldersBatch = useMoveFoldersBatch();
  const deleteFile = useDeleteFile();
  const deleteFolder = useDeleteFolder();
  const alternarFavorito = useToggleFavorite();

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renamingItem, setRenamingItem] = useState<RenamingItem | null>(null);
  const [movingItems, setMovingItems] = useState<MovingItem[] | null>(null);
  const [previewingFile, setPreviewingFile] = useState<FileSummaryResponse | null>(null);
  const [managingResource, setManagingResource] = useState<ManagingResource | null>(null);
  const [auditingFile, setAuditingFile] = useState<FileSummaryResponse | null>(null);
  const [editingControlFile, setEditingControlFile] = useState<FileSummaryResponse | null>(null);
  // Leitura obrigatória (change `leitura-obrigatoria`): arquivo cujo
  // formulário de marcação está aberto.
  const [markingReadingFile, setMarkingReadingFile] = useState<FileSummaryResponse | null>(null);
  const [downloadingFolder, setDownloadingFolder] = useState<DownloadingFolder | null>(null);
  const { download, isPending: downloading } = useDownloadFile();

  // A ação da orientação de pasta vazia não duplica a área de envio: leva a
  // ela. Duas superfícies de envio na mesma tela confundiriam qual é a
  // verdadeira, e a área já carrega a pré-checagem de espaço, o fatiamento e
  // o relato de falha por item — nada disso se reimplementa num botão.
  const areaDeEnvioRef = useRef<HTMLDivElement>(null);
  function focarAreaDeEnvio() {
    const gatilho = areaDeEnvioRef.current?.querySelector('button');
    gatilho?.scrollIntoView?.({ block: 'nearest' });
    gatilho?.focus();
  }

  // Pedido de envio vindo do endereço (change `cartoes-de-atalho-acionaveis`,
  // design.md D5): o atalho "Enviar documentos" da tela inicial conduz ao
  // envio em si, e não a uma tela onde o envio ainda precise ser localizado.
  //
  // A condição é `data?.canUpload`, não o papel: quem decide se há envio
  // naquela pasta é o servidor, e o veredito chega no DTO de conteúdo. Até ele
  // chegar nada acontece; sem permissão nada acontece nunca — é assim que um
  // atalho apresentado não conduz a uma recusa (`tela-inicial`, cenário
  // "O atalho de envio não conduz a uma recusa"). O cliente não antecipa
  // permissão aqui, como não antecipa em nenhum outro ponto da tela.
  //
  // Chegado o veredito, o parâmetro sai do endereço **substituindo** a entrada
  // de histórico — tenha o pedido sido atendido ou não. Sem isso, recarregar a
  // tela ou voltar a ela roubaria o foco de quem já está trabalhando na pasta,
  // e um endereço guardado nos favoritos carregaria para sempre um pedido que
  // fazia sentido uma única vez. Sair também na recusa é o que impede um
  // pedido de ficar latente: a verificação na app mostrou o parâmetro
  // sobrevivendo numa pasta sem envio permitido, de onde uma revalidação que
  // trocasse `canUpload` faria o foco saltar para a área de envio muito depois
  // do clique que o pediu.
  const [searchParams, setSearchParams] = useSearchParams();
  const pedidoDeEnvio = searchParams.get(PARAM_PEDIDO_DE_ENVIO) !== null;
  const vereditoDeEnvio = data?.canUpload;
  useEffect(() => {
    if (!pedidoDeEnvio || vereditoDeEnvio === undefined) return;
    if (vereditoDeEnvio) focarAreaDeEnvio();
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        proximo.delete(PARAM_PEDIDO_DE_ENVIO);
        return proximo;
      },
      { replace: true },
    );
  }, [pedidoDeEnvio, vereditoDeEnvio, setSearchParams]);

  // Pedido de nova pasta (change `conteudo-da-tela-inicio`, design.md D5):
  // mesmo ciclo do pedido de envio — espera o conteúdo chegar, é atendido uma
  // vez e sai do endereço substituindo a entrada de histórico. Só a **raiz**
  // atende: ali criar pasta é livre a qualquer pessoa autenticada; numa
  // subpasta a regra é do servidor, e o cliente não a antecipa — o pedido é
  // descartado sem abrir nada.
  const pedidoDeNovaPasta = searchParams.get(PARAM_PEDIDO_DE_NOVA_PASTA) !== null;
  const conteudoChegou = data !== undefined;
  useEffect(() => {
    if (!pedidoDeNovaPasta || !conteudoChegou) return;
    if (currentFolderId === null) setNewFolderOpen(true);
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        proximo.delete(PARAM_PEDIDO_DE_NOVA_PASTA);
        return proximo;
      },
      { replace: true },
    );
  }, [pedidoDeNovaPasta, conteudoChegou, currentFolderId, setSearchParams]);

  // Seleção múltipla (US 2.4, design.md D3 do change `mover-itens-em-lote`):
  // escopada à pasta corrente, esvaziada ao navegar — entrar em subpasta,
  // voltar pela trilha ou chegar por outra rota, tudo muda `currentFolderId`.
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [currentFolderId]);

  // US 2.2 cenário 2 / design.md D4: o cliente não infere permissão, oferece
  // a ação e trata o 403 do servidor com um aviso — sem aplicar a mudança.
  function handlePermissionError(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      message.error('Permissão insuficiente para executar esta ação.');
      return;
    }
    message.error('Não foi possível concluir a ação. Tente novamente.');
  }

  // US 2.3, design.md D3/D4/D5 (`mover-e-renomear-itens`) e design.md D5 de
  // `web-navegacao`: ciclo e conflito de nome são recusas distinguíveis entre
  // si e do aviso de permissão insuficiente, todas vindas do servidor.
  function handleMoveOrRenameFolderError(err: unknown) {
    if (isFolderCycleError(err)) {
      message.error(
        'Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta dela.',
      );
      return;
    }
    if (isFolderNameConflictError(err)) {
      message.error('Já existe uma pasta com esse nome no destino.');
      return;
    }
    handlePermissionError(err);
  }

  // Favoritos (change `favoritos`, design.md D5): a indicação vem do servidor,
  // na própria listagem — a SPA não cruza a página com a lista inteira.
  const pastasFavoritas = new Set(data?.favoriteFolderIds ?? []);
  const arquivosFavoritos = new Set(data?.favoriteFileIds ?? []);

  async function handleToggleFavorite(
    resourceType: GrantResourceType,
    resourceId: string,
    favorite: boolean,
  ) {
    try {
      await alternarFavorito.mutateAsync({ resourceType, resourceId, favorite });
      message.success(favorite ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
    } catch (err) {
      message.error(mensagemDeFalhaAoFavoritar(err));
    }
  }

  /** Ação de favorito do item: o rótulo diz o estado, sem depender de cor. */
  function botaoDeFavorito(resourceType: GrantResourceType, resourceId: string, favorito: boolean) {
    return (
      <Button
        key="favorito"
        size="small"
        icon={<IconeFavorito />}
        loading={alternarFavorito.isPending}
        onClick={() => handleToggleFavorite(resourceType, resourceId, !favorito)}
      >
        {favorito ? 'Remover dos favoritos' : 'Favoritar'}
      </Button>
    );
  }

  /** Marca de favorito junto ao nome — texto acessível, cor só como redundância. */
  function marcaDeFavorito(favorito: boolean) {
    if (!favorito) return null;
    return (
      <span role="img" aria-label="Favorito" title="Favorito" style={{ color: paleta.verdeAcao }}>
        <IconeFavorito />
      </span>
    );
  }

  // Documento de leitura obrigatória (change `superficies-de-pendencia`,
  // design.md D4): o veredito vem da listagem (`requiredReading`), e ausência
  // é "não apresentar". Mesma forma da marca de favorito — nome acessível e
  // dica com o mesmo texto, a informação nunca só no desenho.
  function marcaDeLeituraObrigatoria(marcado: boolean | undefined) {
    if (!marcado) return null;
    return (
      <span
        role="img"
        aria-label="Leitura obrigatória"
        title="Leitura obrigatória"
        style={{ color: paleta.azulLink }}
      >
        <IconeLeituraObrigatoria />
      </span>
    );
  }

  async function handleCreateFolder(name: string) {
    try {
      await createFolder.mutateAsync({ name, parentId: currentFolderId ?? undefined });
      setNewFolderOpen(false);
    } catch (err) {
      handlePermissionError(err);
    }
  }

  async function handleRenameItem(name: string) {
    if (!renamingItem) return;
    try {
      if (renamingItem.kind === 'folder') {
        await renameFolder.mutateAsync({ folderId: renamingItem.id, name });
      } else {
        await renameFile.mutateAsync({ fileId: renamingItem.id, fileName: name });
      }
      setRenamingItem(null);
    } catch (err) {
      handleMoveOrRenameFolderError(err);
    }
  }

  // US 2.4, design.md D2/D4/D7 (`mover-itens-em-lote`): informa quantos
  // itens foram movidos e lista nominalmente cada recusado com o motivo —
  // nem "falha total", nem "sucesso total" quando o resultado é parcial.
  function reportBatchMoveResult(items: MovingItem[], results: MoveBatchItemResult[]) {
    const nameById = new Map(items.map((item) => [item.id, item.name]));
    const failures = results.filter(
      (result): result is Extract<MoveBatchItemResult, { ok: false }> => !result.ok,
    );
    const okCount = results.length - failures.length;

    if (failures.length === 0) {
      message.success(
        results.length === 1 ? 'Item movido com sucesso.' : `${okCount} itens movidos com sucesso.`,
      );
      return;
    }

    const summary =
      okCount === 0
        ? 'Nenhum item foi movido. Verifique a permissão sobre o destino.'
        : `${okCount} de ${results.length} itens movidos.`;

    message.warning({
      content: (
        <div style={{ textAlign: 'left' }}>
          <div>{summary}</div>
          <List
            size="small"
            dataSource={failures}
            renderItem={(failure) => (
              <List.Item style={{ padding: '2px 0', border: 'none' }}>
                {(nameById.get(failure.id) ?? failure.id) +
                  ': ' +
                  describeMoveBatchError(failure.error)}
              </List.Item>
            )}
          />
        </div>
      ),
      duration: 8,
    });
  }

  async function handleMoveConfirm(destinationFolderId: string | null) {
    if (!movingItems || movingItems.length === 0) return;
    try {
      // Um único item reusa a rota por item, existente e inalterada — o
      // lote (abaixo) só entra em jogo a partir de duas seleções.
      if (movingItems.length === 1) {
        const item = movingItems[0]!;
        if (item.kind === 'folder') {
          await moveFolder.mutateAsync({ folderId: item.id, destinationFolderId });
        } else {
          await moveFile.mutateAsync({ fileId: item.id, destinationFolderId });
        }
        setMovingItems(null);
        setSelectedRowKeys([]);
        return;
      }

      const folderIds = movingItems.filter((it) => it.kind === 'folder').map((it) => it.id);
      const fileIds = movingItems.filter((it) => it.kind === 'file').map((it) => it.id);

      // Duas requisições distintas, consolidadas num único aviso (design.md
      // D4): a pré-condição de destino é avaliada uma vez por perna, sem
      // atomicidade entre arquivos e pastas.
      const [folderResults, fileResults] = await Promise.all([
        runMoveBatchLeg(folderIds, destinationFolderId, moveFoldersBatch.mutateAsync),
        runMoveBatchLeg(fileIds, destinationFolderId, moveFilesBatch.mutateAsync),
      ]);

      reportBatchMoveResult(movingItems, [...folderResults, ...fileResults]);
      setMovingItems(null);
      setSelectedRowKeys([]);
    } catch (err) {
      handleMoveOrRenameFolderError(err);
    }
  }

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.folders.map((folder) => ({ key: folder.id, kind: 'folder' as const, folder })),
      ...data.files.map((file) => ({ key: file.id, kind: 'file' as const, file })),
    ];
  }, [data]);

  const selectedItems: MovingItem[] = useMemo(() => {
    const keySet = new Set(selectedRowKeys);
    return rows
      .filter((row) => keySet.has(row.key))
      .map((row) =>
        row.kind === 'folder'
          ? { id: row.folder.id, name: row.folder.name, kind: 'folder' as const }
          : { id: row.file.id, name: row.file.fileName, kind: 'file' as const },
      );
  }, [rows, selectedRowKeys]);

  // Recusa antes do envio (US 2.4, tasks.md 7.4): o teto é avaliado também
  // no servidor (`move_batch_limit_exceeded`), este é só o atalho de UX que
  // evita a requisição — ver o comentário de `MOVE_BATCH_MAX_ITEMS_DEFAULT`
  // em `packages/shared` sobre por que o cliente usa o mesmo padrão.
  function handleOpenBatchMove() {
    if (selectedItems.length > MOVE_BATCH_MAX_ITEMS_DEFAULT) {
      message.error(
        `Seleção de ${selectedItems.length} itens excede o teto de ${MOVE_BATCH_MAX_ITEMS_DEFAULT} por operação.`,
      );
      return;
    }
    setMovingItems(selectedItems);
  }

  async function handleDeleteFile(fileId: string) {
    try {
      await deleteFile.mutateAsync(fileId);
    } catch (err) {
      handlePermissionError(err);
    }
  }

  async function handleDeleteChildFolder(id: string) {
    try {
      await deleteFolder.mutateAsync(id);
    } catch (err) {
      handlePermissionError(err);
    }
  }

  // design.md D5: excluir a pasta corrente (de dentro dela) navega ao pai
  // antes de invalidar — a listagem-pai é recarregada na nova rota.
  async function handleDeleteCurrentFolder() {
    if (!data?.folder) return;
    const parentId = data.folder.parentId;
    try {
      await deleteFolder.mutateAsync(data.folder.id);
      navigate(parentId ? `/pastas/${parentId}` : '/pastas');
    } catch (err) {
      handlePermissionError(err);
    }
  }

  // design.md D5 (`web-responsividade`): abaixo do limiar o botão permanece
  // visível e a recusa acontece aqui, antes de qualquer chamada ao servidor
  // — nenhuma URL assinada é emitida, nenhuma auditoria é registrada
  // (`DownloadFolderModal` só abre e busca o manifesto no modo largo).
  function handleOpenDownloadFolder(target: DownloadingFolder) {
    if (isNarrow) {
      message.error(DOWNLOAD_FOLDER_DEVICE_REFUSAL);
      return;
    }
    setDownloadingFolder(target);
  }

  const breadcrumbItems = useMemo(() => {
    if (!data) return [];
    if (data.folder === null) {
      return [{ title: 'Documentos' }];
    }
    return [
      data.readOnly
        ? { title: <Link to="/compartilhados">Compartilhados comigo</Link> }
        : { title: <Link to="/pastas">Documentos</Link> },
      ...data.breadcrumb.map((crumb) => ({
        key: crumb.id,
        title: <Link to={`/pastas/${crumb.id}`}>{crumb.name}</Link>,
      })),
      { title: data.folder.name },
    ];
  }, [data]);

  const columns: ColumnsType<Row> = [
    {
      title: 'Tipo',
      key: 'type',
      width: 56,
      render: (_, row) => (row.kind === 'folder' ? <IconePasta /> : <IconeArquivo />),
    },
    {
      title: 'Nome',
      key: 'name',
      render: (_, row) =>
        row.kind === 'folder' ? (
          <Space size={4}>
            <Link to={`/pastas/${row.folder.id}`}>{row.folder.name}</Link>
            {marcaDeFavorito(pastasFavoritas.has(row.folder.id))}
          </Space>
        ) : (
          <div>
            <Space>
              {/* US 10.1 cenário 1: a sigla do tipo vem **junto ao nome**, e é
                  texto — a cor acompanha, nunca substitui (cenário 2). */}
              {row.file.documentType && <RotuloDeTipoDocumental tipo={row.file.documentType} />}
              <Button
                type="link"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => setPreviewingFile(row.file)}
              >
                {row.file.fileName}
              </Button>
              {marcaDeFavorito(arquivosFavoritos.has(row.file.id))}
              {marcaDeLeituraObrigatoria(row.file.requiredReading)}
              {row.file.status !== 'active' && <Tag>{row.file.status}</Tag>}
            </Space>
            {row.file.documentCode && (
              <div>
                <Typography.Text type="secondary">{row.file.documentCode}</Typography.Text>
              </div>
            )}
          </div>
        ),
    },
    {
      title: 'Tamanho',
      key: 'size',
      render: (_, row) => (row.kind === 'file' ? formatFileSize(row.file.sizeBytes) : '—'),
    },
    {
      title: 'Data',
      key: 'createdAt',
      render: (_, row) =>
        formatDate(row.kind === 'folder' ? row.folder.createdAt : row.file.createdAt),
    },
    // US 10.3 e US 10.4: revisão, responsável, prazo e situação por linha.
    // Dado ausente aparece como ausência explícita (`AUSENTE`), nunca como
    // valor presumido — um `Rev. 01` inventado afirmaria um controle que
    // nunca existiu.
    {
      title: 'Revisão',
      key: 'revision',
      render: (_, row) =>
        row.kind === 'file' ? formatarRevisao(row.file.documentRevision) : AUSENTE,
    },
    {
      title: 'Responsável',
      key: 'responsible',
      render: (_, row) => (row.kind === 'file' ? (row.file.responsibleSector ?? AUSENTE) : AUSENTE),
    },
    {
      title: 'Próxima revisão',
      key: 'nextReview',
      render: (_, row) =>
        row.kind === 'file' ? formatarDataDeRevisao(row.file.nextReviewAt) : AUSENTE,
    },
    {
      title: 'Situação',
      key: 'documentStatus',
      render: (_, row) =>
        row.kind === 'file' ? (
          // A situação é a que o **servidor** apurou (web-navegacao): a SPA
          // não a recalcula a partir da data e do relógio do dispositivo —
          // dois navegadores com relógios diferentes mostrariam vereditos
          // diferentes sobre o mesmo documento.
          <EtiquetaDeSituacao file={row.file} />
        ) : (
          AUSENTE
        ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, row) => {
        if (row.kind === 'folder' && somenteLeitura) return null;
        if (row.kind === 'folder') {
          const folderActions: ReactNode[] = [
            <Button
              key="baixar"
              size="small"
              icon={<IconeBaixar />}
              onClick={() =>
                handleOpenDownloadFolder({ folderId: row.folder.id, folderName: row.folder.name })
              }
            >
              Baixar pasta
            </Button>,
            botaoDeFavorito(
              GrantResourceType.FOLDER,
              row.folder.id,
              pastasFavoritas.has(row.folder.id),
            ),
            <Button
              key="renomear"
              size="small"
              icon={<IconeRenomear />}
              onClick={() =>
                setRenamingItem({ id: row.folder.id, name: row.folder.name, kind: 'folder' })
              }
            >
              Renomear
            </Button>,
            <Button
              key="mover"
              size="small"
              icon={<IconeMover />}
              onClick={() =>
                setMovingItems([{ id: row.folder.id, name: row.folder.name, kind: 'folder' }])
              }
            >
              Mover para...
            </Button>,
            ...(isAdmin
              ? [
                  <Button
                    key="permissoes"
                    size="small"
                    icon={<IconePermissoes />}
                    onClick={() =>
                      setManagingResource({
                        resourceType: GrantResourceType.FOLDER,
                        resourceId: row.folder.id,
                        resourceName: row.folder.name,
                      })
                    }
                  >
                    Permissões
                  </Button>,
                ]
              : []),
            <Popconfirm
              key="excluir"
              title="Excluir pasta"
              description="A pasta e seu conteúdo vão para a lixeira."
              okText="Sim, excluir"
              cancelText="Cancelar"
              onConfirm={() => handleDeleteChildFolder(row.folder.id)}
            >
              <Button danger size="small" icon={<IconeExcluir />}>
                Excluir
              </Button>
            </Popconfirm>,
          ];

          // design.md D4: pasta não tem "visualizar" — abrir a pasta (link do
          // nome) já é a interação direta, então no modo estreito todas as
          // ações desta linha colapsam no menu agrupado.
          return isNarrow ? (
            <GroupedActions actions={folderActions} />
          ) : (
            <Space>{folderActions}</Space>
          );
        }

        if (somenteLeitura) {
          return (
            <Space>
              <Button
                size="small"
                icon={<IconeVisualizar />}
                onClick={() => setPreviewingFile(row.file)}
              >
                Visualizar
              </Button>
              {podeBaixarCompartilhado && (
                <Button
                  size="small"
                  icon={<IconeBaixarVarios />}
                  loading={downloading}
                  onClick={() => download(row.file.id)}
                >
                  Baixar
                </Button>
              )}
            </Space>
          );
        }

        const secondaryActions: ReactNode[] = [
          <Button
            key="baixar"
            size="small"
            icon={<IconeBaixarVarios />}
            loading={downloading}
            onClick={() => download(row.file.id)}
          >
            Baixar
          </Button>,
          botaoDeFavorito(GrantResourceType.FILE, row.file.id, arquivosFavoritos.has(row.file.id)),
          <Button
            key="renomear"
            size="small"
            icon={<IconeRenomear />}
            onClick={() =>
              setRenamingItem({ id: row.file.id, name: row.file.fileName, kind: 'file' })
            }
          >
            Renomear
          </Button>,
          <Button
            key="mover"
            size="small"
            icon={<IconeMover />}
            onClick={() =>
              setMovingItems([{ id: row.file.id, name: row.file.fileName, kind: 'file' }])
            }
          >
            Mover para...
          </Button>,
          ...(isAdmin
            ? [
                <Button
                  key="permissoes"
                  size="small"
                  icon={<IconePermissoes />}
                  onClick={() =>
                    setManagingResource({
                      resourceType: GrantResourceType.FILE,
                      resourceId: row.file.id,
                      resourceName: row.file.fileName,
                    })
                  }
                >
                  Permissões
                </Button>,
              ]
            : []),
          // US 7.1/US 7.2, design.md D1 (`web-auditoria`, Opção A): estende o
          // gate de admin ao dono do arquivo — visibilidade é UX, o 403
          // fail-closed do servidor (`canReadAudit`) é a defesa real.
          ...(isAdmin || row.file.ownerId === identity?.id
            ? [
                <Button
                  key="auditoria"
                  size="small"
                  icon={<IconeAuditoria />}
                  onClick={() => setAuditingFile(row.file)}
                >
                  Auditoria
                </Button>,
              ]
            : []),
          // US 10.5: a ação é oferecida **só** a quem o servidor autorizaria
          // (`canEditControl`, resolvido na própria listagem). A SPA não
          // infere permissão — ausência do veredito é "não oferecer".
          ...(row.file.canEditControl
            ? [
                <Button
                  key="controle"
                  size="small"
                  icon={<IconeControleDocumental />}
                  onClick={() => setEditingControlFile(row.file)}
                >
                  Dados de controle
                </Button>,
                // Leitura obrigatória (change `leitura-obrigatoria`, design.md
                // D4): o mesmo veredito que governa os dados de controle — quem
                // edita o documento decide marcá-lo. Elegibilidade e público,
                // o formulário pergunta ao servidor.
                <Button
                  key="leitura"
                  size="small"
                  icon={<IconeLeituraObrigatoria />}
                  onClick={() => setMarkingReadingFile(row.file)}
                >
                  Leitura obrigatória
                </Button>,
              ]
            : []),
          <Popconfirm
            key="excluir"
            title="Excluir arquivo"
            description="O arquivo vai para a lixeira."
            okText="Sim, excluir"
            cancelText="Cancelar"
            onConfirm={() => handleDeleteFile(row.file.id)}
          >
            <Button danger size="small" icon={<IconeExcluir />}>
              Excluir
            </Button>
          </Popconfirm>,
        ];

        // design.md D4: "Visualizar" é o verbo central da consulta e
        // permanece direta em qualquer largura; as demais colapsam no menu
        // agrupado abaixo do limiar — nenhuma ação é suprimida, só reagrupada.
        return (
          <Space>
            <Button
              size="small"
              icon={<IconeVisualizar />}
              onClick={() => setPreviewingFile(row.file)}
            >
              Visualizar
            </Button>
            {isNarrow ? <GroupedActions actions={secondaryActions} /> : secondaryActions}
          </Space>
        );
      },
    },
  ];

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  }

  if (isError) {
    // design.md D6: 403 do GET de conteúdo (pasta inexistente, de outra
    // unidade ou sem `view`) bloqueia sem renderizar nome/conteúdo algum.
    if (error instanceof ApiError && error.status === 403) {
      return (
        <Result
          status="403"
          title="Sem permissão"
          subTitle="Você não tem permissão para acessar esta pasta."
        />
      );
    }
    return (
      <Result
        status="error"
        title="Não foi possível carregar o conteúdo"
        subTitle="Verifique sua conexão e tente novamente."
      />
    );
  }

  if (!data) return null;

  return (
    <div>
      {/* design.md D7 (`web-responsividade`): a trilha de uma subpasta
          profunda é o texto que mais facilmente estoura em 360px — rola
          dentro do próprio contêiner em vez do documento. */}
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <Breadcrumb items={breadcrumbItems} style={{ whiteSpace: 'nowrap' }} />
      </div>
      {somenteLeitura && data.sharedFrom && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Compartilhada pela unidade ${data.sharedFrom.unitName}`}
          description="Somente leitura: você pode visualizar os documentos e, quando permitido, baixá-los."
        />
      )}
      {!somenteLeitura && (
        <Space wrap style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<IconeNovaPasta />} onClick={() => setNewFolderOpen(true)}>
            Nova pasta
          </Button>
          {/* Oferecida uniformemente, inclusive na raiz da unidade — a recusa
            por limite é que ensina o teto, não a ausência da ação
            (design.md D9). Abaixo do limiar, a recusa é por dispositivo
            (design.md D5 de `responsividade-mobile-tablet`). */}
          <Button
            icon={<IconeBaixar />}
            onClick={() =>
              handleOpenDownloadFolder({
                folderId: currentFolderId,
                folderName: data.folder?.name ?? 'Documentos',
              })
            }
          >
            Baixar esta pasta
          </Button>
          {data.folder !== null && (
            <Popconfirm
              title="Excluir esta pasta"
              description="A pasta e seu conteúdo vão para a lixeira."
              okText="Sim, excluir"
              cancelText="Cancelar"
              onConfirm={handleDeleteCurrentFolder}
            >
              <Button danger icon={<IconeExcluir />}>
                Excluir esta pasta
              </Button>
            </Popconfirm>
          )}
        </Space>
      )}
      {!somenteLeitura && (
        <div ref={areaDeEnvioRef}>
          <UploadArea
            destinationFolderId={currentFolderId}
            destinationOwnedByRequester={data?.ownedByRequester ?? true}
          />
        </div>
      )}
      {/* Barra de ação em lote (US 2.4, design.md D3/D8 do change
          `mover-itens-em-lote`): visível a partir de um item selecionado,
          alcançável também abaixo do ponto de ruptura — a seleção não é
          herdeira da recusa por dispositivo aplicada ao download de pasta,
          porque mover não desloca bytes nem monta arquivo no navegador. */}
      {selectedItems.length > 0 && (
        <Space wrap style={{ marginBottom: 16 }}>
          <Typography.Text>
            {selectedItems.length === 1
              ? '1 item selecionado'
              : `${selectedItems.length} itens selecionados`}
          </Typography.Text>
          <Button icon={<IconeMover />} onClick={handleOpenBatchMove}>
            Mover selecionados
          </Button>
        </Space>
      )}
      {/* Estado vazio orientado (capability `web-navegacao`, requisito "Pasta
          sem conteúdo orienta em vez de apresentar tabela vazia"): no lugar da
          tabela vazia herdada do design system — cabeçalho de colunas sobre
          nenhuma linha —, a tela diz o que está acontecendo e qual é o próximo
          passo.

          A ação de envio é oferecida **só** quando o servidor já resolveu que
          a pessoa pode enviar (`canUpload`, design.md D10). A SPA não infere
          permissão no cliente: ela reflete o veredito que veio no DTO. */}
      {rows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary">
              {somenteLeitura
                ? 'Não há documentos compartilhados nesta pasta.'
                : data.canUpload
                  ? 'Esta pasta ainda não tem documentos. Envie o primeiro para começar.'
                  : 'Esta pasta ainda não tem documentos.'}
            </Typography.Text>
          }
        >
          {data.canUpload && (
            <Button type="primary" icon={<IconeEnviar />} onClick={focarAreaDeEnvio}>
              Enviar documento
            </Button>
          )}
        </Empty>
      ) : (
        <Table<Row>
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowSelection={
            somenteLeitura
              ? undefined
              : {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys),
                }
          }
        />
      )}
      <NewFolderModal
        open={newFolderOpen}
        submitting={createFolder.isPending}
        onCancel={() => setNewFolderOpen(false)}
        onSubmit={handleCreateFolder}
      />
      <RenameItemModal
        item={renamingItem}
        submitting={renamingItem?.kind === 'folder' ? renameFolder.isPending : renameFile.isPending}
        onCancel={() => setRenamingItem(null)}
        onSubmit={handleRenameItem}
      />
      <MoverItemModal
        items={movingItems}
        submitting={
          movingItems && movingItems.length === 1
            ? movingItems[0]!.kind === 'folder'
              ? moveFolder.isPending
              : moveFile.isPending
            : moveFoldersBatch.isPending || moveFilesBatch.isPending
        }
        onCancel={() => setMovingItems(null)}
        onConfirm={handleMoveConfirm}
      />
      <PreviewModal file={previewingFile} onClose={() => setPreviewingFile(null)} />
      <AuditoriaModal file={auditingFile} onClose={() => setAuditingFile(null)} />
      <DocumentControlModal file={editingControlFile} onClose={() => setEditingControlFile(null)} />
      {downloadingFolder && (
        <DownloadFolderModal
          open
          folderId={downloadingFolder.folderId}
          folderName={downloadingFolder.folderName}
          onClose={() => setDownloadingFolder(null)}
        />
      )}
      <PermissoesModal
        resourceType={managingResource ? managingResource.resourceType : GrantResourceType.FILE}
        resourceId={managingResource ? managingResource.resourceId : ''}
        resourceName={managingResource ? managingResource.resourceName : ''}
        open={managingResource !== null}
        onClose={() => setManagingResource(null)}
      />
      <MarcarLeituraModal file={markingReadingFile} onClose={() => setMarkingReadingFile(null)} />
    </div>
  );
}
