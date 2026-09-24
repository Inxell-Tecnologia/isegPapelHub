# web-pessoas Specification

## Purpose

Define os requisitos verificáveis da gestão de pessoas pela administração na
SPA do GDoc — a página **`/admin/pessoas`**, restrita a `unit_admin`/
`global_admin`, com a listagem de pessoas do alcance do administrador
(`GET /users`), o cadastro com senha inicial (`POST /users`) e o aviso de
e-mail duplicado, a edição de perfil/papel/status (`PATCH /users/:id`), a
ativação/desativação de conta sem exclusão, as travas de papel espelhadas na
UI (sem função de linha de defesa) e o tratamento fail-closed neutro do 403.
Implementa o lado de frontend da **US 1.1** (e o cenário 3 da US 1.2, quanto à
desativação) do PRD (`docs/prd_final.md`), consumindo as rotas admin-only já
entregues pelo backend do Épico 1 (spec `gestao-pessoas`), sem re-descrever
seus cenários — o servidor permanece o único guardião de permissão.

## Requirements

### Requirement: Página de gestão de pessoas restrita à administração

A SPA SHALL prover, em **`/admin/pessoas`**, uma página de gestão de pessoas
acessível **apenas** a `unit_admin` e `global_admin` — a mesma guarda de papel já
declarada na rota. Um `collaborator` NÃO SHALL alcançar a página (é barrado pela
guarda de rota, antes de qualquer chamada). A página SHALL listar as pessoas do
alcance do administrador via `GET /users` — para `unit_admin`, apenas as da
própria unidade (RLS) — exibindo, por pessoa, ao menos **nome** (ou e-mail quando
o nome for nulo), **e-mail**, **função/cargo**, **papel**, **status**
(ativa/inativa) e o **nome da unidade** (não o identificador cru), resolvido a
partir de `GET /units`.

Esconder a página do colaborador é **conveniência de UX**: o servidor permanece o
guardião e responde 403 nas rotas de `users` a qualquer requisição de não-admin.

Referência: PRD US 1.1, RF #1/#2/#3; design.md D1/D2.

#### Scenario: Administrador lista as pessoas do seu alcance
- **WHEN** um administrador (`unit_admin` ou `global_admin`) abre `/admin/pessoas`
- **THEN** a SPA chama `GET /users` e exibe a lista de pessoas retornada, com nome,
  e-mail, função, papel, status e o nome da unidade por linha

#### Scenario: Pessoa sem nome cai no e-mail
- **WHEN** uma pessoa da lista tem `fullName` nulo
- **THEN** a SPA exibe o `email` dessa pessoa no lugar do nome

#### Scenario: Unidade exibida pelo nome, não pelo identificador
- **WHEN** a listagem de pessoas é exibida
- **THEN** cada pessoa mostra o nome da sua unidade, não o identificador (UUID) cru

#### Scenario: Colaborador não acessa a página
- **WHEN** um `collaborator` tenta navegar para `/admin/pessoas`
- **THEN** a SPA não exibe a gestão de pessoas (a guarda de papel bloqueia a rota)

### Requirement: Cadastro de pessoa com senha inicial

A página SHALL oferecer uma ação **"Nova pessoa"** que abre um formulário e, ao
confirmar, chama **`POST /users`** com nome, e-mail, **senha inicial**, e os
campos opcionais telefone, função/cargo, área de trabalho, observação e papel. Em
sucesso, a pessoa passa a poder fazer login com as credenciais definidas; a SPA
SHALL fechar o formulário e refletir a nova pessoa na listagem (invalidando a
consulta de `GET /users`).

A senha inicial SHALL respeitar o tamanho mínimo da política de senha: a SPA SHALL
sinalizar localmente o requisito não atendido antes de enviar, como conveniência de
UX, sem que isso substitua a validação do servidor.

A seleção da unidade SHALL depender do papel do administrador logado:

- Para **`global_admin`**, o formulário SHALL apresentar um **seletor de unidade**,
  alimentado por `GET /units` (apenas unidades **ativas**), e SHALL enviar o
  `unitId` escolhido no `POST /users`.
- Para **`unit_admin`**, o formulário NÃO SHALL apresentar seletor de unidade nem
  enviar `unitId` — a pessoa é criada na unidade do próprio administrador (o
  servidor força `ctx.unitId`, mantendo o comportamento atual).

O servidor permanece o guardião: ainda que um `unit_admin` forjasse `unitId`, o
cadastro é forçado à sua própria unidade.

