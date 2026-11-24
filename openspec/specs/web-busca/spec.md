# web-busca Specification

## Purpose

Define os requisitos verificáveis da página de busca da SPA do GDoc (rota
`/busca`): uma barra de filtros combináveis (nome, tipo, data e, para
administradores, autor) que chama `GET /files/search` com apenas os critérios
ativos e lista exclusivamente os arquivos retornados pelo servidor — já
filtrados por critério e por permissão. Implementa o lado de frontend da
**US 9.1** (cenários 1 e 2) e da **US 9.2** do PRD (`docs/prd_final.md`),
reusando os componentes de visualização e download já especificados em
`web-visualizacao` para as ações sobre os resultados.

## Requirements

### Requirement: Busca por nome com filtros combináveis

A SPA SHALL oferecer uma **página de busca** (rota `/busca`, sob autenticação,
para qualquer papel) com uma barra de filtros contendo **nome** (`q`), **tipo**
de arquivo e **intervalo de data**. Ao aplicar os critérios, a SPA SHALL chamar
`GET /files/search` **incluindo na query string apenas os critérios ativos** e
SHALL listar **exclusivamente os itens retornados pelo servidor** — que já são
os que atendem a todos os critérios **e** para os quais o requisitante tem
permissão. A SPA NÃO SHALL inferir permissão nem filtrar resultados no cliente.
O filtro de **tipo** SHALL usar as categorias do enum `FileCategory` de
`@gdoc/shared` (imagem, vídeo, áudio, PDF, documento de escritório, texto,
outros) com rótulos em pt-BR. O **intervalo de data** SHALL ser convertido para
`dateFrom`/`dateTo` no formato `YYYY-MM-DD`, com `dateTo` inclusivo no dia
informado (tratamento já feito pelo servidor).

Referência: PRD US 9.1 (cenário 1), RF #15; design.md D1/D3/D4.

#### Scenario: Busca com filtros combinados lista só o permitido
- **WHEN** o usuário informa um nome e aplica filtros de tipo e data
- **THEN** a SPA chama `GET /files/search` com apenas os critérios ativos e
  exibe somente os itens retornados pelo servidor, que atendem a todos os
  critérios e são permitidos ao usuário

#### Scenario: Filtro de tipo mapeia a categoria correta
- **WHEN** o usuário seleciona uma categoria de tipo (ex.: PDF)
- **THEN** a SPA envia o valor `type` correspondente do enum `FileCategory` e a
  lista passa a conter apenas arquivos daquela categoria

#### Scenario: Sem resultados exibe estado vazio
- **WHEN** a busca com os critérios informados não retorna item algum
- **THEN** a SPA exibe uma indicação clara de "nenhum resultado", sem erro

### Requirement: Busca acionada explicitamente pelo usuário

A SPA SHALL consultar `GET /files/search` **somente** quando o usuário acionar
explicitamente a busca — pelo botão **"Buscar"** da barra de filtros ou por
**Enter** no campo de nome — e NÃO SHALL consultar ao carregar a página nem ao
alterar qualquer controle de filtro. Ao abrir `/busca`, **nenhuma** requisição a
`GET /files/search` SHALL ser feita.

O botão "Buscar" SHALL ficar **desabilitado** enquanto **nenhum critério estiver
ativo**, e o Enter no campo de nome NÃO SHALL acionar a busca nessa condição — de
modo que a página de busca NÃO SHALL oferecer caminho para listar todo o acervo
sem critério algum. Um critério é considerado **ativo** quando o **nome** contém
algo além de espaços, ou quando **tipo**, **intervalo de data** ou **autor**
estiverem preenchidos. Um nome de **um único caractere** SHALL contar como
critério ativo — NÃO SHALL existir mínimo de caracteres.

Após uma busca, alterar os controles de filtro sem acionar a busca novamente
SHALL manter exibidos os resultados da última busca realizada, que só SHALL ser
substituídos por um novo acionamento.

Referência: PRD US 9.1 (cenário 1), RF #15; design.md D1/D2/D4/D6.

#### Scenario: Abrir a página não consulta o servidor
- **WHEN** o usuário abre a rota `/busca`
- **THEN** a SPA não chama `GET /files/search` e nenhum resultado é exibido

#### Scenario: Botão desabilitado sem nenhum critério
- **WHEN** nenhum dos filtros (nome, tipo, data, autor) está preenchido
- **THEN** o botão "Buscar" está desabilitado e pressionar Enter no campo de nome
  não dispara consulta alguma

