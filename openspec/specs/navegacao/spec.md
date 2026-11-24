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

A US 2.4 do PRD estende mover pasta ao **lote**: várias pastas para um mesmo
destino numa única operação, com pré-condição global de destino e veredito por
item, e a guarda de concorrência pós-`UPDATE` avaliada uma vez sobre o conjunto
movido, nunca atribuída a um item específico. Ver design.md do change
`mover-itens-em-lote`.

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

### Requirement: Mover pastas em lote

O sistema SHALL permitir que **várias pastas** sejam movidas para um mesmo
destino numa única operação, em `POST /folders/move`, recebendo um conjunto de
identificadores e a pasta de destino. Destino ausente ou nulo SHALL significar a
**raiz da unidade**. A rota por item (`POST /folders/:id/move`) SHALL permanecer
disponível e inalterada.

Cada pasta do conjunto SHALL ser submetida exatamente às mesmas regras da
movimentação por item — alcance **dono OU administrador da unidade** sobre a
pasta e sobre o destino, resolvido sem consultar concessões; relocalização de
toda a subárvore, inclusive itens de terceiros contidos nela, sem checagem item
a item; preservação de nome, dono, conteúdo, concessões, `object_path` e cota. O
lote NÃO SHALL introduzir nenhuma permissão, isenção ou verificação que a
operação por item não tenha.

A operação SHALL distinguir **pré-condição global** de **falha por item**:

- SHALL recusar o lote inteiro, sem mover nenhuma pasta, quando o número de
  identificadores exceder o teto configurado, quando o conjunto vier vazio, e
  quando a pasta de destino for inexistente, de outra unidade, estiver na
  lixeira ou estiver fora do alcance de quem pede.
- SHALL mover as demais pastas quando **um item individual** for recusado por
  falta de alcance, por não existir, por pertencer a outra unidade, por estar na
  lixeira, por ter o destino dentro da própria subárvore (ciclo), ou por já
  existir no destino uma pasta viva de mesmo nome.

A resposta SHALL informar um **veredito por identificador**, distinguindo as
pastas movidas com sucesso das recusadas e o motivo de cada recusa, com o ciclo
e a colisão de nome distinguíveis entre si e da falta de alcance.

A recusa por pré-condição global SHALL ser fail-closed e indistinguível entre os
casos de destino — inexistente, de outra unidade, na lixeira ou sem alcance
SHALL produzir a mesma resposta. Referência: PRD US 2.4; design.md D1/D2/D3 do
change `mover-itens-em-lote`.

#### Scenario: Lote de pastas movido preservando subárvore e concessões
- **WHEN** o dono de várias pastas as move para uma mesma pasta própria numa
  única operação
- **THEN** todas passam a residir no destino com os mesmos nomes, conteúdos e
  concessões, e nenhum arquivo das subárvores tem seus bytes deslocados

#### Scenario: Ciclo recusa apenas a pasta culpada
- **WHEN** um lote contém uma pasta cujo destino escolhido está dentro da própria
  subárvore, junto de outras pastas sem esse problema
- **THEN** as demais pastas são movidas, a pasta que formaria ciclo permanece
  onde estava, e a resposta indica o ciclo como motivo daquele item

#### Scenario: Colisão de nome recusa apenas a pasta homônima
- **WHEN** um lote contém uma pasta cujo nome já pertence a outra pasta viva no
  destino, junto de outras pastas sem homônima
- **THEN** as demais pastas são movidas, a pasta homônima permanece onde estava
  sem que nada seja sobrescrito ou fundido, e a resposta indica a colisão de nome
  como motivo daquele item

#### Scenario: Destino sem alcance derruba o lote inteiro
- **WHEN** a pasta de destino está fora do alcance de quem pede
- **THEN** nenhuma pasta do lote é movida e a operação é recusada por inteiro

