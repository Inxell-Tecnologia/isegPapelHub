import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FavoritesResponse, GrantResourceType } from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import { favoritesResponseSchema } from '../lib/schemas';
import { FOLDER_CONTENTS_KEY } from '../navegacao/queries';

export const FAVORITES_KEY = 'favorites';

/**
 * `GET /favorites` (US 2.5, change `favoritos`) — auto-escopada no servidor
 * pela sessão: não há como pedir a lista de outra pessoa. O que chega já foi
 * confirmado item a item pela resolução de acesso (design.md D3).
 */
export function useFavorites() {
  return useQuery({
    queryKey: [FAVORITES_KEY],
    queryFn: async () => {
      const raw = await apiClient.get<FavoritesResponse>('/favorites');
      return favoritesResponseSchema.parse(raw);
    },
  });
}

/**
 * Marcar ou desmarcar (design.md D2). Invalida a lista e a listagem de pasta,
 * de onde vem a indicação de favorito do explorador (D5) — a marca aparece nos
 * dois lugares sem recarregar a tela.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      resourceType: GrantResourceType;
      resourceId: string;
      favorite: boolean;
    }) => {
      const path = `/favorites/${vars.resourceType}/${vars.resourceId}`;
      if (vars.favorite) await apiClient.put(path);
      else await apiClient.delete(path);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [FAVORITES_KEY] }),
        queryClient.invalidateQueries({ queryKey: [FOLDER_CONTENTS_KEY] }),
      ]);
    },
  });
}
