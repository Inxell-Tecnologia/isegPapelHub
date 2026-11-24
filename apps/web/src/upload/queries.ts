import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchUploadUrlRequest,
  BatchUploadUrlResponse,
  StorageQuotaResponse,
  UploadUrlRequest,
  UploadUrlResponse,
} from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import {
  batchUploadUrlResponseSchema,
  storageQuotaResponseSchema,
  uploadUrlResponseSchema,
} from '../lib/schemas';
import { FOLDER_CONTENTS_KEY } from '../navegacao/queries';

/**
 * `POST /files/upload-url` — publicação de **um** documento (Épico 10,
 * US 10.5): é a rota que exige os dados de controle, e por isso a que a SPA
 * usa quando a operação carrega exatamente um arquivo (design.md D7 de
 * `controle-documental`).
 *
 * O lote continua em `useRequestUploadUrls`, abaixo, inclusive para pedir a
 * URL de um item que falhou — repetir um item não é publicar um documento
 * novo, e exigir os quatro campos nessa repetição quebraria o relato de falha
 * independente do envio em lote.
 */
export function useRequestUploadUrl() {
  return useMutation({
    mutationFn: async (body: UploadUrlRequest) => {
      const raw = await apiClient.post<UploadUrlResponse>('/files/upload-url', body);
      return uploadUrlResponseSchema.parse(raw);
    },
  });
}

/**
 * `POST /files/upload-urls` — uma única chamada por lote, cota reservada
 * atomicamente no servidor (design.md D1/D3). É a rota do **lote e da
 * pasta**, que dispensa os dados de controle; o envio de um documento só usa
 * `useRequestUploadUrl` (acima).
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
