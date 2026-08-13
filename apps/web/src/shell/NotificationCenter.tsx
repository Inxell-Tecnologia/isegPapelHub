import { Badge, Button, Dropdown, Empty, List, Tag, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import type { NotificationResponse } from '@gdoc/shared';
import { GrantResourceType, NotificationKind } from '@gdoc/shared';
import { VERB_LABEL } from '../permissoes/PermissoesModal';
import { formatDate } from '../navegacao/format';
import {
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../notificacoes/queries';

const RESOURCE_LABEL: Record<GrantResourceType, string> = {
  [GrantResourceType.FOLDER]: 'pasta',
  [GrantResourceType.FILE]: 'arquivo',
};

/**
 * `subjectUserId` (aviso de corte) não é resolvido a nome aqui: a central
 * aparece em toda página do shell, e resolver nomes exigiria mais uma
 * chamada sempre ativa a `GET /users` — o mesmo endpoint que páginas de
 * administração já consultam para outros fins. O uuid identifica a pessoa
 * de forma inequívoca; a listagem de pessoas (`admin/pessoas`) é onde o
 * administrador confere quem é quem.
 */
function messageFor(notification: NotificationResponse): string {
  const { payload } = notification;
  const resource = RESOURCE_LABEL[payload.resourceType];
  const verbs = payload.permissions.map((permission) => VERB_LABEL[permission]).join(', ');
  const date = formatDate(payload.expiresAt);

  switch (notification.kind) {
    case NotificationKind.GRANT_CREATED:
      return `Você recebeu acesso (${verbs}) a este ${resource}, válido até ${date}.`;
    case NotificationKind.GRANT_EXPIRING:
      return `Seu acesso (${verbs}) a este ${resource} vence em ${date}.`;
    case NotificationKind.GRANT_EXPIRED:
      return `O acesso (${verbs}) de ${payload.subjectUserId ?? '—'} a este ${resource} foi encerrado em ${date}.`;
    default:
      return 'Notificação';
  }
}

/**
 * Central de notificações do shell (tasks.md 8.3, capability `notificacoes`):
 * contagem de não lidas visível a qualquer momento e marcação de lida ao
 * abrir.
 */
export function NotificationCenter() {
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data, refetch } = useNotifications(false);
  const markAsRead = useMarkNotificationAsRead();

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
                  !notification.readAt && (
                    <Tag color="blue" style={{ marginRight: 4 }}>
                      Nova
                    </Tag>
                  )
                }
                description={
                  <>
                    <Typography.Text>{messageFor(notification)}</Typography.Text>
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
      onOpenChange={(open) => {
        if (open) refetch();
      }}
    >
      <Badge count={unreadCount ?? 0} size="small">
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
      </Badge>
    </Dropdown>
  );
}
