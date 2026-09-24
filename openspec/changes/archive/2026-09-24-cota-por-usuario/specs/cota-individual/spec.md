# Spec Delta

## Purpose

Define a **cota efetiva** de armazenamento de cada pessoa — a exceção nominal
quando houver uma concedida, o padrão da plataforma quando não houver — e quem
pode conceder essa exceção, de modo que liberar espaço a uma pessoa não exija
afrouxar o limite de todas.

## ADDED Requirements

### Requirement: Cota efetiva por pessoa

O sistema SHALL determinar a cota de armazenamento de cada pessoa a partir da
**exceção nominal** registrada para ela, quando houver, e do **padrão da
plataforma** quando não houver. A cota efetiva SHALL ser a mesma em todos os
pontos que decidem sobre espaço — consulta do próprio espaço, emissão de URL de
envio avulso, emissão de URLs de envio em lote, substituição de versão,
reconciliação de upload finalizado e capacidade agregada do painel —, sem que
qualquer ponto aplique um limite próprio.

A ausência de exceção SHALL ser um estado explícito e distinto de uma exceção
cujo valor coincida com o padrão: alterar o padrão da plataforma SHALL alcançar
imediatamente toda pessoa sem exceção, e NÃO SHALL alterar o limite de quem tem
exceção. Referência: PRD US 8.1 (adendo de exceção nominal).

#### Scenario: Pessoa sem exceção segue o padrão da plataforma

- **WHEN** o sistema avalia o espaço de uma pessoa para a qual nenhuma exceção
  foi concedida
- **THEN** a cota considerada é o padrão da plataforma vigente naquela
  implantação

#### Scenario: Exceção nominal prevalece sobre o padrão

- **WHEN** o sistema avalia o espaço de uma pessoa com exceção nominal concedida
- **THEN** a cota considerada é o valor da exceção, e não o padrão da plataforma

#### Scenario: Mudança do padrão não alcança quem tem exceção

- **WHEN** o padrão da plataforma é alterado
- **THEN** as pessoas sem exceção passam a ser avaliadas pelo novo padrão, e as
  pessoas com exceção continuam sendo avaliadas pelo valor da sua exceção

#### Scenario: Envio é bloqueado pela cota efetiva, não pelo padrão

- **WHEN** uma pessoa com exceção nominal acima do padrão solicita envio de um
  arquivo cujo tamanho declarado ultrapassa o padrão da plataforma mas cabe na
  sua exceção
- **THEN** a emissão da URL é autorizada

### Requirement: Concessão de exceção restrita ao administrador global

O sistema SHALL restringir a concessão, alteração e remoção de exceção nominal
de cota ao papel `global_admin`. Um `unit_admin` NÃO SHALL alterar a cota de
pessoa alguma, ainda que a pessoa pertença à sua unidade e que ele possa editar
os demais dados dela.

A recusa SHALL ser **fail-closed e total**: uma requisição de edição de pessoa
que tente alterar a cota sem o papel exigido SHALL ser recusada por inteiro, sem
aplicar os demais campos enviados na mesma requisição, de modo que nenhum
solicitante receba sucesso por uma concessão que não ocorreu.

A exceção SHALL poder ser **removida**, devolvendo a pessoa ao padrão da
plataforma, sem que isso exija conhecer o valor do padrão.

#### Scenario: Administrador global concede exceção

- **WHEN** um `global_admin` define uma cota individual para uma pessoa dentro
  do seu alcance
- **THEN** a exceção passa a valer para aquela pessoa a partir da requisição
  seguinte, sem afetar nenhuma outra pessoa

#### Scenario: Administrador de unidade não altera cota

- **WHEN** um `unit_admin` tenta alterar a cota de uma pessoa da sua própria
  unidade
- **THEN** a operação é recusada com permissão insuficiente

#### Scenario: Recusa não aplica os demais campos da mesma requisição

- **WHEN** um `unit_admin` envia, numa única edição de pessoa, alteração de
  cota junto de alterações de outros campos que ele poderia fazer
