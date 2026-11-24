# controle-documental — delta

## MODIFIED Requirements

### Requirement: Tipo de documento pertence a um conjunto fechado

O sistema SHALL aceitar como tipo de documento apenas um valor do conjunto
previsto — Protocolo, Procedimento, Política/Norma, Formulário/Checklist,
Fluxograma, Manual, Termo de Consentimento, Comunicado Interno e **Arquivo
geral**. Valor fora do conjunto SHALL ser recusado. Cada tipo SHALL ter sigla
própria, e a sigla SHALL acompanhar sempre a cor, nunca sendo substituída por
ela. Referência: PRD US 10.1 e US 10.8.

#### Scenario: Tipo fora do conjunto é recusado
- **WHEN** um documento é publicado declarando um tipo que não pertence ao
  conjunto previsto
- **THEN** a operação é recusada e nenhum dado de controle é gravado

#### Scenario: A sigla nunca depende da cor para ser compreendida
- **WHEN** um documento classificado é apresentado numa listagem
- **THEN** a sigla do tipo é apresentada textualmente, de modo que a informação
  permaneça completa para quem não distingue as cores

#### Scenario: Arquivo geral pertence ao conjunto
- **WHEN** um arquivo é publicado declarando o tipo Arquivo geral
- **THEN** o tipo é aceito, e o arquivo não passa a exigir código, revisão nem
  data de próxima revisão

### Requirement: Situação do documento é apurada no momento da consulta

O sistema SHALL derivar a situação de cada documento no momento em que ele é
consultado, a partir do estado do seu cadastro, do seu tipo, do estado declarado
e da data de próxima revisão, usando o **relógio do servidor de banco de
dados**. A situação NÃO SHALL ser gravada em coluna própria nem depender de
rotina programada para mudar. Referência: PRD US 10.4.

#### Scenario: Documento dentro do prazo é Vigente
- **WHEN** um documento tem data de próxima revisão a mais de 60 dias e não foi
  declarado em revisão nem obsoleto
- **THEN** sua situação é apurada como Vigente

#### Scenario: Documento dentro da janela de 60 dias está A vencer
- **WHEN** a data de próxima revisão de um documento ocorre dentro dos próximos
  60 dias
- **THEN** sua situação é apurada como A vencer, acompanhada do número de dias
  restantes

#### Scenario: Documento com data ultrapassada está com revisão vencida
- **WHEN** a data de próxima revisão de um documento já passou
- **THEN** sua situação é apurada como Revisão vencida

#### Scenario: Estado declarado prevalece sobre a data
- **WHEN** um documento é declarado em revisão e sua data de próxima revisão
  ainda está distante
- **THEN** sua situação é apurada como Em revisão

#### Scenario: Documento sem data fica sem controle de revisão
- **WHEN** um documento não tem data de próxima revisão informada e não foi
  declarado em revisão nem obsoleto
- **THEN** sua situação é apurada como Sem controle de revisão, e ele não é
  contado entre os documentos a vencer nem entre os vencidos

#### Scenario: A virada de prazo não espera rotina nenhuma
- **WHEN** um documento ultrapassa sua data de próxima revisão e é consultado em
  seguida, sem que nenhuma rotina programada tenha sido executada
- **THEN** sua situação já é apurada como Revisão vencida

#### Scenario: Pendência de cadastro prevalece sobre qualquer outra apuração
- **WHEN** um arquivo pendente de cadastro é consultado, ainda que tenha data de
  próxima revisão ou estado declarado
- **THEN** sua situação é apurada como Pendente de cadastro, e ele não é contado
  entre os documentos a vencer nem entre os vencidos

#### Scenario: Arquivo geral não tem situação a apurar
- **WHEN** um arquivo do tipo Arquivo geral é consultado
- **THEN** nenhuma situação de revisão lhe é atribuída, e ele não é contado entre
  os documentos a vencer, vencidos ou sem controle de revisão

### Requirement: Dados de controle podem ser preenchidos ou corrigidos depois

O sistema SHALL permitir alterar os dados de controle de um documento já
existente, exigindo de quem altera a mesma permissão requerida para substituir
aquele documento. A alteração NÃO SHALL exigir novo envio de conteúdo e NÃO
SHALL avançar a revisão por si só. Quando a alteração completar os dados
exigidos de um arquivo pendente de cadastro, o sistema SHALL publicá-lo na mesma
operação. Referência: PRD US 10.5 e US 10.9.

#### Scenario: Documento sem dados recebe os dados depois
- **WHEN** quem tem permissão de substituir um documento informa seus dados de
  controle
