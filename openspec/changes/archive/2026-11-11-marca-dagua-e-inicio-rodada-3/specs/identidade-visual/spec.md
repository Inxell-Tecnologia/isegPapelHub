# Spec Delta

## ADDED Requirements

### Requirement: Marca d'água do símbolo na área principal

A aplicação SHALL apresentar o símbolo da marca como marca d'água no lado direito da área principal de toda tela autenticada, a 6% de opacidade, atrás do conteúdo e puramente decorativa: não anunciada, sem receber acionamento, sem produzir rolagem e sem baixar abaixo de 4,5:1 o contraste de texto sobre ela, apurado por cálculo. Referência: `docs/demanda_cliente_3.md`, item 5.

#### Scenario: Marca d'água aparece em qualquer tela autenticada
- **WHEN** uma pessoa autenticada abre a tela inicial, o explorador de
  documentos ou qualquer outra tela do shell
- **THEN** vê o símbolo da marca, bem claro, no lado direito da área principal,
  atrás do conteúdo

#### Scenario: Marca d'água não aparece fora do shell autenticado
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a marca d'água da área principal não é apresentada

#### Scenario: Marca d'água não intercepta o acionamento
- **WHEN** uma pessoa aciona um controle, link ou cartão da área principal que
  esteja sobre a marca d'água
- **THEN** o acionamento chega ao controle, como se a marca d'água não existisse

#### Scenario: Marca d'água não é anunciada
- **WHEN** uma tecnologia assistiva percorre a área principal
- **THEN** a marca d'água não é anunciada

#### Scenario: Marca d'água não produz rolagem
- **WHEN** uma pessoa abre qualquer tela autenticada, em qualquer largura e altura
  de tela
- **THEN** a marca d'água não acrescenta rolagem horizontal nem vertical ao
  documento

#### Scenario: Texto sobre a marca d'água mantém o contraste mínimo
- **WHEN** a opacidade da marca d'água da área principal é definida ou alterada
- **THEN** o contraste do texto apresentado diretamente sobre o fundo da área
  principal, contra a mistura desse fundo com o ponto mais escuro do símbolo, é
  apurado numericamente e atende ao piso de 4,5:1