- **THEN** a requisição inteira é recusada e nenhum dos campos é alterado

#### Scenario: Remoção da exceção devolve a pessoa ao padrão

- **WHEN** um `global_admin` remove a exceção nominal de uma pessoa
- **THEN** a pessoa volta a ser avaliada pelo padrão da plataforma

#### Scenario: Colaborador não altera a própria cota

- **WHEN** uma pessoa com papel `collaborator` tenta alterar a própria cota
- **THEN** a operação é recusada com permissão insuficiente

### Requirement: Cota alheia não é consultável fora da gestão de pessoas

O sistema SHALL manter a consulta do próprio espaço restrita ao solicitante,
derivando a identidade exclusivamente do contexto de sessão, mesmo existindo
cotas distintas entre pessoas. A existência de exceções nominais NÃO SHALL criar
rota, parâmetro ou resposta que permita a uma pessoa descobrir a cota de outra.

A cota de terceiros SHALL ser visível apenas onde a gestão de pessoas já é
visível, sob o alcance por papel e por unidade que ela já impõe.

#### Scenario: Consulta de espaço não aceita identificador de outra pessoa

- **WHEN** uma pessoa tenta consultar o espaço de armazenamento informando o
  identificador de outra pessoa
- **THEN** a consulta responde sobre quem pediu, ou recusa, e em nenhum caso
  revela a cota ou o consumo de terceiro

#### Scenario: Exceção de terceiro não vaza entre unidades

- **WHEN** um `unit_admin` consulta pessoas da sua unidade
- **THEN** não obtém cota nem consumo de pessoas de outra unidade

### Requirement: Cota abaixo do consumo atual é permitida e não destrói dado

O sistema SHALL aceitar a definição de cota individual **menor** que o volume já
utilizado pela pessoa, tratando o estado resultante como bloqueio de novos
envios, nunca como exclusão. Nenhum arquivo SHALL ser apagado, ocultado ou
tornado inacessível por efeito de uma cota reduzida: visualização, download e
demais leituras SHALL continuar funcionando.

Enquanto o volume utilizado exceder a cota efetiva, o sistema SHALL recusar
novos envios. A substituição de versão SHALL ser avaliada pelo volume
**projetado** após a troca (utilizado − versão antiga + versão nova): SHALL ser
recusada sempre que esse volume projetado ainda exceder a cota — o que inclui a
troca por arquivo menor, quando o restante do acervo da pessoa já excede
sozinho o limite — e SHALL ser aceita quando a própria troca trouxer o volume
para dentro da cota.

#### Scenario: Reduzir a cota abaixo do uso não apaga arquivos

- **WHEN** um `global_admin` define para uma pessoa uma cota menor que o volume
  que ela já utiliza
- **THEN** nenhum arquivo é apagado e a pessoa continua podendo visualizar e
  baixar o que já possui

#### Scenario: Envio é recusado enquanto o uso exceder a cota

- **WHEN** uma pessoa cujo volume utilizado excede a cota efetiva solicita o
  envio de qualquer arquivo novo
- **THEN** a emissão da URL é recusada por cota excedida

#### Scenario: Substituição por arquivo menor é recusada quando a projeção ainda excede

- **WHEN** uma pessoa cujo volume utilizado excede a cota efetiva substitui um
  arquivo por outro menor, e o volume projetado após a troca continua acima da
  cota
- **THEN** a substituição é recusada, e o arquivo vigente permanece íntegro

#### Scenario: Substituição que traz o volume para dentro da cota é aceita

- **WHEN** a troca por um arquivo menor, por si só, baixa o volume projetado
  para dentro da cota efetiva
- **THEN** a substituição é autorizada

#### Scenario: Elevar a cota de volta restaura a capacidade de envio

- **WHEN** a cota da pessoa é elevada acima do seu volume utilizado
- **THEN** a pessoa volta a poder enviar na requisição seguinte, sem
  intervenção adicional
