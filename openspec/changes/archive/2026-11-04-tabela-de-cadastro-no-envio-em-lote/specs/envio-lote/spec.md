# envio-lote — delta

## ADDED Requirements

### Requirement: Conflito de código recusa só o seu item no envio em lote

O sistema SHALL recusar, em `POST /files/upload-urls`, **apenas o item** cujo
código de documento já pertença a outro documento não excluído da mesma unidade,
emitindo URL normalmente para os demais itens do lote. A recusa SHALL trazer
erro próprio do conflito de código, distinguível do erro de cota e do erro de
dado inválido, e NÃO SHALL revelar dado algum de documento de outra unidade.
Referência: PRD US 10.2, US 3.1; `controle-documental` ("Código do documento é
único dentro da unidade").

#### Scenario: Item com código do acervo é recusado sem derrubar o lote
- **WHEN** um lote traz um item cujo código já pertence a outro documento ativo
  da mesma unidade, e os demais itens são válidos
- **THEN** só aquele item é recusado, com erro próprio de conflito de código, e
  os demais recebem suas URLs

#### Scenario: Código existente apenas em outra unidade não conflita
- **WHEN** um item do lote traz código que existe somente em outra unidade
- **THEN** o item é aceito, sem que qualquer informação do documento homônimo
  seja revelada

### Requirement: Dois itens do mesmo lote não podem declarar o mesmo código

O sistema SHALL recusar, **por item**, o segundo e os seguintes itens de um
mesmo lote que declarem um código já declarado por outro item **daquele lote**,
ainda que nenhum deles exista no acervo no momento da requisição. Referência:
PRD US 10.2, US 3.1; design.md D6 do change
`arquivo-geral-e-pendente-de-cadastro`.

#### Scenario: Dois itens com o mesmo código no mesmo lote
- **WHEN** um lote traz dois itens declarando o mesmo código e outros itens
  válidos
- **THEN** o primeiro é aceito, o segundo é recusado com erro de conflito de
  código, e os itens válidos recebem suas URLs

#### Scenario: Colisão interna não derruba o lote inteiro
- **WHEN** dois itens do mesmo lote colidem em código
- **THEN** nenhum item válido do lote deixa de receber a sua URL, e a operação
  não é recusada por inteiro

#### Scenario: Diferença só de caixa é a mesma colisão
- **WHEN** dois itens do mesmo lote declaram o mesmo código diferindo apenas em
  maiúsculas e minúsculas
- **THEN** a colisão é reconhecida e o segundo item é recusado, em vez de ambos
  serem aceitos e colidirem na gravação

### Requirement: Código preso a envio pendente de quem pede é retomada, não conflito

O sistema SHALL tratar como **retomada** da mesma publicação o item cujo código
esteja ocupado por um arquivo ainda não reconciliado (`pending`) **do próprio
solicitante**, reaproveitando aquela linha em vez de recusar o item por
conflito. Referência: PRD US 3.1 ("nova tentativa apenas do item que falhou"),
US 10.2.

#### Scenario: Repetir um item cujo envio falhou não é conflito de código
- **WHEN** a transferência de um item do lote falha e a pessoa reenvia aquele
  arquivo com o mesmo código
- **THEN** o item é aceito como retomada da mesma publicação, sem recusa por
  conflito de código

#### Scenario: A retomada não troca o identificador do arquivo
- **WHEN** um item é aceito como retomada
- **THEN** o arquivo mantém o mesmo identificador, de modo que nenhum aviso
  duplicado é emitido e nenhuma concessão ou registro de auditoria perde o seu
  alvo

#### Scenario: Código preso a envio pendente de outra pessoa continua conflito
- **WHEN** um item declara código ocupado por um envio ainda não reconciliado de
  **outra** pessoa
- **THEN** o item é recusado com erro de conflito de código, sem ser tratado
  como retomada