#### Scenario: Acionar a busca consulta com os critérios ativos
- **WHEN** o usuário preenche ao menos um critério e aciona o botão "Buscar"
- **THEN** a SPA chama `GET /files/search` incluindo apenas os critérios ativos e
  exibe os itens retornados pelo servidor

#### Scenario: Enter no campo de nome aciona a mesma busca
- **WHEN** o usuário digita um nome e pressiona Enter no campo de nome
- **THEN** a SPA realiza a mesma consulta que o botão "Buscar" realizaria

#### Scenario: Um caractere no nome já habilita a busca
- **WHEN** o usuário digita um único caractere no campo de nome
- **THEN** o botão "Buscar" fica habilitado e o acionamento consulta o servidor
  com esse nome

#### Scenario: Alterar filtros após buscar mantém a lista anterior
- **WHEN** o usuário realizou uma busca e em seguida altera um filtro sem acionar
  a busca novamente
- **THEN** a lista continua exibindo os resultados da última busca realizada, e
  nenhuma nova consulta é feita até o próximo acionamento

### Requirement: Estado inicial distinto do estado sem resultados

A SPA SHALL exibir, enquanto nenhuma busca tiver sido realizada, um **estado
inicial** que instrui o usuário a informar ao menos um critério para buscar, e
SHALL mantê-lo **visualmente distinto** da indicação de **"nenhum resultado"**
usada quando uma busca foi realizada e não retornou item algum. A SPA NÃO SHALL
reusar a mensagem de "nenhum resultado" para o estado inicial — o usuário NÃO
SHALL ser levado a concluir que não existem arquivos visíveis a ele apenas por
ainda não ter buscado.

Os estados de **carregando** e de **erro** já existentes SHALL permanecer
inalterados.

Referência: PRD US 9.1, RF #15; design.md D5.

#### Scenario: Estado inicial instrui a informar um critério
- **WHEN** o usuário abre `/busca` e ainda não realizou nenhuma busca
- **THEN** a SPA exibe uma indicação de que é preciso informar ao menos um
  critério para buscar, e não a mensagem de "nenhum resultado"

#### Scenario: Busca sem retorno exibe "nenhum resultado"
- **WHEN** o usuário aciona uma busca com critérios que não correspondem a item
  algum
- **THEN** a SPA exibe a indicação de "nenhum resultado", distinta do estado
  inicial, sem erro

### Requirement: Botão de limpar filtros retorna ao estado inicial permitido

A barra de filtros SHALL oferecer um botão de **limpar filtros** que remove
**todos** os critérios ativos (nome, tipo, data e autor, quando presente) **e**
descarta os resultados exibidos, retornando a página ao **estado inicial** — o
mesmo estado de quem acabou de abrir `/busca`, com a instrução de informar um
critério. Ao limpar, a SPA **NÃO** SHALL refazer a busca: nenhuma requisição a
`GET /files/search` SHALL ser disparada, e o botão "Buscar" SHALL voltar a ficar
desabilitado até que um novo critério seja informado.

Esta é a leitura de **"estado inicial permitido"** adotada pelo produto para a
US 9.1 cenário 2: a tela volta a **não exibir dado algum** até uma nova busca,
em vez de listar todo o acervo visível ao usuário (design.md D3).

Referência: PRD US 9.1 (cenário 2), RF #15; design.md D1/D3/D5.

#### Scenario: Limpar filtros remove todos os critérios e volta ao estado inicial
- **WHEN** o usuário aplicou um ou mais filtros, realizou a busca e aciona o
  botão de limpar filtros
- **THEN** todos os filtros são removidos dos controles, os resultados deixam de
  ser exibidos e a página volta ao estado inicial

#### Scenario: Limpar filtros não consulta o servidor
- **WHEN** o usuário aciona o botão de limpar filtros
- **THEN** a SPA não chama `GET /files/search`, e o botão "Buscar" fica
  desabilitado até que um novo critério seja informado

### Requirement: Filtro de autor restrito a administrador

