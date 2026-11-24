import type { FileSummaryResponse } from './storage.js';

/**
 * Documentos alterados recentemente (US 11.2, change `shell-e-inicio`).
 *
 * `changedAt` é **derivado**, não uma coluna (design.md D1): é o mais recente
 * entre `files.created_at` (a publicação) e os eventos de `audit_events` cujas
 * ações alteram o documento — `replace`, `rename`, `move`. Nenhuma coluna
 * `updated_at` foi criada: um carimbo teria de ser lembrado em todo caminho de
 * escrita, e o caminho esquecido falharia em silêncio.
 *
 * Ações de **leitura** (`view`, `download`) não produzem linha aqui: elas não
 * alteram o documento, e incluí-las transformaria a lista em histórico de
 * navegação — que é outra coisa (design.md, Non-Goals).
 */
export interface RecentDocumentResponse extends FileSummaryResponse {
  /** Instante da alteração mais recente do documento, em ISO 8601. */
  changedAt: string;
  /** Nome da pasta que contém o documento; `null` = raiz da unidade. */
  folderName: string | null;
}

/** `GET /files/recent` — recorte curto, sem paginação (design.md, Non-Goals). */
export interface RecentDocumentsResponse {
  documents: RecentDocumentResponse[];
}

/**
 * `GET /files/recent/new-count` — documentos **publicados** na janela (padrão:
 * 7 dias) ao alcance de quem consulta (change `conteudo-da-tela-inicio`,
 * design.md D1–D3).
 *
 * `capped` = a apuração parou no teto de candidatos: `count` é então um piso,
 * e a interface escreve "mais de N" — nunca apresenta o teto como contagem
 * exata.
 */
export interface NewDocumentsCountResponse {
  days: number;
  count: number;
  capped: boolean;
}
