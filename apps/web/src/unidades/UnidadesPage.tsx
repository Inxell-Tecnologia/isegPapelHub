import { useState } from 'react';
import { App, Button, Popconfirm, Result, Space, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import type { UnitResponse } from '@gdoc/shared';
import { UnitStatus } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { UnidadeFormModal } from './UnidadeFormModal';
import { useUnits, useUpdateUnit } from './queries';

const STATUS_LABEL: Record<UnitStatus, string> = {
  [UnitStatus.ACTIVE]: 'Ativa',
  [UnitStatus.DISABLED]: 'Desativada',
};

/** Mensagens de recusa de desativação (change `gestao-de-unidades`, D2/D3), por `error` da API. */
const DEACTIVATE_ERROR_MESSAGE: Record<string, string> = {
  'unit not empty':
    'A unidade ainda tem pessoas vinculadas e não pode ser desativada. Remova ou desative as pessoas antes.',
  'cannot deactivate own or bootstrap unit':
    'Esta unidade não pode ser desativada (é a sua unidade ou a unidade inicial do sistema).',
};

/**
 * Gestão de unidades pela administração global (change `gestao-de-unidades`,
 * `web-unidades`, design.md D1). A guarda de rota `[global_admin]` já barra os
 * demais papéis; o servidor continua sendo o guardião (403 em `/units`).
 */
export function UnidadesPage() {
  const { message } = App.useApp();
  const { data, isLoading, isError } = useUnits();
  const updateUnit = useUpdateUnit();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitResponse | null>(null);

  function openCreate() {
    setEditingUnit(null);
    setModalOpen(true);
  }

  function openRename(unit: UnitResponse) {
    setEditingUnit(unit);
    setModalOpen(true);
  }

  async function handleToggleStatus(unit: UnitResponse) {
    const status = unit.status === UnitStatus.ACTIVE ? UnitStatus.DISABLED : UnitStatus.ACTIVE;
    try {
      await updateUnit.mutateAsync({ id: unit.id, body: { status } });
    } catch (err) {
      // 409 ao desativar (não vazia / própria / bootstrap): aviso claro, sem
      // alterar o estado exibido (a listagem não muda). 403 = permissão.
      if (err instanceof ApiError && err.status === 409) {
        message.error(
          DEACTIVATE_ERROR_MESSAGE[err.message] ?? 'Não foi possível desativar a unidade.',
        );
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        message.error('Permissão insuficiente para executar esta ação.');
        return;
      }
      message.error('Não foi possível concluir a ação. Tente novamente.');
    }
  }

  const columns: ColumnsType<UnitResponse> = [
    { title: 'Nome', key: 'name', dataIndex: 'name' },
    {
      title: 'Status',
      key: 'status',
      render: (_, unit) => (
        <Tag color={unit.status === UnitStatus.ACTIVE ? 'green' : 'default'}>
          {STATUS_LABEL[unit.status]}
        </Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, unit) => {
        const isActive = unit.status === UnitStatus.ACTIVE;
        return (
          <Space>
            <Button size="small" onClick={() => openRename(unit)}>
              Renomear
            </Button>
            {isActive ? (
              <Popconfirm
                title="Desativar unidade"
                description="Só é possível desativar uma unidade sem pessoas vinculadas. A ação é reversível."
                okText="Sim, desativar"
                cancelText="Cancelar"
                onConfirm={() => handleToggleStatus(unit)}
              >
                <Button size="small" danger>
                  Desativar
                </Button>
              </Popconfirm>
            ) : (
              <Button size="small" onClick={() => handleToggleStatus(unit)}>
                Ativar
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  }

  if (isError) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar as unidades"
        subTitle="Verifique sua conexão e tente novamente."
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nova unidade
        </Button>
      </div>
      <Table<UnitResponse>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        scroll={{ x: 'max-content' }}
      />
      <UnidadeFormModal
        target={editingUnit ?? undefined}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
