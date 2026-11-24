# Spec Delta

## ADDED Requirements

### Requirement: Listagem informa se a revisão vigente é de leitura obrigatória

O resumo de arquivo devolvido pelas listagens SHALL informar se a **revisão
vigente** do documento tem marcação de leitura obrigatória em curso — marcação
da revisão atual, de documento não obsoleto —, apurado na própria consulta. A
informação NÃO SHALL ampliar alcance: SHALL acompanhar apenas documentos que a
listagem já devolve à pessoa, e NÃO SHALL revelar público, prazo ou mensagem da
marcação. Referência: PRD US 12.4; demanda do cliente nº 2, seção 3.5
(Documentos).

#### Scenario: Revisão vigente marcada
- **WHEN** uma pessoa lista a pasta de um documento cuja revisão vigente foi
  marcada
- **THEN** o resumo do documento informa que ele é de leitura obrigatória

#### Scenario: Marcação de revisão anterior não conta
- **WHEN** o documento marcado é substituído e a revisão nova não é marcada
- **THEN** o resumo informa que ele não é de leitura obrigatória

#### Scenario: Documento obsoleto deixa de ser de leitura obrigatória
- **WHEN** o administrador da unidade lista um documento marcado que foi
  declarado obsoleto
- **THEN** o resumo informa que ele não é de leitura obrigatória

### Requirement: Leitor acompanha as próprias leituras em Pendentes e Concluídas

A pessoa SHALL ter um destino **Leitura obrigatória** com as abas
**Pendentes** e **Concluídas**. Pendentes SHALL reunir as leituras abertas —
pendentes e atrasadas, a atrasada sinalizada como **Atrasada** e apresentada
primeiro —, cada uma com o documento (código, título e revisão), o prazo, a
mensagem do publicador e o botão **"Ler e confirmar ciência"**, que SHALL abrir
o documento no visualizador, sem confirmar nada por si. Concluídas SHALL reunir
as ciências confirmadas, com a data e a hora da confirmação. Leitura encerrada
NÃO SHALL aparecer em nenhuma das duas abas. Confirmada a ciência no
visualizador, a leitura SHALL sair de Pendentes e aparecer em Concluídas sem
recarregar a tela. Leitura aberta cujo documento a pessoa não alcança mais NÃO
SHALL oferecer o botão. Referência: PRD US 12.4; demanda do cliente nº 2,
seções 3.2 (etapas 2 e 3) e 3.5 (Menu Leitura obrigatória).

#### Scenario: Pendentes e atrasadas na primeira aba
- **WHEN** uma pessoa com uma leitura pendente e uma atrasada abre o destino
- **THEN** vê as duas em Pendentes, a atrasada primeiro e sinalizada como
  Atrasada, cada uma com o prazo e o botão "Ler e confirmar ciência"

#### Scenario: Confirmar move para Concluídas
- **WHEN** a pessoa aciona "Ler e confirmar ciência", o documento abre no
  visualizador e ela confirma a ciência
- **THEN** a leitura sai de Pendentes e aparece em Concluídas, com a data e a
  hora da confirmação

#### Scenario: Encerrada não aparece
- **WHEN** uma leitura da pessoa foi encerrada por nova revisão do documento
- **THEN** ela não aparece em Pendentes nem em Concluídas
