import type { PoolClient } from 'pg';
import { GrantOrigin, GrantResourceType, Permission } from '@gdoc/shared';
import type { TenantContext } from '../ports/database-port.js';

/**
 * Posse e autoria de itens novos (change `posse-pelo-dono-da-pasta`,
 * capability `posse-e-autoria`).
 *
 * Regra única de posse (design.md D1): o dono de uma pasta ou arquivo recém-
 * criado é o **dono imediato** da pasta em que ele nasce; na raiz da unidade,
 * quem cria. Toda via de criação (`POST /folders`, `findOrCreateChild` do envio
 * de árvore, `upload-url`, `upload-urls`) passa por aqui — uma regra repetida
 * em cada rota é como as vias divergem.
 *
 * Não é herança de permissão: só decide o `owner_id` gravado no INSERT. Itens
 * existentes nunca mudam de dono por esta regra.
 */
export function resolveNewItemOwner(
  parent: { owner_id: string } | null,
  ctx: Pick<TenantContext, 'userId'>,
): string {
  return parent?.owner_id ?? ctx.userId;
}

/**
 * Verbos concedidos automaticamente ao autor que não é dono (design.md D4):
 * ver, baixar e renomear — `rename` é o que permite completar o cadastro de um
 * pendente (US 10.9) e substituir versão —, mais `upload` em pasta, para
 * continuar enviando dentro do que criou. **Nunca `delete`**: `DELETE
 * /folders/:id` varre a subárvore sem checar dono item a item, e o autor
 * apagaria também o que o dono e outras pessoas puseram ali depois.
 */
export function authorshipPermissions(resourceType: GrantResourceType): Permission[] {
  const base = [Permission.VIEW, Permission.DOWNLOAD, Permission.RENAME];
  return resourceType === GrantResourceType.FOLDER ? [...base, Permission.UPLOAD] : base;
}

/**
 * Concede ao autor os verbos de `authorshipPermissions` sobre o item que ele
 * acabou de criar, **quando ele não é o dono** — na mesma transação do INSERT
 * do item, para que recusa ou falha não deixe concessão órfã.
 *
 * Idempotente (`ON CONFLICT DO NOTHING` no índice único de `grants`): reenviar
 * o mesmo caminho, ou já ter recebido o verbo manualmente, não duplica nem
 * falha, e a linha existente é preservada. Sem prazo (`expires_at` nulo),
 * `origin = 'autoria'`, `granted_by = autor`. Não notifica: o autor acabou de
 * agir e sabe o que criou (spec `permissoes-granulares`).
 */
export async function grantAuthorship(
  client: PoolClient,
  ctx: Pick<TenantContext, 'userId'>,
  item: { unitId: string; ownerId: string; resourceType: GrantResourceType; resourceId: string },
): Promise<void> {
  if (item.ownerId === ctx.userId) return;
  await client.query(
    `INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, origin)
     SELECT $1, $2, $3, $4, p.permission, $2, $5
       FROM unnest($6::text[]) AS p(permission)
     ON CONFLICT (unit_id, subject_user_id, resource_type, resource_id, permission) DO NOTHING`,
    [
      item.unitId,
      ctx.userId,
      item.resourceType,
      item.resourceId,
      GrantOrigin.AUTHORSHIP,
      authorshipPermissions(item.resourceType),
    ],
  );
}
