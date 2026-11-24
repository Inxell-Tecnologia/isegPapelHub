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
listagem de origem. Como os DTOs de listagem **não informam os verbos concedidos
sobre cada item**, a SPA NÃO SHALL inferir no cliente a permissão dessas ações
por item: SHALL oferecê-las e, quando o servidor responder **403**, exibir um
aviso de **permissão insuficiente**, sem aplicar a mudança.

A proibição é de **inferir**, não de refletir: onde a resposta do servidor já
trouxer um veredito de permissão explícito, a SPA SHALL respeitá-lo em vez de
oferecer a ação — é o caso do veredito de envio da pasta corrente, que a
capability `navegacao` normatiza. O que a SPA NÃO SHALL fazer é derivar um
veredito a partir de posse, papel ou qualquer outro campo da resposta.

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

### Requirement: Pasta sem conteúdo orienta em vez de apresentar tabela vazia

A SPA SHALL apresentar, numa pasta sem itens visíveis à pessoa, uma mensagem
que explique a ausência e ofereça o próximo passo disponível, em vez da tabela
vazia herdada do design system. A ação oferecida SHALL respeitar a permissão
já resolvida pelo servidor — nenhuma ação que a pessoa não possa executar SHALL
ser apresentada.

#### Scenario: Pasta vazia apresenta mensagem e ação de envio
- **WHEN** uma pessoa com permissão de envio abre uma pasta que não contém
  nenhum item
- **THEN** a tela apresenta mensagem informando que ainda não há documentos ali
  e oferece a ação de enviar documento

#### Scenario: Sem permissão de envio, a orientação não oferece a ação
- **WHEN** uma pessoa sem permissão de envio abre uma pasta que não contém
  nenhum item
- **THEN** a tela informa que não há documentos ali, sem oferecer a ação de
  enviar

#### Scenario: Pasta com itens não apresenta a orientação de vazio
- **WHEN** uma pessoa abre uma pasta que contém ao menos um item visível
- **THEN** a listagem é apresentada normalmente, sem a mensagem de pasta vazia

### Requirement: Listagem do explorador apresenta os dados de controle

A SPA SHALL apresentar, por documento listado, a etiqueta do tipo com sua
sigla, a revisão, o setor responsável, a data de próxima revisão e a situação
apurada pelo servidor. A SPA NÃO SHALL recalcular a situação por conta própria
— SHALL apresentar a que o servidor devolveu. Dado ausente SHALL ser
apresentado como ausência explícita, nunca como valor presumido. O arquivo
pendente de cadastro SHALL ser apresentado com etiqueta própria, e o Arquivo
geral SHALL ser apresentado sem situação de revisão.

#### Scenario: Documento controlado exibe seus dados na linha
- **WHEN** uma pessoa abre uma pasta que contém um documento com dados de
  controle registrados
- **THEN** a linha apresenta sigla do tipo, revisão, responsável, data de
  próxima revisão e situação

#### Scenario: Documento sem dados não inventa valores
- **WHEN** uma pessoa abre uma pasta que contém um arquivo sem dados de controle
- **THEN** os campos correspondentes aparecem vazios e a situação apresentada é
  Sem controle de revisão

#### Scenario: A situação apresentada é a do servidor
- **WHEN** o servidor devolve a situação de um documento
- **THEN** a SPA apresenta exatamente essa situação, sem recalculá-la a partir
  da data e do relógio do dispositivo

#### Scenario: Arquivo pendente de cadastro é identificado como tal
- **WHEN** quem enviou um arquivo pendente de cadastro, ou um administrador da
  unidade, abre a pasta que o contém
- **THEN** a linha apresenta a etiqueta Pendente de cadastro, distinguível da
  situação Sem controle de revisão

#### Scenario: Arquivo geral não apresenta situação de revisão
- **WHEN** uma pessoa abre uma pasta que contém arquivo do tipo Arquivo geral
- **THEN** a linha apresenta a sigla do tipo e nenhuma situação de revisão, com
  código, revisão e data de próxima revisão como ausência explícita

#### Scenario: Situação desconhecida não quebra a listagem
- **WHEN** o servidor devolve uma situação que a SPA não reconhece
- **THEN** a linha é apresentada com tratamento neutro para aquele valor, sem
  impedir a apresentação do restante da listagem

### Requirement: Dados de controle são editáveis a partir do explorador

