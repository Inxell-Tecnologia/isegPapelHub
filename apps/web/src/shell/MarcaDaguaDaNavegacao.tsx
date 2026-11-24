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
 * Reapurada com a paleta e o símbolo negativo do ISEG (change
 * `sync-upstream-identidade-iseg`, design.md D7) — a opacidade não muda; o
 * degradê verde-petróleo dá mais folga que o marinho do upstream:
 *
 *   opacidade   textoSobreEscuro   branco
 *     0%          7,98:1           10,07:1
 *     6%          6,76:1            8,52:1
 *     8%          6,43:1            8,11:1   ← adotada
 *    10%          6,06:1            7,65:1
 *    14%          5,43:1            6,84:1   (medida da demanda nº 2)
 *    20%          4,58:1            5,77:1
 *    22%          4,32:1 ✗          5,44:1   (teto: primeira a reprovar)
 *
 * O teste de contraste refaz a conta a partir desta constante.
 */
export const OPACIDADE_MARCA_DAGUA_NAVEGACAO = 0.08;

/**
 * Pixel opaco mais luminoso do símbolo negativo (`iseg-simbolo-negativo.png`,
 * medido no ativo gerado: a sigla em branco) — o pior caso para o texto que
 * passa por cima.
 */
export const COR_MAIS_CLARA_DO_SIMBOLO = '#FFFFFF';

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
