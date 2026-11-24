import { DocumentStatus, type DocumentControlFields } from '@gdoc/shared';

/**
 * Dados de controle de um arquivo **sem** controle documental — o estado do
 * acervo que entrou por lote ou antes do Épico 10 (change
 * `controle-documental`). É o padrão das fixtures de `FileSummaryResponse` nos
 * testes da SPA: quem testa controle documental sobrescreve o que precisa, e
 * os demais testes seguem indiferentes a ele.
 */
export const SEM_CONTROLE_DOCUMENTAL: DocumentControlFields = {
  documentType: null,
  documentCode: null,
  documentRevision: null,
  responsibleSector: null,
  nextReviewAt: null,
  lifecycleState: null,
  documentStatus: DocumentStatus.UNCONTROLLED,
  daysUntilReview: null,
};
