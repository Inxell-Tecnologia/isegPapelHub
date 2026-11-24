# web-navegacao — delta

## MODIFIED Requirements

### Requirement: Listagem do explorador apresenta os dados de controle

A SPA SHALL apresentar, por documento listado, a etiqueta do tipo com sua
sigla, a revisão, o setor responsável, a data de próxima revisão e a situação
apurada pelo servidor. A SPA NÃO SHALL recalcular a situação por conta própria
— SHALL apresentar a que o servidor devolveu. Dado ausente SHALL ser
apresentado como ausência explícita, nunca como valor presumido. O arquivo
pendente de cadastro SHALL ser apresentado com etiqueta própria, e o Arquivo
geral SHALL ser apresentado sem situação de revisão.

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

#### Scenario: Arquivo pendente de cadastro é identificado como tal
- **WHEN** quem enviou um arquivo pendente de cadastro, ou um administrador da
  unidade, abre a pasta que o contém
- **THEN** a linha apresenta a etiqueta Pendente de cadastro, distinguível da
  situação Sem controle de revisão

#### Scenario: Arquivo geral não apresenta situação de revisão
- **WHEN** uma pessoa abre uma pasta que contém arquivo do tipo Arquivo geral
- **THEN** a linha apresenta a sigla do tipo e nenhuma situação de revisão, com
  código, revisão e data de próxima revisão como ausência explícita

#### Scenario: Situação desconhecida não quebra a listagem
- **WHEN** o servidor devolve uma situação que a SPA não reconhece
- **THEN** a linha é apresentada com tratamento neutro para aquele valor, sem
  impedir a apresentação do restante da listagem
