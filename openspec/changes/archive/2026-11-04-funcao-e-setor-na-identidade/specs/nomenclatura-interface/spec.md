# Spec Delta

## MODIFIED Requirements

### Requirement: Rótulo do papel é idêntico em toda a interface

A aplicação SHALL apresentar o rótulo de um mesmo papel de acesso com texto
idêntico em **toda tela que o exiba** — perfil da própria conta, listagem de
colaboradores, seletor de papel no cadastro e, no shell autenticado e na tela
inicial, nas situações em que o papel é exibido. Um rótulo alterado SHALL mudar
simultaneamente em todas elas, sem possibilidade de uma tela ficar com o texto
antigo.

O shell autenticado e a tela inicial apresentam a **função** do cadastro, e
exibem o rótulo do papel **apenas como recaída**, quando a pessoa não tem função
preenchida (capabilities `web-shell-e-auth` e `tela-inicial`). Nessa recaída o
rótulo SHALL vir da mesma origem única das demais telas. A função NÃO SHALL ser
tratada como rótulo de papel: ela é texto do cadastro, sem efeito sobre
autorização, e NÃO SHALL ser padronizada por esta regra.

#### Scenario: Mesmo papel exibe o mesmo rótulo em telas distintas
- **WHEN** uma pessoa com privilégio administrativo de unidade, e sem função
  preenchida no cadastro, consulta o shell autenticado, o perfil da própria conta
  e a listagem de colaboradores
- **THEN** o papel aparece com exatamente o mesmo texto nas três telas

#### Scenario: Alteração de rótulo não deixa tela para trás
- **WHEN** o rótulo de um papel de acesso é alterado
- **THEN** nenhuma tela da aplicação continua exibindo o texto anterior

#### Scenario: Função exibida no lugar do papel não é rótulo de papel
- **WHEN** uma pessoa com função "Gerente de Governança" e papel `collaborator`
  consulta o shell autenticado e a listagem de colaboradores
- **THEN** o shell apresenta a função, a listagem apresenta o papel com o rótulo
  de origem única, e a divergência entre os dois textos não configura rótulo de
  papel inconsistente
