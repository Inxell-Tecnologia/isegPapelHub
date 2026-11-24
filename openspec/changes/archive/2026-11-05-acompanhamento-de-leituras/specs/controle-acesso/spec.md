# Spec Delta

## ADDED Requirements

### Requirement: Acompanhamento de todas as unidades não abre conteúdo de outra unidade

A pessoa com acompanhamento de leituras de **todas as unidades** SHALL alcançar,
das outras unidades, somente a situação nominal de leitura obrigatória — nome,
unidade e setor das pessoas, documento, revisão, prazo, situação e data da
ciência. Ela NÃO SHALL, por esse alcance, visualizar, baixar, listar ou
auditar arquivo de outra unidade, nem obter o estado de leitura de um arquivo
dela, e essas recusas SHALL ser indistinguíveis das de recurso inexistente.
Referência: PRD US 12.6; `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`,
respostas 7(a) e 8.

#### Scenario: Governança vê quem leu, mas não abre o documento
- **WHEN** a pessoa com acompanhamento de todas as unidades consulta o relatório
  de uma marcação de outra unidade e depois pede a visualização, o download, a
  auditoria ou o estado de leitura do arquivo marcado
- **THEN** vê o relatório nominal, e os quatro pedidos são recusados como se o
  arquivo não existisse
