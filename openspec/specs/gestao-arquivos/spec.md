# gestao-arquivos Specification

## Purpose

Define os requisitos verificáveis de gestão do ciclo de vida de arquivos do
GDoc — renomear, substituir por nova versão e **mover entre pastas** (por item
ou em lote) — nas fatias do Épico 2 / US 2.2 (renomear/substituir), US 2.3
(mover por item) e US 2.4 (mover em lote) do PRD (`docs/prd_final.md`).
Renomear/substituir têm checagem de permissão baseada em **dono**, com a
permissão granular concedida a terceiros no Épico 4; mover usa alcance **dono
OU administrador da unidade**, deliberadamente sem ramo de concessão (ver
capability `navegacao` para a normatização de mover pasta, a recusa de ciclo e
a unicidade de nome). Os cenários Given/When/Then das US 2.2, US 2.3 e US 2.4
são vinculantes e este spec os torna verificáveis no backend.

## Requirements

### Requirement: Renomear arquivo

O sistema SHALL permitir que o dono de um arquivo o renomeie em `PATCH /files/:id`,
alterando o nome exibido sem trocar sua localização lógica nem seu conteúdo. Quem não
tem permissão (nesta fatia, quem não é o dono) NÃO SHALL conseguir renomear.
Referência: PRD US 2.2.

#### Scenario: Renomeação pelo dono
- **WHEN** o dono de um arquivo o renomeia
- **THEN** o nome exibido é atualizado no mesmo local, o conteúdo permanece o mesmo, e
  o evento fica registrado na auditoria

#### Scenario: Renomeação sem permissão é bloqueada
- **WHEN** uma pessoa que não tem permissão sobre um arquivo tenta renomeá-lo
- **THEN** a ação é bloqueada com aviso de permissão insuficiente e nada é alterado

### Requirement: Substituir arquivo por nova versão

O sistema SHALL permitir que o dono de um arquivo o substitua por uma nova versão em
`POST /files/:id/replace-url`, recebendo uma URL assinada de curta duração para enviar
o novo conteúdo. A nova versão SHALL ocupar o **mesmo local lógico** (mesma pasta e
mesmo nome) do arquivo vigente, e a versão anterior NÃO SHALL permanecer disponível
para consulta (sem histórico de versões — fora de escopo no PRD). A substituição SHALL
respeitar a cota do dono, considerando a diferença de tamanho entre a versão nova e a
antiga. Quem não é o dono NÃO SHALL conseguir substituir. Referência: PRD US 2.2.

#### Scenario: Substituição pelo dono preserva o local
- **WHEN** o dono envia uma nova versão para um arquivo sobre o qual tem permissão
- **THEN** o arquivo vigente é substituído no mesmo local, a versão anterior deixa de
  estar disponível, e o evento fica registrado na auditoria

#### Scenario: Substituição sem permissão é bloqueada
- **WHEN** uma pessoa que não tem permissão tenta substituir um arquivo
- **THEN** a ação é bloqueada com aviso de permissão insuficiente e o arquivo vigente
  permanece intacto

#### Scenario: Substituição respeita a cota pelo delta
- **WHEN** a nova versão faria o espaço utilizado do dono ultrapassar a cota,
  considerando a diferença para a versão anterior
- **THEN** a substituição é bloqueada com aviso de cota atingida e o arquivo vigente
  permanece intacto

### Requirement: Mover arquivo entre pastas

O sistema SHALL permitir que um arquivo seja movido para outra pasta da mesma
unidade, ou para a raiz da unidade, em `POST /files/:id/move`, alterando apenas
sua localização lógica. Destino ausente ou nulo SHALL significar a **raiz da
unidade**.

A operação NÃO SHALL alterar o nome do arquivo, seu dono, seu conteúdo, seu
identificador nem o objeto correspondente no storage — nenhum byte SHALL ser
copiado ou deslocado, nenhuma URL assinada SHALL ser emitida. A operação NÃO
SHALL consumir cota nem alterar o espaço utilizado de nenhum dono, e SHALL
preservar integralmente as concessões existentes sobre o arquivo e o histórico de
auditoria já registrado: um arquivo movido continua acessível exatamente a quem
já o acessava, com a mesma trilha.

