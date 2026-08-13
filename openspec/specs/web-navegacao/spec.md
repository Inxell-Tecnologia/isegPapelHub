# web-navegacao Specification

## Purpose

Define os requisitos verificáveis da navegação de pastas e arquivos na SPA do
GDoc — o explorador em `/pastas` e `/pastas/:folderId` com trilha de navegação
(`Breadcrumb`), as ações de gestão por item (criar subpasta, excluir pasta,
renomear/excluir arquivo) condicionadas à resposta do servidor, e o bloqueio de
acesso direto a pastas sem permissão. Implementa o Épico 2 (US 2.1 e 2.2) e a
US 4.2 do PRD (`docs/prd_final.md`) do lado do cliente, consumindo os endpoints
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
(`DELETE /folders/:id`), **renomear arquivo** (`PATCH /files/:id`) e **excluir
arquivo** (`DELETE /files/:id`). A exclusão SHALL ser confirmada pelo usuário
antes de ser enviada. Ao concluir com sucesso, a SPA SHALL refletir o novo
estado recarregando a listagem da pasta corrente. Como os DTOs de listagem não
informam os verbos concedidos, a SPA NÃO SHALL inferir permissão no cliente:
SHALL oferecer a ação e, quando o servidor responder **403**, exibir um aviso de
**permissão insuficiente**, sem aplicar a mudança. Renomear **pasta** NÃO faz
parte desta capacidade enquanto o backend não expuser o endpoint correspondente.

Abaixo do ponto de ruptura definido pela capability `web-responsividade`, as
ações do item SHALL permanecer **todas alcançáveis**, podendo ser agrupadas num
menu de ações quando não couberem lado a lado. A ação de **visualizar** SHALL
permanecer diretamente acionável, sem exigir a abertura do agrupamento, por ser
o verbo central da consulta. O agrupamento SHALL decorrer **exclusivamente** do
espaço disponível, e NÃO SHALL ser usado para omitir ação alguma nem para
antecipar no cliente a decisão de permissão do servidor.

Referência: PRD US 2.2 (cenários 1 e 2); design.md D4/D5/D7 do change
`web-navegacao`; design.md D4 do change `responsividade-mobile-tablet`.

#### Scenario: Renomear arquivo com permissão
- **WHEN** o usuário renomeia um arquivo sobre o qual tem permissão
- **THEN** a SPA envia `PATCH /files/:id`, e ao sucesso a listagem da pasta
  reflete o novo nome

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
- **WHEN** o usuário tenta renomear ou excluir um item para o qual não tem
  permissão e o servidor responde 403
- **THEN** a ação não é aplicada e a SPA exibe um aviso de permissão insuficiente

#### Scenario: Em tela estreita as ações do item continuam todas alcançáveis
- **WHEN** o usuário abre o explorador numa tela mais estreita que o ponto de
  ruptura
- **THEN** todas as ações do item permanecem alcançáveis, agrupadas num menu de
  ações quando não couberem lado a lado, sem que nenhuma deixe de ser oferecida

#### Scenario: Visualizar permanece direta em tela estreita
- **WHEN** o usuário percorre a listagem numa tela estreita
- **THEN** a ação de visualizar é acionável diretamente na linha do item, sem
  exigir a abertura do menu de ações

#### Scenario: Agrupamento não antecipa a decisão de permissão
- **WHEN** o usuário aciona, pelo menu de ações em tela estreita, uma ação para a
  qual não tem permissão
- **THEN** a ação é enviada ao servidor e o aviso de permissão insuficiente vem
  do 403, do mesmo modo que na tela larga

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
