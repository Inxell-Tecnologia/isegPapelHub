# Spec Delta

## ADDED Requirements

### Requirement: Filtro de autor da busca considera quem enviou o arquivo

O sistema SHALL aplicar o filtro de autor da busca sobre o **autor** do envio (capability `posse-e-autoria`), e não sobre o dono do arquivo. O filtro NÃO SHALL ampliar o alcance da busca: só são retornados arquivos que quem pesquisa já alcançaria.

#### Scenario: Arquivo enviado para a pasta de outra pessoa
- **WHEN** um administrador busca pelo autor Carlos, que enviou um arquivo para a
  pasta de Daniel
- **THEN** o arquivo aparece no resultado, embora Daniel seja o dono

#### Scenario: Dono que não enviou não é o autor
- **WHEN** um administrador busca pelo autor Daniel
- **THEN** o arquivo enviado por Carlos para a pasta de Daniel não aparece por esse
  critério
