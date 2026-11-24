# Spec Delta

## MODIFIED Requirements

### Requirement: Cadastro de pessoa com senha inicial

A página SHALL oferecer uma ação **"Nova pessoa"** que abre um formulário e, ao
confirmar, chama **`POST /users`** com nome, e-mail, **senha inicial**, e os
campos opcionais telefone, função/cargo, **setor**, observação e papel. Em
sucesso, a pessoa passa a poder fazer login com as credenciais definidas; a SPA
SHALL fechar o formulário e refletir a nova pessoa na listagem (invalidando a
consulta de `GET /users`).

O **setor** SHALL ser oferecido como **lista fechada** dos setores da unidade de
destino — nunca campo de texto livre —, com a opção explícita de **não informar
setor**. A lista SHALL acompanhar a unidade escolhida no formulário: trocar a
unidade SHALL repor a lista e SHALL descartar um setor já escolhido que não
pertença à unidade nova, para que não se envie vínculo cross-unit.

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
cadastro é forçado à sua própria unidade — e o mesmo vale para o setor, recusado
fail-closed quando não pertence à unidade de destino.

Referência: PRD US 1.1 (cenário 1); design.md (gestao-de-unidades) D7; design.md
(troca-de-senha) D8; `docs/respostas_a1_funcao_e_setor.txt`, respostas 5 (a) e 6 (a).

#### Scenario: Cadastro válido por global_admin com seletor de unidade
- **WHEN** um `global_admin` preenche nome, e-mail ainda não utilizado, senha, os
  demais dados e **seleciona uma unidade ativa**, e confirma
- **THEN** a SPA chama `POST /users` enviando o `unitId` escolhido, fecha o
  formulário e a nova pessoa aparece na listagem vinculada àquela unidade

#### Scenario: Setor é escolhido de lista, não digitado
- **WHEN** o administrador abre o formulário de "Nova pessoa"
- **THEN** o setor é apresentado como lista dos setores da unidade de destino,
  com a opção de deixar sem setor, e não como campo de digitação livre

#### Scenario: Trocar a unidade repõe a lista de setores
- **WHEN** um `global_admin` escolhe um setor e depois troca a unidade do
  formulário
- **THEN** a lista passa a ser a da unidade nova e o setor anterior deixa de
  estar escolhido, de modo que nenhum vínculo cross-unit é enviado

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

### Requirement: Edição de perfil, papel e status da pessoa

A página SHALL oferecer, por linha, uma ação **"Editar"** que abre o mesmo
formulário pré-preenchido e, ao confirmar, chama **`PATCH /users/:id`** com os
campos de perfil (nome, telefone, função, **setor**, observação), o **papel** e o
**status**. O setor SHALL ser oferecido como a mesma lista fechada do cadastro,
restrita à unidade **da pessoa editada**, com a opção de deixá-la sem setor. O
e-mail NÃO SHALL ser editável (o endpoint não o altera) e o
formulário de edição NÃO SHALL conter campo de senha (o endpoint não aceita
`password`). Em sucesso, a SPA SHALL refletir as alterações na listagem
(invalidando `GET /users`).

Referência: PRD US 1.1; design.md D3/D7.

#### Scenario: Edição altera os dados da pessoa
- **WHEN** um administrador edita nome/função/papel/status de uma pessoa e confirma
- **THEN** a SPA chama `PATCH /users/:id` e a listagem reflete os novos valores

#### Scenario: Edição troca ou limpa o setor
- **WHEN** um administrador escolhe outro setor da unidade da pessoa, ou limpa a
  escolha, e confirma
- **THEN** a SPA envia a troca ou a remoção do vínculo, e a listagem reflete o
  setor resultante

#### Scenario: Edição não expõe troca de senha nem de e-mail
- **WHEN** o administrador abre o formulário de edição de uma pessoa
- **THEN** o formulário não apresenta campo de senha e o e-mail aparece como
  somente-leitura

## ADDED Requirements

### Requirement: Manutenção da lista de setores alcançável pela gestão de pessoas

A página de gestão de pessoas SHALL oferecer, à administração, uma superfície
para **manter a lista de setores** da unidade — consultar, cadastrar, renomear e
remover — alcançável da própria página, sem exigir item de navegação próprio.
Para `unit_admin` a superfície SHALL operar sobre a própria unidade, sem seletor;
para `global_admin` SHALL permitir escolher a unidade. A SPA NÃO SHALL ser a
linha de defesa: toda recusa de alcance SHALL vir do servidor e SHALL ser
apresentada com aviso neutro.

#### Scenario: Administração alcança a manutenção de setores da página de pessoas
- **WHEN** um administrador abre a página de gestão de pessoas
- **THEN** encontra, na própria página, o acesso à lista de setores da unidade,
  com as ações de cadastrar, renomear e remover

#### Scenario: Setor cadastrado passa a ser oferecido no formulário de pessoa
- **WHEN** o administrador cadastra um setor novo e volta ao formulário de pessoa
- **THEN** o setor novo aparece na lista oferecida, sem exigir recarregar a
  aplicação

#### Scenario: Remoção de setor em uso é apresentada como impedimento, não como falha
- **WHEN** o administrador tenta remover um setor que ainda tem pessoas
  vinculadas e o servidor recusa
- **THEN** a SPA informa que há pessoas naquele setor e mantém a lista intacta,
  sem mensagem genérica de erro

#### Scenario: Colaborador não alcança a manutenção de setores
- **WHEN** uma pessoa com papel `collaborator` tenta alcançar a página de gestão
  de pessoas
- **THEN** é barrada pela guarda de rota, antes de qualquer chamada — e portanto
  não alcança a manutenção de setores
