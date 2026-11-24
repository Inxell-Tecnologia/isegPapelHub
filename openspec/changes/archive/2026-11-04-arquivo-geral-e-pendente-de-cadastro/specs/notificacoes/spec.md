# notificacoes — delta

## ADDED Requirements

### Requirement: Arquivo que fica pendente de cadastro avisa quem o enviou

O sistema SHALL notificar quem enviou um arquivo que ficou pendente de cadastro,
no canal da própria pessoa, identificando o arquivo a completar. O evento de
origem SHALL ser o **arquivo**, de modo que o mesmo arquivo não gere aviso
repetido. A falha ao notificar NÃO SHALL impedir a conclusão do envio.
Referência: PRD US 10.9.

#### Scenario: Quem enviou é avisado do arquivo a completar
- **WHEN** um arquivo é enviado sem os dados de controle exigidos e fica pendente
  de cadastro
- **THEN** quem o enviou recebe, no seu canal de notificações, um aviso que
  identifica o arquivo cujos dados faltam

#### Scenario: Repetir a transferência do mesmo arquivo não duplica o aviso
- **WHEN** a transferência de um arquivo que ficou pendente de cadastro é
  repetida, ou a emissão de URL para ele é solicitada outra vez
- **THEN** nenhum aviso novo é criado para o mesmo arquivo e o aviso existente é
  preservado

#### Scenario: Cada arquivo pendente de um lote gera o seu próprio aviso
- **WHEN** um lote é enviado e vários dos seus arquivos ficam pendentes de
  cadastro
- **THEN** quem enviou é avisado de cada arquivo pendente, sem que os avisos de
  um lote se confundam entre si

#### Scenario: Arquivo publicado com os dados completos não gera aviso
- **WHEN** um arquivo é enviado com todos os dados de controle exigidos, ou
  declarado Arquivo geral
- **THEN** nenhum aviso de pendência de cadastro é criado

#### Scenario: Falha ao avisar não impede o envio
- **WHEN** a emissão do aviso de pendência de cadastro falha
- **THEN** o envio do arquivo conclui normalmente e o arquivo permanece pendente
  de cadastro

#### Scenario: Aviso não atravessa unidade
- **WHEN** um arquivo de uma unidade fica pendente de cadastro
- **THEN** o aviso alcança apenas quem o enviou, no canal da sua própria
  unidade, sem ser alcançável por pessoa de outra unidade
