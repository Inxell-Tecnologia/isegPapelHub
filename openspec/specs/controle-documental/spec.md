# controle-documental Specification

## Purpose

Define os requisitos verificáveis do **documento controlado** no PapelHub — os
dados de controle (tipo, código, revisão, setor responsável e data de próxima
revisão), a apuração da sua **situação no momento da consulta** e as regras de
circulação que decorrem dela, no Épico 10 / **US 10.1 a US 10.7** do PRD
(`docs/prd_final.md`).

A situação nunca é gravada nem depende de rotina programada: é derivada no
`SELECT`, pelo relógio do servidor de banco de dados — o mesmo princípio já
adotado para a vigência de concessões. A regra do documento obsoleto compõe-se
com a resolução de acesso já consolidada (dono OU administrador da unidade OU
concessão vigente) de forma estritamente **restritiva**: subtrai alcance e
nunca concede. Ver a capability `web-navegacao` para a apresentação desses
dados na listagem, `web-upload` para a exigência no envio e `gestao-arquivos`
para o avanço da revisão na substituição.

## Requirements

### Requirement: Documento carrega dados de controle

O sistema SHALL registrar, por documento, tipo, código, revisão, setor
responsável e data de próxima revisão. Cada campo SHALL ser independente dos
demais: a ausência de um NÃO SHALL impedir o registro dos outros, e documento
nenhum SHALL ser recusado por não ter dados de controle. Referência: PRD
US 10.1, US 10.3.

#### Scenario: Documento com dados completos devolve todos eles
- **WHEN** um consumidor obtém um documento cujos cinco dados de controle foram
  informados
- **THEN** recebe os cinco, sem valor presumido

#### Scenario: Documento sem dados de controle permanece íntegro
- **WHEN** um consumidor obtém um documento para o qual nenhum dado de controle
  foi informado
- **THEN** os campos vêm vazios e o documento permanece plenamente acessível
  conforme as permissões já resolvidas

### Requirement: Tipo de documento pertence a um conjunto fechado

O sistema SHALL aceitar como tipo de documento apenas um valor do conjunto
previsto — Protocolo, Procedimento, Política/Norma, Formulário, **Checklist**,
Fluxograma, Manual, Termo de Consentimento, Comunicado Interno e **Arquivo
geral**. Valor fora do conjunto SHALL ser recusado. Cada tipo SHALL ter sigla
própria, e a sigla SHALL acompanhar sempre a cor, nunca sendo substituída por
ela. Formulário e Checklist SHALL ser tipos distintos, com siglas distintas
(`FOR` e `CHK`, como na Matriz de Documentos do cliente). Referência: PRD US
10.1 e US 10.8; retorno do cliente sobre `docs/demanda_cliente_3.md`, item 11.

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

#### Scenario: Checklist é tipo próprio, com os dados de controle da Matriz
- **WHEN** um documento é publicado declarando o tipo Checklist com código,
  revisão, setor responsável e data de próxima revisão
- **THEN** o tipo é aceito e devolvido como Checklist, distinto de Formulário, e
  a situação do documento é apurada como a de qualquer tipo da Matriz

#### Scenario: Acervo classificado como formulário não é reclassificado
- **WHEN** um documento já gravado com o tipo Formulário é consultado depois da
  introdução do Checklist
- **THEN** ele continua com o tipo Formulário, até que alguém com permissão o
  reclassifique pela edição dos dados de controle

### Requirement: Código do documento é único dentro da unidade

O sistema SHALL recusar a gravação de um código de documento que já pertença a
outro documento não excluído da mesma unidade. O mesmo código em unidades
distintas NÃO SHALL conflitar, e a recusa por código repetido NÃO SHALL revelar
dado algum de documento de outra unidade. Referência: PRD US 10.2.

#### Scenario: Código repetido na própria unidade é recusado
- **WHEN** um documento é publicado com código já usado por outro documento
  ativo da mesma unidade
- **THEN** a operação é recusada com erro específico de código em uso, e nenhum
  documento é publicado

#### Scenario: Código repetido em outra unidade é aceito
- **WHEN** um documento é publicado com código que existe apenas em outra
  unidade
- **THEN** a operação é aceita, sem que qualquer informação do documento
  homônimo seja revelada

#### Scenario: Código de documento excluído é liberado para reuso
- **WHEN** um documento é enviado à lixeira e outro é publicado com o mesmo
  código na mesma unidade
- **THEN** a operação é aceita, pois a unicidade alcança apenas os documentos
  não excluídos

#### Scenario: Restauração que recriaria código duplicado é recusada
- **WHEN** um documento é restaurado da lixeira e o seu código já foi reusado
  por outro documento ativo da mesma unidade
- **THEN** a restauração é recusada com erro específico de código em uso, e
  nenhum dos dois documentos é alterado

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

### Requirement: Documento obsoleto sai de circulação para quem não é gestão

O sistema SHALL ocultar o documento declarado obsoleto de toda pessoa que não
seja administradora da unidade do documento, por listagem, por busca e por
acesso direto ao identificador. Esta regra SHALL ser **restritiva**: compõe-se
com a resolução de acesso já existente e NUNCA concede alcance que ela negue.
A ocultação SHALL ser indistinguível da ausência do recurso. Referência: PRD
US 10.7.

#### Scenario: Colaborador não alcança o documento obsoleto por nenhum caminho
- **WHEN** um colaborador com permissão sobre um documento declarado obsoleto o
  procura por listagem, por busca e por acesso direto ao identificador
- **THEN** em nenhum dos três caminhos o documento lhe é apresentado, e a recusa
  do acesso direto é indistinguível de recurso inexistente

#### Scenario: Administrador da unidade continua enxergando o obsoleto
- **WHEN** um administrador da unidade lista a pasta que contém um documento
  declarado obsoleto
- **THEN** o documento é apresentado, com situação Obsoleto

#### Scenario: A regra do obsoleto não atravessa o isolamento por unidade
- **WHEN** um administrador consulta documentos obsoletos
- **THEN** alcança apenas os da própria unidade, sem que a condição de obsoleto
  amplie seu alcance sobre conteúdo de outra unidade

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
