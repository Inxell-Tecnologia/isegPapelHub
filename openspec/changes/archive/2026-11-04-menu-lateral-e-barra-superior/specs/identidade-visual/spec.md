# Spec Delta

## MODIFIED Requirements

### Requirement: Logomarca no shell expandido preserva o nome acessível da marca

A aplicação SHALL garantir que o nome da marca permaneça perceptível por
tecnologia assistiva no shell expandido. Quando o nome do produto acompanhar a
logomarca **em texto**, esse texto SHALL ser o portador do nome acessível e a
logomarca SHALL ser tratada como decorativa — a marca NÃO SHALL ser anunciada
duas vezes. Na ausência de texto irmão, a própria logomarca SHALL carregar o
nome acessível.

Referência: design.md D7 do change `identidade-visual-isetes`, cuja premissa de
"imagem como única portadora" é substituída por design.md D5 do change
`menu-lateral-e-barra-superior`.

#### Scenario: Tecnologia assistiva consulta a marca do shell expandido
- **WHEN** uma tecnologia assistiva consulta a marca do shell com a
  navegação expandida
- **THEN** o nome acessível da marca é o nome da aplicação, anunciado uma única
  vez

#### Scenario: Logomarca acompanhada de texto não repete o nome
- **WHEN** o nome do produto é apresentado em texto ao lado ou abaixo da
  logomarca no shell expandido
- **THEN** a logomarca é decorativa e o nome é anunciado apenas pelo texto

## ADDED Requirements

### Requirement: Marca do shell expandido apresenta o nome e o descritor do produto

A marca do shell com a navegação expandida SHALL apresentar, junto da
logomarca, o nome do produto e um **descritor** do que ele faz, ambos em texto
legível sobre o fundo da navegação. O descritor SHALL ser constante do produto,
e NÃO SHALL variar por papel, por unidade nem por implantação — distingue-se da
identificação do cliente, que é configurada por implantação e permanece
apresentada à parte.

Referência: demanda do cliente nº 2, seção 1.1.

#### Scenario: Marca expandida apresenta nome e descritor
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** lê, junto da logomarca, o nome do produto e o descritor do que ele
  faz, ambos em texto

#### Scenario: Descritor não se confunde com a identificação do cliente
- **WHEN** uma pessoa autenticada visualiza a marca expandida numa implantação
  com identificação de cliente configurada
- **THEN** o descritor do produto e a identificação do cliente são apresentados
  como informações distintas, e o descritor é o mesmo em qualquer implantação

#### Scenario: Navegação colapsada não apresenta o descritor
- **WHEN** uma pessoa autenticada colapsa a navegação
- **THEN** o descritor não é apresentado, por não haver largura que o acomode
  sem truncá-lo
