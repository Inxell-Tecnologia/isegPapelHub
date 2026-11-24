# Spec Delta

## ADDED Requirements

### Requirement: Seção de compartilhamento com outra unidade no modal de permissões

O modal de permissões SHALL oferecer ao administrador a seção "Compartilhar
com outra unidade", num painel recolhido por padrão, abaixo da concessão
comum. A unidade de destino é escolhida entre as devolvidas pelo servidor:
as demais unidades, se a unidade atual for a SEDE, ou só a SEDE, nos outros
casos. O alcance pode ser "Unidade inteira" ou "Colaboradores selecionados"
da unidade de destino, com os verbos Visualizar e/ou Baixar e prazo
opcional. A seção SHALL listar os compartilhamentos do recurso, com
destino, verbos, prazo e situação de vencido, e permitir revogá-los. Para
pasta, SHALL exibir aviso explícito de que todo o conteúdo atual e futuro
dela fica visível ao destino. Sem SEDE marcada, a seção SHALL explicar que o
compartilhamento entre unidades depende dessa marcação, em vez de oferecer
destinos vazios. A seleção de colaboradores da concessão comum SHALL listar
apenas pessoas da unidade do recurso, e o erro `cross_unit_subject` SHALL
ser apresentado como "Este colaborador é de outra unidade. Use
'Compartilhar com outra unidade'." Referência: PRD US 5.2; design.md D5/D7/D8/D10.

#### Scenario: Compartilhar Governança com uma unidade
- **WHEN** a Administradora Global abre as permissões da pasta Governança,
  expande "Compartilhar com outra unidade", escolhe "Unidade Norte",
  "Unidade inteira" e "Visualizar", e confirma
- **THEN** o compartilhamento aparece na lista da seção, com destino
  "Unidade Norte (unidade inteira)"

#### Scenario: Aviso de subárvore para pasta
- **WHEN** o administrador abre a seção para uma pasta
- **THEN** vê o aviso de que todo o conteúdo atual e futuro da pasta fica
  visível ao destino

#### Scenario: Destino restrito à SEDE fora dela
- **WHEN** o administrador da Unidade Norte abre a seção
- **THEN** a única unidade de destino oferecida é a SEDE

#### Scenario: Revogar compartilhamento
- **WHEN** o administrador revoga um compartilhamento listado
- **THEN** ele sai da lista
