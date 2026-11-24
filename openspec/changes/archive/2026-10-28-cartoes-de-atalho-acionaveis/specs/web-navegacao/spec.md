# Spec Delta

## ADDED Requirements

### Requirement: Explorador atende ao pedido de envio recebido no endereço

O explorador SHALL atender a um pedido de envio recebido no próprio endereço da
tela, levando a pessoa à área de envio da pasta aberta. SHALL atendê-lo somente
após o servidor resolver que ela pode enviar ali, e NÃO SHALL inferir essa
permissão no cliente. O pedido SHALL valer uma única vez, e NÃO SHALL se repetir
ao recarregar a tela nem ao voltar a ela pelo histórico do navegador.

#### Scenario: Com permissão de envio, a área de envio recebe a pessoa
- **WHEN** uma pessoa com permissão de envio na pasta aberta chega ao explorador
  com um pedido de envio no endereço
- **THEN** a área de envio daquela pasta fica à sua frente e pronta para uso, sem
  que ela precise localizá-la na tela

#### Scenario: Sem permissão de envio, o pedido não desloca a pessoa
- **WHEN** uma pessoa sem permissão de envio na pasta aberta chega ao explorador
  com um pedido de envio no endereço
- **THEN** a tela apresenta o conteúdo da pasta normalmente, sem conduzi-la à área
  de envio

#### Scenario: O pedido é resolvido pelo veredito do servidor
- **WHEN** o explorador recebe um pedido de envio antes de o servidor devolver o
  conteúdo da pasta
- **THEN** o pedido só é atendido depois que o veredito de envio daquela pasta
  chega, nunca por decisão do cliente

#### Scenario: O pedido não se repete
- **WHEN** uma pessoa chega ao explorador com um pedido de envio, é levada à área
  de envio e em seguida recarrega a tela ou volta a ela pelo histórico
- **THEN** o pedido não é atendido outra vez, e a tela se comporta como uma
  chegada comum ao explorador