#### Scenario: Teto de itens por operação
- **WHEN** o conjunto informado excede o teto configurado de itens por operação
- **THEN** a operação é recusada por inteiro com um aviso próprio de teto
  excedido, distinguível de uma recusa por permissão, e nenhuma pasta é movida

#### Scenario: Administrador global não alcança outra unidade em lote
- **WHEN** um administrador global submete um lote de pastas de unidade diferente
  da sua
- **THEN** a operação é recusada, sem distinguir o caso de pastas inexistentes

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

### Requirement: Guarda de concorrência do lote de pastas é tudo-ou-nada

O sistema SHALL avaliar a guarda de ciclo **posterior à escrita** — aquela que
protege contra movimentos concorrentes que isoladamente parecem válidos — uma
única vez sobre o conjunto de pastas efetivamente movido no lote, e SHALL
desfazer o **lote de pastas inteiro** quando ela detectar ciclo, deixando a
hierarquia exatamente como estava.

Essa recusa NÃO SHALL ser reportada como veredito de um identificador
específico, porque a condição que a dispara não é atribuível a nenhum item do
lote: ela decorre de uma operação concorrente de terceiro. A tolerância a falha
parcial SHALL cobrir apenas desfechos determinísticos e explicáveis por item —
falta de alcance, ciclo detectado antes da escrita e colisão de nome; a guarda
de concorrência SHALL permanecer tudo-ou-nada.

A guarda de ciclo **anterior à escrita** SHALL continuar sendo avaliada por
item, recusando individualmente a pasta cujo destino esteja em sua própria
subárvore sem afetar as demais. Referência: design.md D5 do change
`mover-itens-em-lote`; design.md D3 do change `mover-e-renomear-itens`.

#### Scenario: Corrida detectada após a escrita desfaz o lote de pastas
- **WHEN** uma operação concorrente instala um ciclo que a verificação anterior à
  escrita não podia enxergar
- **THEN** nenhuma pasta do lote permanece movida, a hierarquia fica como estava,
  e a recusa é reportada como falha da operação, não de um item

#### Scenario: Ciclo previsível continua sendo falha de item
- **WHEN** o destino escolhido está dentro da subárvore de uma das pastas do lote,
  sem nenhuma operação concorrente envolvida
- **THEN** apenas aquela pasta é recusada e as demais são movidas normalmente

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

### Requirement: Resposta de conteúdo informa o veredito de envio da pasta corrente

A rota de navegação SHALL informar, junto do conteúdo da pasta, se o
solicitante pode **enviar** nela, resolvendo o veredito pela mesma regra de
acesso que governa a rota de envio. O valor SHALL estar sempre presente na
resposta, e NÃO SHALL substituir a autorização da rota de envio.

#### Scenario: Dono da pasta recebe veredito favorável
- **WHEN** a pessoa que criou a pasta solicita o conteúdo dela
- **THEN** a resposta informa que ela pode enviar nessa pasta

#### Scenario: Concessão de envio sobre pasta de outra pessoa é refletida
- **WHEN** uma pessoa com concessão vigente do verbo de envio sobre pasta de
  outra pessoa solicita o conteúdo dessa pasta
- **THEN** a resposta informa que ela pode enviar, embora não seja dona nem
  administradora da unidade

#### Scenario: Quem só pode visualizar recebe veredito desfavorável
- **WHEN** uma pessoa com concessão apenas de visualização sobre pasta de
  outra pessoa solicita o conteúdo dessa pasta
- **THEN** a resposta apresenta o conteúdo e informa que ela **não** pode
  enviar nessa pasta

#### Scenario: O veredito não dispensa a autorização da rota de envio
- **WHEN** um pedido de envio chega a uma pasta sobre a qual o solicitante não
  tem o verbo de envio
- **THEN** a rota de envio recusa por conta própria, independentemente do
  veredito que a rota de navegação tenha informado antes

#### Scenario: Raiz da unidade sempre admite envio
- **WHEN** qualquer pessoa autenticada solicita o conteúdo da raiz da própria
  unidade