O alcance SHALL ser **dono do arquivo OU administrador da unidade do arquivo**,
exigido também sobre a **pasta de destino**, e SHALL ser resolvido **sem**
consultar concessões: possuir grant `rename` sobre o arquivo ou `upload` sobre o
destino NÃO SHALL habilitar a operação nesta fatia. A raiz da unidade SHALL ser
destino válido para qualquer pessoa da unidade. O administrador global NÃO SHALL
alcançar arquivo de outra unidade, ainda que o enxergue por bypass de RLS.

A recusa SHALL ser fail-closed e indistinguível entre os casos: arquivo ou
destino inexistente, de outra unidade, na lixeira, ou de terceiro sem alcance
SHALL produzir a mesma resposta. Referência: PRD US 2.3, cenários 1, 2 e 6;
design.md D1/D2 do change `mover-e-renomear-itens`.

#### Scenario: Mover arquivo próprio preserva conteúdo, cota e concessões
- **WHEN** o dono de um arquivo o move para outra pasta própria
- **THEN** o arquivo passa a residir na pasta de destino com o mesmo nome e o
  mesmo conteúdo, o espaço utilizado do dono não muda, e quem já tinha concessão
  sobre ele continua tendo

#### Scenario: Mover arquivo para a raiz da unidade
- **WHEN** o dono de um arquivo o move informando destino nulo
- **THEN** o arquivo passa a residir na raiz da unidade

#### Scenario: Mover não desloca bytes nem emite URL assinada
- **WHEN** um arquivo é movido entre pastas
- **THEN** o objeto correspondente no storage permanece no mesmo caminho e nenhuma
  URL assinada é emitida pela operação

#### Scenario: Quem não é dono nem administrador não move
- **WHEN** uma pessoa sem alcance sobre o arquivo tenta movê-lo, ainda que possua
  concessão `rename` sobre ele
- **THEN** a ação é bloqueada com aviso de permissão insuficiente e o arquivo
  permanece onde estava

#### Scenario: Destino sem alcance é recusado
- **WHEN** o dono de um arquivo tenta movê-lo para uma pasta de outra pessoa sobre
  a qual não é administrador, mesmo possuindo concessão `upload` sobre ela
- **THEN** a ação é recusada e o arquivo permanece onde estava

#### Scenario: Arquivo na lixeira não é movido
- **WHEN** o arquivo a mover, ou a pasta de destino, está na lixeira
- **THEN** a ação é recusada como se o recurso não existisse

### Requirement: Mover arquivos em lote

O sistema SHALL permitir que **vários arquivos** sejam movidos para um mesmo
destino numa única operação, em `POST /files/move`, recebendo um conjunto de
identificadores e a pasta de destino. Destino ausente ou nulo SHALL significar a
**raiz da unidade**. A rota por item (`POST /files/:id/move`) SHALL permanecer
disponível e inalterada.

Cada arquivo do conjunto SHALL ser submetido exatamente às mesmas regras da
movimentação por item — alcance **dono OU administrador da unidade** resolvido
sem consultar concessões, preservação de nome, dono, conteúdo, identificador,
`object_path`, cota e concessões, e nenhum byte deslocado nem URL assinada
emitida. O lote NÃO SHALL introduzir nenhuma permissão, isenção ou verificação
que a operação por item não tenha.

A operação SHALL distinguir **pré-condição global** de **falha por item**:

- SHALL recusar o lote inteiro, sem mover nenhum arquivo, quando o número de
  identificadores exceder o teto configurado, quando o conjunto vier vazio, e
  quando a pasta de destino for inexistente, de outra unidade, estiver na
  lixeira ou estiver fora do alcance de quem pede.
- SHALL mover os demais arquivos quando **um item individual** for recusado por
  falta de alcance, por não existir, por pertencer a outra unidade ou por estar
  na lixeira.

A resposta SHALL informar um **veredito por identificador**, distinguindo os
movidos com sucesso dos recusados e o motivo de cada recusa. Informar o motivo
por item NÃO SHALL ser considerado vazamento de existência: diferentemente da
concessão a vários colaboradores, cujos identificadores podem ser informados às
cegas, os identificadores de um lote de movimentação provêm de uma listagem que
a própria API já autorizou e devolveu a quem pede.

A recusa por pré-condição global SHALL ser fail-closed e indistinguível entre os
casos de destino — inexistente, de outra unidade, na lixeira ou sem alcance
SHALL produzir a mesma resposta. Referência: PRD US 2.4; design.md D1/D2 do
change `mover-itens-em-lote`.

