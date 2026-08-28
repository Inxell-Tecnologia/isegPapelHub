# navegacao Specification

## Purpose

Define os requisitos verificáveis de navegação por pastas aninhadas do GDoc —
criação de pastas por unidade, colocação de arquivos em pastas e navegação com
trilha (breadcrumb) — na fatia **só-por-dono** do Épico 2 / US 2.1 do PRD
(`docs/prd_final.md`). A metade "itens que criei" do cenário 2 é vinculante
aqui; a metade "itens que me foram liberados" e o alcance administrativo sobre
itens de terceiros ficam para o Épico 4 (permissões) e Épico 5 (US 5.1). Os
cenários Given/When/Then da US 2.1 são vinculantes e este spec os torna
verificáveis no backend.

A US 2.3 do PRD estende esta capability: a hierarquia de pastas, até então
imutável após a criação, passa a admitir **mudança de pai** (mover) e
**mudança de nome** (renomear), com recusa de ciclo e unicidade de nome válida
também na raiz. Mover e renomear pasta usam um alcance próprio — **dono OU
administrador da unidade**, sem ramo de concessão — distinto do "só-por-dono"
da criação/navegação; ver design.md D1/D2 do change `mover-e-renomear-itens`.
O mover de **arquivo** é normatizado pela capability `gestao-arquivos`.

## Requirements

### Requirement: Pastas aninhadas por unidade

O sistema SHALL permitir que uma pessoa autenticada crie pastas em `POST /folders`,
na raiz da sua unidade ou dentro de outra pasta da qual seja dona, formando uma
hierarquia aninhada. Toda pasta SHALL ser vinculada à unidade (`unit_id`) e ao dono
(`owner_id`), e o isolamento entre unidades SHALL ser imposto no banco por RLS, não
apenas na aplicação. Referência: PRD US 2.1.

#### Scenario: Criação de pasta na raiz
- **WHEN** uma pessoa cria uma pasta sem informar pasta-pai
- **THEN** a pasta é criada na raiz da sua unidade, vinculada a ela e ao criador como
  dono

#### Scenario: Criação de subpasta dentro de pasta própria
- **WHEN** uma pessoa cria uma pasta informando como pai uma pasta da qual é dona
- **THEN** a nova pasta é criada como filha dela, preservando o aninhamento

#### Scenario: Pasta-pai de outra unidade não é utilizável
- **WHEN** uma pessoa tenta criar uma subpasta apontando para uma pasta-pai de outra
  unidade
- **THEN** a operação é recusada e nenhuma pasta é criada, sem revelar a existência
  da pasta de outra unidade

### Requirement: Colocação de arquivos em pastas

O sistema SHALL permitir que um arquivo seja associado a uma pasta no momento do
envio, informando a pasta de destino; um arquivo sem pasta informada SHALL residir na
raiz da unidade. A pasta de destino SHALL pertencer à mesma unidade do remetente.
Referência: PRD US 2.1.

#### Scenario: Envio para uma pasta
- **WHEN** uma pessoa solicita o envio de um arquivo informando uma pasta de destino
  da sua unidade
- **THEN** o arquivo passa a residir logicamente nessa pasta

#### Scenario: Envio sem pasta cai na raiz
- **WHEN** uma pessoa solicita o envio de um arquivo sem informar pasta
- **THEN** o arquivo passa a residir na raiz da unidade

### Requirement: Navegação com trilha e visibilidade só-por-dono

O sistema SHALL listar o conteúdo de uma pasta (subpastas e arquivos) em uma rota de
navegação, exibindo **apenas os itens dos quais o solicitante é dono**, e SHALL
devolver a trilha (breadcrumb) da raiz até a pasta corrente, permitindo retornar a
qualquer nível anterior. A listagem SHALL respeitar o isolamento por unidade via RLS.
Itens de outras pessoas, ainda que na mesma pasta, NÃO SHALL aparecer nesta fatia — a
visibilidade por concessão explícita é o Épico 4. Referência: PRD US 2.1.

#### Scenario: Navegar e atualizar a trilha
- **WHEN** uma pessoa entra em uma subpasta à qual tem acesso como dona
- **THEN** vê o conteúdo permitido dessa subpasta e a trilha é atualizada com o
  caminho da raiz até ela, cada nível permitindo retorno com um clique

#### Scenario: Item de outra pessoa não aparece na listagem
- **WHEN** uma pasta contém itens criados por outra pessoa e itens criados pelo
  solicitante
- **THEN** apenas os itens dos quais o solicitante é dono são exibidos

