# Spec Delta

## ADDED Requirements

### Requirement: Cartão da tela inicial é acionável em toda a sua área

Todo cartão que a tela inicial apresenta como caminho para um destino SHALL ser
acionável em qualquer ponto da sua área, e NÃO SHALL restringir o acionamento ao
texto do seu rótulo. A área sensível SHALL ser a do cartão apresentado, de modo
que o aspecto de superfície acionável corresponda ao que de fato aciona.
Referência: PRD US 11.1.

#### Scenario: Acionamento fora do texto do rótulo conduz ao destino
- **WHEN** uma pessoa aciona um cartão da tela inicial num ponto da sua área que
  não é o texto do rótulo — a descrição, o espaço livre à volta dela ou a margem
  interna do cartão
- **THEN** alcança o mesmo destino que alcançaria acionando o rótulo

#### Scenario: Aspecto acionável corresponde à área que aciona
- **WHEN** uma pessoa percorre com o ponteiro a área de um cartão da tela inicial
- **THEN** não encontra região que se apresente como acionável sem conduzir ao
  destino do cartão

#### Scenario: Cartão é alcançável e acionável pelo teclado
- **WHEN** uma pessoa percorre a tela inicial usando apenas o teclado
- **THEN** cada cartão recebe o foco, com indicação visível, e é acionável a
  partir dele, conduzindo ao seu destino

#### Scenario: Cartão respeita a área mínima de acionamento
- **WHEN** uma pessoa aciona um cartão da tela inicial em dispositivo de toque
- **THEN** a área sensível tem ao menos a altura mínima de acionamento exigida
  pelo piso de acessibilidade da aplicação

#### Scenario: Destino do cartão é identificável antes do acionamento
- **WHEN** uma pessoa aponta para um cartão da tela inicial, ou usa o recurso do
  navegador para abrir um destino em nova aba
- **THEN** o cartão expõe o endereço do seu destino, como qualquer link da
  aplicação

#### Scenario: Cartão é anunciado pelo seu rótulo
- **WHEN** uma pessoa que usa leitor de tela alcança um cartão da tela inicial
- **THEN** ele é anunciado pelo seu rótulo, sem que a descrição auxiliar seja
  incorporada ao nome do destino

## MODIFIED Requirements

### Requirement: Atalhos da tela inicial refletem o que o perfil pode fazer

A tela inicial SHALL apresentar atalhos para as ações de uso frequente,
restritos aos que o perfil da pessoa pode executar. NÃO SHALL apresentar atalho
que resultaria em recusa ao ser acionado. Cada atalho SHALL conduzir à ação que
anuncia, e NÃO SHALL deixar a ação por localizar na tela de destino; dois atalhos
distintos NÃO SHALL conduzir ao mesmo ponto de partida. Referência: PRD US 11.1.

#### Scenario: Atalho fora do alcance do perfil não é apresentado
- **WHEN** uma pessoa cujo perfil não permite determinada ação abre a tela
  inicial
- **THEN** o atalho correspondente não é apresentado

#### Scenario: Atalho apresentado conduz a uma ação executável
- **WHEN** uma pessoa aciona qualquer atalho apresentado na sua tela inicial
- **THEN** alcança a ação correspondente, sem recusa por permissão

#### Scenario: O atalho de envio conduz ao envio, não só à tela que o contém
- **WHEN** uma pessoa que pode enviar documentos aciona o atalho de envio
- **THEN** alcança a área de envio em condição de usá-la de imediato, sem precisar
  localizá-la na tela de destino

#### Scenario: O atalho de envio não conduz a uma recusa
- **WHEN** uma pessoa aciona o atalho de envio e a pasta de destino não lhe
  permite enviar
- **THEN** alcança a tela de destino normalmente, sem ser conduzida a uma área de
  envio que recusaria a ação

#### Scenario: Atalhos distintos têm destinos distintos
- **WHEN** uma pessoa compara os atalhos apresentados na sua tela inicial
- **THEN** cada um conduz a um ponto de partida próprio, sem dois atalhos
  diferentes levando ao mesmo lugar
