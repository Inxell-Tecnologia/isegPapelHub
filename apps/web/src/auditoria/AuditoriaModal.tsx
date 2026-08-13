import { Button, Empty, Modal, Result, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AuditQueryEventResponse, FileSummaryResponse } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { formatDate } from '../navegacao/format';
import { useFileAudit } from './queries';

interface AuditoriaModalProps {
  file: FileSummaryResponse | null;
  onClose: () => void;
}

/** A resposta não traz `id` por evento — chave sintética estável para a `Table`. */
type AuditRow = AuditQueryEventResponse & { key: string };

/** Rótulo pt-BR por ação (design.md D4) — só `view`/`download` são retornados pela consulta. */
const ACTION_LABEL: Record<AuditQueryEventResponse['action'], string> = {
  view: 'Visualizar',
  download: 'Baixar',
};

/**
 * Modal de auditoria de acesso de um arquivo (US 7.1/US 7.2, `web-auditoria`,
 * design.md D2). Ponto de entrada é a ação "Auditoria" por-linha do
 * explorador — não existe tela global, pois `GET /files/:id/audit` é sempre
 * por arquivo.
 */
export function AuditoriaModal({ file, onClose }: AuditoriaModalProps) {
  const open = file !== null;
  const { data, isLoading, isError, error } = useFileAudit(file?.id ?? '', open);

  const columns: ColumnsType<AuditRow> = [
    {
      title: 'Pessoa',
      key: 'person',
      render: (_, row) => row.actor.name ?? row.actor.email,
    },
    {
      title: 'Ação',
      key: 'action',
      render: (_, row) => <Tag>{ACTION_LABEL[row.action]}</Tag>,
    },
    {
      title: 'Data/hora',
      key: 'createdAt',
      render: (_, row) => formatDate(row.createdAt),
    },
  ];

  return (
    <Modal
      title={`Auditoria — ${file?.fileName ?? ''}`}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Fechar</Button>}
      destroyOnClose
      width={720}
    >
      {file && renderBody()}
    </Modal>
  );

  function renderBody() {
    if (isLoading) {
      return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
    }

    if (isError) {
      // design.md D5: 403 fail-closed do servidor (arquivo inexistente, de
      // outra unidade, na lixeira, ou solicitante não-dono/admin) exibe aviso
      // neutro, sem distinguir subcasos nem expor conteúdo — mesmo padrão do
      // PreviewModal/handlePermissionError.
      if (error instanceof ApiError && error.status === 403) {
        return (
          <Result
            status="403"
            title="Permissão insuficiente"
            subTitle="Você não tem permissão para consultar a auditoria deste arquivo."
          />
        );
      }
      return (
        <Result
          status="error"
          title="Não foi possível carregar a auditoria"
          subTitle="Verifique sua conexão e tente novamente."
        />
      );
    }

    const events = data?.events ?? [];
    if (events.length === 0) {
      return <Empty description="Nenhum acesso registrado" />;
    }

    const rows: AuditRow[] = events.map((event, index) => ({
      ...event,
      key: `${event.actor.id}-${event.action}-${event.createdAt}-${index}`,
    }));

    return (
      <Table<AuditRow>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    );
  }
}
