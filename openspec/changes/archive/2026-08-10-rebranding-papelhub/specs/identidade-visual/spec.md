# Spec — identidade-visual (delta)

Segunda mudança sobre esta capability (a primeira foi `GDoc` → `Doc7`, ver
`openspec/changes/archive/2026-08-05-rebranding-doc7-setes/`). O nome exibido
passa de `Doc7` para `PapelHub` — mesmo mecanismo, novo literal. A capability
ganha escopo novo: a logomarca oficial do produto, sempre contida numa
moldura escura própria (design.md D1), presente na tela de login e no shell
expandido, ausente no shell colapsado, e refletida no favicon. Ver design.md
D1–D8.

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
- **THEN** a marca apresenta o nome **PapelHub** no estado expandido e uma forma
  abreviada equivalente no estado colapsado

## ADDED Requirements

### Requirement: Logomarca oficial é exibida na tela de login e no shell expandido

A aplicação SHALL exibir a logomarca oficial do produto na tela de login e no
shell autenticado com a navegação expandida. A logomarca SHALL ser
apresentada sempre contida numa moldura escura própria, e NÃO SHALL ser
exibida diretamente sobre um fundo claro sem essa moldura.

#### Scenario: Logomarca aparece na tela de login
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a logomarca oficial é exibida, contida numa moldura escura, junto
  ao cabeçalho com o nome da aplicação

#### Scenario: Logomarca aparece no shell expandido
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** a logomarca oficial é exibida, contida numa moldura escura, no
  lugar da marca

### Requirement: Logomarca não é exibida no estado colapsado do shell

O shell autenticado, com a navegação colapsada, SHALL continuar apresentando
apenas a forma abreviada em texto da marca — a logomarca NÃO SHALL ser
exibida nesse estado.

#### Scenario: Navegação colapsada mantém a abreviação em texto
- **WHEN** uma pessoa autenticada colapsa a navegação do shell
- **THEN** apenas a forma abreviada em texto da marca é exibida, sem a
  logomarca

### Requirement: Logomarca no shell expandido preserva o nome acessível da marca

A aplicação SHALL fornecer à logomarca do shell expandido um nome acessível
equivalente ao nome da aplicação, já que ali a imagem substitui o texto do
nome e é a única portadora dele nesse estado — a marca SHALL continuar
perceptível por tecnologia assistiva.

#### Scenario: Tecnologia assistiva consulta a marca do shell expandido
- **WHEN** uma tecnologia assistiva consulta a marca do shell com a
  navegação expandida
- **THEN** o nome acessível da marca é o nome da aplicação

### Requirement: Favicon reflete a logomarca oficial

O favicon da aplicação SHALL ser derivado da logomarca oficial do produto,
mantendo proporção quadrada sem distorcer a arte original — por recorte, não
por estiramento da imagem original.

#### Scenario: Aba do navegador exibe o favicon derivado da logomarca
- **WHEN** uma pessoa abre a aplicação no navegador
- **THEN** o ícone exibido na aba é derivado da logomarca oficial, sem
  aparecer esticado ou distorcido
