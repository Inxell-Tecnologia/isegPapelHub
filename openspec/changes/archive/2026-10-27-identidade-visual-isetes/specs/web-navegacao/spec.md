# Spec Delta

## ADDED Requirements

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
