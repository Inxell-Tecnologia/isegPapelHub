# Spec Delta

## ADDED Requirements

### Requirement: Visualizador oferece confirmar ciência da leitura pendente

Quando a pessoa tem leitura obrigatória aberta do documento visualizado, o
visualizador SHALL apresentar, no rodapé, o botão **Confirmar ciência**,
habilitado somente depois que o documento termina de abrir. Acionado, SHALL apresentar a
declaração "Declaro que li e compreendi o documento [código] - [título], Rev.
[nº]." com Confirmar e Cancelar; confirmar SHALL registrar a ciência e o botão
SHALL deixar de ser oferecido. Sem leitura aberta, o rodapé NÃO SHALL oferecer o
botão. Referência: PRD US 12.3; demanda do cliente nº 2, seção 3.2 (etapa 3).

#### Scenario: Botão espera o documento abrir
- **WHEN** a pessoa abre no visualizador um documento com leitura pendente
- **THEN** o botão Confirmar ciência aparece desabilitado até o documento
  terminar de abrir

#### Scenario: Declaração nominal antes de confirmar
- **WHEN** a pessoa aciona Confirmar ciência
- **THEN** vê a declaração com código, título e revisão, e só confirma ao
  aceitá-la

#### Scenario: Sem leitura aberta, sem botão
- **WHEN** a pessoa visualiza um documento sem leitura obrigatória aberta para
  ela
- **THEN** o rodapé não apresenta Confirmar ciência
