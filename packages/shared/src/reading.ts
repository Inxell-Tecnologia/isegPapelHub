import type { UserRole } from './roles.js';
import type { FileSummaryResponse } from './storage.js';

/**
 * Leitura obrigatória (Épico 12, change `leitura-obrigatoria`).
 *
 * Prazo padrão da marcação e da pendência de quem entra depois no público
 * (demanda nº 2, seções 3.2 e 3.3).
 */
export const READING_DEFAULT_DUE_DAYS = 15;

/** Critério do público, combinado por "ou", dentro da unidade do documento (design.md D2). */
export interface ReadingAudience {
  wholeUnit: boolean;
  sectorIds: string[];
  roles: UserRole[];
  userIds: string[];
}

/** Situação derivada na consulta (design.md D3). */
export const ReadingStatus = {
  PENDING: 'pending',
  LATE: 'late',
  DONE: 'done',
  CLOSED: 'closed',
} as const;
export type ReadingStatus = (typeof ReadingStatus)[keyof typeof ReadingStatus];

/** Resumo de uma marcação. */
export interface ReadingCampaignResponse {
  id: string;
  fileId: string;
  documentRevision: number;
  documentCode: string;
  documentTitle: string;
  audience: ReadingAudience;
  /** `YYYY-MM-DD`. */
  dueDate: string;
  message: string | null;
  createdAt: string;
  /** Pessoas com atribuição nesta marcação. */
  assignedCount: number;
}

/** Motivo de o documento não poder ser marcado (design.md D5). */
export type ReadingIneligibleReason = 'not_controlled' | 'not_in_force' | 'not_previewable';

/** `GET /reading/files/:fileId` — estado da leitura obrigatória de um arquivo. */
export interface ReadingFileStateResponse {
  /** Quem pede pode marcar (mesmo verbo de editar os dados de controle — design.md D4). */
  canMark: boolean;
  /** `null` = elegível. */
  ineligibleReason: ReadingIneligibleReason | null;
  currentRevision: number | null;
  /** Marcação da revisão vigente, se houver. */
  current: ReadingCampaignResponse | null;
  /** Marcação mais recente de revisão anterior, para pedir nova ciência (design.md D9). */
  previous: ReadingCampaignResponse | null;
}

/** `GET /reading/files/:fileId/audience-options` (design.md D8). */
export interface ReadingAudienceOptionsResponse {
  sectors: { id: string; name: string }[];
  people: { id: string; name: string; sectorName: string | null }[];
}

/** `POST /reading/preview`. */
export interface ReadingPreviewRequest {
  fileId: string;
  audience: ReadingAudience;
}
export interface ReadingPreviewResponse {
  count: number;
}

/** `POST /reading/campaigns`. */
export interface CreateReadingCampaignRequest {
  fileId: string;
  audience: ReadingAudience;
  /** `YYYY-MM-DD`; ausente = hoje + `READING_DEFAULT_DUE_DAYS`. */
  dueDate?: string;
  message?: string;
}

/** Uma leitura da própria pessoa (`GET /reading/mine`). */
export interface MyReadingResponse {
  assignmentId: string;
  campaignId: string;
  status: ReadingStatus;
  dueDate: string;
  acknowledgedAt: string | null;
  documentRevision: number;
  documentCode: string;
  documentTitle: string;
  message: string | null;
  /**
   * Resumo do arquivo para abrir no visualizador; `null` quando a leitura está
   * encerrada (documento excluído, obsoleto ou substituído) ou concluída numa
   * revisão que já não é a vigente.
   */
  file: FileSummaryResponse | null;
}

export interface MyReadingsResponse {
  items: MyReadingResponse[];
}

/** Recusas próprias da marcação. */
export type ReadingErrorCode =
  | 'not_eligible'
  | 'already_marked'
  | 'empty_audience'
  | 'invalid_audience'
  | 'invalid_due_date'
  | 'not_pending';

/**
 * Recorte de uma marcação no acompanhamento (change
 * `acompanhamento-de-leituras`, design.md D1): `full` = o público inteiro
 * (publicador, gestor da unidade, todas as unidades); `sector` = só as pessoas
 * do setor do gestor.
 */
export type OversightScope = 'full' | 'sector';

/** Uma marcação no acompanhamento, com os números de 3.5 (design.md D2). */
export interface OversightCampaignResponse {
  id: string;
  unitId: string;
  unitName: string;
  documentCode: string;
  documentTitle: string;
  documentRevision: number;
  /** `YYYY-MM-DD` — prazo da marcação. */
  dueDate: string;
  createdAt: string;
  /** Revisão marcada ainda é a vigente de documento não obsoleto nem excluído. */
  inProgress: boolean;
  scope: OversightScope;
  /** Nome do setor quando `scope = 'sector'`. */
  scopeSectorName: string | null;
  total: number;
  done: number;
  pending: number;
  late: number;
  closed: number;
  /** Confirmados ÷ público, em %, arredondada; `null` sem público. */
  adherence: number | null;
}

export interface OversightListResponse {
  /** A pessoa tem algo a acompanhar: decide se a aba aparece (design.md D4). */
  available: boolean;
  campaigns: OversightCampaignResponse[];
}

/** Pessoa da lista nominal (design.md D5): nome, unidade e setor — nada mais. */
export interface OversightPersonResponse {
  assignmentId: string;
  name: string;
  unitName: string;
  /** Setor do momento da ciência para quem confirmou; o atual para os demais. */
  sectorName: string | null;
  status: ReadingStatus;
  dueDate: string;
  acknowledgedAt: string | null;
}

export interface OversightReportResponse {
  campaign: OversightCampaignResponse;
  people: OversightPersonResponse[];
}
