/**
 * Dados de controle de um documento (Épico 10, change `controle-documental`).
 *
 * Tipos e situações são **constantes de produto** no contrato compartilhado,
 * como `UserRole` e `Permission` (design.md D4) — não taxonomia administrável
 * por unidade, que exigiria tela de administração e tornaria editável uma
 * decisão de identidade visual com contraste já verificado.
 */

/**
 * Conjunto fechado dos dez tipos previstos (US 10.1, US 10.8). Valor fora
 * deste conjunto é recusado pela API — a validação vive em
 * `apps/api/src/lib/document-control.ts`, não no schema do banco (ver o
 * comentário da migration 0016 sobre por que não há CHECK).
 */
export const DocumentType = {
  PROTOCOL: 'protocol',
  PROCEDURE: 'procedure',
  POLICY: 'policy',
  FORM: 'form',
  /**
   * Checklist, sigla `CHK` na Matriz do cliente — até o change
   * `tipo-checklist` era o mesmo tipo do formulário. Documentos gravados como
   * `form` antes dele **não** são reclassificados (design.md D2): nada no
   * banco separa com segurança um checklist de um formulário.
   */
  CHECKLIST: 'checklist',
  FLOWCHART: 'flowchart',
  MANUAL: 'manual',
  CONSENT_TERM: 'consent_term',
  INTERNAL_NOTICE: 'internal_notice',
  /**
   * Arquivo que **não é documento da Matriz** — ata, planilha de trabalho,
   * apresentação (US 10.8, demanda 2.4). Pede só o título: não tem código,
   * revisão nem data de próxima revisão, e nenhuma situação de revisão lhe é
   * atribuída.
   *
   * É o único que **declara ausência** de controle, o que o
   * torna distinto de "dados ainda não preenchidos" — um é afirmação de que
   * nunca haverá código, o outro é pendência a resolver. A fatia da leitura
   * obrigatória depende dessa distinção para recusar marcar o Arquivo geral.
   */
  GENERAL_FILE: 'general_file',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DOCUMENT_TYPES: readonly DocumentType[] = Object.values(DocumentType);

/**
 * Estado **declarado** por uma pessoa (design.md D3) — distinto da situação
 * derivada abaixo. `null` na leitura significa "vigente, não declarado": o
 * acervo existente não foi migrado, e não precisa ser.
 *
 * Dois campos, e não um só, porque o material do cliente usa a mesma cor
 * âmbar para coisas diferentes: `Em revisão` é declaração de uma pessoa;
 * `Vence em 45 dias` é consequência aritmética de uma data. Um campo único
 * não representaria "documento em revisão cuja data ainda está longe" sem
 * perder uma das duas informações.
 */
export const DocumentLifecycleState = {
  CURRENT: 'current',
  IN_REVIEW: 'in_review',
  OBSOLETE: 'obsolete',
} as const;

export type DocumentLifecycleState =
  (typeof DocumentLifecycleState)[keyof typeof DocumentLifecycleState];

export const DOCUMENT_LIFECYCLE_STATES: readonly DocumentLifecycleState[] =
  Object.values(DocumentLifecycleState);

/**
 * Situação **apurada no momento da consulta** (US 10.4, design.md D2). Nunca
 * é gravada em coluna nem depende de rotina programada: é expressão SQL
 * avaliada pelo relógio do banco a cada `SELECT`. A SPA apresenta o valor que
 * o servidor devolveu — jamais o recalcula pelo relógio do dispositivo.
 */
export const DocumentStatus = {
  /** Data de próxima revisão a mais de `REVIEW_DUE_SOON_DAYS` dias. */
  CURRENT: 'current',
  /** Dentro da janela de `REVIEW_DUE_SOON_DAYS` dias; acompanha `daysUntilReview`. */
  DUE_SOON: 'due_soon',
  /** Declarado em revisão — prevalece sobre a data. */
  IN_REVIEW: 'in_review',
  /** Data de próxima revisão já passou. */
  OVERDUE: 'overdue',
  /** Declarado obsoleto — sai de circulação para quem não é gestão da unidade. */
  OBSOLETE: 'obsolete',
  /**
   * Sem data de próxima revisão informada. Estado que o guia do cliente não
   * prevê e que esta change inaugura: é a consequência direta de dispensar
   * metadados no lote (design.md D7) — o acervo já existente e tudo que entra
   * por lote cai aqui. Não conta entre os documentos a vencer nem entre os
   * vencidos.
   */
  UNCONTROLLED: 'uncontrolled',
  /**
   * Estado do **cadastro**, não da revisão (US 10.9, demanda 2.3): o arquivo
   * entrou sem os dados exigidos e ainda não foi publicado. Fica na pasta, mas
   * só é alcançado por quem o enviou e pela administração da unidade.
   *
   * Distinto de `UNCONTROLLED` de propósito. Os dois têm as mesmas colunas
   * vazias, mas significam coisas opostas: `UNCONTROLLED` é acervo legítimo em
   * circulação (o anterior ao controle documental, que o PRD promete não
   * invalidar); este é entrada incompleta sob a regra nova, fora de
   * circulação até ser completada. É por isso que a condição vem de um
   * marcador gravado no envio, e não da ausência de dados — derivá-la das
   * colunas vazias tiraria o acervo anterior de circulação de uma vez
   * (design.md D1).
   */
  AWAITING_REGISTRATION: 'awaiting_registration',
  /**
   * Não há situação de revisão a apurar: o arquivo é `GENERAL_FILE`, que
   * declara não ter prazo (US 10.8). Existe como valor próprio, em vez de
   * `documentStatus` nulável, para manter o campo total — a alternativa
   * espalharia tratamento de `null` por toda leitura do DTO para dizer o
   * mesmo. A interface apresenta **ausência de etiqueta** para este valor.
   */
  NOT_APPLICABLE: 'not_applicable',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

/** Janela de "A vencer", em dias (US 10.4 cenário 2). */
export const REVIEW_DUE_SOON_DAYS = 60;

/** Campos de controle como aparecem na leitura de um documento. */
export interface DocumentControlFields {
  documentType: DocumentType | null;
  documentCode: string | null;
  /** Inteiro; apresentado formatado (`Rev. 02`) pela interface — design.md D8. */
  documentRevision: number | null;
  responsibleSector: string | null;
  /** Data (`YYYY-MM-DD`), sem hora: o prazo é do dia, não do instante. */
  nextReviewAt: string | null;
  /** `null` = vigente, não declarado. */
  lifecycleState: DocumentLifecycleState | null;
  /** Derivada no `SELECT` pelo relógio do banco (design.md D2). */
  documentStatus: DocumentStatus;
  /** Dias até a próxima revisão; negativo quando vencida, `null` sem data. */
  daysUntilReview: number | null;
  /**
   * Veredito do verbo exigido para editar os dados de controle (o mesmo de
   * substituir), **resolvido pelo servidor** — mesmo padrão e mesma razão de
   * `FolderContentsResponse.canUpload`: a capability `web-navegacao` proíbe a
   * SPA de inferir permissão no cliente, e quem tem a concessão sobre
   * documento de outra pessoa não é derivável do DTO.
   *
   * Presente apenas nas respostas que **listam** documentos (listagem de
   * pasta e busca), onde o fragmento de alcance já está em mãos e sai de
   * graça na mesma consulta; ausente nas respostas de uma operação sobre um
   * documento só, que não são usadas para decidir o que oferecer. Ausência é
   * tratada como "não oferecer" pela interface.
   *
   * Não é linha de defesa: o 403 de `PATCH /files/:id/document-control`
   * continua sendo a autorização real.
   */
  canEditControl?: boolean;
  /**
   * A **revisão vigente** tem marcação de leitura obrigatória em curso
   * (change `superficies-de-pendencia`, design.md D4): marcação da revisão
   * atual, de documento não obsoleto. Apurado na própria consulta de listagem,
   * como `canEditControl`, e ausente fora dela — ausência é "não apresentar o
   * ícone". Não revela público, prazo nem mensagem da marcação.
   */
  requiredReading?: boolean;
}

/**
 * As três constantes a seguir vivem aqui, e não em `apps/api`, porque **os dois
 * lados precisam da mesma resposta** para a pergunta "este cadastro está
 * completo?" (design.md D9 do change `tabela-de-cadastro-no-envio-em-lote`).
 *
 * A interface precisa marcar a linha da tabela de cadastro como completa ou
 * incompleta sem uma ida ao servidor, e manter uma segunda lista escrita à mão
 * no cliente foi exatamente o que produziu o defeito que esta change corrige:
 * a change `arquivo-geral-e-pendente-de-cadastro` levou o conjunto de quatro
 * para cinco campos no servidor e o formulário da SPA ficou em quatro.
 *
 * São constantes de **produto**, como `DocumentType` e `DocumentStatus` já são
 * — não taxonomia administrável. O veredito de aceitação continua sendo só do
 * servidor: `parseDocumentControl` é quem recusa, e estas constantes são o que
 * ele consulta.
 */

/**
 * Campos que a publicação de um documento **controlado** exige (US 10.5).
 *
 * São cinco, não quatro: o **responsável** entra por força da tabela 2.2 da
 * demanda do cliente, que o marca obrigatório ao lado dos demais. A mudança
 * vale também para o envio unitário, porque a Regra da seção 2 é explícita em
 * que os dados sejam os mesmos "seja enviado sozinho ou em lote".
 *
 * Título não está aqui porque já é obrigatório por outro caminho: mapeia para
 * `file_name`, que nenhum envio consegue omitir (design.md D8).
 */
export const REQUIRED_CONTROL_FIELDS = [
  'documentType',
  'documentCode',
  'documentRevision',
  'responsibleSector',
  'nextReviewAt',
] as const satisfies readonly (keyof DocumentControlInput)[];

/**
 * Campos que o tipo **Arquivo geral** não admite (US 10.8): ele declara não ter
 * código nem prazo, então informá-los é contradição, não complemento — e é
 * recusado em vez de silenciosamente ignorado, para que a contradição apareça
 * a quem a escreveu.
 *
 * `responsibleSector` **não** está na lista: "pede só o Título" diz o que é
 * obrigatório, não o que é proibido, e saber a quem pertence uma ata é útil
 * sem implicar controle de revisão.
 */
export const FIELDS_REJECTED_FOR_GENERAL_FILE = [
  'documentCode',
  'documentRevision',
  'nextReviewAt',
] as const satisfies readonly (keyof DocumentControlInput)[];

/**
 * Conjunto exigido para publicar, **em função do tipo** (design.md D5).
 *
 * O Arquivo geral não exige nenhum dos cinco: declarar o tipo já é cadastrá-lo.
 * É isso que o torna distinto de um arquivo sem dados — um está cadastrado como
 * não-controlado, o outro aguarda cadastro.
 */
export function requiredFieldsForType(
  documentType: DocumentType | null | undefined,
): readonly (keyof DocumentControlInput)[] {
  if (documentType === DocumentType.GENERAL_FILE) return [];
  return REQUIRED_CONTROL_FIELDS;
}

/**
 * Dados de controle informados pelo cliente, no envio de um documento
 * (`POST /files/upload-url`) e na edição (`PATCH /files/:id/document-control`).
 *
 * `nextReviewAt` é `YYYY-MM-DD`. `lifecycleState` ausente mantém o estado
 * atual na edição e significa "vigente, não declarado" na publicação.
 */
export interface DocumentControlInput {
  documentType?: DocumentType | null;
  documentCode?: string | null;
  documentRevision?: number | null;
  responsibleSector?: string | null;
  nextReviewAt?: string | null;
  lifecycleState?: DocumentLifecycleState | null;
}

/** `PATCH /files/:id/document-control` (US 10.5) — sem reenvio de conteúdo. */
export type UpdateDocumentControlRequest = DocumentControlInput;

/**
 * Recusa por dado de controle faltante no envio de **um** documento
 * (US 10.5 cenário 1). `missing` nomeia os campos que faltam, para a
 * interface apontar o que corrigir em vez de exibir uma recusa genérica —
 * distinguível da recusa por código em uso e da recusa por permissão.
 */
export interface DocumentControlRequiredResponse {
  error: 'document_control_required';
  missing: (keyof DocumentControlInput)[];
}

/**
 * Recusa por código já usado por documento **não excluído da mesma unidade**
 * (US 10.2 cenário 2; design.md D5). `occupiedBy` só é preenchido na recusa de
 * **restauração**, onde o design exige dizer qual documento ocupa o código
 * para a pessoa poder resolver; nunca atravessa unidade — o mesmo código em
 * outra unidade não conflita e nada dele é revelado.
 */
export interface DocumentCodeInUseResponse {
  error: 'document_code_in_use';
  code: string;
  occupiedBy?: { id: string; fileName: string };
}

/**
 * Recusa de **um item** do envio em lote cujo código conflita: com documento
 * não excluído da mesma unidade, ou com outro item **do mesmo lote**
 * (`envio-lote`: "Conflito de código recusa só o seu item no envio em lote" e
 * "Dois itens do mesmo lote não podem declarar o mesmo código").
 *
 * Distinta de `DocumentCodeInUseResponse`, que recusa a **requisição** do envio
 * unitário e da restauração: esta chega dentro de `BatchUploadItemFailure.error`
 * e recusa só o seu item, enquanto os demais do lote recebem suas URLs. Nunca
 * carrega `occupiedBy` — o ocupante pode ser outro item do mesmo lote, que
 * ainda não existe, e nomear um arquivo do acervo revelaria a quem não
 * necessariamente o alcança.
 */
export interface DocumentCodeConflictResponse {
  error: 'document_code_conflict';
}

/**
 * Recusa por campo de controle informado junto com o tipo **Arquivo geral**
 * (US 10.8). `rejected` nomeia quais dos três campos incompatíveis vieram
 * preenchidos, para a interface apontar o conflito em vez de apresentar recusa
 * genérica — a pessoa não vê mais o campo que a causou, porque escolher o tipo
 * o torna indisponível.
 */
export interface GeneralFileRejectsControlFieldsResponse {
  error: 'general_file_rejects_control_fields';
  rejected: (keyof DocumentControlInput)[];
}

/** Recusa por tipo documental fora do conjunto previsto (US 10.1). */
export interface InvalidDocumentTypeResponse {
  error: 'invalid_document_type';
}
