import type { PoolClient } from 'pg';
import type { UserRole } from '@gdoc/shared';

export interface TenantContext {
  unitId: string;
  userId: string;
  role: UserRole;
}

/**
 * Visita de leitura a outra unidade (change `compartilhamento-entre-unidades`,
 * design.md D3): `originUnitId` é a unidade dona do conteúdo compartilhado.
 * Nunca vem de valor informado pelo solicitante — só de um compartilhamento
 * vigente lido no contexto da própria pessoa.
 */
export interface SharedVisit {
  userId: string;
  originUnitId: string;
}

/** Papel publicado na transação de visita — não é `global_admin`, logo sem bypass de RLS. */
export const SHARED_VISITOR_ROLE = 'shared_visitor';

/**
 * DatabasePort — mesmo Postgres em dev e prod. A parte relevante do seam é
 * garantir que toda query tenant-scoped rode dentro de uma transação com
 * `SET LOCAL app.current_unit` / `app.user_role`, para que a RLS do banco
 * seja a linha de defesa real (ver migrations 0002_enable_rls.sql).
 */
export interface DatabasePort {
  /** Executa `fn` dentro de uma transação com o contexto de tenant aplicado via SET LOCAL. */
  withTenantTransaction<T>(ctx: TenantContext, fn: (client: PoolClient) => Promise<T>): Promise<T>;

  /**
   * Transação de visita (design.md D3): `app.current_unit` = unidade de
   * origem, `app.user_role` = `shared_visitor` (sem bypass), e
   * `app.current_user_id` = a pessoa. A RLS confina a transação à unidade de
   * origem. **Só `lib/cross-unit-share.ts` chama este método** — um teste de
   * arquitetura garante.
   */
  withSharedVisitTransaction<T>(
    visit: SharedVisit,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T>;

  /** Executa `fn` dentro de uma transação sem contexto de tenant (uso interno/migrações). */
  withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;

  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;

  close(): Promise<void>;
}
