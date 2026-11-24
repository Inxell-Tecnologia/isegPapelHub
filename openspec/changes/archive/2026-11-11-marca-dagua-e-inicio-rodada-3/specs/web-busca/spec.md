# Spec Delta

## ADDED Requirements

### Requirement: Campo de busca do cabeçalho tem a altura da ação de envio

O campo de busca da barra superior SHALL ter a **mesma altura** da ação de envio de documento apresentada na mesma barra, em qualquer largura de tela. O acionador apresentado dentro do campo NÃO SHALL, por isso, ter área de acionamento abaixo do piso de 44 pixels de altura da aplicação. Referência: `docs/demanda_cliente_3.md`, item 9.

#### Scenario: Campo e ação de envio alinhados na barra
- **WHEN** uma pessoa autenticada visualiza a barra superior numa tela larga
- **THEN** o campo de busca e a ação de envio têm a mesma altura, medida na
  tela

#### Scenario: Altura igual também na tela estreita
- **WHEN** uma pessoa autenticada visualiza a barra superior numa tela mais
  estreita que o ponto de ruptura, com a ação de envio apresentada só pelo ícone
- **THEN** o campo de busca e a ação de envio continuam com a mesma altura

#### Scenario: Acionador interno preserva a área mínima de acionamento
- **WHEN** uma pessoa aciona o acionador de busca dentro do campo, em
  dispositivo de toque
- **THEN** a área sensível do acionador tem ao menos 44 pixels de altura
