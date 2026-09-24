# Spec Delta

## MODIFIED Requirements

### Requirement: Limites operacionais apresentados como padrões da implantação

O manual SHALL apresentar os limites operacionais configuráveis — cota de
armazenamento por pessoa, prazo de retenção da lixeira, tetos de quantidade e
tamanho do download compactado e antecedência do aviso de expiração — informando
seus valores vigentes e deixando explícito que são **padrões da implantação**,
ajustáveis por configuração de ambiente. Esses valores NÃO SHALL ser afirmados
como constantes imutáveis do produto. O endereço de acesso à aplicação SHALL ser
identificado como o endereço da implantação em questão, e não como endereço único
do produto.

Especificamente quanto à cota de armazenamento, o manual SHALL apresentá-la como
o **padrão aplicado a quem não tem exceção**, e NÃO SHALL afirmá-la como o limite
de toda pessoa: o manual SHALL registrar que a administração global pode conceder
cota individual diferente a uma pessoa, e SHALL orientar quem não souber a
própria cota a consultá-la na tela de envio, que sempre exibe a cota efetiva.
Referência: design.md D9.

#### Scenario: Limite é apresentado com sua natureza configurável
- **WHEN** o usuário consulta a cota de armazenamento no manual
- **THEN** encontra o valor vigente acompanhado da ressalva de que é o padrão
  desta implantação

#### Scenario: Endereço não é apresentado como único do produto
- **WHEN** o usuário consulta como acessar a aplicação
- **THEN** o endereço é identificado como o desta implantação

#### Scenario: Cota é apresentada como padrão sujeito a exceção
- **WHEN** o usuário consulta a cota de armazenamento no manual
- **THEN** encontra a informação de que aquele é o valor padrão e de que pode
  existir cota individual distinta concedida pela administração global

## ADDED Requirements

### Requirement: Orientação de concessão de cota individual no manual do administrador

O manual SHALL documentar, na seção do perfil de administrador, como conceder,
alterar e remover a cota individual de uma pessoa, identificando que a ação é
exclusiva do administrador global. A documentação SHALL ser fiel à interface
efetivamente entregue, descrevendo o campo como ele aparece na tela de gestão de
pessoas.

O manual SHALL registrar a consequência de definir cota menor que o consumo
atual — a pessoa fica impedida de enviar, e a substituição de versão só é aceita
quando a própria troca traz o volume para dentro da cota — e SHALL remeter à
orientação já existente de que excluir não libera espaço de imediato.

O manual NÃO SHALL documentar a concessão de cota como recurso disponível ao
administrador de unidade, por não sê-lo.

#### Scenario: Administrador global encontra como conceder exceção
- **WHEN** um administrador global consulta o manual sobre cota de
  armazenamento
- **THEN** encontra o passo a passo de concessão na tela de gestão de pessoas

#### Scenario: Consequência do rebaixamento está documentada
- **WHEN** o administrador consulta o que acontece ao reduzir a cota de alguém
  abaixo do consumo atual
- **THEN** encontra a informação de que a pessoa fica bloqueada para novos
  envios até liberar espaço, com remissão ao comportamento da lixeira

#### Scenario: Manual não atribui a concessão ao administrador de unidade
- **WHEN** um administrador de unidade consulta o manual do seu perfil
- **THEN** não encontra a concessão de cota individual entre as suas ações
