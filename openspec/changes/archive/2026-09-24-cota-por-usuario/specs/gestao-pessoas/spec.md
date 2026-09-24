# Spec Delta

## ADDED Requirements

### Requirement: Cota individual como campo da edição de pessoa

O sistema SHALL aceitar a cota individual de armazenamento como campo da edição
de pessoa em `PATCH /users/:id`, sujeito às mesmas garantias das demais rotas de
gestão de pessoas — sessão obrigatória, contexto de tenant por transação, RLS de
`users` como fronteira de isolamento e alcance pelo papel da pessoa alvo — e,
adicionalmente, ao papel `global_admin`, conforme a capability
`cota-individual`. O campo SHALL distinguir três intenções: ausente (não altera
a cota), remoção explícita (devolve a pessoa ao padrão da plataforma) e valor
(define a exceção nominal).

O valor SHALL ser expresso em **bytes**, na mesma unidade já usada pelas demais
grandezas de armazenamento do sistema, e SHALL ser um inteiro não negativo;
valor negativo ou não inteiro SHALL ser recusado sem alterar dado algum.

#### Scenario: Edição define a cota individual

- **WHEN** um `global_admin` edita uma pessoa informando um valor de cota
  individual
- **THEN** a cota passa a valer para aquela pessoa e a resposta reflete o novo
  valor

#### Scenario: Edição sem o campo preserva a cota vigente

- **WHEN** um administrador edita outros dados de uma pessoa sem informar o
  campo de cota
- **THEN** a cota da pessoa permanece exatamente como estava, seja ela exceção
  nominal ou padrão da plataforma

#### Scenario: Valor inválido é recusado

- **WHEN** um `global_admin` informa um valor de cota negativo ou não inteiro
- **THEN** a edição é recusada e nenhum campo da pessoa é alterado

### Requirement: Consumo de armazenamento visível na gestão de pessoas

O sistema SHALL incluir o **volume já utilizado** pela pessoa na representação
de pessoa devolvida pela gestão de pessoas, de modo que a administração decida
sobre cota vendo o consumo atual. O volume SHALL refletir o mesmo contador que
governa o bloqueio de envio, sem recálculo próprio.

A exposição SHALL respeitar o alcance já imposto pela gestão de pessoas: o
volume de uma pessoa SHALL ser visível apenas a quem já pode enxergar aquela
pessoa.

#### Scenario: Representação de pessoa informa o volume utilizado

- **WHEN** um administrador consulta ou edita uma pessoa dentro do seu alcance
- **THEN** a resposta inclui o volume de armazenamento já utilizado por ela

#### Scenario: Volume não vaza para fora do alcance

- **WHEN** um `unit_admin` lista pessoas
- **THEN** obtém o volume utilizado apenas das pessoas da sua própria unidade
