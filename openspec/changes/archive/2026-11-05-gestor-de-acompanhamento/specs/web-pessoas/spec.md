# Spec Delta

## ADDED Requirements

### Requirement: Formulário e listagem apresentam o acompanhamento de leituras

O formulário de cadastro e edição de pessoa SHALL oferecer o campo de
acompanhamento de leituras, com as opções "Não acompanha", "Gestor do setor",
"Gestor da unidade" e — apenas para o administrador global — "Gestor de todas
as unidades". A listagem SHALL apresentar o alcance de cada pessoa pelo mesmo
rótulo. A recusa por falta de setor SHALL ser apresentada com a explicação, sem
perder o que foi preenchido. Referência: PRD US 12.1; capability
`nomenclatura-interface` ("Gestor" reservado a este papel).

#### Scenario: Administrador da unidade não vê a opção de todas as unidades
- **WHEN** um administrador da unidade abre o campo de acompanhamento
- **THEN** encontra "Não acompanha", "Gestor do setor" e "Gestor da unidade", e
  não encontra "Gestor de todas as unidades"

#### Scenario: Listagem mostra o alcance
- **WHEN** a listagem apresenta uma pessoa marcada como gestora do setor
- **THEN** a linha dela exibe "Gestor do setor"

#### Scenario: Recusa por falta de setor é explicada
- **WHEN** o servidor recusa a marcação de gestor do setor por falta de setor
- **THEN** o formulário explica que é preciso escolher um setor, e o
  preenchimento é preservado
