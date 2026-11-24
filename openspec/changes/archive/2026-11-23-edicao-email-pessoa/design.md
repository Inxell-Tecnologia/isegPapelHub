# Design

## Context

Ver proposal.md (Why). Estado atual relevante:

- `PATCH /users/:id` (`apps/api/src/routes/users.ts`) monta o `UPDATE` com
  `setField` campo a campo, dentro de `withTenantTransaction`, depois de
  `canEditTarget` (alcance por papel do alvo) e das travas de auto-edição. Recusas
  são totais: a transação inteira desfaz. Erros de banco esperados viram
  respostas específicas fora da transação (padrão `isOversightSectorViolation`).
- `users.email` é `text NOT NULL UNIQUE` (constraint `users_email_key`,
  migration `0001`). `POST /users` já mapeia `23505` para
  `409 { error: 'email already in use' }`.
- Login (`routes/auth.ts`) busca por `WHERE u.email = $1`; a sessão guarda o id
  da pessoa e `attachTenantContext` relê papel/status do banco a cada requisição
  — nada do lado da sessão depende do e-mail.
- `audit_events` é log de **arquivo** (`file_id NOT NULL`, `action` restrito a
  verbos de arquivo). `PATCH /users/:id` não audita nada hoje
  (`cota-por-usuario`, D6).
- `withTenantTransaction` já faz `set_config('app.current_user_id', …, true)`
  além de `app.current_unit`/`app.user_role`.
- SPA: `PessoaFormModal.tsx` usa `<Input disabled={isEdit} />` no e-mail e já
  trata o 409 do cadastro com `form.setFields` no campo `email`; na edição, já
  distingue os 409 `invalid_sector` e `reading_oversight_requires_sector` pela
  mensagem.

## Goals / Non-Goals

**Goals:**

- Troca de e-mail com o mesmo alcance, as mesmas recusas totais e o mesmo erro
  de unicidade que já existem, sem regra nova de autorização.
- Um registro administrativo que cubra **toda** a edição de pessoa e seja
  atômico com ela, isolado por unidade e só de inclusão por imposição do banco.

**Non-Goals:**

- Ler o registro (rota/tela) — fica para um change futuro.
- Registrar outras ações (cadastro, senha, unidades, setores). A tabela comporta,
  mas este change não as liga.
- Normalizar o e-mail (caixa/espaços).

## Decisions

### D1 — O e-mail é um campo a mais de `PATCH`, sob `canEditTarget`

`email` entra em `UpdatePersonRequest` e no `setField` como os demais campos de
perfil. O alcance é o da edição (`canEditTarget`), **não** o da senha
(`canResetPasswordOf`): trocar o e-mail não entrega a conta de ninguém, porque a
senha continua sendo a do dono — quem troca o e-mail de um administrador global
não ganha como entrar por ele. Isso fecha a decisão do usuário: `unit_admin` →
`collaborator` da unidade; `global_admin` → qualquer pessoa, inclusive a si.

*Alternativa descartada:* alcance próprio, mais estreito (só `global_admin`).
Tiraria do administrador da unidade a correção mais comum (colaborador cadastrado
errado na própria unidade), sem ganho de segurança pelo motivo acima.

Validação no servidor: `email` presente SHALL ser `string` com `trim() !== ''`,
senão `400 invalid request body`. O valor é gravado como recebido, igual a
`POST /users` (sem normalização — fora de escopo). O formato é validado na SPA
(`type: 'email'`), como no cadastro.

### D2 — 409 por `users_email_key`, tratado fora da transação

O `UPDATE` que viola a unicidade lança `23505`; a transação desfaz por inteiro
(recusa total grátis). O `catch` em volta da transação, que hoje só reconhece
`isOversightSectorViolation`, passa a reconhecer também `23505` com
`constraint === 'users_email_key'` e responde `409 { error: 'email already in
use' }` — **a mesma mensagem do cadastro**, para a SPA reusar o tratamento.
Checar pela constraint (não por qualquer `23505`) evita rotular como "e-mail em
uso" uma futura unicidade em outra coluna.

