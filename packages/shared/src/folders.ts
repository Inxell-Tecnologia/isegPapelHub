import type { FileSummaryResponse } from './storage.js';

export interface CreateFolderRequest {
  name: string;
  /** Pasta-pai (da qual o remetente precisa ser dono); ausente = raiz da unidade. */
  parentId?: string;
}

export interface FolderResponse {
  id: string;
  unitId: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
}

/**
 * Subpasta como aparece na listagem de conteúdo (`FolderContentsResponse.folders`),
 * com a contagem de documentos que o solicitante pode abrir **na pasta e nas
 * subpastas que ele alcança** — subpasta sem acesso fica de fora com toda a
 * descendência (change `contagem-de-documentos-na-subarvore`, design.md D1/D4;
 * antes, `contagem-de-documentos-nas-pastas`; US 11.1, cenário 3). A API desta versão sempre envia o campo; ele é opcional no
 * contrato pela mesma razão de `favoriteFolderIds` — uma API anterior não o
 * envia, e ausência é "contagem desconhecida" (a SPA omite a linha), nunca zero.
 */
export interface FolderListItemResponse extends FolderResponse {
  documentCount?: number;
}

/**
 * `POST /files/:id/move` e `POST /folders/:id/move` (US 2.3, design.md D1).
 * `destinationFolderId` é sempre **presente**, nunca opcional: `null` SHALL
 * significar a raiz da unidade, e o servidor precisa distinguir esse caso de
 * "campo ausente" — um DTO com `?` deixaria `undefined` e `null` indistintos
 * do lado de quem recebe.
 */
export interface MoveItemRequest {
  destinationFolderId: string | null;
}

/** `PATCH /folders/:id` (US 2.3) — espelha `RenameFileRequest` (`storage.ts`). */
export interface RenameFolderRequest {
  name: string;
}

/**
 * `POST /files/move` e `POST /folders/move` (US 2.4, design.md D1/D2 do
 * change `mover-itens-em-lote`): mesmo destino para vários itens numa única
 * operação. `destinationFolderId` segue a mesma convenção de
 * `MoveItemRequest` — `null` explícito é sempre a raiz da unidade.
 */
export interface MoveBatchRequest {
  ids: string[];
  destinationFolderId: string | null;
}

export interface MoveBatchItemSuccess {
  id: string;
  ok: true;
}

export interface MoveBatchItemFailure {
  id: string;
  ok: false;
  error: string;
}

/** Veredito por identificador, no molde de `BatchUploadItemResult` (design.md D2). */
export type MoveBatchItemResult = MoveBatchItemSuccess | MoveBatchItemFailure;

export interface MoveBatchResponse {
  results: MoveBatchItemResult[];
}

/**
 * Recusa por teto de itens por operação (design.md D1), no molde de
 * `GrantSubjectsLimitExceededResponse`/`FolderDownloadManifestLimitExceededResponse`.
 */
export interface MoveBatchLimitExceededResponse {
  error: 'move_batch_limit_exceeded';
  found: number;
  allowed: number;
}

/**
 * Valor padrão do teto de itens por operação de mover em lote
 * (`MOVE_BATCH_MAX_ITEMS`, `apps/api/src/config.ts`). Compartilhado com a
 * SPA para a recusa de envio acontecer **antes** da requisição (tasks.md
 * 7.4), sem abrir endpoint de leitura novo (design.md, Goals: "custar zero em
 * infraestrutura") — se a implantação sobrescrever a variável de ambiente
 * para outro valor, o cliente segue orientado por este padrão até a primeira
 * resposta do servidor, cujo `allowed` de `MoveBatchLimitExceededResponse` é
 * sempre a fonte da verdade.
 */
export const MOVE_BATCH_MAX_ITEMS_DEFAULT = 100;

/**
 * Recusa identificável de `POST /folders/:id/move` e `PATCH /folders/:id`
 * (design.md D4/D5): já existe pasta viva de mesmo nome no destino/pai.
 */
export interface FolderNameConflictResponse {
  error: 'folder_name_conflict';
}

/**
 * Recusa identificável de `POST /folders/:id/move` (design.md D3): o destino
 * é a própria pasta ou pertence à sua subárvore.
 */
export interface FolderCycleResponse {
  error: 'folder_cycle';
}

