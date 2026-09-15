/** Ação de acesso a um arquivo — distingue visualizar de baixar na auditoria e no TTL. */
export const FileAccessAction = {
  VIEW: 'view',
  DOWNLOAD: 'download',
} as const;

export type FileAccessAction = (typeof FileAccessAction)[keyof typeof FileAccessAction];

export interface SignedUrlRequest {
  fileId: string;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
  action: FileAccessAction;
}

/**
 * Resposta de `POST /files/:id/view-url` (US 9.2 cenário 2, design.md D3):
 * ramo pré-visualizável é um superset aditivo de `SignedUrlResponse`; ramo
 * indisponível não emite URL e sinaliza a oferta de download conforme a
 * permissão do solicitante (design.md D5).
 */
export type ViewUrlResponse =
  | ({ previewAvailable: true } & SignedUrlResponse)
  | { previewAvailable: false; reason: 'unsupported_format'; download: { available: boolean } };

export interface UploadUrlRequest {
  fileName: string;
  contentType: string;
  declaredSizeBytes: number;
  /** Pasta de destino (da unidade do remetente); ausente = raiz da unidade. */
  folderId?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  objectPath: string;
  expiresAt: string;
}

/**
 * Notificação de finalização já normalizada para o formato interno consumido
 * pela reconciliação de cota. Em dev/E2E o endpoint recebe este payload direto;
 * em produção ele é derivado do envelope de push do Pub/Sub (ver abaixo).
 */
export interface StorageFinalizeNotification {
  bucket?: string;
  objectPath: string;
  sizeBytes: number;
}

/**
 * Envelope de entrega push do Pub/Sub. O corpo do POST tem a mensagem em
 * `message`, com o dado (metadata do objeto do GCS) codificado em base64 em
 * `data`. Ver https://cloud.google.com/pubsub/docs/push (formato do envelope).
 */
export interface PubSubPushEnvelope {
  message: {
    data: string;
    attributes?: Record<string, string>;
    messageId?: string;
    message_id?: string;
    publishTime?: string;
    publish_time?: string;
  };
  subscription?: string;
}

/**
 * Metadata do objeto do GCS entregue pela notificação com
 * `payload_format = "JSON_API_V1"` (infra/terraform/pubsub.tf). Só os campos
 * que a reconciliação usa são modelados; `name` é a chave do objeto dentro do
 * bucket (`{unit_id}/{owner_id}/{uuid}`), igual ao `object_path` gravado em
 * `files`, e `size` vem como string (int64 serializado em JSON).
 */
export interface GcsObjectMetadata {
  name: string;
  bucket: string;
  size: string;
  contentType?: string;
}

/** Resumo de arquivo usado na listagem de conteúdo de pasta (navegação). */
export interface FileSummaryResponse {
  id: string;
  ownerId: string;
  folderId: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
}

export interface RenameFileRequest {
  fileName: string;
}

export interface ReplaceFileRequest {
  contentType: string;
  declaredSizeBytes: number;
}

/** Mesmo formato de `UploadUrlResponse`: URL assinada de PUT para o novo `object_path`. */
export type ReplaceFileResponse = UploadUrlResponse;

export interface BatchUploadItemRequest {
  fileName: string;
  contentType: string;
  declaredSizeBytes: number;
  /** Subpasta relativa ao destino (ex.: "Relatorios/2024"); ausente = direto no destino. */
  relativePath?: string;
}

export interface BatchUploadUrlRequest {
  /** Pasta-âncora (da unidade do remetente, da qual o remetente precisa ser dono); ausente = raiz da unidade. */
  destinationFolderId?: string;
  items: BatchUploadItemRequest[];
}

export interface BatchUploadItemSuccess {
  fileName: string;
  ok: true;
  uploadUrl: string;
  objectPath: string;
  folderId: string | null;
  expiresAt: string;
}

export interface BatchUploadItemFailure {
  fileName: string;
  ok: false;
  error: string;
}

/** Resultado por item, na mesma ordem de `BatchUploadUrlRequest.items` (design.md D1/D5). */
export type BatchUploadItemResult = BatchUploadItemSuccess | BatchUploadItemFailure;

export interface BatchUploadUrlResponse {
  results: BatchUploadItemResult[];
}

/**
 * Recusa por teto de itens por requisição de envio em lote
 * (`UPLOAD_BATCH_MAX_ITEMS`, `apps/api/src/config.ts`), no molde de
 * `MoveBatchLimitExceededResponse` e
 * `FolderDownloadManifestLimitExceededResponse` (change
 * `corrige-defeitos-envio-lote`, design.md D2). Distinta dos erros **por
 * item** de `BatchUploadItemFailure`: esta recusa o lote inteiro, antes de
 * qualquer efeito — nenhuma linha `pending`, nenhuma pasta, nenhuma URL.
 */
export interface UploadBatchLimitExceededResponse {
  error: 'upload_batch_limit_exceeded';
  found: number;
  allowed: number;
}

