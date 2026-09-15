import { App, Button, Empty, Popconfirm, Result, Space, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, FileOutlined, FolderOutlined, UndoOutlined } from '@ant-design/icons';
import type { FileRestoreResponse, TrashEntryResponse } from '@gdoc/shared';
import { GrantResourceType } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { formatDate, formatFileSize } from '../navegacao/format';
import { useStorageQuota } from '../upload/queries';
import { usePurgeTrash, useRestoreFile, useRestoreFolder, useTrash } from './queries';

const TYPE_LABEL: Record<TrashEntryResponse['type'], string> = {
  [GrantResourceType.FOLDER]: 'Pasta',
  [GrantResourceType.FILE]: 'Arquivo',
};

/** Dias restantes até `expiresAt`, arredondado para cima (design.md D4) — só formatação; o vencimento é do servidor. */
function daysRemaining(expiresAt: string): number {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/** Cor do `Tag` por faixa de urgência (design.md D4): ≤3 dias vermelho, ≤7 laranja, senão neutro. */
function daysRemainingColor(days: number): string | undefined {
  if (days <= 3) return 'red';
  if (days <= 7) return 'orange';
  return undefined;
}

/**
 * Tela de Lixeira (US 6.1 cenário 1, `web-lixeira`): lista as raízes de
 * exclusão no alcance do requisitante e oferece restaurar por linha,
 * despachando por `entry.type` (design.md D1/D2).
 *
 * Oferece também esvaziar a lixeira — expurgo imediato dos **arquivos
 * próprios**, com confirmação quantificada (change `esvaziar-lixeira`,
 * design.md D4).
 */
export function LixeiraPage() {
  const { message } = App.useApp();
  const { data, isLoading, isError, refetch } = useTrash();
  const restoreFile = useRestoreFile();
  const restoreFolder = useRestoreFolder();
  const purgeTrash = usePurgeTrash();
  // Os dois números da confirmação quantificada (change `esvaziar-lixeira`,
  // design.md D4) vêm de `GET /files/quota`: `trashedFiles`/`trashedBytes`
  // contam exatamente os arquivos próprios na lixeira — os mesmos que
  // `POST /trash/purge` apaga. `GET /trash` não serve para isso: lista raízes
  // de exclusão no alcance do solicitante (inclusive alheias, por grant ou
  // por ser admin) e não informa tamanho.
  const { data: quota } = useStorageQuota();

  // US 6.1 cenário 1 / design.md D6: 403 (item expurgado, deixou de ser raiz,
  // ou permissão perdida) recarrega a lista em vez de aplicar a mudança.
  function handleRestoreError(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      message.error('Permissão insuficiente para restaurar este item.');
      void refetch();
      return;
    }
    message.error('Não foi possível concluir a ação. Tente novamente.');
  }

  // design.md D3: só o arquivo pode voltar à raiz (`redirectedToRoot`);
  // pasta nunca muda de local, então a mensagem é sempre "local de origem".
  function notifyFileRestored(result: FileRestoreResponse) {
    if (result.redirectedToRoot) {
      message.warning(
        'A pasta de origem não existe mais; o arquivo foi restaurado na raiz da unidade.',
      );
      return;
    }
    message.success('Arquivo restaurado ao local de origem.');
  }

  async function handleRestore(entry: TrashEntryResponse) {
    try {
      if (entry.type === GrantResourceType.FILE) {
        const result = await restoreFile.mutateAsync(entry.id);
        notifyFileRestored(result);
        return;
      }
      await restoreFolder.mutateAsync(entry.id);
      message.success('Pasta restaurada ao local de origem.');
    } catch (err) {
      handleRestoreError(err);
    }
  }

  async function handlePurge() {
    try {
      const result = await purgeTrash.mutateAsync();
      if (result.purgedFiles === 0 && result.failedFiles === 0) {
        message.info('Nenhum arquivo seu havia na lixeira.');
        return;
      }
      message.success(
        `${result.purgedFiles} arquivo(s) apagado(s) permanentemente. ` +
          `${formatFileSize(result.reclaimedBytes)} de espaço devolvido(s).`,
      );
      // Falha por item não derruba o expurgo (design.md D3): o que falhou
      // continua na lixeira, e a pessoa precisa saber que o número não fechou.
      if (result.failedFiles > 0) {
        message.warning(
          `${result.failedFiles} arquivo(s) não pôde(puderam) ser apagado(s) e continuam na lixeira.`,
        );
      }
    } catch {
      message.error('Não foi possível esvaziar a lixeira. Tente novamente.');
    }
  }

  const columns: ColumnsType<TrashEntryResponse> = [
    {
      title: 'Tipo',
      key: 'type',
      width: 56,
      render: (_, entry) =>
        entry.type === GrantResourceType.FOLDER ? <FolderOutlined /> : <FileOutlined />,
    },
    { title: 'Nome', key: 'name', dataIndex: 'name' },
    { title: 'Tipo', key: 'typeLabel', render: (_, entry) => TYPE_LABEL[entry.type] },
    {
      title: 'Data de exclusão',
      key: 'deletedAt',
      render: (_, entry) => formatDate(entry.deletedAt),
    },
    {
      title: 'Dias restantes',
      key: 'daysRemaining',
      render: (_, entry) => {
        const days = daysRemaining(entry.expiresAt);
        return <Tag color={daysRemainingColor(days)}>{days} dia(s)</Tag>;
      },
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, entry) => (
        <Popconfirm
          title="Restaurar item"
          description="O item volta ao local de origem."
          okText="Sim, restaurar"
          cancelText="Cancelar"
          onConfirm={() => handleRestore(entry)}
        >
          <Button size="small" icon={<UndoOutlined />}>
            Restaurar
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  }

  if (isError) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar a lixeira"
        subTitle="Verifique sua conexão e tente novamente."
      />
    );
  }

  if (!data) return null;

  // Sem o retrato da cota não há como quantificar a troca, e uma confirmação
  // genérica ("tem certeza?") não permite avaliá-la (design.md D4) — então a
  // ação não aparece. Sem arquivo próprio na lixeira também não: não há nada
  // para apagar nem espaço algum a devolver (pasta não ocupa bytes, D1).
  const purgeAction =
    quota && quota.trashedFiles > 0 ? (
      <Space style={{ marginBottom: 16, justifyContent: 'flex-end', width: '100%' }}>
        <Popconfirm
          title="Esvaziar a lixeira"
          description={
            `${quota.trashedFiles} arquivo(s) seu(s) serão apagados permanentemente, ` +
            `devolvendo ${formatFileSize(quota.trashedBytes)} de espaço. ` +
            'A ação não tem volta: eles não poderão mais ser restaurados. ' +
            'Pastas e arquivos de outras pessoas não são afetados.'
          }
          okText="Sim, apagar definitivamente"
          okButtonProps={{ danger: true }}
          cancelText="Cancelar"
          onConfirm={handlePurge}
        >
          <Button danger icon={<DeleteOutlined />} loading={purgeTrash.isPending}>
            Esvaziar lixeira
          </Button>
        </Popconfirm>
      </Space>
    ) : null;

  if (data.items.length === 0) {
    return (
      <>
        {purgeAction}
        <Empty description="A lixeira está vazia" style={{ margin: '48px auto' }} />
      </>
    );
  }

  return (
    <>
      {purgeAction}
      <Table<TrashEntryResponse>
        rowKey="id"
        columns={columns}
        dataSource={data.items}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </>
  );
}
