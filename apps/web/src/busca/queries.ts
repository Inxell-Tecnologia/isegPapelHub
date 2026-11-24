import { useQuery } from '@tanstack/react-query';
import type { PersonResponse, SearchFilesQuery, SearchFilesResponse } from '@gdoc/shared';
import { UserRole } from '@gdoc/shared';
import { apiClient } from '../lib/api-client';
import { authorPersonListSchema, searchFilesResponseSchema } from '../lib/schemas';

const SEARCH_FILES_KEY = 'search-files';

/** Monta a query string de `GET /files/search` só com os critérios ativos (design.md D3). */
function toQueryString(params: SearchFilesQuery): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.type) search.set('type', params.type);
  if (params.author) search.set('author', params.author);
  if (params.dateFrom) search.set('dateFrom', params.dateFrom);
  if (params.dateTo) search.set('dateTo', params.dateTo);
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * `GET /files/search` (design.md D1/D3): só consulta quando há um critério
 * **submetido** (`params !== undefined`) — o "estado inicial permitido" passou
 * a ser "nada consultado ainda", não mais uma busca sem parâmetros.
 */
export function useSearchFiles(params: SearchFilesQuery | undefined) {
  return useQuery({
    queryKey: [SEARCH_FILES_KEY, params],
    enabled: params !== undefined,
    queryFn: async () => {
      const raw = await apiClient.get<SearchFilesResponse>(
        `/files/search${toQueryString(params!)}`,
      );
      return searchFilesResponseSchema.parse(raw);
    },
  });
}

/**
 * Popula o filtro de autor (design.md D2/D6): só chama `GET /users` para
 * `unit_admin`/`global_admin` — para colaborador, `enabled: false` evita a
 * chamada por completo (403 nem é tentado).
 */
export function useAuthorOptions(role: UserRole | undefined) {
  const enabled = role === UserRole.UNIT_ADMIN || role === UserRole.GLOBAL_ADMIN;
  return useQuery({
    queryKey: ['author-options'],
    enabled,
    queryFn: async () => {
      const raw = await apiClient.get<PersonResponse[]>('/users');
      const people = authorPersonListSchema.parse(raw);
      return people.map((person) => ({
        value: person.id,
        label: person.fullName ?? person.id,
        unitId: person.unitId,
      }));
    },
  });
}
