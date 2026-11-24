# Spec Delta

## MODIFIED Requirements

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
