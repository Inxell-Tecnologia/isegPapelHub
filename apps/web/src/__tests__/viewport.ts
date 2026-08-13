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

/** Largura de referência para o modo largo em teste — bem acima do limiar de 992px. */
export const WIDE_VIEWPORT = 1920;

/** Largura de referência para o modo estreito em teste — celular (design.md D1). */
export const NARROW_VIEWPORT = 360;
