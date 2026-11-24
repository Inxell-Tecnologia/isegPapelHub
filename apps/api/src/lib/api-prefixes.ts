/**
 * Prefixos servidos pela API — usados para impedir que o fallback de
 * `index.html` da SPA (app.ts) sombreie rotas de API sem correspondência
 * (ex.: `GET /files/rota-inexistente` deve continuar 404 da API, nunca
 * `index.html`). Espelha `apps/web/vite.config.ts` (`API_PROXY_PREFIXES`) e
 * `infra/terraform/locals.tf` (`api_proxy_prefixes`), **mais `/internal`**
 * (rota de push do Pub/Sub, sem equivalente no proxy de dev nem no
 * url-map — a guarda cobre qualquer método por robustez). Mantenha as três
 * pontas em sincronia ao adicionar um novo prefixo de rota.
 */
export const API_PREFIXES = [
  '/auth',
  '/files',
  '/folders',
  '/users',
  '/units',
  '/sectors',
  '/grants',
  '/trash',
  '/audit',
  '/dashboard',
  '/search',
  '/notifications',
  '/favorites',
  '/reading',
  '/health',
  '/internal',
];

export function isApiPath(path: string): boolean {
  return API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