- **THEN** a resposta informa que ela pode enviar, por a raiz não ser recurso
  concedível

### Requirement: Resposta de conteúdo informa, por subpasta, a contagem de documentos da subárvore alcançável pelo solicitante

A rota de navegação SHALL informar, em cada subpasta listada, quantos documentos o solicitante pode abrir **dentro dela, incluindo as subpastas que ele pode abrir**, contando em cada pasta alcançada o mesmo recorte da listagem de documentos e podando a subpasta sem acesso com toda a sua descendência. NÃO SHALL contar nada de outra unidade nem de pasta que o solicitante não pode abrir. Referência: PRD US 11.1 (cenário 3), US 4.1, US 4.3, US 5.1, US 10.7, US 10.9.

#### Scenario: A contagem é a soma do que a pessoa encontra navegando
- **WHEN** uma pessoa solicita o conteúdo de uma pasta e, em seguida, o conteúdo
  de uma das subpastas listadas
- **THEN** a contagem informada para essa subpasta é igual ao número de
  documentos apresentados ao abri-la somado às contagens informadas para as
  subpastas que aparecem dentro dela

#### Scenario: Documentos de subpastas entram na soma
- **WHEN** uma pasta contém apenas subpastas com documentos que o solicitante
  pode abrir
- **THEN** a contagem dessa pasta é a soma desses documentos

#### Scenario: Subpasta sem acesso fica fora da soma
- **WHEN** uma pasta visível contém uma subpasta que o solicitante não pode
  abrir, ainda que ele tenha concessão de visualização sobre documentos dentro
  dela
- **THEN** os documentos dessa subpasta não entram na contagem da pasta, sem
  revelar a existência deles

#### Scenario: A poda vale para toda a descendência
- **WHEN** abaixo de uma subpasta que o solicitante não pode abrir existe outra
  subpasta, com documentos, que ele poderia abrir
- **THEN** nem essa subpasta nem seus documentos entram na contagem

#### Scenario: Concessão sobre a pasta não faz contar os documentos dela
- **WHEN** uma pessoa com concessão de visualização apenas sobre uma pasta de
  outra pessoa, que contém documentos, solicita o conteúdo da pasta-mãe
- **THEN** a pasta aparece com contagem zero

#### Scenario: Documento sem acesso não é contado
- **WHEN** uma pasta visível contém documentos dos quais o solicitante só pode
  visualizar parte
- **THEN** a contagem informa apenas os documentos que ele pode visualizar, sem
  revelar a existência dos demais

#### Scenario: Concessão expirada deixa de contar na requisição seguinte
- **WHEN** a concessão de visualização de um documento ou de uma subpasta
  expira
- **THEN** a contagem deixa de incluir o documento, ou o ramo daquela subpasta,
  na requisição seguinte, sem depender de rotina agendada

#### Scenario: Documento ou subpasta na lixeira não é contado
- **WHEN** um documento, ou uma subpasta com documentos, é excluído para a
  lixeira
- **THEN** a contagem deixa de incluí-lo para qualquer solicitante, inclusive o
  administrador da unidade

#### Scenario: Obsoleto e pendente de cadastro seguem a listagem
- **WHEN** uma pasta ou uma de suas subpastas contém um documento obsoleto e um
  pendente de cadastro
- **THEN** o administrador da unidade vê os dois contados, quem enviou o
  pendente o vê contado, e um terceiro com concessão de visualização sobre eles
  não vê nenhum dos dois contado

#### Scenario: Administrador global conta só a própria unidade
- **WHEN** o administrador global solicita o conteúdo da raiz da sua unidade
- **THEN** cada contagem considera apenas pastas e documentos da sua unidade, e
  pastas de outras unidades não aparecem nem são contadas

#### Scenario: Estrutura inconsistente não trava a requisição
- **WHEN** a cadeia de pastas em torno da pasta solicitada contém um ciclo
- **THEN** a requisição termina, sem laço infinito na contagem
