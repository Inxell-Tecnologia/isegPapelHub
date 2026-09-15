# web-navegacao Specification

## Purpose

Define os requisitos verificáveis da navegação de pastas e arquivos na SPA do
GDoc — o explorador em `/pastas` e `/pastas/:folderId` com trilha de navegação
(`Breadcrumb`), as ações de gestão por item (criar subpasta, excluir pasta,
renomear/excluir arquivo) condicionadas à resposta do servidor, a seleção
múltipla e o mover em lote, e o bloqueio de acesso direto a pastas sem
permissão. Implementa o Épico 2 (US 2.1, 2.2, 2.3 e 2.4) e a US 4.2 do PRD
(`docs/prd_final.md`) do lado do cliente, consumindo os endpoints
`GET /folders/root/contents`, `GET /folders/:id/contents` e as mutações de
pastas/arquivos já cobertas pelos specs de backend, sem re-descrever seus
cenários.

## Requirements

### Requirement: Explorador de pastas com trilha de navegação

A SPA SHALL apresentar um **explorador** de pastas e arquivos em `/pastas` (raiz
da unidade, via `GET /folders/root/contents`) e `/pastas/:folderId` (conteúdo de
uma pasta, via `GET /folders/:id/contents`), dentro do shell autenticado. O
explorador SHALL exibir subpastas e arquivos em uma listagem única (pastas
antes de arquivos) e uma **trilha de navegação** (`Breadcrumb`) construída a
partir de `FolderContentsResponse.breadcrumb`, mais o nó raiz "Arquivos" e a
pasta corrente. Clicar em qualquer nível anterior da trilha SHALL navegar
diretamente para aquele nível. A listagem SHALL exibir **apenas** os itens
retornados pela API — que já são somente os próprios ou liberados por concessão
`view` — de modo que itens sem permissão não apareçam.

Referência: PRD US 2.1 (cenários 1 e 2); design.md D1/D2/D3.

#### Scenario: Navegação em subpasta atualiza conteúdo e trilha
- **WHEN** o usuário entra em uma subpasta à qual tem acesso a partir do
  explorador
- **THEN** a SPA carrega o conteúdo permitido daquela pasta e atualiza a trilha
  de navegação, permitindo retornar a qualquer nível anterior com um clique

#### Scenario: Item sem permissão não é listado
- **WHEN** o usuário abre uma pasta que contém itens para os quais não tem
  permissão
- **THEN** a SPA exibe apenas os itens que o usuário criou ou que lhe foram
  liberados (o conteúdo retornado pela API), sem mostrar os demais

### Requirement: Gestão de arquivos e pastas por item conforme permissão

O explorador SHALL oferecer, por item, as ações de gestão suportadas pelo
backend: **criar subpasta** (`POST /folders`), **excluir pasta**
(`DELETE /folders/:id`), **renomear arquivo** (`PATCH /files/:id`), **renomear
pasta** (`PATCH /folders/:id`), **excluir arquivo** (`DELETE /files/:id`) e
**mover** arquivo ou pasta (`POST /files/:id/move`, `POST /folders/:id/move`). A
exclusão SHALL ser confirmada pelo usuário antes de ser enviada. Ao concluir com
sucesso, a SPA SHALL refletir o novo estado recarregando a listagem da pasta
corrente; ao mover com sucesso, o item movido SHALL deixar de aparecer na
listagem de origem. Como os DTOs de listagem não informam os verbos concedidos, a
SPA NÃO SHALL inferir permissão no cliente: SHALL oferecer a ação e, quando o
servidor responder **403**, exibir um aviso de **permissão insuficiente**, sem
aplicar a mudança.

A recusa de mover por **ciclo** e a recusa por **nome já existente no destino**
SHALL produzir avisos **distinguíveis entre si e distinguíveis do aviso de
permissão insuficiente**, de modo que o usuário saiba o que corrigir. Nenhuma das
três SHALL ser antecipada no cliente.

