import { useEffect, useState } from 'react';
import { Breadcrumb, Button, List, Modal, Space, Spin } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { useFolderContents } from './queries';

export interface MovingItem {
  id: string;
  name: string;
  kind: 'file' | 'folder';
}

interface MoverItemModalProps {
  item: MovingItem | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (destinationFolderId: string | null) => void;
}

/**
 * Seletor de pasta de destino (US 2.3, design.md D7): navega a árvore da
 * unidade nível a nível sobre `GET /folders/root/contents` e
 * `GET /folders/:id/contents`, já existentes — sem endpoint de leitura novo.
 * Reabre sempre na raiz ao trocar de item. A trilha indica o nível corrente
 * e é clicável para voltar; escolher a raiz é sempre possível pelo botão de
 * confirmação enquanto nenhuma pasta foi aberta. Não antecipa a decisão de
 * permissão sobre o destino: uma pasta listada aqui que o servidor recuse
 * produz o aviso do 403, do mesmo jeito que qualquer outra ação.
 */
export function MoverItemModal({ item, submitting, onCancel, onConfirm }: MoverItemModalProps) {
  const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (item) setBrowsingFolderId(null);
  }, [item]);

  const { data, isLoading } = useFolderContents(browsingFolderId, { enabled: item !== null });

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

  return (
    <Modal
      title={item ? `Mover "${item.name}" para...` : 'Mover'}
      open={item !== null}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ overflowX: 'auto' }}>
          <Breadcrumb items={breadcrumbItems} style={{ whiteSpace: 'nowrap' }} />
        </div>

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
