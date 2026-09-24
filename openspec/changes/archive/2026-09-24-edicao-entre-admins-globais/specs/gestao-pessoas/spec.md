# Spec Delta

## MODIFIED Requirements

### Requirement: Edição e desativação de pessoa

O sistema SHALL permitir que a administração edite os dados de uma pessoa e altere
seu status para ativo/desativado em `PATCH /users/:id`, dentro do seu alcance. Uma
pessoa desativada NÃO SHALL conseguir autenticar-se (ver capability `autenticacao`),
mas seus arquivos e registros de auditoria SHALL ser preservados.

O alcance SHALL considerar o papel da **pessoa alvo**, lido do banco, e não apenas o
papel informado na requisição: um `unit_admin` NÃO SHALL editar nem alterar o status
de um `unit_admin` ou de um `global_admin`, ainda que a RLS lhe exponha a linha por
estar na sua própria unidade; um `global_admin` NÃO SHALL ser editado por quem não
seja `global_admin`. Alvo fora do alcance SHALL ser recusado com permissão
insuficiente, sem distinguir o subcaso de alvo inexistente ou escondido pela RLS.

O alcance da **edição** SHALL ser independente do alcance da **redefinição
administrativa de senha** (capability `troca-de-senha`), e NÃO SHALL herdá-lo: um
`global_admin` SHALL editar outro `global_admin`, inclusive **a si mesmo**, embora
NÃO possa redefinir a senha de nenhum dos dois. Referência: PRD US 5.1; design.md
(troca-de-senha) D5.

#### Scenario: Desativação impede novo login preservando dados

- **WHEN** um administrador desativa uma pessoa
- **THEN** a pessoa deixa de conseguir autenticar-se, e seus arquivos e registros de
  auditoria permanecem intactos

#### Scenario: Edição respeita o alcance

- **WHEN** um `unit_admin` tenta editar uma pessoa de outra unidade
- **THEN** a operação é negada (a RLS não expõe a linha), sem alterar dado algum

#### Scenario: unit_admin não edita nem desativa administrador da própria unidade

- **WHEN** um `unit_admin` tenta editar ou desativar um `unit_admin` ou um
  `global_admin` lotado na sua própria unidade
- **THEN** a operação é recusada com permissão insuficiente, sem alterar dado algum

#### Scenario: global_admin edita outro global_admin

- **WHEN** um `global_admin` edita os dados, o papel, o status ou a cota de outro
  `global_admin`
- **THEN** a operação é autorizada e os campos informados são alterados

#### Scenario: global_admin edita os próprios dados

- **WHEN** um `global_admin` edita os próprios dados ou a própria cota
- **THEN** a operação é autorizada

#### Scenario: Edição não concede alcance de senha

- **WHEN** um `global_admin` tenta redefinir a senha de outro `global_admin`
- **THEN** a operação continua recusada com permissão insuficiente, ainda que a
  edição daquela mesma pessoa seja permitida

## ADDED Requirements

### Requirement: Nenhuma pessoa altera o próprio papel nem desativa a própria conta

O sistema SHALL recusar, em `PATCH /users/:id`, que uma pessoa altere o **próprio
papel** para um papel diferente do atual, e que altere o **próprio status** para
desativado — qualquer que seja o seu papel, inclusive `global_admin`. A recusa
SHALL ser total: nenhum outro campo enviado na mesma requisição SHALL ser
aplicado.

Editar os **próprios demais dados** (nome, telefone, função, área, observação,
cota) SHALL continuar permitido a quem tem alcance sobre si, e reenviar o
**mesmo** papel que já se tem NÃO SHALL ser tratado como alteração.

Essas duas recusas SHALL ser impostas pelo servidor, e não apenas pela interface.
Elas garantem, por construção, que sempre reste ao menos um `global_admin`
**ativo**: quem executa a operação precisa ser um `global_admin` ativo e não pode
alcançar a si mesmo por nenhum dos dois caminhos. A garantia é necessária porque
o mecanismo de bootstrap só recria um administrador global quando **nenhum
existe** por papel, sem considerar status — um último administrador desativado
não seria recuperado por ele.

#### Scenario: Administrador global não rebaixa a si mesmo

- **WHEN** um `global_admin` tenta alterar o próprio papel para `unit_admin` ou
  `collaborator`
- **THEN** a operação é recusada e nenhum campo da requisição é aplicado

#### Scenario: Administrador global não desativa a própria conta

- **WHEN** um `global_admin` tenta alterar o próprio status para desativado
- **THEN** a operação é recusada e nenhum campo da requisição é aplicado

#### Scenario: Edição dos próprios dados segue permitida

- **WHEN** um `global_admin` edita o próprio nome ou a própria cota, sem tocar no
  papel nem no status
- **THEN** a operação é autorizada

#### Scenario: Reenviar o próprio papel inalterado não é recusa

- **WHEN** uma pessoa envia, na edição de si mesma, o mesmo papel que já possui
- **THEN** a operação é autorizada, por não haver alteração de papel

#### Scenario: Trava vale para qualquer papel

- **WHEN** um `unit_admin` tenta desativar a própria conta
- **THEN** a operação é recusada
