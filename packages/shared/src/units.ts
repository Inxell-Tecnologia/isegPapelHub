/**
 * Status de unidade (change `gestao-de-unidades`, design.md D5) — espelha o
 * espírito de `PersonStatus`. Desativar é reversível e não-destrutivo,
 * guardado pela precondição "unidade vazia" (D2); não cascateia para as
 * pessoas.
 */
export const UnitStatus = {
  ACTIVE: 'active',
  DISABLED: 'desativado',
} as const;

export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

export interface UnitResponse {
  id: string;
  name: string;
  status: UnitStatus;
  createdAt: string;
  /**
   * Unidade marcada como SEDE (change `compartilhamento-entre-unidades`,
   * design.md D11) — no máximo uma. Opcional no contrato: uma API anterior
   * não o envia, e ausência equivale a `false`.
   */
  isHeadquarters?: boolean;
}

export interface CreateUnitRequest {
  name: string;
}

export interface UpdateUnitRequest {
  name?: string;
  status?: UnitStatus;
  /** Marca/desmarca a SEDE — só `global_admin` (design.md D11). */
  isHeadquarters?: boolean;
}

/** `409` ao marcar uma segunda SEDE (design.md D11). */
export interface HeadquartersAlreadySetResponse {
  error: 'headquarters_already_set';
}

/** `409` ao desativar a unidade marcada como SEDE (design.md D11). */
export interface HeadquartersCannotBeDisabledResponse {
  error: 'headquarters_cannot_be_disabled';
}
