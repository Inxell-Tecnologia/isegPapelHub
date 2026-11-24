# Spec Delta

## ADDED Requirements

### Requirement: Expurgo remove as marcas de favorito do recurso

O expurgo definitivo de uma pasta ou de um arquivo SHALL remover as marcas de
favorito de todas as pessoas sobre aquele recurso, na mesma operação que remove
as suas concessões. A ida para a lixeira NÃO SHALL remover as marcas: o
recurso restaurado SHALL voltar a constar dos favoritos de quem o tinha
marcado. Referência: PRD Épico 6; US 2.5.

#### Scenario: Recurso expurgado não deixa marca órfã
- **WHEN** um arquivo favoritado é expurgado pela rotina de retenção
- **THEN** nenhuma marca de favorito sobre ele permanece registrada

#### Scenario: Ida para a lixeira preserva a marca
- **WHEN** um arquivo favoritado vai para a lixeira e é restaurado antes do
  expurgo
- **THEN** ele volta a constar dos favoritos de quem o tinha marcado