/**
 * Valor padrão do teto de itens por requisição de envio em lote
 * (`UPLOAD_BATCH_MAX_ITEMS`, `apps/api/src/config.ts`). Compartilhado com a
 * SPA para a recusa acontecer **antes** da requisição, sem endpoint de
 * leitura novo — mesmo padrão de `MOVE_BATCH_MAX_ITEMS_DEFAULT`. Se a
 * implantação sobrescrever a variável de ambiente, o cliente segue orientado
 * por este padrão até a primeira resposta do servidor, cujo `allowed` é
 * sempre a fonte da verdade.
 */
export const UPLOAD_BATCH_MAX_ITEMS_DEFAULT = 500;

/**
 * Recusas de leitura do corpo da requisição, propagadas com status próprio
 * pelo tratador de erro da API em vez do 500 genérico (change
 * `corrige-defeitos-envio-lote`, design.md D1). A superfície é fechada: só
 * estas duas classes, reconhecidas pelo `err.type` do `body-parser`, mudam o
 * status — a mensagem do erro original nunca é repassada.
 */
export interface RequestBodyTooLargeResponse {
  error: 'request_body_too_large';
}

export interface InvalidJsonResponse {
  error: 'invalid_json';
}

/**
 * Resposta de `GET /files/quota` (change `envio-multiplas-pastas-com-prechecagem`,
 * design.md D2) — espaço de armazenamento **do próprio solicitante**, nunca de
 * terceiro: a identidade vem só da sessão e a rota não aceita identificador de
 * pessoa. Não é rota de painel e não agrega unidade; o bypass de `global_admin`
 * não se aplica (cota é dado de pessoa, não agregado).
 *
 * `trashedBytes` é **decomposição explicativa** de `usedBytes`, e **não** é
 * subtraído de `availableBytes`: um arquivo na lixeira continua contando em
 * `users.storage_used_bytes` até o job `purge-trash` expurgá-lo por retenção.
 * Descontá-lo de novo inflaria o disponível e produziria uma promessa falsa —
 * ele existe para **explicar onde o espaço está preso**, não para entrar na
 * conta.
 *
 * `availableBytes = quotaBytes − usedBytes − pendingBytes`, com `pendingBytes`
 * refletindo a mesma reserva consciente do lote já aplicada na emissão de URLs
 * (`POST /files/upload-urls`).
 *
 * É um **retrato do instante**, nunca garantia de aceitação: entre a consulta e
 * o fim de um envio de dezenas de minutos, outra aba pode consumir espaço. A
 * guarda continua sendo o servidor, avaliada em transação a cada pedido de URLs.
 */
export interface StorageQuotaResponse {
  /** Cota total por pessoa (`config.storageQuotaBytesPerUser`). */
  quotaBytes: number;
  /** `users.storage_used_bytes` — já inclui o retido na lixeira. */
  usedBytes: number;
  /** Soma dos arquivos do solicitante na lixeira; decomposição de `usedBytes`, não descontada do disponível. */
  trashedBytes: number;
  /**
   * Quantidade de arquivos do solicitante na lixeira — o par de contagem de
   * `trashedBytes` (change `esvaziar-lixeira`, design.md D4: a confirmação do
   * expurgo precisa dizer **quantos** arquivos e **quanto** espaço, e os dois
   * números vêm da mesma leitura).
   */
  trashedFiles: number;
  /** Soma dos arquivos em `pending`/`replacing` — reserva de envios não reconciliados. */
  pendingBytes: number;
  /** `quotaBytes − usedBytes − pendingBytes`, nunca negativo. */
  availableBytes: number;
}

/**
 * Tetos de uma **fatia** de envio (change `envio-multiplas-pastas-com-prechecagem`,
 * design.md D5). São tetos **do cliente**: a API vê requisições, nunca "o
 * envio", e portanto não consegue — nem deve — impor teto sobre um conjunto que
 * não observa. O teto por requisição segue validado no servidor
 * (`upload_batch_limit_exceeded`), e a guarda real do conjunto é a **cota**,
 * que é autoritativa e já soma pendentes. Mesmo precedente do manifesto de
 * download: "o limite protege a memória do cliente, não o servidor".
 *
 * 200 itens: no pior caso medido (153 bytes por item, nome real com subpasta)
 * a fatia pesa ~30 KB de corpo — folga de 30× contra o teto de 1 MB do parser,
 * e bem abaixo de `UPLOAD_BATCH_MAX_ITEMS_DEFAULT` (500) por requisição.
 */
export const UPLOAD_SLICE_MAX_ITEMS_DEFAULT = 200;

/**
 * 500 MB por fatia: numa conexão ruim de 2 Mbps, 500 MB levam ~35 min, dentro
 * do prazo de 60 min da URL de envio (`signedUrlUploadTtlSeconds`). É o teto
 * que impede uma fatia de arquivos pesados de vencer antes de terminar — o de
 * itens sozinho não cobre acervos de escaneados. Ver `UPLOAD_SLICE_MAX_ITEMS_DEFAULT`
 * para a natureza (cliente) destes tetos.
 */
export const UPLOAD_SLICE_MAX_BYTES_DEFAULT = 500 * 1024 * 1024;
