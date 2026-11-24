# Spec Delta

## ADDED Requirements

### Requirement: Sino apresenta as notificações não lidas em vermelho legível

O acesso às notificações na barra superior SHALL apresentar, sobre o sino, a quantidade de notificações não lidas num indicador **vermelho**, cujo número SHALL atender ao piso de contraste de texto de 4,5:1 contra o vermelho, apurado por cálculo. Sem não lidas, o indicador NÃO SHALL ser apresentado. O nome acessível do acesso SHALL informar a quantidade. Referência: `docs/demanda_cliente_3.md`, item 10.

#### Scenario: Não lidas aparecem em vermelho sobre o sino
- **WHEN** uma pessoa com três notificações não lidas visualiza a barra superior
- **THEN** vê o número 3 num indicador vermelho sobre o sino

#### Scenario: Número do indicador é legível
- **WHEN** o par formado pelo número e pelo vermelho do indicador é definido ou
  alterado
- **THEN** o contraste é apurado numericamente e atende ao mínimo de 4,5:1

#### Scenario: Sem não lidas não há indicador
- **WHEN** uma pessoa sem notificação não lida visualiza a barra superior
- **THEN** o sino é apresentado sem indicador numérico

#### Scenario: Quantidade anunciada a quem não vê o indicador
- **WHEN** uma tecnologia assistiva alcança o acesso às notificações de uma
  pessoa com três não lidas
- **THEN** o acesso é anunciado com o nome Notificações e a quantidade de não
  lidas

### Requirement: Navegação colapsada não apresenta rótulo de grupo cortado

Com a navegação colapsada, o rótulo de cada grupo SHALL dar lugar a um separador visual entre os grupos, e NÃO SHALL aparecer cortado por reticência. O grupo SHALL continuar nomeado pelo seu rótulo para tecnologia assistiva. Na navegação expandida, os rótulos permanecem visíveis por inteiro. Referência: registro da fatia A em `docs/plano_demanda_cliente_3.md`.

#### Scenario: Colapsada, grupos separados sem texto cortado
- **WHEN** uma pessoa autenticada colapsa a navegação
- **THEN** os grupos NAVEGAÇÃO e AJUDA aparecem separados por um traço, sem texto
  de rótulo cortado

#### Scenario: Grupo continua nomeado com a navegação colapsada
- **WHEN** uma tecnologia assistiva percorre a navegação colapsada
- **THEN** cada grupo é anunciado pelo seu rótulo

#### Scenario: Expandida, o rótulo volta inteiro
- **WHEN** uma pessoa autenticada expande a navegação colapsada
- **THEN** os rótulos NAVEGAÇÃO e AJUDA voltam a aparecer por inteiro
