import { Router } from 'express';
import { GrantResourceType, NotificationKind, Permission, UserRole } from '@gdoc/shared';
import type {
  CreateGrantRequest,
  CrossUnitSubjectResponse,
  GrantListResponse,
  GrantResponse,
  GrantSubjectsLimitExceededResponse,
  SharedPermissionResponse,
  SharedWithMeItemResponse,
  SharedWithMeResponse,
} from '@gdoc/shared';
import type { PoolClient } from 'pg';
import type { Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { hasAccess, resourceTable } from '../lib/access.js';
import { listCrossUnitReceived } from '../lib/cross-unit-share.js';
import {
  fileSummaryColumns,
  toFileSummaryResponse,
  type FileSummaryRow,
} from '../lib/document-control.js';
import { config } from '../config.js';

interface GrantRow {
  id: string;
  unit_id: string;
  subject_user_id: string;
  resource_type: string;
  resource_id: string;
  permission: string;
  granted_by: string;
  created_at: string;
  expires_at: string | null;
  expired: boolean;
}

function toGrantResponse(row: GrantRow): GrantResponse {
  return {
    id: row.id,
    unitId: row.unit_id,
    subjectUserId: row.subject_user_id,
    resourceType: row.resource_type as GrantResourceType,
    resourceId: row.resource_id,
    permission: row.permission as Permission,
    grantedBy: row.granted_by,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    expired: row.expired,
  };
}

function isAdmin(ctx: TenantContext): boolean {
  return ctx.role === UserRole.GLOBAL_ADMIN || ctx.role === UserRole.UNIT_ADMIN;
}

const RESOURCE_TYPES: string[] = Object.values(GrantResourceType);
const PERMISSIONS: string[] = Object.values(Permission);

/**
 * Ordem canônica dos verbos, para a resposta de `GET /grants/received` ser
 * **determinística**: a ordem das linhas de `grants` não é garantida sem
 * `ORDER BY`, então sem isto as etiquetas de um mesmo item apareceriam ora
 * "Visualizar, Baixar", ora "Baixar, Visualizar", entre duas consultas iguais.
 * A ordem é a do enum `Permission` — do verbo menos ao mais invasivo —, a
 * mesma em que a tela de permissões os oferece.
 */
const PERMISSION_ORDER = new Map(PERMISSIONS.map((permission, index) => [permission, index]));

/** Coluna computada de vigência, mesmo predicado de `lib/access.ts` D1 — `now()` do banco. */
const EXPIRED_COLUMN = `(expires_at IS NOT NULL AND expires_at <= now()) AS expired`;

/**
 * `source_ref` do aviso de concessão (design.md D5): ancorado em **(recurso,
 * vencimento)**, nunca no id do grant nem no instante da execução. Uma
 * requisição com vários verbos sobre o mesmo recurso e prazo produz o mesmo
 * `source_ref`, logo uma única notificação (design.md D5/D8); mudar o prazo
 * muda o `source_ref`, logo notifica de novo.
 */
function grantSourceRef(
  resourceType: GrantResourceType,
  resourceId: string,
  expiresAt: Date,
): string {
  return `grant:${resourceType}:${resourceId}:${expiresAt.toISOString()}`;
}

/** Linha crua de concessão vigente recebida (`GET /grants/received`). */
interface ReceivedGrantRow {
  resource_type: string;
  resource_id: string;
  permission: string;
  expires_at: string | null;
  created_at: string;
}

/**
 * Candidato a item de "Compartilhados comigo": um **recurso**, com os verbos
 * vigentes que a pessoa tem sobre ele (design.md D5).
 */
interface SharedCandidate {
  resourceType: GrantResourceType;
  resourceId: string;
  permissions: SharedPermissionResponse[];
  /** Instante da concessão mais recente deste recurso, em ISO 8601 (UTC). */
  sharedAt: string;
}

/**
 * Candidatos a "compartilhado comigo", agrupados **por recurso** (design.md
 * D1/D5).
 *
 * A base é `grants`, **não** `resourceScopeClause`: aquele fragmento devolve
 * `TRUE` para quem é administrador da unidade da listagem — o que é correto
 * para a listagem de pasta e apresentaria **todo o acervo da unidade** ao
 * `unit_admin` sob o título "Compartilhados comigo". Quem seleciona aqui é a
 * concessão; `hasAccess` depois apenas confirma (design.md D2).
 *
 * `unit_id` é comparado explicitamente contra o contexto autenticado, e não
 * deixado só à RLS: para o `global_admin` o bypass é incondicional, e a trava
 * sobre rotas de conteúdo exige a comparação explícita (CLAUDE.md, "Trava do
 * bypass de `global_admin`"). `hasAccess` repete a trava depois, item a item —
 * duas guardas, de propósito, como em `routes/recent.ts` (design.md D3b).
 *
 * A vigência é avaliada no SQL pelo relógio **do banco** (design.md D6), de
 * modo que a concessão vencida sai da lista na requisição seguinte sem
 * depender de nenhuma rotina ter rodado.
 */
async function listReceivedCandidates(
  client: PoolClient,
  ctx: TenantContext,
): Promise<SharedCandidate[]> {
  const { rows } = await client.query<ReceivedGrantRow>(
    `SELECT resource_type, resource_id, permission, expires_at, created_at
     FROM grants
     WHERE subject_user_id = $1
       AND unit_id = $2
       AND (expires_at IS NULL OR expires_at > now())`,
    [ctx.userId, ctx.unitId],
  );

  const porRecurso = new Map<string, SharedCandidate>();
  for (const row of rows) {
    const chave = `${row.resource_type}:${row.resource_id}`;
    const concedidoEm = new Date(row.created_at).toISOString();
    const verbo: SharedPermissionResponse = {
      permission: row.permission as Permission,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    };
    const existente = porRecurso.get(chave);
    if (existente) {
      existente.permissions.push(verbo);
      // O item figura pela concessão **mais recente** entre as suas: um verbo
      // acrescentado hoje sobre recurso concedido meses atrás traz o item para
      // o topo, porque é esse o fato novo para quem recebeu.
      if (concedidoEm > existente.sharedAt) existente.sharedAt = concedidoEm;
      continue;
    }
    porRecurso.set(chave, {
      resourceType: row.resource_type as GrantResourceType,
      resourceId: row.resource_id,
      permissions: [verbo],
      sharedAt: concedidoEm,
    });
  }

  // Verbos em ordem canônica dentro de cada item, e itens em ordem de
  // compartilhamento: as duas ordens são do servidor, não do banco nem da SPA.
  for (const candidato of porRecurso.values()) {
    candidato.permissions.sort(
      (a, b) =>
        (PERMISSION_ORDER.get(a.permission) ?? 0) - (PERMISSION_ORDER.get(b.permission) ?? 0),
    );
  }

  // Ordena aqui, depois do agrupamento: ordenar no SQL daria a ordem das
  // *concessões*, e o que se ordena é o item. `toISOString()` é sempre UTC de
  // largura fixa, então a comparação lexicográfica é a cronológica. O id
  // desempata para a ordem ser determinística entre requisições.
  return [...porRecurso.values()].sort(
    (a, b) => b.sharedAt.localeCompare(a.sharedAt) || a.resourceId.localeCompare(b.resourceId),
  );
}

interface SharedFolderRow {
  id: string;
  name: string;
  folder_name: string | null;
}

/**
 * Detalhe das pastas sobreviventes. `owner_id <> $1` é a exclusão do que é da
 * própria pessoa (design.md D8), no SQL e não na apresentação: concessão sobre
 * recurso próprio é inerte na resolução de acesso — dono vence antes de
 * qualquer concessão —, e listá-la afirmaria que o acesso vem de
 * compartilhamento.
 *
 * O nome da pasta-mãe vem por subconsulta correlacionada, e **só** ele: a
 * trilha completa nomearia pastas que a pessoa não alcança (design.md D7).
 */
async function readSharedFolders(
  client: PoolClient,
  ctx: TenantContext,
  ids: string[],
): Promise<Map<string, SharedFolderRow>> {
  const { rows } = await client.query<SharedFolderRow>(
    `SELECT f.id, f.name,
            (SELECT p.name FROM folders p WHERE p.id = f.parent_id) AS folder_name
     FROM folders f
     WHERE f.id = ANY($2::uuid[]) AND f.owner_id <> $1`,
    [ctx.userId, ids],
  );
  return new Map(rows.map((row) => [row.id, row]));
}

type SharedFileRow = FileSummaryRow & { folder_name: string | null };

/**
 * Detalhe dos arquivos sobreviventes, pelo **mesmo** fragmento que a listagem
 * de pasta, a busca e os recentes usam (`fileSummaryColumns`): a linha nasce
 * com tipo, código e situação do controle documental, e `toFileSummaryResponse`
 * a entrega na forma que o `PreviewModal` consome (design.md D4).
 *
 * `fileSummaryColumns` projeta colunas **sem qualificação**, então a tabela não
 * recebe alias e a subconsulta da pasta-mãe qualifica `files.folder_id`
 * explicitamente — mesmo cuidado de `routes/recent.ts`. `$1` é referenciado
 * pelo `WHERE` em todos os casos, inclusive para admin (cujo fragmento de
 * alcance não o referencia), então não há placeholder sem uso.
 */
async function readSharedFiles(
  client: PoolClient,
  ctx: TenantContext,
  ids: string[],
): Promise<Map<string, SharedFileRow>> {
  const { rows } = await client.query<SharedFileRow>(
    `SELECT ${fileSummaryColumns(ctx, '$1')},
            (SELECT p.name FROM folders p WHERE p.id = files.folder_id) AS folder_name
     FROM files
     WHERE id = ANY($2::uuid[]) AND owner_id <> $1`,
    [ctx.userId, ids],
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * `routes/grants.ts` — conceder/listar/revogar permissão granular por
 * pessoa (US 4.1), restrito à administração (design.md D5). Mesma dupla
 * camada de `routes/users.ts`: a checagem de papel aqui barra o
 * `collaborator` de plano, e a RLS (`withTenantTransaction`) garante que
 * `unit_admin` nunca opere fora da própria unidade mesmo se a checagem de
 * aplicação falhasse.
 */
export function grantsRouter(ports: Ports): Router {
  const router = Router();

  router.post('/grants', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const body = req.body as CreateGrantRequest;
      if (
        !Array.isArray(body.subjectUserIds) ||
        body.subjectUserIds.length === 0 ||
        !body.subjectUserIds.every((id) => typeof id === 'string' && id.length > 0) ||
        !RESOURCE_TYPES.includes(body.resourceType) ||
        !body.resourceId ||
        !Array.isArray(body.permissions) ||
        body.permissions.length === 0 ||
        !body.permissions.every((permission) => PERMISSIONS.includes(permission))
      ) {
        res.status(400).json({ error: 'invalid request body' });
        return;
      }

      // Prazo opcional (design.md D1, tasks.md 4.1): ausente/nulo = permanente.
      // Quando informado, precisa ser uma data futura — validação de entrada,
      // distinta do relógio do banco usado depois na resolução de acesso.
      let expiresAt: Date | null = null;
      if (body.expiresAt !== undefined && body.expiresAt !== null) {
        const parsed = new Date(body.expiresAt);
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
          res.status(400).json({ error: 'invalid request body' });
          return;
        }
        expiresAt = parsed;
      }

      // Dedup preservando ordem de chegada (design.md D2/D3): o `CROSS JOIN`
      // sobre `unnest` recusaria a mesma linha duas vezes no mesmo comando, e
      // o teto de D4 precisa contar destinatários **distintos**.
      const subjectUserIds = Array.from(new Set(body.subjectUserIds));

      if (subjectUserIds.length > config.grants.maxSubjects) {
        const limitResponse: GrantSubjectsLimitExceededResponse = {
          error: 'grant_subjects_limit_exceeded',
          found: subjectUserIds.length,
          allowed: config.grants.maxSubjects,
        };
        res.status(413).json(limitResponse);
        return;
      }

      const outcome = await ports.database.withTenantTransaction(ctx, async (client) => {
        // RLS já restringe a leitura à unidade do admin (ou bypass de
        // global_admin) — recurso ou colaborador de outra unidade simplesmente
        // não aparecem aqui, sem distinguir "não existe" de "é de outra
        // unidade" (design.md D5: "sem vazar existência").
        const { rows: resourceRows } = await client.query<{ unit_id: string }>(
          `SELECT unit_id FROM ${resourceTable(body.resourceType)} WHERE id = $1`,
          [body.resourceId],
        );
        const resource = resourceRows[0];
        if (!resource) return { status: 404 as const };

        // Existência de todos os sujeitos numa única consulta (design.md D3):
        // a cardinalidade do resultado comparada com o conjunto deduplicado
        // decide tudo-ou-nada, sem apontar qual id falhou — recusa parcial
        // transformaria a rota num oráculo de existência de contas.
        const { rows: subjectRows } = await client.query<{ id: string; unit_id: string }>(
          'SELECT id, unit_id FROM users WHERE id = ANY($1)',
          [subjectUserIds],
        );
        if (subjectRows.length !== subjectUserIds.length) return { status: 404 as const };

        // Concessão comum não atravessa unidades (change
        // `compartilhamento-entre-unidades`, design.md D10, PRD US 5.2
        // cenário 8). Antes, o `global_admin` — cujo bypass de RLS enxerga
        // pessoas de toda unidade — gravava aqui uma concessão que a RLS
        // tornava inerte para a pessoa de destino, e a tela a apresentava como
        // se valesse. Recusa explícita, tudo ou nada; o caminho correto é o
        // compartilhamento entre unidades. Para o `unit_admin` nada muda: a
        // RLS já escondia a pessoa de outra unidade (404 acima).
        if (subjectRows.some((subject) => subject.unit_id !== resource.unit_id)) {
          return { status: 422 as const };
        }

        // Produto colaboradores × verbos num único INSERT ... SELECT sobre
        // unnest (design.md D2) — uma ida ao banco em vez de N×M, com a
        // mesma semântica de reconcessão de sempre (prazo informado
        // prevalece; sem prazo, torna permanente).
        const { rows } = await client.query<GrantRow>(
          `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
           SELECT $1, s.subject, $2, $3, p.permission, $4, $5
             FROM unnest($6::uuid[]) AS s(subject)
            CROSS JOIN unnest($7::text[]) AS p(permission)
           ON CONFLICT (unit_id, subject_user_id, resource_type, resource_id, permission)
           DO UPDATE SET expires_at = EXCLUDED.expires_at, granted_by = EXCLUDED.granted_by, created_at = now()
           RETURNING *, ${EXPIRED_COLUMN}`,
          [
            resource.unit_id,
            body.resourceType,
            body.resourceId,
            ctx.userId,
            expiresAt,
            subjectUserIds,
            body.permissions,
          ],
        );
        return { status: 201 as const, rows };
      });

      if (outcome.status === 422) {
        const crossUnit: CrossUnitSubjectResponse = { error: 'cross_unit_subject' };
        res.status(422).json(crossUnit);
        return;
      }
      if (outcome.status !== 201) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      // Aviso de concessão (design.md D5): só quando a operação envolve
      // prazo, emitido **após** o commit acima, fora da transação — um aviso
      // por destinatário, cada um em seu próprio try/catch, para que a falha
      // de um não afete os demais nem a concessão já efetivada. A fórmula do
      // `sourceRef` não muda: a idempotência do NotificationPort já é por
      // (destinatário, tipo, sourceRef), logo já é por destinatário.
      if (expiresAt) {
        const unitId = outcome.rows[0]!.unit_id;
        const sourceRef = grantSourceRef(body.resourceType, body.resourceId, expiresAt);
        for (const subjectUserId of subjectUserIds) {
          try {
            await ports.notifications.notify({
              unitId,
              recipientUserId: subjectUserId,
              kind: NotificationKind.GRANT_CREATED,
              payload: {
                resourceType: body.resourceType,
                resourceId: body.resourceId,
                permissions: body.permissions,
                expiresAt: expiresAt.toISOString(),
              },
              sourceRef,
            });
          } catch (err) {
            console.error('grants: falha ao emitir aviso grant_created', err);
          }
        }
      }

      const response: GrantListResponse = { grants: outcome.rows.map(toGrantResponse) };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  router.get('/grants', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const resourceType = req.query.resourceType;
      const resourceId = req.query.resourceId;
      if (
        typeof resourceType !== 'string' ||
        !RESOURCE_TYPES.includes(resourceType) ||
        typeof resourceId !== 'string' ||
        !resourceId
      ) {
        res.status(400).json({ error: 'invalid query' });
        return;
      }

      // Nenhum filtro de unidade aqui: a RLS já restringe unit_admin à
      // própria unidade e dá bypass a global_admin (mesmo padrão de
      // routes/users.ts). Expiradas permanecem na resposta, marcadas
      // (design.md D2) — sem ocultar, distinguindo pelo campo `expired`.
      const rows = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query<GrantRow>(
          `SELECT *, ${EXPIRED_COLUMN} FROM grants WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at`,
          [resourceType, resourceId],
        );
        return rows;
      });

      const response: GrantListResponse = { grants: rows.map(toGrantResponse) };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  /**
   * `GET /grants/received` — o que foi compartilhado comigo (US 4.4,
   * capability `compartilhados-comigo`).
   *
   * **Sem checagem de papel**, ao contrário das três rotas acima: esta é
   * leitura **auto-escopada**, e o requisito de `permissoes-granulares`
   * distingue administrar as concessões de um recurso — restrito a
   * `unit_admin`/`global_admin` — de ler as próprias. O alcance é garantido
   * pelo `subject_user_id = ctx.userId` da consulta de candidatos, não por
   * papel: não há parâmetro algum que permita pedir a lista de outra pessoa.
   *
   * Nenhuma auditoria (design.md D10): auditoria registra acesso a **bytes**, e
   * esta rota não serve bytes. O `view-url`/`download-url` acionado a partir do
   * item continua auditando separadamente, como em qualquer outro caminho.
   */
  router.get('/grants/received', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;

      const items = await ports.database.withTenantTransaction(ctx, async (client) => {
        const candidatos = await listReceivedCandidates(client, ctx);
        if (candidatos.length === 0) return [];

        // Composição das regras restritivas por `hasAccess`, item a item
        // (design.md D2) — **uma** chamada por recurso, não por verbo. As
        // regras restritivas (obsoleto, pendente de cadastro, lixeira, trava
        // do bypass) são propriedade do recurso, não do verbo; passando um
        // verbo que a pessoa comprovadamente tem, o ramo da concessão já é
        // verdadeiro por construção e o que resta avaliar é só a subtração.
        //
        // É deliberado que o filtro não apareça nesta consulta: reescrevê-lo
        // aqui seria a segunda expressão da regra de acesso, e duas expressões
        // divergem — com vazamento como sintoma, não erro.
        const permitidos: SharedCandidate[] = [];
        for (const candidato of candidatos) {
          const verbo = candidato.permissions[0]!.permission;
          if (await hasAccess(client, ctx, candidato.resourceType, candidato.resourceId, verbo)) {
            permitidos.push(candidato);
          }
        }
        if (permitidos.length === 0) return [];

        const idsDePasta = permitidos
          .filter((c) => c.resourceType === GrantResourceType.FOLDER)
          .map((c) => c.resourceId);
        const idsDeArquivo = permitidos
          .filter((c) => c.resourceType === GrantResourceType.FILE)
          .map((c) => c.resourceId);

        const pastas = idsDePasta.length
          ? await readSharedFolders(client, ctx, idsDePasta)
          : new Map<string, SharedFolderRow>();
        const arquivos = idsDeArquivo.length
          ? await readSharedFiles(client, ctx, idsDeArquivo)
          : new Map<string, SharedFileRow>();

        // A ordem é a dos candidatos, não a que o banco devolveu destas
        // segundas leituras. `flatMap` descarta o candidato sem linha — o
        // recurso próprio excluído por `owner_id <> $1` (design.md D8) e o que
        // desapareceu entre as duas leituras.
        return permitidos.flatMap<SharedWithMeItemResponse>((candidato) => {
          const comum = {
            resourceType: candidato.resourceType,
            id: candidato.resourceId,
            permissions: candidato.permissions,
            sharedAt: candidato.sharedAt,
          };

          if (candidato.resourceType === GrantResourceType.FOLDER) {
            const pasta = pastas.get(candidato.resourceId);
            if (!pasta) return [];
            return [{ ...comum, name: pasta.name, folderName: pasta.folder_name, file: null }];
          }

          const arquivo = arquivos.get(candidato.resourceId);
          if (!arquivo) return [];
          const resumo = toFileSummaryResponse(arquivo);
          return [
            {
              ...comum,
              name: resumo.fileName,
              folderName: arquivo.folder_name,
              file: resumo,
            },
          ];
        });
      });

      // Itens recebidos de outra unidade (change
      // `compartilhamento-entre-unidades`, design.md D12): só as raízes
      // compartilhadas, confirmadas em visita à unidade de origem. Mesclados
      // pela mesma ordem (mais recente primeiro, id desempata). A pasta que
      // contém o item de outra unidade não é nomeada (`folderName` nulo): ela
      // está fora do compartilhamento; a SPA mostra a unidade de origem.
      const recebidos = await listCrossUnitReceived(ports, ctx);
      const deOutraUnidade = recebidos.flatMap<SharedWithMeItemResponse>((item) => {
        const comum = {
          resourceType: item.resourceType,
          id: item.resourceId,
          permissions: [...item.permissions].sort(
            (a, b) =>
              (PERMISSION_ORDER.get(a.permission) ?? 0) - (PERMISSION_ORDER.get(b.permission) ?? 0),
          ),
          sharedAt: item.sharedAt,
          folderName: null,
          originUnit: { id: item.originUnitId, name: item.originUnitName },
        };
        if (item.folder) return [{ ...comum, name: item.folder.name, file: null }];
        if (!item.file) return [];
        const resumo = toFileSummaryResponse(item.file);
        return [{ ...comum, name: resumo.fileName, file: resumo }];
      });
      const todos = [
        ...items.map((item) => ({ ...item, originUnit: null })),
        ...deOutraUnidade,
      ].sort((a, b) => b.sharedAt.localeCompare(a.sharedAt) || a.id.localeCompare(b.id));

      const response: SharedWithMeResponse = { items: todos };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/grants/:id', async (req, res, next) => {
    try {
      const ctx = req.tenantContext!;
      if (!isAdmin(ctx)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      // RLS filtra a linha visível para DELETE antes do WHERE por id rodar:
      // grant de outra unidade não aparece, 0 linhas removidas. Revogar
      // permanece removendo a linha mesmo se já expirada (design.md D2).
      const deleted = await ports.database.withTenantTransaction(ctx, async (client) => {
        const { rows } = await client.query('DELETE FROM grants WHERE id = $1 RETURNING id', [
          req.params.id,
        ]);
        return rows[0] ?? null;
      });

      if (!deleted) {
        res.status(404).json({ error: 'not found' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
