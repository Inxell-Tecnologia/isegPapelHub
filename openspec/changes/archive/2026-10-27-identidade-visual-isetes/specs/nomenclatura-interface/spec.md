# Spec Delta

## ADDED Requirements

### Requirement: Rótulo do papel é idêntico em toda a interface

A aplicação SHALL apresentar o rótulo de um mesmo papel de acesso com texto
idêntico em toda tela que o exiba — shell autenticado, perfil da própria conta,
listagem de colaboradores e seletor de papel no cadastro. Um rótulo alterado
SHALL mudar simultaneamente em todas elas, sem possibilidade de uma tela ficar
com o texto antigo.

#### Scenario: Mesmo papel exibe o mesmo rótulo em telas distintas
- **WHEN** uma pessoa com privilégio administrativo de unidade consulta o shell
  autenticado, o perfil da própria conta e a listagem de colaboradores
- **THEN** o papel aparece com exatamente o mesmo texto nas três telas

#### Scenario: Alteração de rótulo não deixa tela para trás
- **WHEN** o rótulo de um papel de acesso é alterado
- **THEN** nenhuma tela da aplicação continua exibindo o texto anterior

## MODIFIED Requirements

### Requirement: Rótulo do papel de acesso preservado

A aplicação SHALL manter **"Colaborador"** como rótulo do papel de acesso sem
privilégio administrativo, ao lado de **"Gestor"** — rótulo do papel com
privilégio administrativo sobre a própria unidade — e de "Administrador global".
O conjunto de papéis, sua semântica e seus limites de autorização NÃO SHALL ser
alterados por esta nomenclatura: muda o texto apresentado, não o papel. A
interface SHALL continuar exibindo o papel de cada conta como atributo próprio,
distinto do termo que nomeia a entidade.

O termo "Administrador da unidade" NÃO SHALL aparecer em texto visível ao
usuário. Identificadores internos de código, esquema de banco e contratos de API
permanecem inalterados e não são objeto deste requisito.

#### Scenario: Papel continua distinguindo administradores de colaboradores comuns
- **WHEN** um administrador consulta a listagem de colaboradores de sua unidade
- **THEN** cada linha exibe o papel da conta — "Colaborador", "Gestor" ou
  "Administrador global" — permitindo distinguir, entre os colaboradores
  listados, quem tem privilégio administrativo

#### Scenario: O rótulo anterior não aparece em texto visível
- **WHEN** uma pessoa percorre as telas que nomeiam o papel de acesso
- **THEN** em nenhuma delas aparece "Administrador da unidade"

#### Scenario: Mudança de rótulo não amplia nem reduz privilégio
- **WHEN** uma conta com privilégio administrativo de unidade passa a ser
  rotulada como "Gestor"
- **THEN** as ações que ela pode executar permanecem exatamente as mesmas de
  antes da mudança de rótulo
