import type { GrantResourceType, Permission } from './permissions.js';
import type { FileSummaryResponse } from './storage.js';

/**
 * Favoritos (US 2.5, change `favoritos`).
 *
 * Mesma forma de `SharedWithMeItemResponse` (design.md D8): a listagem plana
 * fixada pela A5 — localização = pasta que contém o item, arquivo abre na
 * visualização, pasta abre no explorador, ações só dos verbos devolvidos.
 */
export interface FavoriteItemResponse {
  resourceType: GrantResourceType;
  /** Id do recurso — da pasta ou do arquivo, conforme `resourceType`. */
  id: string;
  name: string;
  /** Nome da pasta que **contém** o item; `null` = raiz. Nunca a trilha. */
  folderName: string | null;
  /**
   * Verbos que a pessoa tem **agora** sobre o recurso, resolvidos pelo
   * servidor por `hasAccess` (design.md D3) — só `view` e, para arquivo,
   * `download`. Dono e administrador alcançam sem concessão, então a SPA não
   * teria de onde derivá-los.
   */
  permissions: Permission[];
  /** Instante da marcação, em ISO 8601 — ordem da lista, do mais recente. */
  favoritedAt: string;
  /** Resumo do arquivo quando `resourceType` é `file`; `null` para pasta. */
  file: FileSummaryResponse | null;
}

/** `GET /favorites`. */
export interface FavoritesResponse {
  items: FavoriteItemResponse[];
}

/** `PUT /favorites/:resourceType/:resourceId`. */
export interface FavoriteMarkResponse {
  resourceType: GrantResourceType;
  resourceId: string;
  favoritedAt: string;
}

/** `409` de `PUT /favorites/...` acima do teto por pessoa (design.md D4). */
export interface FavoritesLimitExceededResponse {
  error: 'favorites_limit_exceeded';
  allowed: number;
}
