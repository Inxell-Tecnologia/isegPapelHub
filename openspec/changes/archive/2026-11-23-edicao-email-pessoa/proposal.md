# Proposal

## Why

Pessoas foram cadastradas com o e-mail errado e não há como corrigir pela
aplicação. `PATCH /users/:id` não lê o campo `email`, e a tela "Editar" exibe o
e-mail como somente-leitura (spec `web-pessoas`, "Edição não expõe troca de
senha nem de e-mail"). O e-mail é o **login** da pessoa (US 1.1): um e-mail
errado significa uma pessoa que não consegue entrar, e a única saída hoje é
`UPDATE` manual no Cloud SQL — sem rastro de quem trocou nem do valor anterior.

A trava nunca foi uma decisão de produto: o PRD só exige que o e-mail seja
**único** (US 1.1, cenário 2), e nenhum design do repositório justifica a
imutabilidade. Ela nasceu do recorte do épico 1, que implementou o `PATCH` sem o
campo, e a SPA passou a espelhar o endpoint (design.md de `web-pessoas`, D3).
Diferente da senha, cuja trava é deliberada (`troca-de-senha`, D5).

Abrir a troca de e-mail — o identificador de acesso — sem rastro seria pior que
a situação atual. E auditar só o e-mail repetiria a inconsistência que o change
`cota-por-usuario` (design.md D6) recusou: hoje **nenhuma** alteração de
`PATCH /users/:id` é auditada, nem papel, nem status, nem cota. Este change paga
essa dívida: cria o **registro administrativo** da edição de pessoa, cobrindo
todos os campos, e é sobre ele que a troca de e-mail se apoia.

## What Changes

- **E-mail editável em `PATCH /users/:id`.** O contrato `UpdatePersonRequest`
  ganha `email?`. O alcance é exatamente o da edição (`canEditTarget`, change
  `edicao-entre-admins-globais` D1): `unit_admin` troca o e-mail de
  `collaborator` da própria unidade; `global_admin` troca o de qualquer pessoa,
  inclusive de outro `global_admin` e de si mesmo.
- **E-mail em uso → 409 `email already in use`**, o mesmo erro do cadastro, com
  recusa total da requisição (nenhum outro campo aplicado). E-mail vazio → 400.
- **Efeitos da troca, explícitos:** o login passa a valer só com o e-mail novo
  na requisição seguinte; sessões já abertas continuam válidas (a sessão é por
  id de pessoa, não por e-mail); nada é enviado à pessoa (o MVP não envia
  e-mails — PRD, fora de escopo) — quem trocou comunica.
- **Registro administrativo da edição de pessoa (novo).** Toda edição bem-
  sucedida em `PATCH /users/:id` que **efetivamente altere** algum campo grava,
  na mesma transação, um evento com quem fez, em quem, quando, e o valor
  **anterior e o novo** de cada campo alterado — e-mail, papel, status, cota,
  setor, acompanhamento de leituras e dados de perfil. Reenviar o valor vigente
  não gera registro. O registro é só de inclusão (não se altera nem se apaga
  pela aplicação) e isolado por unidade via RLS.
- **SPA:** o campo e-mail fica editável no formulário "Editar", com a mesma
  validação de formato do cadastro, o 409 sinalizado no campo com o modal
  aberto, e um aviso de que a pessoa passará a entrar com o novo e-mail.
- **Manual do administrador** (`docs/manual/docs/administrador/pessoas.md`):
  deixa de dizer que o e-mail não pode ser alterado e explica o efeito no login.

## Capabilities

### New Capabilities

- `auditoria-administrativa`: registro, só de inclusão e isolado por unidade, das
  ações administrativas sobre pessoas — nesta fatia, cada edição em
  `PATCH /users/:id` com os valores anterior e novo dos campos alterados.
  Separado propositalmente de `auditoria`, que é o registro de **acesso a
  arquivo** (`audit_events`), a capacidade que o produto vende.

### Modified Capabilities

- `gestao-pessoas`: a edição passa a aceitar a troca de e-mail, dentro do
  alcance da edição, com unicidade garantida e efeito imediato no login; e toda
  edição efetiva passa a ser registrada (remete a `auditoria-administrativa`).
- `web-pessoas`: o e-mail deixa de ser somente-leitura no formulário de edição;
  o 409 de e-mail em uso passa a ser tratado também na edição; a senha continua
  fora do formulário de edição.

## Impact

**Banco.** Migration nova `0027_admin_events.sql`: tabela `admin_events` com
`unit_id` e RLS (policies só de `SELECT` e `INSERT` — sem `UPDATE`/`DELETE` para
o papel da app). Nenhuma alteração em `users` nem em `audit_events`.

**API.** `apps/api/src/routes/users.ts` (`PATCH /users/:id`: aceitar `email`,
mapear `23505` para 409, ler a linha anterior e gravar o evento na mesma
transação). `packages/shared/src/people.ts` (`UpdatePersonRequest.email?`).

**SPA.** `apps/web/src/pessoas/PessoaFormModal.tsx` (campo habilitado na edição,
409 no campo, aviso de efeito no login).

**Docs.** `docs/manual/docs/administrador/pessoas.md`.

**Sem infraestrutura nova**, sem job, sem prefixo de rota novo (nenhuma rota
nova é criada).

## Fora de escopo

- **Tela de consulta do registro administrativo.** Nesta fatia o registro é
  gravado e consultável por SQL; uma tela (ex.: histórico no detalhe da pessoa)
  é um change futuro. Por isso o manual não o apresenta como recurso do usuário.
- **Auditoria de outras ações administrativas** — cadastro de pessoa
  (`POST /users`), redefinição de senha (`POST /users/:id/password`), unidades,
  setores. A tabela nasce genérica o bastante para recebê-las depois.
- **Normalização de caixa/espaços do e-mail.** Login e unicidade continuam
  sensíveis a maiúsculas (`Maria@…` ≠ `maria@…`). Corrigir isso exige migration
  sobre dados existentes e checagem de duplicatas — change próprio.
- **Aviso à pessoa sobre a troca** (e-mail ou notificação in-app). O MVP não
  envia e-mails; a comunicação é do administrador.
- **Encerrar sessões abertas** ao trocar o e-mail. Não há motivo de segurança: a
  troca não muda a senha nem a pessoa.
