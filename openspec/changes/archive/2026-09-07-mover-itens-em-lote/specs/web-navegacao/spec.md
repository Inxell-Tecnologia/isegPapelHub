## ADDED Requirements

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

## MODIFIED Requirements

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
