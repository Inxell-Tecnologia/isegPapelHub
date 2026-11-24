import { useEffect } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '../lib/query-client';
import { SessionProvider } from '../auth/session-context';
import { ESTILO_GLOBAL, theme } from './theme';
import { router } from './router';

export function App() {
  // Projeção dos tokens que o design system não expõe (theme.ts,
  // ESTILO_GLOBAL): família de título e área de acionamento da caixa de
  // seleção. Vai no `head` — e não na árvore —, para não entrar no texto do
  // documento, que é o que as tecnologias assistivas e os testes leem.
  useEffect(() => {
    const estilo = document.createElement('style');
    estilo.dataset.origem = 'papelhub-tokens';
    estilo.textContent = ESTILO_GLOBAL;
    document.head.appendChild(estilo);
    return () => estilo.remove();
  }, []);

  return (
    <ConfigProvider theme={theme} locale={ptBR}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
