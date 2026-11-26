# Spec Delta

## ADDED Requirements

### Requirement: Concessões automáticas por autoria convivem com as manuais

O sistema SHALL registrar as concessões automáticas por autoria (capability `posse-e-autoria`) como concessões comuns, identificadas como automáticas por autoria na listagem de concessões do recurso. Elas SHALL valer na resolução de acesso como qualquer concessão, SHALL poder ser revogadas por quem administra concessões e NÃO SHALL gerar aviso ao autor.

#### Scenario: Listagem identifica a concessão automática
- **WHEN** um administrador lista as concessões de uma subpasta criada por um
  colaborador na pasta de Daniel
- **THEN** vê as concessões do colaborador marcadas como automáticas por autoria,
  sem prazo de expiração

#### Scenario: Revogação de concessão automática
- **WHEN** um administrador revoga o verbo `view` automático do autor sobre um item
- **THEN** o autor deixa de ver o item na requisição seguinte, e os demais verbos e
  a autoria registrada permanecem

#### Scenario: Concessão automática não notifica
- **WHEN** um colaborador cria uma subpasta na pasta de Daniel
- **THEN** nenhum aviso de nova concessão é gerado para o colaborador

#### Scenario: Concessão manual posterior não é rebaixada
- **WHEN** um administrador concede manualmente um verbo que o autor já tinha por
  autoria
- **THEN** a operação é idempotente e o verbo continua valendo para o autor
