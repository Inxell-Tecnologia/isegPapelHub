# Spec Delta

## ADDED Requirements

### Requirement: Marcação da SEDE na tela de unidades

A tela de unidades SHALL exibir qual unidade está marcada como SEDE e
SHALL permitir ao Administrador Global marcar e desmarcar a SEDE, com
confirmação que explique o efeito: os compartilhamentos entre unidades
dependem da SEDE e deixam de valer se ela for desmarcada. Quando outra
unidade já é a SEDE, a ação de marcar SHALL ficar indisponível, com
orientação para desmarcar a atual primeiro. A ação de desativar SHALL ficar
indisponível para a unidade marcada como SEDE. Referência: PRD US 5.2;
design.md D11.

#### Scenario: SEDE identificada na lista
- **WHEN** o Administrador Global abre a tela de unidades com uma SEDE
  marcada
- **THEN** a unidade aparece com a etiqueta "SEDE"

#### Scenario: Marcar exige que não haja outra SEDE
- **WHEN** já existe uma SEDE marcada
- **THEN** a ação de marcar outra unidade como SEDE não é oferecida, e há
  orientação para desmarcar a atual primeiro
