# setores Specification

## Purpose

Define o **setor** como entidade cadastrada por unidade — lista fechada à qual
cada pessoa é vinculada por referência — para que setor sirva de critério
confiável de público e de recorte de relatório, e não apenas de texto exibido.
Substitui a área de trabalho em texto livre, que o cliente confirmou ser o mesmo
conceito (`docs/respostas_a1_funcao_e_setor.txt`, respostas 5 (a) e 6 (a)).

## Requirements

### Requirement: Setor é entidade da unidade, com nome único nela

O sistema SHALL manter setores como entidades **pertencentes a uma unidade**,
cada uma com nome próprio. Dentro de uma mesma unidade, o nome SHALL ser único
**sem distinção de caixa nem de espaços nas extremidades**, de modo que o mesmo
setor não possa existir duas vezes escrito de formas diferentes. Duas unidades
distintas SHALL poder ter setores de nome igual, sem relação entre si.

#### Scenario: Setor repetido na mesma unidade é recusado
- **WHEN** a administração tenta cadastrar, na mesma unidade, um setor cujo nome
  já existe ali — ainda que com caixa diferente ou espaços sobrando
- **THEN** o cadastro é recusado indicando que o nome já está em uso na unidade,
  e nenhum setor novo é criado

#### Scenario: Mesmo nome em unidades diferentes é permitido
- **WHEN** duas unidades cadastram, cada uma, um setor com o mesmo nome
- **THEN** os dois setores existem de forma independente, e o vínculo de uma
  pessoa a um deles não a relaciona ao outro

### Requirement: Setor nunca atravessa a fronteira da unidade

O setor SHALL ser dado de unidade e, como tal, SHALL carregar a coluna `unit_id`
e a policy de RLS que o isola, como qualquer tabela tenant-scoped do sistema. O
vínculo de uma pessoa a um setor SHALL ser recusado quando o setor pertencer a
outra unidade, e essa recusa SHALL ser imposta **também pelo banco**, não apenas
pela aplicação. A recusa SHALL ser fail-closed: setor inexistente e setor de
outra unidade SHALL ser indistinguíveis na resposta.

#### Scenario: Pessoa não é vinculada a setor de outra unidade
- **WHEN** a administração tenta vincular uma pessoa a um setor que pertence a
  outra unidade
- **THEN** a operação é recusada sem alterar o cadastro da pessoa, com a mesma
  resposta que um setor inexistente produziria

#### Scenario: Listagem de setores não revela outra unidade
- **WHEN** uma pessoa com papel de administração consulta os setores de sua
  unidade
- **THEN** recebe somente os setores daquela unidade, sem nome, contagem ou
  existência de setor de qualquer outra

### Requirement: Manutenção da lista de setores restrita à administração

O sistema SHALL permitir que apenas papéis de administração mantenham a lista de
setores — cadastrar, renomear e remover. `unit_admin` SHALL manter somente os
setores da **própria** unidade; `global_admin` SHALL manter os de qualquer
unidade. `collaborator` NÃO SHALL cadastrar, renomear nem remover setor, e a
recusa SHALL vir do servidor.

#### Scenario: Colaborador não mantém a lista
- **WHEN** uma pessoa com papel `collaborator` tenta cadastrar, renomear ou
  remover um setor
- **THEN** a ação é bloqueada com resposta de permissão insuficiente, e a lista
  permanece inalterada

#### Scenario: Administrador de unidade mantém só a própria
- **WHEN** um `unit_admin` tenta cadastrar ou renomear um setor em unidade que
  não é a sua
- **THEN** a ação é recusada fail-closed, sem revelar o que existe na outra
  unidade

#### Scenario: Renomear padroniza a escrita sem perder os vínculos
- **WHEN** a administração renomeia um setor para a grafia oficial da unidade
- **THEN** o nome novo passa a ser exibido em toda superfície que o apresenta, e
  as pessoas vinculadas a ele permanecem vinculadas

### Requirement: Setor com pessoas vinculadas não é removido

O sistema SHALL recusar a remoção de um setor ao qual ainda haja **pessoa
vinculada**, informando o impedimento, e SHALL preservar o setor e os vínculos.
A remoção SHALL ser permitida apenas quando nenhuma pessoa aponta para ele.
Nenhuma remoção SHALL desvincular pessoas em silêncio.

#### Scenario: Remoção de setor em uso é recusada
- **WHEN** a administração tenta remover um setor que ainda tem pessoas
  vinculadas
- **THEN** a remoção é recusada informando que há pessoas no setor, e nenhum
  vínculo é desfeito

#### Scenario: Remoção de setor vazio é concluída
- **WHEN** a administração remove um setor sem nenhuma pessoa vinculada
- **THEN** o setor deixa de existir e de ser oferecido no cadastro de pessoas

### Requirement: Pessoa pode não ter setor

O sistema SHALL tratar "sem setor" como estado válido de uma pessoa, em qualquer
momento do seu cadastro. Toda superfície que apresenta o setor SHALL omiti-lo
quando ausente, sem rótulo vazio, sem espaço reservado e sem valor inventado.

#### Scenario: Cadastro sem setor é aceito
- **WHEN** a administração cadastra ou edita uma pessoa sem informar setor
- **THEN** a operação é concluída e a pessoa fica sem setor, sem bloqueio

#### Scenario: Superfície omite o setor ausente
- **WHEN** uma pessoa sem setor é apresentada em qualquer superfície que exiba
  setor
- **THEN** o setor simplesmente não aparece, sem rótulo vazio nem texto
  substituto

### Requirement: A área de trabalho já cadastrada vira setor sem perda

A migração para setor por referência SHALL preservar o que já estava cadastrado
como área de trabalho: cada valor distinto por unidade SHALL passar a existir
como setor daquela unidade, e cada pessoa SHALL permanecer associada ao seu —
agora por referência. Pessoa sem área de trabalho preenchida SHALL ficar sem
setor. NÃO SHALL haver pessoa cujo setor se perca na transição.

#### Scenario: Cada pessoa mantém o setor que tinha escrito
- **WHEN** a migração é aplicada a um acervo em que pessoas têm área de trabalho
  preenchida
- **THEN** cada uma passa a apontar para um setor de sua unidade com aquele
  nome, e nenhuma fica sem setor por efeito da migração

#### Scenario: Grafias divergentes nascem como setores distintos, para padronização
- **WHEN** a mesma unidade tinha grafias diferentes para o mesmo setor
  (por exemplo "Governança" e "Gov.")
- **THEN** cada grafia nasce como um setor, cabendo à administração renomear e
  reagrupar — a migração não funde nomes por conta própria