#### Scenario: Lote movido com sucesso preserva conteúdo, cota e concessões
- **WHEN** o dono de vários arquivos os move para uma mesma pasta própria numa
  única operação
- **THEN** todos passam a residir no destino com os mesmos nomes e conteúdos, o
  espaço utilizado de cada dono não muda, e quem já tinha concessão sobre cada
  arquivo continua tendo

#### Scenario: Item sem alcance é recusado sem derrubar os demais
- **WHEN** um lote contém um arquivo sobre o qual quem pede não tem alcance
- **THEN** os demais arquivos do lote são movidos, o arquivo sem alcance
  permanece onde estava, e a resposta indica qual identificador foi recusado e
  por quê

#### Scenario: Destino sem alcance derruba o lote inteiro
- **WHEN** a pasta de destino está fora do alcance de quem pede
- **THEN** nenhum arquivo do lote é movido e a operação é recusada por inteiro

#### Scenario: Destino de outra unidade é indistinguível de destino inexistente
- **WHEN** a pasta de destino informada pertence a outra unidade
- **THEN** a operação é recusada por inteiro com a mesma resposta de um destino
  inexistente

#### Scenario: Teto de itens por operação
- **WHEN** o conjunto informado excede o teto configurado de itens por operação
- **THEN** a operação é recusada por inteiro com um aviso próprio de teto
  excedido, distinguível de uma recusa por permissão, e nenhum arquivo é movido

#### Scenario: Lote para a raiz da unidade
- **WHEN** vários arquivos são movidos informando destino nulo
- **THEN** todos passam a residir na raiz da unidade

#### Scenario: Lote não desloca bytes nem emite URL assinada
- **WHEN** um lote de arquivos é movido
- **THEN** os objetos correspondentes no storage permanecem nos mesmos caminhos e
  nenhuma URL assinada é emitida pela operação

### Requirement: Registro de auditoria da movimentação de arquivo

O sistema SHALL registrar na auditoria um evento de **movimentação** a cada
arquivo efetivamente movido, identificando quem moveu e quando, na unidade do
arquivo. O evento NÃO SHALL ser registrado quando a operação é recusada.

Numa movimentação **em lote**, o sistema SHALL registrar um evento por arquivo
efetivamente movido e NÃO SHALL registrar evento algum para os itens recusados
dentro do mesmo lote, ainda que os demais tenham sido movidos com sucesso. Um
lote inteiramente recusado por pré-condição global NÃO SHALL registrar nenhum
evento.

A movimentação de **pasta** e a renomeação de **pasta** NÃO SHALL gerar evento de
auditoria, em coerência com a criação de pasta, que também não gera: a auditoria
deste produto registra acesso, destruição e alteração de conteúdo, não
reorganização da árvore. Isso SHALL valer igualmente para a movimentação de
pastas em lote. A consulta de auditoria por arquivo SHALL permanecer restrita
aos eventos de **acesso**, sem passar a expor o evento de movimentação.
Referência: design.md D6 do change `mover-e-renomear-itens`; design.md D6 do
change `mover-itens-em-lote`.

#### Scenario: Mover arquivo é auditado
- **WHEN** um arquivo é movido com sucesso
- **THEN** fica registrado um evento de movimentação daquele arquivo, com o autor e
  o instante da operação

#### Scenario: Recusa não gera evento
- **WHEN** uma tentativa de mover é recusada por falta de alcance
- **THEN** nenhum evento de movimentação é registrado

#### Scenario: Lote parcialmente recusado audita apenas os movidos
- **WHEN** um lote move três arquivos com sucesso e tem um quarto recusado por
  falta de alcance
- **THEN** ficam registrados exatamente três eventos de movimentação, nenhum
  deles referente ao arquivo recusado

#### Scenario: Lote recusado por pré-condição global não audita nada
- **WHEN** um lote é recusado por destino sem alcance ou por teto excedido
- **THEN** nenhum evento de movimentação é registrado para nenhum dos
  identificadores informados

#### Scenario: Operação sobre pasta não gera evento
- **WHEN** uma pasta é movida ou renomeada com sucesso
- **THEN** nenhum evento de auditoria é registrado para a pasta nem para os
  arquivos contidos nela

#### Scenario: Consulta de auditoria do arquivo não muda
- **WHEN** o dono consulta a auditoria de um arquivo que já foi movido
- **THEN** vê apenas os eventos de acesso, sem que a movimentação apareça na
  consulta
