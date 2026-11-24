# Spec Delta

## ADDED Requirements

### Requirement: Destinatário de leitura obrigatória visualiza a revisão marcada

A pessoa que integra o público de uma leitura obrigatória SHALL poder
**visualizar** o documento enquanto a revisão vigente for a revisão marcada,
mesmo sem ser dona, administradora ou ter concessão. Essa liberação NÃO SHALL
alcançar baixar, alterar ou excluir; NÃO SHALL fazer o documento aparecer na
listagem de pasta nem na busca; NÃO SHALL vencer as regras restritivas
existentes (documento obsoleto, pendente de cadastro, lixeira); e NÃO SHALL
atravessar unidades. Substituído o documento por nova revisão sem nova
marcação, a liberação SHALL deixar de valer. Referência: PRD US 12.3; design.md
D6 do change `leitura-obrigatoria`.

#### Scenario: Destinatário visualiza documento alheio
- **WHEN** um colaborador do público de uma leitura obrigatória pede a
  visualização do documento, sem outra permissão sobre ele
- **THEN** a visualização é concedida

#### Scenario: A leitura obrigatória não libera baixar
- **WHEN** o mesmo colaborador pede o download do documento
- **THEN** o download é recusado

#### Scenario: Nova revisão sem marcação retira a liberação
- **WHEN** o documento é substituído e a revisão nova não é marcada
- **THEN** o colaborador deixa de visualizá-lo

#### Scenario: Liberação não aparece na navegação
- **WHEN** o colaborador lista a pasta do documento ou busca pelo nome dele
- **THEN** o documento não aparece por causa da leitura obrigatória
