import type { FileSummaryResponse } from './storage.js';
import type { FolderResponse } from './folders.js';
import type { GrantResourceType } from './permissions.js';

/** Item na lixeira — sempre uma raiz de exclusão (design.md D9). */
export interface TrashEntryResponse {
  id: string;
  type: GrantResourceType;
  name: string;
  deletedAt: string;
  expiresAt: string;
}

export interface TrashListResponse {
  items: TrashEntryResponse[];
}

/**
 * Resposta de `POST /files/:id/restore`. `redirectedToRoot` sinaliza o caso
 * em que a pasta de origem não existe mais (ancestral expurgado) e o
 * arquivo voltou à raiz da unidade em vez do `folderId` original
 * (design.md D5).
 */
export interface FileRestoreResponse extends FileSummaryResponse {
  redirectedToRoot: boolean;
}

/** Resposta de `POST /folders/:id/restore` — pasta nunca muda de local ao restaurar. */
export type FolderRestoreResponse = FolderResponse;

/**
 * Resposta de `POST /trash/purge` (change `esvaziar-lixeira`) — expurgo
 * imediato dos **arquivos do próprio solicitante** que estão na lixeira.
 * `failedFiles` existe porque a operação é tolerante a falha por item: o que
 * falhou permanece íntegro na lixeira e reentra no ciclo do job.
 */
export interface TrashPurgeResponse {
  /** Arquivos apagados permanentemente. */
  purgedFiles: number;
  /** Soma dos `size_bytes` dos arquivos apagados — cota devolvida ao dono. */
  reclaimedBytes: number;
  /** Arquivos que falharam e continuam na lixeira. */
  failedFiles: number;
}
