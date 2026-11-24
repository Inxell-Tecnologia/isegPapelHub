# Spec Delta

## ADDED Requirements

### Requirement: Troca de e-mail na edição de pessoa

O sistema SHALL aceitar a troca do e-mail de uma pessoa como campo da edição em `PATCH /users/:id`, sob o mesmo alcance da edição: `unit_admin` troca o e-mail de `collaborator` da própria unidade; `global_admin` troca o de qualquer pessoa, inclusive de outro `global_admin` e de si mesmo. Alvo fora do alcance SHALL ser recusado com permissão insuficiente, sem alterar dado algum. Referência: PRD US 1.1.

#### Scenario: unit_admin corrige o e-mail de um colaborador da unidade

- **WHEN** um `unit_admin` troca o e-mail de um `collaborator` da própria unidade
  por um e-mail ainda não utilizado
- **THEN** a operação é autorizada e a pessoa passa a ter o novo e-mail

#### Scenario: unit_admin não troca o e-mail de um administrador

- **WHEN** um `unit_admin` tenta trocar o e-mail de um `unit_admin` ou
  `global_admin` lotado na própria unidade
- **THEN** a operação é recusada com permissão insuficiente e o e-mail não muda

#### Scenario: unit_admin não troca o e-mail de pessoa de outra unidade

- **WHEN** um `unit_admin` tenta trocar o e-mail de uma pessoa de outra unidade
- **THEN** a operação é recusada com permissão insuficiente e o e-mail não muda

#### Scenario: global_admin troca o e-mail de qualquer pessoa

- **WHEN** um `global_admin` troca o e-mail de um `collaborator`, de um
  `unit_admin` ou de outro `global_admin`, de qualquer unidade
- **THEN** a operação é autorizada

#### Scenario: global_admin troca o próprio e-mail

- **WHEN** um `global_admin` troca o próprio e-mail
- **THEN** a operação é autorizada

### Requirement: E-mail em uso recusa a edição inteira

O sistema SHALL manter o e-mail único também na edição: trocar o e-mail por um já pertencente a outra pessoa SHALL ser recusado com o mesmo erro de e-mail em uso do cadastro, e a recusa SHALL ser total — nenhum outro campo enviado na mesma requisição SHALL ser aplicado. E-mail vazio SHALL ser recusado como requisição inválida. Referência: PRD US 1.1 cenário 2.

#### Scenario: E-mail de outra pessoa é recusado

- **WHEN** um administrador troca o e-mail de uma pessoa por um e-mail que já
  pertence a outra conta
- **THEN** a operação é recusada indicando que o e-mail já está em uso, e nenhum
  campo da requisição é aplicado

#### Scenario: Reenviar o próprio e-mail vigente não é conflito

- **WHEN** a edição envia, para a pessoa, o mesmo e-mail que ela já tem
- **THEN** a operação não é recusada por e-mail em uso

#### Scenario: E-mail vazio é recusado

- **WHEN** a edição envia um e-mail vazio ou só com espaços
- **THEN** a operação é recusada como requisição inválida, sem alterar dado algum

### Requirement: Novo e-mail vale para o login imediatamente

O sistema SHALL passar a autenticar a pessoa pelo novo e-mail a partir da requisição seguinte à troca, e o e-mail anterior NÃO SHALL mais autenticar. A senha da pessoa NÃO SHALL mudar, as sessões já abertas SHALL continuar válidas, e nenhuma mensagem SHALL ser enviada à pessoa (sem envio de e-mail no MVP).

#### Scenario: Login com o e-mail novo

- **WHEN** o e-mail de uma pessoa foi trocado e ela tenta entrar com o novo e-mail
  e a senha que já tinha
- **THEN** a autenticação é aceita

#### Scenario: Login com o e-mail antigo

- **WHEN** a pessoa tenta entrar com o e-mail anterior à troca
- **THEN** a autenticação é recusada como credencial inválida, sem indicar que o
  e-mail foi trocado

#### Scenario: Sessão aberta não é encerrada

- **WHEN** o e-mail de uma pessoa com sessão aberta é trocado
- **THEN** a sessão continua válida nas requisições seguintes

### Requirement: Edição de pessoa é registrada

O sistema SHALL registrar toda edição efetiva de pessoa em `PATCH /users/:id`, inclusive a troca de e-mail, conforme a capability `auditoria-administrativa`. Edição recusada NÃO SHALL ser registrada.

#### Scenario: Troca de e-mail deixa rastro

- **WHEN** um administrador troca o e-mail de uma pessoa
- **THEN** fica registrado quem trocou, quando, o e-mail anterior e o novo
