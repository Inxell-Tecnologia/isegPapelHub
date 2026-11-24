import { Router } from 'express';
import type { PoolClient } from 'pg';
import { AuditAction, GrantResourceType, Permission } from '@gdoc/shared';
import type {
  NewDocumentsCountResponse,
  RecentDocumentResponse,
  RecentDocumentsResponse,
} from '@gdoc/shared';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { hasAccess, isAdminOfUnit } from '../lib/access.js';
import {
  fileSummaryColumns,
  toFileSummaryResponse,
  type FileSummaryRow,
} from '../lib/document-control.js';
import { config } from '../config.js';

/**
 * Ações de auditoria que **alteram** o documento (design.md D1). `view` e
 * `download` ficam deliberadamente fora: não alteram nada, e incluí-las
 * transformaria a lista num histórico de navegação — que é outra coisa
 * (design.md, Non-Goals). A lista é derivada do enum compartilhado, para que
 * uma ação nova de `AuditAction` apareça aqui por decisão explícita, não por
 * acidente.
 */
const CHANGING_ACTIONS: readonly AuditAction[] = [
  AuditAction.REPLACE,
  AuditAction.RENAME,
  AuditAction.MOVE,
];

interface CandidateRow {
  id: string;
  changed_at: string;
}

/**
 * Candidatos a "alterado recentemente", já consolidados **por documento**
 * (design.md D1 e Risks).
 *
 * A consulta parte dos **documentos vigentes** e busca o instante, nunca o
 * contrário: evento de auditoria cujo arquivo foi expurgado pela lixeira
 * simplesmente não produz linha, sem precisar de limpeza de órfãos.
 *
 * O instante é o mais recente entre `files.created_at` (a publicação) e o
 * último evento que alterou o documento. A consolidação acontece **antes** do
 * teto: senão um único documento substituído dez vezes consumiria a lista
 * inteira.
 *
 * Recorte duplo (janela + teto de candidatos) porque `audit_events` cresce sem
 * limite. `unit_id` é comparado explicitamente contra o contexto autenticado,
 * e não deixado apenas à RLS: para o `global_admin` a RLS é contornada, e a
 * trava do bypass sobre rotas de **conteúdo** exige a comparação explícita
 * (CLAUDE.md, "Trava do bypass de `global_admin`"). `lib/access.ts` repete a
 * trava depois, item a item — duas guardas, de propósito.
 */
async function listCandidates(
  client: PoolClient,
  ctx: TenantContext,
  limit: number,
): Promise<CandidateRow[]> {
  const { rows } = await client.query<CandidateRow>(
    `WITH alteracoes AS (
       SELECT file_id, max(created_at) AS changed_at
       FROM audit_events
       WHERE action = ANY($2::text[])
         AND created_at >= now() - ($3 || ' days')::interval
       GROUP BY file_id
     )
     SELECT f.id,
            GREATEST(f.created_at, COALESCE(a.changed_at, f.created_at)) AS changed_at
     FROM files f
     LEFT JOIN alteracoes a ON a.file_id = f.id
     WHERE f.unit_id = $1
       AND f.deleted_at IS NULL
       AND f.status = 'active'
       AND GREATEST(f.created_at, COALESCE(a.changed_at, f.created_at))
             >= now() - ($3 || ' days')::interval
     ORDER BY changed_at DESC, f.id
     LIMIT $4`,
    [ctx.unitId, CHANGING_ACTIONS, String(config.recentDocuments.windowDays), limit],
  );
  return rows;
}

/**
 * Candidatos a "documento novo" (change `conteudo-da-tela-inicio`, design.md
 * D1 e D3): arquivos da unidade do contexto **publicados** na janela, pelo
 * relógio do Postgres. `unit_id` comparado explicitamente pelo mesmo motivo
 * de `listCandidates` — a trava do bypass de `global_admin` sobre conteúdo.
 * Lê até `limit` linhas; quem chama pede uma a mais que o teto para saber se
 * ele foi ultrapassado.
 */
