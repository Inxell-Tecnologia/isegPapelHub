## ADDED Requirements

### Requirement: Caixas de aviso do manual renderizadas como destaque

O site do manual SHALL renderizar as caixas de aviso escritas na fonte (nota,
atenção, dica e equivalentes) como blocos destacados, com título e corpo. O
site NÃO SHALL exibir a marcação da caixa como texto literal em nenhuma página.
Referência: change `correcoes-herdadas-do-fork`.

#### Scenario: Página com caixa de aviso
- **WHEN** uma pessoa abre uma página do manual cuja fonte contém uma caixa de
  aviso com título
- **THEN** ela vê um bloco destacado com o título e o texto da caixa, sem os
  marcadores da sintaxe de origem

#### Scenario: Nenhuma marcação literal no site publicado
- **WHEN** o site do manual é construído
- **THEN** nenhuma página gerada contém a marcação de abertura de caixa de
  aviso como texto