Referência: PRD US 1.1 (cenário 1); design.md (gestao-de-unidades) D7; design.md
(troca-de-senha) D8.

#### Scenario: Cadastro válido por global_admin com seletor de unidade
- **WHEN** um `global_admin` preenche nome, e-mail ainda não utilizado, senha, os
  demais dados e **seleciona uma unidade ativa**, e confirma
- **THEN** a SPA chama `POST /users` enviando o `unitId` escolhido, fecha o
  formulário e a nova pessoa aparece na listagem vinculada àquela unidade

#### Scenario: Cadastro por unit_admin não mostra seletor de unidade
- **WHEN** um `unit_admin` abre o formulário de "Nova pessoa"
- **THEN** o formulário não apresenta seletor de unidade e o cadastro é criado na
  unidade do próprio administrador

#### Scenario: Senha é exigida no cadastro
- **WHEN** o administrador tenta confirmar o cadastro sem informar a senha
- **THEN** a SPA impede o envio e sinaliza que a senha é obrigatória

#### Scenario: Senha inicial curta é sinalizada antes do envio
- **WHEN** o administrador informa uma senha inicial menor que o tamanho mínimo
- **THEN** a SPA sinaliza o requisito não atendido e não chama a API

### Requirement: E-mail duplicado recusa o cadastro sem perder o preenchimento

Quando `POST /users` retornar **409** (e-mail já em uso), a SPA SHALL exibir uma
mensagem clara indicando que **o e-mail já está em uso**, associada ao campo de
e-mail, e SHALL **manter o formulário aberto** com os demais campos preenchidos —
o administrador corrige apenas o e-mail e reenvia. A SPA NÃO SHALL tratar o 409
como falha genérica nem descartar o que foi digitado.

Referência: PRD US 1.1 (cenário 2); design.md D6.

#### Scenario: E-mail duplicado (US 1.1 cenário 2)
- **WHEN** o administrador confirma o cadastro com um e-mail que já pertence a
  outra conta e `POST /users` retorna 409
- **THEN** a SPA exibe "e-mail já está em uso" e mantém o formulário aberto com os
  demais campos preenchidos

### Requirement: Edição de perfil, papel e status da pessoa

A página SHALL oferecer, por linha, uma ação **"Editar"** que abre o mesmo
formulário pré-preenchido e, ao confirmar, chama **`PATCH /users/:id`** com os
campos de perfil (nome, telefone, função, área, observação), o **papel** e o
**status**. O e-mail NÃO SHALL ser editável (o endpoint não o altera) e o
formulário de edição NÃO SHALL conter campo de senha (o endpoint não aceita
`password`). Em sucesso, a SPA SHALL refletir as alterações na listagem
(invalidando `GET /users`).

Referência: PRD US 1.1; design.md D3/D7.

#### Scenario: Edição altera os dados da pessoa
- **WHEN** um administrador edita nome/função/papel/status de uma pessoa e confirma
- **THEN** a SPA chama `PATCH /users/:id` e a listagem reflete os novos valores

#### Scenario: Edição não expõe troca de senha nem de e-mail
- **WHEN** o administrador abre o formulário de edição de uma pessoa
- **THEN** o formulário não apresenta campo de senha e o e-mail aparece como
  somente-leitura

### Requirement: Ativar e desativar conta sem exclusão

A página SHALL oferecer, por linha, a ação de **desativar** uma conta ativa e de
**ativar** uma conta inativa, ambas via **`PATCH /users/:id`** com o `status`
correspondente (`disabled`/`active`), com **confirmação** antes de desativar. NÃO
SHALL existir ação de exclusão permanente de pessoa (não há endpoint) — desativar
preserva os arquivos e a auditoria e apenas bloqueia o login. Em sucesso, a SPA
SHALL refletir o novo status na listagem.

Referência: PRD US 1.1, US 1.2 (cenário 3); design.md D5.

#### Scenario: Desativar bloqueia o login preservando dados
- **WHEN** um administrador desativa uma pessoa e confirma
- **THEN** a SPA chama `PATCH /users/:id` com `status: 'disabled'` e a listagem
  passa a exibir a pessoa como inativa

#### Scenario: Reativar restaura o acesso
- **WHEN** um administrador ativa uma pessoa inativa
- **THEN** a SPA chama `PATCH /users/:id` com `status: 'active'` e a listagem passa
  a exibir a pessoa como ativa

