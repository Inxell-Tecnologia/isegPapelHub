import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { mockViewportWidth, WIDE_VIEWPORT } from './viewport';

// CI é mais lento que o dev local, especialmente no primeiro teste do arquivo
// (cold start de módulos/JIT) — o timeout padrão de 1000ms do
// findBy/waitFor causava falha intermitente sem indicar bug real.
configure({ asyncUtilTimeout: 5000 });

// jsdom não implementa matchMedia — o Sider/useBreakpoint do Ant Design o
// exige. Modo largo é o padrão de cada teste (tasks.md 1.4): a suíte já
// pressupõe a forma larga na maioria dos casos, e só os testes do modo
// estreito chamam `mockViewportWidth(NARROW_VIEWPORT)` explicitamente.
beforeEach(() => {
  mockViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  // `mockFetch` usa `vi.stubGlobal('fetch', ...)`, que não se desfaz sozinho
  // entre arquivos de teste — sem isto, o mock de um arquivo vaza para o
  // próximo e quebra suas chamadas de fetch.
  vi.unstubAllGlobals();
});
