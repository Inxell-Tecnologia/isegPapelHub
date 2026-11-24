import { useQuery } from '@tanstack/react-query';
import type { NewDocumentsCountResponse, RecentDocumentsResponse } from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import { newDocumentsCountResponseSchema, recentDocumentsResponseSchema } from '../lib/schemas';

export const RECENT_DOCUMENTS_KEY = 'recent-documents';
export const NEW_DOCUMENTS_COUNT_KEY = 'new-documents-count';

/**
 * `GET /files/recent` (US 11.2) — recorte curto, sem parâmetros: o teto e a
 * janela são decisão do servidor (`config.recentDocuments`), não da tela. A
 * SPA nunca filtra o que recebe: o que chega aqui é exatamente o que a
 * resolução de acesso do servidor autorizou.
 */
export function useRecentDocuments() {
  return useQuery({
    queryKey: [RECENT_DOCUMENTS_KEY],
    queryFn: async () => {
      const raw = await apiClient.get<RecentDocumentsResponse>('/files/recent');
      return recentDocumentsResponseSchema.parse(raw);
    },
  });
}

/**
 * `GET /files/recent/new-count` (change `conteudo-da-tela-inicio`, design.md
 * D2): consulta **própria**, para a contagem não segurar a lista de recentes
 * nem o contrário — as áreas da tela Início continuam independentes.
 */
export function useNewDocumentsCount() {
  return useQuery({
    queryKey: [NEW_DOCUMENTS_COUNT_KEY],
    queryFn: async () => {
      const raw = await apiClient.get<NewDocumentsCountResponse>('/files/recent/new-count');
      return newDocumentsCountResponseSchema.parse(raw);
    },
  });
}

/**
 * Texto da contagem na linha abaixo da saudação. `capped` vira "pelo menos N"
 * — o teto de apuração nunca é apresentado como contagem exata (design.md D3).
 */
export function textoDeNovos({ days, count, capped }: NewDocumentsCountResponse): string {
  const janela = `nos últimos ${days} dias`;
  if (capped) return `pelo menos ${count} documentos novos ${janela}`;
  if (count === 0) return `nenhum documento novo ${janela}`;
  if (count === 1) return `1 documento novo ${janela}`;
  return `${count} documentos novos ${janela}`;
}