- **THEN** o documento passa a apresentá-los e sua situação é reapurada, sem que
  nenhum conteúdo seja reenviado

#### Scenario: Sem permissão, os dados não mudam
- **WHEN** uma pessoa sem permissão de substituir tenta alterar os dados de
  controle de um documento
- **THEN** a alteração é recusada e os dados permanecem como estavam

#### Scenario: Alterar dados não avança a revisão
- **WHEN** apenas os dados de controle de um documento são alterados
- **THEN** a revisão permanece a mesma, pois nenhum conteúdo foi substituído

#### Scenario: Completar o cadastro publica o arquivo pendente
- **WHEN** quem pode alterar os dados de um arquivo pendente de cadastro informa
  o último dado que faltava
- **THEN** o arquivo deixa de estar pendente de cadastro e passa a circular
  conforme as permissões já resolvidas

#### Scenario: Preenchimento parcial mantém a pendência
- **WHEN** parte dos dados exigidos de um arquivo pendente de cadastro é
  informada, restando algum deles em falta
- **THEN** os dados informados são gravados e o arquivo permanece pendente de
  cadastro

#### Scenario: Completar o cadastro considera o que já estava gravado
- **WHEN** um arquivo pendente de cadastro já tem parte dos dados gravados e
  recebe apenas os que faltavam
- **THEN** o arquivo é publicado, sem que seja preciso reinformar os dados que já
  constavam

## ADDED Requirements

### Requirement: Dados de controle exigidos na publicação de cada documento

O sistema SHALL exigir tipo, código, revisão, responsável e data de próxima
revisão para publicar um documento controlado, **por arquivo** e
independentemente de o envio abranger um arquivo, vários arquivos ou uma pasta.
Dado ausente NÃO SHALL recusar o envio de vários arquivos ou de pasta: o arquivo
SHALL ser salvo como pendente de cadastro. A recusa por dado faltante SHALL
indicar quais dados faltam. Referência: PRD US 10.5.

#### Scenario: Envio unitário sem os dados é recusado
- **WHEN** um único documento é publicado sem um ou mais dos dados exigidos
- **THEN** a publicação é recusada, a resposta indica quais dados faltam e nada
  é gravado

#### Scenario: Item de lote sem os dados é salvo como pendente de cadastro
- **WHEN** vários arquivos, ou uma pasta inteira, são enviados e parte dos itens
  vem sem os dados exigidos
- **THEN** o envio é aceito, os itens completos são publicados e os incompletos
  ficam pendentes de cadastro, sem que nenhum deles seja publicado sem os dados

#### Scenario: Cada item do lote tem os seus próprios dados
- **WHEN** um lote é enviado com dados de controle distintos por arquivo
- **THEN** cada arquivo recebe os dados que lhe foram informados, sem que os
  dados de um item alcancem outro

#### Scenario: Dado inválido é recusado em vez de virar pendência
- **WHEN** um item de um envio informa um dado de controle inválido, como tipo
  fora do conjunto ou data impossível
- **THEN** aquele item é recusado com a indicação do problema, e não é salvo como
  pendente de cadastro

#### Scenario: Arquivo geral é publicado sem os dados de controle
- **WHEN** um arquivo é enviado declarando o tipo Arquivo geral e sem código,
  revisão ou data de próxima revisão
- **THEN** o arquivo é publicado normalmente e não fica pendente de cadastro

#### Scenario: Repetir item que falhou não é barrado por falta de dados
- **WHEN** a transferência de um item de um lote falha e o envio daquele item é
  repetido sem dados de controle
- **THEN** a repetição é aceita, ficando o arquivo pendente de cadastro, sem que
  a falta de dados impeça concluir a transferência

#### Scenario: Acervo anterior não é invalidado
- **WHEN** arquivos enviados antes da existência do controle documental são
  consultados
- **THEN** permanecem acessíveis conforme as permissões já resolvidas, com
  situação Sem controle de revisão, sem que nenhum deles se torne inválido,
  inacessível ou pendente de cadastro

### Requirement: Arquivo geral é declarado fora do controle documental

O sistema SHALL tratar o arquivo do tipo Arquivo geral como declaradamente fora
do controle documental: NÃO SHALL exigir nem aceitar código, revisão ou data de
próxima revisão para ele, e NÃO SHALL lhe atribuir situação de revisão. A
declaração SHALL ser distinta da simples ausência de dados de controle.
Referência: PRD US 10.8.

#### Scenario: Código informado para Arquivo geral é recusado
- **WHEN** um arquivo é enviado declarando o tipo Arquivo geral e informando
  código, revisão ou data de próxima revisão
- **THEN** a operação é recusada e nada é gravado