Reenviar o próprio e-mail não conflita: o `UPDATE` de uma linha para o valor que
ela já tem não viola `UNIQUE`.

*Alternativa descartada:* `SELECT` prévio "existe outro com esse e-mail?". Tem
corrida entre o `SELECT` e o `UPDATE`; a constraint é a fonte da verdade e já
existe.

Nota de exposição: o 409 revela a um `unit_admin` que um e-mail existe em
**outra** unidade. É exatamente o que `POST /users` já revela hoje (unicidade é
global); não é exposição nova.

### D3 — Tabela própria `admin_events`, não `audit_events`

Migration `0027_admin_events.sql`:

```
admin_events
  id              uuid PK default gen_random_uuid()
  unit_id         uuid NOT NULL REFERENCES units(id)   -- unidade da PESSOA EDITADA
  actor_user_id   uuid NOT NULL REFERENCES users(id)
  target_user_id  uuid NOT NULL REFERENCES users(id)
  action          text NOT NULL CHECK (action IN ('person_updated'))
  changes         jsonb NOT NULL                        -- { campo: { from, to } }
  created_at      timestamptz NOT NULL DEFAULT now()
  índices: (unit_id), (target_user_id, created_at DESC)
```

Confirma a decisão do `cota-por-usuario` D6: misturar eventos administrativos em
`audit_events` contaminaria a auditoria de arquivo (a capacidade que o produto
vende) e obrigaria a afrouxar `file_id NOT NULL`. O `CHECK` de `action` nasce com
um único valor; ações futuras (`person_created`, `password_reset`…) entram
alargando o `CHECK` numa migration nova.

`unit_id` é a unidade **da pessoa editada**, não a do autor: um `global_admin`
da SEDE editando alguém da unidade B gera evento da unidade B — é onde o fato
pertence, e é o que a RLS de `unit_admin` de B deve enxergar no futuro.

### D4 — RLS só de `SELECT` e `INSERT`: só-inclusão imposto no banco

```
ENABLE + FORCE ROW LEVEL SECURITY
POLICY admin_events_select FOR SELECT USING (<isolamento por unidade>)
POLICY admin_events_insert FOR INSERT WITH CHECK (<isolamento por unidade>)
-- nenhuma policy FOR UPDATE / FOR DELETE
```

O predicado de isolamento é o mesmo das demais tabelas
(`unit_id = app.current_unit OR app.user_role = 'global_admin'`). Sem policy de
`UPDATE`/`DELETE` e com `FORCE`, o papel da app (inclusive dono da tabela, e o
`gdoc_ci` não-superuser da CI) não altera nem apaga nenhuma linha: o comando
afeta 0 linhas. Isso torna "só de inclusão" testável na CI sem depender de
`GRANT`/`REVOKE` por papel, que difere entre dev, CI e prod.

Soma-se, como em toda tabela de unidade desde a migration `0026`, a policy
restritiva `shared_visitor_no_insert`: a transação de visita entre unidades é
somente leitura e não grava registro administrativo.

*Alternativa descartada:* só não expor rota de alteração. Deixaria a garantia na
disciplina do código, não no banco — contra a regra do repositório para
isolamento.

### D5 — Diff calculado na aplicação, na mesma transação

Dentro da transação, depois de `canEditTarget` e das validações e **antes** do
`UPDATE`, lê-se a linha atual com `SELECT … FOR UPDATE` (colunas editáveis +
`unit_id`). Após o `UPDATE … RETURNING`, compara-se, para cada campo
**enviado**, o valor anterior com o retornado; só os diferentes
(`IS DISTINCT FROM` semântico, `null` incluído) entram em `changes`. Se `changes`
não estiver vazio, `INSERT INTO admin_events` na mesma transação. Falha no
`INSERT` derruba a transação inteira (spec: falha ao registrar desfaz a edição).

`FOR UPDATE` impede que duas edições concorrentes registrem o mesmo "anterior".

