import { useMemo, useSyncExternalStore } from 'react';
import { theme } from 'antd';

/**
 * Ponto de ruptura único da SPA (design.md D1, change
 * `responsividade-mobile-tablet`): abaixo de `lg` (992px, token do design
 * system) a aplicação assume a forma estreita; a partir dele, a forma larga
 * já entregue, inalterada. `lg` foi escolhido sobre `md` (768px) porque o
 * alvo do modo estreito é consulta — um tablet em retrato (768px) ganha a
 * largura toda para o preview, ao custo de a navegação ficar a um toque em
 * vez de permanentemente visível.
 *
 * O limiar é o **token** do design system, nunca um número escrito aqui: é
 * dele que a consulta de mídia abaixo é derivada, na mesma forma que o próprio
 * design system usa para `lg` (`min-width: screenLG`).
 */
const NARROW_MODE_BREAKPOINT_TOKEN = 'screenLG' as const;

/**
 * Leitor do limiar com **snapshot síncrono** (design.md D1 do change
 * `modo-estreito-no-primeiro-render`): `Grid.useBreakpoint` do design system
 * só conhece o veredito depois de subscrever o observador num efeito, e até
 * ali responde "forma larga" — toda tela responsiva montava uma vez na forma
 * que não seria apresentada, e em teste (onde o `rc-util` degrada o efeito
 * para `useEffect`) esse estado intermediário ficava observável. Ler a
 * `MediaQueryList` direto dá o veredito já no primeiro render; a subscrição
 * ao evento `change` mantém a reação a redimensionamento e rotação.
 */
function criarLeitorDoLimiar(consulta: string) {
  const mql =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(consulta)
      : null;

  return {
    // Sem `matchMedia` o leitor responde "forma larga", que é o comportamento
    // de antes deste change: degrada em desempenho, nunca em funcionamento
    // (design.md D2).
    lerFormaLarga: () => (mql ? mql.matches : true),
    assinar: (aoMudar: () => void) => {
      mql?.addEventListener('change', aoMudar);
      return () => mql?.removeEventListener('change', aoMudar);
    },
  };
}

/**
 * Único hook de leitura do modo estreito (tasks.md 1.3 de
 * `responsividade-mobile-tablet`) — nenhum componente SHALL decidir seu
 * próprio limiar. O veredito vale desde o primeiro render, requisito
 * "A primeira composição já está na forma correta" de `web-responsividade`.
 */
export function useNarrowMode(): boolean {
  const { token } = theme.useToken();
  const consulta = `(min-width: ${token[NARROW_MODE_BREAKPOINT_TOKEN]}px)`;
  const leitor = useMemo(() => criarLeitorDoLimiar(consulta), [consulta]);

  return !useSyncExternalStore(leitor.assinar, leitor.lerFormaLarga, leitor.lerFormaLarga);
}
