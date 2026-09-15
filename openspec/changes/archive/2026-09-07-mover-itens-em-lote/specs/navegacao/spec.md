## ADDED Requirements

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
