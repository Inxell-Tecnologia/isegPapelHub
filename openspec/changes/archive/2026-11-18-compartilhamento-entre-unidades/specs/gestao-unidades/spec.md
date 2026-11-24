# Spec Delta

## ADDED Requirements

### Requirement: Marcação da unidade SEDE

O `global_admin` SHALL poder marcar e desmarcar uma unidade como SEDE, e
SHALL existir no máximo uma unidade marcada. Marcar uma segunda unidade
enquanto outra está marcada SHALL ser recusado com 409
`headquarters_already_set`. Desativar a unidade marcada como SEDE SHALL ser
recusado com 409 enquanto a marcação existir. A identidade da SEDE (id e
nome) SHALL ser legível por qualquer unidade, por não ser conteúdo. Nenhum
outro papel SHALL alterar a marcação. Referência: PRD US 5.2; design.md
D11.

#### Scenario: Marcar a SEDE
- **WHEN** o `global_admin` marca a unidade "Sede ISETES" como SEDE e nenhuma
  outra está marcada
- **THEN** a unidade passa a constar como SEDE na listagem de unidades

#### Scenario: Segunda SEDE é recusada
- **WHEN** o `global_admin` tenta marcar outra unidade enquanto a SEDE já
  está marcada
- **THEN** a resposta é 409 `headquarters_already_set` e nada muda

#### Scenario: SEDE marcada não é desativada
- **WHEN** o `global_admin` tenta desativar a unidade marcada como SEDE
- **THEN** a resposta é 409 e a unidade continua ativa

#### Scenario: Administrador de unidade não altera a marcação
- **WHEN** um `unit_admin` tenta marcar ou desmarcar a SEDE
- **THEN** a resposta é 403
