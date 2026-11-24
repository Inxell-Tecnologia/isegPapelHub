# Spec Delta

## Purpose

Definir os dados de controle de um documento — tipo, código, revisão,
responsável e data de próxima revisão —, a apuração da sua situação no momento
da consulta e as regras de circulação que decorrem dela, de modo que a unidade
saiba, por documento, qual versão vale e até quando.

## ADDED Requirements

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
previsto — Protocolo, Procedimento, Política/Norma, Formulário/Checklist,
Fluxograma, Manual, Termo de Consentimento e Comunicado Interno. Valor fora do
conjunto SHALL ser recusado. Cada tipo SHALL ter sigla própria, e a sigla SHALL
acompanhar sempre a cor, nunca sendo substituída por ela. Referência: PRD
US 10.1.

#### Scenario: Tipo fora do conjunto é recusado
- **WHEN** um documento é publicado declarando um tipo que não pertence ao
  conjunto previsto
- **THEN** a operação é recusada e nenhum dado de controle é gravado

#### Scenario: A sigla nunca depende da cor para ser compreendida
- **WHEN** um documento classificado é apresentado numa listagem
- **THEN** a sigla do tipo é apresentada textualmente, de modo que a informação
  permaneça completa para quem não distingue as cores

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
consultado, a partir do estado declarado e da data de próxima revisão, usando o
**relógio do servidor de banco de dados**. A situação NÃO SHALL ser gravada em
coluna própria nem depender de rotina programada para mudar. Referência: PRD
US 10.4.

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

### Requirement: Dados de controle exigidos no envio de um documento

O sistema SHALL exigir tipo, código, revisão e data de próxima revisão quando
um único documento é publicado, e NÃO SHALL exigi-los quando a publicação
abrange vários arquivos ou uma pasta. A recusa por dado faltante SHALL indicar
quais dados faltam. Referência: PRD US 10.5.

#### Scenario: Envio unitário sem os dados é recusado
- **WHEN** um único documento é publicado sem um ou mais dos dados exigidos
- **THEN** a publicação é recusada, a resposta indica quais dados faltam e nada
  é gravado

#### Scenario: Envio em lote dispensa os dados
- **WHEN** vários arquivos, ou uma pasta inteira, são enviados sem dados de
  controle
- **THEN** o envio é aceito e os arquivos ficam com situação Sem controle de
  revisão

#### Scenario: Acervo anterior não é invalidado
- **WHEN** arquivos enviados antes da existência do controle documental são
  consultados
- **THEN** permanecem acessíveis conforme as permissões já resolvidas, com
  situação Sem controle de revisão

### Requirement: Dados de controle podem ser preenchidos ou corrigidos depois

O sistema SHALL permitir alterar os dados de controle de um documento já
existente, exigindo de quem altera a mesma permissão requerida para substituir
aquele documento. A alteração NÃO SHALL exigir novo envio de conteúdo e NÃO
SHALL avançar a revisão por si só. Referência: PRD US 10.5.

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
