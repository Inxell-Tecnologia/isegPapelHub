# Tasks

> Não há tarefas de infraestrutura (Terraform/GCP) nem de paridade dev
> (SessionStart hook): a mudança é só de banco (migration aplicada pelo mesmo
> `npm run migrate`), API, shared e SPA.

## 1. Banco e tipos compartilhados

- [x] 1.1 Criar `apps/api/src/db/migrations/0028_autoria_e_posse.sql`: `folders.created_by` e `files.uploaded_by` (FK `users`), backfill `= owner_id`, `SET NOT NULL`; trigger `BEFORE INSERT` que preenche a autoria com `owner_id` quando nula (design.md Migration Plan); `grants.origin` (`manual`/`autoria`, default `manual`); `'upload'` no `CHECK` de `audit_events.action`. Verificar com `npm run migrate --workspace apps/api` em base nova e em base já semeada, e com `rls-isolation.test.ts` verde
- [x] 1.2 Em `packages/shared`: `AuditAction.UPLOAD`, `ownedByRequester` na resposta de conteúdo de pasta, `origin` no DTO de concessão, código `owner_quota_exceeded`; verificar com `npm run build --workspace packages/shared`

## 2. Regra de posse, autoria e concessões automáticas (API)

- [x] 2.1 Criar em `apps/api/src/lib/` o helper de dono (`resolveNewItemOwner`, design.md D1) e o de concessões por autoria (`grantAuthorship`, D4: verbos por tipo, nunca `delete`, `origin = 'autoria'`, `granted_by = autor`, `ON CONFLICT DO NOTHING`, sem notificação); testes unitários dos dois cobrindo pasta, arquivo, raiz, autor = dono (sem grant) e idempotência
- [x] 2.2 `POST /folders`: autorizar a pasta-pai por `validateAnchor` (normalizando 404 → 403, D2), gravar `owner_id` pelo D1, `created_by = ctx.userId` e concessões automáticas na mesma transação; testes: colaborador com `upload` cria na pasta alheia (dono = dono da pasta-pai, autor = colaborador, grants corretos), admin da unidade cria, sem grant → 403, grant expirado → 403, pasta de outra unidade → 403 indistinguível, nome com `Ç`, `°` e `/` criado como uma única pasta
- [x] 2.3 `findOrCreateChild`/`ensureFolderPath` (`lib/folder-tree.ts`): dono por nível pelo D1, `created_by` e concessões automáticas só para pasta efetivamente criada; pasta reaproveitada sem alteração; testes de árvore para pasta alheia, própria e raiz, e reenvio sem duplicar pasta nem grant
- [x] 2.4 `upload-url` e `upload-urls`: `owner_id` = dono da pasta-folha, `uploaded_by = ctx.userId`, concessões automáticas no arquivo `pending`; retomada de `pending` por código passa a comparar `uploaded_by` (D3); testes de envio avulso, lote e retomada por quem enviou para pasta alheia
- [x] 2.5 Pendente de cadastro: trocar `owner_id` por `uploaded_by` na exceção de `hasAccess` (`lib/access.ts`) e em `visibleRegistrationClause` (`lib/document-control.ts`), mantendo os comentários de rastro (US 10.9); testes: autor não-dono vê o próprio pendente por listagem, busca, acesso direto e manifesto; dono não-admin não vê; admin vê; demais cenários de `controle-documental` seguem verdes
- [x] 2.6 Garantir que `permission.test.ts`, `isolamento-unidade.test.ts`, `expiracao-permissoes-acesso.test.ts` e `compartilhamento-entre-unidades.test.ts` continuam verdes e acrescentar: dono não-admin vê e exclui arquivo depositado por colaborador; autor não consegue excluir (sem `delete`); posse da pasta não dá acesso a item antigo de terceiro (sem herança)

## 3. Cota do futuro dono (API)

- [x] 3.1 `upload-url`: cota efetiva e reserva do dono resolvido; `owner_quota_exceeded` sem números quando dono ≠ solicitante (D5); testes: colaborador com cota esgotada envia para pasta com espaço; espaço do dono insuficiente → `owner_quota_exceeded` sem valores
- [x] 3.2 `upload-urls`: reserva por dono (`Map`), erro por item `owner_quota_exceeded` quando aplicável; testes dos cenários novos de `envio-lote` e dos já existentes
- [x] 3.3 `replace-url`: pré-checagem pela cota de `file.owner_id`, alinhada à reconciliação; teste de substituição por quem tem `rename` sobre arquivo alheio
- [x] 3.4 Confirmar por teste que a reconciliação soma o consumo no dono e que `GET /files/quota` do colaborador não inclui o que ele enviou para pasta alheia

## 4. Auditoria e listagem de concessões (API)

- [x] 4.1 Reconciliação de arquivo novo grava evento `upload` com `user_id = uploaded_by` (D7); testes: evento registrado com o autor; envio não reconciliado não gera evento; `GET` de auditoria do arquivo não retorna `upload`
- [x] 4.2 Listagem de concessões do recurso devolve `origin`; teste de que a concessão automática aparece marcada, sem prazo, e é revogável por admin (autor perde o acesso na requisição seguinte)
- [x] 4.3 `GET /folders/:id/contents` e `/folders/root/contents` devolvem `ownedByRequester` (D6); teste para pasta própria, alheia e raiz

## 5. SPA

- [x] 5.1 `upload/`: com `ownedByRequester = false`, pular a comparação numérica e ir ao resumo com confirmação; tratar `owner_quota_exceeded` por item com a mensagem do responsável pela pasta, sem números nem decomposição, e sem o pause-and-retry de cota própria; testes em `upload.test.tsx`
- [x] 5.2 `permissoes/`: rótulo "Automática (autoria)" para `origin = 'autoria'`; teste do componente
- [x] 5.3 `navegacao/`: conferir que "Nova pasta" em pasta alheia com `upload` cria a pasta e que o 403 continua com o aviso atual; teste em `explorer.test.tsx`

## 6. Documentação do usuário

- [x] 6.1 `docs/manual/docs/colaborador/navegar-e-criar.md`: criar pasta dentro de pasta de outra pessoa (requer permissão de envio), quem fica dono, o que o autor continua podendo fazer (ver, baixar, renomear, enviar dentro; não excluir)
- [x] 6.2 `docs/manual/docs/colaborador/enviar.md`: envio para pasta de outra pessoa consome o espaço do dono, a mensagem de recusa correspondente, e o pendente de cadastro que fica invisível ao dono até ser completado
- [x] 6.3 Página de permissões do administrador em `docs/manual/docs/administrador/`: concessões automáticas por autoria (o que são, sem prazo, como revogar)

## 7. Integração

- [x] 7.1 Rodar `npm run lint`, `npm run build`, `npm run test` e `npm run format:check` na raiz, todos verdes
- [x] 7.2 Validar o change com `openspec validate posse-pelo-dono-da-pasta` e reproduzir o cenário original pela app (colaborador com `upload` cria "PRESTAÇÃO DE CONTAS ITABUNA - TF N° 001/2025" na pasta de outra pessoa), confirmando dono, autor e concessões

## Workflow follow-up

- Arquivar o change (`/opsx:archive`) após revisão e merge, sincronizando as specs em `openspec/specs/`.
