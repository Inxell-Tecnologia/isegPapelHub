import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { UserRole } from '@gdoc/shared';
import { LoginPage } from '../auth/LoginPage';
import { RequireAuth } from '../auth/RequireAuth';
import { AppShell } from '../shell/AppShell';
import { ExplorerPage } from '../navegacao/ExplorerPage';
import { BuscaPage } from '../busca/BuscaPage';
import { LixeiraPage } from '../lixeira/LixeiraPage';
import { PessoasPage } from '../pessoas/PessoasPage';
import { UnidadesPage } from '../unidades/UnidadesPage';
import { PainelPage } from '../painel/PainelPage';
import { MinhaContaPage } from '../conta/MinhaContaPage';
import { InicioPage } from '../inicio/InicioPage';
import { RecentesPage } from '../inicio/RecentesPage';
import { CompartilhadosPage } from '../compartilhados/CompartilhadosPage';
import { FavoritosPage } from '../favoritos/FavoritosPage';
import { LeiturasPage } from '../leitura/LeiturasPage';

/**
 * Guarda por papel aninhada (design.md D6): as próximas fatias só declaram a
 * rota e o papel exigido. Exportado separado do router de produção para que
 * os testes montem um `createMemoryRouter(routes, ...)` isolado, sem tocar o
 * histórico real do browser.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <InicioPage /> },
          { path: '/pastas', element: <ExplorerPage /> },
          { path: '/pastas/:folderId', element: <ExplorerPage /> },
          { path: '/busca', element: <BuscaPage /> },
          // Destino "Recentes" da navegação (change `shell-e-inicio`).
          { path: '/recentes', element: <RecentesPage /> },
          // "Compartilhados comigo" (US 4.4, `compartilhados-comigo`):
          // acessível a **qualquer** papel autenticado — não é item de
          // administração, e a rota do servidor é auto-escopada pela sessão,
          // então não há alcance a filtrar por papel aqui.
          { path: '/favoritos', element: <FavoritosPage /> },
          { path: '/compartilhados', element: <CompartilhadosPage /> },
          // "Leitura obrigatória" (US 12.4, `superficies-de-pendencia`,
          // design.md D5): qualquer pessoa pode ser do público, então não há
          // guarda de papel; a rota do servidor é auto-escopada pela sessão.
          { path: '/leituras', element: <LeiturasPage /> },
          { path: '/lixeira', element: <LixeiraPage /> },
          // "Minha conta" (US 1.3, `web-minha-conta`): acessível a qualquer
          // papel autenticado — não é item de administração, então não entra
          // na guarda `roles={[...]}` abaixo.
          { path: '/minha-conta', element: <MinhaContaPage /> },
          {
            element: <RequireAuth roles={[UserRole.UNIT_ADMIN, UserRole.GLOBAL_ADMIN]} />,
            children: [
              { path: '/admin/pessoas', element: <PessoasPage /> },
              { path: '/admin/painel', element: <PainelPage /> },
            ],
          },
          {
            // Gestão de unidades é exclusiva do global_admin (design.md D1).
            element: <RequireAuth roles={[UserRole.GLOBAL_ADMIN]} />,
            children: [{ path: '/admin/unidades', element: <UnidadesPage /> }],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
