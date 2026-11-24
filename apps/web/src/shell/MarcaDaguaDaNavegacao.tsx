import { ATIVOS_DA_MARCA } from './BrandMark';

/**
 * Opacidade da marca d'água no pé da navegação (`docs/demanda_cliente_3.md`,
 * item 3; change `identidade-isetes-e-menu-compacto`, design.md D6).
 *
 * Apurada por cálculo, não por inspeção: o símbolo **clareia** o fundo escuro,
 * e o par mais frágil é `textoSobreEscuro` (rótulos de grupo, texto do cartão)
 * sobre a mistura do pixel mais luminoso do símbolo com `marinhoClaro`, a base
 * do degradê:
 *
 *   opacidade   textoSobreEscuro   branco
 *     0%          5,48:1            8,16:1
 *     6%          4,98:1            7,42:1
 *     8%          4,79:1            7,14:1   ← adotada
 *    10%          4,62:1            6,88:1
 *    14%          4,35:1 ✗          6,48:1   (medida da demanda nº 2)
 *
 * O teste de contraste refaz a conta a partir desta constante.
 */
export const OPACIDADE_MARCA_DAGUA_NAVEGACAO = 0.08;

/** Pixel mais luminoso do símbolo — o pior caso para o texto que passa por cima. */
export const COR_MAIS_CLARA_DO_SIMBOLO = '#00DE89';

/** Altura do símbolo — medida da demanda nº 2, seção 1.1. */
const ALTURA_MARCA_DAGUA = 200;

/**
 * Símbolo decorativo no pé da navegação, **atrás** do menu e do cartão: fora
 * da árvore acessível (`aria-hidden`, `alt=""`) e transparente ao ponteiro —
 * um clique sobre ela chega ao item ou ao cartão que está por cima. Quem o
 * hospeda é um contêiner `position: relative` com `overflow: hidden`, que
 * recorta o trecho que sai da coluna.
 */
export function MarcaDaguaDaNavegacao() {
  return (
    <img
      src={ATIVOS_DA_MARCA.simbolo.src}
      alt=""
      aria-hidden
      data-marca-dagua=""
      width={Math.round(ALTURA_MARCA_DAGUA * ATIVOS_DA_MARCA.simbolo.proporcao)}
      height={ALTURA_MARCA_DAGUA}
      style={{
        position: 'absolute',
        left: -24,
        bottom: 24,
        opacity: OPACIDADE_MARCA_DAGUA_NAVEGACAO,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
      }}
    />
  );
}
