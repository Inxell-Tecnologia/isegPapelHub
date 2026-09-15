import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchUploadUrlRequest,
  BatchUploadUrlResponse,
  StorageQuotaResponse,
} from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import { batchUploadUrlResponseSchema, storageQuotaResponseSchema } from '../lib/schemas';
import { FOLDER_CONTENTS_KEY } from '../navegacao/queries';

/**
 * `POST /files/upload-urls` — uma única chamada por lote, cota reservada
 * atomicamente no servidor (design.md D1/D3). Arquivo único também usa o
 * lote (lote de 1) — nunca o endpoint singular.
 */
export function useRequestUploadUrls() {
  return useMutation({
    mutationFn: async (body: BatchUploadUrlRequest) => {
      const raw = await apiClient.post<BatchUploadUrlResponse>('/files/upload-urls', body);
      return batchUploadUrlResponseSchema.parse(raw);
    },
  });
}

/** Reusa a chave `folder-contents` da Fatia 2: PUT concluído invalida a listagem (design.md D6). */
export function useInvalidateFolderContents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [FOLDER_CONTENTS_KEY] });
}

/**
 * `GET /files/quota` — espaço do **próprio** solicitante (change
 * `envio-multiplas-pastas-com-prechecagem`, design.md D2). Chamada sob
 * demanda, e não `useQuery` com cache: o valor só vale no instante da
 * decisão, e uma leitura de cache atrasada é exatamente a promessa falsa que
 * a pré-checagem existe para não fazer. Consultada **depois** da apuração da
 * seleção, para o retrato ser o mais recente possível (design.md D3).
 */
export async function fetchStorageQuota(): Promise<StorageQuotaResponse> {
  const raw = await apiClient.get<StorageQuotaResponse>('/files/quota');
  return storageQuotaResponseSchema.parse(raw);
}

export const QUOTA_KEY = 'files-quota';

/**
 * O mesmo `GET /files/quota` como consulta com chave, para as telas que
 * **exibem** o retrato em vez de decidir com ele (change `esvaziar-lixeira`:
 * a lixeira precisa saber quantos arquivos próprios e quantos bytes o
 * expurgo devolveria). `staleTime: 0` para que a invalidação após o expurgo
 * traga o número recalculado; a pré-checagem do envio segue usando
 * `fetchStorageQuota` sob demanda, sem cache algum.
 */
export function useStorageQuota() {
  return useQuery({
    queryKey: [QUOTA_KEY],
    queryFn: fetchStorageQuota,
    staleTime: 0,
  });
}
