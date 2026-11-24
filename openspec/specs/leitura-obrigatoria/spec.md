# leitura-obrigatoria Specification

## Purpose
TBD - created by archiving change leitura-obrigatoria. Update Purpose after archive.

## Requirements

### Requirement: Publicador marca documento em vigor como leitura obrigatória

Quem pode editar os dados de controle de um documento SHALL poder marcá-lo como
leitura obrigatória, definindo o público, o prazo — com padrão de 15 dias — e
uma mensagem opcional. A marcação SHALL valer para a **revisão vigente** e SHALL
haver no máximo uma por revisão. Somente documento controlado, em vigor e em
formato que abre no visualizador SHALL ser marcado; Arquivo geral, documento sem controle, pendente de cadastro, em
revisão, vencido ou obsoleto SHALL ser recusado com motivo próprio. Quem não
pode editar os dados de controle NÃO SHALL marcar. Referência: PRD US 12.2;
demanda do cliente nº 2, seções 3.1 e 3.2 (etapa 1).

#### Scenario: Marcar documento vigente
- **WHEN** o dono de um documento vigente o marca com público e prazo
- **THEN** a marcação é registrada para a revisão vigente, com público, prazo,
  mensagem, quem marcou e quando

#### Scenario: Documento fora de vigor é recusado
- **WHEN** alguém tenta marcar um documento obsoleto, vencido, pendente de
  cadastro, Arquivo geral ou em formato que não abre no visualizador
- **THEN** a marcação é recusada com motivo que indica que o documento não é
  elegível

#### Scenario: Quem não edita o documento não marca
- **WHEN** um colaborador que só pode visualizar um documento tenta marcá-lo
- **THEN** a marcação é recusada

#### Scenario: A mesma revisão não é marcada duas vezes
- **WHEN** alguém marca de novo uma revisão que já tem marcação
- **THEN** a operação é recusada, e a marcação anterior permanece

### Requirement: Público combinável dentro da unidade, com prévia da contagem

O público SHALL ser definido pela combinação — por união — de toda a unidade,
setores, perfis de acesso e pessoas, sempre dentro da **unidade do documento**,
e SHALL incluir apenas pessoas ativas. Antes de confirmar, o sistema SHALL
informar quantas pessoas serão incluídas. Público vazio SHALL ser recusado.
Setor ou pessoa de outra unidade SHALL ser recusado sem distinguir de
inexistente. Referência: PRD US 12.2; demanda do cliente nº 2, seção 3.2
(etapa 1, itens 3 e 4).

#### Scenario: Prévia conta a união sem repetir pessoas
- **WHEN** o publicador escolhe um setor e, além dele, uma pessoa que já é do
  setor
- **THEN** a prévia conta essa pessoa uma vez só

#### Scenario: Pessoa desativada não entra no público
- **WHEN** o publicador escolhe toda a unidade e há uma pessoa desativada nela
- **THEN** a pessoa desativada não é contada nem recebe pendência

#### Scenario: Público não atravessa unidades
- **WHEN** o publicador inclui uma pessoa de outra unidade
- **THEN** a marcação é recusada como se a pessoa não existisse

### Requirement: Pendência da pessoa que entra depois no público

A pessoa que passa a integrar o público depois da marcação — por admissão ou
troca de setor — SHALL receber a pendência com prazo de 15 dias contados de
quando é alcançada, no máximo na primeira vez que consulta as próprias
leituras. Referência: PRD US 12.2; demanda do cliente nº 2, seção 3.3.

#### Scenario: Troca de setor gera pendência com prazo próprio
- **WHEN** uma pessoa é movida para um setor que estava no público de uma
  marcação, e consulta as próprias leituras
- **THEN** ela tem a pendência, com prazo de 15 dias a partir daquele dia

### Requirement: Situação da leitura apurada na consulta

Cada leitura da pessoa SHALL ter a situação **Pendente**, **Atrasada**,
**Concluída** ou **Encerrada**, apurada no momento da consulta pelo relógio do
servidor de banco, sem depender de rotina. Passado o prazo sem ciência, a
leitura SHALL continuar aberta, como Atrasada. Substituir o documento por nova
revisão, declará-lo obsoleto ou excluí-lo SHALL encerrar as leituras abertas da
revisão marcada; as já concluídas SHALL permanecer concluídas no histórico.
Referência: PRD US 12.3; demanda do cliente nº 2, seções 3.2 (etapa 4) e 3.3.

#### Scenario: Prazo vencido não encerra
- **WHEN** o prazo de uma leitura passa sem ciência
- **THEN** ela aparece como Atrasada e continua aberta