#### Scenario: Arquivo geral é distinguível de arquivo sem cadastro
- **WHEN** um arquivo declarado Arquivo geral e um arquivo pendente de cadastro
  são consultados
- **THEN** cada um é apresentado com a sua própria condição, sem que a ausência
  de dados de controle os torne indistinguíveis

#### Scenario: Declarar Arquivo geral exige a mesma permissão dos demais dados
- **WHEN** uma pessoa sem permissão de substituir um documento tenta declará-lo
  Arquivo geral
- **THEN** a alteração é recusada e o tipo permanece como estava

### Requirement: Arquivo pendente de cadastro não circula até ser completado

O sistema SHALL ocultar o arquivo pendente de cadastro de toda pessoa que não
seja quem o enviou nem administradora da unidade do arquivo, por listagem, por
busca, por acesso direto ao identificador e no manifesto de download de pasta.
Esta regra SHALL ser **restritiva**: compõe-se com a resolução de acesso já
existente e NUNCA concede alcance que ela negue. A ocultação SHALL ser
indistinguível da ausência do recurso. Referência: PRD US 10.9.

#### Scenario: Colaborador não alcança o pendente por nenhum caminho
- **WHEN** um colaborador com permissão sobre um arquivo pendente de cadastro de
  outra pessoa o procura por listagem, por busca, por acesso direto ao
  identificador e por download da pasta que o contém
- **THEN** em nenhum dos quatro caminhos o arquivo lhe é apresentado, e a recusa
  do acesso direto é indistinguível de recurso inexistente

#### Scenario: Quem enviou continua enxergando o próprio pendente
- **WHEN** quem enviou um arquivo que ficou pendente de cadastro lista a pasta
  que o contém
- **THEN** o arquivo é apresentado, identificado como pendente de cadastro

#### Scenario: Administrador da unidade enxerga os pendentes da unidade
- **WHEN** um administrador da unidade lista a pasta que contém arquivo pendente
  de cadastro enviado por outra pessoa
- **THEN** o arquivo é apresentado, identificado como pendente de cadastro

#### Scenario: A regra do pendente não atravessa o isolamento por unidade
- **WHEN** um administrador consulta arquivos pendentes de cadastro
- **THEN** alcança apenas os da própria unidade, sem que a condição de pendente
  amplie seu alcance sobre conteúdo de outra unidade

#### Scenario: Ser quem enviou não amplia alcance além do já autorizado
- **WHEN** quem enviou um arquivo pendente de cadastro perde a permissão sobre
  ele ou ele é excluído
- **THEN** o arquivo deixa de lhe ser apresentado, sem que a condição de
  remetente lhe conceda alcance que a resolução de acesso nega

#### Scenario: Arquivo pendente não é publicado pela passagem do tempo
- **WHEN** um arquivo permanece pendente de cadastro e é consultado depois de
  qualquer intervalo, sem que seus dados tenham sido completados
- **THEN** continua pendente de cadastro e continua oculto a quem não é o
  remetente nem administrador da unidade

## REMOVED Requirements

### Requirement: Dados de controle exigidos no envio de um documento

**Reason**: O requisito prendia a exigência dos dados de controle à **rota** em
vez do item — exigia no envio unitário e dispensava no lote e na pasta (decisões
D7 e D9 do change `controle-documental`). A seção 2 de
`docs/demanda_cliente_2.md` classifica essa dispensa como defeito: é o caminho
de entrada mais rápido do sistema e também o único que não pede nada, de modo
que o acervo acumula exatamente os documentos sem rastreio que o Épico 10 existe
para evitar. O cenário "Envio em lote dispensa os dados" nomeia explicitamente a
dispensa, e mantê-lo sob MODIFIED produziria nome de cenário em contradição com
o próprio corpo do requisito.

**Migration**: Substituído pelo requisito "Dados de controle exigidos na
publicação de cada documento", que preserva as duas garantias do anterior — a
recusa do envio unitário incompleto, nomeando o que falta, e a integridade do
acervo anterior (cenário "Acervo anterior não é invalidado", mantido palavra por
palavra) — e acrescenta a exigência por item no lote e na pasta, com o item
incompleto salvo como pendente de cadastro em lugar de publicado sem rastreio.
Nenhuma garantia é perdida; a dispensa do lote é a única coisa que deixa de
valer, e é o objeto desta change. O motivo que sustentava D9 (repetir um item
falho não é publicar documento novo) segue atendido: a repetição é aceita como
pendente, nunca recusada por falta de dados. O conjunto exigido passa de quatro
para cinco campos, com a inclusão do responsável, conforme a tabela 2.2 da
demanda.