Abaixo do ponto de ruptura definido pela capability `web-responsividade`, as
ações do item SHALL permanecer **todas alcançáveis**, podendo ser agrupadas num
menu de ações quando não couberem lado a lado — o que inclui as ações de mover e
de renomear pasta. A ação de **visualizar** SHALL permanecer diretamente
acionável, sem exigir a abertura do agrupamento, por ser o verbo central da
consulta. O agrupamento SHALL decorrer **exclusivamente** do espaço disponível, e
NÃO SHALL ser usado para omitir ação alguma nem para antecipar no cliente a
decisão de permissão do servidor.

Referência: PRD US 2.2 (cenários 1 e 2) e US 2.3 (cenários 1 a 5); design.md
D4/D5/D7 do change `web-navegacao`; design.md D4 do change
`responsividade-mobile-tablet`; design.md D7 do change `mover-e-renomear-itens`.

#### Scenario: Renomear arquivo com permissão
- **WHEN** o usuário renomeia um arquivo sobre o qual tem permissão
- **THEN** a SPA envia `PATCH /files/:id`, e ao sucesso a listagem da pasta
  reflete o novo nome

#### Scenario: Renomear pasta com permissão
- **WHEN** o usuário renomeia uma pasta sobre a qual tem alcance
- **THEN** a SPA envia `PATCH /folders/:id`, e ao sucesso a listagem da pasta
  reflete o novo nome

#### Scenario: Mover item para outra pasta
- **WHEN** o usuário escolhe uma pasta de destino para um arquivo ou pasta e
  confirma
- **THEN** a SPA envia a rota de mover correspondente e, ao sucesso, o item deixa
  de aparecer na listagem de origem

#### Scenario: Criar subpasta na pasta corrente
- **WHEN** o usuário cria uma subpasta informando um nome na pasta corrente
- **THEN** a SPA envia `POST /folders` com o `parentId` da pasta corrente, e ao
  sucesso a nova pasta aparece na listagem

#### Scenario: Excluir arquivo ou pasta com confirmação
- **WHEN** o usuário confirma a exclusão de um arquivo ou de uma pasta sobre os
  quais tem permissão
- **THEN** a SPA envia a exclusão correspondente e, ao sucesso, o item deixa de
  aparecer na listagem da pasta

#### Scenario: Ação sem permissão é bloqueada com aviso
- **WHEN** o usuário tenta renomear, mover ou excluir um item para o qual não tem
  permissão e o servidor responde 403
- **THEN** a ação não é aplicada e a SPA exibe um aviso de permissão insuficiente

#### Scenario: Recusa por ciclo é distinguível
- **WHEN** o usuário tenta mover uma pasta para dentro dela mesma ou de uma
  descendente e o servidor recusa
- **THEN** a SPA exibe um aviso que identifica o destino inválido, distinto do
  aviso de permissão insuficiente

#### Scenario: Recusa por nome já existente é distinguível
- **WHEN** o usuário move ou renomeia uma pasta para um nome já ocupado no destino
  e o servidor recusa
- **THEN** a SPA exibe um aviso que identifica o conflito de nome, distinto do
  aviso de ciclo e do de permissão insuficiente

#### Scenario: Em tela estreita as ações do item continuam todas alcançáveis
- **WHEN** o usuário abre o explorador numa tela mais estreita que o ponto de
  ruptura
- **THEN** todas as ações do item permanecem alcançáveis, incluindo mover e
  renomear pasta, agrupadas num menu de ações quando não couberem lado a lado,
  sem que nenhuma deixe de ser oferecida

#### Scenario: Visualizar permanece direta em tela estreita
- **WHEN** o usuário percorre a listagem numa tela estreita
- **THEN** a ação de visualizar é acionável diretamente na linha do item, sem
  exigir a abertura do menu de ações

#### Scenario: Agrupamento não antecipa a decisão de permissão
- **WHEN** o usuário aciona, pelo menu de ações em tela estreita, uma ação para a
  qual não tem permissão
- **THEN** a ação é enviada ao servidor e o aviso de permissão insuficiente vem
  do 403, do mesmo modo que na tela larga

### Requirement: Seleção múltipla de itens no explorador