#### Scenario: Nova revisão encerra a pendência da anterior
- **WHEN** o documento é substituído e a revisão avança
- **THEN** a pendência da revisão anterior passa a Encerrada, e a ciência de
  quem já tinha confirmado continua Concluída

#### Scenario: Documento obsoleto encerra as pendências
- **WHEN** o documento é declarado obsoleto
- **THEN** as pendências abertas da revisão marcada passam a Encerrada

### Requirement: Ciência confirmada pela própria pessoa e irreversível

A pessoa SHALL poder confirmar a ciência apenas da **própria** leitura aberta,
de documento que ela alcança. A confirmação SHALL registrar a pessoa, a
unidade, o setor no momento da confirmação, o documento, o código, a revisão, a
data e a hora, e NÃO SHALL poder ser desfeita. Confirmar leitura de outra
pessoa ou inexistente SHALL ser recusado sem distinguir os casos; confirmar
leitura concluída ou encerrada SHALL ser recusado com motivo próprio.
Referência: PRD US 12.3; demanda do cliente nº 2, seções 3.2 (etapa 3) e 3.4.

#### Scenario: Confirmar a própria leitura
- **WHEN** uma pessoa confirma a ciência de uma leitura pendente
- **THEN** a leitura passa a Concluída, com data, hora e o setor dela naquele
  momento

#### Scenario: Ciência não se repete nem se desfaz
- **WHEN** a pessoa tenta confirmar de novo uma leitura concluída
- **THEN** a operação é recusada e o registro original permanece

#### Scenario: Leitura alheia não é confirmada
- **WHEN** uma pessoa tenta confirmar a leitura de outra
- **THEN** a operação é recusada como se a leitura não existisse

### Requirement: Nova revisão permite pedir ciência ao mesmo público

Quando a revisão anterior de um documento teve marcação e a revisão vigente não
tem, o formulário de marcação SHALL vir preenchido com o público da marcação
anterior e SHALL informar que a revisão mudou, para que o publicador peça nova
ciência ao mesmo público. Referência: PRD US 12.2; demanda do cliente nº 2,
seção 3.3 (nova revisão).

#### Scenario: Formulário traz o público anterior
- **WHEN** o publicador abre a leitura obrigatória de um documento substituído
  cuja revisão anterior foi marcada
- **THEN** o formulário vem com o público anterior e o aviso de que a revisão
  mudou

### Requirement: Listagem informa se a revisão vigente é de leitura obrigatória

O resumo de arquivo devolvido pelas listagens SHALL informar se a **revisão
vigente** do documento tem marcação de leitura obrigatória em curso — marcação
da revisão atual, de documento não obsoleto —, apurado na própria consulta. A
informação NÃO SHALL ampliar alcance: SHALL acompanhar apenas documentos que a
listagem já devolve à pessoa, e NÃO SHALL revelar público, prazo ou mensagem da
marcação. Referência: PRD US 12.4; demanda do cliente nº 2, seção 3.5
(Documentos).

#### Scenario: Revisão vigente marcada
- **WHEN** uma pessoa lista a pasta de um documento cuja revisão vigente foi
  marcada
- **THEN** o resumo do documento informa que ele é de leitura obrigatória

#### Scenario: Marcação de revisão anterior não conta
- **WHEN** o documento marcado é substituído e a revisão nova não é marcada
- **THEN** o resumo informa que ele não é de leitura obrigatória

#### Scenario: Documento obsoleto deixa de ser de leitura obrigatória
- **WHEN** o administrador da unidade lista um documento marcado que foi
  declarado obsoleto
- **THEN** o resumo informa que ele não é de leitura obrigatória

### Requirement: Leitor acompanha as próprias leituras em Pendentes e Concluídas

A pessoa SHALL ter um destino **Leitura obrigatória** com as abas
**Pendentes** e **Concluídas**. Pendentes SHALL reunir as leituras abertas —
pendentes e atrasadas, a atrasada sinalizada como **Atrasada** e apresentada
primeiro —, cada uma com o documento (código, título e revisão), o prazo, a
mensagem do publicador e o botão **"Ler e confirmar ciência"**, que SHALL abrir
o documento no visualizador, sem confirmar nada por si. Concluídas SHALL reunir
as ciências confirmadas, com a data e a hora da confirmação. Leitura encerrada
NÃO SHALL aparecer em nenhuma das duas abas. Confirmada a ciência no
visualizador, a leitura SHALL sair de Pendentes e aparecer em Concluídas sem
recarregar a tela. Leitura aberta cujo documento a pessoa não alcança mais NÃO
SHALL oferecer o botão. Referência: PRD US 12.4; demanda do cliente nº 2,
seções 3.2 (etapas 2 e 3) e 3.5 (Menu Leitura obrigatória).

