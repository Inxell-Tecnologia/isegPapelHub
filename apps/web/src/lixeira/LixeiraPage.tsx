import { App, Button, Empty, Popconfirm, Result, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileOutlined, FolderOutlined, UndoOutlined } from '@ant-design/icons';
import type { FileRestoreResponse, TrashEntryResponse } from '@gdoc/shared';
import { GrantResourceType } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { formatDate } from '../navegacao/format';
import { useRestoreFile, useRestoreFolder, useTrash } from './queries';

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
 */
export function LixeiraPage() {
  const { message } = App.useApp();
  const { data, isLoading, isError, refetch } = useTrash();
  const restoreFile = useRestoreFile();
  const restoreFolder = useRestoreFolder();

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

  if (data.items.length === 0) {
    return <Empty description="A lixeira está vazia" style={{ margin: '48px auto' }} />;
  }

  return (
    <Table<TrashEntryResponse>
      rowKey="id"
      columns={columns}
      dataSource={data.items}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}