async function listNewCandidates(
  client: PoolClient,
  ctx: TenantContext,
  limit: number,
): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT f.id
     FROM files f
     WHERE f.unit_id = $1
       AND f.deleted_at IS NULL
       AND f.status = 'active'
       AND f.created_at >= now() - ($2 || ' days')::interval
     ORDER BY f.created_at DESC, f.id
     LIMIT $3`,
    [ctx.unitId, String(config.recentDocuments.newWindowDays), limit],
  );
  return rows.map((row) => row.id);
}

/**
 * `GET /files/recent` — documentos alterados recentemente (US 11.2, change
 * `shell-e-inicio`).
 *
 * Vive sob o prefixo `/files`, já tenant-scoped em `app.ts`, para não abrir um
 * quarto prefixo de topo a manter em sincronia entre `lib/api-prefixes.ts`,
 * `vite.config.ts` e `locals.tf` — mesmo raciocínio de `/files/search` e de
 * `/auth/profile`.
 *
 * **Nenhuma segunda expressão da regra de acesso** (design.md D2): cada
 * candidato passa por `hasAccess` com o verbo `view`, a mesma função que a
 * listagem de pasta e o download usam. Um `JOIN` com `grants` montado aqui
 * seria mais rápido e criaria uma segunda expressão da regra — duas expressões
 * divergem, e o sintoma da divergência seria vazamento, não erro.
 *
 * Daí decorrem, sem código próprio, dois comportamentos normatizados: o
 * documento sai da lista quando a concessão que o liberava expira (a vigência
 * é avaliada no SQL pelo relógio do Postgres, a cada consulta) e o documento
 * declarado obsoleto desaparece para quem não é administrador da unidade.
 */
export function recentRouter(ports: Ports): Router {
  const router = Router();

  // `GET /files/recent/new-count` — quantos documentos novos a pessoa alcança
  // (design.md D2: rota própria, para a contagem não segurar a lista nem o
  // contrário). **Nenhuma segunda expressão da regra de acesso** (D3): cada
  // candidato passa por `hasAccess(view)`, como na lista — o obsoleto, o
  // pendente de cadastro e a vigência de concessão vêm de lá, sem código
  // próprio aqui.
  router.get('/files/recent/new-count', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { candidateLimit, newWindowDays } = config.recentDocuments;

      const response = await ports.database.withTenantTransaction(
        ctx,
        async (client): Promise<NewDocumentsCountResponse> => {
          const candidates = await listNewCandidates(client, ctx, candidateLimit + 1);
          const capped = candidates.length > candidateLimit;
          let count = 0;
          for (const id of candidates.slice(0, candidateLimit)) {
            if (await hasAccess(client, ctx, GrantResourceType.FILE, id, Permission.VIEW)) {
              count += 1;
            }
          }
          return { days: newWindowDays, count, capped };
        },
      );

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.get('/files/recent', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      const { maxItems, candidateLimit } = config.recentDocuments;

      const documents = await ports.database.withTenantTransaction(ctx, async (client) => {
        const candidates = await listCandidates(client, ctx, candidateLimit);

        // Filtro item a item, parando no teto: o custo é proporcional ao que
        // se devolve, não ao tamanho da janela. Se o corte de candidatos for
        // alcançado antes do teto, a lista vem mais curta — é um recorte
        // curto por desenho, não uma listagem exaustiva (design.md,
        // Non-Goals).
        const permitidos: CandidateRow[] = [];
        for (const candidate of candidates) {
          if (permitidos.length >= maxItems) break;
          if (await hasAccess(client, ctx, GrantResourceType.FILE, candidate.id, Permission.VIEW)) {
            permitidos.push(candidate);
          }
        }

        if (permitidos.length === 0) return [];

        // Os dados de controle e a situação derivada vêm do mesmo lugar que a
        // listagem de pasta e a busca usam (`fileSummaryColumns`), para a
        // tabela da tela inicial nascer com tipo e situação (design.md D6).
        // `folder_name` acompanha o documento porque "o que mudou" sem "onde"
        // obriga a procurar; é o nome de pasta que a trilha de navegação já
        // revelaria a quem abre o documento.
        // O nome da pasta vem por subconsulta correlacionada, não por `JOIN`:
        // `fileSummaryColumns` projeta colunas **sem qualificação** (é o mesmo
        // fragmento das consultas de uma só tabela), e um `JOIN` com `folders`
        // — que tem `id`, `name`, `owner_id` e `unit_id` homônimos — deixaria
        // cada uma dessas colunas ambígua.
        // Admin da unidade (mesmo cuidado de `listContents` em
        // `routes/folders.ts`): o fragmento de alcance vira `TRUE`/literal de
        // `unit_id` e não referencia o placeholder do dono — por isso ele só
        // entra nos parâmetros quando não-admin, senão o driver rejeita um
        // `$n` sem uso correspondente na consulta.
        const admin = isAdminOfUnit(ctx, ctx.unitId);
        const params: unknown[] = admin ? [] : [ctx.userId];
        const ownerPlaceholder = admin ? '' : `$${params.length}`;
        params.push(permitidos.map((c) => c.id));
        const idsPlaceholder = `$${params.length}`;

        const { rows } = await client.query<FileSummaryRow & { folder_name: string | null }>(
          `SELECT ${fileSummaryColumns(ctx, ownerPlaceholder)},
                  (SELECT p.name FROM folders p WHERE p.id = files.folder_id) AS folder_name
           FROM files WHERE id = ANY(${idsPlaceholder}::uuid[])`,
          params,
        );

        // A ordem é a dos candidatos (alteração mais recente primeiro), não a
        // que o banco devolveu desta segunda leitura.
        const porId = new Map(rows.map((row) => [row.id, row]));
        return permitidos.flatMap<RecentDocumentResponse>((candidate) => {
          const row = porId.get(candidate.id);
          if (!row) return [];
          return [
            {
              ...toFileSummaryResponse(row),
              changedAt: new Date(candidate.changed_at).toISOString(),
              folderName: row.folder_name,
            },
          ];
        });
      });

      const response: RecentDocumentsResponse = { documents };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
