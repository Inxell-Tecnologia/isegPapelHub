# painel Specification

## Purpose

Define os requisitos verificáveis do painel gerencial (lado de leitura) do uso
do repositório, na fatia do Épico 8 / **US 8.2** do PRD (`docs/prd_final.md`,
RF #14). Uma consulta agregada única entrega, ao administrador, os cartões de
estatística e os três gráficos — quantidade de arquivos por tipo, envios por mês
e espaço utilizado versus disponível — numa leitura consistente. O alcance
(global ou de unidade) é imposto pela RLS por `unit_id` das tabelas agregadas, e
não por checagem na aplicação; a consulta é restrita a administradores. O bloco
de espaço deriva do mesmo contador que governa a cota de 10 GB por pessoa
(**US 8.1**, entregue nas capabilities `envio-lote`/`gestao-arquivos`), que este
painel apenas lê.

## Requirements

### Requirement: Painel gerencial agregado de uso

O sistema SHALL expor uma consulta agregada (lado de leitura) do uso do
repositório para o administrador, numa única resposta e numa leitura consistente
(mesmo snapshot), cobrindo **US 8.2** (`docs/prd_final.md`, RF #14). A resposta
SHALL conter:

- **Cartões de estatística** com os números principais no alcance do
  solicitante: total de arquivos ativos, total de pessoas, espaço utilizado e
  percentual da cota consumido.
- **Arquivos por tipo**: a quantidade de arquivos por categoria de tipo
  (imagens, vídeos, áudios, PDFs, documentos de escritório, texto e outros).
- **Envios por mês**: a quantidade de arquivos enviados por mês ao longo dos
  últimos 12 meses, com os meses sem envio representados por zero, em ordem
  cronológica.
- **Espaço utilizado versus disponível**: o espaço utilizado, a cota por pessoa,
  a quantidade de pessoas e os derivados de capacidade total e espaço disponível.

As contagens e o espaço SHALL considerar apenas arquivo vivo e efetivo
(ativo e não excluído); arquivos com upload incompleto (`pending`/`over_quota`)
e itens na lixeira NÃO SHALL entrar em nenhuma métrica. O mesmo critério de
"arquivo" SHALL valer para todos os blocos, de modo que os cartões e os gráficos
sejam coerentes entre si.

#### Scenario: Painel acessível pelo administrador (US 8.2 cenário 1)
- **WHEN** um administrador solicita o painel
- **THEN** o sistema retorna os cartões de estatística e os três gráficos —
  arquivos por tipo, envios por mês e espaço utilizado versus disponível —
  dentro do seu alcance

#### Scenario: Envios por mês com meses vazios
- **WHEN** o administrador solicita o painel e em alguns dos últimos 12 meses não
  houve nenhum envio
- **THEN** a série de envios por mês contém uma entrada para cada um dos 12
  meses, com zero nos meses sem envio, em ordem cronológica

#### Scenario: Itens incompletos ou na lixeira não entram nas métricas
- **WHEN** existem arquivos com upload incompleto (`pending`/`over_quota`) ou
  itens na lixeira no alcance do administrador
- **THEN** esses itens não são contados em nenhum cartão nem gráfico, e o espaço
  utilizado reflete apenas conteúdo efetivamente armazenado

### Requirement: Alcance do painel imposto pela unidade

O painel SHALL refletir exatamente o alcance do solicitante: o administrador de
unidade (`unit_admin`) SHALL ver os agregados **somente da sua unidade**, e o
administrador global (`global_admin`) SHALL ver o consolidado de **todas as
unidades**. O isolamento por unidade SHALL apoiar-se na RLS por `unit_id` das
tabelas agregadas (`files`, `users`, `audit_events`), não apenas em checagem na
aplicação: nenhum dado de outra unidade SHALL compor os agregados de um
`unit_admin`.

#### Scenario: Administrador de unidade vê apenas a própria unidade
- **WHEN** um administrador de unidade solicita o painel
- **THEN** os cartões e os gráficos refletem somente os arquivos, pessoas e
  espaço da sua unidade, sem incluir dados de outras unidades

#### Scenario: Administrador global vê o consolidado
- **WHEN** um administrador global solicita o painel
- **THEN** os cartões e os gráficos agregam os dados de todas as unidades

### Requirement: Painel restrito a administradores

A consulta do painel SHALL ser autorizada apenas para administradores
(`unit_admin` ou `global_admin`). Um colaborador (`collaborator`) NÃO SHALL
acessar o painel; a solicitação SHALL ser negada.

#### Scenario: Colaborador não acessa o painel
- **WHEN** um colaborador solicita o painel
- **THEN** o sistema nega o acesso e não retorna nenhum agregado

### Requirement: Espaço utilizado consistente com a cota

O bloco de espaço do painel SHALL derivar do mesmo contador que governa o
bloqueio de envio da cota por pessoa (US 8.1): o espaço utilizado SHALL ser a
soma do espaço consumido por pessoa (`storage_used_bytes`) no alcance, a
capacidade total SHALL ser a **soma das cotas efetivas** das pessoas no alcance
— a exceção nominal de quem a tiver, o padrão da plataforma para as demais
(capability `cota-individual`) — e o espaço disponível SHALL ser a capacidade
total menos o utilizado (nunca negativo). O painel NÃO SHALL alterar a regra de
cota; apenas a lê.

A capacidade NÃO SHALL ser obtida multiplicando uma cota única pela quantidade
de pessoas, pois isso deixaria de refletir a capacidade real assim que existisse
qualquer exceção nominal no alcance. O painel SHALL continuar informando a cota
padrão da plataforma como referência, distinta da capacidade total.

#### Scenario: Espaço utilizado versus disponível
- **WHEN** o administrador solicita o painel
- **THEN** o bloco de espaço apresenta o utilizado e o disponível a partir do
  espaço consumido por pessoa e das cotas efetivas do alcance, de forma coerente
  com o limite que bloqueia novos envios

#### Scenario: Alcance sem pessoas
- **WHEN** o alcance do solicitante não contém nenhuma pessoa
- **THEN** a capacidade total e o percentual da cota são zero, sem erro de
  divisão

#### Scenario: Exceção nominal é somada à capacidade
- **WHEN** uma pessoa do alcance tem exceção nominal de cota
- **THEN** a capacidade total do painel reflete a cota dessa pessoa, e não o
  padrão da plataforma aplicado a ela
