# Spec Delta

## MODIFIED Requirements

### Requirement: Sugestão de tipo e código a partir do nome do arquivo

A SPA SHALL sugerir tipo e código para a linha cujo nome de arquivo segue o
padrão `SIGLA-AREA-Nº`, reconhecendo as siglas como o cliente as escreve nos
nomes dos arquivos, e NÃO SHALL depender apenas das siglas apresentadas na
interface. A sugestão SHALL ser editável e SHALL ser **visivelmente
distinguível** de um valor confirmado pela pessoa. Nome que não segue o padrão
NÃO SHALL receber sugestão alguma. A sigla `CHK` SHALL sugerir Checklist, e as
siglas `FOR` e `FRM` SHALL sugerir Formulário.

Referência: demanda 2.1 (item 4); design.md D4; change `tipo-checklist`,
design.md D4.

#### Scenario: Nome no padrão sugere tipo e código
- **WHEN** um arquivo chamado `PRT-NSP-001_Identificacao.pdf` entra na tabela
- **THEN** a linha sugere o tipo Protocolo e o código `PRT-NSP-001`, ambos
  editáveis

#### Scenario: Sigla escrita como o cliente a usa é reconhecida
- **WHEN** um arquivo cuja sigla é uma das formas usadas pelo cliente, e não a
  apresentada na interface, entra na tabela
- **THEN** o tipo correspondente é sugerido, em vez de a linha ficar sem
  sugestão

#### Scenario: Checklist e formulário são sugeridos como tipos distintos
- **WHEN** entram na tabela um arquivo chamado `CHK-NSP-002.xlsx` e outro
  chamado `FOR-NSP-003.xlsx`
- **THEN** o primeiro recebe a sugestão Checklist e o segundo, Formulário

#### Scenario: Sugestão é distinguível de valor confirmado
- **WHEN** uma linha tem tipo e código sugeridos e outra tem os mesmos campos
  preenchidos pela pessoa
- **THEN** a interface distingue as duas situações, de modo que uma sugestão
  errada não passe por decisão deliberada

#### Scenario: Nome fora do padrão não recebe sugestão
- **WHEN** um arquivo cujo nome não segue o padrão entra na tabela
- **THEN** os campos de tipo e código daquela linha permanecem vazios
