import { Router } from 'express';
import type { ChangePasswordRequest, MyProfileResponse, PublicConfigResponse } from '@gdoc/shared';
import type { LoginRequest } from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import { config } from '../config.js';
import { attachTenantContext } from '../middleware/tenant-context.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../lib/session-cookie.js';
import { isPasswordValid } from '../lib/password-policy.js';

// Mesma unidade de bypass usada por tenant-context.ts: neste ponto do login
// ainda não sabemos a unidade da pessoa, então a busca por e-mail roda sob
// o mesmo mecanismo de bypass (papel global_admin), não um caminho especial.
const BOOTSTRAP_UNIT = '00000000-0000-0000-0000-000000000000';

interface UserAuthRow {
  id: string;
  unit_id: string;
  role: string;
  status: string;
  password_hash: string;
}

/**
 * `routes/auth.ts` — login/logout/me (US 1.2). Montado em `app.ts` **antes**
 * do middleware que exige sessão: `/auth/login` e `/auth/logout` precisam
 * funcionar sem sessão prévia. `/auth/me` aplica `attachTenantContext`
 * diretamente nesta rota (não no router inteiro), já que só ela exige
 * identidade resolvida.
 */
export function authRouter(ports: Ports): Router {
  const router = Router();

  // Identidade visual da implantação (change rebranding-doc7-setes,
  // design.md D1/D2/D4): sem attachTenantContext — a tela de login é
  // pré-autenticação e precisa desta configuração antes de haver sessão.
  // Contrato travado a exatamente `{ appName, clientName }`; nenhum outro
  // valor de configuração entra aqui. Não abre transação tenant.
  router.get('/auth/public-config', (_req, res) => {
    const response: PublicConfigResponse = {
      appName: 'PapelHub',
      clientName: config.appClientName,
    };
    res.json(response);
  });

  router.post('/auth/login', async (req, res, next) => {
    try {
      const { email, password } = req.body as LoginRequest;
      if (!email || !password) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      const user = await ports.database.withTenantTransaction(
        { unitId: BOOTSTRAP_UNIT, userId: BOOTSTRAP_UNIT, role: 'global_admin' },
        async (client) => {
          const { rows } = await client.query<UserAuthRow>(
            'SELECT id, unit_id, role, status, password_hash FROM users WHERE email = $1',
            [email],
          );
          return rows[0] ?? null;
        },
      );

      // Resposta única e genérica para e-mail inexistente ou senha errada
      // (US 1.2, cenário 2): não revela qual dos dois foi o problema.
      if (!user || !(await ports.auth.verifyPassword(user.password_hash, password))) {
        res.status(401).json({ error: 'invalid credentials' });
        return;
      }

      if (user.status !== 'active') {
        res.status(403).json({ error: 'account disabled' });
        return;
      }

      const token = await ports.auth.issueSession({ sub: user.id });
      res.cookie(SESSION_COOKIE_NAME, token, {
        ...sessionCookieOptions(),
        maxAge: config.authSessionTtlSeconds * 1000,
      });
      res.json({ id: user.id, unitId: user.unit_id, role: user.role });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
    res.status(204).end();
  });

  router.get('/auth/me', attachTenantContext(ports), (req, res) => {
    const ctx = req.tenantContext!;
    res.json({ id: ctx.userId, unitId: ctx.unitId, role: ctx.role });
  });

  // Alteração da própria senha (US 1.3). Qualquer papel autenticado, sem
  // checagem de papel — inclusive `global_admin`, cuja senha só muda por
  // este caminho (design.md D5, teto do global_admin).
  router.post('/auth/password', attachTenantContext(ports), async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const body = req.body as ChangePasswordRequest;
      if (!body.currentPassword || !body.newPassword) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      // US 1.3, cenário 3; design.md (troca-de-senha) D8.
      if (!isPasswordValid(body.newPassword)) {
        res.status(400).json({ error: 'password too short' });
        return;
      }

      type ChangeOutcome =
        { kind: 'ok'; passwordChangedAt: string } | { kind: 'wrong_current_password' };

      const outcome = await ports.database.withTenantTransaction<ChangeOutcome>(
        ctx,
        async (client) => {
          const { rows } = await client.query<{ password_hash: string }>(
            'SELECT password_hash FROM users WHERE id = $1',
            [ctx.userId],
          );
          const currentHash = rows[0]!.password_hash;

          // Prova de posse (US 1.3): sem isso, uma sessão sequestrada poderia
          // trocar a senha sem nunca ter conhecido a original.
          if (!(await ports.auth.verifyPassword(currentHash, body.currentPassword))) {
            return { kind: 'wrong_current_password' };
          }

          const newHash = await ports.auth.hashPassword(body.newPassword);
          const { rows: updated } = await client.query<{ password_changed_at: string }>(
            'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2 RETURNING password_changed_at',
            [newHash, ctx.userId],
          );
          return { kind: 'ok', passwordChangedAt: updated[0]!.password_changed_at };
        },
      );

      // Erro específico (design.md D9): diferente da resposta genérica do
      // login — quem chama já está autenticado como a própria pessoa, então
      // não há enumeração a esconder.
      if (outcome.kind === 'wrong_current_password') {
        res.status(400).json({ error: 'current password is incorrect' });
        return;
      }

      // O `iat` da sessão reemitida vem do instante gravado no Postgres, não
      // do relógio do Node (design.md D2) — fonte única de tempo, para a
      // própria troca de senha não derrubar a sessão que deveria sobreviver.
      const token = await ports.auth.issueSession(
        { sub: ctx.userId },
        new Date(outcome.passwordChangedAt),
      );
      res.cookie(SESSION_COOKIE_NAME, token, {
        ...sessionCookieOptions(),
        maxAge: config.authSessionTtlSeconds * 1000,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Perfil somente leitura (US 1.3, cenário 5; design.md D6) — sob `/auth`,
  // não um `/me` de topo novo, para não abrir um quarto ponto de sincronia
  // de prefixos (`lib/api-prefixes.ts` / `vite.config.ts` / `locals.tf`).
  router.get('/auth/profile', attachTenantContext(ports), async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const row = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<{
          full_name: string | null;
          email: string;
          unit_name: string;
          role: string;
        }>(
          `SELECT u.full_name, u.email, un.name AS unit_name, u.role
           FROM users u JOIN units un ON un.id = u.unit_id
           WHERE u.id = $1`,
          [ctx.userId],
        );
        return rows[0]!;
      });

      const response: MyProfileResponse = {
        fullName: row.full_name,
        email: row.email,
        unitName: row.unit_name,
        role: row.role as MyProfileResponse['role'],
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
