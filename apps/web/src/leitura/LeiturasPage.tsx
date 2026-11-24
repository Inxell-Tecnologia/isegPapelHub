import { useState } from 'react';
import { Empty, Result, Spin, Table, Tabs, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FileSummaryResponse } from '@gdoc/shared';
import { ReadingStatus } from '@gdoc/shared';
import { PreviewModal } from '../visualizacao/PreviewModal';
import {
  BotaoLerEConfirmar,
  RotuloDaLeitura,
  documentoDaLeitura,
  prazoDaLeitura,
} from './apresentacao';
import { estaAberta, useMyReadings, useOversight, type MinhaLeitura } from './queries';
import { useSearchParams } from 'react-router-dom';
import { AcompanhamentoAba } from './AcompanhamentoAba';

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Destino "Leitura obrigatória" (US 12.4, change `superficies-de-pendencia`;
 * demanda nº 2, seção 3.5): abas **Pendentes** e **Concluídas**, para
 * qualquer papel (design.md D5). A aba Acompanhamento é da C4.
 *
 * A situação vem apurada pelo servidor e a ordem também (atrasadas,
 * pendentes, concluídas); a tela só reparte. A encerrada não aparece em
 * nenhuma aba (design.md D2).
 */
export function LeiturasPage() {
  const leituras = useMyReadings();
  const acompanhamento = useOversight();
  const [emLeitura, setEmLeitura] = useState<FileSummaryResponse | null>(null);
  // Aba e marcação no endereço (change `acompanhamento-de-leituras`, design.md
  // D7): o aviso ao gestor abre direto o relatório.
  const [params, setParams] = useSearchParams();
  const podeAcompanhar = acompanhamento.data?.available === true;
  const pedida = params.get('aba');
  const aba =
    pedida === 'concluidas' || (pedida === 'acompanhamento' && podeAcompanhar)
      ? pedida
      : 'pendentes';
  const marcacao = params.get('marcacao');

  function irPara(chave: string, marcacaoAberta: string | null = null) {
    const proximo = new URLSearchParams();
    if (chave !== 'pendentes') proximo.set('aba', chave);
    if (marcacaoAberta) proximo.set('marcacao', marcacaoAberta);
    setParams(proximo);
  }

  if (leituras.isLoading) return <Spin style={{ display: 'block', margin: '48px auto' }} />;
  if (leituras.isError) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar suas leituras obrigatórias"
        subTitle="Tente novamente em instantes."
      />
    );
  }

  const itens = leituras.data?.items ?? [];
  const pendentes = itens.filter(estaAberta);
  const concluidas = itens.filter((i) => i.status === ReadingStatus.DONE);

  const colunasPendentes: ColumnsType<MinhaLeitura> = [
    { title: 'Documento', key: 'documento', render: (_, l) => documentoDaLeitura(l) },
    { title: 'Prazo', key: 'prazo', width: 120, render: (_, l) => prazoDaLeitura(l) },
    {
      title: 'Situação',
      key: 'situacao',
      width: 120,
      render: (_, l) => <RotuloDaLeitura leitura={l} />,
    },
    {
      title: 'Mensagem',
      key: 'mensagem',
      render: (_, l) => l.message ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Ação',
      key: 'acao',
      render: (_, l) => <BotaoLerEConfirmar leitura={l} onAbrir={setEmLeitura} size="small" />,
    },
  ];

  const colunasConcluidas: ColumnsType<MinhaLeitura> = [
    { title: 'Documento', key: 'documento', render: (_, l) => documentoDaLeitura(l) },
    {
      title: 'Ciência confirmada em',
      key: 'confirmada',
      render: (_, l) => (l.acknowledgedAt ? formatarDataHora(l.acknowledgedAt) : '—'),
    },
  ];

  return (
    <div>
      <Typography.Title level={3}>Leitura obrigatória</Typography.Title>
      <Typography.Paragraph type="secondary">
        Documentos que você precisa ler e confirmar, com o prazo de cada um, e as ciências que você
        já confirmou.
        {podeAcompanhar && ' Em Acompanhamento, quem leu cada documento que você acompanha.'}
      </Typography.Paragraph>
      <Tabs
        activeKey={aba}
        onChange={(chave) => irPara(chave)}
        items={[
          {
            key: 'pendentes',
            label: `Pendentes (${pendentes.length})`,
            children:
              pendentes.length === 0 ? (
                <Empty description="Nenhuma leitura obrigatória pendente." />
              ) : (
                <Table
                  rowKey="assignmentId"
                  dataSource={pendentes}
                  columns={colunasPendentes}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                />
              ),
          },
          {
            key: 'concluidas',
            label: `Concluídas (${concluidas.length})`,
            children:
              concluidas.length === 0 ? (
                <Empty description="Você ainda não confirmou nenhuma leitura." />
              ) : (
                <Table
                  rowKey="assignmentId"
                  dataSource={concluidas}
                  columns={colunasConcluidas}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                />
              ),
          },
          // Só para quem tem algo a acompanhar (design.md D4): publicador,
          // gestor ou todas as unidades — o servidor decide.
          ...(podeAcompanhar
            ? [
                {
                  key: 'acompanhamento',
                  label: 'Acompanhamento',
                  children: (
                    <AcompanhamentoAba
                      marcacao={marcacao}
                      onAbrir={(id) => irPara('acompanhamento', id)}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      <PreviewModal file={emLeitura} onClose={() => setEmLeitura(null)} />
    </div>
  );
}
