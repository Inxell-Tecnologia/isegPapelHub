# Spec Delta

## MODIFIED Requirements

### Requirement: Colaborador nunca enxerga outra unidade

O `collaborator` NÃO SHALL alcançar arquivos, pastas ou metadados de
unidade diferente da sua, nem por navegação, nem por busca, nem por link
direto ao identificador de um recurso, **salvo** o conteúdo alcançado por
compartilhamento entre unidades vigente (capability
`compartilhamento-entre-unidades`, PRD US 5.2). Esse alcance é somente
leitura e restrito ao que foi compartilhado. Este isolamento SHALL ser
imposto pela RLS por `unit_id` como fronteira dura no banco, com a
autorização de aplicação por cima; a checagem de aplicação NÃO SHALL ser a
única barreira. A leitura de conteúdo compartilhado de outra unidade SHALL
acontecer apenas em transação de visita confinada pela RLS à unidade de
origem. Referência: PRD Épico 5 / US 5.1, cenário 2; US 5.2; NFR de
confidencialidade.

#### Scenario: navegação não revela outra unidade
- **WHEN** um `collaborator` navega pelos arquivos e pastas
- **THEN** nunca aparece nenhum item pertencente a outra unidade, exceto o
  conteúdo de compartilhamento entre unidades vigente, alcançado a partir de
  "Compartilhados comigo"

#### Scenario: link direto a recurso de outra unidade
- **WHEN** um `collaborator` aciona a rota de um arquivo ou pasta de outra
  unidade usando o identificador direto, sem compartilhamento entre unidades
  vigente que o cubra
- **THEN** recebe 403, sem conteúdo nem pré-visualização, e a resposta não
  distingue "não existe" de "existe em outra unidade"

#### Scenario: conteúdo compartilhado entre unidades
- **WHEN** um `collaborator` pede a visualização de um arquivo de outra
  unidade coberto por compartilhamento entre unidades vigente com o verbo
  `view`
- **THEN** a URL de visualização é emitida e o acesso é auditado na unidade
  de origem
