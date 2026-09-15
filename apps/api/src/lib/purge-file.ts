import { GrantResourceType } from '@gdoc/shared';
import type { DatabasePort, TenantContext } from '../ports/database-port.js';
import type { StoragePort } from '../ports/storage-port.js';

/**
 * Colunas de um arquivo necessárias ao expurgo. A **seleção** dos arquivos
 * fica deliberadamente fora daqui (change `esvaziar-lixeira`, design.md D3):
 * o job seleciona por `deleted_at` vencido, cross-unit, com contexto de
 * sistema; a rota seleciona por dono, sem prazo, no contexto de unidade do
 * solicitante. A diferença entre as duas pontas é inteiramente a consulta de
 * seleção, e é nela que deve ficar visível.
 */
export interface PurgeableFile {
  id: string;
  owner_id: string;
  object_path: string;
  pending_object_path: string | null;
  size_bytes: string | null;
}

/**
 * Expurgo permanente de **um** arquivo, na ordem que codifica os invariantes
 * do change `epico-6-lixeira-retencao` (design.md D6/D8/D10 de lá; D3 de
 * `esvaziar-lixeira`):
 *
 * ```
 *   1. bytes do objeto      ─┐
 *   2. bytes do pending      │  idempotente, ANTES da linha: nunca deixar
 *      (substituição órfã)  ─┘  linha viva apontando bytes removidos
 *   3. cota devolvida ao dono
 *   4. auditoria do arquivo
 *   5. grants órfãos
 *   6. a linha do arquivo, por último
 * ```
 *
 * Não captura exceção: **quem chama** decide a tolerância a falha por item.
 * Uma falha em `deleteObject` aborta este arquivo antes de qualquer escrita
 * no banco, então a linha permanece íntegra na lixeira e reentra no ciclo
 * seguinte (job) ou numa nova tentativa (rota).
 *
 * Devolve os bytes devolvidos à cota do dono, para quem chama somar.
 */
export async function purgeFile(
  database: DatabasePort,
  storage: StoragePort,
  ctx: TenantContext,
  file: PurgeableFile,
): Promise<number> {
  // 1-2. Bytes primeiro (idempotente): também o objeto órfão de uma
  // substituição abandonada (`pending_object_path`), se houver.
  await storage.deleteObject(file.object_path);
  if (file.pending_object_path) {
    await storage.deleteObject(file.pending_object_path);
  }

  const sizeBytes = Number(file.size_bytes ?? '0');

  await database.withTenantTransaction(ctx, async (client) => {
    // 3. Cota devolvida ao dono.
    await client.query(
      'UPDATE users SET storage_used_bytes = storage_used_bytes - $1 WHERE id = $2',
      [sizeBytes, file.owner_id],
    );
    // 4. Auditoria do arquivo expurgado — o FK também tem ON DELETE CASCADE
    // (migração 0008) como rede de segurança, mas o passo explícito segue a
    // ordem do design.
    await client.query('DELETE FROM audit_events WHERE file_id = $1', [file.id]);
    // 5. Grants órfãos.
    await client.query('DELETE FROM grants WHERE resource_type = $1 AND resource_id = $2', [
      GrantResourceType.FILE,
      file.id,
    ]);
    // 6. A linha por último.
    await client.query('DELETE FROM files WHERE id = $1', [file.id]);
  });

  return sizeBytes;
}
