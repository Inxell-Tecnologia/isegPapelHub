# Spec Delta

## ADDED Requirements

### Requirement: Listagem do explorador apresenta os dados de controle

A SPA SHALL apresentar, por documento listado, a etiqueta do tipo com sua
sigla, a revisão, o setor responsável, a data de próxima revisão e a situação
apurada pelo servidor. A SPA NÃO SHALL recalcular a situação por conta própria
— SHALL apresentar a que o servidor devolveu. Dado ausente SHALL ser
apresentado como ausência explícita, nunca como valor presumido.

#### Scenario: Documento controlado exibe seus dados na linha
- **WHEN** uma pessoa abre uma pasta que contém um documento com dados de
  controle registrados
- **THEN** a linha apresenta sigla do tipo, revisão, responsável, data de
  próxima revisão e situação

#### Scenario: Documento sem dados não inventa valores
- **WHEN** uma pessoa abre uma pasta que contém um arquivo sem dados de controle
- **THEN** os campos correspondentes aparecem vazios e a situação apresentada é
  Sem controle de revisão

#### Scenario: A situação apresentada é a do servidor
- **WHEN** o servidor devolve a situação de um documento
- **THEN** a SPA apresenta exatamente essa situação, sem recalculá-la a partir
  da data e do relógio do dispositivo

### Requirement: Dados de controle são editáveis a partir do explorador

A SPA SHALL oferecer, no explorador, o caminho para preencher ou corrigir os
dados de controle de um documento, apresentando-o apenas a quem tem a permissão
exigida pelo servidor. A ação NÃO SHALL ser oferecida a quem o servidor
recusaria.

#### Scenario: Quem pode substituir pode editar os dados
- **WHEN** uma pessoa com permissão de substituir um documento abre suas ações
  no explorador
- **THEN** encontra a ação de editar os dados de controle

#### Scenario: Sem permissão, a ação não é oferecida
- **WHEN** uma pessoa sem permissão de substituir um documento abre suas ações
  no explorador
- **THEN** a ação de editar os dados de controle não é apresentada
