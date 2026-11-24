import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { App } from 'antd';
import { ReadingStatus } from '@gdoc/shared';
import type { OversightCampaignResponse, OversightPersonResponse } from '@gdoc/shared';
import { RotuloDeEstado } from '../app/RotuloDeEstado';
import { formatarDataDeRevisao } from '../shell/document-control-labels';
import { RotuloDaLeitura } from './apresentacao';
import {
  ROTULO_DA_SITUACAO,
  documentoDaMarcacao,
  exportarExcel,
  exportarPdf,
  filtrarPessoas,
  formatarDataHora,
  montarRelatorio,
  setorDaPessoa,
  type FiltrosDoRelatorio,
} from './exportar-relatorio';
import { useOversight, useOversightReport } from './queries';

function adesao(c: OversightCampaignResponse): string {
  return c.adherence === null ? '—' : `${c.adherence}%`;
}

/** Recorte apresentado, para o número não ser lido como o da marcação inteira (design.md D1). */
function alcance(c: OversightCampaignResponse): string {
  return c.scope === 'sector'
    ? `Sua equipe (setor ${c.scopeSectorName ?? '—'})`
    : 'Público inteiro';
}

function SituacaoDaMarcacao({ campanha }: { campanha: OversightCampaignResponse }) {
  return campanha.inProgress ? (
    <RotuloDeEstado tom="informativo">Em curso</RotuloDeEstado>
  ) : (
    <RotuloDeEstado>Encerrada</RotuloDeEstado>
  );
}

/**
 * Aba Acompanhamento (US 12.6, change `acompanhamento-de-leituras`; demanda nº
 * 2, seção 3.5): as marcações ao alcance de quem consulta, com os números, e o
 * relatório de uma delas. A marcação aberta vem do endereço (design.md D7), de
 * modo que o aviso ao gestor leva direto ao relatório.
 */
export function AcompanhamentoAba({
  marcacao,
  onAbrir,
}: {
  marcacao: string | null;
  onAbrir: (id: string | null) => void;
}) {
  if (marcacao) return <RelatorioDaMarcacao id={marcacao} onVoltar={() => onAbrir(null)} />;
  return <ListaDeMarcacoes onAbrir={onAbrir} />;
}