A SPA SHALL oferecer, no explorador, o caminho para preencher ou corrigir os
dados de controle de um documento, apresentando-o apenas a quem tem a permissão
exigida pelo servidor. A ação NÃO SHALL ser oferecida a quem o servidor
recusaria.

#### Scenario: Quem pode substituir pode editar os dados
- **WHEN** uma pessoa com permissão de substituir um documento abre suas ações
  no explorador
- **THEN** encontra a ação de editar os dados de controle

#### Scenario: Sem permissão, a ação não é oferecida
- **WHEN** uma pessoa sem permissão de substituir um documento abre suas ações
  no explorador
- **THEN** a ação de editar os dados de controle não é apresentada

### Requirement: Explorador atende ao pedido de envio recebido no endereço

O explorador SHALL atender a um pedido de envio recebido no próprio endereço da
tela, levando a pessoa à área de envio da pasta aberta. SHALL atendê-lo somente
após o servidor resolver que ela pode enviar ali, e NÃO SHALL inferir essa
permissão no cliente. O pedido SHALL valer uma única vez, e NÃO SHALL se repetir
ao recarregar a tela nem ao voltar a ela pelo histórico do navegador.

#### Scenario: Com permissão de envio, a área de envio recebe a pessoa
- **WHEN** uma pessoa com permissão de envio na pasta aberta chega ao explorador
  com um pedido de envio no endereço
- **THEN** a área de envio daquela pasta fica à sua frente e pronta para uso, sem
  que ela precise localizá-la na tela

#### Scenario: Sem permissão de envio, o pedido não desloca a pessoa
- **WHEN** uma pessoa sem permissão de envio na pasta aberta chega ao explorador
  com um pedido de envio no endereço
- **THEN** a tela apresenta o conteúdo da pasta normalmente, sem conduzi-la à área
  de envio

#### Scenario: O pedido é resolvido pelo veredito do servidor
- **WHEN** o explorador recebe um pedido de envio antes de o servidor devolver o
  conteúdo da pasta
- **THEN** o pedido só é atendido depois que o veredito de envio daquela pasta
  chega, nunca por decisão do cliente

#### Scenario: O pedido não se repete
- **WHEN** uma pessoa chega ao explorador com um pedido de envio, é levada à área
  de envio e em seguida recarrega a tela ou volta a ela pelo histórico
- **THEN** o pedido não é atendido outra vez, e a tela se comporta como uma
  chegada comum ao explorador

### Requirement: Explorador atende ao pedido de nova pasta recebido no endereço

O explorador SHALL atender a um pedido de nova pasta recebido no próprio
endereço da tela, apresentando o formulário de nova pasta. SHALL atendê-lo
**somente na raiz da unidade**, onde criar pasta é permitido a qualquer pessoa
autenticada; recebido numa subpasta, o pedido SHALL ser descartado sem
apresentar o formulário, e o cliente NÃO SHALL inferir permissão para atendê-lo
ali. O pedido SHALL ser atendido depois que o conteúdo da raiz chegar, SHALL
valer uma única vez e NÃO SHALL se repetir ao recarregar a tela ou voltar a ela
pelo histórico. Referência: PRD US 11.1, cenário 2; US 2.1; demanda do cliente
nº 2, seção 1.3 (atalho "Nova pasta").

#### Scenario: Pedido na raiz apresenta o formulário
- **WHEN** uma pessoa chega à raiz do explorador com um pedido de nova pasta no
  endereço
- **THEN** o formulário de nova pasta é apresentado, sem que ela precise
  localizar a ação na tela

#### Scenario: Pedido fora da raiz é descartado
- **WHEN** uma pessoa chega a uma subpasta do explorador com um pedido de nova
  pasta no endereço
- **THEN** a tela apresenta o conteúdo da pasta normalmente, sem o formulário

#### Scenario: O pedido de nova pasta não se repete
- **WHEN** uma pessoa chega ao explorador com um pedido de nova pasta, vê o
  formulário e em seguida recarrega a tela ou volta a ela pelo histórico
- **THEN** o formulário não é apresentado outra vez

### Requirement: Explorador oferece marcar e desmarcar favorito

O explorador SHALL oferecer, em cada pasta e arquivo listados, a ação de marcar
como favorito ou, quando o item já for favorito da pessoa, a de removê-lo dos
favoritos. A indicação de favorito SHALL vir do servidor, junto com a listagem
da pasta, e NÃO SHALL ser inferida pelo cliente. A indicação NÃO SHALL depender
apenas de cor. Referência: PRD US 2.5; capability `favoritos`.

