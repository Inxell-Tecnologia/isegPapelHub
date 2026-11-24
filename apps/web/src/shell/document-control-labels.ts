import {
  DocumentLifecycleState,
  DocumentStatus,
  DocumentType,
  type FileSummaryResponse,
} from '@gdoc/shared';

/**
 * Rótulos em pt_BR do controle documental (Épico 10). Vivem na SPA, como
 * `ROLE_LABEL`: o contrato compartilhado guarda os **valores** do enum, a
 * interface guarda o texto que a pessoa lê.
 */

/** Nome do tipo, como o guia do cliente o nomeia (US 10.1). */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  [DocumentType.PROTOCOL]: 'Protocolo',
  [DocumentType.PROCEDURE]: 'Procedimento',
  [DocumentType.POLICY]: 'Política/Norma',
  [DocumentType.FORM]: 'Formulário',
  [DocumentType.CHECKLIST]: 'Checklist',
  [DocumentType.FLOWCHART]: 'Fluxograma',
  [DocumentType.MANUAL]: 'Manual',
  [DocumentType.CONSENT_TERM]: 'Termo de Consentimento',
  [DocumentType.INTERNAL_NOTICE]: 'Comunicado Interno',
  [DocumentType.GENERAL_FILE]: 'Arquivo geral',
};

/**
 * Sigla do tipo (US 10.1). É ela que carrega a informação na listagem — a cor
 * é redundância, nunca substituta (cenário 2: "a sigla permanece legível por
 * si só"). Por isso a sigla é renderizada como **texto**, sempre.
 */
export const DOCUMENT_TYPE_ACRONYM: Record<DocumentType, string> = {
  [DocumentType.PROTOCOL]: 'PRT',
  [DocumentType.PROCEDURE]: 'POP',
  [DocumentType.POLICY]: 'POL',
  /**
   * `FOR` e `CHK`, como na Matriz de Documentos do cliente (retorno sobre a
   * demanda nº 3, item 11; change `tipo-checklist`).
   */
  [DocumentType.FORM]: 'FOR',
  [DocumentType.CHECKLIST]: 'CHK',
  [DocumentType.FLOWCHART]: 'FLX',
  [DocumentType.MANUAL]: 'MAN',
  /**
   * `TC`, como o cliente escreve (demanda nº 2, tabela 2.2); `TCO` foi a sigla
   * da interface até o retorno do cliente sobre a demanda nº 3.
   */
  [DocumentType.CONSENT_TERM]: 'TC',
  [DocumentType.INTERNAL_NOTICE]: 'COM',
  /**
   * O material do cliente não dá sigla ao Arquivo geral — ele é a opção que
   * declara ausência de controle, e não um tipo da Matriz. `ARQ` existe porque
   * a listagem apresenta o tipo como sigla textual em toda linha, e deixá-la
   * vazia faria o Arquivo geral parecer arquivo **sem** tipo, que é
   * precisamente a condição da qual ele precisa se distinguir.
   */
  [DocumentType.GENERAL_FILE]: 'ARQ',
};

/** Estado declarado, como aparece no formulário de edição (design.md D3). */
export const DOCUMENT_LIFECYCLE_LABEL: Record<DocumentLifecycleState, string> = {
  [DocumentLifecycleState.CURRENT]: 'Vigente',
  [DocumentLifecycleState.IN_REVIEW]: 'Em revisão',
  [DocumentLifecycleState.OBSOLETE]: 'Obsoleto',
};

/** Tom semântico da situação — reusa os tons de estado já apurados. */
export const DOCUMENT_STATUS_TOM = {
  [DocumentStatus.CURRENT]: 'positivo',
  [DocumentStatus.DUE_SOON]: 'alerta',
  [DocumentStatus.IN_REVIEW]: 'alerta',
  [DocumentStatus.OVERDUE]: 'negativo',
  [DocumentStatus.OBSOLETE]: 'neutro',
  [DocumentStatus.UNCONTROLLED]: 'neutro',
  /** Pede ação de quem enviou — alerta, não falha. */
  [DocumentStatus.AWAITING_REGISTRATION]: 'alerta',
  /** Nunca renderizado: o Arquivo geral não apresenta etiqueta de situação. */
  [DocumentStatus.NOT_APPLICABLE]: 'neutro',
} as const;

