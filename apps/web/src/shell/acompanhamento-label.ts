import { ReadingOversight } from '@gdoc/shared';

/**
 * Origem única do rótulo do **acompanhamento de leituras** (change
 * `gestor-de-acompanhamento`, design.md D8), no molde de `ROLE_LABEL`.
 *
 * "Gestor" é a palavra que a change `rotulo-administrador-da-unidade`
 * reservou a este papel (`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`,
 * resposta 5a); os três rótulos a qualificam pelo alcance. Não é papel de
 * acesso: a marcação é ortogonal a `ROLE_LABEL` e não concede nada sobre
 * conteúdo.
 */
export const ACOMPANHAMENTO_LABEL: Record<ReadingOversight, string> = {
  [ReadingOversight.SECTOR]: 'Gestor do setor',
  [ReadingOversight.UNIT]: 'Gestor da unidade',
  [ReadingOversight.ALL_UNITS]: 'Gestor de todas as unidades',
};

/** Rótulo de quem não acompanha. */
export const SEM_ACOMPANHAMENTO = 'Não acompanha';
