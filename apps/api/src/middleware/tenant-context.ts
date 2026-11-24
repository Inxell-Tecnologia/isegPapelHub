import type { ReadingOversight } from '@gdoc/shared';
import type { Request, Response, NextFunction } from 'express';
import type { TenantContext } from '../ports/database-port.js';
import type { Ports } from '../ports/index.js';
import { SESSION_COOKIE_NAME } from '../lib/session-cookie.js';

/**
 * Nome da pessoa e da sua unidade, resolvidos na **mesma** releitura que
 * popula `tenantContext` (change `shell-e-inicio`, design.md D3). Separado de
 * `TenantContext` de propósito: aquele é o contexto de isolamento que vai para
 * o `SET LOCAL` de toda transação, e não é lugar de dado de apresentação.
 *
 * `fullName` vazio = conta sem nome cadastrado; nunca o identificador interno.
 *
 * `jobTitle` e `sectorName` entram pela change `funcao-e-setor-na-identidade`
 * (design.md D5) e seguem a mesma convenção: **vazio** quando o cadastro não
 * tem o dado, nunca `null` e nunca campo ausente — a forma da resposta não
 * depende do preenchimento. São o que a interface apresenta no lugar do papel
 * de acesso (`docs/respostas_a1_funcao_e_setor.txt`, resposta 1a).
 */
export interface IdentityDisplay {
  fullName: string;
  unitName: string;
  jobTitle: string;
  sectorName: string;
  /** Change `tour-guiado`, design.md D4 — mesma releitura, nenhum round-trip a mais. */
  tourCompleted: boolean;
  /**
   * Alcance do acompanhamento de leituras (change `gestor-de-acompanhamento`,
   * design.md D6) — relido aqui para que retirar a marcação valha na
   * requisição seguinte, como desativar a conta.
   */
  readingOversight: ReadingOversight | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    tenantContext?: TenantContext;
    identityDisplay?: IdentityDisplay;
  }
}

const BOOTSTRAP_UNIT = '00000000-0000-0000-0000-000000000000';

/**
 * Resolve a identidade autenticada da requisição (sessão em cookie
 * `HttpOnly`, ver routes/auth.ts) e popula `req.tenantContext`.
 *
 * `unit_id`, papel e status são relidos do banco a cada requisição — nunca
 * confiados do token — para que desativar uma conta encerre o acesso de
 * imediato, mesmo com uma sessão ainda não expirada em mãos (US 1.2,
 * cenário 3; design.md Decisão D1).
 *
 * O nome da pessoa, o da sua unidade, a sua função e o seu setor saem da
 * **mesma** leitura, em `req.identityDisplay` (change `shell-e-inicio`,
 * design.md D3; função e setor pela change `funcao-e-setor-na-identidade`,
 * design.md D5): é o que faz um nome ou um cargo alterado no cadastro aparecer
 * na requisição seguinte sem novo login, pela mesma razão que a releitura
 * existe. Nenhum round-trip extra — só colunas a mais e um `LEFT JOIN` na
 * consulta que já acontecia.
 *
 * A resolução em si roda dentro de uma transação com contexto de bypass
 * (papel `global_admin`) porque, neste ponto, ainda não sabemos a unidade
 * do usuário — é exatamente o mesmo mecanismo de RLS usado pelo restante
 * da aplicação, não um caminho especial. Cada operação de dados da rota,
 * depois, abre sua própria transação com `withTenantTransaction` usando o
 * contexto já resolvido (SET LOCAL por transação, nunca por sessão).
 */
export function attachTenantContext(ports: Ports) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'not authenticated' });
      return;
    }

    const claims = await ports.auth.verifySession(token);
    if (!claims) {
      res.status(401).json({ error: 'not authenticated' });
      return;
    }

    try {
      const identity = await ports.database.withTenantTransaction(
        { unitId: BOOTSTRAP_UNIT, userId: claims.sub, role: 'global_admin' },
        async (client) => {
          const { rows } = await client.query<{
            id: string;
            unit_id: string;
            role: string;
            status: string;
            password_changed_at: string;
            full_name: string | null;
            unit_name: string;
            job_title: string | null;
            sector_name: string | null;
            tour_completed: boolean;
            reading_oversight: string | null;
          }>(
            // `LEFT JOIN` no setor: pessoa sem setor é estado válido e não pode
            // sumir da releitura que autentica — um `JOIN` aqui negaria o
            // acesso de quem não tem setor.
            `SELECT u.id, u.unit_id, u.role, u.status, u.password_changed_at,
                    u.full_name, un.name AS unit_name,
                    u.job_title, s.name AS sector_name,
                    (u.tour_completed_at IS NOT NULL) AS tour_completed,
                    u.reading_oversight
             FROM users u
             JOIN units un ON un.id = u.unit_id
             LEFT JOIN sectors s ON s.id = u.sector_id
             WHERE u.id = $1`,
            [claims.sub],
          );
          return rows[0];
        },
      );

      if (!identity || identity.status !== 'active') {
        res.status(401).json({ error: 'not authenticated' });
        return;
      }

      // Sessão emitida antes da última troca de senha é recusada (change
      // `troca-de-senha`, design.md D1) — mesmo ponto em que se recusa a
      // sessão de conta desativada, sem depender de expirar o token nem
      // consultar tabela de sessões.
      const passwordChangedAtSeconds = Math.floor(
        new Date(identity.password_changed_at).getTime() / 1000,
      );
      if (claims.iat < passwordChangedAtSeconds) {
        res.status(401).json({ error: 'not authenticated' });
        return;
      }

      req.tenantContext = {
        unitId: identity.unit_id,
        userId: identity.id,
        role: identity.role as TenantContext['role'],
      };
      // Conta sem nome cadastrado resolve para vazio, nunca para o
      // identificador (capability `autenticacao`, cenário 3).
      req.identityDisplay = {
        fullName: identity.full_name ?? '',
        unitName: identity.unit_name,
        jobTitle: identity.job_title ?? '',
        sectorName: identity.sector_name ?? '',
        tourCompleted: identity.tour_completed,
        readingOversight: identity.reading_oversight as ReadingOversight | null,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
