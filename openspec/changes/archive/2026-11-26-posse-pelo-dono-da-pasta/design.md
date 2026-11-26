# Design

## Context

Ver proposal.md (Why). Estado atual relevante:

- `POST /folders` (`routes/folders.ts`) recusa com 403 toda pasta-pai cujo
  `owner_id ≠ ctx.userId` — nem admin da unidade nem grant `upload` passam.
- O envio (`upload-url`, `upload-urls`) já aceita pasta de terceiro com `upload`
  via `validateAnchor` (`lib/folder-tree.ts`), e o envio de árvore já cria pastas
  intermediárias em `findOrCreateChild` — ambos gravam `owner_id = ctx.userId`.
- `owner_id` acumula dois significados: **dono** (acesso em `hasAccess`, mover em
  `canReorganize`, cota na reconciliação) e **quem enviou** (pendente de cadastro
  em `hasAccess` e `visibleRegistrationClause`; retomada de `pending` por código em
  `upload-url`/`upload-urls`).
- Cota: a **reconciliação** (`lib/storage-reconcile.ts`) já soma o consumo em
  `file.owner_id`; a **pré-checagem** na emissão de URL usa `ctx.userId` (envio
  avulso, lote e `replace-url`). Hoje coincidem no envio, mas já divergem na
  substituição feita por quem tem `rename` sobre arquivo alheio.
- Gestão de concessões é exclusiva de `unit_admin`/`global_admin`
  (`permissoes-granulares`).

## Goals / Non-Goals

**Goals:**
- Uma única função decide o dono de um item novo, usada por todas as vias de
  criação.
- Separar posse (`owner_id`) de autoria (`created_by`/`uploaded_by`) e migrar cada
  uso de `owner_id` para o significado correto.
- Pré-checagem e reconciliação de cota olham para a mesma pessoa.
- Nenhum invariante de isolamento muda: sem herança, fail-closed, RLS por
  `unit_id`, trava do bypass do `global_admin`.

**Non-Goals:**
- Migrar a posse de itens antigos.
- Revogação pelo dono não-admin; "Enviado por" no explorador.
- Exigir `upload` sobre pastas intermediárias reaproveitadas no envio de árvore.

## Decisions

### D1. Dono = dono imediato da pasta em que o item nasce

`resolveNewItemOwner(parent: FolderRow | null, ctx) → ownerId`: `parent?.owner_id
?? ctx.userId`. Chamada em `POST /folders`, `findOrCreateChild` (a cada nível,
com o pai recém-resolvido), `upload-url` e `upload-urls` (pasta-folha devolvida
por `ensureFolderPath`). Como a pasta criada num nível já carrega o dono do nível
acima, a cascata é natural: toda a árvore enviada para a pasta de Daniel é de
Daniel.

*Alternativa descartada:* "dono da pasta-âncora do envio" para a árvore inteira —
diverge do dono imediato quando o caminho reaproveita uma pasta de outra pessoa.
*Alternativa descartada:* herança por ancestral em `hasAccess` (quebra o
invariante "sem herança" e exige walk recursivo em toda checagem).

### D2. Autorização de `POST /folders` reusa `validateAnchor`

A pasta-pai passa a ser validada pela mesma `validateAnchor` (dono OU admin da
unidade OU `upload` vigente, via `hasAccess`) que o envio já usa. O retorno de
pasta inexistente (`404` em `validateAnchor`) é normalizado para **403** nesta
rota, preservando o comportamento indistinguível já especificado.

### D3. Autoria em colunas próprias, imutáveis

Migration `0028_autoria_e_posse.sql`:
- `folders.created_by uuid REFERENCES users(id)` e `files.uploaded_by uuid
  REFERENCES users(id)`; backfill `= owner_id`; depois `SET NOT NULL`.
- Gravadas só no `INSERT`; nenhum `UPDATE` (mover, renomear, substituir, restaurar)
  as toca. A retomada de `pending` reaproveita a linha e não reescreve a autoria.
- RLS: as tabelas já têm policy por `unit_id`; colunas novas não pedem policy.

Usos de `owner_id` que passam a usar autoria:

| Local | Hoje | Passa a |
|---|---|---|
| `hasAccess` — exceção do pendente (US 10.9) | `owner_id ≠ ctx.userId` | `uploaded_by ≠ ctx.userId` |
| `visibleRegistrationClause` | `owner_id = $user` | `uploaded_by = $user` |
| retomada de `pending` por código (`upload-url`, `upload-urls`) | `occupant.owner_id = ctx.userId` | `occupant.uploaded_by = ctx.userId` |
| evento `replace` na reconciliação | `user_id = owner_id` | inalterado (fora de escopo) |

`visibleRegistrationClause` continua composta com `visibleResourceClause` (que
filtra por posse/grant/admin), então a troca é só da coluna e segue restritiva.

### D4. Concessões automáticas: verbos, origem e quem concedeu

- Verbos: `view`, `download`, `rename` (+ `upload` para pasta). `rename` é o que
  permite ao autor **completar o cadastro** do pendente e substituir versão (rotas
  de controle documental e `replace-url` exigem `rename`). `delete` nunca:
  `DELETE /folders/:id` varre a subárvore sem checar dono item a item.
