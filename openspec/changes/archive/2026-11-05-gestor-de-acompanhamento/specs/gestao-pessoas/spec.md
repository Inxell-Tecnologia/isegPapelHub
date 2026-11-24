# Spec Delta

## ADDED Requirements

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
