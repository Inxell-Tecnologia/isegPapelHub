import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSectorRequest, SectorResponse, UpdateSectorRequest } from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import { sectorListSchema } from '../lib/schemas';

const SECTORS_KEY = 'sectors';

/**
 * `GET /sectors` (change `funcao-e-setor-na-identidade`, capability `setores`).
 *
 * `unitId` só é enviado quando quem consulta é `global_admin` — para
 * `unit_admin` o servidor resolve a unidade pelo contexto, e pedir outra é
 * recusado com 403 em vez de silenciosamente forçado (design.md D8). Por isso
 * a chave de cache inclui a unidade: as listas de duas unidades não podem
 * compartilhar entrada.
 *
 * `enabled` existe para não disparar a consulta — e um 403 previsível — antes
 * de haver unidade escolhida, ou quando quem olha não é administração.
 */
export function useSectors(options: { unitId?: string; enabled?: boolean } = {}) {
  const { unitId, enabled = true } = options;
  return useQuery({
    queryKey: [SECTORS_KEY, { unitId: unitId ?? 'propria' }],
    enabled,
    queryFn: async () => {
      const path = unitId ? `/sectors?unitId=${encodeURIComponent(unitId)}` : '/sectors';
      const raw = await apiClient.get<SectorResponse[]>(path);
      return sectorListSchema.parse(raw);
    },
  });
}

/** `POST /sectors`: cadastra setor na unidade; 409 `sector_name_in_use` = nome já usado nela. */
export function useCreateSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSectorRequest) => apiClient.post<SectorResponse>('/sectors', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SECTORS_KEY] }),
  });
}

/**
 * `PATCH /sectors/:id`: renomeia. É a operação com que a administração aplica a
 * grafia oficial sobre o que a migração trouxe do texto livre (resposta 6a do
 * cliente) — e não desfaz vínculo algum.
 */
export function useRenameSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSectorRequest }) =>
      apiClient.patch<SectorResponse>(`/sectors/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SECTORS_KEY] }),
  });
}

/**
 * `DELETE /sectors/:id`: remove setor **sem pessoas**; 409 `sector_has_people`
 * quando ainda há alguém vinculado. A listagem de pessoas também é invalidada:
 * o vínculo exibido por lá nasce do mesmo dado.
 */
export function useDeleteSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/sectors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SECTORS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
