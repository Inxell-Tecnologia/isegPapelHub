# Spec Delta

## ADDED Requirements

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
