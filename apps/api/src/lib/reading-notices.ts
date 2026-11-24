import type { PoolClient } from 'pg';
import { NotificationKind, READING_TEAM_NOTICE_MAX_NAMES } from '@gdoc/shared';
import type {
  ReadingLatePerson,
  ReadingNotificationPayload,
  ReadingTeamOverdueNotificationPayload,
} from '@gdoc/shared';
import type { NotificationPort } from '../ports/notification-port.js';
import { READING_STATUS_SQL } from './reading.js';

/**
 * Avisos da leitura obrigatória (change `avisos-e-atrasos`): **quem** avisar e
 * **quando**. O meio de entrega é do `NotificationPort`; a garantia contra
 * duplicata é a do canal, por `(destinatário, tipo, evento de origem)`
 * (design.md D1). As consultas daqui selecionam só o que ainda não tem aviso,
 * para não refazer emissões a cada noite — economia, não garantia.
 *
 * Nenhuma função daqui grava situação: "Atrasada" é apurada na consulta
 * (`READING_STATUS_SQL`), e um aviso que não saiu atrasa só o aviso.
 */

export const assignedSourceRef = (assignmentId: string) => `reading-assigned:${assignmentId}`;
export const overdueSourceRef = (assignmentId: string, dueDate: string) =>
  `reading-overdue:${assignmentId}:${dueDate}`;
export const teamOverdueSourceRef = (campaignId: string, dueDate: string) =>
  `reading-overdue-team:${campaignId}:${dueDate}`;

export interface NoticeTally {
  notified: number;
  failed: number;
}

interface ReaderNoticeRow {
  assignment_id: string;
  unit_id: string;
  user_id: string;
  campaign_id: string;
  document_code: string;
  document_title: string;
  document_revision: number;
  due_date: string;
}

/** Junções da atribuição com a marcação, o arquivo (para a situação) e a pessoa ativa. */
const READER_FROM = `FROM reading_assignments a
  JOIN reading_campaigns c ON c.id = a.campaign_id
  LEFT JOIN files f ON f.id = c.file_id
  JOIN users u ON u.id = a.user_id AND u.status = 'active'`;

const READER_COLUMNS = `a.id AS assignment_id, a.unit_id, a.user_id, c.id AS campaign_id,
  c.document_code, c.document_title, c.document_revision,
  to_char(a.due_date, 'YYYY-MM-DD') AS due_date`;

function readerPayload(row: ReaderNoticeRow): ReadingNotificationPayload {
  return {
    assignmentId: row.assignment_id,
    campaignId: row.campaign_id,
    documentCode: row.document_code,
    documentTitle: row.document_title,
    documentRevision: Number(row.document_revision),
    dueDate: row.due_date,
  };
}

async function emitReaderNotices(
  notifications: NotificationPort,
  rows: ReaderNoticeRow[],
  kind: typeof NotificationKind.READING_ASSIGNED | typeof NotificationKind.READING_OVERDUE,
): Promise<NoticeTally> {
  const tally: NoticeTally = { notified: 0, failed: 0 };
  for (const row of rows) {
    try {
      await notifications.notify({
        // Unidade real da atribuição — nunca a do contexto de sistema.
        unitId: row.unit_id,
        recipientUserId: row.user_id,
        kind,
        payload: readerPayload(row),
        sourceRef:
          kind === NotificationKind.READING_ASSIGNED
            ? assignedSourceRef(row.assignment_id)
            : overdueSourceRef(row.assignment_id, row.due_date),
      });
      tally.notified += 1;
    } catch (err) {
      tally.failed += 1;
      console.error(`reading-notices: falha ao emitir ${kind} (${row.assignment_id})`, err);
    }
  }
  return tally;
}

/**
 * Atribuições **abertas** dentre `ids` — concluída ou encerrada não é novidade
 * (design.md D2). Consulta no contexto de quem chama.
 */
export async function readAssignedNotices(
  client: PoolClient,
  ids: string[],
): Promise<ReaderNoticeRow[]> {
  if (ids.length === 0) return [];
  const { rows } = await client.query<ReaderNoticeRow>(
    `SELECT ${READER_COLUMNS} ${READER_FROM}
     WHERE a.id = ANY($1::uuid[]) AND ${READING_STATUS_SQL} IN ('pending', 'late')`,
    [ids],
  );
  return rows;
}

/** Aviso de nova leitura (design.md D2). Falha ao avisar nunca propaga. */
export async function notifyAssigned(
  notifications: NotificationPort,
  rows: ReaderNoticeRow[],
): Promise<NoticeTally> {
  return emitReaderNotices(notifications, rows, NotificationKind.READING_ASSIGNED);
}

