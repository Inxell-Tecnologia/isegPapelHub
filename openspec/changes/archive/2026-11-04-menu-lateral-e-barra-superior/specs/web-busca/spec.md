# Spec Delta

## MODIFIED Requirements

### Requirement: Campo de busca permanentemente acessível no cabeçalho

A SPA SHALL apresentar um campo de busca na barra superior de toda tela
autenticada, alcançável sem navegar até uma tela de busca, posicionado à
**esquerda** da barra, antes das demais ações. O acionador da busca SHALL ser
apresentado **dentro** do campo, e NÃO SHALL ser um botão adjacente ao campo. O
campo NÃO SHALL disparar consulta a cada tecla digitada: o acionamento SHALL
permanecer explícito, conforme o requisito "Busca acionada explicitamente pelo
usuário", que este NÃO afrouxa. Acionado, SHALL conduzir à tela de resultados
com o termo informado já aplicado.

O texto de apoio do campo SHALL nomear os critérios aceitos — nome, código do
documento e palavra-chave —, exemplificando a forma do código, para que a pessoa
saiba que pode buscar pelo código sem descobri-lo por tentativa.

A largura do campo SHALL ser declarada como **teto**, nunca como medida fixa: o
campo SHALL ocupar o espaço disponível da barra até esse teto e SHALL cedê-lo
quando a barra não o acomodar, de modo que nenhuma largura de tela produza
rolagem horizontal do documento (capability `web-responsividade`).

Referência: demanda do cliente nº 2, seção 1.2; design.md D3 do change
`menu-lateral-e-barra-superior`.

#### Scenario: Busca alcançável de qualquer tela
- **WHEN** uma pessoa autenticada está em qualquer tela da aplicação
- **THEN** encontra o campo de busca na barra superior, sem precisar navegar antes

#### Scenario: Digitar não dispara consulta
- **WHEN** uma pessoa digita um termo no campo do cabeçalho sem acioná-lo
- **THEN** nenhuma consulta é enviada ao servidor

#### Scenario: Acionar conduz aos resultados com o termo aplicado
- **WHEN** uma pessoa aciona a busca a partir do campo do cabeçalho
- **THEN** alcança a tela de resultados com o termo já aplicado, sem precisar
  redigitá-lo

#### Scenario: O acionador fica dentro do campo
- **WHEN** uma pessoa autenticada observa o campo de busca da barra superior
- **THEN** o acionador da busca está contido no próprio campo, sem botão
  adjacente ocupando largura da barra

#### Scenario: O texto de apoio nomeia os critérios aceitos
- **WHEN** uma pessoa autenticada observa o campo de busca vazio
- **THEN** o texto de apoio informa que pode buscar por nome, por código do
  documento — com um exemplo da forma do código — ou por palavra-chave

#### Scenario: O campo cede largura em vez de romper a barra
- **WHEN** a mesma tela autenticada é apresentada numa largura em que a barra
  superior não acomoda o teto do campo junto das demais ações
- **THEN** o campo é apresentado mais estreito que o teto, permanecendo
  utilizável, e o documento não ganha rolagem horizontal

#### Scenario: O campo não excede o teto em tela larga
- **WHEN** a tela é larga o suficiente para acomodar o teto do campo e todas as
  ações da barra
- **THEN** o campo é apresentado no seu teto de largura, sem esticar-se pelo
  restante da barra
