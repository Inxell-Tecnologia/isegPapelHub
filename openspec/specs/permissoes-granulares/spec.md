# permissoes-granulares Specification

## Purpose

Define os requisitos verificáveis do motor de concessão de permissões
granulares (`grants`) do GDoc, na fatia do Épico 4 / **US 4.1** do PRD
(`docs/prd_final.md`), na fatia **por pessoa** (grupo é fatia futura — ver
design.md D7 do change `epico-4-permissoes-granulares`). Os cenários
Given/When/Then da US são vinculantes; os requisitos abaixo os tornam
verificáveis no backend. A UI de gestão de permissões é consumo do contrato
pelo frontend e está fora desta fatia. Referência de verbos: visualizar,
baixar, enviar, renomear/substituir, excluir.

## Requirements

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

### Requirement: Ausência de herança para o conteúdo interno de pastas

Conceder um verbo sobre uma **pasta** SHALL liberar apenas a própria pasta, e NÃO
SHALL propagar nenhum verbo para os arquivos ou subpastas contidos nela. Cada item
interno só SHALL ficar acessível se tiver recebido uma concessão explícita própria
(ou pertencer à pessoa). A resolução de permissão NÃO SHALL derivar acesso de um
recurso ancestral. Referência: PRD US 4.1, cenário 2.

#### Scenario: Grant em pasta não expõe os arquivos internos
- **WHEN** uma pessoa recebe `view` sobre uma pasta que contém arquivos de outra
  pessoa, sem grant sobre esses arquivos
- **THEN** ela pode abrir a pasta, mas os arquivos internos não aparecem para ela e
  ela não consegue visualizá-los nem baixá-los

#### Scenario: Liberação explícita de um item interno
- **WHEN** além do grant sobre a pasta, a pessoa recebe `view` sobre um arquivo
  específico dentro dela
- **THEN** apenas aquele arquivo passa a ser acessível, enquanto os demais itens da
  pasta continuam ocultos

### Requirement: Gestão de concessões restrita à administração

Os endpoints que **administram** as concessões de um recurso — conceder, listar as
concessões daquele recurso e revogar — SHALL ser acessíveis apenas a `unit_admin` e
`global_admin`; um `collaborator` que os invoque SHALL receber 403.
`unit_admin` SHALL operar somente sobre recursos e pessoas da própria unidade (a RLS
por `unit_id` é a garantia final, mesmo que a checagem de papel falhasse), enquanto
`global_admin` SHALL ter alcance sobre todas as unidades. Conceder sobre um recurso
inexistente ou de outra unidade, ou a uma pessoa inexistente ou de outra unidade,
SHALL ser recusado sem vazar a existência do recurso/pessoa. Revogar um verbo SHALL
remover a linha correspondente, sem afetar os demais verbos nem os registros de
auditoria de acessos já ocorridos.

A listagem de concessões de um recurso SHALL informar, para cada concessão, o seu
**prazo de expiração** quando houver, e SHALL **distinguir concessões vigentes de
concessões expiradas**. Uma concessão expirada SHALL permanecer registrada e
visível na listagem, marcada como expirada — **expirar não é revogar**: o
vencimento torna a concessão inerte para efeito de acesso, mas preserva a trilha
de que aquela pessoa teve aquele acesso e até quando, de modo que registros de
auditoria anteriores permaneçam interpretáveis. Apenas a revogação SHALL remover a
concessão do registro. Referência: PRD US 4.1; US 4.3; Épico 5 (isolamento);
design.md D2 do change `expiracao-permissoes`.

Ler as **próprias** concessões recebidas é operação **auto-escopada**, distinta de
administrar as de um recurso, e SHALL estar disponível a qualquer papel
autenticado, inclusive `collaborator`. Essa leitura SHALL limitar-se às concessões
cuja destinatária é quem consulta, e NÃO SHALL revelar concessão de terceiro, quem
a concedeu a terceiro, nem a existência de recurso fora do alcance de quem
consulta. A RLS por `unit_id` permanece a garantia final. Ver capability
`compartilhados-comigo`.

#### Scenario: Colaborador não pode conceder
- **WHEN** um `collaborator` tenta conceder uma permissão
- **THEN** a operação é recusada com 403 e nenhuma concessão é criada

#### Scenario: Administrador de unidade não concede fora da própria unidade
- **WHEN** um `unit_admin` tenta conceder permissão sobre um recurso de outra
  unidade
- **THEN** a operação é recusada sem revelar a existência do recurso e nenhuma
  concessão é criada

