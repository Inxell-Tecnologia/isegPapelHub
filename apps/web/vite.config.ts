/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Prefixos servidos pela API (apps/api/src/app.ts) — nenhum sob `/api`.
 * O proxy de dev existe para que a SPA e a API sejam a mesma origem para o
 * browser: o cookie de sessão é `HttpOnly`/`SameSite=Strict` e a API não tem
 * CORS (design.md D1/D2 do change `web-shell-e-auth`). Em produção, o
 * url-map do load balancer roteia os mesmos prefixos para a Cloud Run
 * (infra/terraform/frontend.tf) e o fallback de `index.html` da própria API
 * usa a mesma lista para não sombrear rotas de API (apps/api/src/lib/
 * api-prefixes.ts, que também tem `/internal`) — mantenha as três listas em
 * sincronia.
 */
export const API_PROXY_PREFIXES = [
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
];

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      API_PROXY_PREFIXES.map((prefix) => [prefix, { target: API_TARGET, changeOrigin: true }]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Testes de interação (AntD + jsdom + userEvent) são pesados; o default de
    // 5s é apertado em máquinas carregadas (espelha o testTimeout já elevado do
    // vitest da API).
    testTimeout: 15000,
  },
});
