# Spec — gestao-arquivos (delta)

Capability existente. O ciclo de vida do arquivo cobria **renomear** e
**substituir por nova versão** (US 2.2); esta mudança acrescenta **mover entre
pastas**, implementando a **US 2.3** do PRD (`docs/prd_final.md`) no lado do
arquivo. O mover de **pasta**, a recusa de ciclo e a unicidade de nome são
normatizados pela capability `navegacao`. Ver design.md D1/D2/D6.

## ADDED Requirements

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
design.md D1/D2.

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

### Requirement: Registro de auditoria da movimentação de arquivo

O sistema SHALL registrar na auditoria um evento de **movimentação** a cada
arquivo efetivamente movido, identificando quem moveu e quando, na unidade do
arquivo. O evento NÃO SHALL ser registrado quando a operação é recusada.

A movimentação de **pasta** e a renomeação de **pasta** NÃO SHALL gerar evento de
auditoria, em coerência com a criação de pasta, que também não gera: a auditoria
deste produto registra acesso, destruição e alteração de conteúdo, não
reorganização da árvore. A consulta de auditoria por arquivo SHALL permanecer
restrita aos eventos de **acesso**, sem passar a expor o evento de movimentação.
Referência: design.md D6.

#### Scenario: Mover arquivo é auditado
- **WHEN** um arquivo é movido com sucesso
- **THEN** fica registrado um evento de movimentação daquele arquivo, com o autor e
  o instante da operação

#### Scenario: Recusa não gera evento
- **WHEN** uma tentativa de mover é recusada por falta de alcance
- **THEN** nenhum evento de movimentação é registrado

#### Scenario: Operação sobre pasta não gera evento
- **WHEN** uma pasta é movida ou renomeada com sucesso
- **THEN** nenhum evento de auditoria é registrado para a pasta nem para os
  arquivos contidos nela

#### Scenario: Consulta de auditoria do arquivo não muda
- **WHEN** o dono consulta a auditoria de um arquivo que já foi movido
- **THEN** vê apenas os eventos de acesso, sem que a movimentação apareça na
  consulta
