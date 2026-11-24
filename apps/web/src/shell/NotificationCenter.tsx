import { Badge, Button, Dropdown, Empty, List, Typography } from 'antd';
import { IconeNotificacoes } from '../app/icons';
import { RotuloDeEstado } from '../app/RotuloDeEstado';
import { paleta } from '../app/theme';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../navegacao/format';
import {
  destinoDaNotificacao,
  mensagemDaNotificacao,
  rotuloDoDestino,
} from '../notificacoes/mensagens';
import {
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../notificacoes/queries';

/**
 * Nome acessível do sino com a quantidade de não lidas (change
 * `marca-dagua-e-inicio-rodada-3`, design.md D7): quem não vê o indicador
 * ouve o número no próprio controle.
 */
export function nomeAcessivelDoSino(naoLidas: number): string {
  if (naoLidas <= 0) return 'Notificações';
  return `Notificações, ${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}`;
}

/**
 * Central de notificações do shell (tasks.md 8.3, capability `notificacoes`):
 * contagem de não lidas visível a qualquer momento e marcação de lida ao
 * abrir.
 */
export function NotificationCenter() {
  const { data: unreadCount } = useUnreadNotificationCount();
  const naoLidas = unreadCount ?? 0;
  const { data, refetch } = useNotifications(false);
  const markAsRead = useMarkNotificationAsRead();
  const [aberto, setAberto] = useState(false);

  const notifications = data?.notifications ?? [];

  async function handleMarkAsRead(id: string) {
    await markAsRead.mutateAsync(id);
  }

  const dropdownRender = () => (
    <div
      style={{
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 420,
        overflowY: 'auto',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {notifications.length === 0 ? (
        <Empty description="Nenhuma notificação" style={{ padding: 24 }} />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              style={{
                padding: '12px 16px',
                background: notification.readAt ? undefined : '#e6f4ff',
              }}
              actions={
                notification.readAt
                  ? undefined
                  : [
                      <Button
                        key="read"
                        size="small"
                        type="link"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        Marcar como lida
                      </Button>,
                    ]
              }
            >
              <List.Item.Meta
                title={
                  !notification.readAt && <RotuloDeEstado tom="informativo">Nova</RotuloDeEstado>
                }
                description={
                  <>
                    <Typography.Text>{mensagemDaNotificacao(notification)}</Typography.Text>
                    {destinoDaNotificacao(notification) && (
                      <div>
                        {/* Aviso do leitor leva às próprias leituras (change
                            `avisos-e-atrasos`, design.md D5); navegar fecha o
                            sino, como acionar um destino. */}
                        <Link
                          to={destinoDaNotificacao(notification)!}
                          onClick={() => setAberto(false)}
                        >
                          {rotuloDoDestino(notification)}
                        </Link>
                      </div>
                    )}
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDate(notification.createdAt)}
                      </Typography.Text>
                    </div>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      trigger={['click']}
      popupRender={dropdownRender}
      open={aberto}
      onOpenChange={(open) => {
        setAberto(open);
        if (open) refetch();
      }}
    >
      {/* Indicador **vermelho** sobre o sino (`docs/demanda_cliente_3.md`, item
          10; design.md D7), no token com o número branco a 5,57:1 — o padrão
          do design system mede 3,27:1. O indicador é desenho: fica fora da
          árvore acessível, e a quantidade vai no nome do botão, para não ser
          anunciada duas vezes. */}
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        {/* O ícone é `aria-hidden` (módulo único de ícones), então o nome
            acessível tem de vir do próprio controle — sem ele este botão não
            tem nome algum para tecnologia assistiva. */}
        <Button
          type="text"
          aria-label={nomeAcessivelDoSino(naoLidas)}
          icon={<IconeNotificacoes style={{ fontSize: 18 }} />}
        />
        {naoLidas > 0 && (
          <span
            aria-hidden
            data-indicador-do-sino=""
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              transform: 'translate(50%, -50%)',
              pointerEvents: 'none',
              lineHeight: 0,
            }}
          >
            <Badge count={naoLidas} size="small" color={paleta.vermelhoIndicador} />
          </span>
        )}
      </span>
    </Dropdown>
  );
}