#### Scenario: Não há exclusão permanente
- **WHEN** o administrador vê as ações disponíveis para uma pessoa
- **THEN** a SPA não oferece exclusão permanente, apenas ativar/desativar

### Requirement: Travas de papel espelhadas na UI, com o servidor como guardião

A SPA SHALL espelhar as travas de papel do servidor como conveniência de UX, sem
tratá-las como linha de defesa:

- No seletor de papel, a opção **`global_admin`** SHALL aparecer **apenas** quando
  o administrador logado for `global_admin`; para `unit_admin` as opções SHALL se
  limitar a `collaborator` e `unit_admin` (o servidor recusa a criação/elevação a
  `global_admin` por `unit_admin` com 403).
- Na **própria linha** do administrador logado (`row.id === identity.id`), a SPA
  NÃO SHALL oferecer as ações de **desativar** a si mesmo nem de **rebaixar** o
  próprio papel — evitando que o administrador corte o próprio acesso.

Estas travas são **UX, não defesa**: o servidor (`isAdmin`, as checagens de papel
e a RLS por `unit_id`) permanece o único guardião e SHALL ser sempre quem
autoriza; a SPA NÃO SHALL inferir permissão a partir da visibilidade das opções.

Referência: PRD US 1.1; design.md D4/D5.

#### Scenario: unit_admin não vê a opção global_admin
- **WHEN** um `unit_admin` abre o seletor de papel ao cadastrar ou editar uma
  pessoa
- **THEN** a SPA oferece apenas `collaborator` e `unit_admin`, sem `global_admin`

#### Scenario: global_admin vê a opção global_admin
- **WHEN** um `global_admin` abre o seletor de papel
- **THEN** a SPA oferece também a opção `global_admin`

#### Scenario: Administrador não desativa nem rebaixa a si mesmo
- **WHEN** um administrador vê a linha correspondente à própria conta
- **THEN** a SPA não oferece as ações de desativar essa conta nem de rebaixar o
  próprio papel

### Requirement: 403 fail-closed neutro nas operações de pessoas

A SPA SHALL tratar qualquer operação de pessoas que retorne **403** — por
exemplo, editar uma pessoa de outra unidade (escondida pela RLS) ou uma trava de
papel violada por um pedido forjado — exibindo um aviso de **permissão
insuficiente** neutro, **sem distinguir os subcasos** (que o servidor unifica de
propósito) e **sem** expor dados da pessoa alvo. A SPA NÃO SHALL tratar o 403 como
se o recurso não existisse de forma que vaze informação.

Referência: PRD US 1.1; design.md D6.

#### Scenario: Operação negada exibe aviso neutro
- **WHEN** uma operação de pessoas (`POST`/`PATCH /users`) retorna 403
- **THEN** a SPA exibe um aviso de permissão insuficiente, sem distinguir se a
  pessoa é de outra unidade ou se a ação foi barrada por papel, e sem expor
  dados da pessoa alvo

### Requirement: Ação de redefinir senha na listagem de pessoas

A SPA SHALL oferecer, na linha de cada pessoa da listagem, a ação **"Redefinir
senha"**, que ao ser confirmada chama `POST /users/:id/password`. A ação SHALL ser
exibida apenas quando o papel do administrador logado a alcança — `unit_admin` a vê
somente em linhas de `collaborator`; `global_admin` a vê em linhas de `collaborator`
e `unit_admin`; em linha de `global_admin` a ação NÃO SHALL ser oferecida a ninguém,
nem na própria linha (onde o caminho é "Minha conta"). Essa visibilidade é **UX, não
defesa**: o servidor permanece o único guardião, e a SPA NÃO SHALL inferir permissão
a partir da presença da ação. Referência: PRD US 1.4 (cenários 1 e 2); design.md
(troca-de-senha) D5.

#### Scenario: unit_admin vê a ação apenas em colaboradores

- **WHEN** um `unit_admin` visualiza a listagem de pessoas
- **THEN** a ação "Redefinir senha" aparece nas linhas de `collaborator` e não
  aparece nas linhas de `unit_admin` nem de `global_admin`

#### Scenario: global_admin vê a ação em colaboradores e administradores de unidade

- **WHEN** um `global_admin` visualiza a listagem de pessoas
- **THEN** a ação "Redefinir senha" aparece nas linhas de `collaborator` e
  `unit_admin`, e não aparece em nenhuma linha de `global_admin`

#### Scenario: Redefinição negada pelo servidor exibe aviso neutro