#### Scenario: Item não favorito oferece favoritar
- **WHEN** uma pessoa abre as ações de um arquivo que não é seu favorito
- **THEN** encontra a ação de marcá-lo como favorito

#### Scenario: Item favorito oferece remover
- **WHEN** uma pessoa abre as ações de um arquivo que já é seu favorito
- **THEN** encontra a ação de removê-lo dos favoritos, e o item indica por texto
  ou nome acessível que é favorito

#### Scenario: Marcar reflete na listagem sem recarregar a tela
- **WHEN** uma pessoa marca um item como favorito no explorador
- **THEN** a indicação de favorito do item é atualizada, e o item passa a
  constar do destino de favoritos

### Requirement: Explorador oferece marcar leitura obrigatória

O explorador SHALL oferecer, na linha do arquivo, a ação **Leitura
obrigatória** somente a quem pode editar os dados de controle do documento, pelo
veredito já resolvido pelo servidor na listagem. A ação SHALL abrir o
formulário de marcação com o público, o prazo (padrão de 15 dias), a mensagem e
a prévia da contagem de pessoas, e SHALL informar quando o documento não é
elegível ou quando a revisão vigente já está marcada. Referência: PRD US 12.2;
demanda do cliente nº 2, seção 3.2 (etapa 1).

#### Scenario: Quem não edita o documento não vê a ação
- **WHEN** uma pessoa sem permissão de editar os dados de controle abre as
  ações de um arquivo
- **THEN** a ação Leitura obrigatória não é apresentada

#### Scenario: Formulário mostra a contagem antes de confirmar
- **WHEN** o publicador escolhe o público no formulário
- **THEN** vê quantas pessoas serão incluídas antes de confirmar

### Requirement: Explorador sinaliza documento de leitura obrigatória

O explorador SHALL apresentar, na linha do arquivo, um ícone de leitura
obrigatória quando a **revisão vigente** do documento estiver marcada como
leitura obrigatória, pelo veredito apurado pelo servidor na própria listagem. O
ícone SHALL ter nome acessível e dica que digam "Leitura obrigatória". Revisão
vigente sem marcação, documento cuja marcação é de revisão anterior e resposta
sem o veredito NÃO SHALL apresentar o ícone. Referência: PRD US 12.4; demanda
do cliente nº 2, seção 3.5 (Documentos).

#### Scenario: Documento marcado mostra o ícone
- **WHEN** uma pessoa abre a pasta de um documento cuja revisão vigente é de
  leitura obrigatória
- **THEN** a linha do documento apresenta o ícone de leitura obrigatória, com o
  nome acessível correspondente

#### Scenario: Nova revisão sem marcação não mostra o ícone
- **WHEN** um documento marcado é substituído e a revisão nova não é marcada
- **THEN** a linha do documento deixa de apresentar o ícone

#### Scenario: Sem veredito, sem ícone
- **WHEN** a listagem não informa se o documento é de leitura obrigatória
- **THEN** a linha não apresenta o ícone, e a listagem continua sendo exibida

### Requirement: Navegação somente leitura em pasta compartilhada por outra unidade

O explorador SHALL exibir a pasta identificada com a unidade de origem
("Compartilhada pela unidade {nome}") quando a resposta de conteúdo de
pasta indicar `readOnly` e `sharedFrom`. A trilha SHALL começar na raiz
compartilhada (precedida de "Compartilhados comigo", nunca de
"Documentos"), e a SPA SHALL oferecer somente visualizar e, quando o
servidor indicar `canDownload`, baixar. Não SHALL oferecer enviar, nova pasta, renomear, mover,
excluir, permissões nem favorito. O orientador de pasta vazia SHALL
informar que não há documentos compartilhados, sem sugerir envio. A SPA NÃO
SHALL inferir esses vereditos no cliente: eles vêm da resposta do servidor.
Referência: PRD US 5.2, cenários 1 e 2; design.md D6.

#### Scenario: Raíra abre a Governança
- **WHEN** a Raíra aciona a pasta Governança em "Compartilhados comigo"
- **THEN** o explorador mostra o conteúdo da pasta, a identificação
  "Compartilhada pela unidade SEDE" e a trilha começando em "Governança",
  sem ações de escrita

#### Scenario: Subpasta navegável
- **WHEN** a Raíra abre uma subpasta da Governança
- **THEN** a trilha mostra "Governança › {subpasta}", e nenhuma pasta acima
  da Governança é nomeada
