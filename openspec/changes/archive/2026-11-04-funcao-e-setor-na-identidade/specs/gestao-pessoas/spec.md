# Spec Delta

## MODIFIED Requirements

### Requirement: Cadastro de pessoa pela administração

O sistema SHALL permitir que uma pessoa autenticada com papel de administração
cadastre outra pessoa em `POST /users`, informando nome, unidade, telefone, e-mail,
função/cargo, **setor** e observação, e uma senha inicial; a conta criada
SHALL ficar vinculada à unidade e apta a fazer login. O **setor** SHALL ser
informado **por referência a um setor da unidade de destino** (capability
`setores`) — nunca como texto livre —, SHALL ser opcional, e um setor de outra
unidade SHALL recusar o cadastro fail-closed. NÃO SHALL existir autocadastro
nem convite por e-mail. A unidade de destino SHALL estar **ativa**: o sistema SHALL
recusar (fail-closed) o cadastro em uma unidade com status desativado, sem criar a
conta. A senha inicial SHALL atender ao tamanho mínimo da política de senha (ver
capability `troca-de-senha`): senha mais curta SHALL recusar o cadastro sem criar a
conta. Referência: PRD US 1.1; design.md (gestao-de-unidades) D5/D7; design.md
(troca-de-senha) D8; `docs/respostas_a1_funcao_e_setor.txt`, respostas 5 (a) e 6 (a).

#### Scenario: Cadastro válido cria conta apta a login

- **WHEN** um administrador cadastra uma pessoa com os campos exigidos e um e-mail
  ainda não utilizado, em uma unidade ativa
- **THEN** a conta é criada vinculada à unidade informada, com a senha armazenada
  apenas como hash, e a pessoa passa a poder autenticar-se

#### Scenario: Cadastro com setor da unidade vincula a pessoa a ele

- **WHEN** um administrador cadastra uma pessoa informando um setor existente na
  unidade de destino
- **THEN** a conta é criada vinculada àquele setor, e a representação da pessoa
  passa a informar o setor pelo **nome**, não pelo identificador cru

#### Scenario: Setor de outra unidade recusa o cadastro

- **WHEN** um administrador tenta cadastrar uma pessoa informando um setor que
  pertence a outra unidade
- **THEN** o cadastro é recusado fail-closed, nenhuma conta é criada, e a
  resposta não distingue esse caso de um setor inexistente

#### Scenario: E-mail duplicado é recusado

- **WHEN** um administrador tenta cadastrar uma pessoa com um e-mail já em uso
- **THEN** o cadastro é recusado com mensagem indicando que o e-mail já está em uso,
  e nenhuma conta é criada

#### Scenario: Colaborador não pode cadastrar pessoas

- **WHEN** uma pessoa com papel `collaborator` chama `POST /users`
- **THEN** a ação é bloqueada com resposta de permissão insuficiente

#### Scenario: Cadastro em unidade desativada é recusado

- **WHEN** um `global_admin` tenta cadastrar uma pessoa informando uma unidade com
  status desativado
- **THEN** o cadastro é recusado (fail-closed) e nenhuma conta é criada

#### Scenario: Senha inicial curta é recusada

- **WHEN** um administrador tenta cadastrar uma pessoa com senha inicial menor que o
  tamanho mínimo exigido
- **THEN** o cadastro é recusado indicando o requisito não atendido, e nenhuma conta
  é criada

## ADDED Requirements

### Requirement: Edição altera ou remove o vínculo de setor

O sistema SHALL aceitar, na edição de pessoa, a alteração do seu setor para outro
setor da **mesma unidade** e a **remoção** do vínculo, deixando a pessoa sem
setor. A ausência do campo na requisição SHALL preservar o vínculo vigente — os
três casos (ausente, remoção e novo setor) SHALL ser distintos, pelo mesmo
critério já aplicado à exceção de cota. Setor de outra unidade SHALL recusar a
edição fail-closed, sem alterar nenhum outro campo da requisição.

#### Scenario: Edição troca o setor da pessoa
- **WHEN** um administrador edita uma pessoa informando outro setor da unidade dela
- **THEN** o vínculo passa a ser o novo setor, e a listagem reflete o nome novo

#### Scenario: Edição remove o vínculo de setor
- **WHEN** um administrador edita uma pessoa pedindo explicitamente a remoção do
  setor
- **THEN** a pessoa fica sem setor, sem que isso afete seu papel, seu status ou
  qualquer outro campo

#### Scenario: Edição sem o campo preserva o setor vigente
- **WHEN** um administrador edita outros dados de uma pessoa sem enviar o campo
  de setor
- **THEN** o setor vigente permanece exatamente como estava

#### Scenario: Setor de outra unidade recusa a edição inteira
- **WHEN** um administrador tenta editar uma pessoa informando setor de outra
  unidade
- **THEN** a requisição é recusada fail-closed e **nenhum** dos campos enviados é
  aplicado
