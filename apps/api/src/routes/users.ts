import { Router } from 'express';
import type { PoolClient } from 'pg';
import { UserRole, UnitStatus, PersonStatus } from '@gdoc/shared';
import type {
  CreatePersonRequest,
  UpdatePersonRequest,
  PersonResponse,
  ResetPasswordResponse,
} from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { isPasswordValid, generatePassword } from '../lib/password-policy.js';
import { isValidQuotaInput } from '../lib/quota.js';

interface PersonRow {
  id: string;
  unit_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  job_title: string | null;
  work_area: string | null;
  notes: string | null;
  role: string;
  status: string;
  created_at: string;
  storage_used_bytes: string;
  storage_quota_bytes: string | null;
}

const PERSON_COLUMNS =
  'id, unit_id, full_name, email, phone, job_title, work_area, notes, role, status, created_at, ' +
  // Consumo e exceção de cota (change `cota-por-usuario`): o consumo existe
  // para que a administração decida a cota vendo o uso atual em vez de às
  // cegas (design.md D5); a exceção é `null` quando a pessoa segue o padrão da
  // plataforma. Ambos herdam o alcance que a gestão de pessoas já impõe — RLS
  // por unidade mais `canEditTarget` —, sem rota nova.
  'storage_used_bytes, storage_quota_bytes';

function toPersonResponse(row: PersonRow): PersonResponse {
  return {
    id: row.id,
    unitId: row.unit_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    jobTitle: row.job_title,
    workArea: row.work_area,
    notes: row.notes,
    role: row.role as PersonResponse['role'],
    status: row.status as PersonResponse['status'],
    createdAt: new Date(row.created_at).toISOString(),
    storageUsedBytes: Number(row.storage_used_bytes ?? '0'),
    storageQuotaBytes:
      row.storage_quota_bytes === null || row.storage_quota_bytes === undefined
        ? null
        : Number(row.storage_quota_bytes),
  };
}

function isAdmin(ctx: TenantContext): boolean {
  return ctx.role === UserRole.GLOBAL_ADMIN || ctx.role === UserRole.UNIT_ADMIN;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '23505';
}

/**
 * Papel da **pessoa alvo**, lido do banco na mesma transação da operação —
 * nunca do corpo da requisição. `null` quando o alvo não existe ou está
 * escondido pela RLS (outra unidade): os dois casos são indistinguíveis de
 * propósito, e ambos levam à mesma recusa fail-closed.
 */
async function targetRoleOf(client: PoolClient, targetId: string): Promise<string | null> {
  const { rows } = await client.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [
    targetId,
  ]);
  return rows[0]?.role ?? null;
}

/**
 * Alcance da **edição de pessoa** (`PATCH /users/:id`) — change
 * `edicao-entre-admins-globais`, design.md D1.
 *
 * | Ator \ Alvo   | collaborator | unit_admin | global_admin       |
 * | -------------- | ------------ | ---------- | ------------------ |
 * | `unit_admin`   | ✔            | ✘          | ✘                  |
 * | `global_admin` | ✔            | ✔          | ✔ (inclusive si)   |
 *
 * **Deliberadamente distinto de `canResetPasswordOf`**, e não uma variação
 * dela: editar os dados de outro administrador é administração; redefinir a
 * senha dele é tomar a conta dele. Até este change as duas regras eram a mesma
 * função, e a edição herdava por acidente a restrição que só a senha precisa —
 * contrariando a própria spec `gestao-pessoas`, que sempre permitiu
 * `global_admin` sobre `global_admin`. Se alterar uma, confira se a outra
 * realmente deve acompanhar.
 */
async function canEditTarget(
  client: PoolClient,
  ctx: TenantContext,
  targetId: string,
): Promise<boolean> {
  const targetRole = await targetRoleOf(client, targetId);
  if (!targetRole) return false;
  if (ctx.role === UserRole.GLOBAL_ADMIN) return true;
  return ctx.role === UserRole.UNIT_ADMIN && targetRole === UserRole.COLLABORATOR;
}

/**
 * Alcance da **redefinição administrativa de senha** (`POST
 * /users/:id/password`) — change `troca-de-senha`, design.md D5; PRD US 1.4
 * cenário 2. **Inalterado** por `edicao-entre-admins-globais`.
 *
 * | Ator \ Alvo   | collaborator | unit_admin | global_admin |
 * | -------------- | ------------ | ---------- | ------------ |
 * | `unit_admin`   | ✔            | ✘          | ✘            |
 * | `global_admin` | ✔            | ✔          | ✘            |
 *
 * A senha de um `global_admin` não é redefinida por ninguém — nem por outro
 * `global_admin`, nem por ele mesmo por aqui —, restando só a troca pela
 * própria pessoa em "Minha conta". A senha gerada é exibida uma única vez a
 * quem redefiniu, então redefinir a de outro administrador entregaria a conta
 * dele, com todo o rastro seguinte apontando para o dono.
 */
