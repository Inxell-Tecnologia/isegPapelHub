import type { Ports } from '../ports/index.js';
import { QUOTA_COLUMNS, resolveQuotaBytes, type QuotaRow } from './quota.js';
import type {
  StorageFinalizeNotification,
  PubSubPushEnvelope,
  GcsObjectMetadata,
} from '@gdoc/shared';

/** Unidade "de sistema" usada para reconciliar cota fora de um tenant específico. */
export const SYSTEM_UNIT = '00000000-0000-0000-0000-000000000000';

/**
 * Normaliza o corpo do POST de finalização para o formato interno
 * `{ objectPath, sizeBytes }`. Aceita dois transportes (design.md D1):
 *
 * - **Envelope de push do Pub/Sub** (produção): `message.data` em base64 →
 *   metadata do GCS (`JSON_API_V1`) → `name → objectPath`, `Number(size) →
 *   sizeBytes`. O `name` do GCS já é a chave do objeto no bucket
 *   (`{unit_id}/{owner_id}/{uuid}`), idêntica ao `object_path` gravado em `files`.
 * - **Payload simplificado** (dev/E2E): `{ objectPath, sizeBytes }` direto.
 *
 * Retorna `null` para payload realmente inválido (que o chamador traduz em 400).
 */
export function normalizeFinalizeNotification(body: unknown): StorageFinalizeNotification | null {
  if (!body || typeof body !== 'object') return null;

  const envelope = body as Partial<PubSubPushEnvelope>;
  if (envelope.message && typeof envelope.message.data === 'string') {
    let metadata: Partial<GcsObjectMetadata>;
    try {
      const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf-8');
      metadata = JSON.parse(decoded) as Partial<GcsObjectMetadata>;
    } catch {
      return null;
    }
    const objectPath = metadata?.name;
    const sizeBytes = Number(metadata?.size);
    if (!objectPath || !Number.isFinite(sizeBytes)) return null;
    return { objectPath, sizeBytes, bucket: metadata.bucket };
  }

  const simple = body as Partial<StorageFinalizeNotification>;
  if (!simple.objectPath || !Number.isFinite(simple.sizeBytes)) return null;
  return { objectPath: simple.objectPath, sizeBytes: simple.sizeBytes as number };
}

export interface ReconcileResult {
  /** `false` = nenhum arquivo casou o objectPath (evento duplicado/objeto órfão). */
  found: boolean;
  /** `true` se a nova soma de uso ultrapassou a cota da pessoa. */
  overQuota: boolean;
}

/**
 * Reconciliação pós-upload: casa o objeto finalizado com o registro em `files`,
 * soma o uso real da pessoa e promove o status (`pending → active`,
 * `replacing → active`), tratando a substituição sem contar em dobro. Idempotente
 * por status: reprocessar um objeto já `active` não altera nada (o SELECT não
 * casa mais um registro `pending`/`replacing`). Reusado pelo endpoint de push e
 * pelo backfill (design.md D4) para não duplicar a regra.
 */
export async function reconcileFinalize(
  ports: Ports,
  notification: StorageFinalizeNotification,
): Promise<ReconcileResult> {
  const { objectPath, sizeBytes } = notification;

  return ports.database.withTenantTransaction(
    { unitId: SYSTEM_UNIT, userId: SYSTEM_UNIT, role: 'global_admin' },
    async (client) => {
      const { rows } = await client.query<{
        id: string;
        owner_id: string;
        unit_id: string;
        status: string;
        size_bytes: string | null;
      }>(
        // Upload novo finaliza no próprio `object_path`; substituição finaliza
        // no `pending_object_path` (o `object_path` vivo só é promovido aqui —
        // ver routes/files.ts, POST /files/:id/replace-url).
        'SELECT id, owner_id, unit_id, status, size_bytes FROM files WHERE object_path = $1 OR pending_object_path = $1',
        [objectPath],
      );
      const file = rows[0];
      if (!file) return { found: false, overQuota: false };

      // `status = 'replacing'` marca uma substituição em andamento: a linha
      // ainda guarda o `size_bytes` da versão vigente, então só o delta (nova −
      // antiga) precisa ser somado — a versão antiga já estava contada em
      // `storage_used_bytes` (design.md D6, "sem contar em dobro"). Upload novo
      // (status 'pending') soma o total, como antes.
      const isReplace = file.status === 'replacing';
      const oldSize = Number(file.size_bytes ?? '0');
      const delta = isReplace ? sizeBytes - oldSize : sizeBytes;

      const { rows: userRows } = await client.query<{ storage_used_bytes: string } & QuotaRow>(
        `SELECT ${QUOTA_COLUMNS} FROM users WHERE id = $1`,
        [file.owner_id],
      );
      const newUsage = Number(userRows[0]?.storage_used_bytes ?? '0') + delta;
      // Cota efetiva do **dono do arquivo**, não de quem disparou a
      // reconciliação: o finalize chega do Pub/Sub, sem sessão de usuário
      // (change `cota-por-usuario`, spec `cota-individual`).
      const overQuota = newUsage > resolveQuotaBytes(userRows[0]);

      await client.query('UPDATE users SET storage_used_bytes = $1 WHERE id = $2', [
        newUsage,
        file.owner_id,
      ]);
      if (isReplace) {
        // Só agora o ponteiro vivo passa a apontar para o objeto novo, que enfim
        // existe; `pending_object_path` é limpo. Se a substituição tivesse sido
        // abandonada, nada disto rodaria e o `object_path` original continuaria válido.
        await client.query(
          `UPDATE files SET object_path = pending_object_path, pending_object_path = NULL,
             size_bytes = $1, status = $2 WHERE id = $3`,
          [sizeBytes, overQuota ? 'over_quota' : 'active', file.id],
        );
        await client.query(
          'INSERT INTO audit_events (unit_id, user_id, file_id, action) VALUES ($1, $2, $3, $4)',
          [file.unit_id, file.owner_id, file.id, 'replace'],
        );
      } else {
        await client.query('UPDATE files SET size_bytes = $1, status = $2 WHERE id = $3', [
          sizeBytes,
          overQuota ? 'over_quota' : 'active',
          file.id,
        ]);
      }

      return { found: true, overQuota };
    },
  );
}
