# Spec Delta

## Purpose

Definir a origem única dos tokens de apresentação da SPA — paleta, tipografia,
raio e iconografia — e o piso de acessibilidade verificável que esses tokens têm
de sustentar em qualquer tela. Distingue-se de `identidade-visual`, que trata do
que varia **por implantação** (nome, logomarca, identificação do cliente): os
tokens aqui são constantes do produto, versionadas com o código.

## ADDED Requirements

### Requirement: Tokens de apresentação têm origem única

A SPA SHALL derivar cor, tipografia, raio e espaçamento de um conjunto único de
tokens do design system. Nenhuma tela SHALL introduzir cor de marca, família
tipográfica ou raio por valor literal em folha de estilo avulsa ou atributo de
estilo. Um token acrescentado ou alterado SHALL refletir-se em toda a aplicação
sem edição tela a tela.

#### Scenario: Alteração de token se propaga sem edição tela a tela
- **WHEN** a cor do botão principal é alterada no conjunto de tokens
- **THEN** todas as telas que apresentam botão principal passam a exibir a nova
  cor, sem que nenhum arquivo de tela precise ser editado

#### Scenario: Tela não declara cor de marca por valor literal
- **WHEN** uma tela da SPA precisa apresentar uma cor da paleta da marca
- **THEN** ela a obtém do conjunto de tokens, e não de um literal escrito na
  própria tela

### Requirement: Paleta da marca é normatizada por função

A SPA SHALL aplicar a paleta da marca por **função de interface**, não por
preferência de tela: navegação lateral em degradê azul-marinho, item de
navegação ativo em verde da marca, ação principal em verde de ação, links em
azul, e superfícies e bordas na família neutra clara. A função de cada cor NÃO
SHALL variar por tela, por papel nem por unidade.

#### Scenario: Navegação lateral apresenta o degradê da marca
- **WHEN** uma pessoa autenticada visualiza o shell em tela larga
- **THEN** a navegação lateral apresenta o degradê azul-marinho da marca, e o
  item correspondente à tela corrente é destacado em verde

#### Scenario: A mesma função usa a mesma cor em telas diferentes
- **WHEN** uma pessoa compara a ação principal de duas telas distintas
- **THEN** ambas apresentam a mesma cor de ação principal

### Requirement: Verde da marca não é usado como fundo de texto branco

A SPA NÃO SHALL usar o verde claro da marca como fundo de texto branco, por não
alcançar o contraste mínimo exigido. Superfícies que carregam texto branco SHALL
usar o verde de ação, de tonalidade mais escura. O verde claro permanece
admissível em destaque, indicador e item ativo sobre fundo escuro.

#### Scenario: Botão principal usa o verde de ação
- **WHEN** uma pessoa visualiza um botão de ação principal com rótulo em branco
- **THEN** o fundo do botão é o verde de ação, cujo contraste com o branco
  atende ao mínimo exigido

#### Scenario: Verde claro permanece disponível para destaque
- **WHEN** o item de navegação correspondente à tela corrente é destacado sobre
  a navegação escura
- **THEN** o verde claro da marca é empregado, por não carregar texto branco
  sobre si nessa função

### Requirement: Tipografia da marca não depende de terceiro em tempo de execução

A SPA SHALL servir as famílias tipográficas da marca a partir da própria origem,
e NÃO SHALL depender de serviço de terceiros em tempo de execução para
renderizá-las. A falha ou indisponibilidade de rede externa NÃO SHALL alterar a
tipografia apresentada.

#### Scenario: Tipografia é servida pela mesma origem da aplicação
- **WHEN** uma pessoa abre qualquer tela da aplicação
- **THEN** os arquivos de fonte são obtidos da mesma origem que serve a
  aplicação, sem requisição a domínio de terceiro

#### Scenario: Ausência de rede externa não degrada a tipografia
- **WHEN** a aplicação é aberta sem alcance a domínios externos
- **THEN** as telas são renderizadas com as famílias tipográficas da marca, sem
  recair em fonte substituta

### Requirement: Hierarquia tipográfica distingue título de texto corrido

A SPA SHALL empregar famílias tipográficas distintas para título e para texto
corrido, conforme o guia da marca, mantendo a mesma atribuição em todas as
telas. Nenhum texto visível SHALL ser apresentado abaixo do tamanho mínimo
legível definido pelos tokens.

#### Scenario: Título e corpo usam famílias distintas e constantes
- **WHEN** uma pessoa percorre telas diferentes da aplicação
- **THEN** títulos aparecem na família de título e textos corridos na família de
  texto, sem inversão entre telas

#### Scenario: Nenhum texto fica abaixo do tamanho mínimo
- **WHEN** qualquer tela é apresentada, incluindo legendas e textos auxiliares
- **THEN** nenhum texto visível é renderizado abaixo do tamanho mínimo definido
  pelos tokens

### Requirement: Iconografia provém de biblioteca única

A SPA SHALL obter todos os seus ícones de uma única biblioteca, com traço
uniforme. Duas bibliotecas de ícones NÃO SHALL coexistir na camada de
apresentação, para que o traço não varie entre telas ou entre itens de uma
mesma tela.

#### Scenario: Ícones de telas distintas compartilham o mesmo traço
- **WHEN** uma pessoa compara ícones da navegação, de uma listagem e de um
  diálogo
- **THEN** todos apresentam o mesmo peso e estilo de traço

### Requirement: Piso de acessibilidade verificável na camada visual

A SPA SHALL sustentar, em toda tela, um piso de acessibilidade verificável:
contraste mínimo de 4,5:1 entre texto e seu fundo, indicação visível do
elemento com foco de teclado, e área de acionamento de no mínimo 44 pixels de
altura em controles interativos. O contraste SHALL ser apurado por cálculo, e
NÃO SHALL ser aceito por inspeção visual.

#### Scenario: Par de cores é apurado por cálculo antes de ser adotado
- **WHEN** um par de cores de texto e fundo é definido ou alterado nos tokens
- **THEN** seu contraste é apurado numericamente e atende ao mínimo de 4,5:1

#### Scenario: Navegação por teclado revela o elemento focado
- **WHEN** uma pessoa percorre os controles de uma tela usando apenas o teclado
- **THEN** o elemento que detém o foco é visualmente distinguível dos demais

#### Scenario: Controle interativo respeita a área mínima de acionamento
- **WHEN** uma pessoa aciona um controle interativo em dispositivo de toque
- **THEN** a área sensível do controle tem ao menos 44 pixels de altura
