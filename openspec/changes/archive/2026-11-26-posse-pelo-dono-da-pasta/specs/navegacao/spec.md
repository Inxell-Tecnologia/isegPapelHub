# Spec Delta

## MODIFIED Requirements

### Requirement: Pastas aninhadas por unidade

O sistema SHALL permitir que uma pessoa autenticada crie pastas em `POST /folders`,
na raiz da sua unidade ou dentro de outra pasta da qual seja dona, que administre
ou sobre a qual tenha concessão `upload` vigente, formando uma hierarquia aninhada.
Toda pasta SHALL ser vinculada à unidade (`unit_id`) e ao dono (`owner_id`,
definido pela capability `posse-e-autoria`), e o isolamento entre unidades SHALL
ser imposto no banco por RLS, não apenas na aplicação. Referência: PRD US 2.1.

#### Scenario: Criação de pasta na raiz
- **WHEN** uma pessoa cria uma pasta sem informar pasta-pai
- **THEN** a pasta é criada na raiz da sua unidade, vinculada a ela e ao criador como
  dono

#### Scenario: Criação de subpasta dentro de pasta própria
- **WHEN** uma pessoa cria uma pasta informando como pai uma pasta da qual é dona
- **THEN** a nova pasta é criada como filha dela, preservando o aninhamento

#### Scenario: Criação de subpasta com concessão de envio na pasta-pai
- **WHEN** uma pessoa cria uma pasta informando como pai uma pasta de outra pessoa
  sobre a qual tem concessão `upload` vigente
- **THEN** a nova pasta é criada como filha dela, com o dono da pasta-pai como dono
  e a pessoa que criou como autora

#### Scenario: Administrador da unidade cria subpasta em pasta de outra pessoa
- **WHEN** um administrador da unidade cria uma pasta informando como pai uma pasta
  de outra pessoa da mesma unidade
- **THEN** a nova pasta é criada como filha dela, com o dono da pasta-pai como dono

#### Scenario: Sem concessão de envio na pasta-pai alheia
- **WHEN** uma pessoa sem posse, sem administração e sem concessão `upload` vigente
  tenta criar uma subpasta na pasta de outra pessoa
- **THEN** a operação é recusada com 403 e nenhuma pasta é criada, de forma
  indistinguível da pasta-pai inexistente ou de outra unidade

#### Scenario: Concessão de envio expirada não autoriza
- **WHEN** uma pessoa cuja concessão `upload` sobre a pasta-pai já expirou tenta
  criar uma subpasta nela
- **THEN** a operação é recusada com 403 e nenhuma pasta é criada

#### Scenario: Pasta-pai de outra unidade não é utilizável
- **WHEN** uma pessoa tenta criar uma subpasta apontando para uma pasta-pai de outra
  unidade
- **THEN** a operação é recusada e nenhuma pasta é criada, sem revelar a existência
  da pasta de outra unidade

#### Scenario: Caracteres especiais no nome não são motivo de recusa
- **WHEN** uma pessoa autorizada cria uma pasta cujo nome contém acentos, `°` ou `/`
  (por exemplo, `PRESTAÇÃO DE CONTAS - TF N° 001/2025`)
- **THEN** a pasta é criada com o nome informado, como uma única pasta

## ADDED Requirements

### Requirement: Resposta de conteúdo informa se o solicitante é dono da pasta corrente

O sistema SHALL informar, na resposta de conteúdo de uma pasta, se o solicitante é o dono dela, para que a SPA saiba se um envio para ela consome o espaço do próprio solicitante. Na raiz da unidade a resposta SHALL indicar posse do solicitante. A informação NÃO SHALL revelar dado de cota do dono.

#### Scenario: Pasta própria
- **WHEN** o dono de uma pasta consulta o conteúdo dela
- **THEN** a resposta indica que ele é o dono

#### Scenario: Pasta de outra pessoa com concessão
- **WHEN** um colaborador com `view` sobre a pasta de Daniel consulta o conteúdo dela
- **THEN** a resposta indica que ele não é o dono, sem informar cota ou consumo de
  Daniel
