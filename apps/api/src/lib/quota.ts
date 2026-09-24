import { config } from '../config.js';

/**
 * Resolução da **cota efetiva** de armazenamento de uma pessoa (change
 * `cota-por-usuario`, design.md D1/D2; spec `cota-individual`).
 *
 * Regra única, e este é o único lugar que a conhece — no mesmo espírito de
 * `lib/access.ts` ser o único a conhecer a regra de acesso: **exceção nominal
 * quando houver, padrão da plataforma quando não houver**. Nenhuma rota repete
 * `COALESCE` ou `?? config...` por conta própria; quem precisa da cota chama
 * daqui.
 *
 * `storage_quota_bytes IS NULL` significa "segue o padrão da plataforma", e é
 * um estado **distinto** de uma exceção cujo valor coincida com o padrão:
 * mudar `STORAGE_QUOTA_BYTES_PER_USER` alcança na hora quem está em `NULL` e
 * não toca em quem tem exceção.
 */

/** Recorte mínimo da linha de `users` que a resolução precisa. */
export interface QuotaRow {
  /** `bigint` do Postgres chega como string no driver; `null` = padrão da plataforma. */
  storage_quota_bytes: string | number | null;
}

/** Colunas de `users` a incluir na query de quem for decidir sobre espaço. */
export const QUOTA_COLUMNS = 'storage_used_bytes, storage_quota_bytes';

/**
 * Cota efetiva em bytes da pessoa cuja linha foi lida. Linha ausente cai no
 * padrão da plataforma — fail-safe coerente com o resto: a decisão de espaço
 * nunca fica sem limite por falta de linha.
 */
export function resolveQuotaBytes(row: QuotaRow | null | undefined): number {
  const raw = row?.storage_quota_bytes;
  if (raw === null || raw === undefined) return config.storageQuotaBytesPerUser;
  return Number(raw);
}

/**
 * Padrão da plataforma, para quem precisa dele **explicitamente** — o painel,
 * que agrega com `COALESCE` no SQL e recebe este valor como parâmetro, e a
 * resposta da consulta de espaço. Nunca vira `DEFAULT` de coluna: o padrão mora
 * na configuração da aplicação, e duplicá-lo no schema criaria duas fontes da
 * verdade que divergem no primeiro `terraform apply` (design.md D2).
 */
export function platformDefaultQuotaBytes(): number {
  return config.storageQuotaBytesPerUser;
}

/**
 * Validação do valor recebido na concessão (design.md D8). `null` é válido e
 * significa "remove a exceção"; zero é válido e significa "nenhum envio novo",
 * coerente com D5 (rebaixar abaixo do consumo é permitido). Negativo, não
 * inteiro e não numérico são recusados.
 */
export function isValidQuotaInput(value: unknown): value is number | null {
  if (value === null) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
