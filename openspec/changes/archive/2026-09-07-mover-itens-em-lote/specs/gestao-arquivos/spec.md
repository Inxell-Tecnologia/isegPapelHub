## ADDED Requirements

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

## MODIFIED Requirements

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
