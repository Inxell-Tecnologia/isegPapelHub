# Spec Delta

## ADDED Requirements

### Requirement: Resposta de conteúdo informa a contagem de documentos de cada subpasta, filtrada pelo acesso

A rota de navegação SHALL informar, em cada subpasta listada, quantos documentos **diretamente** dentro dela o solicitante veria ao abrir aquela pasta naquele instante. A contagem SHALL obedecer ao mesmo recorte da listagem de conteúdo — fora da lixeira; dono, administrador da unidade do recurso ou concessão vigente de visualização sobre o **próprio documento**, sem herança da pasta; documento obsoleto só para o administrador da unidade; documento pendente de cadastro só para quem o enviou ou administra a unidade — com a vigência avaliada pelo relógio do banco. NÃO SHALL contar documento de outra unidade, inclusive para o administrador global, e NÃO SHALL existir contagem para pasta que o solicitante não pode abrir. Documentos de subpastas não entram na contagem. Referência: `docs/demanda_cliente_3.md`, item 7; PRD US 11.1 (cenário 3), US 4.1, US 4.3, US 5.1, US 10.7 e US 10.9.

#### Scenario: A contagem é igual ao que a pasta mostra ao ser aberta
- **WHEN** uma pessoa solicita o conteúdo de uma pasta e, em seguida, o conteúdo
  de uma das subpastas listadas
- **THEN** a contagem informada para essa subpasta é igual ao número de
  documentos apresentados ao abri-la

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
- **WHEN** a concessão de visualização de um documento expira
- **THEN** a contagem da pasta que o contém deixa de incluí-lo na requisição
  seguinte, sem depender de rotina agendada

#### Scenario: Documento na lixeira não é contado
- **WHEN** um documento de uma pasta é excluído para a lixeira
- **THEN** a contagem da pasta deixa de incluí-lo para qualquer solicitante,
  inclusive o administrador da unidade

#### Scenario: Obsoleto e pendente de cadastro seguem a listagem
- **WHEN** uma pasta contém um documento obsoleto e um pendente de cadastro
- **THEN** o administrador da unidade vê os dois contados, quem enviou o
  pendente o vê contado, e um terceiro com concessão de visualização sobre eles
  não vê nenhum dos dois contado

#### Scenario: Administrador global conta só a própria unidade
- **WHEN** o administrador global solicita o conteúdo da raiz da sua unidade
- **THEN** cada contagem considera apenas documentos da sua unidade, e pastas de
  outras unidades não aparecem nem são contadas

#### Scenario: Subpastas não entram na contagem
- **WHEN** uma pasta contém apenas subpastas com documentos
- **THEN** a contagem dessa pasta é zero
