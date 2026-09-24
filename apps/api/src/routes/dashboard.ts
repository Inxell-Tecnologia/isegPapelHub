import { Router } from 'express';
import { UserRole, fileCategory } from '@gdoc/shared';
import type { DashboardResponse, DashboardUploadsByMonthEntry, FileCategory } from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { platformDefaultQuotaBytes } from '../lib/quota.js';

function isAdmin(ctx: TenantContext): boolean {
  return ctx.role === UserRole.GLOBAL_ADMIN || ctx.role === UserRole.UNIT_ADMIN;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Últimos 12 meses (mês antigo → recente), terminando no mês corrente — design D6. */
function trailing12MonthKeys(reference: Date): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - i, 1));
    keys.push(monthKey(d.getUTCFullYear(), d.getUTCMonth()));
  }
  return keys;
}

/**
 * `GET /dashboard` — agregação read-side do uso do repositório (US 8.2,
 * design.md D1/D3). As mesmas queries servem `unit_admin` e `global_admin`;
 * o alcance vem só da RLS da transação tenant, nunca de um `WHERE unit_id`
 * explícito (design.md D1) — evita duplicar a regra de isolamento do
 * Épico 5.
 */
export function dashboardRouter(ports: Ports): Router {
  const router = Router();

  router.get('/dashboard', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // Índice aditivo avaliado (design.md D8): `EXPLAIN ANALYZE` contra
      // ~100k arquivos (bench, escala bem acima do MVP) com um índice
      // parcial `files (unit_id, created_at) WHERE deleted_at IS NULL AND
      // status = 'active'` não ajudou a query de tipo (não indexa
      // `content_type`) e só reduziu a de envios por mês de ~55ms para
      // ~35ms — ganho marginal e inconsistente entre as duas queries. Sem
      // migração nesta fatia; Seq Scan é aceitável na escala do MVP.
      const response = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows: typeRows } = await client.query<{
          content_type: string | null;
          count: string;
        }>(
          `SELECT content_type, count(*) AS count
           FROM files
           WHERE status = 'active' AND deleted_at IS NULL
           GROUP BY content_type`,
        );

        const filesByTypeCounts = new Map<FileCategory, number>();
        for (const row of typeRows) {
          const category = fileCategory(row.content_type);
          filesByTypeCounts.set(
            category,
            (filesByTypeCounts.get(category) ?? 0) + Number(row.count),
          );
        }
        const filesByType = Array.from(filesByTypeCounts.entries()).map(([category, count]) => ({
          category,
          count,
        }));
        const totalFiles = filesByType.reduce((sum, entry) => sum + entry.count, 0);

        const { rows: monthRows } = await client.query<{ month: string; count: string }>(
          `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*) AS count
           FROM files
           WHERE status = 'active' AND deleted_at IS NULL
             AND created_at >= date_trunc('month', now()) - interval '11 months'
           GROUP BY 1
           ORDER BY 1`,
        );
        const monthCounts = new Map(monthRows.map((row) => [row.month, Number(row.count)]));
        const uploadsByMonth: DashboardUploadsByMonthEntry[] = trailing12MonthKeys(new Date()).map(
          (month) => ({
            month,
            count: monthCounts.get(month) ?? 0,
          }),
        );

        // Capacidade = **soma das cotas efetivas** do alcance, não `cota ×
        // pessoas` (change `cota-por-usuario`, design.md D2): com exceções
        // nominais, o produto deixaria de refletir a capacidade real. O padrão
        // da plataforma entra como parâmetro vindo do `config` — nunca como
        // `DEFAULT` da coluna, que seria uma segunda fonte da verdade.
        const quotaBytesPerUser = platformDefaultQuotaBytes();
        const { rows: storageRows } = await client.query<{
          user_count: string;
          used: string;
          capacity: string;
        }>(
          `SELECT count(*) AS user_count,
                  coalesce(sum(storage_used_bytes), 0) AS used,
                  coalesce(sum(coalesce(storage_quota_bytes, $1)), 0) AS capacity
             FROM users`,
          [quotaBytesPerUser],
        );
        const storageRow = storageRows[0]!;
        const userCount = Number(storageRow.user_count);
        const usedBytes = Number(storageRow.used);
        const capacityBytes = Number(storageRow.capacity);
        const availableBytes = Math.max(0, capacityBytes - usedBytes);

        const dashboard: DashboardResponse = {
          cards: {
            totalFiles,
            totalPeople: userCount,
            usedBytes,
            quotaUsedPct: capacityBytes > 0 ? usedBytes / capacityBytes : 0,
          },
          filesByType,
          uploadsByMonth,
          storage: {
            usedBytes,
            quotaBytesPerUser,
            userCount,
            capacityBytes,
            availableBytes,
          },
        };
        return dashboard;
      });

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
