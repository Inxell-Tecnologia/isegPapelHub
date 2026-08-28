import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFolderRequest,
  FileSummaryResponse,
  FolderContentsResponse,
  FolderDownloadManifestResponse,
  FolderResponse,
  MoveItemRequest,
  RenameFileRequest,
  RenameFolderRequest,
} from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import {
  fileSummaryResponseSchema,
  folderContentsResponseSchema,
  folderDownloadManifestResponseSchema,
  folderResponseSchema,
} from '../lib/schemas';

export const FOLDER_CONTENTS_KEY = 'folder-contents';

/** `folderId: null` = raiz da unidade — chave `['folder-contents', 'root']` (design.md D5). */
export function folderContentsQueryKey(folderId: string | null) {
  return [FOLDER_CONTENTS_KEY, folderId ?? 'root'] as const;
}

/**
 * `GET /folders/root/contents` ou `GET /folders/:id/contents` (design.md D5).
 * `enabled` (design.md D7 de `mover-e-renomear-itens`): o seletor de destino
 * do `MoverItemModal` reusa este hook mas está sempre montado (para que o
 * `Modal` do AntD anime a abertura) — sem desligar a busca enquanto fechado,
 * cada abertura da página dispararia uma chamada a `/folders/root/contents`
 * mesmo com o modal invisível.
 */
export function useFolderContents(folderId: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: folderContentsQueryKey(folderId),
    queryFn: async () => {
      const path = folderId === null ? '/folders/root/contents' : `/folders/${folderId}/contents`;
      const raw = await apiClient.get<FolderContentsResponse>(path);
      return folderContentsResponseSchema.parse(raw);
    },
    enabled: options.enabled ?? true,
  });
}

/**
 * Toda mutation de gestão invalida as listagens em cache (design.md D5): sem
 * otimismo local, a tela sempre reflete o que o servidor confirmou — inclui o
 * caso de excluir a pasta corrente, cuja listagem-pai pode já estar em cache.
 */
function useInvalidateFolderContents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [FOLDER_CONTENTS_KEY] });
}

export function useCreateFolder() {
  const invalidate = useInvalidateFolderContents();
  return useMutation({
    mutationFn: async (body: CreateFolderRequest) => {
      const raw = await apiClient.post<FolderResponse>('/folders', body);
      return folderResponseSchema.parse(raw);
    },
    onSuccess: invalidate,
  });
}

export function useRenameFile() {
  const invalidate = useInvalidateFolderContents();
  return useMutation({
    mutationFn: async ({ fileId, ...body }: RenameFileRequest & { fileId: string }) => {
      const raw = await apiClient.patch<FileSummaryResponse>(`/files/${fileId}`, body);
      return fileSummaryResponseSchema.parse(raw);
    },
    onSuccess: invalidate,
  });
}

export function useRenameFolder() {
  const invalidate = useInvalidateFolderContents();
  return useMutation({
    mutationFn: async ({ folderId, ...body }: RenameFolderRequest & { folderId: string }) => {
      const raw = await apiClient.patch<FolderResponse>(`/folders/${folderId}`, body);
      return folderResponseSchema.parse(raw);
    },
    onSuccess: invalidate,
  });
}

/** `POST /files/:id/move` (US 2.3, design.md D1). */
export function useMoveFile() {
  const invalidate = useInvalidateFolderContents();
  return useMutation({
    mutationFn: async ({
      fileId,
      destinationFolderId,
    }: {
      fileId: string;
    } & MoveItemRequest) => {
      const body: MoveItemRequest = { destinationFolderId };
      const raw = await apiClient.post<FileSummaryResponse>(`/files/${fileId}/move`, body);
      return fileSummaryResponseSchema.parse(raw);
    },
    onSuccess: invalidate,
  });
}

/** `POST /folders/:id/move` (US 2.3, design.md D1). */
export function useMoveFolder() {
  const invalidate = useInvalidateFolderContents();
  return useMutation({
    mutationFn: async ({
      folderId,
      destinationFolderId,
    }: {
      folderId: string;
    } & MoveItemRequest) => {
      const body: MoveItemRequest = { destinationFolderId };
      const raw = await apiClient.post<FolderResponse>(`/folders/${folderId}/move`, body);
      return folderResponseSchema.parse(raw);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteFile() {
  const invalidate = useInvalidateFolderContents();
  return useMutation({
    mutationFn: (fileId: string) => apiClient.delete<void>(`/files/${fileId}`),
    onSuccess: invalidate,
  });
}

export function useDeleteFolder() {
  const invalidate = useInvalidateFolderContents();
  return useMutation({
    mutationFn: (folderId: string) => apiClient.delete<void>(`/folders/${folderId}`),
    onSuccess: invalidate,
  });
}

/**
 * `POST /folders/:id/download-manifest` ou `/folders/root/download-manifest`
 * (design.md D1/D9, `download-pasta-zip`): cada chamada é um novo pedido de
 * acesso (URLs assinadas + auditoria por arquivo), por isso `useMutation`,
 * não `useQuery` — mesma razão de `useDownloadUrl`.
 */
export function useDownloadFolderManifest() {
  return useMutation({
    mutationFn: async ({ folderId, signal }: { folderId: string | null; signal?: AbortSignal }) => {
      const path =
        folderId === null
          ? '/folders/root/download-manifest'
          : `/folders/${folderId}/download-manifest`;
      const raw = await apiClient.post<FolderDownloadManifestResponse>(path, undefined, signal);
      return folderDownloadManifestResponseSchema.parse(raw);
    },
  });
}
