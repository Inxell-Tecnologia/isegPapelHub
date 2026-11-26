# Spec Delta

## ADDED Requirements

### Requirement: Remetente do arquivo pendente de cadastro é o autor do envio

O sistema SHALL considerar como "quem o enviou", para a ocultação do arquivo pendente de cadastro, o **autor** do envio (capability `posse-e-autoria`), e não o dono do arquivo. O dono que não é o autor nem administra a unidade NÃO SHALL alcançar o pendente até que o cadastro seja completado. Referência: PRD US 10.9.

#### Scenario: Quem enviou para a pasta de outra pessoa enxerga o próprio pendente
- **WHEN** um colaborador envia, para a pasta de Daniel, um arquivo que fica
  pendente de cadastro, e lista essa pasta
- **THEN** o arquivo lhe é apresentado, identificado como pendente de cadastro,
  embora Daniel seja o dono

#### Scenario: Dono que não enviou não alcança o pendente
- **WHEN** Daniel, sem ser administrador da unidade, lista a própria pasta que
  contém um arquivo pendente de cadastro enviado por um colaborador
- **THEN** o arquivo não lhe é apresentado até que o cadastro seja completado

#### Scenario: Retomada de envio pendente é reconhecida pelo autor
- **WHEN** quem enviou para a pasta de Daniel um arquivo que ficou `pending` com um
  código de documento pede de novo o envio com o mesmo código
- **THEN** o pedido é tratado como retomada daquele envio, e não como conflito de
  código
