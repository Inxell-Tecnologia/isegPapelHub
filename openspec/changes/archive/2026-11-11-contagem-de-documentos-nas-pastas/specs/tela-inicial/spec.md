# Spec Delta

## ADDED Requirements

### Requirement: Cartão de pasta apresenta ícone colorido e o número de documentos

Cada cartão de **Pastas da unidade** SHALL apresentar o ícone de pasta colorido, sobre fundo tingido do próprio tom, e, abaixo do nome, o número de documentos que a pessoa encontra ao abrir a pasta, **tal como informado pelo servidor** — a tela NÃO SHALL calcular nem estimar a contagem. O tom SHALL ser estável para a mesma pasta entre visitas, e a cor SHALL ser apenas decorativa: a informação está no texto. O nome acessível do cartão SHALL continuar sendo o nome da pasta, com o número de documentos disponível como descrição para tecnologia assistiva. Referência: `docs/demanda_cliente_3.md`, item 7; PRD US 11.1, cenário 3.

#### Scenario: O cartão mostra o número de documentos
- **WHEN** uma pessoa abre a tela inicial e o servidor informa que uma pasta
  tem 12 documentos visíveis para ela
- **THEN** o cartão da pasta mostra o nome e, abaixo, "12 documentos"

#### Scenario: Singular e ausência de documentos
- **WHEN** o servidor informa um documento para uma pasta e nenhum para outra
- **THEN** os cartões mostram "1 documento" e "Nenhum documento",
  respectivamente

#### Scenario: O ícone é colorido e a cor da pasta é estável
- **WHEN** uma pessoa volta à tela inicial depois que outra pasta foi criada na
  unidade
- **THEN** cada pasta já existente mantém a mesma cor de ícone, e o ícone não é
  anunciado por tecnologia assistiva

#### Scenario: O nome acessível continua sendo o nome da pasta
- **WHEN** uma pessoa navega pelos links da tela inicial com leitor de tela
- **THEN** o cartão é anunciado pelo nome da pasta, seguido do número de
  documentos como descrição
