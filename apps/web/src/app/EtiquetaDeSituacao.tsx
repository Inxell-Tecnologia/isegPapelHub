import type { FileSummaryResponse } from '@gdoc/shared';
import { RotuloDeEstado } from './RotuloDeEstado';
import { AUSENTE, DOCUMENT_STATUS_TOM, rotuloDeSituacao } from '../shell/document-control-labels';

/**
 * Etiqueta da situação **apurada pelo servidor** (US 10.4), ou ausência
 * explícita quando não há situação a apresentar.
 *
 * Existe como componente, e não como duas chamadas a `rotuloDeSituacao`,
 * porque a decisão de **não** renderizar a etiqueta é parte da regra e precisa
 * ser a mesma na listagem do explorador e na tabela de recentes. Duas cópias
 * divergiriam, e a divergência apareceria como etiqueta vazia numa das telas.
 *
 * Dois casos devolvem ausência: o **Arquivo geral**, que declara não ter prazo
 * (US 10.8 — a demanda diz que ele "não tem situação"), e um valor de situação
 * que esta SPA não reconhece, de um servidor mais novo. No segundo caso a
 * linha continua sendo apresentada: deixar de exibir a situação é melhor que
 * afirmar a errada, e muito melhor que quebrar a listagem.
 */
export function EtiquetaDeSituacao({ file }: { file: FileSummaryResponse }) {
  const rotulo = rotuloDeSituacao(file);
  if (rotulo === null) return <>{AUSENTE}</>;
  return <RotuloDeEstado tom={DOCUMENT_STATUS_TOM[file.documentStatus]}>{rotulo}</RotuloDeEstado>;
}
