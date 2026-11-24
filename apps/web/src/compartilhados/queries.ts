import { useQuery } from '@tanstack/react-query';
import type { SharedWithMeResponse } from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import { sharedWithMeResponseSchema } from '../lib/schemas';

const SHARED_WITH_ME_KEY = 'shared-with-me';

/**
 * `GET /grants/received` — o que foi compartilhado comigo (US 4.4).
 *
 * Sem parâmetro algum, de propósito: a rota é auto-escopada no servidor pelo
 * `subject_user_id` da sessão, e não há como pedir a lista de outra pessoa.
 */
export function useSharedWithMe() {
  return useQuery({
    queryKey: [SHARED_WITH_ME_KEY],
    queryFn: async () => {
      const raw = await apiClient.get<SharedWithMeResponse>('/grants/received');
      return sharedWithMeResponseSchema.parse(raw);
    },
  });
}
