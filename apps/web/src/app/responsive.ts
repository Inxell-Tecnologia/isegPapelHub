import { Grid } from 'antd';

/**
 * Ponto de ruptura único da SPA (design.md D1, change
 * `responsividade-mobile-tablet`): abaixo de `lg` (992px, token do design
 * system) a aplicação assume a forma estreita; a partir dele, a forma larga
 * já entregue, inalterada. `lg` foi escolhido sobre `md` (768px) porque o
 * alvo do modo estreito é consulta — um tablet em retrato (768px) ganha a
 * largura toda para o preview, ao custo de a navegação ficar a um toque em
 * vez de permanentemente visível.
 */
const NARROW_MODE_BREAKPOINT = 'lg' as const;

/**
 * Único hook de leitura do modo estreito (tasks.md 1.3) — nenhum componente
 * SHALL decidir seu próprio limiar. Lido via `Grid.useBreakpoint` do design
 * system, não por `window.matchMedia` escrito à mão, para nunca sair de
 * sincronia com os tokens.
 */
export function useNarrowMode(): boolean {
  const screens = Grid.useBreakpoint();
  return screens[NARROW_MODE_BREAKPOINT] === false;
}
