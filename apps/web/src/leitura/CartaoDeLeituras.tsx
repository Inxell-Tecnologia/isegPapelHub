import { useState } from 'react';
import { Card, Empty, List, Space, Spin, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { FileSummaryResponse } from '@gdoc/shared';
import { PreviewModal } from '../visualizacao/PreviewModal';
import {
  BotaoLerEConfirmar,
  RotuloDaLeitura,
  documentoDaLeitura,
  prazoDaLeitura,
} from './apresentacao';
import { estaAberta, useMyReadings } from './queries';

/** Quantas pendências o cartão lista antes do "Ver todas" (design.md, Open Questions). */
export const LEITURAS_NO_CARTAO = 3;

/**
 * Cartão "Leitura obrigatória" da coluna direita do Início (US 12.4, change
 * `superficies-de-pendencia`; demanda nº 2, seções 3.2 etapa 2 e 3.5):
 * documento, prazo e "Ler e confirmar ciência". Ocupa o lugar do cartão
 * reservado da A3 — agora que a leitura existe, "nenhuma pendência" é
 * verdade, não vacuidade.
 *
 * Área independente da tela: carregando ou com falha, não bloqueia as outras.
 */
export function CartaoDeLeituras() {
  const leituras = useMyReadings();
  const [emLeitura, setEmLeitura] = useState<FileSummaryResponse | null>(null);
  const abertas = (leituras.data?.items ?? []).filter(estaAberta);

  return (
    <Card
      title="Leitura obrigatória"
      size="small"
      extra={<Link to="/leituras">Ver todas</Link>}
      styles={{ title: { whiteSpace: 'normal' } }}
    >
      {leituras.isLoading && <Spin style={{ display: 'block', margin: '12px auto' }} />}
      {leituras.isError && (
        <Typography.Text type="secondary">
          Não foi possível carregar suas leituras obrigatórias.
        </Typography.Text>
      )}
      {leituras.data &&
        (abertas.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Nenhuma leitura obrigatória pendente."
          />
        ) : (
          <>
            <List
              dataSource={abertas.slice(0, LEITURAS_NO_CARTAO)}
              rowKey="assignmentId"
              renderItem={(l) => (
                <List.Item>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Typography.Text strong>{documentoDaLeitura(l)}</Typography.Text>
                    <Space size={8} wrap>
                      <Typography.Text type="secondary">Prazo: {prazoDaLeitura(l)}</Typography.Text>
                      <RotuloDaLeitura leitura={l} />
                    </Space>
                    <BotaoLerEConfirmar leitura={l} onAbrir={setEmLeitura} size="small" />
                  </Space>
                </List.Item>
              )}
            />
            {abertas.length > LEITURAS_NO_CARTAO && (
              <Typography.Text type="secondary">
                E mais {abertas.length - LEITURAS_NO_CARTAO}.{' '}
                <Link to="/leituras">Ver todas as pendências</Link>
              </Typography.Text>
            )}
          </>
        ))}
      <PreviewModal file={emLeitura} onClose={() => setEmLeitura(null)} />
    </Card>
  );
}