#### Scenario: Revogação remove apenas o verbo indicado
- **WHEN** um administrador revoga um verbo que uma pessoa possuía sobre um recurso
- **THEN** aquele verbo deixa de valer para a pessoa, os outros verbos que ela
  possuía sobre o mesmo recurso permanecem, e a auditoria de acessos anteriores é
  preservada

#### Scenario: Listagem informa o vencimento e o estado da concessão
- **WHEN** um administrador lista as concessões de um recurso que tem concessões
  permanentes, com prazo futuro e já vencidas
- **THEN** vê o prazo de cada uma que o possui e distingue as vigentes das
  expiradas

#### Scenario: Concessão expirada permanece registrada
- **WHEN** o prazo de uma concessão é atingido
- **THEN** a concessão continua aparecendo na listagem, marcada como expirada, em
  vez de desaparecer do registro

#### Scenario: Revogar remove o registro, ao contrário de expirar
- **WHEN** um administrador revoga uma concessão expirada
- **THEN** a concessão deixa de constar da listagem

#### Scenario: Colaborador lê as próprias concessões recebidas
- **WHEN** um `collaborator` consulta as concessões vigentes de que é destinatário
- **THEN** a consulta é atendida, limitada às concessões em que ele próprio é o
  destinatário

#### Scenario: A leitura auto-escopada não alcança concessão de terceiro
- **WHEN** uma pessoa consulta as próprias concessões recebidas enquanto existem
  concessões vigentes de outras pessoas sobre os mesmos recursos
- **THEN** vê apenas as suas, sem nenhuma indicação de que outra pessoa tenha
  acesso àqueles recursos

### Requirement: Concessão comum restrita a pessoas da unidade do recurso

A concessão de permissão granular (`POST /grants`) SHALL aceitar como
destinatárias apenas pessoas da mesma unidade do recurso. Quando qualquer
destinatária for de outra unidade, a requisição SHALL ser recusada por
inteiro com 422 `cross_unit_subject`, sem gravar concessão alguma. Isso
substitui a gravação de concessão sem efeito. O compartilhamento entre
unidades segue regras próprias (capability
`compartilhamento-entre-unidades`). Referência: PRD US 5.2, cenário 8;
design.md D10.

#### Scenario: Administradora Global concede a pessoa de outra unidade
- **WHEN** a `global_admin` da SEDE concede `view` sobre uma pasta da SEDE a
  uma pessoa da Unidade Norte pela concessão comum
- **THEN** a resposta é 422 `cross_unit_subject` e nenhuma concessão é
  gravada

#### Scenario: Lote misto é recusado por inteiro
- **WHEN** a concessão comum lista uma pessoa da unidade do recurso e outra
  de unidade diferente
- **THEN** a resposta é 422 `cross_unit_subject` e nenhuma das duas recebe
  concessão

#### Scenario: Concessões sem efeito pré-existentes
- **WHEN** a migração do change é aplicada sobre uma base com concessões
  comuns cuja pessoa é de outra unidade
- **THEN** as de `view`/`download` passam a ser compartilhamentos entre
  unidades por pessoa, com o mesmo prazo, e todas deixam de constar em
  `grants`

### Requirement: Concessões automáticas por autoria convivem com as manuais

O sistema SHALL registrar as concessões automáticas por autoria (capability `posse-e-autoria`) como concessões comuns, identificadas como automáticas por autoria na listagem de concessões do recurso. Elas SHALL valer na resolução de acesso como qualquer concessão, SHALL poder ser revogadas por quem administra concessões e NÃO SHALL gerar aviso ao autor.

#### Scenario: Listagem identifica a concessão automática
- **WHEN** um administrador lista as concessões de uma subpasta criada por um
  colaborador na pasta de Daniel
- **THEN** vê as concessões do colaborador marcadas como automáticas por autoria,
  sem prazo de expiração

#### Scenario: Revogação de concessão automática
- **WHEN** um administrador revoga o verbo `view` automático do autor sobre um item
- **THEN** o autor deixa de ver o item na requisição seguinte, e os demais verbos e
  a autoria registrada permanecem

#### Scenario: Concessão automática não notifica
- **WHEN** um colaborador cria uma subpasta na pasta de Daniel
- **THEN** nenhum aviso de nova concessão é gerado para o colaborador

#### Scenario: Concessão manual posterior não é rebaixada
- **WHEN** um administrador concede manualmente um verbo que o autor já tinha por
  autoria
- **THEN** a operação é idempotente e o verbo continua valendo para o autor