- Migration `0028`: `grants.origin text NOT NULL DEFAULT 'manual' CHECK (origin IN
  ('manual','autoria'))`. `granted_by = autor` (a coluna é `NOT NULL` e o autor é
  quem disparou o ato); a listagem mostra a origem.
- Inseridas por um helper `grantAuthorship(client, ctx, type, id, verbs)` com
  `ON CONFLICT DO NOTHING` sobre o índice único existente — idempotente em reenvio
  e em concessão manual prévia/posterior (a linha existente é preservada; a origem
  da primeira concessão prevalece).
- Na **mesma transação** do `INSERT` do item: falha ou recusa não deixa grant
  órfão. No envio de arquivo, o grant nasce com a linha `pending`; a remoção
  definitiva do arquivo (`lib/purge-file.ts`, `jobs/purge-trash.ts`) já apaga as
  concessões do recurso.
- Sem chamada ao `NotificationPort`.
- Gestão continua restrita à administração; o dono não-admin não revoga.

### D5. Cota do futuro dono, com reserva por dono

- `upload-url`: lê `QUOTA_COLUMNS` e a reserva de `pending/replacing` do **dono
  resolvido** (D1).
- `upload-urls`: mantém um `Map<ownerId, {base, quota, reserved}>` carregado sob
  demanda; cada item consulta e incrementa a entrada do seu dono. Em geral o lote
  inteiro tem um único dono.
- `replace-url`: passa a ler a cota de `file.owner_id` — alinhando a pré-checagem
  à reconciliação, que já usa o dono.
- A reconciliação não muda (já usa `owner_id`).
- Código de erro: `quota exceeded` quando o dono é o solicitante (inalterado,
  preserva a SPA atual); `owner_quota_exceeded` quando é outra pessoa — sem números.
  No envio avulso, a resposta 400 leva `{ error: 'owner_quota_exceeded' }`.
- `GET /files/quota` não muda: continua só sobre o solicitante.

*Trade-off aceito:* a própria recusa permite inferir, por tentativa, se "cabe X
bytes" no espaço do dono — o mesmo vazamento binário que qualquer recusa de cota
tem. Nenhum valor é devolvido, e não se cria rota de consulta.

### D6. Posse na resposta de conteúdo e pré-checagem na SPA

`GET /folders/:id/contents` passa a devolver `ownedByRequester: boolean` (`true` na
raiz). A SPA (`upload/`) usa o campo para escolher o fluxo: destino próprio mantém
a verificação de viabilidade atual; destino alheio pula a comparação numérica,
mostra o resumo e confirma, e trata `owner_quota_exceeded` por item com mensagem
própria (lista do que ficou de fora, sem decomposição). O pause-and-retry de
"falta de espaço durante o envio" vale só para `quota exceeded`.

### D7. Evento `upload` na reconciliação

Migration `0028` amplia o `CHECK` de `audit_events.action` com `'upload'`;
`AuditAction.UPLOAD` em `packages/shared`. A reconciliação de arquivo **novo**
(status `pending` → `active`/`over_quota`) grava `(unit_id, uploaded_by, file_id,
'upload')`. A consulta de auditoria por arquivo já filtra `view`/`download` e não
muda. A criação de pasta segue sem evento (coerente com `gestao-arquivos`); a
autoria da pasta vive em `created_by`.

### D8. Sem mudança de prefixo de objeto

`buildObjectPath(unitId, ctx.userId, …)` continua com o autor no caminho. O prefixo
nunca foi usado para autorização (o bucket é privado e o acesso passa pela rota) e
mudá-lo exigiria migrar objetos.

## Risks / Trade-offs

- [O dono passa a ver e excluir o que o colaborador enviou] → é a decisão do
  cliente; o autor mantém a trilha (`uploaded_by` + evento `upload`), e excluir
  passa pela lixeira com retenção.
- [Arquivo pendente de cadastro ocupa a cota do dono, mas o dono não o vê] →
  coerente com "não circula até ser completado"; o administrador da unidade vê os
  pendentes. Documentado no manual.
- [Reaproveitamento de pasta intermediária de terceiro no envio de árvore sem
  checar `upload` nela] → comportamento pré-existente, mantido; registrado como
  mudança futura. Com D1, o arquivo resultante fica com o dono daquela pasta.
- [`granted_by = autor` pode ler como "concedeu a si mesmo"] → a UI rotula pela
  `origin`, não pelo `granted_by`.
- [Itens antigos continuam com o colaborador como dono] → fora de escopo;
  administrador da unidade já alcança tudo; migração pode vir em change próprio.

## Migration Plan

1. Migration `0028_autoria_e_posse.sql`, aditiva: adiciona `created_by`,
   `uploaded_by` e `grants.origin`, faz o backfill (`= owner_id`) e só então aplica
   `NOT NULL`; amplia o `CHECK` de `audit_events.action`.
2. Janela de deploy: a revisão anterior da API pode ainda inserir pastas/arquivos
   sem as colunas de autoria. Para não falhar no `NOT NULL`, a migration cria um
   trigger `BEFORE INSERT` que preenche a autoria com `owner_id` quando vier nula.
   O código novo sempre grava a autoria explicitamente; o trigger pode ser
   removido num change posterior.
3. Deploy da API e da SPA juntos (mesma imagem).
4. Rollback: reverter a imagem. Colunas, trigger e `origin` são inertes para a
   versão anterior; o `CHECK` ampliado não afeta quem não grava `upload`.
