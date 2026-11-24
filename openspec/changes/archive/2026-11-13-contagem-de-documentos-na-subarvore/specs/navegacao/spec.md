# Spec Delta

## ADDED Requirements

### Requirement: Resposta de conteúdo informa, por subpasta, a contagem de documentos da subárvore alcançável pelo solicitante

A rota de navegação SHALL informar, em cada subpasta listada, quantos documentos o solicitante pode abrir **dentro dela, incluindo as subpastas que ele pode abrir**, contando em cada pasta alcançada o mesmo recorte da listagem de documentos e podando a subpasta sem acesso com toda a sua descendência. NÃO SHALL contar nada de outra unidade nem de pasta que o solicitante não pode abrir. Referência: PRD US 11.1 (cenário 3), US 4.1, US 4.3, US 5.1, US 10.7, US 10.9.

#### Scenario: A contagem é a soma do que a pessoa encontra navegando
- **WHEN** uma pessoa solicita o conteúdo de uma pasta e, em seguida, o conteúdo
  de uma das subpastas listadas
- **THEN** a contagem informada para essa subpasta é igual ao número de
  documentos apresentados ao abri-la somado às contagens informadas para as
  subpastas que aparecem dentro dela

#### Scenario: Documentos de subpastas entram na soma
- **WHEN** uma pasta contém apenas subpastas com documentos que o solicitante
  pode abrir
- **THEN** a contagem dessa pasta é a soma desses documentos

#### Scenario: Subpasta sem acesso fica fora da soma
- **WHEN** uma pasta visível contém uma subpasta que o solicitante não pode
  abrir, ainda que ele tenha concessão de visualização sobre documentos dentro
  dela
- **THEN** os documentos dessa subpasta não entram na contagem da pasta, sem
  revelar a existência deles

#### Scenario: A poda vale para toda a descendência
- **WHEN** abaixo de uma subpasta que o solicitante não pode abrir existe outra
  subpasta, com documentos, que ele poderia abrir
- **THEN** nem essa subpasta nem seus documentos entram na contagem

#### Scenario: Concessão sobre a pasta não faz contar os documentos dela
- **WHEN** uma pessoa com concessão de visualização apenas sobre uma pasta de
  outra pessoa, que contém documentos, solicita o conteúdo da pasta-mãe
- **THEN** a pasta aparece com contagem zero

#### Scenario: Documento sem acesso não é contado
- **WHEN** uma pasta visível contém documentos dos quais o solicitante só pode
  visualizar parte
- **THEN** a contagem informa apenas os documentos que ele pode visualizar, sem
  revelar a existência dos demais

#### Scenario: Concessão expirada deixa de contar na requisição seguinte
- **WHEN** a concessão de visualização de um documento ou de uma subpasta
  expira
- **THEN** a contagem deixa de incluir o documento, ou o ramo daquela subpasta,
  na requisição seguinte, sem depender de rotina agendada

#### Scenario: Documento ou subpasta na lixeira não é contado
- **WHEN** um documento, ou uma subpasta com documentos, é excluído para a
  lixeira
- **THEN** a contagem deixa de incluí-lo para qualquer solicitante, inclusive o
  administrador da unidade

#### Scenario: Obsoleto e pendente de cadastro seguem a listagem
- **WHEN** uma pasta ou uma de suas subpastas contém um documento obsoleto e um
  pendente de cadastro
- **THEN** o administrador da unidade vê os dois contados, quem enviou o
  pendente o vê contado, e um terceiro com concessão de visualização sobre eles
  não vê nenhum dos dois contado

#### Scenario: Administrador global conta só a própria unidade
- **WHEN** o administrador global solicita o conteúdo da raiz da sua unidade
- **THEN** cada contagem considera apenas pastas e documentos da sua unidade, e
  pastas de outras unidades não aparecem nem são contadas

#### Scenario: Estrutura inconsistente não trava a requisição
- **WHEN** a cadeia de pastas em torno da pasta solicitada contém um ciclo
- **THEN** a requisição termina, sem laço infinito na contagem

## REMOVED Requirements

### Requirement: Resposta de conteúdo informa a contagem de documentos de cada subpasta, filtrada pelo acesso

**Reason**: O requisito contava só os documentos **diretos** de cada subpasta
(design.md D2 do change `contagem-de-documentos-nas-pastas`) e tinha um
cenário afirmando que documentos de subpastas não entram na conta — a decisão
ficou registrada como pendência a validar com o cliente. O cliente pediu a soma
de tudo o que está dentro da pasta, incluindo as subpastas, restrita ao que a
pessoa pode abrir; o cenário "Subpastas não entram na contagem" e a igualdade
com a listagem direta deixam de descrever o comportamento.

**Migration**: Substituído pelo requisito "Resposta de conteúdo informa, por
subpasta, a contagem de documentos da subárvore alcançável pelo solicitante",
que mantém o mesmo campo e todos os cortes de acesso (lixeira, sem herança,
vigência, obsoleto, pendente de cadastro, escopo da unidade) e acrescenta a
descida pelas subpastas que o solicitante pode abrir, com poda das demais e de
toda a sua descendência. O contrato da resposta não muda; clientes não precisam
de ajuste.