- **WHEN** a chamada de redefinição retorna permissão insuficiente
- **THEN** a SPA exibe aviso neutro de permissão insuficiente, sem distinguir os
  subcasos e sem expor dados da pessoa alvo

### Requirement: Senha gerada exibida uma única vez

A SPA SHALL apresentar a senha devolvida pela redefinição em um modal que deixa
explícito que ela **não será exibida novamente**, oferecendo meio de copiá-la para
repasse à pessoa. A SPA NÃO SHALL armazenar essa senha em cache de consulta,
armazenamento local ou estado global — o valor SHALL existir apenas no estado do
modal e SHALL ser descartado ao fechá-lo, de modo que reabrir a tela ou recarregar a
página não a recupere. A SPA NÃO SHALL registrar a senha em log do navegador.
Referência: PRD US 1.4 (cenário 1); design.md (troca-de-senha) D7.

#### Scenario: Modal apresenta a senha com aviso de exibição única

- **WHEN** a redefinição é concluída com sucesso
- **THEN** a SPA exibe a senha gerada com aviso de que não será mostrada de novo e
  meio de copiá-la

#### Scenario: Senha some ao fechar o modal

- **WHEN** o administrador fecha o modal da senha gerada
- **THEN** o valor é descartado do estado do cliente e não é recuperável ao reabrir
  a tela ou recarregar a página

### Requirement: Campo de cota individual restrito ao administrador global

A SPA SHALL apresentar, no formulário de edição de pessoa, um campo de **cota
individual de armazenamento** visível e editável **somente** para quem tem papel
`global_admin`. Para `unit_admin` o campo NÃO SHALL aparecer, nem como
somente-leitura desabilitado que sugira uma permissão inexistente.

A trava na interface SHALL ser espelho da regra do servidor, nunca a linha de
defesa: a SPA NÃO SHALL inferir autorização própria, e um `403` do servidor
SHALL ser tratado como recusa legítima, preservando o preenchimento do
formulário.

O campo SHALL ser expresso em **GB** na interface, convertendo para a unidade do
contrato da API ao enviar, e SHALL permitir devolver a pessoa ao **padrão da
plataforma** sem exigir que o administrador conheça ou digite o valor do padrão.

#### Scenario: Administrador global vê e edita a cota
- **WHEN** um `global_admin` abre o formulário de edição de uma pessoa
- **THEN** o campo de cota individual aparece preenchido com a cota vigente e
  pode ser alterado

#### Scenario: Administrador de unidade não vê o campo
- **WHEN** um `unit_admin` abre o formulário de edição de uma pessoa da sua
  unidade
- **THEN** o campo de cota individual não é apresentado, e os demais campos
  seguem editáveis

#### Scenario: Voltar ao padrão da plataforma
- **WHEN** um `global_admin` opta por devolver a pessoa ao padrão da plataforma
- **THEN** a SPA envia a remoção da exceção, sem exigir a digitação de um valor

#### Scenario: Recusa do servidor não descarta o preenchimento
- **WHEN** o servidor recusa a edição com `403`
- **THEN** a SPA informa a recusa e mantém os dados já digitados no formulário

### Requirement: Consumo atual exibido ao lado da cota

A SPA SHALL exibir, junto do campo de cota individual, o **volume de
armazenamento já utilizado** pela pessoa, para que a decisão de cota seja tomada
com o consumo à vista. A SPA SHALL indicar de forma explícita quando a pessoa
**segue o padrão da plataforma**, distinguindo esse estado de uma exceção
nominal cujo valor coincida com o padrão.

A SPA SHALL sinalizar quando o valor informado for **menor que o consumo atual**,
explicando que a pessoa ficará impedida de enviar e substituir arquivos até
liberar espaço, sem impedir a confirmação — a decisão é do administrador.

#### Scenario: Consumo visível na edição
- **WHEN** um `global_admin` abre o formulário de edição de uma pessoa
- **THEN** vê o volume já utilizado por ela ao lado do campo de cota

#### Scenario: Pessoa sem exceção é identificada como padrão da plataforma
- **WHEN** a pessoa não tem exceção nominal
- **THEN** a SPA indica que ela segue o padrão da plataforma, e não um valor
  próprio

#### Scenario: Aviso ao definir cota abaixo do consumo
- **WHEN** o administrador informa uma cota menor que o volume já utilizado pela
  pessoa
- **THEN** a SPA avisa que a pessoa ficará bloqueada para novos envios e
  substituições, e ainda assim permite confirmar