#### Scenario: Pendentes e atrasadas na primeira aba
- **WHEN** uma pessoa com uma leitura pendente e uma atrasada abre o destino
- **THEN** vê as duas em Pendentes, a atrasada primeiro e sinalizada como
  Atrasada, cada uma com o prazo e o botão "Ler e confirmar ciência"

#### Scenario: Confirmar move para Concluídas
- **WHEN** a pessoa aciona "Ler e confirmar ciência", o documento abre no
  visualizador e ela confirma a ciência
- **THEN** a leitura sai de Pendentes e aparece em Concluídas, com a data e a
  hora da confirmação

#### Scenario: Encerrada não aparece
- **WHEN** uma leitura da pessoa foi encerrada por nova revisão do documento
- **THEN** ela não aparece em Pendentes nem em Concluídas

### Requirement: Pessoa do público é avisada da nova leitura

Cada pessoa do público SHALL receber um aviso da leitura obrigatória nova, com
o documento e o prazo: no ato da marcação, para o público daquele momento; e,
para quem entra depois no público, quando a pendência dela nasce — na consulta
às próprias leituras ou pela rotina diária. SHALL haver um aviso por leitura.
A falha ao avisar NÃO SHALL desfazer a marcação. Referência: PRD US 12.5;
demanda do cliente nº 2, seções 3.2 (etapa 2, item 1) e 3.3.

#### Scenario: Marcar avisa o público
- **WHEN** o publicador marca um documento para duas pessoas
- **THEN** cada uma recebe um aviso de nova leitura, com o documento e o prazo

#### Scenario: Quem entra depois é avisado
- **WHEN** uma pessoa passa a casar com o público de uma marcação em curso
- **THEN** ela recebe a pendência e o aviso de nova leitura, uma vez

#### Scenario: Falha ao avisar não desfaz a marcação
- **WHEN** a emissão de um aviso falha durante a marcação
- **THEN** a marcação permanece registrada, e a rotina diária emite o aviso que
  faltou

### Requirement: Rotina diária alcança quem entrou depois no público

Uma rotina diária SHALL reconciliar o público de todas as marcações em curso —
revisão vigente de documento não obsoleto —, criando a pendência de quem passou
a casar com o critério, com prazo de 15 dias a partir daquele dia, sem depender
de a pessoa consultar as próprias leituras. A rotina NÃO SHALL gravar situação:
a situação continua apurada na consulta. Referência: PRD US 12.5; demanda do
cliente nº 2, seção 3.3.

#### Scenario: Troca de setor alcança a pessoa sem ela abrir a aplicação
- **WHEN** uma pessoa é movida para um setor do público de uma marcação, e a
  rotina diária roda
- **THEN** ela passa a ter a pendência, com 15 dias de prazo, e o aviso de nova
  leitura

#### Scenario: Marcação encerrada não alcança ninguém
- **WHEN** o documento de uma marcação ganhou nova revisão ou ficou obsoleto
- **THEN** a rotina não cria pendência dessa marcação para ninguém

### Requirement: Atraso avisa o leitor e o gestor dele, uma vez

Passado o prazo sem ciência, o leitor SHALL receber **um** aviso de atraso por
leitura e prazo, e cada **gestor** dele SHALL receber **um** aviso por
documento e prazo, com a quantidade e os nomes e setores das pessoas atrasadas
no seu alcance. Gestor de um leitor é quem, na **mesma unidade**, ativo e
diferente dele, tem a marcação de acompanhamento da unidade (ou de todas as
unidades) ou a do setor do leitor. Pessoa desativada NÃO SHALL ser avisada nem
contada. Leitura concluída ou encerrada NÃO SHALL gerar aviso de atraso. O
aviso NÃO SHALL encerrar a leitura, que continua aberta como Atrasada. Aviso de
atraso NÃO SHALL ser enviado a gestor de outra unidade. Referência: PRD US
12.5; demanda do cliente nº 2, seção 3.2 (etapa 4, itens 1 e 2).

#### Scenario: Leitor e gestor do setor são avisados
- **WHEN** o prazo de uma leitura passa sem ciência e o setor do leitor tem
  gestor
- **THEN** o leitor recebe o aviso de atraso, e o gestor do setor recebe o aviso
  com o nome do leitor

#### Scenario: Atrasos do mesmo documento e prazo chegam juntos ao gestor
- **WHEN** três pessoas da equipe de um gestor estão atrasadas na mesma
  marcação e prazo
- **THEN** o gestor recebe um único aviso, com a quantidade 3 e os nomes

#### Scenario: Gestor de outro setor não é avisado
- **WHEN** a leitura atrasada é de pessoa de um setor que não é o do gestor do
  setor
