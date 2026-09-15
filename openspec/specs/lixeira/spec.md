# lixeira Specification

## Purpose

Define os requisitos verificáveis da lixeira e da retenção de itens excluídos,
na fatia do **Épico 6 / US 6.1** do PRD (`docs/prd_final.md`): exclusão como
soft-delete (em vez de apagar imediatamente), cascata de pastas, ocultação
total do item em toda via de acesso viva, restauração ao local de origem com
as permissões preservadas, listagem da lixeira restrita ao alcance do
solicitante, expurgo permanente automático após o prazo de retenção (30 dias),
expurgo imediato dos próprios arquivos sob demanda (change `esvaziar-lixeira`)
e a contagem de cota durante a retenção. Os cenários Given/When/Then da US são
vinculantes. As decisões de design (soft-delete por `deleted_at`/`deleted_by`,
agrupamento por `trash_root_id`, expurgo tolerante a falha por item removendo
bytes antes de linhas) estão em `design.md` do change
`epico-6-lixeira-retencao` (D1–D10).

## Requirements

### Requirement: Exclusão envia o item para a lixeira em vez de apagar

Excluir um arquivo ou pasta SHALL marcá-lo como excluído (soft-delete),
retendo-o na lixeira, em vez de removê-lo imediatamente. A exclusão SHALL exigir
o verbo `delete` sobre o recurso — **dono OU grant `delete` OU admin da unidade
do recurso** — e, sem esse alcance, SHALL ser negada com 403 sem vazar a
existência do recurso. A marcação SHALL registrar quando e por quem o item foi
excluído, sem mover a linha nem alterar seu local (`folder_id`/`parent_id`) e
sem apagar os grants existentes, de modo que a restauração devolva o item ao
local de origem com as permissões que possuía. Referência: PRD Épico 6 / US 6.1,
cenário 1; RF #12; design.md D1/D3.

#### Scenario: Excluir arquivo com permissão o envia à lixeira
- **WHEN** uma pessoa com posse, grant `delete` ou alcance de admin da unidade
  exclui um arquivo
- **THEN** o arquivo é marcado como excluído e retido na lixeira, deixando de
  aparecer nas visões vivas, mas permanecendo restaurável dentro do prazo

#### Scenario: Excluir sem o verbo delete é bloqueado
- **WHEN** uma pessoa sem posse, sem grant `delete` e sem alcance de admin da
  unidade tenta excluir um arquivo ou pasta
- **THEN** a ação é negada com 403 e a resposta não distingue "não existe" de
  "existe sem permissão"

### Requirement: Excluir pasta cascateia para o conteúdo interno

Excluir uma pasta SHALL enviar à lixeira, na mesma operação, a pasta e **toda a
sua subárvore** — subpastas e arquivos internos —, agrupados como uma única
operação de exclusão para que possam ser restaurados juntos. Itens que já
estavam na lixeira antes SHALL preservar o agrupamento da sua exclusão anterior,
não sendo reabsorvidos pela nova operação. A cascata SHALL permanecer restrita à
unidade do solicitante (a RLS por `unit_id` é a fronteira dura). Referência: PRD
Épico 6 / US 6.1; design.md D4.

#### Scenario: Excluir pasta remove a subárvore inteira das visões vivas
- **WHEN** uma pessoa com permissão exclui uma pasta que contém subpastas e
  arquivos
- **THEN** a pasta e todo o seu conteúdo interno vão para a lixeira juntos e
  deixam de aparecer na navegação

### Requirement: Item na lixeira não é acessível por nenhuma via viva

Um item na lixeira NÃO SHALL ser acessível por navegação, listagem, emissão de
URL de visualização/download, renomear/substituir ou link direto ao seu
identificador — SHALL resolver como inexistente (403 fail-closed, sem vazar
existência), do mesmo modo que um recurso de outra unidade. Referência: PRD
Épico 6 / US 6.1; US 4.2; design.md D2.

#### Scenario: Link direto a arquivo na lixeira é bloqueado
- **WHEN** uma pessoa aciona a rota de visualização/download de um arquivo que
  está na lixeira, ainda que conheça seu identificador
- **THEN** recebe 403, sem URL nem pré-visualização, e a resposta não revela que
  o arquivo existe na lixeira

#### Scenario: Item na lixeira não aparece na listagem
- **WHEN** uma pessoa (inclusive o admin da unidade) lista o conteúdo da pasta
  onde um item estava antes de ser excluído
- **THEN** o item excluído não aparece na listagem viva

### Requirement: Restauração devolve o item ao local de origem com as permissões

