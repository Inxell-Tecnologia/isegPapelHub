# Spec Delta

## ADDED Requirements

### Requirement: Rotina diária de avisos de leitura obrigatória agendada

A infraestrutura de produção SHALL provisionar a rotina diária de avisos de
leitura obrigatória como job em container com agendador próprio, em horário
distinto das demais rotinas diárias, e o ambiente de desenvolvimento SHALL
executá-la sob demanda pelo mesmo código. Referência: PRD US 12.5; design.md
D4 do change `avisos-e-atrasos`.

#### Scenario: Job e agendador provisionados
- **WHEN** a infraestrutura de produção é provisionada
- **THEN** existe um job da rotina de avisos de leitura e um agendador que o
  dispara diariamente às 03:45, depois do expurgo e dos avisos de concessão

#### Scenario: Execução sob demanda em desenvolvimento
- **WHEN** alguém executa a rotina pelo script do workspace da API
- **THEN** ela roda o mesmo código do job de produção e informa quantos avisos
  emitiu e quantos falharam
