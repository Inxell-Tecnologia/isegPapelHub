# Spec Delta

## ADDED Requirements

### Requirement: Explorador atende ao pedido de nova pasta recebido no endereço

O explorador SHALL atender a um pedido de nova pasta recebido no próprio
endereço da tela, apresentando o formulário de nova pasta. SHALL atendê-lo
**somente na raiz da unidade**, onde criar pasta é permitido a qualquer pessoa
autenticada; recebido numa subpasta, o pedido SHALL ser descartado sem
apresentar o formulário, e o cliente NÃO SHALL inferir permissão para atendê-lo
ali. O pedido SHALL ser atendido depois que o conteúdo da raiz chegar, SHALL
valer uma única vez e NÃO SHALL se repetir ao recarregar a tela ou voltar a ela
pelo histórico. Referência: PRD US 11.1, cenário 2; US 2.1; demanda do cliente
nº 2, seção 1.3 (atalho "Nova pasta").

#### Scenario: Pedido na raiz apresenta o formulário
- **WHEN** uma pessoa chega à raiz do explorador com um pedido de nova pasta no
  endereço
- **THEN** o formulário de nova pasta é apresentado, sem que ela precise
  localizar a ação na tela

#### Scenario: Pedido fora da raiz é descartado
- **WHEN** uma pessoa chega a uma subpasta do explorador com um pedido de nova
  pasta no endereço
- **THEN** a tela apresenta o conteúdo da pasta normalmente, sem o formulário

#### Scenario: O pedido de nova pasta não se repete
- **WHEN** uma pessoa chega ao explorador com um pedido de nova pasta, vê o
  formulário e em seguida recarrega a tela ou volta a ela pelo histórico
- **THEN** o formulário não é apresentado outra vez
