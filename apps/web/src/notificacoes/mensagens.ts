import { GrantResourceType, NotificationKind } from '@gdoc/shared';
import type { NotificationResponse } from '@gdoc/shared';
import { VERB_LABEL } from '../permissoes/PermissoesModal';
import { formatDate } from '../navegacao/format';
import { formatarDataDeRevisao, formatarRevisao } from '../shell/document-control-labels';

const RESOURCE_LABEL: Record<GrantResourceType, string> = {
  [GrantResourceType.FOLDER]: 'pasta',
  [GrantResourceType.FILE]: 'arquivo',
};

/** Os três assuntos de leitura obrigatória (change `avisos-e-atrasos`, design.md D1). */
const KINDS_DE_LEITURA: readonly string[] = [
  NotificationKind.READING_ASSIGNED,
  NotificationKind.READING_OVERDUE,
  NotificationKind.READING_OVERDUE_TEAM,
];

export function ehAvisoDeLeitura(notification: NotificationResponse): boolean {
  return KINDS_DE_LEITURA.includes(notification.kind);
}

/**
 * Para onde o aviso leva, quando leva (design.md D5 de `avisos-e-atrasos`):
 * os do **leitor** abrem a lista das próprias leituras.
 */
export function destinoDaNotificacao(notification: NotificationResponse): string | null {
  if (
    notification.kind === NotificationKind.READING_ASSIGNED ||
    notification.kind === NotificationKind.READING_OVERDUE
  ) {
    return '/leituras';
  }
  // Aviso ao gestor leva ao relatório da marcação (change
  // `acompanhamento-de-leituras`, design.md D7).
  if (
    notification.kind === NotificationKind.READING_OVERDUE_TEAM &&
    'campaignId' in notification.payload
  ) {
    return `/leituras?aba=acompanhamento&marcacao=${notification.payload.campaignId}`;
  }
  return null;
}

/** Texto do link de destino — o do gestor abre o acompanhamento, não as próprias leituras. */
export function rotuloDoDestino(notification: NotificationResponse): string {
  return notification.kind === NotificationKind.READING_OVERDUE_TEAM
    ? 'Abrir acompanhamento'
    : 'Abrir leituras';
}

function nomes(people: { name: string; sectorName: string | null }[], total: number): string {
  const citados = people.map((p) => (p.sectorName ? `${p.name} (${p.sectorName})` : p.name));
  const resto = total - citados.length;
  return resto > 0 ? `${citados.join(', ')} e mais ${resto}` : citados.join(', ');
}

/**
 * Texto de uma notificação, origem única do sino e do cartão Avisos do Início
 * (change `avisos-e-atrasos`). O payload é união discriminada pelo `kind`
 * (US 10.9): ramificar antes de ler campos é o que mantém o canal aberto a
 * assuntos novos.
 *
 * `subjectUserId` (aviso de corte) não é resolvido a nome: a central aparece
 * em toda página do shell, e resolver nomes exigiria mais uma chamada sempre
 * ativa a `GET /users`.
 */
export function mensagemDaNotificacao(notification: NotificationResponse): string {
  const { payload } = notification;

  if (notification.kind === NotificationKind.REGISTRATION_PENDING) {
    const nome = 'fileName' in payload ? payload.fileName : 'um arquivo';
    return `${nome} está pendente de cadastro: informe tipo, código, revisão, responsável e próxima revisão para publicá-lo.`;
  }

  if ('documentCode' in payload) {
    const documento = `${payload.documentCode} - ${payload.documentTitle}, ${formatarRevisao(
      payload.documentRevision,
    )}`;
    const prazo = formatarDataDeRevisao(payload.dueDate);
    if ('lateCount' in payload) {
      const sujeito =
        payload.lateCount === 1
          ? '1 pessoa da sua equipe está'
          : `${payload.lateCount} pessoas da sua equipe estão`;
      return `${sujeito} com a leitura obrigatória de ${documento} atrasada (prazo ${prazo}): ${nomes(
        payload.people,
        payload.lateCount,
      )}.`;
    }
    if (notification.kind === NotificationKind.READING_OVERDUE) {
      return `Sua leitura obrigatória de ${documento} está atrasada: o prazo era ${prazo}. Ela continua aberta para você confirmar a ciência.`;
    }
    return `Nova leitura obrigatória: ${documento}. Prazo: ${prazo}.`;
  }

  if (!('resourceType' in payload)) return 'Notificação';

  const resource = RESOURCE_LABEL[payload.resourceType];
  const verbs = payload.permissions.map((permission) => VERB_LABEL[permission]).join(', ');
  const date = formatDate(payload.expiresAt);

  switch (notification.kind) {
    case NotificationKind.GRANT_CREATED:
      return `Você recebeu acesso (${verbs}) a este ${resource}, válido até ${date}.`;
    case NotificationKind.GRANT_EXPIRING:
      return `Seu acesso (${verbs}) a este ${resource} vence em ${date}.`;
    case NotificationKind.GRANT_EXPIRED:
      return `O acesso (${verbs}) de ${payload.subjectUserId ?? '—'} a este ${resource} foi encerrado em ${date}.`;
    default:
      return 'Notificação';
  }
}
