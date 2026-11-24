import { Card, List, Spin, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { formatDate } from '../navegacao/format';
import {
  destinoDaNotificacao,
  ehAvisoDeLeitura,
  mensagemDaNotificacao,
  rotuloDoDestino,
} from '../notificacoes/mensagens';
import { useNotifications } from '../notificacoes/queries';

/** Quantos avisos o cartão lista; o restante está no sino. */
export const AVISOS_NO_CARTAO = 3;

/**
 * Cartão "Avisos" da coluna direita do Início (US 12.5, change
 * `avisos-e-atrasos`, design.md D5): os avisos de **leitura obrigatória** da
 * pessoa — nova leitura, atraso, atraso da equipe —, os mais recentes primeiro
 * (a API já ordena). Os demais assuntos continuam só no sino, e o cartão diz
 * isso. Mesma consulta e mesmo texto do sino (`notificacoes/mensagens.ts`).
 */
export function CartaoDeAvisos() {
  const notificacoes = useNotifications();
  const avisos = (notificacoes.data?.notifications ?? []).filter(ehAvisoDeLeitura);

  return (
    <Card title="Avisos" size="small">
      {notificacoes.isLoading && <Spin style={{ display: 'block', margin: '12px auto' }} />}
      {notificacoes.isError && (
        <Typography.Text type="secondary">Não foi possível carregar seus avisos.</Typography.Text>
      )}
      {notificacoes.data &&
        (avisos.length === 0 ? (
          <Typography.Text type="secondary">
            Nenhum aviso de leitura obrigatória. Os demais avisos continuam no sino, no topo da
            tela.
          </Typography.Text>
        ) : (
          <List
            dataSource={avisos.slice(0, AVISOS_NO_CARTAO)}
            rowKey="id"
            renderItem={(aviso) => {
              const destino = destinoDaNotificacao(aviso);
              return (
                <List.Item>
                  <div>
                    <Typography.Text>{mensagemDaNotificacao(aviso)}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDate(aviso.createdAt)}
                      </Typography.Text>
                      {destino && (
                        <>
                          {' · '}
                          <Link to={destino}>{rotuloDoDestino(aviso)}</Link>
                        </>
                      )}
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        ))}
    </Card>
  );
}
