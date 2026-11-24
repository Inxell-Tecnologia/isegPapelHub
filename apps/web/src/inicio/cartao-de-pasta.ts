import type { TomDeAtalho } from '../app/theme';

/**
 * Regras puras do cartão de pasta da tela inicial (change
 * `contagem-de-documentos-nas-pastas`, design.md D5; `docs/demanda_cliente_3.md`,
 * item 7).
 */

const FORMATO_PT_BR = new Intl.NumberFormat('pt-BR');

/**
 * Texto da contagem de documentos **diretos** que o servidor informou para a
 * pasta. `undefined` é "contagem desconhecida" (API anterior a esta change,
 * design.md D3) e devolve `null` — o cartão omite a linha em vez de afirmar
 * zero, o que seria dizer algo que o servidor não disse.
 */
export function textoDaContagemDeDocumentos(n: number | undefined): string | null {
  if (n === undefined) return null;
  if (n === 0) return 'Nenhum documento';
  if (n === 1) return '1 documento';
  return `${FORMATO_PT_BR.format(n)} documentos`;
}

const TONS_DE_PASTA: readonly TomDeAtalho[] = ['azul', 'verde', 'roxo', 'laranja'];

/**
 * Tom estável por pasta, derivado do **id** e não da posição: a lista vem
 * ordenada por nome, e uma pasta nova ou renomeada mudaria a cor das demais
 * se a cor dependesse do índice. A cor é decorativa — o ícone é `aria-hidden`
 * e a informação está no texto.
 */
export function tomDaPasta(id: string): TomDeAtalho {
  let soma = 0;
  for (let i = 0; i < id.length; i += 1) soma += id.charCodeAt(i);
  return TONS_DE_PASTA[soma % TONS_DE_PASTA.length]!;
}
