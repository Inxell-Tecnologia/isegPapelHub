# Spec Delta

## ADDED Requirements

### Requirement: Busca alcança o código do documento

O sistema SHALL encontrar documentos pelo seu código, além do nome do arquivo,
num mesmo termo de busca. O código SHALL ser comparado sem distinção entre
maiúsculas e minúsculas. O alcance por código SHALL respeitar integralmente as
restrições já normatizadas da busca — permissão do solicitante e isolamento por
unidade —, sem abrir exceção a nenhuma delas. Referência: PRD US 10.2.

#### Scenario: Termo de busca encontra o documento pelo código
- **WHEN** uma pessoa informa na busca o código de um documento a que tem acesso
- **THEN** o documento correspondente é retornado

#### Scenario: Busca por código respeita a permissão
- **WHEN** uma pessoa informa na busca o código de um documento da sua unidade
  sobre o qual não tem permissão
- **THEN** o documento não é retornado, e a resposta não revela que ele existe

#### Scenario: Busca por código não atravessa unidades
- **WHEN** uma pessoa informa na busca um código que existe apenas em outra
  unidade
- **THEN** nenhum documento é retornado, qualquer que seja o papel do
  solicitante
