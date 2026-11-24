# Spec Delta

## MODIFIED Requirements

### Requirement: Nome da aplicação exibido é PapelHub

A aplicação SHALL exibir **PapelHub** como nome do produto em toda a camada
de apresentação: título do documento no navegador, cabeçalho da tela de
login, marca do shell autenticado e tela de Início. O nome NÃO SHALL variar
por papel, por unidade ou por estado de autenticação.

O **título do documento** SHALL ser composto pelo nome da aplicação seguido
da identificação do cliente, quando esta estiver configurada, no formato
`PapelHub - SETES`. O título estático servido no documento SHALL conter
**apenas o nome da aplicação**, e a composição com a identificação do cliente
SHALL ocorrer em tempo de execução, após a resolução da configuração — de
modo que a identificação NÃO SHALL ser fixada em tempo de compilação. Sem
identificação configurada, o título SHALL permanecer apenas com o nome da
aplicação. Identificadores internos de código e infraestrutura (scope npm,
nomes de banco, `name_prefix` do Terraform) permanecem inalterados e não são
objeto deste requisito.

#### Scenario: Título do documento compõe nome e identificação do cliente
- **WHEN** uma pessoa abre a aplicação no navegador com a identificação do cliente
  configurada como `SETES`
- **THEN** o título do documento apresenta `PapelHub - SETES`

#### Scenario: Sem identificação configurada o título fica só com o nome
- **WHEN** uma pessoa abre a aplicação numa implantação sem identificação de
  cliente configurada
- **THEN** o título do documento apresenta apenas `PapelHub`

#### Scenario: Identificação do cliente não é fixada em tempo de compilação
- **WHEN** a identificação do cliente é alterada na configuração da implantação
- **THEN** o título do documento passa a refletir a nova identificação sem exigir
  nova compilação do frontend

#### Scenario: Tela de login apresenta o nome da aplicação
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** o cabeçalho da tela apresenta o nome **PapelHub**

#### Scenario: Shell autenticado apresenta a marca em ambos os estados
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida e
  depois colapsada
- **THEN** a marca apresenta o nome **PapelHub** em texto no estado expandido e,
  no estado colapsado, o símbolo da marca cujo nome acessível é **PapelHub**

### Requirement: Logomarca oficial é exibida na tela de login e no shell expandido

A aplicação SHALL exibir a logomarca oficial — a logo **branca** do Instituto
SETES, de fundo transparente — na tela de login e no shell autenticado com a
navegação expandida. A logomarca SHALL ser apresentada apenas sobre os fundos
escuros da marca (o degradê da navegação e o campo escuro da tela de login), e
NÃO SHALL ser exibida sobre fundo claro. Por ter fundo transparente, ela NÃO
SHALL receber moldura própria.

Referência: `docs/demanda_cliente_3.md`, item 1; dependência externa E1 de
`docs/plano_demanda_cliente_2.md`.

#### Scenario: Logomarca aparece na tela de login
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a logomarca oficial é exibida sobre o campo escuro da composição,
  junto ao cabeçalho com o nome da aplicação, sem moldura própria

#### Scenario: Logomarca aparece no shell expandido
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** a logomarca oficial é exibida diretamente sobre o fundo da navegação,
  no topo, sem moldura própria

#### Scenario: Logomarca não aparece sobre fundo claro
- **WHEN** qualquer tela da aplicação apresenta a logomarca oficial
- **THEN** o fundo imediatamente atrás dela é um dos fundos escuros da marca

### Requirement: Logomarca no shell expandido preserva o nome acessível da marca

A aplicação SHALL garantir que o nome do produto seja anunciado uma única vez
no shell expandido, pelo texto **PapelHub** que acompanha a logomarca. Por
conter o nome da organização, a logomarca do shell SHALL carregar como nome
acessível o nome da organização, e NÃO SHALL repetir o nome do produto. Na
tela de login, onde a identificação do cliente já está em texto, a logomarca
SHALL ser decorativa.

Referência: design.md D7 do change `identidade-visual-isetes`, cuja premissa de
"imagem como única portadora" é substituída por design.md D5 do change
`menu-lateral-e-barra-superior`, por sua vez ajustada por design.md D3 do
change `identidade-isetes-e-menu-compacto`.

#### Scenario: Tecnologia assistiva consulta a marca do shell expandido
- **WHEN** uma tecnologia assistiva consulta a marca do shell com a
  navegação expandida
- **THEN** o nome da aplicação é anunciado uma única vez, pelo texto, e a
  logomarca é anunciada pelo nome da organização

#### Scenario: Logomarca acompanhada de texto não repete o nome
- **WHEN** o nome do produto é apresentado em texto abaixo da logomarca no shell
  expandido
- **THEN** a logomarca não repete o nome do produto, e o nome é anunciado apenas
  pelo texto

