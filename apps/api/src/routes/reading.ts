import { Router } from 'express';
import type { PoolClient } from 'pg';
import {
  DocumentStatus,
  DocumentType,
  GrantResourceType,
  Permission,
  READING_DEFAULT_DUE_DAYS,
  isPreviewable,
} from '@gdoc/shared';
import type {
  MyReadingResponse,
  MyReadingsResponse,
  OversightListResponse,
  OversightReportResponse,
  ReadingAudience,
  ReadingAudienceOptionsResponse,
  ReadingCampaignResponse,
  ReadingFileStateResponse,
  ReadingIneligibleReason,
  ReadingStatus,
} from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { hasAccess, isAdminOfUnit } from '../lib/access.js';
import {
  fileSummaryColumns,
  toFileSummaryResponse,
  type FileSummaryRow,
} from '../lib/document-control.js';
import {
  READING_STATUS_SQL,
  audienceBelongsToUnit,
  countAudience,
  isEmptyAudience,
  materializeCampaign,
  parseAudience,
  reconcileForUser,
} from '../lib/reading.js';
import { notifyAssigned, readAssignedNotices } from '../lib/reading-notices.js';
import { listOversight, readOversightReport } from '../lib/reading-oversight.js';

type ReaderNotices = Awaited<ReturnType<typeof readAssignedNotices>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Situações em que a revisão está em vigor (design.md D5). */
const IN_FORCE: readonly string[] = [DocumentStatus.CURRENT, DocumentStatus.DUE_SOON];

interface CampaignRow {
  id: string;
  file_id: string;
  document_revision: number;
  document_code: string;
  document_title: string;
  audience: ReadingAudience;
  due_date: string;
  message: string | null;
  created_at: string;
  assigned_count: string;
}

const CAMPAIGN_COLUMNS = `c.id, c.file_id, c.document_revision, c.document_code, c.document_title,
  c.audience, to_char(c.due_date, 'YYYY-MM-DD') AS due_date, c.message, c.created_at,
  (SELECT count(*) FROM reading_assignments x WHERE x.campaign_id = c.id) AS assigned_count`;

function toCampaignResponse(row: CampaignRow): ReadingCampaignResponse {
  return {
    id: row.id,
    fileId: row.file_id,
    documentRevision: row.document_revision,
    documentCode: row.document_code,
    documentTitle: row.document_title,
    audience: row.audience,
    dueDate: row.due_date,
    message: row.message,
    createdAt: new Date(row.created_at).toISOString(),
    assignedCount: Number(row.assigned_count),
  };
}

