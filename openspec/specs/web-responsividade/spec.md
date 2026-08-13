# web-responsividade Specification

## Purpose

Define o contrato **transversal** de adequação da SPA do GDoc a telas estreitas
(celular e tablet em retrato): a existência de um único ponto de ruptura,
definido em um único lugar do código e derivado dos tokens do design system; a
proibição de rolagem horizontal do documento em qualquer tela; os dois níveis de
adequação — telas de **consulta** (entrar na aplicação, navegar pastas,
visualizar arquivo, buscar) com layout repensado, e as demais telas apenas
**utilizáveis**; e o princípio de que capacidade ausente no dispositivo em uso é
recusada no acionamento, com explicação, nunca por ocultação da ação. Existe como
capability própria, e não como cláusula repetida em cada capability de tela,
porque é a mesma obrigação em toda a aplicação — inclusive nas telas que ainda
não existem. Os requisitos aqui governam **apresentação**; nada nesta capability
altera o que o servidor autoriza — a API permanece o único guardião de permissão,
e o modo estreito não concede nem retira acesso algum. Ver
`openspec/changes/responsividade-mobile-tablet/design.md` D1, D5, D7.

## Requirements

### Requirement: Aplicação adota um ponto de ruptura único e declarado

A SPA SHALL adotar **um único** ponto de ruptura entre a forma larga e a forma
estreita da interface, definido em um único lugar do código e derivado dos
tokens do design system, e NÃO SHALL espalhar limiares independentes por tela ou
por componente. Acima do limiar, a interface SHALL permanecer com a forma larga
já entregue, sem alteração de comportamento.

O limiar SHALL ser posicionado de modo que um tablet em orientação retrato
receba a forma estreita, entregando a largura integral da tela ao conteúdo.

Referência: design.md D1 do change `responsividade-mobile-tablet`.

#### Scenario: Tablet em retrato recebe a forma estreita
- **WHEN** uma pessoa abre a aplicação num tablet em orientação retrato
- **THEN** a interface se apresenta na forma estreita, com a largura da tela
  dedicada ao conteúdo

#### Scenario: Acima do limiar a interface permanece inalterada
- **WHEN** uma pessoa abre a aplicação numa janela mais larga que o limiar
- **THEN** a interface se comporta exatamente como na forma larga já entregue,
  sem alteração perceptível

#### Scenario: O limiar tem uma definição única
- **WHEN** o valor do limiar precisa ser alterado
- **THEN** a alteração acontece em um único ponto do código e passa a valer para
  toda a aplicação, sem exigir ajuste tela a tela

### Requirement: Nenhuma tela produz rolagem horizontal do documento

A SPA NÃO SHALL produzir rolagem horizontal do documento em nenhuma tela, em
nenhuma largura de viewport suportada. Conteúdo mais largo que a área disponível
— em particular tabelas de muitas colunas — SHALL rolar **dentro do próprio
contêiner**, preservando fixos o cabeçalho da aplicação e a área de navegação.

Esta obrigação SHALL valer para **todas** as telas, inclusive as que não recebem
layout otimizado para a forma estreita.

Referência: design.md D7 do change `responsividade-mobile-tablet`.

#### Scenario: Tabela larga rola dentro do próprio contêiner
- **WHEN** uma pessoa abre, numa tela estreita, uma tela cuja tabela tem mais
  colunas do que cabem na largura disponível
- **THEN** a tabela rola horizontalmente dentro da sua própria área, e a página
  não rola horizontalmente

#### Scenario: Tela sem layout otimizado também não estoura
- **WHEN** uma pessoa abre, numa tela estreita, uma tela de administração que não
  recebeu layout otimizado
- **THEN** o conteúdo permanece acessível e a página não rola horizontalmente

### Requirement: Telas de consulta são otimizadas e as demais permanecem utilizáveis

A SPA SHALL classificar suas telas em dois níveis de adequação à forma estreita.
As telas de **consulta** — entrar na aplicação, navegar pastas, visualizar
arquivo e buscar — SHALL receber layout pensado para a tela estreita. As demais
SHALL permanecer **utilizáveis**: acessíveis, sem perda de função e sem rolagem
horizontal do documento, ainda que sem layout repensado.

Nenhuma tela SHALL ficar inacessível ou inoperante em função do tamanho da tela.
A distinção entre os dois níveis SHALL ser entre *layout repensado* e *funciona
com esforço*, e NÃO entre *disponível* e *indisponível*.

Referência: design.md D7 do change `responsividade-mobile-tablet`.

#### Scenario: Consulta funciona com conforto na tela estreita
- **WHEN** uma pessoa navega pastas, abre a visualização de um arquivo e faz uma
  busca num celular
- **THEN** cada uma dessas telas se apresenta com layout adequado à largura
  disponível, sem exigir ampliação ou rolagem lateral

#### Scenario: Tela fora do foco continua operante
- **WHEN** uma administradora abre a gestão de pessoas num celular
- **THEN** a tela permanece operante e todas as suas ações continuam alcançáveis,
  ainda que o layout não tenha sido repensado para essa largura

### Requirement: Capacidade ausente no dispositivo é recusada com explicação

A SPA SHALL manter visível toda ação cuja capacidade dependa de recurso ausente
no dispositivo em uso, e SHALL recusá-la **no momento do acionamento**, com
mensagem que informe o motivo e oriente a alternativa. A SPA NÃO SHALL ocultar
nem desabilitar silenciosamente essas ações em função da classe do dispositivo.

A mensagem de recusa por capacidade SHALL ser distinguível da recusa por
**permissão insuficiente**, por descreverem situações diferentes e levarem a
ações diferentes.

Referência: design.md D5 do change `responsividade-mobile-tablet`; requisito
"Pedido acima do limite configurado é recusado com orientação" da capability
`download-pasta`, cuja forma de recusa este requisito generaliza.

#### Scenario: Ação indisponível no dispositivo permanece visível
- **WHEN** uma pessoa abre, num dispositivo que não suporta determinada
  capacidade, a tela onde a ação correspondente é oferecida
- **THEN** a ação continua visível na interface, em vez de desaparecer sem
  explicação

#### Scenario: Acionamento explica o motivo e a alternativa
- **WHEN** essa pessoa aciona a ação
- **THEN** a operação é recusada com mensagem que informa que o recurso não está
  disponível naquele dispositivo e orienta a alternativa

#### Scenario: Recusa por capacidade não se confunde com recusa por permissão
- **WHEN** uma pessoa é recusada por capacidade ausente no dispositivo, e outra é
  recusada por permissão insuficiente
- **THEN** as duas mensagens são distinguíveis, sem que uma situação seja
  apresentada com o texto da outra