#### Scenario: Logomarca do login é decorativa
- **WHEN** uma tecnologia assistiva percorre a tela de login
- **THEN** a logomarca não é anunciada, e o nome da aplicação e a
  identificação do cliente são anunciados pelo texto

### Requirement: Favicon reflete a logomarca oficial

O favicon da aplicação SHALL ser derivado do **símbolo** da logomarca oficial,
enquadrado em proporção quadrada **sem distorcer** a arte — por margem
transparente ou recorte que preserve o símbolo inteiro, nunca por estiramento.

#### Scenario: Aba do navegador exibe o favicon derivado da logomarca
- **WHEN** uma pessoa abre a aplicação no navegador
- **THEN** o ícone exibido na aba é o símbolo da logomarca oficial, inteiro, sem
  aparecer esticado ou distorcido

### Requirement: Marca do shell expandido apresenta o nome e o descritor do produto

A marca do shell com a navegação expandida SHALL apresentar, junto da
logomarca, o nome do produto e um **descritor** do que ele faz, ambos em texto
legível sobre o fundo da navegação. O descritor SHALL ser constante do produto,
e NÃO SHALL variar por papel, por unidade nem por implantação. A marca
expandida NÃO SHALL repetir a identificação do cliente em texto, por a
logomarca já identificar a organização; a identificação continua no título do
documento e na tela de login.

Referência: demanda do cliente nº 2, seção 1.1; `docs/demanda_cliente_3.md`,
item 1.

#### Scenario: Marca expandida apresenta nome e descritor
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** lê, logo abaixo da logomarca, o nome do produto e o descritor do que
  ele faz, ambos em texto

#### Scenario: Descritor não se confunde com a identificação do cliente
- **WHEN** uma pessoa autenticada visualiza a marca expandida numa implantação
  com identificação de cliente configurada
- **THEN** a marca apresenta a logomarca, o nome e o descritor, sem uma linha
  de texto com a identificação do cliente, e o descritor é o mesmo em qualquer
  implantação

#### Scenario: Navegação colapsada não apresenta o descritor
- **WHEN** uma pessoa autenticada colapsa a navegação
- **THEN** o descritor não é apresentado, por não haver largura que o acomode
  sem truncá-lo

## REMOVED Requirements

### Requirement: Logomarca não é exibida no estado colapsado do shell

**Reason**: a regra existia porque o único ativo disponível era retrato e sem
transparência, ilegível nos 80 px da coluna colapsada. O símbolo isolado do
ISETES, de fundo transparente, cabe nessa largura (`docs/demanda_cliente_3.md`,
decisão "troca tudo").

**Migration**: substituído pelo requisito "Navegação colapsada apresenta o
símbolo da marca", abaixo.

## ADDED Requirements

### Requirement: Navegação colapsada apresenta o símbolo da marca

O shell autenticado, com a navegação colapsada, SHALL apresentar o **símbolo**
da logomarca no lugar da marca, com nome acessível **PapelHub**, e NÃO SHALL
apresentar a logo com texto, o nome em texto nem o descritor.

#### Scenario: Navegação colapsada mostra o símbolo
- **WHEN** uma pessoa autenticada colapsa a navegação do shell
- **THEN** a marca é apresentada pelo símbolo, inteiro e sem distorção, e
  tecnologia assistiva o anuncia como PapelHub

### Requirement: Marca d'água do símbolo no pé da navegação

A navegação expandida SHALL apresentar o símbolo da marca como **marca d'água**
no seu pé, puramente decorativa: NÃO SHALL ser anunciada por tecnologia
assistiva, NÃO SHALL receber acionamento e NÃO SHALL reduzir o contraste de
nenhum texto que passe sobre ela abaixo do piso de `sistema-de-design`, apurado
por cálculo contra a cor mais clara do símbolo. Na navegação colapsada ela NÃO
SHALL ser apresentada.

Referência: `docs/demanda_cliente_3.md`, item 3.

#### Scenario: Marca d'água aparece no pé da navegação
- **WHEN** uma pessoa autenticada visualiza a navegação expandida
- **THEN** vê o símbolo da marca, bem claro, no pé da coluna, atrás do conteúdo

#### Scenario: Marca d'água não intercepta o acionamento
- **WHEN** uma pessoa aciona um item da navegação ou o cartão do usuário que
  esteja sobre a marca d'água
- **THEN** o acionamento chega ao item ou ao cartão, como se a marca d'água não
  existisse

#### Scenario: Marca d'água não é anunciada
- **WHEN** uma tecnologia assistiva percorre a navegação
- **THEN** a marca d'água não é anunciada

#### Scenario: Texto sobre a marca d'água mantém o contraste mínimo
- **WHEN** a opacidade da marca d'água é definida ou alterada
- **THEN** o contraste do texto da navegação sobre o ponto mais claro do símbolo,
  no trecho mais claro do degradê, é apurado numericamente e atende ao piso de
  4,5:1