/** Resumo do arquivo pelo mesmo fragmento da listagem, da busca e dos recentes. */
async function readFileSummaries(
  client: PoolClient,
  ctx: TenantContext,
  ids: string[],
): Promise<Map<string, FileSummaryRow & { unit_id: string; awaiting: boolean | null }>> {
  if (ids.length === 0) return new Map();
  const admin = isAdminOfUnit(ctx, ctx.unitId);
  const params: unknown[] = admin ? [] : [ctx.userId];
  const owner = admin ? '' : `$${params.length}`;
  params.push(ids);
  const { rows } = await client.query<
    FileSummaryRow & { unit_id: string; awaiting: boolean | null }
  >(
    `SELECT ${fileSummaryColumns(ctx, owner)}, unit_id, awaiting_registration AS awaiting
     FROM files WHERE id = ANY($${params.length}::uuid[]) AND deleted_at IS NULL`,
    params,
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/** Por que o documento não pode ser marcado; `null` = elegível (design.md D5). */
function ineligibility(
  row: FileSummaryRow & { awaiting: boolean | null },
): ReadingIneligibleReason | null {
  if (
    !row.document_type ||
    row.document_type === DocumentType.GENERAL_FILE ||
    row.awaiting ||
    row.document_revision === null ||
    !row.document_code
  ) {
    return 'not_controlled';
  }
  if (!IN_FORCE.includes(row.document_status)) return 'not_in_force';
  // O público só ganha **visualizar** (design.md D6), não baixar: documento
  // que não abre no visualizador não poderia ser lido por ninguém dele
  // (design.md D11). Mesma fonte da SPA e de `view-url`: `isPreviewable`.
  if (!isPreviewable(row.content_type)) return 'not_previewable';
  return null;
}

type FileGate =
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | {
      kind: 'ok';
      row: FileSummaryRow & { unit_id: string; awaiting: boolean | null };
      canMark: boolean;
    };

/**
 * Alcance do arquivo para a leitura obrigatória: quem não **visualiza** recebe
 * 404 indistinguível de inexistente; quem visualiza mas não **edita os dados de
 * controle** (`rename`, design.md D4) recebe 403 nas operações de marcação.
 */
async function gateFile(
  client: PoolClient,
  ctx: TenantContext,
  fileId: string,
  needMark: boolean,
): Promise<FileGate> {
  if (!UUID.test(fileId)) return { kind: 'not_found' };
  if (!(await hasAccess(client, ctx, GrantResourceType.FILE, fileId, Permission.VIEW))) {
    return { kind: 'not_found' };
  }
  const row = (await readFileSummaries(client, ctx, [fileId])).get(fileId);
  if (!row || row.unit_id !== ctx.unitId) return { kind: 'not_found' };
  const canMark = await hasAccess(client, ctx, GrantResourceType.FILE, fileId, Permission.RENAME);
  if (needMark && !canMark) return { kind: 'forbidden' };
  return { kind: 'ok', row, canMark };
}

function sendGate(res: import('express').Response, gate: FileGate): boolean {
  if (gate.kind === 'not_found') {
    res.status(404).json({ error: 'not_found' });
    return true;
  }
  if (gate.kind === 'forbidden') {
    res.status(403).json({ error: 'forbidden' });
    return true;
  }
  return false;
}

/**
 * `routes/reading.ts` — leitura obrigatória (Épico 12, change
 * `leitura-obrigatoria`). Prefixo de topo `/reading` (design.md D10).
 *
 * A situação de cada leitura é derivada na consulta (`READING_STATUS_SQL`),
 * pelo relógio do Postgres — nenhuma rota grava "atrasada" ou "encerrada".
 */
export function readingRouter(ports: Ports): Router {
  const router = Router();

  router.get('/reading/files/:fileId', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const out = await ports.database.withTenantTransaction(ctx, async (client) => {
        const gate = await gateFile(client, ctx, req.params.fileId!, false);
        if (gate.kind !== 'ok') return { gate };
        const rev = gate.row.document_revision;
        let current: ReadingCampaignResponse | null = null;
        let previous: ReadingCampaignResponse | null = null;
        // Detalhes da marcação só a quem pode marcar: o público é decisão do
        // publicador, não informação do leitor.
        if (gate.canMark) {
          const { rows } = await client.query<CampaignRow>(
            `SELECT ${CAMPAIGN_COLUMNS} FROM reading_campaigns c
             WHERE c.file_id = $1 ORDER BY c.created_at DESC`,
            [gate.row.id],
          );
          const atual = rows.find((r) => r.document_revision === rev);
          const anterior = rows.find((r) => r.document_revision !== rev);
          current = atual ? toCampaignResponse(atual) : null;
          previous = anterior ? toCampaignResponse(anterior) : null;
        }
        const body: ReadingFileStateResponse = {
          canMark: gate.canMark,
          ineligibleReason: ineligibility(gate.row),
          currentRevision: rev,
          current,
          previous,
        };
        return { gate, body };
      });
      if (sendGate(res, out.gate)) return;
      res.json(out.body);
    } catch (err) {
      next(err);
    }
  });

  // Opções de público (design.md D8): setores e pessoas **ativas** da unidade
  // do documento, só a quem pode marcá-lo — o publicador pode ser colaborador,
  // e `GET /users`/`GET /sectors` são da administração.
  router.get('/reading/files/:fileId/audience-options', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const out = await ports.database.withTenantTransaction(ctx, async (client) => {
        const gate = await gateFile(client, ctx, req.params.fileId!, true);
        if (gate.kind !== 'ok') return { gate };
        const { rows: sectors } = await client.query<{ id: string; name: string }>(
          'SELECT id, name FROM sectors WHERE unit_id = $1 ORDER BY lower(name)',
          [gate.row.unit_id],
        );
        const { rows: people } = await client.query<{
          id: string;
          name: string;
          sector_name: string | null;
        }>(
          `SELECT u.id, COALESCE(NULLIF(u.full_name, ''), u.email) AS name, s.name AS sector_name
           FROM users u LEFT JOIN sectors s ON s.id = u.sector_id
           WHERE u.unit_id = $1 AND u.status = 'active'
           ORDER BY lower(COALESCE(NULLIF(u.full_name, ''), u.email))`,
          [gate.row.unit_id],
        );
        const body: ReadingAudienceOptionsResponse = {
          sectors,
          people: people.map((p) => ({ id: p.id, name: p.name, sectorName: p.sector_name })),
        };
        return { gate, body };
      });
      if (sendGate(res, out.gate)) return;
      res.json(out.body);
    } catch (err) {
      next(err);
    }
  });

  router.post('/reading/preview', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { fileId } = req.body as { fileId?: string };
      const audience = parseAudience((req.body as { audience?: unknown }).audience);
      if (typeof fileId !== 'string' || !audience) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }
      const out = await ports.database.withTenantTransaction(ctx, async (client) => {
        const gate = await gateFile(client, ctx, fileId, true);
        if (gate.kind !== 'ok') return { gate };
        if (!(await audienceBelongsToUnit(client, gate.row.unit_id, audience))) {
          return { gate, error: 'invalid_audience' as const };
        }
        return { gate, count: await countAudience(client, gate.row.unit_id, audience) };
      });
      if (sendGate(res, out.gate)) return;
      if ('error' in out) {
        res.status(409).json({ error: out.error });
        return;
      }
      res.json({ count: out.count });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reading/campaigns', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const body = req.body as {
        fileId?: unknown;
        audience?: unknown;
        dueDate?: unknown;
        message?: unknown;
      };
      const audience = parseAudience(body.audience);
      if (typeof body.fileId !== 'string' || !audience) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }
      if (isEmptyAudience(audience)) {
        res.status(400).json({ error: 'empty_audience' });
        return;
      }
      if (
        body.dueDate !== undefined &&
        (typeof body.dueDate !== 'string' || !DATE.test(body.dueDate))
      ) {
        res.status(400).json({ error: 'invalid_due_date' });
        return;
      }
      if (body.message !== undefined && typeof body.message !== 'string') {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }
      const fileId = body.fileId;
      const message =
        typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;

      type Out =
        | { gate: FileGate }
        | {
            gate: FileGate;
            error: 'not_eligible' | 'invalid_audience' | 'invalid_due_date' | 'already_marked';
          }
        | { gate: FileGate; campaign: ReadingCampaignResponse; avisos: ReaderNotices };

      const out = await ports.database.withTenantTransaction<Out>(ctx, async (client) => {
        const gate = await gateFile(client, ctx, fileId, true);
        if (gate.kind !== 'ok') return { gate };
        if (ineligibility(gate.row)) return { gate, error: 'not_eligible' };
        if (!(await audienceBelongsToUnit(client, gate.row.unit_id, audience))) {
          return { gate, error: 'invalid_audience' };
        }
        // Prazo não pode ser no passado — pelo relógio do banco.
        const { rows: prazo } = await client.query<{ due: string; ok: boolean }>(
          `SELECT to_char(d, 'YYYY-MM-DD') AS due, d >= current_date AS ok
           FROM (SELECT COALESCE($1::date, current_date + $2::int) AS d) x`,
          [typeof body.dueDate === 'string' ? body.dueDate : null, READING_DEFAULT_DUE_DAYS],
        );
        if (!prazo[0]!.ok) return { gate, error: 'invalid_due_date' };

        // Uma marcação por revisão: `ON CONFLICT DO NOTHING` em vez de deixar a
        // violação abortar a transação.
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO reading_campaigns (unit_id, file_id, document_revision, document_code,
             document_title, audience, due_date, message, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::date, $8, $9)
           ON CONFLICT (file_id, document_revision) DO NOTHING
           RETURNING id`,
          [
            gate.row.unit_id,
            gate.row.id,
            gate.row.document_revision,
            gate.row.document_code,
            gate.row.file_name,
            JSON.stringify(audience),
            prazo[0]!.due,
            message,
            ctx.userId,
          ],
        );
        if (!rows[0]) return { gate, error: 'already_marked' };
        const criadas = await materializeCampaign(client, rows[0].id);
        const avisos = await readAssignedNotices(client, criadas);
        const { rows: criada } = await client.query<CampaignRow>(
          `SELECT ${CAMPAIGN_COLUMNS} FROM reading_campaigns c WHERE c.id = $1`,
          [rows[0].id],
        );
        return { gate, campaign: toCampaignResponse(criada[0]!), avisos };
      });

      // Aviso de nova leitura ao público (change `avisos-e-atrasos`, design.md
      // D2): **depois** da transação — a marcação já está registrada, e a
      // falha ao avisar não a desfaz; a rotina diária emite o que faltar.
      if ('avisos' in out) await notifyAssigned(ports.notifications, out.avisos);

      if (sendGate(res, out.gate)) return;
      if ('error' in out) {
        const status = out.error === 'invalid_due_date' ? 400 : 409;
        res.status(status).json({ error: out.error });
        return;
      }
      if ('campaign' in out) res.status(201).json(out.campaign);
    } catch (err) {
      next(err);
    }
  });

  // Minhas leituras (design.md D2/D3): reconcilia antes a pendência de quem
  // entrou depois no público, e devolve todas com a situação apurada agora.
  router.get('/reading/mine', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      let avisos: ReaderNotices = [];
      const items = await ports.database.withTenantTransaction(ctx, async (client) => {
        // Quem entrou depois no público é alcançado aqui — e avisado, depois
        // da transação (change `avisos-e-atrasos`, design.md D2).
        avisos = await readAssignedNotices(client, await reconcileForUser(client, ctx));
        const { rows } = await client.query<{
          assignment_id: string;
          campaign_id: string;
          file_id: string;
          status: ReadingStatus;
          due_date: string;
          acknowledged_at: string | null;
          document_revision: number;
          document_code: string;
          document_title: string;
          message: string | null;
        }>(
          `SELECT a.id AS assignment_id, c.id AS campaign_id, c.file_id,
                  ${READING_STATUS_SQL} AS status,
                  to_char(a.due_date, 'YYYY-MM-DD') AS due_date, a.acknowledged_at,
                  c.document_revision, c.document_code, c.document_title, c.message
           FROM reading_assignments a
           JOIN reading_campaigns c ON c.id = a.campaign_id
           LEFT JOIN files f ON f.id = c.file_id
           WHERE a.user_id = $1 AND a.unit_id = $2
           ORDER BY
             CASE ${READING_STATUS_SQL} WHEN 'late' THEN 0 WHEN 'pending' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
             a.due_date, a.acknowledged_at DESC NULLS LAST`,
          [ctx.userId, ctx.unitId],
        );
        // O arquivo só acompanha a leitura que ainda leva a ele: aberta, ou
        // concluída na revisão vigente — e sempre confirmado por `hasAccess`.
        const comArquivo = new Set<string>();
        for (const r of rows) {
          if (r.status === 'closed' || comArquivo.has(r.file_id)) continue;
          if (await hasAccess(client, ctx, GrantResourceType.FILE, r.file_id, Permission.VIEW)) {
            comArquivo.add(r.file_id);
          }
        }
        const arquivos = await readFileSummaries(client, ctx, [...comArquivo]);
        return rows.map<MyReadingResponse>((r) => {
          const f = r.status === 'closed' ? undefined : arquivos.get(r.file_id);
          return {
            assignmentId: r.assignment_id,
            campaignId: r.campaign_id,
            status: r.status,
            dueDate: r.due_date,
            acknowledgedAt: r.acknowledged_at ? new Date(r.acknowledged_at).toISOString() : null,
            documentRevision: r.document_revision,
            documentCode: r.document_code,
            documentTitle: r.document_title,
            message: r.message,
            file: f ? toFileSummaryResponse(f) : null,
          };
        });
      });
      await notifyAssigned(ports.notifications, avisos);
      const body: MyReadingsResponse = { items };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  // Ciência (design.md D7): só a própria, só aberta, irreversível. Alheia,
  // inexistente ou de outra unidade → 404 indistinguível.
  router.post('/reading/assignments/:id/acknowledge', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const id = req.params.id!;
      if (!UUID.test(id)) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const out = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<{ status: ReadingStatus; file_id: string }>(
          `SELECT ${READING_STATUS_SQL} AS status, c.file_id
           FROM reading_assignments a
           JOIN reading_campaigns c ON c.id = a.campaign_id
           LEFT JOIN files f ON f.id = c.file_id
           WHERE a.id = $1 AND a.user_id = $2 AND a.unit_id = $3
           FOR UPDATE OF a`,
          [id, ctx.userId, ctx.unitId],
        );
        const linha = rows[0];
        if (!linha) return 404 as const;
        if (linha.status !== 'pending' && linha.status !== 'late') return 409 as const;
        if (
          !(await hasAccess(client, ctx, GrantResourceType.FILE, linha.file_id, Permission.VIEW))
        ) {
          return 404 as const;
        }
        await client.query(
          `UPDATE reading_assignments a
           SET acknowledged_at = now(),
               acknowledged_sector_name = (
                 SELECT s.name FROM users u LEFT JOIN sectors s ON s.id = u.sector_id WHERE u.id = a.user_id
               )
           WHERE a.id = $1 AND a.acknowledged_at IS NULL`,
          [id],
        );
        return 204 as const;
      });
      if (out === 404) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (out === 409) {
        res.status(409).json({ error: 'not_pending' });
        return;
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Acompanhamento (change `acompanhamento-de-leituras`, design.md D4): o
  // recorte — publicador, gestor, todas as unidades — é todo de
  // `lib/reading-oversight.ts`, que concentra a única consulta entre unidades.
  router.get('/reading/oversight', async (req, res, next) => {
    try {
      const body: OversightListResponse = await listOversight(ports.database, req.tenantContext!);
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get('/reading/oversight/campaigns/:id', async (req, res, next) => {
    try {
      const id = req.params.id!;
      // Fora do recorte, de outra unidade ou inexistente: o mesmo 404.
      const body: OversightReportResponse | null = UUID.test(id)
        ? await readOversightReport(ports.database, req.tenantContext!, id)
        : null;
      if (!body) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
