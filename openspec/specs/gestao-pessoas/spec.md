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

### Requirement: Cadastro registra quem acompanha as leituras e com que alcance

A administração SHALL poder marcar, no cadastro de uma pessoa, que ela
**acompanha as leituras** de um destes alcances: **do setor** dela, **da
unidade** dela ou **de todas as unidades**; ou que não acompanha. A marcação
SHALL ser explícita e NÃO SHALL ser deduzida do cargo. O sistema SHALL
registrar quem fez a última alteração da marcação e quando. Referência: PRD US
12.1; demanda do cliente nº 2, seção 3.1; `docs/respostas_d1_d3_d5_decisoes_
estruturais.txt`, respostas 6a e 8.

#### Scenario: Marcar gestor da unidade
- **WHEN** um administrador marca uma pessoa da sua unidade como gestora da
  unidade
- **THEN** a pessoa passa a constar com esse alcance, e fica registrado quem a
  marcou e quando

#### Scenario: Cargo não decide a marcação
- **WHEN** uma pessoa tem o cargo "Coordenadora" e nenhuma marcação
- **THEN** ela não consta como gestora de alcance algum

### Requirement: Gestor do setor exige setor

A marcação **do setor** SHALL exigir que a pessoa tenha setor. Marcar gestor do
setor uma pessoa sem setor, ou remover o setor de quem é gestor do setor, SHALL
ser recusado com motivo próprio, sem aplicar nenhum campo da requisição, e NÃO
SHALL converter o alcance em outro. Referência: PRD US 12.1.

#### Scenario: Pessoa sem setor não vira gestora do setor
- **WHEN** um administrador marca como gestora do setor uma pessoa sem setor
- **THEN** a operação é recusada com motivo que indica a falta do setor

#### Scenario: Remover o setor do gestor do setor é recusado
- **WHEN** um administrador remove o setor de uma pessoa marcada como gestora do
  setor
- **THEN** a operação é recusada, e a pessoa continua com o setor e a marcação

### Requirement: Alcance de todas as unidades é concedido só pelo administrador global

Atribuir, alterar ou retirar o alcance **de todas as unidades** SHALL ser
exclusivo do administrador global. O administrador da unidade SHALL ser
recusado ao tentar atribuí-lo e ao tentar alterar a marcação de quem o tem.
Referência: PRD US 12.1; `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`,
respostas 7a e 8.

#### Scenario: Administrador da unidade não concede todas as unidades
- **WHEN** um administrador da unidade marca uma pessoa como gestora de todas as
  unidades
- **THEN** a operação é recusada e nada é alterado

#### Scenario: Administrador da unidade não retira todas as unidades
- **WHEN** um administrador da unidade altera a marcação de uma pessoa que é
  gestora de todas as unidades
- **THEN** a operação é recusada e a marcação permanece

#### Scenario: Administrador global concede todas as unidades
- **WHEN** o administrador global marca uma pessoa como gestora de todas as
  unidades
- **THEN** a pessoa passa a constar com esse alcance

### Requirement: Ninguém altera a própria marcação de acompanhamento

Nenhuma pessoa SHALL alterar a própria marcação de acompanhamento, qualquer que
seja o seu papel. Reenviar o mesmo valor vigente NÃO SHALL ser tratado como
alteração. Referência: PRD US 12.1; mesma trava de "Nenhuma pessoa altera o
próprio papel nem desativa a própria conta".

#### Scenario: Administrador não se marca gestor
- **WHEN** um administrador tenta marcar a si mesmo como gestor
- **THEN** a operação é recusada

### Requirement: A marcação não concede acesso a conteúdo

A marcação de acompanhamento NÃO SHALL conceder cadastrar pessoas, liberar
permissões nem visualizar, baixar ou alterar arquivo e pasta. Ela SHALL ser
relida a cada requisição, junto com o papel e a situação da conta, de modo que
retirá-la valha na requisição seguinte. O que ela libera é exclusivamente o
acompanhamento da leitura obrigatória, definido pela capability de leitura
obrigatória. Referência: PRD US 12.1; `docs/respostas_a1_funcao_e_setor.txt`,
resposta 4b.

#### Scenario: Gestor da unidade não abre arquivo alheio sem permissão
- **WHEN** uma pessoa marcada como gestora da unidade tenta visualizar um
  arquivo de outra pessoa sobre o qual não tem permissão
- **THEN** o acesso é recusado, como antes da marcação

#### Scenario: Retirar a marcação vale na requisição seguinte
- **WHEN** a administração retira a marcação de uma pessoa com sessão aberta
- **THEN** a identidade dela deixa de indicar o alcance na requisição seguinte,
  sem novo login

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