A SPA SHALL permitir selecionar **vários arquivos e pastas** no explorador,
marcando-os individualmente na listagem, e SHALL indicar de forma visível
quantos itens estão selecionados. A seleção SHALL admitir arquivos e pastas
misturados no mesmo conjunto.

A seleção SHALL ser **escopada à pasta corrente** e SHALL ser esvaziada sempre
que o usuário mudar de pasta — ao entrar numa subpasta, ao voltar pela trilha de
navegação ou ao chegar por qualquer outra rota. A SPA NÃO SHALL acumular numa
mesma seleção itens de pastas diferentes, nem exibir contagem de itens
selecionados fora da pasta corrente.

A seleção múltipla SHALL permanecer disponível abaixo do ponto de ruptura
definido pela capability `web-responsividade`: mover não desloca bytes nem monta
arquivo no navegador, e portanto não SHALL herdar a recusa em tela estreita
aplicada ao download de pasta. Referência: PRD US 2.4; design.md D3/D8 do change
`mover-itens-em-lote`.

#### Scenario: Selecionar arquivos e pastas juntos
- **WHEN** o usuário marca arquivos e pastas na listagem da pasta corrente
- **THEN** todos ficam selecionados no mesmo conjunto e a SPA indica a quantidade
  selecionada

#### Scenario: Seleção é esvaziada ao navegar
- **WHEN** o usuário seleciona itens e em seguida entra numa subpasta ou volta
  pela trilha
- **THEN** a seleção fica vazia na nova pasta e nenhuma contagem de itens
  selecionados permanece visível

#### Scenario: Seleção disponível em tela estreita
- **WHEN** o usuário abre o explorador numa tela mais estreita que o ponto de
  ruptura
- **THEN** a marcação de itens e a contagem de selecionados permanecem
  alcançáveis

### Requirement: Mover itens selecionados em lote

A SPA SHALL oferecer a ação **mover** sobre a seleção corrente, disponível a
partir de um item selecionado, abrindo o mesmo seletor de pasta de destino usado
na movimentação por item e exigindo confirmação explícita antes de enviar.

A SPA SHALL enviar a operação de arquivos e a de pastas como requisições
distintas quando a seleção contiver os dois tipos, e SHALL apresentar o
resultado das duas como **um único aviso consolidado**, sem expor ao usuário que
houve mais de uma requisição.

Ao receber resultado com falha parcial, a SPA SHALL informar quantos itens foram
movidos e SHALL listar **nominalmente** cada item recusado com o motivo
correspondente, distinguindo pelo menos permissão insuficiente, destino dentro
da própria pasta (ciclo) e nome já existente no destino. A SPA NÃO SHALL relatar
um lote parcialmente bem-sucedido como falha total nem como sucesso total.

A SPA SHALL recusar o envio e avisar quando a seleção exceder o teto de itens
por operação, distinguindo esse aviso de uma recusa por permissão. Após uma
operação de lote, a SPA SHALL recarregar a listagem e esvaziar a seleção.

A SPA NÃO SHALL antecipar no cliente a validade do destino em relação aos itens
selecionados: escolher como destino uma pasta selecionada, ou uma subpasta dela,
SHALL ser permitido na interface e resolvido pela recusa do servidor sobre
aquele item. Referência: PRD US 2.4; design.md D4/D7 do change
`mover-itens-em-lote`.

#### Scenario: Mover uma seleção mista com sucesso
- **WHEN** o usuário seleciona arquivos e pastas, escolhe um destino e confirma
- **THEN** todos os itens passam a residir no destino, a SPA exibe um único aviso
  de sucesso, a listagem é recarregada e a seleção fica vazia

#### Scenario: Falha parcial é relatada item a item
- **WHEN** parte dos itens do lote é recusada pelo servidor e o restante é movido
- **THEN** a SPA informa quantos foram movidos e lista o nome de cada item
  recusado com o motivo correspondente

#### Scenario: Lote inteiro recusado por destino sem permissão
- **WHEN** o servidor recusa a operação por falta de alcance sobre o destino
- **THEN** a SPA exibe o aviso de permissão insuficiente e a listagem permanece
  como estava

