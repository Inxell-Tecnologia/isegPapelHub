# Spec Delta

## ADDED Requirements

### Requirement: Acompanhamento por marcação, com os números de 3.5

Quem tem algo a acompanhar — quem criou marcações, gestor do setor ou da
unidade, ou quem acompanha todas as unidades — SHALL ter a aba
**Acompanhamento**, com cada marcação ao seu alcance: unidade, documento,
revisão, prazo, se está em curso ou encerrada, e, sobre as pessoas do seu
alcance, o **público**, os **confirmados**, **pendentes**, **atrasados**,
**encerradas** e a **% de adesão** (confirmados sobre o público). Pessoa
desativada NÃO SHALL contar nem aparecer. Quem não tem nada a acompanhar NÃO
SHALL ver a aba. Referência: PRD US 12.6; demanda do cliente nº 2, seções 3.3
(desligamento) e 3.5.

#### Scenario: Publicador vê os números da marcação que criou
- **WHEN** o publicador marcou um documento para quatro pessoas e duas
  confirmaram, uma está atrasada e uma pendente
- **THEN** vê o público 4, confirmados 2, pendentes 1, atrasados 1 e adesão de
  50%

#### Scenario: Desativado sai do cálculo
- **WHEN** uma pessoa do público é desativada
- **THEN** ela deixa de contar no público e na adesão, e some da lista nominal

#### Scenario: Sem nada a acompanhar, sem aba
- **WHEN** um colaborador que não marcou nada e não é gestor abre Leitura
  obrigatória
- **THEN** vê só Pendentes e Concluídas

### Requirement: Três recortes de alcance no acompanhamento

O acompanhamento SHALL ser recortado no servidor: o **publicador** vê as
marcações que criou, com o público inteiro; o **gestor do setor** vê as
marcações da própria unidade, só com as pessoas do seu setor; o **gestor da
unidade** vê as marcações da própria unidade, com o público inteiro; quem
**acompanha todas as unidades** vê as marcações de todas as unidades, com o
público inteiro. Os recortes SHALL somar por união. O alcance de quem consulta
SHALL ser relido a cada requisição. Marcação fora do recorte, inclusive de
outra unidade, SHALL ser recusada como inexistente. Referência: PRD US 12.6;
demanda do cliente nº 2, seção 3.5 (nota de visibilidade).

#### Scenario: Gestor do setor vê só a equipe
- **WHEN** o gestor do setor CME abre o relatório de uma marcação da unidade
  dirigida a pessoas da CME e da UTI
- **THEN** vê só as pessoas da CME, e os números só delas

#### Scenario: Gestor não vê marcação de outra unidade
- **WHEN** o gestor da unidade pede o relatório de uma marcação de outra unidade
- **THEN** a resposta é a mesma de uma marcação inexistente

#### Scenario: Governança vê todas as unidades
- **WHEN** a pessoa com acompanhamento de todas as unidades abre a aba
- **THEN** vê as marcações das outras unidades, com o público inteiro e a
  unidade de cada pessoa

#### Scenario: Perder a marcação de gestor corta o acompanhamento
- **WHEN** a marcação de gestor de uma pessoa é retirada
- **THEN** na requisição seguinte ela não vê mais as marcações que via por ela

### Requirement: Relatório nominal com filtros e exportação

O relatório de uma marcação SHALL listar as pessoas do recorte com nome,
unidade, setor — o do momento da ciência, para quem confirmou —, situação,
prazo e data e hora da ciência; SHALL permitir filtrar por unidade, setor e
situação; e SHALL exportar em **Excel** e em **PDF** o que está filtrado, com o
documento, a revisão, os filtros aplicados e os números. A exportação SHALL ser
montada no navegador. Referência: PRD US 12.6; demanda do cliente nº 2, seção
3.5 (Acompanhamento).

#### Scenario: Filtrar por situação
- **WHEN** a pessoa filtra o relatório por Atrasada
- **THEN** a lista mostra só as pessoas atrasadas

#### Scenario: Exportar o que está filtrado
- **WHEN** a pessoa filtra por um setor e exporta em Excel ou PDF
- **THEN** o arquivo traz só as pessoas daquele setor, com o documento, a
  revisão, o filtro aplicado e os números
