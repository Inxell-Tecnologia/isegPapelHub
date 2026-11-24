# Spec Delta

## MODIFIED Requirements

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
