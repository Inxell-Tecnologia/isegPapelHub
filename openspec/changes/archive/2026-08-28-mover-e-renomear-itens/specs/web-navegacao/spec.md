# Spec — web-navegacao (delta)

Capability existente. O explorador oferecia criar subpasta, excluir pasta,
renomear arquivo e excluir arquivo, e registrava explicitamente que **renomear
pasta ficava de fora enquanto o backend não expusesse o endpoint** — condição
agora satisfeita. Esta mudança implementa a **US 2.3** do PRD
(`docs/prd_final.md`) do lado do cliente: a ação de mover, o seletor de pasta de
destino e a extensão do renomear à pasta. As regras de servidor são normatizadas
por `navegacao` e `gestao-arquivos`, e não são re-descritas aqui. Ver design.md
D7.

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Seletor de pasta de destino

A SPA SHALL apresentar, ao mover um item, um **seletor de pasta de destino** que
permite navegar a árvore da unidade nível a nível a partir da raiz, consumindo o
endpoint de conteúdo de pasta **já existente** (`GET /folders/root/contents` e
`GET /folders/:id/contents`), sem exigir endpoint de leitura adicional. O seletor
SHALL exibir apenas as pastas devolvidas pela API — que já são somente as próprias
ou liberadas — e SHALL permitir escolher a **raiz da unidade** como destino.

O seletor SHALL indicar em que nível o usuário está durante a navegação e SHALL
exigir confirmação explícita antes de enviar a operação. Ele NÃO SHALL antecipar
no cliente a decisão de permissão sobre o destino: uma pasta listada que o
servidor venha a recusar SHALL produzir o aviso vindo do 403, como qualquer outra
ação. O seletor SHALL ser utilizável abaixo do ponto de ruptura definido pela
capability `web-responsividade`. Referência: PRD US 2.3, cenário 1; design.md D7.

#### Scenario: Navegar a árvore até a pasta de destino
- **WHEN** o usuário abre o seletor de destino e entra em uma pasta
- **THEN** o seletor exibe as subpastas daquele nível e indica onde o usuário está

#### Scenario: Escolher a raiz da unidade como destino
- **WHEN** o usuário escolhe a raiz como destino e confirma
- **THEN** a SPA envia a operação de mover com destino nulo

#### Scenario: Seletor não antecipa permissão do destino
- **WHEN** o usuário confirma um destino que o servidor recusa com 403
- **THEN** a SPA exibe o aviso de permissão insuficiente, sem ter ocultado a pasta
  previamente

#### Scenario: Seletor utilizável em tela estreita
- **WHEN** o usuário abre o seletor de destino numa tela mais estreita que o ponto
  de ruptura
- **THEN** a navegação por níveis e a confirmação permanecem alcançáveis