Restaurar um item da lixeira dentro do prazo de retenção SHALL devolvê-lo ao seu
local de origem com os grants que possuía, exigindo o mesmo alcance da exclusão
(dono OU grant `delete` OU admin da unidade) sobre a raiz da exclusão. Restaurar
uma pasta SHALL restaurar junto a subárvore excluída na mesma operação. Quando o
local de origem de um arquivo não existir mais como pasta viva (o ancestral foi
expurgado), a restauração SHALL devolvê-lo à raiz da unidade, informando o
destino efetivo. Referência: PRD Épico 6 / US 6.1, cenário 1; design.md D5.

#### Scenario: Restaurar arquivo o devolve ao local com as permissões
- **WHEN** uma pessoa restaura da lixeira um arquivo excluído dentro do prazo
- **THEN** o arquivo volta ao seu `folder_id` de origem, com os mesmos grants
  que possuía, e volta a aparecer nas visões vivas

#### Scenario: Restaurar pasta restaura a subárvore junto
- **WHEN** uma pessoa restaura da lixeira uma pasta que fora excluída com seu
  conteúdo
- **THEN** a pasta e a subárvore excluída na mesma operação voltam juntas ao
  local de origem

### Requirement: Lixeira lista os itens restauráveis no alcance do solicitante

O sistema SHALL oferecer uma listagem da lixeira que apresenta as **raízes de
exclusão** que o solicitante pode restaurar — as próprias, as que possui grant
`delete`, ou todas as da unidade se for admin —, informando ao menos nome, tipo,
quando foi excluído e quando expira. A listagem NÃO SHALL, em nenhuma hipótese,
incluir itens de outra unidade. Referência: PRD Épico 6 / US 6.1; design.md D9.

#### Scenario: Colaborador vê apenas suas raízes de exclusão
- **WHEN** um `collaborator` abre a lixeira
- **THEN** vê as raízes de exclusão que pode restaurar (próprias ou com grant
  `delete`) e não vê itens de terceiros sem alcance nem itens de outra unidade

#### Scenario: Admin da unidade vê a lixeira da unidade
- **WHEN** um `unit_admin` abre a lixeira
- **THEN** vê as raízes de exclusão da sua unidade, sem itens de outra unidade

### Requirement: Expurgo permanente automático diário após 30 dias

Uma rotina diária executada às 3h SHALL apagar de forma permanente os itens que
estão na lixeira há mais de 30 dias (prazo de retenção configurável), deixando de
poder restaurá-los. O expurgo SHALL remover os bytes do objeto no storage,
devolver ao dono a cota correspondente ao tamanho do arquivo e apagar as linhas
de metadados, incluindo os grants órfãos e a auditoria dos arquivos expurgados.
O expurgo SHALL ser tolerante a falha por item — a falha ao apagar um item NÃO
SHALL impedir o expurgo dos demais, e o item pendente SHALL ser reprocessado no
ciclo seguinte —, removendo os bytes antes de apagar a linha para nunca deixar
uma linha viva apontando bytes já removidos. Itens dentro do prazo NÃO SHALL ser
afetados. Referência: PRD Épico 6 / US 6.1, cenário 2; RF #12; design.md
D6/D7/D8/D10.

#### Scenario: Item vencido é apagado permanentemente e libera cota
- **WHEN** a rotina diária é executada e há um arquivo na lixeira há mais de 30
  dias
- **THEN** os bytes do arquivo são removidos do storage, a cota do dono é
  reduzida pelo tamanho do arquivo, as linhas de metadados/grants/auditoria são
  apagadas, e o item deixa de poder ser restaurado

#### Scenario: Item dentro do prazo permanece restaurável
- **WHEN** a rotina diária é executada e há um item na lixeira há menos de 30
  dias
- **THEN** o item não é afetado e continua restaurável

#### Scenario: Falha ao apagar um item não derruba o lote
- **WHEN** durante o expurgo a remoção dos bytes de um item falha
- **THEN** os demais itens vencidos são expurgados normalmente e o item que
  falhou permanece íntegro para ser reprocessado no próximo ciclo

### Requirement: Cota permanece contada durante a retenção

Enquanto um arquivo está na lixeira, seus bytes SHALL continuar contando contra a
cota de 10 GB do dono, pois ainda ocupam o armazenamento; a cota SHALL ser
devolvida somente quando o expurgo remover o objeto — seja o expurgo automático
por decurso de prazo, seja o expurgo sob demanda do requisito abaixo. A exclusão NÃO SHALL, por si
só, reduzir `storage_used_bytes`. Referência: PRD Épico 6 / US 6.1; RF #13;
design.md D6.