#### Scenario: Conteúdo de outra unidade nunca aparece
- **WHEN** uma pessoa navega pelas pastas
- **THEN** nunca vê pastas ou arquivos pertencentes a outra unidade, mesmo por
  identificador direto de pasta

### Requirement: Mover pasta para outra pasta ou para a raiz

O sistema SHALL permitir que uma pasta seja movida para outra pasta da mesma
unidade, ou para a raiz da unidade, em `POST /folders/:id/move`, alterando seu
pai sem alterar seu nome, seu dono, seu conteúdo ou as concessões existentes
sobre ela e sobre seus descendentes. Destino ausente ou nulo SHALL significar a
**raiz da unidade**.

O alcance da operação SHALL ser **dono do recurso OU administrador da unidade do
recurso**, exigido sobre **os dois** lados — a pasta movida e a pasta de destino
— e SHALL ser resolvido **sem** consultar concessões: possuir grant de qualquer
verbo sobre a pasta ou sobre o destino NÃO SHALL habilitar a operação nesta
fatia. A raiz da unidade SHALL ser destino válido para qualquer pessoa da
unidade, por não ter dono. O administrador global NÃO SHALL alcançar pasta de
outra unidade, ainda que a enxergue por bypass de RLS.

A recusa SHALL ser fail-closed e indistinguível entre os casos: pasta ou destino
inexistente, de outra unidade, na lixeira, ou de terceiro sem alcance SHALL
produzir a mesma resposta, sem revelar qual dos casos ocorreu. Mover SHALL
preservar `object_path` de todo arquivo da subárvore, NÃO SHALL consumir cota e
NÃO SHALL alterar a cota de nenhum dono.

Mover uma pasta SHALL relocalizar toda a sua subárvore, inclusive itens de outras
pessoas contidos nela, sem checagem item a item — a mesma escolha já feita pela
cascata de exclusão. Referência: PRD US 2.3, cenários 1, 2 e 6; design.md
D1/D2/D8 do change `mover-e-renomear-itens`.

#### Scenario: Mover pasta própria preservando conteúdo e concessões
- **WHEN** o dono de uma pasta a move para outra pasta própria
- **THEN** a pasta passa a residir no destino com o mesmo nome, o mesmo conteúdo e
  as mesmas concessões, e nenhum arquivo da subárvore tem seus bytes deslocados

#### Scenario: Mover para a raiz da unidade
- **WHEN** o dono de uma subpasta a move informando destino nulo
- **THEN** a pasta passa a residir na raiz da unidade

#### Scenario: Quem não é dono nem administrador não move
- **WHEN** uma pessoa sem alcance sobre a pasta tenta movê-la, ainda que possua
  concessão de qualquer verbo sobre ela
- **THEN** a ação é recusada com permissão insuficiente e a hierarquia permanece
  inalterada

#### Scenario: Destino de terceiro sem alcance é recusado
- **WHEN** o dono de uma pasta tenta movê-la para uma pasta de outra pessoa sobre
  a qual não é administrador, mesmo possuindo concessão de `upload` sobre ela
- **THEN** a ação é recusada e a pasta permanece onde estava

#### Scenario: Administrador global não alcança outra unidade
- **WHEN** um administrador global tenta mover uma pasta de unidade diferente da
  sua
- **THEN** a ação é recusada, sem distinguir o caso de pasta inexistente

#### Scenario: Pasta na lixeira não é origem nem destino
- **WHEN** a pasta a mover, ou a pasta de destino, está na lixeira
- **THEN** a ação é recusada como se a pasta não existisse

### Requirement: Recusa de ciclo na hierarquia de pastas

O sistema SHALL recusar mover uma pasta para dentro de si mesma ou de qualquer
pasta de sua própria subárvore, em qualquer profundidade, preservando a
hierarquia intacta. A recusa SHALL ser garantida mesmo sob operações
concorrentes, de modo que dois movimentos simultâneos que isoladamente pareçam
válidos NÃO SHALL conseguir instalar um ciclo entre si.

As travessias da árvore — construção da trilha de navegação e coleta de subárvore
— SHALL ser resistentes a ciclo, terminando com erro tratado em vez de laço
infinito ou esgotamento de recursão, ainda que uma linha inconsistente exista por
qualquer via. Referência: PRD US 2.3, cenário 3; design.md D3 do change
`mover-e-renomear-itens`.

#### Scenario: Pasta não pode ser movida para dentro de si mesma
- **WHEN** o dono de uma pasta escolhe a própria pasta como destino
- **THEN** a ação é recusada com aviso e a hierarquia permanece como estava

#### Scenario: Pasta não pode ser movida para uma descendente
- **WHEN** o dono de uma pasta escolhe como destino uma subpasta contida nela, em
  qualquer profundidade
