import { useState } from 'react';
import { App, Button, Popconfirm, Result, Space, Spin, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { IconeNovo } from '../app/icons';
import { RotuloDeEstado } from '../app/RotuloDeEstado';
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
    'A unidade ainda tem colaboradores vinculados e não pode ser desativada. Remova ou desative os colaboradores antes.',
  'cannot deactivate own or bootstrap unit':
    'Esta unidade não pode ser desativada (é a sua unidade ou a unidade inicial do sistema).',
  headquarters_cannot_be_disabled:
    'A SEDE não pode ser desativada. Desmarque-a como SEDE antes, se for o caso.',
};

/** Mensagens da marcação de SEDE (change `compartilhamento-entre-unidades`, design.md D11). */
const HEADQUARTERS_ERROR_MESSAGE: Record<string, string> = {
  headquarters_already_set: 'Já existe uma SEDE. Desmarque a atual antes de marcar outra unidade.',
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

  // Só uma SEDE (design.md D11): enquanto houver uma, a ação "Marcar como
  // SEDE" fica indisponível nas demais, com a orientação no próprio botão.
  const currentHeadquarters = (data ?? []).find((unit) => unit.isHeadquarters);

  async function handleToggleHeadquarters(unit: UnitResponse) {
    try {
      await updateUnit.mutateAsync({
        id: unit.id,
        body: { isHeadquarters: !unit.isHeadquarters },
      });
      message.success(
        unit.isHeadquarters ? `${unit.name} deixou de ser a SEDE.` : `${unit.name} agora é a SEDE.`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        message.error(
          HEADQUARTERS_ERROR_MESSAGE[err.message] ?? 'Não foi possível alterar a SEDE.',
        );
        return;
      }
      message.error('Não foi possível concluir a ação. Tente novamente.');
    }
  }

  const columns: ColumnsType<UnitResponse> = [
    {
      title: 'Nome',
      key: 'name',
      render: (_, unit) => (
        <Space size={8}>
          <span>{unit.name}</span>
          {unit.isHeadquarters && <RotuloDeEstado tom="positivo">SEDE</RotuloDeEstado>}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, unit) => (
        <RotuloDeEstado tom={unit.status === UnitStatus.ACTIVE ? 'positivo' : 'neutro'}>
          {STATUS_LABEL[unit.status]}
        </RotuloDeEstado>
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
            {unit.isHeadquarters ? (
              <Popconfirm
                title="Desmarcar SEDE"
                description="Os compartilhamentos entre unidades dependem da SEDE e deixam de valer enquanto não houver uma. Nada é apagado: marcar de novo devolve o acesso."
                okText="Sim, desmarcar"
                cancelText="Cancelar"
                onConfirm={() => handleToggleHeadquarters(unit)}
              >
                <Button size="small">Desmarcar SEDE</Button>
              </Popconfirm>
            ) : (
              isActive && (
                <Tooltip
                  title={
                    currentHeadquarters
                      ? `A SEDE atual é ${currentHeadquarters.name}. Desmarque-a antes de marcar outra unidade.`
                      : undefined
                  }
                >
                  <Popconfirm
                    title="Marcar como SEDE"
                    description="A SEDE pode compartilhar pastas e documentos com as demais unidades, e as unidades podem compartilhar com ela, somente para visualizar e baixar."
                    okText="Sim, marcar"
                    cancelText="Cancelar"
                    disabled={Boolean(currentHeadquarters)}
                    onConfirm={() => handleToggleHeadquarters(unit)}
                  >
                    <Button size="small" disabled={Boolean(currentHeadquarters)}>
                      Marcar como SEDE
                    </Button>
                  </Popconfirm>
                </Tooltip>
              )
            )}
            {unit.isHeadquarters ? null : isActive ? (
              <Popconfirm
                title="Desativar unidade"
                description="Só é possível desativar uma unidade sem colaboradores vinculados. A ação é reversível."
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
        <Button type="primary" icon={<IconeNovo />} onClick={openCreate}>
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