async function canResetPasswordOf(
  client: PoolClient,
  ctx: TenantContext,
  targetId: string,
): Promise<boolean> {
  const targetRole = await targetRoleOf(client, targetId);
  if (!targetRole || targetRole === UserRole.GLOBAL_ADMIN) return false;
  if (ctx.role === UserRole.GLOBAL_ADMIN) return true;
  return ctx.role === UserRole.UNIT_ADMIN && targetRole === UserRole.COLLABORATOR;
}

/**
 * `routes/users.ts` — CRUD de pessoas pela administração (US 1.1). Alcance
 * por papel imposto em duas camadas (design.md Decisão D4): a checagem de
 * papel aqui bloqueia `collaborator` de plano, e a RLS (mesma
 * `withTenantTransaction` de sempre) garante que `unit_admin` nunca
 * enxergue/altere pessoa de outra unidade mesmo que a checagem de
 * aplicação falhasse.
 */
export function usersRouter(ports: Ports): Router {
  const router = Router();

  router.post('/users', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const body = req.body as CreatePersonRequest;
      if (!body.fullName || !body.email || !body.password) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      // design.md (troca-de-senha) D8 — mesma política aplicada na troca e
      // na geração do reset.
      if (!isPasswordValid(body.password)) {
        res.status(400).json({ error: 'password too short' });
        return;
      }

      const role = body.role ?? UserRole.COLLABORATOR;
      if (ctx.role === UserRole.UNIT_ADMIN && role === UserRole.GLOBAL_ADMIN) {
        res.status(403).json({ error: 'cannot create global_admin' });
        return;
      }

      // unit_admin é sempre forçado à própria unidade, ignorando o que foi
      // informado (US 5.1, cenário "unit_admin não cria fora da própria
      // unidade"); global_admin pode escolher, com fallback para a própria.
      const unitId = ctx.role === UserRole.UNIT_ADMIN ? ctx.unitId : (body.unitId ?? ctx.unitId);

      const passwordHash = await ports.auth.hashPassword(body.password);

      // Fail-closed (change `gestao-de-unidades`, D2/D7): não cadastra em
      // unidade desativada. Checado no servidor (não só escondido no seletor
      // do front) e na mesma transação do insert, para o global_admin não
      // burlar via `unitId` forjado. `unit_admin` está preso à própria unidade
      // (sempre ativa enquanto ele existe), então na prática só barra o
      // global_admin escolhendo uma unidade desativada.
      // `email_conflict` não é uma variante aqui: a violação de unicidade é
      // lançada pelo insert e capturada no `catch` externo (409).
      type CreateOutcome = { kind: 'ok'; row: PersonRow } | { kind: 'unit_disabled' };

      let outcome: CreateOutcome;
      try {
        outcome = await ports.database.withTenantTransaction<CreateOutcome>(ctx, async (client) => {
          const { rows: unitRows } = await client.query<{ status: string }>(
            'SELECT status FROM units WHERE id = $1',
            [unitId],
          );
          if (unitRows[0]?.status === UnitStatus.DISABLED) {
            return { kind: 'unit_disabled' };
          }

          const { rows } = await client.query<PersonRow>(
            `INSERT INTO users (unit_id, email, password_hash, role, full_name, phone, job_title, work_area, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING ${PERSON_COLUMNS}`,
            [
              unitId,
              body.email,
              passwordHash,
              role,
              body.fullName,
              body.phone ?? null,
              body.jobTitle ?? null,
              body.workArea ?? null,
              body.notes ?? null,
            ],
          );
          return { kind: 'ok', row: rows[0]! };
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'email already in use' });
          return;
        }
        throw err;
      }

      if (outcome.kind === 'unit_disabled') {
        res.status(409).json({ error: 'unit is disabled' });
        return;
      }

      res.status(201).json(toPersonResponse(outcome.row));
    } catch (err) {
      next(err);
    }
  });

  router.get('/users', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Nenhum filtro de unidade aqui: a RLS já restringe unit_admin à
      // própria unidade e dá bypass a global_admin (US 5.1).
      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<PersonRow>(
          `SELECT ${PERSON_COLUMNS} FROM users ORDER BY created_at`,
        );
        return rows;
      });

      res.json(rows.map(toPersonResponse));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/users/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const body = req.body as UpdatePersonRequest;
      if (ctx.role === UserRole.UNIT_ADMIN && body.role === UserRole.GLOBAL_ADMIN) {
        res.status(403).json({ error: 'cannot elevate to global_admin' });
        return;
      }

      // Concessão de cota é exclusiva do `global_admin` (change
      // `cota-por-usuario`, design.md D3) — mais estreita que o `isAdmin()`
      // que governa os demais campos, porque cota é alavanca de custo de
      // infraestrutura. A recusa é **total**: a requisição inteira cai sem
      // aplicar os outros campos. Ignorar o campo em silêncio e salvar o resto
      // devolveria sucesso por uma concessão que não ocorreu.
      const quotaRequested = 'storageQuotaBytes' in body && body.storageQuotaBytes !== undefined;
      if (quotaRequested && ctx.role !== UserRole.GLOBAL_ADMIN) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      if (quotaRequested && !isValidQuotaInput(body.storageQuotaBytes)) {
        res.status(400).json({ error: 'invalid storage quota' });
        return;
      }

      // Travas de auto-edição (change `edicao-entre-admins-globais`, design.md
      // D2), válidas para **qualquer** papel. Até este change elas eram
      // desnecessárias no servidor: ninguém alcançava um `global_admin`, então
      // não havia como rebaixar-se nem desativar-se. Ao abrir a edição entre
      // administradores globais, os dois caminhos passariam a existir — e um
      // deles é irreversível pela aplicação: o bootstrap só recria um
      // administrador global quando NENHUM existe **por papel**, sem olhar
      // status, então um último administrador desativado não seria recuperado.
      //
      // As duas travas bastam, sem contar "último administrador": quem executa
      // precisa ser administrador global ativo (o middleware relê papel e
      // status do banco a cada requisição) e não alcança a si mesmo por
      // nenhuma delas — logo sempre resta ao menos um ativo, o próprio autor.
      //
      // A recusa é total, no mesmo espírito da guarda de cota: aplicar os
      // demais campos e ignorar o proibido devolveria sucesso por uma operação
      // que não ocorreu. Reenviar o MESMO papel não é alteração — o formulário
      // sempre manda o papel vigente, e recusá-lo travaria a edição de si.
      const isSelf = req.params.id === ctx.userId;
      if (isSelf && body.role !== undefined && body.role !== ctx.role) {
        res.status(403).json({ error: 'cannot change own role' });
        return;
      }
      if (isSelf && body.status === PersonStatus.DISABLED) {
        res.status(403).json({ error: 'cannot disable own account' });
        return;
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      const setField = (column: string, value: unknown) => {
        values.push(value);
        setClauses.push(`${column} = $${values.length}`);
      };
      if (body.fullName !== undefined) setField('full_name', body.fullName);
      if (body.phone !== undefined) setField('phone', body.phone);
      if (body.jobTitle !== undefined) setField('job_title', body.jobTitle);
      if (body.workArea !== undefined) setField('work_area', body.workArea);
      if (body.notes !== undefined) setField('notes', body.notes);
      if (body.status !== undefined) setField('status', body.status);
      if (body.role !== undefined) setField('role', body.role);
      // `null` remove a exceção e devolve a pessoa ao padrão da plataforma,
      // sem exigir que quem chama conheça o valor do padrão (design.md D8).
      if (quotaRequested) setField('storage_quota_bytes', body.storageQuotaBytes);

      if (setClauses.length === 0) {
        res.status(400).json({ error: 'no fields to update' });
        return;
      }

      values.push(req.params.id);

      // RLS filtra as linhas visíveis para UPDATE antes do WHERE por id
      // rodar: se a pessoa pertence a outra unidade, 0 linhas voltam — sem
      // erro, sem dado alterado (US 5.1, cenário "edição respeita o
      // alcance"). A checagem de `canEditTarget` (design.md
      // (edicao-entre-admins-globais) D1) fecha a brecha adjacente: sem ela, a
      // RLS ainda deixaria um
      // `unit_admin` enxergar (e editar/desativar) um `unit_admin` ou
      // `global_admin` lotado na própria unidade. Os dois casos — RLS
      // escondendo a linha, ou a linha visível mas fora do alcance por papel
      // — caem no mesmo 403, sem distinção (mesmo tratamento usado por
      // routes/files.ts para "linha escondida pela RLS").
      const row = await ports.database.withTenantTransaction(ctx, async (client) => {
        const allowed = await canEditTarget(client, ctx, req.params.id!);
        if (!allowed) return null;

        const { rows } = await client.query<PersonRow>(
          `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING ${PERSON_COLUMNS}`,
          values,
        );
        return rows[0] ?? null;
      });

      if (!row) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      res.json(toPersonResponse(row));
    } catch (err) {
      next(err);
    }
  });

  // Redefinição administrativa de senha (US 1.4). Sem senha atual — o
  // sistema gera a senha e a devolve em texto claro **exclusivamente** nesta
  // resposta (design.md D7); qualquer senha vinda do corpo é ignorada, já
  // que o corpo nunca é lido para esse fim.
  router.post('/users/:id/password', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      type ResetOutcome = { kind: 'ok'; generatedPassword: string } | { kind: 'forbidden' };

      const outcome = await ports.database.withTenantTransaction<ResetOutcome>(
        ctx,
        async (client) => {
          const allowed = await canResetPasswordOf(client, ctx, req.params.id!);
          if (!allowed) return { kind: 'forbidden' };

          const generatedPassword = generatePassword();
          const passwordHash = await ports.auth.hashPassword(generatedPassword);
          await client.query(
            'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2',
            [passwordHash, req.params.id],
          );
          return { kind: 'ok', generatedPassword };
        },
      );

      if (outcome.kind === 'forbidden') {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const response: ResetPasswordResponse = { generatedPassword: outcome.generatedPassword };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
