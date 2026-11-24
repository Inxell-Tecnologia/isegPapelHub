import { App as AntdApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render } from '@testing-library/react';
import { SessionProvider } from '../auth/session-context';
import { routes } from '../app/router';

/**
 * Monta a árvore de providers de `App.tsx` sobre um `createMemoryRouter`
 * isolado por teste.
 *
 * O `router` acompanha o retorno porque o histórico é **em memória**:
 * `window.location` nunca muda aqui, de modo que um teste que precise afirmar
 * algo sobre o endereço corrente (um parâmetro de consulta consumido, por
 * exemplo) tem de ler `router.state.location` — ler `window.location` daria
 * uma asserção que passa sozinha, sem exercitar nada.
 */
export function renderApp(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries });

  return {
    ...render(
      <ConfigProvider>
        <AntdApp>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <RouterProvider router={router} />
            </SessionProvider>
          </QueryClientProvider>
        </AntdApp>
      </ConfigProvider>,
    ),
    router,
  };
}