/** Atribuições abertas, de qualquer unidade, que ainda não têm aviso de nova leitura. */
export async function readMissingAssignedNotices(client: PoolClient): Promise<ReaderNoticeRow[]> {
  const { rows } = await client.query<ReaderNoticeRow>(
    `SELECT ${READER_COLUMNS} ${READER_FROM}
     WHERE ${READING_STATUS_SQL} IN ('pending', 'late')
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.recipient_user_id = a.user_id AND n.kind = $1
           AND n.source_ref = 'reading-assigned:' || a.id::text)`,
    [NotificationKind.READING_ASSIGNED],
  );
  return rows;
}

/** Atribuições atrasadas, de qualquer unidade, sem aviso de atraso para o prazo atual. */
export async function readMissingOverdueNotices(client: PoolClient): Promise<ReaderNoticeRow[]> {
  const { rows } = await client.query<ReaderNoticeRow>(
    `SELECT ${READER_COLUMNS} ${READER_FROM}
     WHERE ${READING_STATUS_SQL} = 'late'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.recipient_user_id = a.user_id AND n.kind = $1
           AND n.source_ref = 'reading-overdue:' || a.id::text || ':'
             || to_char(a.due_date, 'YYYY-MM-DD'))`,
    [NotificationKind.READING_OVERDUE],
  );
  return rows;
}

/** Aviso de atraso ao leitor, um por leitura e prazo (design.md D1). */
export async function notifyOverdue(
  notifications: NotificationPort,
  rows: ReaderNoticeRow[],
): Promise<NoticeTally> {
  return emitReaderNotices(notifications, rows, NotificationKind.READING_OVERDUE);
}

interface TeamNoticeRow {
  manager_id: string;
  unit_id: string;
  campaign_id: string;
  document_code: string;
  document_title: string;
  document_revision: number;
  due_date: string;
  late_count: string;
  people: ReadingLatePerson[];
}

/**
 * Atrasos agregados por (gestor, marcação, prazo), ainda sem aviso (design.md
 * D3). Gestor: ativo, **da unidade do leitor**, diferente dele, com
 * acompanhamento da unidade (ou de todas) ou do setor do leitor. A igualdade de
 * `unit_id` é o que impede o alcance "todas as unidades" de receber nome de
 * pessoa de outra unidade.
 */
export async function readMissingTeamOverdueNotices(client: PoolClient): Promise<TeamNoticeRow[]> {
  const { rows } = await client.query<TeamNoticeRow>(
    `SELECT g.id AS manager_id, a.unit_id, c.id AS campaign_id,
            c.document_code, c.document_title, c.document_revision,
            to_char(a.due_date, 'YYYY-MM-DD') AS due_date,
            count(*) AS late_count,
            json_agg(
              json_build_object(
                'name', COALESCE(NULLIF(u.full_name, ''), u.email),
                'sectorName', s.name)
              ORDER BY lower(COALESCE(NULLIF(u.full_name, ''), u.email))
            ) AS people
     ${READER_FROM}
     LEFT JOIN sectors s ON s.id = u.sector_id
     JOIN users g ON g.unit_id = a.unit_id
       AND g.status = 'active'
       AND g.id <> u.id
       AND (g.reading_oversight IN ('unit', 'all_units')
            OR (g.reading_oversight = 'sector' AND g.sector_id = u.sector_id))
     WHERE ${READING_STATUS_SQL} = 'late'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.recipient_user_id = g.id AND n.kind = $1
           AND n.source_ref = 'reading-overdue-team:' || c.id::text || ':'
             || to_char(a.due_date, 'YYYY-MM-DD'))
     GROUP BY g.id, a.unit_id, c.id, c.document_code, c.document_title,
              c.document_revision, a.due_date`,
    [NotificationKind.READING_OVERDUE_TEAM],
  );
  return rows;
}

/** Aviso agregado de atraso da equipe, um por gestor, marcação e prazo (design.md D3). */
export async function notifyTeamOverdue(
  notifications: NotificationPort,
  rows: TeamNoticeRow[],
): Promise<NoticeTally> {
  const tally: NoticeTally = { notified: 0, failed: 0 };
  for (const row of rows) {
    const payload: ReadingTeamOverdueNotificationPayload = {
      campaignId: row.campaign_id,
      documentCode: row.document_code,
      documentTitle: row.document_title,
      documentRevision: Number(row.document_revision),
      dueDate: row.due_date,
      lateCount: Number(row.late_count),
      people: row.people.slice(0, READING_TEAM_NOTICE_MAX_NAMES),
    };
    try {
      await notifications.notify({
        unitId: row.unit_id,
        recipientUserId: row.manager_id,
        kind: NotificationKind.READING_OVERDUE_TEAM,
        payload,
        sourceRef: teamOverdueSourceRef(row.campaign_id, row.due_date),
      });
      tally.notified += 1;
    } catch (err) {
      tally.failed += 1;
      console.error(`reading-notices: falha ao avisar gestor (${row.campaign_id})`, err);
    }
  }
  return tally;
}
