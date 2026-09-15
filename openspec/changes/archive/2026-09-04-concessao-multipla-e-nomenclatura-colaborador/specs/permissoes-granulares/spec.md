## MODIFIED Requirements

### Requirement: Concessão de permissão por pessoa sobre pasta ou arquivo

O sistema SHALL permitir que um administrador conceda a **um ou mais
colaboradores**, numa única operação, um ou mais verbos de permissão (`view`,
`download`, `upload`, `rename`, `delete`) sobre um recurso, sendo o recurso uma
**pasta** ou um **arquivo** identificado por seu id. A operação SHALL registrar o
**produto** dos destinatários informados pelos verbos informados — uma linha por
`(colaborador, recurso, verbo)` —, de forma **idempotente**: reconceder um verbo
já concedido não SHALL criar duplicata nem falhar. A concessão SHALL registrar
quem concedeu. Conceder apenas um verbo (ex.: `view`) NÃO SHALL implicar os
demais verbos nem acesso a outros itens, e conceder a um colaborador NÃO SHALL
implicar acesso a nenhum outro.

A operação SHALL ser **atômica**: ou todas as concessões da requisição são
efetivadas, ou nenhuma é. Destinatários repetidos numa mesma requisição SHALL
produzir o mesmo resultado que uma única menção — a operação converge para o
estado pedido, sem duplicar linha nem falhar.

A operação SHALL ser recusada **integralmente**, sem efetivar nenhuma concessão,
quando **qualquer** destinatário informado não existir ou pertencer a outra
unidade, e a recusa NÃO SHALL indicar qual destinatário motivou a recusa nem
distinguir "não existe" de "é de outra unidade" — recusa parcial ou discriminada
permitiria descobrir a existência de contas por observação. A mesma recusa
indistinguível SHALL valer para o recurso inexistente ou de outra unidade.

O sistema SHALL impor um **teto de destinatários por requisição** e recusar, sem
efetivar nenhuma concessão, a requisição que o exceda, com um erro identificável
que a distinga das demais recusas. A requisição sem destinatário algum SHALL ser
recusada como requisição inválida.

A concessão SHALL admitir um **prazo de expiração opcional**, aplicado
igualmente a todas as concessões da operação. Ausência de prazo SHALL significar
concessão **permanente**, que vale até ser revogada manualmente — preservando o
comportamento de toda concessão anterior a esta mudança, sem necessidade de
conversão de dados. O prazo SHALL ser informado por operação, e verbos e
destinatários distintos numa mesma operação SHALL receber o mesmo prazo.

Reconceder um verbo já concedido SHALL fazer o **prazo informado passar a valer**,
seja ele mais distante ou mais próximo que o vigente — o último ato administrativo
prevalece. Reconceder **sem informar prazo** um verbo que possuía prazo SHALL
torná-lo permanente. Em nenhum desses casos a reconcessão SHALL duplicar a linha
ou falhar, e ela SHALL atualizar o registro de quem concedeu, de modo que a trilha
reflita quem alterou o prazo. Referência: PRD US 4.1, cenário 1; US 4.3;
design.md D3 do change `expiracao-permissoes`.

#### Scenario: Concessão de um único verbo sobre arquivos selecionados
- **WHEN** um administrador concede apenas `view` a um colaborador sobre um ou
  mais arquivos selecionados
- **THEN** o colaborador passa a poder visualizar exatamente aqueles arquivos, sem
  receber `download`/`rename`/`delete` nem acesso a outros itens da mesma pasta

#### Scenario: Concessão simultânea a vários colaboradores
- **WHEN** um administrador concede, numa única requisição, um conjunto de verbos
  a vários colaboradores sobre o mesmo recurso
- **THEN** cada colaborador informado passa a ter cada verbo informado sobre
  aquele recurso, e nenhum outro colaborador recebe acesso

#### Scenario: Concessão a vários colaboradores é atômica
- **WHEN** uma requisição de concessão a vários colaboradores falha ao ser
  efetivada
- **THEN** nenhuma das concessões da requisição fica registrada, nem para os
  destinatários processados antes da falha

#### Scenario: Destinatário inválido recusa a requisição inteira
- **WHEN** um administrador informa vários destinatários e um deles não existe ou
  pertence a outra unidade
- **THEN** a requisição é recusada por completo, nenhum dos demais destinatários
  recebe concessão, e a recusa não identifica qual destinatário a motivou nem
  distingue inexistência de pertencimento a outra unidade

#### Scenario: Teto de destinatários por requisição
- **WHEN** um administrador informa mais destinatários do que o teto por
  requisição
- **THEN** a requisição é recusada com um erro identificável de teto excedido e
  nenhuma concessão é efetivada

#### Scenario: Destinatário repetido na mesma requisição
- **WHEN** um administrador informa o mesmo colaborador mais de uma vez na mesma
  requisição
- **THEN** a operação conclui sem erro e o colaborador fica com uma única linha
  por verbo, sem duplicação

#### Scenario: Reconceder é idempotente
- **WHEN** um administrador concede um verbo que o colaborador já possui sobre o
  mesmo recurso
- **THEN** a permissão permanece registrada uma única vez, sem erro e sem duplicação

#### Scenario: Concessão de múltiplos verbos numa só operação
- **WHEN** um administrador concede, numa única requisição, um conjunto de verbos a
  um colaborador sobre um recurso
- **THEN** cada verbo do conjunto é registrado para aquele colaborador e recurso, e
  qualquer verbo já existente é preservado sem duplicação

#### Scenario: Concessão sem prazo é permanente
- **WHEN** um administrador concede um verbo sem informar prazo de expiração
- **THEN** a concessão vale até ser revogada manualmente

#### Scenario: Concessão com prazo registra o vencimento
- **WHEN** um administrador concede um verbo informando um prazo de expiração
- **THEN** a concessão é registrada com esse vencimento e vale até que ele seja
  atingido

#### Scenario: Prazo informado vale para todos os destinatários da operação
- **WHEN** um administrador concede verbos com prazo de expiração a vários
  colaboradores numa única requisição
- **THEN** todas as concessões criadas recebem o mesmo vencimento informado

#### Scenario: Reconceder com novo prazo estende o acesso
- **WHEN** um administrador reconcede, com prazo mais distante, um verbo que o
  colaborador já possuía com prazo
- **THEN** o novo prazo passa a valer, sem duplicar a concessão

#### Scenario: Reconceder com prazo mais próximo encurta o acesso
- **WHEN** um administrador reconcede, com prazo mais próximo, um verbo que o
  colaborador já possuía
- **THEN** o novo prazo passa a valer, encurtando o acesso

#### Scenario: Reconceder sem prazo torna a concessão permanente
- **WHEN** um administrador reconcede, sem informar prazo, um verbo que o
  colaborador possuía com prazo de expiração
- **THEN** a concessão passa a ser permanente
