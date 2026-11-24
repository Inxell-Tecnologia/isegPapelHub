# Spec Delta

## ADDED Requirements

### Requirement: Concessão comum restrita a pessoas da unidade do recurso

A concessão de permissão granular (`POST /grants`) SHALL aceitar como
destinatárias apenas pessoas da mesma unidade do recurso. Quando qualquer
destinatária for de outra unidade, a requisição SHALL ser recusada por
inteiro com 422 `cross_unit_subject`, sem gravar concessão alguma. Isso
substitui a gravação de concessão sem efeito. O compartilhamento entre
unidades segue regras próprias (capability
`compartilhamento-entre-unidades`). Referência: PRD US 5.2, cenário 8;
design.md D10.

#### Scenario: Administradora Global concede a pessoa de outra unidade
- **WHEN** a `global_admin` da SEDE concede `view` sobre uma pasta da SEDE a
  uma pessoa da Unidade Norte pela concessão comum
- **THEN** a resposta é 422 `cross_unit_subject` e nenhuma concessão é
  gravada

#### Scenario: Lote misto é recusado por inteiro
- **WHEN** a concessão comum lista uma pessoa da unidade do recurso e outra
  de unidade diferente
- **THEN** a resposta é 422 `cross_unit_subject` e nenhuma das duas recebe
  concessão

#### Scenario: Concessões sem efeito pré-existentes
- **WHEN** a migração do change é aplicada sobre uma base com concessões
  comuns cuja pessoa é de outra unidade
- **THEN** as de `view`/`download` passam a ser compartilhamentos entre
  unidades por pessoa, com o mesmo prazo, e todas deixam de constar em
  `grants`
