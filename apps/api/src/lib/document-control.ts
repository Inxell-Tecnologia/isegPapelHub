import type { PoolClient } from 'pg';
import {
  DOCUMENT_LIFECYCLE_STATES,
  DOCUMENT_TYPES,
  DocumentLifecycleState,
  DocumentStatus,
  DocumentType,
  GrantResourceType,
  Permission,
  FIELDS_REJECTED_FOR_GENERAL_FILE,
  REVIEW_DUE_SOON_DAYS,
  requiredFieldsForType,
  type DocumentControlInput,
  type FileSummaryResponse,
} from '@gdoc/shared';
import type { TenantContext } from '../ports/database-port.js';
import { isAdminOfUnit, resourceScopeClause } from './access.js';

/**
 * Controle documental (Épico 10, change `controle-documental`): projeção dos
 * campos de controle, **derivação da situação em SQL** e as regras puras que
 * decorrem dela.
 *
 * Existe como módulo único porque três rotas montam o mesmo resumo de arquivo
 * (`routes/files.ts`, `routes/folders.ts`, `routes/search.ts`) e a derivação
 * da situação precisa ser idêntica nas três — três cópias da mesma expressão
 * é precisamente como uma delas envelhece sozinha.
 */

/**
 * Situação do documento, derivada **no `SELECT`** (design.md D2). Não é
 * coluna e não depende de rotina: o relógio que decide é o do Postgres
 * (`current_date`), não o do processo Node nem o do dispositivo, exatamente
 * como a vigência de concessão já faz com `now()`.
 *
 * A ordem dos ramos é a regra, e é lida de cima para baixo:
 *
 * 1. **Pendência de cadastro** prevalece sobre tudo (US 10.9): um arquivo que
 *    ainda não foi cadastrado não tem situação de revisão a apurar, mesmo que
 *    já traga data ou estado declarado — ele está fora de circulação, e
 *    anunciar "Vigente" sobre o que nenhum leitor alcança seria mentira.
 * 2. **Arquivo geral** (US 10.8) vem em seguida: a ausência de situação nele é
 *    definitiva, não um estágio. Fica abaixo da pendência porque um Arquivo
 *    geral nunca nasce pendente — declarar o tipo já é cadastrá-lo —, e a
 *    ordem deixa isso explícito em vez de depender dessa invariante.
 * 3. O estado **declarado** prevalece sobre a data (US 10.4 cenário 4).
 * 4. A ausência de data resolve para "sem controle de revisão" antes de
 *    qualquer aritmética.
 *
 * Nenhum literal vem de entrada do usuário — são constantes do enum
 * compartilhado —, então o fragmento não tem superfície de injeção (mesmo
 * padrão de `resourceScopeClause` em `lib/access.ts`).
 */
export const DOCUMENT_STATUS_SQL = `CASE
    WHEN awaiting_registration THEN '${DocumentStatus.AWAITING_REGISTRATION}'
    WHEN document_type = '${DocumentType.GENERAL_FILE}' THEN '${DocumentStatus.NOT_APPLICABLE}'
    WHEN lifecycle_state = '${DocumentLifecycleState.OBSOLETE}' THEN '${DocumentStatus.OBSOLETE}'
    WHEN lifecycle_state = '${DocumentLifecycleState.IN_REVIEW}' THEN '${DocumentStatus.IN_REVIEW}'
    WHEN next_review_at IS NULL THEN '${DocumentStatus.UNCONTROLLED}'
    WHEN next_review_at < current_date THEN '${DocumentStatus.OVERDUE}'
    WHEN next_review_at <= current_date + ${REVIEW_DUE_SOON_DAYS} THEN '${DocumentStatus.DUE_SOON}'
    ELSE '${DocumentStatus.CURRENT}'
  END`;

/** Dias até a próxima revisão (negativo quando vencida), pelo relógio do banco. */
export const DAYS_UNTIL_REVIEW_SQL = `(next_review_at - current_date)`;

/**
 * Expressões derivadas para acrescentar a um `SELECT *` ou `RETURNING *` de
 * `files` — as rotas que já leem a linha inteira não precisam enumerar
 * colunas, só anexar o que não existe como coluna.
 */
export const FILE_DERIVED_COLUMNS = `${DOCUMENT_STATUS_SQL} AS document_status, ${DAYS_UNTIL_REVIEW_SQL} AS days_until_review`;

const FILE_SUMMARY_BASE_COLUMNS = `id, owner_id, folder_id, file_name, content_type, size_bytes, status, created_at,
     document_type, document_code, document_revision, responsible_sector, next_review_at, lifecycle_state`;

