# Spec Delta

## ADDED Requirements

### Requirement: Envio concluído é registrado com a autoria

O sistema SHALL registrar um evento de auditoria `upload` quando o envio de um arquivo novo é reconciliado, atribuído ao **autor** do envio (capability `posse-e-autoria`) e à unidade do arquivo. A substituição de versão continua registrada como `replace`. O evento `upload` NÃO SHALL ser exposto pela consulta do registro de acesso do arquivo, que permanece restrita a `view` e `download`.

#### Scenario: Envio para pasta de outra pessoa registra quem enviou
- **WHEN** o arquivo enviado por um colaborador para a pasta de Daniel é reconciliado
- **THEN** um evento `upload` é registrado com o colaborador como ator, embora Daniel
  seja o dono

#### Scenario: Envio não reconciliado não gera evento
- **WHEN** um envio recebe URL mas o arquivo nunca chega ao armazenamento
- **THEN** nenhum evento `upload` é registrado

#### Scenario: Consulta de acesso não mostra o envio
- **WHEN** uma pessoa autorizada consulta o registro de acesso de um arquivo enviado
- **THEN** o evento `upload` não aparece entre os eventos retornados
