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
  folders: FolderResponse[];
  files: FileSummaryResponse[];
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