- **THEN** a ação é recusada com aviso e a hierarquia permanece como estava

#### Scenario: Movimentos concorrentes não instalam ciclo
- **WHEN** duas operações concorrentes moveriam cada uma das pastas para dentro da
  outra
- **THEN** no máximo uma delas é efetivada e a árvore permanece sem ciclo

#### Scenario: Trilha de navegação não entra em laço
- **WHEN** a trilha de navegação é construída sobre uma cadeia de pastas que
  contenha um ciclo
- **THEN** a construção termina com erro tratado, sem laço infinito

### Requirement: Renomear pasta

O sistema SHALL permitir que uma pasta seja renomeada em `PATCH /folders/:id`,
alterando o nome exibido sem alterar sua localização, seu dono, seu conteúdo ou
as concessões existentes sobre ela e sobre seus descendentes. A localização
lógica dos arquivos e subpastas contidos NÃO SHALL mudar em decorrência da
renomeação.

O alcance SHALL ser **dono da pasta OU administrador da unidade da pasta**,
resolvido **sem** consultar concessões — possuir grant `rename` sobre a pasta NÃO
SHALL habilitar a operação nesta fatia. A recusa SHALL ser fail-closed e
indistinguível entre pasta inexistente, de outra unidade, na lixeira ou de
terceiro sem alcance. Referência: PRD US 2.3, cenários 2 e 5; design.md D1/D2 do
change `mover-e-renomear-itens`.

#### Scenario: Renomeação pela dona preserva local e conteúdo
- **WHEN** a dona de uma pasta altera seu nome
- **THEN** o novo nome é exibido no mesmo lugar, e o conteúdo e a localização das
  subpastas e arquivos permanecem inalterados

#### Scenario: Renomeação sem alcance é bloqueada
- **WHEN** uma pessoa que não é dona da pasta nem administradora da unidade tenta
  renomeá-la, ainda que possua concessão `rename` sobre ela
- **THEN** a ação é bloqueada com aviso de permissão insuficiente e nada é alterado

### Requirement: Unicidade de nome de pasta por pasta-pai, inclusive na raiz

O sistema SHALL garantir que duas pastas **vivas** da mesma unidade não coexistam
com o mesmo nome sob a mesma pasta-pai, tratando a comparação de forma
**insensível a maiúsculas e minúsculas**. A garantia SHALL valer igualmente
quando a pasta-pai é a **raiz da unidade**, e SHALL ser imposta no banco, não
apenas na aplicação, de modo que nenhum chamador possa contorná-la. Pasta na
lixeira NÃO SHALL ocupar o nome para efeito desta regra.

Mover ou renomear uma pasta para um nome já ocupado no destino SHALL ser recusado
com erro identificável, e a operação NÃO SHALL sobrescrever, fundir nem renomear
automaticamente qualquer das pastas envolvidas. Arquivos NÃO SHALL estar sujeitos
a esta regra: dois arquivos de mesmo nome na mesma pasta permanecem admissíveis, e
mover arquivo NÃO SHALL ser recusado por nome. Referência: PRD US 2.3, cenário 4;
design.md D4/D5 do change `mover-e-renomear-itens`.

#### Scenario: Mover para destino com pasta homônima é recusado
- **WHEN** o destino já contém uma pasta viva de mesmo nome que a pasta movida
- **THEN** a ação é recusada com aviso, sem sobrescrever nem fundir o conteúdo das
  duas pastas

#### Scenario: Renomear para nome já ocupado é recusado
- **WHEN** o novo nome coincide com o de outra pasta viva sob o mesmo pai
- **THEN** a ação é recusada com aviso e o nome anterior é preservado

#### Scenario: A regra vale na raiz da unidade
- **WHEN** a pasta-pai envolvida é a raiz da unidade
- **THEN** a coincidência de nome é recusada do mesmo modo que sob qualquer outra
  pasta-pai

#### Scenario: Diferença apenas de maiúsculas não escapa da regra
- **WHEN** o nome pretendido difere de uma pasta existente apenas por maiúsculas e
  minúsculas
- **THEN** a ação é recusada

#### Scenario: Pasta na lixeira não bloqueia o nome
- **WHEN** o destino contém uma pasta homônima que está na lixeira
- **THEN** a ação é aceita, pois a pasta excluída não ocupa o nome

#### Scenario: Arquivos homônimos na mesma pasta continuam admissíveis
- **WHEN** um arquivo é movido para uma pasta que já contém outro arquivo de mesmo
  nome
- **THEN** a ação é aceita e ambos os arquivos coexistem
