import type { GrantResourceType, Permission } from './permissions.js';

/**
 * Compartilhamento entre unidades (PRD US 5.2, change
 * `compartilhamento-entre-unidades`): somente leitura, sempre com a SEDE numa
 * das pontas. Tabela própria (`cross_unit_grants`), separada de `grants`
 * (design.md D1).
 */

/** Verbos admitidos entre unidades — só leitura (decisão 5 da proposal). */
export const CROSS_UNIT_PERMISSIONS = ['view', 'download'] as const satisfies readonly Permission[];
export type CrossUnitPermission = (typeof CROSS_UNIT_PERMISSIONS)[number];

export interface CreateCrossUnitGrantRequest {
  resourceType: GrantResourceType;
  resourceId: string;
  permissions: CrossUnitPermission[];
  /** Unidade de destino. */
  subjectUnitId: string;
  /** Pessoas da unidade de destino; ausente ou vazio = a unidade inteira. */
  subjectUserIds?: string[];
  /** Ausente/nulo = permanente. */
  expiresAt?: string | null;
}

export interface CrossUnitGrantResponse {
  id: string;
  /** Unidade de origem (a do recurso). */
  unitId: string;
  resourceType: GrantResourceType;
  resourceId: string;
  subjectUnitId: string;
  subjectUnitName: string | null;
  /** `null` = unidade inteira. */
  subjectUserId: string | null;
  subjectUserName: string | null;
  permission: CrossUnitPermission;
  grantedBy: string;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
}

export interface CrossUnitGrantListResponse {
  grants: CrossUnitGrantResponse[];
}

/** Unidade para a qual a unidade atual pode compartilhar (design.md D8). */
export interface CrossUnitDestinationResponse {
  id: string;
  name: string;
  isHeadquarters: boolean;
}

export interface CrossUnitDestinationListResponse {
  /** `false` quando não há SEDE marcada — a SPA explica em vez de listar vazio. */
  headquartersDefined: boolean;
  destinations: CrossUnitDestinationResponse[];
}

/** Pessoa ativa da unidade de destino — exposição mínima (design.md D8). */
export interface CrossUnitRecipientResponse {
  id: string;
  fullName: string | null;
  jobTitle: string | null;
  sectorName: string | null;
}

export interface CrossUnitRecipientListResponse {
  recipients: CrossUnitRecipientResponse[];
}

/** `422` de `POST /grants`: alguma pessoa é de outra unidade (design.md D10). */
export interface CrossUnitSubjectResponse {
  error: 'cross_unit_subject';
}

/** `422` de `POST /grants/cross-unit`: par origem/destino sem a SEDE, ou destino inválido (design.md D7). */
export interface CrossUnitDestinationNotAllowedResponse {
  error: 'cross_unit_destination_not_allowed';
}
