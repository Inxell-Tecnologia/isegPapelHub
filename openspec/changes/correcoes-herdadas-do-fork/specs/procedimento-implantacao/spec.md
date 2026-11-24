## Purpose

Garante que o procedimento de levar um projeto de nuvem vazio até o primeiro
acesso do administrador global, e o de atualizar uma implantação no ar, seja um
documento versionado neste repositório, neutro em relação a cliente, de modo
que qualquer implantação derivada o reaproveite trocando apenas valores.

## ADDED Requirements

### Requirement: Procedimento de implantação de um projeto vazio é documento versionado em fases

O repositório SHALL manter um procedimento versionado que leve um projeto de
nuvem vazio até o primeiro acesso do administrador global, em **fases
ordenadas**. A fronteira entre fases é o instante em que passa a existir um
valor necessário à fase seguinte, e cada dependência circular SHALL ser
declarada explicitamente. Referência: change `correcoes-herdadas-do-fork`,
design.md D4.

#### Scenario: Fase depende de valor criado pela fase anterior
- **WHEN** um passo exige o endereço do serviço da aplicação
- **THEN** ele aparece numa fase posterior à que cria o serviço, e o
  procedimento diz de onde o valor é lido

#### Scenario: Dependências circulares declaradas
- **WHEN** se confere o procedimento
- **THEN** ele declara ao menos o repositório de estado que a ferramenta de
  infraestrutura não cria para si, o endereço do serviço que só existe após o
  primeiro provisionamento e a imagem real de que a criação do administrador
  global depende

### Requirement: Procedimento remete à infraestrutura como código

Cada passo do procedimento SHALL remeter ao ponto da infraestrutura como código
que o sustenta, para que o comando possa ser conferido contra a fonte. O
procedimento NÃO SHALL ser a única fonte das decisões de infraestrutura.

#### Scenario: Passo remete à infraestrutura como código
- **WHEN** um passo provisiona ou configura um recurso de nuvem
- **THEN** o procedimento indica o arquivo da infraestrutura como código que
  define esse recurso

### Requirement: Procedimento é neutro em relação a cliente

O procedimento versionado NÃO SHALL conter valores de uma implantação
específica: identificador de projeto, número de projeto, endereço do serviço,
repositório, identificação do cliente ou endereço do administrador. Esses
valores SHALL aparecer como marcadores nomeados, reunidos numa única tabela que
quem implanta preenche, e os comandos SHALL referenciá-los por variável, nunca
por nome literal de recurso.

#### Scenario: Reaproveitamento por uma nova implantação
- **WHEN** uma nova implantação segue o procedimento
- **THEN** ela só precisa preencher a tabela de valores, e nenhum comando cita
  recurso ou cliente de outra implantação

### Requirement: Condições de falha silenciosa declaradas com sintoma e correção

O procedimento SHALL reunir as condições de configuração que produzem falha
silenciosa ou um sintoma que não aponta a causa, e para cada uma SHALL declarar
o sintoma observável, o diagnóstico e a correção.

#### Scenario: Condição de falha silenciosa é declarada com o sintoma
- **WHEN** o procedimento descreve uma configuração cuja ausência não produz erro
  imediato
- **THEN** ele declara o sintoma observável que a ausência produz e o passo que
  a evita ou a corrige

#### Scenario: Condições conhecidas estão cobertas
- **WHEN** se confere o procedimento
- **THEN** ele cobre ao menos: as formas de endereço do serviço a autorizar sem
  domínio próprio; a ordem entre publicar a aplicação e exigir autenticação no
  canal interno de reconciliação; a alteração classificada como sem efeito em
  produção; a resolução da versão de segredo na criação do recurso; o impasse
  do recurso com criação falha e protegido contra exclusão; a expiração da
  assinatura de notificações de upload e a recuperação dos uploads represados

#### Scenario: Job novo segue o checklist
- **WHEN** alguém acrescenta à infraestrutura um job que reusa a imagem da
  aplicação
- **THEN** o procedimento lista o que o job precisa para ser criado, ser
  atualizado pelo deploy e encontrar o seu módulo, e o que fazer se o primeiro
  provisionamento dele falhar

### Requirement: Atualização de uma implantação no ar tem procedimento próprio

O procedimento SHALL descrever, separadamente do provisionamento inicial, a
ordem de passos para integrar uma alteração de infraestrutura numa implantação
que já atende usuários. A sequência é: integração, implantação com migração,
plano de infraestrutura, aplicação do plano, alinhamento de imagem e execução
de verificação dos jobs. O procedimento SHALL determinar a interrupção quando o
plano previr destruição ou substituição de recurso com dado.

#### Scenario: Plano com destruição interrompe a atualização
- **WHEN** o plano de infraestrutura de uma atualização prevê destruir ou
  substituir o bucket, o banco ou o tópico de notificações
- **THEN** o procedimento manda parar antes de aplicar