function ListaDeMarcacoes({ onAbrir }: { onAbrir: (id: string) => void }) {
  const lista = useOversight();
  if (lista.isLoading) return <Spin style={{ display: 'block', margin: '48px auto' }} />;
  if (lista.isError) {
    return <Result status="error" title="Não foi possível carregar o acompanhamento" />;
  }
  const campanhas = lista.data?.campaigns ?? [];
  if (campanhas.length === 0) {
    return <Empty description="Nenhuma leitura obrigatória para acompanhar no momento." />;
  }
  const colunas: ColumnsType<OversightCampaignResponse> = [
    { title: 'Documento', key: 'doc', render: (_, c) => documentoDaMarcacao(c) },
    { title: 'Unidade', key: 'unidade', render: (_, c) => c.unitName },
    { title: 'Prazo', key: 'prazo', render: (_, c) => formatarDataDeRevisao(c.dueDate) },
    { title: 'Situação', key: 'situacao', render: (_, c) => <SituacaoDaMarcacao campanha={c} /> },
    { title: 'Alcance', key: 'alcance', render: (_, c) => alcance(c) },
    { title: 'Público', key: 'total', align: 'right', render: (_, c) => c.total },
    { title: 'Confirmados', key: 'done', align: 'right', render: (_, c) => c.done },
    { title: 'Pendentes', key: 'pending', align: 'right', render: (_, c) => c.pending },
    { title: 'Atrasados', key: 'late', align: 'right', render: (_, c) => c.late },
    { title: 'Adesão', key: 'adesao', align: 'right', render: (_, c) => adesao(c) },
    {
      title: 'Ação',
      key: 'acao',
      render: (_, c) => (
        <Button
          size="small"
          aria-label={`Ver relatório: ${c.documentCode}`}
          onClick={() => onAbrir(c.id)}
        >
          Ver relatório
        </Button>
      ),
    },
  ];
  return (
    <Table
      rowKey="id"
      dataSource={campanhas}
      columns={colunas}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}

const SEM_FILTRO: FiltrosDoRelatorio = { unidade: null, setor: null, situacao: null };

function opcoes(valores: string[]) {
  return [...new Set(valores)]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((v) => ({ value: v, label: v }));
}

function RelatorioDaMarcacao({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const relatorio = useOversightReport(id);
  const { message } = App.useApp();
  const [filtros, setFiltros] = useState<FiltrosDoRelatorio>(SEM_FILTRO);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const pessoas = relatorio.data?.people ?? [];
  const filtradas = useMemo(() => filtrarPessoas(pessoas, filtros), [pessoas, filtros]);

  const voltar = (
    <Button type="link" style={{ padding: 0 }} onClick={onVoltar}>
      ← Todas as marcações
    </Button>
  );

  if (relatorio.isLoading) return <Spin style={{ display: 'block', margin: '48px auto' }} />;
  if (relatorio.isError || !relatorio.data) {
    // Fora do recorte e inexistente são o mesmo 404 (design.md D4).
    return (
      <Result
        status="warning"
        title="Relatório não disponível"
        subTitle="Esta marcação não existe ou não está no seu alcance de acompanhamento."
        extra={voltar}
      />
    );
  }

  const campanha = relatorio.data.campaign;

  async function exportar(formato: 'excel' | 'pdf') {
    setExportando(formato);
    try {
      const montado = montarRelatorio(campanha, filtradas, filtros);
      await (formato === 'excel' ? exportarExcel(montado) : exportarPdf(montado));
    } catch {
      message.error('Não foi possível gerar o arquivo. Tente novamente.');
    } finally {
      setExportando(null);
    }
  }

  const colunas: ColumnsType<OversightPersonResponse> = [
    { title: 'Nome', key: 'nome', render: (_, p) => p.name },
    { title: 'Unidade', key: 'unidade', render: (_, p) => p.unitName },
    { title: 'Setor', key: 'setor', render: (_, p) => setorDaPessoa(p) },
    {
      title: 'Situação',
      key: 'situacao',
      render: (_, p) => <RotuloDaLeitura leitura={{ status: p.status }} />,
    },
    { title: 'Prazo', key: 'prazo', render: (_, p) => formatarDataDeRevisao(p.dueDate) },
    {
      title: 'Ciência em',
      key: 'ciencia',
      render: (_, p) => (p.acknowledgedAt ? formatarDataHora(p.acknowledgedAt) : '—'),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      {voltar}
      <div>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          {documentoDaMarcacao(campanha)}
        </Typography.Title>
        <Space size={8} wrap>
          <Typography.Text type="secondary">
            {campanha.unitName} · Prazo {formatarDataDeRevisao(campanha.dueDate)} ·{' '}
            {alcance(campanha)}
          </Typography.Text>
          <SituacaoDaMarcacao campanha={campanha} />
        </Space>
      </div>
      <Row gutter={[16, 16]}>
        {(
          [
            ['Público', campanha.total],
            ['Confirmados', campanha.done],
            ['Pendentes', campanha.pending],
            ['Atrasados', campanha.late],
            ['Encerradas', campanha.closed],
            ['Adesão', adesao(campanha)],
          ] as const
        ).map(([titulo, valor]) => (
          <Col key={titulo} xs={12} sm={8} lg={4}>
            <Card size="small">
              <Statistic title={titulo} value={valor} />
            </Card>
          </Col>
        ))}
      </Row>
      <Space wrap>
        <Select
          aria-label="Filtrar por unidade"
          placeholder="Unidade"
          allowClear
          style={{ minWidth: 180 }}
          options={opcoes(pessoas.map((p) => p.unitName))}
          value={filtros.unidade}
          onChange={(v) => setFiltros({ ...filtros, unidade: v ?? null })}
        />
        <Select
          aria-label="Filtrar por setor"
          placeholder="Setor"
          allowClear
          style={{ minWidth: 180 }}
          options={opcoes(pessoas.map(setorDaPessoa))}
          value={filtros.setor}
          onChange={(v) => setFiltros({ ...filtros, setor: v ?? null })}
        />
        <Select
          aria-label="Filtrar por situação"
          placeholder="Situação"
          allowClear
          style={{ minWidth: 180 }}
          options={[
            ReadingStatus.PENDING,
            ReadingStatus.LATE,
            ReadingStatus.DONE,
            ReadingStatus.CLOSED,
          ].map((s) => ({ value: s, label: ROTULO_DA_SITUACAO[s] }))}
          value={filtros.situacao}
          onChange={(v) => setFiltros({ ...filtros, situacao: v ?? null })}
        />
        <Button loading={exportando === 'excel'} onClick={() => exportar('excel')}>
          Exportar Excel
        </Button>
        <Button loading={exportando === 'pdf'} onClick={() => exportar('pdf')}>
          Exportar PDF
        </Button>
      </Space>
      <Typography.Text type="secondary">
        {filtradas.length} de {pessoas.length} pessoa(s)
      </Typography.Text>
      <Table
        rowKey="assignmentId"
        dataSource={filtradas}
        columns={colunas}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Nenhuma pessoa com esses filtros.' }}
      />
    </Space>
  );
}
