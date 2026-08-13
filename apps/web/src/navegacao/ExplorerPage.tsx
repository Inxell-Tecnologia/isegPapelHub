import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  App,
  Breadcrumb,
  Button,
  Dropdown,
  Popconfirm,
  Result,
  Space,
  Spin,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AuditOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOutlined,
  LockOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { FileSummaryResponse, FolderResponse } from '@gdoc/shared';
import { GrantResourceType, UserRole } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useSession } from '../auth/session-context';
import { useNarrowMode } from '../app/responsive';
import { AuditoriaModal } from '../auditoria/AuditoriaModal';
import { PermissoesModal } from '../permissoes/PermissoesModal';
import { PreviewModal } from '../visualizacao/PreviewModal';
import { useDownloadFile } from '../visualizacao/useDownloadFile';
import { UploadArea } from '../upload/UploadArea';
import { DownloadFolderModal } from './DownloadFolderModal';
import {
  useCreateFolder,
  useDeleteFile,
  useDeleteFolder,
  useFolderContents,
  useRenameFile,
} from './queries';
import { NewFolderModal } from './NewFolderModal';
import { RenameFileModal } from './RenameFileModal';
import { formatDate, formatFileSize } from './format';

/** Mensagem da recusa de download de pasta por dispositivo (design.md D5, `web-responsividade`)
 * — texto distinguível da recusa por limite (`DownloadFolderModal`) e da recusa por permissão. */
const DOWNLOAD_FOLDER_DEVICE_REFUSAL =
  'Baixar pasta não está disponível neste dispositivo. Use um computador.';

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
      <Button size="small" icon={<MoreOutlined />} aria-label="Mais ações" />
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
  const createFolder = useCreateFolder();
  const renameFile = useRenameFile();
  const deleteFile = useDeleteFile();
  const deleteFolder = useDeleteFolder();

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<FileSummaryResponse | null>(null);
  const [previewingFile, setPreviewingFile] = useState<FileSummaryResponse | null>(null);
  const [managingResource, setManagingResource] = useState<ManagingResource | null>(null);
  const [auditingFile, setAuditingFile] = useState<FileSummaryResponse | null>(null);
  const [downloadingFolder, setDownloadingFolder] = useState<DownloadingFolder | null>(null);
  const { download, isPending: downloading } = useDownloadFile();

  // US 2.2 cenário 2 / design.md D4: o cliente não infere permissão, oferece
  // a ação e trata o 403 do servidor com um aviso — sem aplicar a mudança.
  function handlePermissionError(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      message.error('Permissão insuficiente para executar esta ação.');
      return;
    }
    message.error('Não foi possível concluir a ação. Tente novamente.');
  }

  async function handleCreateFolder(name: string) {
    try {
      await createFolder.mutateAsync({ name, parentId: currentFolderId ?? undefined });
      setNewFolderOpen(false);
    } catch (err) {
      handlePermissionError(err);
    }
  }

  async function handleRenameFile(fileName: string) {
    if (!renamingFile) return;
    try {
      await renameFile.mutateAsync({ fileId: renamingFile.id, fileName });
      setRenamingFile(null);
    } catch (err) {
      handlePermissionError(err);
    }
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
      return [{ title: 'Arquivos' }];
    }
    return [
      { title: <Link to="/pastas">Arquivos</Link> },
      ...data.breadcrumb.map((crumb) => ({
        key: crumb.id,
        title: <Link to={`/pastas/${crumb.id}`}>{crumb.name}</Link>,
      })),
      { title: data.folder.name },
    ];
  }, [data]);

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.folders.map((folder) => ({ key: folder.id, kind: 'folder' as const, folder })),
      ...data.files.map((file) => ({ key: file.id, kind: 'file' as const, file })),
    ];
  }, [data]);

  const columns: ColumnsType<Row> = [
    {
      title: 'Tipo',
      key: 'type',
      width: 56,
      render: (_, row) => (row.kind === 'folder' ? <FolderOutlined /> : <FileOutlined />),
    },
    {
      title: 'Nome',
      key: 'name',
      render: (_, row) =>
        row.kind === 'folder' ? (
          <Link to={`/pastas/${row.folder.id}`}>{row.folder.name}</Link>
        ) : (
          <Space>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => setPreviewingFile(row.file)}
            >
              {row.file.fileName}
            </Button>
            {row.file.status !== 'active' && <Tag>{row.file.status}</Tag>}
          </Space>
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
    {
      title: 'Ações',
      key: 'actions',
      render: (_, row) => {
        if (row.kind === 'folder') {
          const folderActions: ReactNode[] = [
            <Button
              key="baixar"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() =>
                handleOpenDownloadFolder({ folderId: row.folder.id, folderName: row.folder.name })
              }
            >
              Baixar pasta
            </Button>,
            ...(isAdmin
              ? [
                  <Button
                    key="permissoes"
                    size="small"
                    icon={<LockOutlined />}
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
              <Button danger size="small" icon={<DeleteOutlined />}>
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

        const secondaryActions: ReactNode[] = [
          <Button
            key="baixar"
            size="small"
            icon={<CloudDownloadOutlined />}
            loading={downloading}
            onClick={() => download(row.file.id)}
          >
            Baixar
          </Button>,
          <Button
            key="renomear"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setRenamingFile(row.file)}
          >
            Renomear
          </Button>,
          ...(isAdmin
            ? [
                <Button
                  key="permissoes"
                  size="small"
                  icon={<LockOutlined />}
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
                  icon={<AuditOutlined />}
                  onClick={() => setAuditingFile(row.file)}
                >
                  Auditoria
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
            <Button danger size="small" icon={<DeleteOutlined />}>
              Excluir
            </Button>
          </Popconfirm>,
        ];

        // design.md D4: "Visualizar" é o verbo central da consulta e
        // permanece direta em qualquer largura; as demais colapsam no menu
        // agrupado abaixo do limiar — nenhuma ação é suprimida, só reagrupada.
        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewingFile(row.file)}>
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
      <Space wrap style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<FolderAddOutlined />} onClick={() => setNewFolderOpen(true)}>
          Nova pasta
        </Button>
        {/* Oferecida uniformemente, inclusive na raiz da unidade — a recusa
            por limite é que ensina o teto, não a ausência da ação
            (design.md D9). Abaixo do limiar, a recusa é por dispositivo
            (design.md D5 de `responsividade-mobile-tablet`). */}
        <Button
          icon={<DownloadOutlined />}
          onClick={() =>
            handleOpenDownloadFolder({
              folderId: currentFolderId,
              folderName: data.folder?.name ?? 'Arquivos',
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
            <Button danger icon={<DeleteOutlined />}>
              Excluir esta pasta
            </Button>
          </Popconfirm>
        )}
      </Space>
      <UploadArea destinationFolderId={currentFolderId} />
      <Table<Row>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
      <NewFolderModal
        open={newFolderOpen}
        submitting={createFolder.isPending}
        onCancel={() => setNewFolderOpen(false)}
        onSubmit={handleCreateFolder}
      />
      <RenameFileModal
        file={renamingFile}
        submitting={renameFile.isPending}
        onCancel={() => setRenamingFile(null)}
        onSubmit={handleRenameFile}
      />
      <PreviewModal file={previewingFile} onClose={() => setPreviewingFile(null)} />
      <AuditoriaModal file={auditingFile} onClose={() => setAuditingFile(null)} />
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
    </div>
  );
}
