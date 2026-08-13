# Spec — web-navegacao (delta)

A coluna de ações do explorador acumula hoje até seis botões rotulados por item
(`Visualizar`, `Baixar`, `Renomear`, `Permissões`, `Auditoria`, `Excluir`), que
não cabem em largura alguma de celular. O requisito vigente descreve **quais**
ações são oferecidas e como a permissão é tratada, mas não diz nada sobre a forma
de apresentá-las quando o espaço é insuficiente.

Este delta acrescenta essa obrigação, preservando integralmente a regra que a
governa: a SPA continua **não inferindo permissão no cliente**. Agrupar ações por
falta de espaço é legítimo; suprimi-las por permissão presumida permanece
proibido — e agrupar nunca pode virar suprimir. Ver design.md D4.

## MODIFIED Requirements

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