/** `GET /folders/root/contents` e `GET /folders/:id/contents` — conteúdo só-por-dono + trilha. */
export interface FolderContentsResponse {
  /** `null` na raiz da unidade. */
  folder: FolderResponse | null;
  /** Da raiz até a pasta corrente; vazio na raiz. */
  breadcrumb: FolderResponse[];
  folders: FolderListItemResponse[];
  files: FileSummaryResponse[];
  /**
   * Veredito do verbo `upload` sobre a pasta corrente, **resolvido pelo
   * servidor** (change `identidade-visual-isetes`, design.md D10).
   *
   * Existe porque o requisito "Pasta sem conteúdo orienta em vez de
   * apresentar tabela vazia" exige que a ação oferecida respeite "a
   * permissão já resolvida pelo servidor", e a capability `web-navegacao`
   * **proíbe** a SPA de inferir permissão no cliente. Sem este campo as duas
   * regras seriam inconciliáveis: o dono e o admin da unidade são deriváveis
   * do DTO, mas quem tem a concessão `upload` sobre pasta de outra pessoa
   * não é — e ficaria sem a ação que o servidor lhe autoriza.
   *
   * Não é linha de defesa: o 403 da rota de envio continua sendo a
   * autorização real. Serve só para a interface não oferecer o que o
   * servidor recusaria, nem esconder o que ele permitiria. Na raiz da
   * unidade é sempre `true` — a raiz não é recurso concedível, e enviar para
   * ela é livre a qualquer pessoa autenticada.
   */
  canUpload: boolean;
  /**
   * `true` quando quem consulta é o **dono** da pasta corrente (na raiz,
   * sempre `true`). Diz à SPA se um envio para cá consome o espaço do próprio
   * solicitante ou o do dono da pasta (change `posse-pelo-dono-da-pasta`,
   * design.md D6) — sem revelar nada da cota do dono. Opcional no contrato:
   * ausência é tratada como `true` (comportamento anterior).
   */
  ownedByRequester?: boolean;
  /**
   * Ids das pastas e dos arquivos **desta listagem** que são favoritos de quem
   * consulta (change `favoritos`, design.md D5) — para o explorador oferecer
   * "Favoritar" ou "Remover dos favoritos" sem cruzar a página com a lista
   * inteira. Lido na mesma transação, restrito aos ids já listados: não amplia
   * nada. Opcionais no contrato porque uma API anterior a esta change não os
   * envia — ausência é "nada é favorito", nunca erro.
   */
  favoriteFolderIds?: string[];
  favoriteFileIds?: string[];
  /**
   * Pasta alcançada por **compartilhamento entre unidades** (change
   * `compartilhamento-entre-unidades`, design.md D6): navegação somente
   * leitura. Ausente/`false` em toda listagem da própria unidade.
   */
  readOnly?: boolean;
  /** Unidade de origem do conteúdo quando `readOnly`; ausente nos demais casos. */
  sharedFrom?: { unitId: string; unitName: string } | null;
  /**
   * Veredito do verbo `download` sobre o conteúdo compartilhado, resolvido
   * pelo servidor (só quando `readOnly`): a SPA oferece "Baixar" apenas se
   * verdadeiro, sem inferir permissão no cliente.
   */
  canDownload?: boolean;
}

/** Um arquivo do manifesto de download de pasta (design.md D1/D7 de `download-pasta-zip`). */
export interface FolderDownloadManifestEntry {
  /** Caminho relativo à pasta solicitada, com a hierarquia de subpastas preservada. */
  relativePath: string;
  fileName: string;
  sizeBytes: number;
  /** URL assinada de download, mesmo TTL já praticado pelo download unitário. */
  url: string;
  expiresAt: string;
}

/**
 * `POST /folders/:id/download-manifest` (US 3.3, design.md D1/D3): o cliente
 * compacta a partir deste manifesto — a API nunca produz o `.zip`.
 * `totalFiles`/`allowedFiles` sempre presentes, mesmo quando `allowedFiles`
 * é 0, para que a interface distinga recorte parcial de pacote vazio.
 */
export interface FolderDownloadManifestResponse {
  entries: FolderDownloadManifestEntry[];
  totalFiles: number;
  allowedFiles: number;
  totalBytes: number;
}

/**
 * Recusa por limite (design.md D5): identifica **qual** teto foi atingido,
 * com o valor encontrado e o permitido, para a interface orientar a baixar
 * subpastas separadamente em vez de mostrar um erro genérico.
 */
export interface FolderDownloadManifestLimitExceededResponse {
  error: 'download_manifest_limit_exceeded';
  limit: 'maxFiles' | 'maxBytes';
  found: number;
  allowed: number;
}
