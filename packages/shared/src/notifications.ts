import type { GrantResourceType, Permission } from './permissions.js';

/**
 * Tipo de evento notificado (change `expiracao-permissoes`, design.md D4/D6).
 * O canal nasceu genérico para a expiração de permissão; a change
 * `arquivo-geral-e-pendente-de-cadastro` é a primeira a usá-lo para outro
 * assunto.
 */
export const NotificationKind = {
  GRANT_CREATED: 'grant_created',
  GRANT_EXPIRING: 'grant_expiring',
  GRANT_EXPIRED: 'grant_expired',
  /**
   * Arquivo enviado sem os dados de controle exigidos ficou pendente de
   * cadastro (US 10.9). Destinado a **quem enviou**, com o arquivo como evento
   * de origem — a idempotência por `(destinatário, tipo, evento)` que o canal
   * já garante basta para que repetir a transferência não duplique o aviso.
   */
  REGISTRATION_PENDING: 'registration_pending',
  /**
   * Leitura obrigatória (change `avisos-e-atrasos`, design.md D1). Nova
   * leitura, à pessoa do público; evento de origem = a atribuição.
   */
  READING_ASSIGNED: 'reading_assigned',
  /** Leitura atrasada, ao leitor; evento de origem = atribuição + prazo. */
  READING_OVERDUE: 'reading_overdue',
  /**
   * Atraso da equipe, ao gestor (C0), **agregado** por marcação e prazo
   * (design.md D3); evento de origem = marcação + prazo.
   */
  READING_OVERDUE_TEAM: 'reading_overdue_team',
} as const;

export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

/**
 * Payload de notificação relativa a concessão. O evento de origem é
 * (resourceType, resourceId, expiresAt) — design.md D5 — por isso o payload
 * comporta a **lista de verbos** afetados em vez de um por notificação:
 * conceder vários verbos sobre o mesmo recurso e prazo produz uma única
 * notificação que os enumera. `subjectUserId` só é preenchido no aviso de
 * corte (`grant_expired`), destinado à administração da unidade, para
 * identificar a pessoa cujo acesso foi encerrado (design.md D6).
 */
export interface GrantNotificationPayload {
  resourceType: GrantResourceType;
  resourceId: string;
  permissions: Permission[];
  expiresAt: string;
  subjectUserId?: string;
}

/**
 * Payload do aviso de pendência de cadastro (US 10.9). Carrega o nome do
 * arquivo, e não só o identificador, para que o sino diga **qual** arquivo
 * completar sem uma segunda ida ao servidor — que, além de custar uma volta,
 * falharia justamente para quem já não alcança o arquivo.
 */
export interface RegistrationPendingNotificationPayload {
  fileId: string;
  fileName: string;
}

/**
 * Payload dos avisos de leitura do **leitor** (`reading_assigned`,
 * `reading_overdue`): o documento como foi marcado e o prazo da pessoa, para o
 * sino dizer qual leitura sem uma segunda ida ao servidor.
 */
export interface ReadingNotificationPayload {
  assignmentId: string;
  campaignId: string;
  documentCode: string;
  documentTitle: string;
  documentRevision: number;
  /** `YYYY-MM-DD` — o prazo é do dia. */
  dueDate: string;
}

/** Pessoa atrasada citada no aviso ao gestor: nome e setor, nada mais (design.md D3). */
export interface ReadingLatePerson {
  name: string;
  sectorName: string | null;
}

/**
 * Payload do aviso ao gestor (`reading_overdue_team`): quantas pessoas do seu
 * alcance estão atrasadas na marcação e prazo, e quem (até
 * `READING_TEAM_NOTICE_MAX_NAMES`; `lateCount` é sempre o total).
 */
export interface ReadingTeamOverdueNotificationPayload {
  campaignId: string;
  documentCode: string;
  documentTitle: string;
  documentRevision: number;
  dueDate: string;
  lateCount: number;
  people: ReadingLatePerson[];
}

/** Teto de nomes no aviso agregado ao gestor (design.md D3). */
export const READING_TEAM_NOTICE_MAX_NAMES = 20;

/**
 * Payload de uma notificação, discriminado pelo `kind` da notificação que o
 * carrega. Quem lê deve ramificar por `kind` antes de acessar campos — é o que
 * mantém o canal aberto a assuntos novos sem que cada leitor presuma concessão.
 */
export type NotificationPayload =
  | GrantNotificationPayload
  | RegistrationPendingNotificationPayload
  | ReadingNotificationPayload
  | ReadingTeamOverdueNotificationPayload;

export interface NotificationResponse {
  id: string;
  kind: NotificationKind;
  payload: NotificationPayload;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
}

export interface UnreadNotificationCountResponse {
  count: number;
}
