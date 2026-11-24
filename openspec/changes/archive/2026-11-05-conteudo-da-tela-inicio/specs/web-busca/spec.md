# Spec Delta

## ADDED Requirements

### Requirement: Busca recebe quem chega sem termo com o campo pronto

A tela de busca SHALL receber quem chega a ela **sem** termo no endereço com o
campo de termo focado, pronto para digitar. Quando o endereço já traz um termo,
a tela NÃO SHALL mover o foco para o campo, para não atrapalhar quem vai ler
os resultados. Referência: PRD US 11.1, cenário 2; demanda do cliente nº 2,
seção 1.3 (atalho "Buscar documento").

#### Scenario: Chegada sem termo foca o campo
- **WHEN** uma pessoa abre a tela de busca sem termo no endereço
- **THEN** o campo de termo está focado e aceita digitação de imediato

#### Scenario: Chegada com termo não rouba o foco
- **WHEN** uma pessoa chega à tela de busca com um termo no endereço
- **THEN** a busca é executada com esse termo e o foco não é levado ao campo
