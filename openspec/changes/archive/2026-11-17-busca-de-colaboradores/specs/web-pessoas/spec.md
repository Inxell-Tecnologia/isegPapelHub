# Spec Delta

## ADDED Requirements

### Requirement: Busca de colaborador na listagem

A página de gestão de pessoas SHALL oferecer um campo de busca que filtra a
listagem pelo texto digitado, casando por trecho com o nome, o e-mail, a
função/cargo e o setor de cada pessoa e, para o administrador global, também
com o nome da unidade. A comparação SHALL ignorar maiúsculas/minúsculas e
acentos. Termo vazio SHALL exibir a listagem completa. A busca SHALL recortar
apenas o que a SPA já recebeu de `GET /users` e NÃO SHALL ampliar o alcance da
listagem — o servidor permanece o único guardião. Busca sem resultado SHALL
exibir a mensagem "Nenhum colaborador encontrado", distinta do aviso de falha
de carregamento. Referência: PRD US 1.1; change `busca-de-colaboradores`,
design.md D1–D3.

#### Scenario: Busca por trecho do nome, sem acento
- **WHEN** o administrador digita "joao" e a listagem contém "João Pereira" e
  "Maria Souza"
- **THEN** a tabela mostra apenas "João Pereira"

#### Scenario: Busca por e-mail, função ou setor
- **WHEN** o administrador digita um trecho do e-mail, da função/cargo ou do
  nome do setor de uma pessoa
- **THEN** essa pessoa aparece no resultado

#### Scenario: Administrador global busca pela unidade
- **WHEN** o administrador global digita o nome de uma unidade
- **THEN** a tabela mostra as pessoas daquela unidade

#### Scenario: Limpar a busca devolve a listagem completa
- **WHEN** o administrador limpa o campo de busca
- **THEN** a tabela volta a exibir todas as pessoas do seu alcance

#### Scenario: Busca sem resultado
- **WHEN** o termo digitado não casa com nenhuma pessoa
- **THEN** a tabela fica vazia com a mensagem "Nenhum colaborador encontrado"

#### Scenario: Mudar o termo volta à primeira página
- **WHEN** o administrador está numa página posterior da tabela e altera o termo
  de busca
- **THEN** a tabela passa a exibir a primeira página do resultado

#### Scenario: Busca não dispara nova consulta ao servidor
- **WHEN** o administrador digita no campo de busca
- **THEN** nenhuma nova requisição a `GET /users` é feita por causa da busca