#### Scenario: Teto de itens excedido é avisado antes do envio
- **WHEN** o usuário seleciona mais itens que o teto permitido por operação e
  aciona mover
- **THEN** a SPA avisa que o teto foi excedido, com mensagem distinta da recusa
  por permissão, e nada é enviado

#### Scenario: Destino dentro da seleção não é bloqueado na interface
- **WHEN** o usuário seleciona uma pasta e escolhe como destino essa mesma pasta
  ou uma subpasta dela
- **THEN** a interface permite confirmar, e o aviso de ciclo vem da recusa do
  servidor sobre aquele item, enquanto os demais itens são movidos

### Requirement: Seletor de pasta de destino

A SPA SHALL apresentar, ao mover **um item ou um conjunto de itens**, um
**seletor de pasta de destino** que permite navegar a árvore da unidade nível a
nível a partir da raiz, consumindo o endpoint de conteúdo de pasta **já
existente** (`GET /folders/root/contents` e `GET /folders/:id/contents`), sem
exigir endpoint de leitura adicional. O seletor SHALL exibir apenas as pastas
devolvidas pela API — que já são somente as próprias ou liberadas — e SHALL
permitir escolher a **raiz da unidade** como destino.

O seletor SHALL indicar em que nível o usuário está durante a navegação e SHALL
exigir confirmação explícita antes de enviar a operação. Quando operar sobre um
conjunto, SHALL deixar visível quantos itens serão movidos. Ele NÃO SHALL
antecipar no cliente a decisão de permissão sobre o destino: uma pasta listada
que o servidor venha a recusar SHALL produzir o aviso vindo do 403, como
qualquer outra ação. O seletor SHALL ser utilizável abaixo do ponto de ruptura
definido pela capability `web-responsividade`. Referência: PRD US 2.3, cenário 1,
e PRD US 2.4; design.md D7 do change `mover-e-renomear-itens`; design.md D7 do
change `mover-itens-em-lote`.

#### Scenario: Navegar a árvore até a pasta de destino
- **WHEN** o usuário abre o seletor de destino e entra em uma pasta
- **THEN** o seletor exibe as subpastas daquele nível e indica onde o usuário está

#### Scenario: Escolher a raiz da unidade como destino
- **WHEN** o usuário escolhe a raiz como destino e confirma
- **THEN** a SPA envia a operação de mover com destino nulo

#### Scenario: Seletor indica o tamanho do conjunto
- **WHEN** o usuário abre o seletor de destino com vários itens selecionados
- **THEN** o seletor deixa visível quantos itens serão movidos antes da
  confirmação

#### Scenario: Seletor não antecipa permissão do destino
- **WHEN** o usuário confirma um destino que o servidor recusa com 403
- **THEN** a SPA exibe o aviso de permissão insuficiente, sem ter ocultado a pasta
  previamente

#### Scenario: Seletor utilizável em tela estreita
- **WHEN** o usuário abre o seletor de destino numa tela mais estreita que o ponto
  de ruptura
- **THEN** a navegação por níveis e a confirmação permanecem alcançáveis

### Requirement: Acesso direto a pasta sem permissão é bloqueado

Ao abrir diretamente a rota `/pastas/:folderId`, a SPA SHALL exibir um bloqueio
de acesso (por exemplo, `Result status="403"`) **sem** renderizar qualquer
conteúdo da pasta sempre que o usuário não tiver permissão — pasta inexistente,
de outra unidade ou sem concessão `view` —, caso em que o backend SHALL responder
**403**. Uma resposta **401** SHALL continuar sendo tratada centralmente,
encerrando a sessão e redirecionando a `/login`.

Referência: PRD US 4.2 (cenário 1); design.md D6.

#### Scenario: Deep-link a pasta sem permissão não exibe conteúdo
- **WHEN** o usuário abre a rota de uma pasta para a qual não tem permissão e a
  API responde 403
- **THEN** a SPA exibe um bloqueio de acesso e nenhum conteúdo ou nome de item
  da pasta é mostrado