A SPA SHALL renderizar o filtro de **autor** **somente** para usuários com papel
`unit_admin` ou `global_admin` — porque esse filtro depende da lista de pessoas
de `GET /users`, **exclusiva de administrador** (retorna 403 para colaborador) —,
populando-o com as pessoas retornadas por `GET /users` e enviando o identificador
da pessoa selecionada como `author` na busca. Para o colaborador, a SPA SHALL
**omitir** o filtro de autor, oferecendo nome, tipo e data — sem quebra nem
chamada a `GET /users`. O filtro de autor para colaborador fica como lacuna
conhecida (depende de um endpoint de pessoas seguro-para-colaborador que ainda
não existe).

Referência: PRD US 9.1, RF #15; design.md D2.

#### Scenario: Administrador vê e usa o filtro de autor
- **WHEN** um usuário `unit_admin` ou `global_admin` abre a página de busca
- **THEN** a SPA exibe o filtro de autor populado com as pessoas de
  `GET /users`, e selecionar uma pessoa envia seu identificador como `author`

#### Scenario: Colaborador não vê o filtro de autor
- **WHEN** um usuário `collaborator` abre a página de busca
- **THEN** a SPA não exibe o filtro de autor e não chama `GET /users`,
  mantendo disponíveis os filtros de nome, tipo e data

### Requirement: Visualização e download a partir dos resultados

A tabela de resultados SHALL ser **só de arquivos** (a busca não retorna
pastas) e SHALL reusar os componentes de `web-visualizacao`: o nome do arquivo
e a ação **"Visualizar"** SHALL abrir o `PreviewModal` (que chama `view-url` e
ramifica pela resposta), e a ação **"Baixar"** SHALL usar a URL assinada
`attachment` (o fluxo de `useDownloadFile`). Um 403 nessas ações SHALL exibir
aviso de permissão insuficiente, sem expor conteúdo — herdando o comportamento
já especificado em `web-visualizacao`.

Referência: PRD US 9.1, US 9.2, RF #16; design.md D5.

#### Scenario: Visualizar um resultado abre o preview
- **WHEN** o usuário clica no nome ou em "Visualizar" de um arquivo da lista de
  resultados
- **THEN** a SPA abre o `PreviewModal` para aquele arquivo, reusando o fluxo de
  visualização já existente

#### Scenario: Baixar um resultado usa a URL assinada
- **WHEN** o usuário aciona "Baixar" de um arquivo da lista de resultados
- **THEN** a SPA obtém a URL assinada de download e transfere os bytes direto do
  GCS, sem trafegar o conteúdo pela aplicação

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

### Requirement: Busca recebe quem chega sem termo com o campo pronto

A tela de busca SHALL receber quem chega a ela **sem** termo no endereço com o
campo de termo focado, pronto para digitar. Quando o endereço já traz um termo,
a tela NÃO SHALL mover o foco para o campo, para não atrapalhar quem vai ler
os resultados. Referência: PRD US 11.1, cenário 2; demanda do cliente nº 2,
seção 1.3 (atalho "Buscar documento").

#### Scenario: Chegada sem termo foca o campo
- **WHEN** uma pessoa abre a tela de busca sem termo no endereço
- **THEN** o campo de termo está focado e aceita digitação de imediato

#### Scenario: Chegada com termo não rouba o foco
- **WHEN** uma pessoa chega à tela de busca com um termo no endereço
- **THEN** a busca é executada com esse termo e o foco não é levado ao campo

### Requirement: Campo de busca do cabeçalho tem a altura da ação de envio

O campo de busca da barra superior SHALL ter a **mesma altura** da ação de envio de documento apresentada na mesma barra, em qualquer largura de tela. O acionador apresentado dentro do campo NÃO SHALL, por isso, ter área de acionamento abaixo do piso de 44 pixels de altura da aplicação. Referência: `docs/demanda_cliente_3.md`, item 9.

#### Scenario: Campo e ação de envio alinhados na barra
- **WHEN** uma pessoa autenticada visualiza a barra superior numa tela larga
- **THEN** o campo de busca e a ação de envio têm a mesma altura, medida na
  tela

#### Scenario: Altura igual também na tela estreita
- **WHEN** uma pessoa autenticada visualiza a barra superior numa tela mais
  estreita que o ponto de ruptura, com a ação de envio apresentada só pelo ícone
- **THEN** o campo de busca e a ação de envio continuam com a mesma altura

#### Scenario: Acionador interno preserva a área mínima de acionamento
- **WHEN** uma pessoa aciona o acionador de busca dentro do campo, em
  dispositivo de toque
- **THEN** a área sensível do acionador tem ao menos 44 pixels de altura
