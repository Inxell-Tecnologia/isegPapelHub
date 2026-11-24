# isolamento-unidade Specification

## Purpose

Define os requisitos verificáveis do isolamento entre unidades (tenants) na
fatia do **Épico 5 / US 5.1** do PRD (`docs/prd_final.md`): o alcance
administrativo positivo do `unit_admin` restrito à própria unidade, a garantia
de que o `collaborator` nunca enxerga outra unidade, e o isolamento de
conteúdo do `global_admin` por unidade com preservação de agregados
cross-unit para o painel de gestão (Épico 8). Os cenários Given/When/Then das
US são vinculantes. A imposição SHALL ter a RLS por `unit_id` como fronteira
dura no banco (defesa em profundidade), com a autorização de aplicação por
cima — a checagem de aplicação NÃO SHALL ser a única barreira.

## Requirements

### Requirement: Alcance administrativo positivo restrito à própria unidade

O `unit_admin` SHALL ver e gerir apenas os recursos da **sua** unidade —
pessoas, pastas, arquivos e permissões —, e NÃO SHALL alcançar recurso algum de
outra unidade por nenhuma via (navegação, listagem, busca ou link direto por
id). Dentro da sua unidade, o `unit_admin` SHALL acessar e listar qualquer
pasta ou arquivo independentemente de posse ou grant, derivando o alcance
**exclusivamente** de `role` + `unit_id` do contexto autenticado (relidos do
servidor a cada requisição), nunca de valor informado pelo solicitante.
Referência: PRD Épico 5 / US 5.1, cenário 1; design.md D1/D5.

#### Scenario: unit_admin gere e acessa conteúdo da própria unidade
- **WHEN** um `unit_admin` abre a área administrativa e o conteúdo da sua
  unidade
- **THEN** vê e pode gerir as pessoas, pastas, arquivos e permissões da sua
  unidade, inclusive itens que não criou nem lhe foram concedidos

#### Scenario: unit_admin não alcança outra unidade
- **WHEN** um `unit_admin` tenta acessar, listar ou gerir um recurso de outra
  unidade, mesmo conhecendo seu identificador
- **THEN** o acesso é negado com 403 e a resposta não revela o conteúdo nem a
  existência do recurso

#### Scenario: alcance não é forjável pelo solicitante
- **WHEN** um `unit_admin` tenta informar uma unidade diferente da sua em
  qualquer requisição
- **THEN** o alcance permanece a sua própria unidade (derivado do contexto
  autenticado), e o valor informado é ignorado

### Requirement: Colaborador nunca enxerga outra unidade

O `collaborator` NÃO SHALL alcançar arquivos, pastas ou metadados de
unidade diferente da sua, nem por navegação, nem por busca, nem por link
direto ao identificador de um recurso, **salvo** o conteúdo alcançado por
compartilhamento entre unidades vigente (capability
`compartilhamento-entre-unidades`, PRD US 5.2). Esse alcance é somente
leitura e restrito ao que foi compartilhado. Este isolamento SHALL ser
imposto pela RLS por `unit_id` como fronteira dura no banco, com a
autorização de aplicação por cima; a checagem de aplicação NÃO SHALL ser a
única barreira. A leitura de conteúdo compartilhado de outra unidade SHALL
acontecer apenas em transação de visita confinada pela RLS à unidade de
origem. Referência: PRD Épico 5 / US 5.1, cenário 2; US 5.2; NFR de
confidencialidade.

#### Scenario: navegação não revela outra unidade
- **WHEN** um `collaborator` navega pelos arquivos e pastas
- **THEN** nunca aparece nenhum item pertencente a outra unidade, exceto o
  conteúdo de compartilhamento entre unidades vigente, alcançado a partir de
  "Compartilhados comigo"

#### Scenario: link direto a recurso de outra unidade
- **WHEN** um `collaborator` aciona a rota de um arquivo ou pasta de outra
  unidade usando o identificador direto, sem compartilhamento entre unidades
  vigente que o cubra
- **THEN** recebe 403, sem conteúdo nem pré-visualização, e a resposta não
  distingue "não existe" de "existe em outra unidade"

#### Scenario: conteúdo compartilhado entre unidades
- **WHEN** um `collaborator` pede a visualização de um arquivo de outra
  unidade coberto por compartilhamento entre unidades vigente com o verbo
  `view`
- **THEN** a URL de visualização é emitida e o acesso é auditado na unidade
  de origem

### Requirement: Isolamento de conteúdo do global_admin por unidade, com agregados cross-unit

O `global_admin` SHALL acessar **conteúdo** (bytes de arquivo, listagem de
itens) apenas dentro da unidade do seu contexto (`resource.unit_id ==
ctx.unitId`), pela mesma regra de admin-da-unidade — o bypass de RLS do papel
`global_admin` NÃO SHALL, por si só, liberar acesso a bytes ou listagem de
itens de outra unidade. O bypass de RLS SHALL permanecer disponível apenas para
**agregados** (contagens e somas de painel, Épico 8), nunca para devolver bytes
ou itens individuais de outra unidade. Referência: revisão da decisão D6 do
change `epico-4-permissoes-granulares`; design.md D3.

#### Scenario: global_admin não emite URL de conteúdo cross-unit
- **WHEN** um `global_admin` solicita a URL de visualização ou download de um
  arquivo que pertence a uma unidade diferente da sua e sobre o qual não tem
  grant nem posse
- **THEN** o acesso é negado com 403, nenhuma URL assinada é emitida e nenhum
  registro de auditoria é gravado

#### Scenario: global_admin acessa conteúdo da própria unidade como admin
- **WHEN** um `global_admin` solicita a URL de um arquivo da sua própria unidade
- **THEN** o acesso é concedido pelo ramo admin-da-unidade e auditado
  normalmente

#### Scenario: agregados de painel permanecem cross-unit
- **WHEN** um `global_admin` consulta contagens/somas agregadas sobre todas as
  unidades (painel)
- **THEN** os agregados abrangem todas as unidades via bypass de RLS, sem expor
  bytes nem itens individuais de outra unidade
