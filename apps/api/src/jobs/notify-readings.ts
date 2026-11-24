import { UserRole } from '@gdoc/shared';
import { createPorts, type Ports } from '../ports/index.js';
import type { TenantContext } from '../ports/database-port.js';
import { reconcileAll } from '../lib/reading.js';
import {
  notifyAssigned,
  notifyOverdue,
  notifyTeamOverdue,
  readMissingAssignedNotices,
  readMissingOverdueNotices,
  readMissingTeamOverdueNotices,
} from '../lib/reading-notices.js';

// Papel de sistema, mesmo bypass de `jobs/notify-expiring-grants.ts`: a
// `unitId` é irrelevante para a varredura entre unidades; cada atribuição
// criada herda a unidade da marcação, e cada aviso usa a unidade real da
// atribuição — nunca este placeholder.
const SYSTEM_CTX: TenantContext = {
  unitId: '00000000-0000-0000-0000-000000000000',
  userId: '00000000-0000-0000-0000-000000000000',
  role: UserRole.GLOBAL_ADMIN,
};

export interface NotifyReadingsSummary {
  reconciled: number;
  assignedNotified: number;
  overdueNotified: number;
  teamNotified: number;
  failed: number;
}

/**
 * Rotina diária de leitura obrigatória (change `avisos-e-atrasos`, design.md
 * D4), às 03:45 em produção. Em ordem:
 *
 * 1. reconcilia o público de todas as marcações em curso — quem entrou depois
 *    recebe a pendência com 15 dias (demanda 3.3);
 * 2. avisa as leituras abertas que ainda não têm aviso de nova leitura;
 * 3. avisa o atraso ao leitor, uma vez por leitura e prazo;
 * 4. avisa o atraso aos gestores, agregado por marcação e prazo.
 *
 * Propositalmente "burra", como a rotina de concessões: sem estado próprio,
 * reexecutável a qualquer momento. A idempotência é do canal; a rotina não
 * grava situação, e não rodar atrasa só o aviso.
 */
export async function runNotifyReadings(
  ports: Pick<Ports, 'database' | 'notifications'>,
): Promise<NotifyReadingsSummary> {
  const reconciled = await ports.database.withTenantTransaction(SYSTEM_CTX, (client) =>
    reconcileAll(client),
  );

  const pendentes = await ports.database.withTenantTransaction(SYSTEM_CTX, (client) =>
    readMissingAssignedNotices(client),
  );
  const novas = await notifyAssigned(ports.notifications, pendentes);

  const atrasadas = await ports.database.withTenantTransaction(SYSTEM_CTX, (client) =>
    readMissingOverdueNotices(client),
  );
  const atrasos = await notifyOverdue(ports.notifications, atrasadas);

  const equipes = await ports.database.withTenantTransaction(SYSTEM_CTX, (client) =>
    readMissingTeamOverdueNotices(client),
  );
  const gestores = await notifyTeamOverdue(ports.notifications, equipes);

  return {
    reconciled: reconciled.length,
    assignedNotified: novas.notified,
    overdueNotified: atrasos.notified,
    teamNotified: gestores.notified,
    failed: novas.failed + atrasos.failed + gestores.failed,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ports = createPorts();
  runNotifyReadings(ports)
    .then(async (s) => {
      console.log(
        `Avisos de leitura obrigatória concluídos: ${s.reconciled} pendência(s) nova(s) por reconciliação, ` +
          `${s.assignedNotified} aviso(s) de nova leitura, ${s.overdueNotified} de atraso ao leitor, ` +
          `${s.teamNotified} de atraso ao gestor (${s.failed} falha(s)).`,
      );
      await ports.database.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await ports.database.close();
      process.exit(1);
    });
}
