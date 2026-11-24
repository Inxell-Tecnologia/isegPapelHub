/**
 * Ação registrada em `audit_events` — superset de `FileAccessAction`
 * (visualizar/baixar) mais os eventos de gestão de arquivo (US 2.2:
 * renomear, substituir; US 2.3: mover). Mover/renomear **pasta** não gera
 * evento (design.md D6 de `mover-e-renomear-itens`) — `MOVE` é gravado só
 * no mover de arquivo.
 */
export const AuditAction = {
  VIEW: 'view',
  DOWNLOAD: 'download',
  RENAME: 'rename',
  REPLACE: 'replace',
  DELETE: 'delete',
  RESTORE: 'restore',
  MOVE: 'move',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEvent {
  id: string;
  unitId: string;
  userId: string;
  fileId: string;
  action: AuditAction;
  createdAt: string;
}

/**
 * Identidade do ator num evento de auditoria consultável (Épico 7).
 * `name` reflete `users.full_name`, campo opcional (`people.ts`) — pode ser
 * `null` para uma pessoa que nunca preencheu o próprio nome.
 */
export interface AuditActorResponse {
  id: string;
  name: string | null;
  /**
   * `null` quando a pessoa é de **outra unidade** (acesso por compartilhamento
   * entre unidades, design.md D9 de `compartilhamento-entre-unidades`): o
   * e-mail dela não é exposto à unidade de origem.
   */
  email: string | null;
  /** Unidade da pessoa quando o acesso veio de outra unidade; ausente/nulo nos demais. */
  unitName?: string | null;
}

/**
 * Item retornado por `GET /files/:id/audit` — restrito aos eventos de
 * *acesso* (`view`/`download`); os demais tipos de `AuditAction` não são
 * expostos por essa consulta (proposal.md, escopo do Épico 7).
 */
export interface AuditQueryEventResponse {
  actor: AuditActorResponse;
  action: 'view' | 'download';
  createdAt: string;
}

export interface AuditQueryResponse {
  events: AuditQueryEventResponse[];
}
