import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCrossUnitGrantRequest,
  CreateGrantRequest,
  CrossUnitDestinationListResponse,
  CrossUnitGrantListResponse,
  CrossUnitRecipientListResponse,
  GrantListResponse,
  GrantResourceType,
} from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import {
  crossUnitDestinationListResponseSchema,
  crossUnitGrantListResponseSchema,
  crossUnitRecipientListResponseSchema,
  grantListResponseSchema,
} from '../lib/schemas';

const GRANTS_KEY = 'grants';

/** `GET /grants` é sempre por recurso — a chave inclui tipo + id (design.md D1). */
function grantsQueryKey(resourceType: GrantResourceType, resourceId: string) {
  return [GRANTS_KEY, resourceType, resourceId] as const;
}

/**
 * `GET /grants?resourceType=&resourceId=` (design.md D4): concessões vigentes
 * de um recurso. `enabled` evita a chamada antes do diálogo abrir — o hook
 * roda incondicionalmente no componente, mesmo com o `Modal` fechado.
 */
export function useGrants(resourceType: GrantResourceType, resourceId: string, enabled = true) {
  return useQuery({
    queryKey: grantsQueryKey(resourceType, resourceId),
    enabled,
    queryFn: async () => {
      const raw = await apiClient.get<GrantListResponse>(
        `/grants?resourceType=${resourceType}&resourceId=${resourceId}`,
      );
      return grantListResponseSchema.parse(raw);
    },
  });
}

/** `POST /grants` (design.md D3): um ou mais verbos numa só chamada, idempotente no servidor. */
export function useCreateGrant(resourceType: GrantResourceType, resourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGrantRequest) => apiClient.post<GrantListResponse>('/grants', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: grantsQueryKey(resourceType, resourceId) }),
  });
}

/** `DELETE /grants/:id` (design.md D4): remove só o verbo daquela linha. */
export function useRevokeGrant(resourceType: GrantResourceType, resourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => apiClient.delete<void>(`/grants/${grantId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: grantsQueryKey(resourceType, resourceId) }),
  });
}

// ---------------------------------------------------------------------------
// Compartilhamento entre unidades (PRD US 5.2, change
// `compartilhamento-entre-unidades`, design.md D7/D8).

const CROSS_UNIT_KEY = 'cross-unit-grants';

function crossUnitQueryKey(resourceType: GrantResourceType, resourceId: string) {
  return [CROSS_UNIT_KEY, resourceType, resourceId] as const;
}

/** `GET /grants/cross-unit` — compartilhamentos do recurso (só a origem os vê). */
export function useCrossUnitGrants(
  resourceType: GrantResourceType,
  resourceId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: crossUnitQueryKey(resourceType, resourceId),
    enabled,
    queryFn: async () => {
      const raw = await apiClient.get<CrossUnitGrantListResponse>(
        `/grants/cross-unit?resourceType=${resourceType}&resourceId=${resourceId}`,
      );
      return crossUnitGrantListResponseSchema.parse(raw);
    },
  });
}

/** `GET /grants/cross-unit/destinations` — unidades permitidas como destino. */
export function useCrossUnitDestinations(enabled = true) {
  return useQuery({
    queryKey: [CROSS_UNIT_KEY, 'destinations'],
    enabled,
    queryFn: async () => {
      const raw = await apiClient.get<CrossUnitDestinationListResponse>(
        '/grants/cross-unit/destinations',
      );
      return crossUnitDestinationListResponseSchema.parse(raw);
    },
  });
}

/** `GET /grants/cross-unit/recipients?unitId=` — pessoas ativas do destino escolhido. */
export function useCrossUnitRecipients(unitId: string | undefined) {
  return useQuery({
    queryKey: [CROSS_UNIT_KEY, 'recipients', unitId],
    enabled: Boolean(unitId),
    queryFn: async () => {
      const raw = await apiClient.get<CrossUnitRecipientListResponse>(
        `/grants/cross-unit/recipients?unitId=${unitId}`,
      );
      return crossUnitRecipientListResponseSchema.parse(raw);
    },
  });
}

export function useCreateCrossUnitGrant(resourceType: GrantResourceType, resourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCrossUnitGrantRequest) =>
      apiClient.post<CrossUnitGrantListResponse>('/grants/cross-unit', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: crossUnitQueryKey(resourceType, resourceId) }),
  });
}

export function useRevokeCrossUnitGrant(resourceType: GrantResourceType, resourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => apiClient.delete<void>(`/grants/cross-unit/${grantId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: crossUnitQueryKey(resourceType, resourceId) }),
  });
}
