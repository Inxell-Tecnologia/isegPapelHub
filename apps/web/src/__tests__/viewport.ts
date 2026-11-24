/**
 * Simula a largura do viewport para o mock de `matchMedia` (tasks.md 1.4):
 * `useNarrowMode` (design.md D1) só lê o breakpoint `lg` (992px) do Ant
 * Design via `Grid.useBreakpoint`, que consulta `matchMedia` com queries
 * `min-width`/`max-width` — bastam essas duas formas avaliadas contra uma
 * largura simulada, sem um `matchMedia` real.
 */
export function mockViewportWidth(width: number): void {
  window.matchMedia = ((query: string) => {
    const minWidth = query.match(/min-width:\s*([\d.]+)px/);
    const maxWidth = query.match(/max-width:\s*([\d.]+)px/);
    const matches = minWidth
      ? width >= Number(minWidth[1])
      : maxWidth
        ? width <= Number(maxWidth[1])
        : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  }) as typeof window.matchMedia;
}

/**
 * **O veredito do breakpoint chega um render depois da montagem.**
 * `Grid.useBreakpoint` devolve `{}` no primeiro render (`screens['lg']` é
 * `undefined`, não `false`), e só se corrige na subscrição ao observador do
 * design system — feita num efeito que, em `NODE_ENV=test`, o `rc-util`
 * executa como `useEffect` em vez de `useLayoutEffect` (em produção é
 * `useLayoutEffect`, antes do paint, e não há formato intermediário visível).
 * Todo componente responsivo portanto monta uma vez no formato largo.
 *
 * Teste de modo estreito **espera** a marca do formato estreito (`findBy`,
 * `waitFor`) antes de afirmar o que o formato largo não deve ter: asserção
 * síncrona logo após o `findBy` do conteúdo é corrida com esse segundo
 * render, e foi assim que a CI reprovou o envio em modo estreito.
 */

/** Largura de referência para o modo largo em teste — bem acima do limiar de 992px. */
export const WIDE_VIEWPORT = 1920;

/** Largura de referência para o modo estreito em teste — celular (design.md D1). */
export const NARROW_VIEWPORT = 360;