- **THEN** esse gestor não recebe aviso dela

#### Scenario: Alcance de todas as unidades não recebe atraso de outra unidade
- **WHEN** uma pessoa com acompanhamento de todas as unidades e uma leitura
  atrasada estão em unidades diferentes
- **THEN** essa pessoa não recebe aviso dessa leitura

#### Scenario: Concluída não gera aviso de atraso
- **WHEN** a pessoa confirmou a ciência antes de a rotina rodar
- **THEN** nem ela nem o gestor recebem aviso de atraso dessa leitura

### Requirement: Acompanhamento por marcação, com os números de 3.5

Quem tem algo a acompanhar — quem criou marcações, gestor do setor ou da
unidade, ou quem acompanha todas as unidades — SHALL ter a aba
**Acompanhamento**, com cada marcação ao seu alcance: unidade, documento,
revisão, prazo, se está em curso ou encerrada, e, sobre as pessoas do seu
alcance, o **público**, os **confirmados**, **pendentes**, **atrasados**,
**encerradas** e a **% de adesão** (confirmados sobre o público). Pessoa
desativada NÃO SHALL contar nem aparecer. Quem não tem nada a acompanhar NÃO
SHALL ver a aba. Referência: PRD US 12.6; demanda do cliente nº 2, seções 3.3
(desligamento) e 3.5.

#### Scenario: Publicador vê os números da marcação que criou
- **WHEN** o publicador marcou um documento para quatro pessoas e duas
  confirmaram, uma está atrasada e uma pendente
- **THEN** vê o público 4, confirmados 2, pendentes 1, atrasados 1 e adesão de
  50%

#### Scenario: Desativado sai do cálculo
- **WHEN** uma pessoa do público é desativada
- **THEN** ela deixa de contar no público e na adesão, e some da lista nominal

#### Scenario: Sem nada a acompanhar, sem aba
- **WHEN** um colaborador que não marcou nada e não é gestor abre Leitura
  obrigatória
- **THEN** vê só Pendentes e Concluídas

### Requirement: Três recortes de alcance no acompanhamento

O acompanhamento SHALL ser recortado no servidor: o **publicador** vê as
marcações que criou, com o público inteiro; o **gestor do setor** vê as
marcações da própria unidade, só com as pessoas do seu setor; o **gestor da
unidade** vê as marcações da própria unidade, com o público inteiro; quem
**acompanha todas as unidades** vê as marcações de todas as unidades, com o
público inteiro. Os recortes SHALL somar por união. O alcance de quem consulta
SHALL ser relido a cada requisição. Marcação fora do recorte, inclusive de
outra unidade, SHALL ser recusada como inexistente. Referência: PRD US 12.6;
demanda do cliente nº 2, seção 3.5 (nota de visibilidade).

#### Scenario: Gestor do setor vê só a equipe
- **WHEN** o gestor do setor CME abre o relatório de uma marcação da unidade
  dirigida a pessoas da CME e da UTI
- **THEN** vê só as pessoas da CME, e os números só delas

#### Scenario: Gestor não vê marcação de outra unidade
- **WHEN** o gestor da unidade pede o relatório de uma marcação de outra unidade
- **THEN** a resposta é a mesma de uma marcação inexistente

#### Scenario: Governança vê todas as unidades
- **WHEN** a pessoa com acompanhamento de todas as unidades abre a aba
- **THEN** vê as marcações das outras unidades, com o público inteiro e a
  unidade de cada pessoa

#### Scenario: Perder a marcação de gestor corta o acompanhamento
- **WHEN** a marcação de gestor de uma pessoa é retirada
- **THEN** na requisição seguinte ela não vê mais as marcações que via por ela

### Requirement: Relatório nominal com filtros e exportação

O relatório de uma marcação SHALL listar as pessoas do recorte com nome,
unidade, setor — o do momento da ciência, para quem confirmou —, situação,
prazo e data e hora da ciência; SHALL permitir filtrar por unidade, setor e
situação; e SHALL exportar em **Excel** e em **PDF** o que está filtrado, com o
documento, a revisão, os filtros aplicados e os números. A exportação SHALL ser
montada no navegador. Referência: PRD US 12.6; demanda do cliente nº 2, seção
3.5 (Acompanhamento).

#### Scenario: Filtrar por situação
- **WHEN** a pessoa filtra o relatório por Atrasada
- **THEN** a lista mostra só as pessoas atrasadas

#### Scenario: Exportar o que está filtrado
- **WHEN** a pessoa filtra por um setor e exporta em Excel ou PDF
- **THEN** o arquivo traz só as pessoas daquele setor, com o documento, a
  revisão, o filtro aplicado e os números