Representação em `changes`: valores de coluna crus — ids (setor), enums como
texto (papel, status, acompanhamento), bytes (cota), `null` para ausência. Nomes
de campo pelo contrato da API (`email`, `role`, `status`, `storageQuotaBytes`,
`sectorId`, `readingOversight`, `fullName`, `phone`, `jobTitle`, `notes`). Os
metadados derivados `reading_oversight_set_by/_at` não entram — já são, eles
mesmos, um rastro.

*Alternativa descartada:* trigger `AFTER UPDATE ON users` lendo
`app.current_user_id`. Capturaria até `UPDATE` manual, mas: (a) qualquer escrita
em `users` (ex.: reconciliação de `storage_used_bytes`, `tour_completed`) teria
de ser filtrada, e o trigger passaria a conhecer regra de negócio; (b) o
`UPDATE` manual roda sem `app.current_user_id` e ficaria sem autor de qualquer
forma; (c) a lógica fica fora do lugar onde o resto da rota é lida e testada.
Fica registrado como evolução possível se surgir exigência de cobrir escritas
fora da aplicação.

### D6 — SPA: campo habilitado, 409 por mensagem, aviso de login

- Remove-se `disabled={isEdit}` e as regras de validação do e-mail passam a valer
  nos dois modos.
- No `PATCH`, envia-se `email` **só se mudou** em relação a `target.email` —
  reduz o risco de um formulário antigo sobrescrever uma troca concorrente; o
  servidor de qualquer modo ignora no registro um valor igual.
- O 409 da edição é discriminado pela mensagem: `email already in use` → erro no
  campo (mesmo `form.setFields` do cadastro); `invalid_sector` e
  `reading_oversight_requires_sector` mantêm seus tratamentos. Hoje o ramo do 409
  genérico de e-mail fica **depois** dos ramos específicos; passa a casar pela
  mensagem para não engolir um 409 futuro de outra natureza.
- Aviso (`Alert`/texto de ajuda do `Form.Item`) visível quando
  `form.getFieldValue('email') !== target.email`, via `Form.useWatch`.

## Risks / Trade-offs

- [Administrador troca o e-mail e não avisa a pessoa, que fica sem conseguir
  entrar] → aviso explícito no formulário (D6) e no manual; a pessoa ainda tem a
  sessão aberta se já estava logada; o próprio administrador vê o novo e-mail na
  listagem.
- [E-mail corrigido para outro igualmente errado] → reversível pela mesma tela; o
  registro guarda o histórico de valores.
- [Caixa diferente (`Maria@` vs `maria@`) ainda cria contas distintas e quebra
  login] → fora de escopo; registrado na proposal como change próprio. A troca de
  e-mail ao menos permite **corrigir** manualmente esses casos.
- [`changes` em JSONB guarda e-mails e observações — dado pessoal no log] →
  mesmo nível de proteção da própria tabela `users` (RLS por unidade, mesmo
  banco); sem rota de leitura nesta fatia.
- [Registro cresce sem limite] → volume é de edições administrativas, ordens de
  grandeza abaixo de `audit_events`; sem retenção nesta fatia.
- [`UPDATE` manual no banco continua sem rastro] → aceito (D5); a aplicação passa
  a ser o caminho, e é ele que é registrado.

## Migration Plan

1. Deploy normal: a migration `0027` só cria tabela, índices e policies — aditiva,
   sem tocar dados existentes; roda no job de migração antes da nova revisão da
   API.
2. Ordem segura: a API antiga ignora a tabela nova; a SPA nova só envia `email`
   quando a API nova está no ar (mesma imagem serve ambas, mesma origem).
3. Rollback: reverter a revisão do Cloud Run. A tabela pode ficar (inócua); não
   há `DOWN` a executar.

## Open Questions

- Quando a tela de consulta vier, os ids de setor em `changes` serão exibidos
  pelo nome atual ou se deve passar a gravar também o nome no momento da edição?
  Não muda esta fatia: o id é suficiente para reconstruir pelo SQL.
