# Spec Delta

## ADDED Requirements

### Requirement: Saudação convida ao tour quem ainda não o fez

A tela inicial SHALL apresentar, à direita da saudação, o convite "Primeira vez
aqui? Faça o tour de 2 minutos" enquanto a pessoa não tiver feito o tour, e
acioná-lo SHALL começar o tour guiado. Depois de feito, o convite NÃO SHALL ser
apresentado. Referência: PRD US 11.3; demanda do cliente nº 2, seção 1.3.

#### Scenario: Quem não fez o tour vê o convite
- **WHEN** uma pessoa que nunca fez o tour abre a tela inicial
- **THEN** vê o convite à direita da saudação, e acioná-lo começa o tour

#### Scenario: Quem já fez o tour não vê o convite
- **WHEN** uma pessoa que já fez ou fechou o tour abre a tela inicial
- **THEN** o convite não é apresentado
