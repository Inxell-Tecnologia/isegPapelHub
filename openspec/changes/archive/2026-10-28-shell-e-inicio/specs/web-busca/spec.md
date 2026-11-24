# Spec Delta

## ADDED Requirements

### Requirement: Campo de busca permanentemente acessível no cabeçalho

A SPA SHALL apresentar um campo de busca no cabeçalho de toda tela autenticada,
alcançável sem navegar até uma tela de busca. O campo NÃO SHALL disparar
consulta a cada tecla digitada: o acionamento SHALL permanecer explícito,
conforme o requisito "Busca acionada explicitamente pelo usuário", que este NÃO
afrouxa. Acionado, SHALL conduzir à tela de resultados com o termo informado já
aplicado.

#### Scenario: Busca alcançável de qualquer tela
- **WHEN** uma pessoa autenticada está em qualquer tela da aplicação
- **THEN** encontra o campo de busca no cabeçalho, sem precisar navegar antes

#### Scenario: Digitar não dispara consulta
- **WHEN** uma pessoa digita um termo no campo do cabeçalho sem acioná-lo
- **THEN** nenhuma consulta é enviada ao servidor

#### Scenario: Acionar conduz aos resultados com o termo aplicado
- **WHEN** uma pessoa aciona a busca a partir do campo do cabeçalho
- **THEN** alcança a tela de resultados com o termo já aplicado, sem precisar
  redigitá-lo