/**
 * Colunas do resumo de arquivo para as consultas que **listam** documentos
 * (listagem de pasta e busca): os campos de controle, a situação derivada e o
 * veredito de edição.
 *
 * `can_edit_control` reusa o mesmo fragmento de alcance que a consulta já
 * monta, agora para o verbo `rename` — o verbo que substituir exige e que a
 * edição dos dados passa a exigir. Sai de graça na mesma linha, sem
 * round-trip por item (mesmo padrão da coluna `allowed` do manifesto de
 * download, `lib/folder-tree.ts`). `ownerIdParam` é o placeholder já usado
 * para `ctx.userId` na consulta; para admin da unidade o fragmento não o
 * referencia (vira `TRUE`/literal de `unit_id`), e aí o parâmetro nem entra.
 */
export function fileSummaryColumns(ctx: TenantContext, ownerIdParam: string): string {
  const canEdit = resourceScopeClause(GrantResourceType.FILE, ownerIdParam, ctx, Permission.RENAME);
  return `${FILE_SUMMARY_BASE_COLUMNS}, (${canEdit}) AS can_edit_control, ${REQUIRED_READING_SQL} AS required_reading, ${FILE_DERIVED_COLUMNS}`;
}

/**
 * Colunas do resumo de arquivo na **transação de visita** (change
 * `compartilhamento-entre-unidades`, design.md D6): mesma forma de
 * `fileSummaryColumns`, com `can_edit_control` e `required_reading` fixos em
 * `false` — quem visita nunca edita, e a leitura obrigatória é da unidade de
 * origem, não de quem visita.
 */
export function visitFileSummaryColumns(): string {
  return `${FILE_SUMMARY_BASE_COLUMNS}, FALSE AS can_edit_control, FALSE AS required_reading, ${FILE_DERIVED_COLUMNS}`;
}

/**
 * A revisão vigente tem marcação de leitura obrigatória em curso (change
 * `superficies-de-pendencia`, design.md D4): marcação da **revisão atual**, de
 * documento não obsoleto — o complemento do ramo `closed` de
 * `READING_STATUS_SQL` (`lib/reading.ts`), para a marcação não ser "em curso"
 * num lugar e "encerrada" no outro.
 *
 * Só **descreve** uma linha que a consulta já devolve: entra na projeção, não
 * no `WHERE`, então não amplia alcance. A RLS de `reading_campaigns` limita a
 * subconsulta à unidade do contexto. As consultas que usam `fileSummaryColumns`
 * leem `FROM files` sem alias, e a correlação é por `files.id`.
 */
const REQUIRED_READING_SQL = `(files.lifecycle_state IS DISTINCT FROM '${DocumentLifecycleState.OBSOLETE}'
     AND EXISTS (SELECT 1 FROM reading_campaigns rc
                 WHERE rc.file_id = files.id AND rc.document_revision = files.document_revision))`;

export interface FileSummaryRow {
  id: string;
  owner_id: string;
  folder_id: string | null;
  file_name: string;
  content_type: string | null;
  size_bytes: string | null;
  status: string;
  created_at: string;
  document_type: string | null;
  document_code: string | null;
  document_revision: number | null;
  responsible_sector: string | null;
  /** `date` do Postgres — o driver entrega `Date` à meia-noite local. */
  next_review_at: Date | string | null;
  lifecycle_state: string | null;
  document_status: string;
  days_until_review: number | null;
  /**
   * US 10.9: estado do **cadastro**, não da transferência (ver `status`) nem
   * da revisão (`document_status` é derivado). Só vem nas consultas que leem
   * a linha inteira; nas de listagem a condição já chega em `document_status`.
   */
  awaiting_registration?: boolean;
  /** Só vem nas consultas de listagem (ver `fileSummaryColumns`). */
  can_edit_control?: boolean;
  /** Só vem nas consultas de listagem (ver `REQUIRED_READING_SQL`). */
  required_reading?: boolean;
}

/** Colunas de controle de uma linha de `files`, como o driver as entrega. */
export type ControlColumns = Pick<
  FileSummaryRow,
  | 'document_type'
  | 'document_code'
  | 'document_revision'
  | 'responsible_sector'
  | 'next_review_at'
  | 'lifecycle_state'
>;

/**
 * `YYYY-MM-DD` a partir do que o driver entregar. Coluna `date` vira `Date` à
 * meia-noite **local**, então os getters locais fazem o caminho de volta sem
 * deslocar o dia — `toISOString()` deslocaria para quem está a oeste de
 * Greenwich, transformando "vence em 01/03" em "28/02".
 */
function toIsoDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const mes = String(value.getMonth() + 1).padStart(2, '0');
  const dia = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${mes}-${dia}`;
}

/** Projeção única do resumo de arquivo, com os dados de controle. */
export function toFileSummaryResponse(row: FileSummaryRow): FileSummaryResponse {
  return {
    id: row.id,
    ownerId: row.owner_id,
    folderId: row.folder_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    documentType: (row.document_type as DocumentType | null) ?? null,
    documentCode: row.document_code,
    documentRevision: row.document_revision === null ? null : Number(row.document_revision),
    responsibleSector: row.responsible_sector,
    nextReviewAt: toIsoDate(row.next_review_at),
    lifecycleState: (row.lifecycle_state as DocumentLifecycleState | null) ?? null,
    documentStatus: row.document_status as DocumentStatus,
    daysUntilReview: row.days_until_review === null ? null : Number(row.days_until_review),
    // Ausente nas consultas que não são de listagem: ausência é "não
    // oferecer", nunca um `false` inventado sobre quem talvez possa.
    ...(row.can_edit_control === undefined ? {} : { canEditControl: row.can_edit_control }),
    ...(row.required_reading === undefined ? {} : { requiredReading: row.required_reading }),
  };
}

/**
 * Fragmento SQL que **retira** da listagem e da busca o documento declarado
 * obsoleto, para quem não é administrador da unidade (US 10.7, design.md D6).
 *
 * A regra é deliberadamente **restritiva**: só subtrai alcance, nunca concede
 * — por construção não consegue abrir furo de isolamento. Para o admin da
 * unidade da listagem resolve para `TRUE`, e o recorte por unidade continua
 * sendo o de `resourceScopeClause` (que para o `global_admin` compara
 * `unit_id` explicitamente): ser obsoleto nunca amplia alcance sobre conteúdo
 * de outra unidade.
 */
export function nonObsoleteClause(ctx: TenantContext): string {
  if (isAdminOfUnit(ctx, ctx.unitId)) return 'TRUE';
  return `lifecycle_state IS DISTINCT FROM '${DocumentLifecycleState.OBSOLETE}'`;
}

/**
 * Fragmento SQL que **retira** da listagem, da busca e do manifesto de
 * download o arquivo pendente de cadastro, para quem não é quem o enviou nem
 * administrador da unidade (US 10.9, design.md D3).
 *
 * Irmão de `nonObsoleteClause`, com uma diferença que merece ser lida com
 * atenção: **esta cláusula relaxa**. O obsoleto desaparece até para o dono;
 * o pendente **tem** de aparecer para quem o enviou, senão ninguém completa os
 * dados — e é o `OR owner_id = …` que expressa isso.
 *
 * Por que a relaxação não abre furo: o fragmento entra por `AND` **depois** de
 * `visibleResourceClause`, que já recortou por dono/concessão/admin **e por
 * unidade**. O ramo do dono só pode fazer reaparecer linha que a cláusula
 * externa já autorizou; e `owner_id = ctx.userId` nunca casa com arquivo de
 * outra unidade, porque uma pessoa pertence a uma unidade só.
 *
 * Dito de outro modo: a relaxação é sobre a **própria restrição**, não sobre o
 * alcance. Fica escrito aqui porque, diferente do obsoleto, a propriedade "só
 * subtrai" deixou de ser verificável por inspeção desta função e passou a
 * depender da composição — motivo pelo qual
 * `__tests__/pendente-de-cadastro-acesso.test.ts` cobre o caso cross-unit
 * explicitamente.
 *
 * `ownerIdParam` é o placeholder que a consulta já usa para `ctx.userId`
 * (mesmo padrão de `fileSummaryColumns`). Para admin da unidade o fragmento
 * resolve para `TRUE` e nem o referencia.
 *
 * O remetente é comparado pela **autoria** (`uploaded_by`), não pela posse
 * (change `posse-pelo-dono-da-pasta`, design.md D3): quem envia para a pasta
 * de outra pessoa não é o dono do arquivo.
 */
export function visibleRegistrationClause(ctx: TenantContext, ownerIdParam: string): string {
  if (isAdminOfUnit(ctx, ctx.unitId)) return 'TRUE';
  return `(awaiting_registration IS NOT TRUE OR uploaded_by = ${ownerIdParam})`;
}

/**
 * Dados de controle já validados. `undefined` em um campo significa "não
 * informado" e, na edição, **não mexe** no valor atual; `null` informado
 * explicitamente limpa o campo. A distinção é o que permite corrigir o
 * responsável sem apagar a data de revisão.
 */
export interface NormalizedDocumentControl {
  documentType?: DocumentType | null;
  documentCode?: string | null;
  documentRevision?: number | null;
  responsibleSector?: string | null;
  nextReviewAt?: string | null;
  lifecycleState?: DocumentLifecycleState | null;
}

export type ParseControlResult =
  | { ok: true; value: NormalizedDocumentControl }
  | { ok: false; error: 'invalid_document_type' }
  | { ok: false; error: 'invalid_request_body' }
  | { ok: false; error: 'document_control_required'; missing: (keyof DocumentControlInput)[] }
  | {
      ok: false;
      error: 'general_file_rejects_control_fields';
      rejected: (keyof DocumentControlInput)[];
    };

const CODE_MAX_LENGTH = 60;
const SECTOR_MAX_LENGTH = 120;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `true` só para uma data de calendário real — `2026-02-31` é recusada. */
function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [ano, mes, dia] = value.split('-').map(Number) as [number, number, number];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  );
}

function normalizeText(value: unknown, maxLength: number): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return false;
  return trimmed;
}

/**
 * Valida e normaliza os dados de controle vindos do cliente. Entrada de
 * usuário nunca é confiável por padrão: tipo e estado são conferidos contra o
 * enum compartilhado, a data contra o calendário, e a revisão contra inteiro
 * não negativo.
 *
 * `requireAll` liga a exigência da publicação unitária e nomeia o que falta
 * (US 10.5 cenário 1) — a edição posterior usa a mesma função sem exigência,
 * para preencher aos poucos o que o lote dispensou.
 */
export function parseDocumentControl(
  raw: unknown,
  { requireAll }: { requireAll: boolean },
): ParseControlResult {
  const input: DocumentControlInput =
    raw === undefined || raw === null ? {} : (raw as DocumentControlInput);
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'invalid_request_body' };
  }

  const value: NormalizedDocumentControl = {};

  if (input.documentType !== undefined) {
    if (input.documentType === null) {
      value.documentType = null;
    } else if (!DOCUMENT_TYPES.includes(input.documentType)) {
      return { ok: false, error: 'invalid_document_type' };
    } else {
      value.documentType = input.documentType;
    }
  }

  if (input.lifecycleState !== undefined) {
    if (input.lifecycleState === null) {
      value.lifecycleState = null;
    } else if (!DOCUMENT_LIFECYCLE_STATES.includes(input.lifecycleState)) {
      return { ok: false, error: 'invalid_request_body' };
    } else {
      value.lifecycleState = input.lifecycleState;
    }
  }

  const code = normalizeText(input.documentCode, CODE_MAX_LENGTH);
  if (code === false) return { ok: false, error: 'invalid_request_body' };
  if (code !== undefined) value.documentCode = code;

  const sector = normalizeText(input.responsibleSector, SECTOR_MAX_LENGTH);
  if (sector === false) return { ok: false, error: 'invalid_request_body' };
  if (sector !== undefined) value.responsibleSector = sector;

  if (input.documentRevision !== undefined) {
    if (input.documentRevision === null) {
      value.documentRevision = null;
    } else if (
      typeof input.documentRevision !== 'number' ||
      !Number.isInteger(input.documentRevision) ||
      input.documentRevision < 0
    ) {
      return { ok: false, error: 'invalid_request_body' };
    } else {
      value.documentRevision = input.documentRevision;
    }
  }

  if (input.nextReviewAt !== undefined) {
    if (input.nextReviewAt === null) {
      value.nextReviewAt = null;
    } else if (typeof input.nextReviewAt !== 'string' || !isRealIsoDate(input.nextReviewAt)) {
      return { ok: false, error: 'invalid_request_body' };
    } else {
      value.nextReviewAt = input.nextReviewAt;
    }
  }

  // US 10.8: Arquivo geral declara não ter código nem prazo, então informá-los
  // é contradição. Recusa **sempre**, inclusive na edição e no lote — não é
  // exigência de publicação, é coerência do tipo, e por isso fica fora do
  // `requireAll`.
  if (value.documentType === DocumentType.GENERAL_FILE) {
    const rejected = FIELDS_REJECTED_FOR_GENERAL_FILE.filter(
      (field) => value[field] !== undefined && value[field] !== null,
    );
    if (rejected.length > 0) {
      return { ok: false, error: 'general_file_rejects_control_fields', rejected: [...rejected] };
    }
  }

  if (requireAll) {
    const missing = requiredFieldsForType(value.documentType).filter(
      (field) => value[field] === undefined || value[field] === null,
    );
    if (missing.length > 0) {
      return { ok: false, error: 'document_control_required', missing: [...missing] };
    }
  }

  return { ok: true, value };
}

/**
 * Se um item de envio **nasce pendente de cadastro** (US 10.9): os dados já
 * passaram pela validação, mas falta algum dos exigidos pelo seu tipo.
 *
 * Separado de `parseDocumentControl` de propósito. A validação responde "este
 * dado é aceitável?", cuja resposta negativa **recusa** o item; esta responde
 * "este item está completo?", cuja resposta negativa o **aceita como
 * pendente**. Misturar as duas foi o que levou a dispensa do lote a existir
 * (design.md D6): sem a distinção, exigir implicaria recusar.
 */
export function isAwaitingRegistration(value: NormalizedDocumentControl): boolean {
  return requiredFieldsForType(value.documentType).some(
    (field) => value[field] === undefined || value[field] === null,
  );
}

/**
 * Coluna de `files` que guarda cada campo de controle. **Fonte única**: a rota
 * de edição monta o seu `SET` a partir deste mapa, e `rowAwaitsRegistration`
 * lê a linha por ele. Duas cópias divergiriam no dia em que um sexto campo
 * entrasse, e a divergência apareceria como arquivo publicado sem o campo
 * novo — não como erro.
 */
export const CONTROL_FIELD_COLUMN = {
  documentType: 'document_type',
  documentCode: 'document_code',
  documentRevision: 'document_revision',
  responsibleSector: 'responsible_sector',
  nextReviewAt: 'next_review_at',
  lifecycleState: 'lifecycle_state',
} as const satisfies Record<keyof NormalizedDocumentControl, string>;

/**
 * Se a **linha gravada** ainda aguarda cadastro (US 10.9, design.md D10).
 *
 * Avalia o estado resultante, não a requisição que o produziu. É o que permite
 * completar o cadastro aos poucos: quem informa o último campo que faltava
 * publica o arquivo sem reenviar os que já constavam. Avaliar a requisição
 * obrigaria a reinformar tudo só para provar que o conjunto está completo.
 */
export function rowAwaitsRegistration(row: ControlColumns): boolean {
  const colunas = row as unknown as Record<string, unknown>;
  const documentType = colunas[CONTROL_FIELD_COLUMN.documentType] as DocumentType | null;
  return requiredFieldsForType(documentType).some((field) => {
    const value = colunas[CONTROL_FIELD_COLUMN[field]];
    return value === undefined || value === null;
  });
}

/**
 * Documento **não excluído da mesma unidade** que já ocupa o código, ou
 * `null`. Comparação por `lower(...)`, igual ao índice único
 * `files_unit_document_code_uidx` — a leitura e a garantia precisam concordar,
 * senão a aplicação recusaria um caso que o banco aceitaria (ou o inverso).
 *
 * Roda na transação tenant já aberta, então a RLS por `unit_id` filtra por
 * baixo: o homônimo de outra unidade não aparece aqui e nada dele é revelado
 * (US 10.2 cenário 3).
 */
export async function findCodeOwner(
  client: PoolClient,
  code: string,
  options: { excludeFileId?: string } = {},
): Promise<{
  id: string;
  file_name: string;
  owner_id: string;
  uploaded_by: string;
  status: string;
} | null> {
  const params: string[] = [code];
  let exclusion = '';
  if (options.excludeFileId) {
    params.push(options.excludeFileId);
    exclusion = `AND id <> $${params.length}`;
  }
  const { rows } = await client.query<{
    id: string;
    file_name: string;
    owner_id: string;
    uploaded_by: string;
    status: string;
  }>(
    `SELECT id, file_name, owner_id, uploaded_by, status FROM files
     WHERE lower(document_code) = lower($1) AND deleted_at IS NULL ${exclusion}
     LIMIT 1`,
    params,
  );
  return rows[0] ?? null;
}

/**
 * `true` quando o erro do Postgres é a violação do índice único do código
 * (`23505` em `files_unit_document_code_uidx`). A checagem explícita de
 * `findCodeOwner` resolve o caso comum; esta é a rede para a **corrida** entre
 * duas requisições simultâneas, em que só o banco consegue decidir
 * (design.md D5).
 */
export function isDocumentCodeConflict(err: unknown): boolean {
  const candidate = err as { code?: unknown; constraint?: unknown } | null;
  return candidate?.code === '23505' && candidate?.constraint === 'files_unit_document_code_uidx';
}
