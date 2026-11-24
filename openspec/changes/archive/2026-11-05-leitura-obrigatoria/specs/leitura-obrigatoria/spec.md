# Spec Delta

## ADDED Requirements

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
