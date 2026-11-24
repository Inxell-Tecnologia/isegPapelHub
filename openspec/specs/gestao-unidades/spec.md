# gestao-unidades Specification

## Purpose

Define os requisitos verificáveis da gestão de unidades (tenants) do GDoc pelo
administrador global — criação, listagem, renomeação e ativação/desativação de
unidades via as rotas `/units`, sempre com o servidor como único guardião e
coerente com a RLS da tabela `units`. Implementa o Épico 1 / US 1.1 e o papel de
administração global da US 5.1 do PRD (`docs/prd_final.md`); os cenários
Given/When/Then dessas US são vinculantes e este spec os torna verificáveis no
backend.

## Requirements

### Requirement: Gestão de unidades restrita ao administrador global

O sistema SHALL expor rotas de gestão de unidades — `POST /units` (criar), `GET /units` (listar) e `PATCH /units/:id` (renomear e/ou alterar status) — acessíveis **apenas** a `global_admin`. Qualquer chamada de `unit_admin` ou `collaborator` a essas rotas SHALL ser recusada com permissão insuficiente (403). O isolamento é imposto no servidor (único guardião), coerente com a policy RLS de `units` que já libera o ramo `global_admin`. Referência: PRD US 1.1, US 5.1.

#### Scenario: global_admin cria unidade

- **WHEN** um `global_admin` chama `POST /units` com um nome ainda não utilizado
- **THEN** a unidade é criada com status ativo e passa a poder receber pessoas

#### Scenario: unit_admin não gerencia unidades

- **WHEN** um `unit_admin` chama qualquer rota de `/units` (criar, listar ou alterar)
- **THEN** a ação é recusada com permissão insuficiente (403)

#### Scenario: collaborator não gerencia unidades

- **WHEN** um `collaborator` chama qualquer rota de `/units`
- **THEN** a ação é recusada com permissão insuficiente (403)

### Requirement: Nome de unidade único

O sistema SHALL garantir que o nome da unidade seja único. Criar (`POST /units`) ou renomear (`PATCH /units/:id`) para um nome já usado por outra unidade SHALL ser recusado com conflito (409), sem alterar dado algum.

#### Scenario: Criação com nome duplicado é recusada

- **WHEN** um `global_admin` cria uma unidade com um nome que já existe
- **THEN** a criação é recusada com conflito (409) e nenhuma unidade é criada

#### Scenario: Renomear para nome existente é recusado

- **WHEN** um `global_admin` renomeia uma unidade para um nome já usado por outra
- **THEN** a operação é recusada com conflito (409) e o nome não é alterado

### Requirement: Renomear unidade

O sistema SHALL permitir que o `global_admin` renomeie uma unidade via `PATCH /units/:id`, respeitando a unicidade de nome. A renomeação SHALL preservar todo o conteúdo, as pessoas e a auditoria da unidade (apenas o rótulo muda).

#### Scenario: Renomeação bem-sucedida

- **WHEN** um `global_admin` renomeia uma unidade para um nome ainda não utilizado
- **THEN** a unidade passa a exibir o novo nome, com pessoas e conteúdo inalterados

### Requirement: Desativar e reativar unidade

O sistema SHALL permitir que o `global_admin` altere o status de uma unidade via `PATCH /units/:id`. Desativar (`status` para desativado) SHALL ser permitido **apenas quando nenhuma pessoa estiver vinculada à unidade**; havendo ao menos uma pessoa vinculada, a operação SHALL ser recusada com conflito (409, "unidade não está vazia"), sem alterar o status. Reativar (`status` para ativo) SHALL ser sempre permitido. Desativar SHALL ser reversível e não-destrutivo: nenhum dado de pessoa, conteúdo ou auditoria é apagado ou alterado. Referência: design.md D2.

#### Scenario: Desativar unidade vazia

- **WHEN** um `global_admin` desativa uma unidade sem nenhuma pessoa vinculada
- **THEN** a unidade passa a status desativado e some das listagens de unidades ativas

#### Scenario: Desativar unidade com pessoas é recusado

- **WHEN** um `global_admin` tenta desativar uma unidade que ainda tem pessoas vinculadas
- **THEN** a operação é recusada com conflito (409, "unidade não está vazia") e o status permanece ativo

#### Scenario: Reativar unidade

- **WHEN** um `global_admin` reativa uma unidade desativada
- **THEN** a unidade volta a status ativo e a poder receber pessoas

### Requirement: Proteção do auto-trancamento e da unidade de bootstrap

O sistema SHALL recusar desativar a unidade do próprio contexto autenticado do `global_admin` e a unidade de bootstrap, como defesa em profundidade — mesmo que a precondição de "unidade vazia" já as proteja (o próprio administrador está vinculado à sua unidade, e o bootstrap hospeda o primeiro administrador). A recusa SHALL ser um erro de operação inválida, sem alterar o status. Referência: design.md D3.

#### Scenario: global_admin não desativa a própria unidade

- **WHEN** um `global_admin` tenta desativar a unidade à qual ele mesmo pertence
- **THEN** a operação é recusada e o status da unidade permanece ativo

#### Scenario: Unidade de bootstrap não é desativável

- **WHEN** um `global_admin` tenta desativar a unidade de bootstrap
- **THEN** a operação é recusada e o status da unidade permanece ativo

### Requirement: Listagem de unidades para seleção

O sistema SHALL prover `GET /units` retornando as unidades para uso administrativo (inclusive para o seletor de unidade no cadastro de pessoas). A listagem SHALL permitir obter apenas as unidades **ativas** quando destinada ao cadastro, para que não se aloque pessoa em unidade desativada. Cada item SHALL trazer ao menos identificador, nome e status.

#### Scenario: Listagem para o seletor traz só unidades ativas

- **WHEN** o cadastro de pessoas solicita as unidades disponíveis para seleção
- **THEN** a resposta inclui as unidades ativas e não inclui as desativadas

### Requirement: Marcação da unidade SEDE

O `global_admin` SHALL poder marcar e desmarcar uma unidade como SEDE, e
SHALL existir no máximo uma unidade marcada. Marcar uma segunda unidade
enquanto outra está marcada SHALL ser recusado com 409
`headquarters_already_set`. Desativar a unidade marcada como SEDE SHALL ser
recusado com 409 enquanto a marcação existir. A identidade da SEDE (id e
nome) SHALL ser legível por qualquer unidade, por não ser conteúdo. Nenhum
outro papel SHALL alterar a marcação. Referência: PRD US 5.2; design.md
D11.

#### Scenario: Marcar a SEDE
- **WHEN** o `global_admin` marca a unidade "Sede ISETES" como SEDE e nenhuma
  outra está marcada
- **THEN** a unidade passa a constar como SEDE na listagem de unidades

#### Scenario: Segunda SEDE é recusada
- **WHEN** o `global_admin` tenta marcar outra unidade enquanto a SEDE já
  está marcada
- **THEN** a resposta é 409 `headquarters_already_set` e nada muda

#### Scenario: SEDE marcada não é desativada
- **WHEN** o `global_admin` tenta desativar a unidade marcada como SEDE
- **THEN** a resposta é 409 e a unidade continua ativa

#### Scenario: Administrador de unidade não altera a marcação
- **WHEN** um `unit_admin` tenta marcar ou desmarcar a SEDE
- **THEN** a resposta é 403
