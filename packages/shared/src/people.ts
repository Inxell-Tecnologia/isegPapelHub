import type { UserRole } from './roles.js';

/** Status de conta de pessoa — desativar preserva arquivos e auditoria, só bloqueia login. */
export const PersonStatus = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type PersonStatus = (typeof PersonStatus)[keyof typeof PersonStatus];

export interface CreatePersonRequest {
  fullName: string;
  email: string;
  password: string;
  /** Ignorado para `unit_admin` (forçado à própria unidade); obrigatório em espírito para `global_admin`. */
  unitId?: string;
  role?: UserRole;
  phone?: string;
  jobTitle?: string;
  workArea?: string;
  notes?: string;
}

export interface UpdatePersonRequest {
  fullName?: string;
  phone?: string;
  jobTitle?: string;
  workArea?: string;
  notes?: string;
  role?: UserRole;
  status?: PersonStatus;
  /**
   * Exceção nominal de cota, em **bytes** (change `cota-por-usuario`,
   * design.md D7/D8). Três intenções distintas, e a distinção é significativa:
   *
   * - campo **ausente** (`undefined`) → não mexe na cota;
   * - `null` → remove a exceção, devolvendo a pessoa ao padrão da plataforma
   *   (sem exigir que quem chama conheça o valor do padrão);
   * - inteiro ≥ 0 → define a exceção nominal. Zero é válido e significa
   *   "nenhum envio novo", coerente com design.md D5.
   *
   * Só `global_admin` pode enviá-lo: a presença do campo sem o papel recusa a
   * requisição **inteira** (design.md D3, fail-closed).
   */
  storageQuotaBytes?: number | null;
}

export interface PersonResponse {
  id: string;
  unitId: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  workArea: string | null;
  notes: string | null;
  role: UserRole;
  status: PersonStatus;
  createdAt: string;
  /**
   * Volume já utilizado pela pessoa, em bytes — o mesmo contador que governa o
   * bloqueio de envio, nunca um recálculo próprio. Existe para que a
   * administração decida sobre cota vendo o consumo (design.md D5).
   */
  storageUsedBytes: number;
  /**
   * Exceção nominal de cota em bytes, ou `null` quando a pessoa segue o padrão
   * da plataforma. `null` é um estado distinto de uma exceção cujo valor
   * coincida com o padrão.
   */
  storageQuotaBytes: number | null;
}
