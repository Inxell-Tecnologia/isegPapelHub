# gestao-pessoas Specification

## Purpose

Define os requisitos verificáveis da gestão de pessoas do GDoc pela
administração — cadastro, alcance por papel (`global_admin` vs.
`unit_admin`), edição/desativação, e o bootstrap do primeiro administrador
global. Implementa o Épico 1 / US 1.1 e o papel de administração da US 5.1
(alcance por unidade) do PRD (`docs/prd_final.md`); os cenários
Given/When/Then dessas US são vinculantes e este spec os torna verificáveis
no backend.

## Requirements

### Requirement: Cadastro de pessoa pela administração

O sistema SHALL permitir que uma pessoa autenticada com papel de administração
cadastre outra pessoa em `POST /users`, informando nome, unidade, telefone, e-mail,
função/cargo, área de trabalho e observação, e uma senha inicial; a conta criada
SHALL ficar vinculada à unidade e apta a fazer login. NÃO SHALL existir autocadastro
nem convite por e-mail. A unidade de destino SHALL estar **ativa**: o sistema SHALL
recusar (fail-closed) o cadastro em uma unidade com status desativado, sem criar a
conta. A senha inicial SHALL atender ao tamanho mínimo da política de senha (ver
capability `troca-de-senha`): senha mais curta SHALL recusar o cadastro sem criar a
conta. Referência: PRD US 1.1; design.md (gestao-de-unidades) D5/D7; design.md
(troca-de-senha) D8.

#### Scenario: Cadastro válido cria conta apta a login

- **WHEN** um administrador cadastra uma pessoa com os campos exigidos e um e-mail
  ainda não utilizado, em uma unidade ativa
- **THEN** a conta é criada vinculada à unidade informada, com a senha armazenada
  apenas como hash, e a pessoa passa a poder autenticar-se

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

### Requirement: Alcance da gestão por papel

O sistema SHALL restringir a gestão de pessoas ao alcance do administrador:
`global_admin` gerencia pessoas de qualquer unidade; `unit_admin` gerencia somente
pessoas da própria unidade e NÃO SHALL enxergar, criar ou alterar pessoas de outra
unidade — isolamento imposto no banco por RLS, não apenas na aplicação. Referência:
PRD US 5.1.

#### Scenario: Listagem restrita ao alcance

- **WHEN** um `unit_admin` lista pessoas em `GET /users`
- **THEN** vê apenas pessoas da sua própria unidade, nunca de outras

#### Scenario: unit_admin não cria fora da própria unidade nem eleva papel

- **WHEN** um `unit_admin` tenta criar uma pessoa em outra unidade ou com papel
  `global_admin`
- **THEN** a criação é forçada à sua própria unidade e o papel elevado é recusado

#### Scenario: global_admin agrega todas as unidades

- **WHEN** um `global_admin` lista pessoas
- **THEN** vê pessoas de todas as unidades, dentro do seu alcance global

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

### Requirement: Bootstrap do primeiro administrador global

O sistema SHALL prover um mecanismo de seed idempotente que cria um `global_admin`
inicial quando nenhum existir, de modo que a primeira administração possa entrar e
cadastrar as demais pessoas. O seed NÃO SHALL criar um segundo administrador se já
houver `global_admin`.

#### Scenario: Seed cria o primeiro admin apenas uma vez

- **WHEN** o seed roda em um banco sem nenhum `global_admin`
- **THEN** um `global_admin` inicial é criado com senha apenas em hash

#### Scenario: Seed é no-op quando já há administrador

- **WHEN** o seed roda novamente com um `global_admin` já existente
- **THEN** nenhuma conta adicional é criada

### Requirement: Rota de redefinição administrativa de senha

O sistema SHALL expor `POST /users/:id/password` sob as mesmas garantias das demais
rotas de gestão de pessoas — sessão obrigatória, contexto de tenant por transação e
RLS de `users` como fronteira de isolamento entre unidades. O comportamento da
redefinição (geração da senha, exibição única e alcance por papel do alvo) é
definido na capability `troca-de-senha`. Referência: PRD US 1.4.

#### Scenario: Redefinição roda sob o contexto de tenant da requisição

- **WHEN** um administrador chama `POST /users/:id/password`
- **THEN** a operação executa dentro de uma transação com `SET LOCAL` do contexto
  resolvido, com a RLS restringindo as linhas alcançáveis

### Requirement: Cota individual como campo da edição de pessoa

O sistema SHALL aceitar a cota individual de armazenamento como campo da edição
de pessoa em `PATCH /users/:id`, sujeito às mesmas garantias das demais rotas de
gestão de pessoas — sessão obrigatória, contexto de tenant por transação, RLS de
`users` como fronteira de isolamento e alcance pelo papel da pessoa alvo — e,
adicionalmente, ao papel `global_admin`, conforme a capability
`cota-individual`. O campo SHALL distinguir três intenções: ausente (não altera
a cota), remoção explícita (devolve a pessoa ao padrão da plataforma) e valor
(define a exceção nominal).

O valor SHALL ser expresso em **bytes**, na mesma unidade já usada pelas demais
grandezas de armazenamento do sistema, e SHALL ser um inteiro não negativo;
valor negativo ou não inteiro SHALL ser recusado sem alterar dado algum.

#### Scenario: Edição define a cota individual

- **WHEN** um `global_admin` edita uma pessoa informando um valor de cota
  individual
- **THEN** a cota passa a valer para aquela pessoa e a resposta reflete o novo
  valor

#### Scenario: Edição sem o campo preserva a cota vigente

- **WHEN** um administrador edita outros dados de uma pessoa sem informar o
  campo de cota
- **THEN** a cota da pessoa permanece exatamente como estava, seja ela exceção
  nominal ou padrão da plataforma

#### Scenario: Valor inválido é recusado

- **WHEN** um `global_admin` informa um valor de cota negativo ou não inteiro
- **THEN** a edição é recusada e nenhum campo da pessoa é alterado

### Requirement: Consumo de armazenamento visível na gestão de pessoas

O sistema SHALL incluir o **volume já utilizado** pela pessoa na representação
de pessoa devolvida pela gestão de pessoas, de modo que a administração decida
sobre cota vendo o consumo atual. O volume SHALL refletir o mesmo contador que
governa o bloqueio de envio, sem recálculo próprio.

A exposição SHALL respeitar o alcance já imposto pela gestão de pessoas: o
volume de uma pessoa SHALL ser visível apenas a quem já pode enxergar aquela
pessoa.

#### Scenario: Representação de pessoa informa o volume utilizado

- **WHEN** um administrador consulta ou edita uma pessoa dentro do seu alcance
- **THEN** a resposta inclui o volume de armazenamento já utilizado por ela

#### Scenario: Volume não vaza para fora do alcance

- **WHEN** um `unit_admin` lista pessoas
- **THEN** obtém o volume utilizado apenas das pessoas da sua própria unidade

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
