import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FileRestoreResponse, FolderRestoreResponse, TrashPurgeResponse } from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import {
  fileRestoreResponseSchema,
  trashListResponseSchema,
  trashPurgeResponseSchema,
} from '../lib/schemas';
import { FOLDER_CONTENTS_KEY } from '../navegacao/queries';
import { QUOTA_KEY } from '../upload/queries';

export const TRASH_KEY = 'trash';

/** `GET /trash` — raízes de exclusão no alcance do requisitante (design.md D7). */
export function useTrash() {
  return useQuery({
    queryKey: [TRASH_KEY],
    queryFn: async () => {
      const raw = await apiClient.get<unknown>('/trash');
      return trashListResponseSchema.parse(raw);
    },
  });
}

/**
 * Restaurar invalida a lixeira **e** as listagens do explorador (design.md
 * D5) — sem otimismo local, ambas as telas refletem o que o servidor
 * confirmou.
 */
function useInvalidateAfterRestore() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [TRASH_KEY] });
    queryClient.invalidateQueries({ queryKey: [FOLDER_CONTENTS_KEY] });
  };
}

/** `POST /files/:id/restore` (design.md D2) — resposta traz `redirectedToRoot`. */
export function useRestoreFile() {
  const invalidate = useInvalidateAfterRestore();
  return useMutation({
    mutationFn: async (fileId: string) => {
      const raw = await apiClient.post<unknown>(`/files/${fileId}/restore`);
      return fileRestoreResponseSchema.parse(raw) as FileRestoreResponse;
    },
    onSuccess: invalidate,
  });
}

/** `POST /folders/:id/restore` (design.md D2) — pasta nunca muda de local ao restaurar. */
export function useRestoreFolder() {
  const invalidate = useInvalidateAfterRestore();
  return useMutation({
    mutationFn: (folderId: string) =>
      apiClient.post<FolderRestoreResponse>(`/folders/${folderId}/restore`),
    onSuccess: invalidate,
  });
}

/**
 * `POST /trash/purge` (change `esvaziar-lixeira`) — expurgo imediato dos
 * arquivos próprios na lixeira. Invalida a listagem da lixeira **e** a
 * consulta de cota (design.md D4): o espaço recuperado é a razão de a pessoa
 * estar ali, e precisa aparecer sem recarregar a página. As listagens do
 * explorador não entram — nada volta a ficar vivo num expurgo.
 */
export function usePurgeTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<TrashPurgeResponse> => {
      const raw = await apiClient.post<unknown>('/trash/purge');
      return trashPurgeResponseSchema.parse(raw);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRASH_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUOTA_KEY] });
    },
  });
}
