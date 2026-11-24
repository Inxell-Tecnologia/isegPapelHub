# Spec Delta

## ADDED Requirements

### Requirement: Envio de um documento pede os dados de controle antes de publicar

A SPA SHALL solicitar tipo, código, revisão e data de próxima revisão quando a
pessoa envia **um único** documento, antes de concluir a publicação. A SPA NÃO
SHALL solicitá-los quando o envio abrange vários arquivos ou uma pasta. A
recusa do servidor por dado faltante ou por código em uso SHALL ser apresentada
de forma distinguível, indicando o que corrigir.

#### Scenario: Envio de um documento apresenta o formulário
- **WHEN** uma pessoa seleciona um único arquivo para enviar
- **THEN** a SPA pede tipo, código, revisão e data de próxima revisão antes de
  concluir a publicação

#### Scenario: Envio de vários arquivos não apresenta o formulário
- **WHEN** uma pessoa seleciona vários arquivos, ou arrasta uma pasta inteira
- **THEN** o envio prossegue sem pedir dados de controle

#### Scenario: Código em uso é apresentado como recusa específica
- **WHEN** o servidor recusa a publicação porque o código informado já pertence
  a outro documento da unidade
- **THEN** a SPA apresenta aviso específico de código em uso, distinguível da
  recusa por dado faltante e da recusa por permissão