#### Scenario: Excluir não devolve cota imediatamente
- **WHEN** uma pessoa exclui um arquivo (enviando-o à lixeira)
- **THEN** o espaço utilizado do dono permanece inalterado até o expurgo do item

### Requirement: Expurgo imediato dos próprios arquivos na lixeira

O sistema SHALL permitir que uma pessoa apague **permanentemente**, sob demanda e
sem aguardar o prazo de retenção, os **arquivos de que ela é dona** que se
encontram na lixeira, devolvendo-lhe a cota correspondente ao tamanho de cada
arquivo apagado. A operação SHALL ser irreversível: os arquivos apagados NÃO
SHALL poder ser restaurados.

A operação SHALL alcançar **exclusivamente arquivos do próprio solicitante**.
Arquivos de outra pessoa da mesma unidade NÃO SHALL ser afetados, e arquivos de
outra unidade SHALL permanecer inalcançáveis. Administrador de unidade e
administrador global NÃO SHALL dispor, por esta operação, de expurgo sobre a
lixeira de terceiro — a cota é pessoal, e a operação existe para que cada pessoa
administre a própria.

A operação SHALL afetar **apenas arquivos**, nunca pastas: pastas não ocupam
bytes e não devolvem cota, e as pastas na lixeira SHALL permanecer sujeitas
exclusivamente ao expurgo automático por decurso de prazo.

A operação SHALL seguir a mesma sequência do expurgo automático — remover os
bytes do objeto, e o do objeto órfão de substituição quando houver, **antes** de
apagar a linha, devolver a cota ao dono e apagar metadados, auditoria do arquivo
e grants órfãos — e SHALL ser tolerante a falha por item: a falha ao apagar um
arquivo NÃO SHALL impedir o expurgo dos demais, e o arquivo que falhou SHALL
permanecer íntegro na lixeira. A resposta SHALL informar quantos arquivos foram
apagados, quanto espaço foi devolvido e quantos falharam.

A operação SHALL ser precedida de confirmação explícita que informe **quantos
arquivos** serão apagados, **quanto espaço** retorna e que a ação **não tem
volta** — uma confirmação genérica não permite avaliar a troca. Nada SHALL ser
apagado antes da confirmação. Concluído o expurgo, o espaço recuperado SHALL
aparecer de imediato, sem recarregar a página.

O expurgo automático diário por decurso de prazo SHALL permanecer em vigor, sem
alteração: a forma sob demanda o acompanha, não o substitui. Referência: PRD
Épico 6 / US 6.2; RF #12, RF #13; design.md D1/D2/D3/D4 do change
`esvaziar-lixeira`.

#### Scenario: Esvaziar a própria lixeira devolve cota na hora
- **WHEN** uma pessoa esvazia sua lixeira, contendo arquivos ainda dentro do
  prazo de retenção
- **THEN** os arquivos são apagados permanentemente, seus bytes saem do
  armazenamento e o espaço utilizado da pessoa é reduzido pelo tamanho deles

#### Scenario: Arquivo de outra pessoa não é afetado
- **WHEN** uma pessoa esvazia sua lixeira e há, na lixeira da mesma unidade,
  arquivos de outra pessoa
- **THEN** apenas os arquivos de quem pediu são apagados, e os das demais pessoas
  permanecem restauráveis

#### Scenario: Pastas na lixeira permanecem
- **WHEN** uma pessoa esvazia sua lixeira e há pastas suas na lixeira
- **THEN** as pastas permanecem na lixeira, sujeitas ao expurgo automático por
  decurso de prazo

#### Scenario: Confirmação informa a troca antes de apagar
- **WHEN** a pessoa aciona esvaziar a lixeira
- **THEN** a confirmação informa quantos arquivos serão apagados e quanto espaço
  retorna, avisa que a ação não tem volta, e nada é apagado enquanto ela não
  confirmar

#### Scenario: Falha ao apagar um arquivo não derruba os demais
- **WHEN** a remoção dos bytes de um dos arquivos falha durante o expurgo sob
  demanda
- **THEN** os demais arquivos são apagados normalmente, o que falhou permanece
  íntegro na lixeira, e a resposta informa a quantidade apagada e a que falhou

#### Scenario: Expurgo automático continua valendo
- **WHEN** uma pessoa nunca aciona o expurgo sob demanda
- **THEN** seus itens na lixeira continuam sendo expurgados pela rotina diária ao
  vencer o prazo de retenção
