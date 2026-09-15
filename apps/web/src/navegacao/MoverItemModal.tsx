import { useEffect, useState } from 'react';
import { Breadcrumb, Button, List, Modal, Space, Spin, Typography } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { useFolderContents } from './queries';

export interface MovingItem {
  id: string;
  name: string;
  kind: 'file' | 'folder';
}

interface MoverItemModalProps {
  items: MovingItem[] | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (destinationFolderId: string | null) => void;
}

/**
 * Seletor de pasta de destino, para um item ou um conjunto (US 2.3/US 2.4,
 * design.md D7 do change `mover-itens-em-lote`): navega a árvore da unidade
 * nível a nível sobre `GET /folders/root/contents` e
 * `GET /folders/:id/contents`, já existentes — sem endpoint de leitura novo.
 * Reabre sempre na raiz ao trocar de seleção. A trilha indica o nível
 * corrente e é clicável para voltar; escolher a raiz é sempre possível pelo
 * botão de confirmação enquanto nenhuma pasta foi aberta. Não antecipa a
 * decisão de permissão sobre o destino, nem se o destino escolhido está
 * dentro da própria seleção: uma pasta listada aqui que o servidor recuse
 * produz o aviso do 403 (ou do ciclo), do mesmo jeito que qualquer outra ação.
 */
export function MoverItemModal({ items, submitting, onCancel, onConfirm }: MoverItemModalProps) {
  const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);
  const open = items !== null && items.length > 0;

  useEffect(() => {
    if (items !== null && items.length > 0) setBrowsingFolderId(null);
  }, [items]);

  const { data, isLoading } = useFolderContents(browsingFolderId, { enabled: open });

  const breadcrumbItems = [
    {
      key: 'root',
      title: <a onClick={() => setBrowsingFolderId(null)}>Raiz da unidade</a>,
    },
    ...(data?.breadcrumb.map((crumb) => ({
      key: crumb.id,
      title: <a onClick={() => setBrowsingFolderId(crumb.id)}>{crumb.name}</a>,
    })) ?? []),
    ...(data?.folder ? [{ key: data.folder.id, title: data.folder.name }] : []),
  ];

  const title =
    items && items.length === 1
      ? `Mover "${items[0]!.name}" para...`
      : items && items.length > 1
        ? `Mover ${items.length} itens para...`
        : 'Mover';

  return (
    <Modal title={title} open={open} onCancel={onCancel} footer={null} destroyOnClose>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ overflowX: 'auto' }}>
          <Breadcrumb items={breadcrumbItems} style={{ whiteSpace: 'nowrap' }} />
        </div>

        {/* design.md D7 do change `mover-itens-em-lote`: o seletor deixa
            visível quantos itens serão movidos antes da confirmação, para
            um conjunto ou para um único item. */}
        {items && items.length > 0 && (
          <Typography.Text type="secondary">
            {items.length === 1 ? '1 item selecionado' : `${items.length} itens selecionados`}
          </Typography.Text>
        )}

        <Button
          type="primary"
          block
          loading={submitting}
          onClick={() => onConfirm(browsingFolderId)}
        >
          Mover para {data?.folder ? `"${data.folder.name}"` : 'a raiz da unidade'}
        </Button>

        {isLoading ? (
          <Spin />
        ) : (
          <List
            dataSource={data?.folders ?? []}
            locale={{ emptyText: 'Nenhuma subpasta aqui' }}
            renderItem={(folder) => (
              <List.Item
                actions={[
                  <Button key="entrar" size="small" onClick={() => setBrowsingFolderId(folder.id)}>
                    Entrar
                  </Button>,
                ]}
              >
                <Space>
                  <FolderOutlined />
                  {folder.name}
                </Space>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Modal>
  );
}
