/**
 * Razão de contraste do WCAG 2.x (capability `sistema-de-design`, requisito
 * "Piso de acessibilidade verificável na camada visual"; change
 * `identidade-visual-isetes`, design.md D2/D3).
 *
 * Existe porque a spec exige que todo par de cores dos tokens seja apurado
 * **por cálculo**, nunca aceito por inspeção visual: o próprio guia do
 * cliente trazia um par (branco sobre o verde da marca) que reprova no piso
 * que ele mesmo pede. Função pura, sem dependência de DOM, para ser chamada
 * tanto pelo teste que trava os tokens quanto por qualquer verificação
 * futura de par novo.
 */

/** Pisos normatizados pela spec. */
export const PISO_CONTRASTE_TEXTO = 4.5;
export const PISO_CONTRASTE_CONTROLE = 3;
export const PISO_CONTRASTE_AAA = 7;

/** Componentes sRGB de `#rgb` ou `#rrggbb`, em 0..1. */
function componentesSrgb(cor: string): [number, number, number] {
  const bruto = cor.replace('#', '').trim();
  const hex =
    bruto.length === 3
      ? bruto
          .split('')
          .map((c) => c + c)
          .join('')
      : bruto;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`cor hexadecimal inválida: "${cor}"`);
  }
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

/** Linearização de canal do WCAG 2.x (sRGB → luz linear). */
function linearizar(canal: number): number {
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (WCAG 2.x, definição de *relative luminance*). */
export function luminanciaRelativa(cor: string): number {
  const [r, g, b] = componentesSrgb(cor);
  return 0.2126 * linearizar(r) + 0.7152 * linearizar(g) + 0.0722 * linearizar(b);
}

/**
 * Razão de contraste entre duas cores opacas — simétrica, sempre ≥ 1.
 * Cores com transparência não entram: a spec normatiza pares de tokens
 * opacos, e um alfa tornaria o resultado dependente do que estiver atrás.
 */
export function razaoDeContraste(corA: string, corB: string): number {
  const a = luminanciaRelativa(corA);
  const b = luminanciaRelativa(corB);
  const clara = Math.max(a, b);
  const escura = Math.min(a, b);
  return (clara + 0.05) / (escura + 0.05);
}

/** `true` quando o par alcança o piso pedido — o veredito que a spec exige por cálculo. */
export function atendeAoPiso(corA: string, corB: string, piso: number): boolean {
  return razaoDeContraste(corA, corB) >= piso;
}