/**
 * Texto da situação **apurada pelo servidor**, ou `null` quando não há
 * situação a apresentar. A SPA nunca recalcula a situação a partir da data e
 * do relógio do dispositivo (web-navegacao: "A SPA SHALL apresentar a que o
 * servidor devolveu") — aqui só se traduz o veredito recebido. A única
 * aritmética é a de "vence em N dias", e N também vem do servidor
 * (`daysUntilReview`).
 *
 * `null` devolve-se em dois casos, e quem chama decide o que renderizar
 * (ausência explícita, nunca etiqueta vazia):
 *
 * - **Arquivo geral**, que declara não ter prazo (US 10.8) — a demanda é
 *   explícita em que ele "não tem situação (Vigente, A vencer etc.)";
 * - **valor desconhecido**, de um servidor mais novo que esta SPA. Antes, o
 *   `default` deste `switch` respondia "Sem controle de revisão" a qualquer
 *   valor não previsto, o que é uma **afirmação** sobre o documento, não um
 *   fallback neutro — e foi o que teria apresentado o pendente de cadastro
 *   como acervo em circulação.
 */
export function rotuloDeSituacao(file: FileSummaryResponse): string | null {
  switch (file.documentStatus) {
    case DocumentStatus.CURRENT:
      return 'Vigente';
    case DocumentStatus.DUE_SOON:
      return file.daysUntilReview === null
        ? 'A vencer'
        : file.daysUntilReview === 1
          ? 'Vence em 1 dia'
          : `Vence em ${file.daysUntilReview} dias`;
    case DocumentStatus.IN_REVIEW:
      return 'Em revisão';
    case DocumentStatus.OVERDUE:
      return 'Revisão vencida';
    case DocumentStatus.OBSOLETE:
      return 'Obsoleto';
    case DocumentStatus.AWAITING_REGISTRATION:
      return 'Pendente de cadastro';
    case DocumentStatus.UNCONTROLLED:
      return 'Sem controle de revisão';
    default:
      return null;
  }
}

/** Marca de ausência explícita — nunca um valor presumido (US 10.3 cenário 2). */
export const AUSENTE = '—';

/** `Rev. 02` a partir do inteiro guardado (design.md D8); ausência explícita se não houver. */
export function formatarRevisao(revision: number | null): string {
  if (revision === null) return AUSENTE;
  return `Rev. ${String(revision).padStart(2, '0')}`;
}

/** Extensão final do nome do arquivo: ponto seguido de 1 a 5 letras ou dígitos. */
const EXTENSAO_FINAL = /\.[A-Za-z0-9]{1,5}$/;

/** Separadores entre o código e o título no nome do arquivo. */
const SEPARADORES_INICIAIS = /^[\s\-–—_.:]+/;

/**
 * Título "limpo" do documento para a lista de recentes
 * (`docs/demanda_cliente_3.md`, item 12; change `marca-dagua-e-inicio-rodada-3`,
 * design.md D9): o nome do arquivo sem a extensão e sem o prefixo **igual** ao
 * código do documento. É apresentação pura — não há título cadastrado nos
 * dados de controle —, e o nome íntegro continua no nome acessível e na dica.
 *
 * O prefixo só sai se for o código seguido de fim ou de caractere não
 * alfanumérico: "POP-ASS-005 rascunho" não perde nada quando o código é
 * POP-ASS-004, nem "POP-ASS-0041" quando é POP-ASS-004. Sem título que sobre,
 * devolve o nome sem a extensão — a linha nunca fica sem título.
 */
export function tituloDoDocumento(fileName: string, documentCode: string | null): string {
  const semExtensao =
    EXTENSAO_FINAL.test(fileName) && fileName.replace(EXTENSAO_FINAL, '').trim()
      ? fileName.replace(EXTENSAO_FINAL, '').trim()
      : fileName.trim();
  if (!documentCode) return semExtensao;

  const prefixo = semExtensao.slice(0, documentCode.length);
  const seguinte = semExtensao.charAt(documentCode.length);
  if (prefixo.toLowerCase() !== documentCode.toLowerCase() || /[\p{L}\p{N}]/u.test(seguinte)) {
    return semExtensao;
  }
  const titulo = semExtensao.slice(documentCode.length).replace(SEPARADORES_INICIAIS, '').trim();
  return titulo || semExtensao;
}

/** Data `YYYY-MM-DD` em pt-BR, sem passar por fuso: o prazo é do dia, não do instante. */
export function formatarDataDeRevisao(nextReviewAt: string | null): string {
  if (!nextReviewAt) return AUSENTE;
  const [ano, mes, dia] = nextReviewAt.split('-');
  if (!ano || !mes || !dia) return AUSENTE;
  return `${dia}/${mes}/${ano}`;
}
