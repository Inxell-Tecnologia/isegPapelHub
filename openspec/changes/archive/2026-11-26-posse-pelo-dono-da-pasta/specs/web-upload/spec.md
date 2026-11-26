# Spec Delta

## ADDED Requirements

### Requirement: Envio para pasta de outra pessoa dispensa a pré-checagem numérica

A SPA SHALL, quando a resposta de conteúdo indicar que o solicitante não é o dono da pasta de destino, dispensar a comparação com o espaço próprio, apresentar o resumo da seleção e aguardar confirmação, delegando ao servidor a decisão de espaço. A SPA NÃO SHALL apresentar o espaço do solicitante como limite desse envio.

#### Scenario: Colaborador sem espaço próprio envia para a pasta de Daniel
- **WHEN** um colaborador com o espaço próprio esgotado seleciona arquivos para
  enviar à pasta de Daniel
- **THEN** a SPA não recusa a seleção pelo espaço do colaborador, apresenta o resumo
  e, após a confirmação, pede as URLs ao servidor

#### Scenario: Destino próprio mantém a verificação de viabilidade
- **WHEN** uma pessoa envia para uma pasta da qual é dona ou para a raiz
- **THEN** a SPA confronta a seleção com o espaço próprio antes de qualquer
  transferência, como antes

### Requirement: Recusa por espaço do dono da pasta é apresentada como tal

A SPA SHALL apresentar a recusa por espaço insuficiente do dono da pasta com mensagem própria, informando que o espaço do responsável pela pasta não comporta o envio e orientando a procurá-lo ou a administração. A mensagem NÃO SHALL exibir valores de cota nem a decomposição do espaço, e NÃO SHALL orientar a excluir arquivos.

#### Scenario: Item recusado por espaço do dono
- **WHEN** o servidor recusa itens de um envio por falta de espaço do dono da pasta
- **THEN** a SPA informa que o espaço do responsável pela pasta não comporta esses
  arquivos, identifica quais ficaram de fora e não mostra números de cota
