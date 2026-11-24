# Spec Delta

## ADDED Requirements

### Requirement: A lista inclui o que outra unidade compartilhou comigo

A lista de compartilhados comigo SHALL incluir, além das concessões comuns,
a pasta ou o arquivo-raiz de cada compartilhamento entre unidades vigente
endereçado à pessoa ou à unidade dela. Cada item SHALL trazer os verbos e
prazos vigentes, a data do compartilhamento e a unidade de origem
(`originUnit`), que fica nula nos itens da própria unidade. Os itens SHALL
ser agrupados e ordenados pelas mesmas regras dos demais. Só a raiz
compartilhada SHALL compor a lista; o conteúdo interno é alcançado
navegando. As mesmas regras restritivas (vigência, lixeira, obsoleto,
pendente de cadastro) SHALL valer para esses itens. Referência: PRD US 5.2,
cenário 2; design.md D12.

#### Scenario: Pasta da SEDE aparece para a pessoa da unidade
- **WHEN** a Governança, da SEDE, foi compartilhada com a Unidade Norte e a
  Raíra, da Unidade Norte, abre "Compartilhados comigo"
- **THEN** a Governança aparece, identificada como da unidade SEDE, com o
  verbo `view`

#### Scenario: Item fica identificado com a unidade de origem
- **WHEN** a lista traz um item compartilhado por outra unidade
- **THEN** a SPA exibe a etiqueta "da unidade {nome da origem}" no item

#### Scenario: Compartilhamento vencido não aparece
- **WHEN** o prazo do compartilhamento entre unidades venceu
- **THEN** o item não aparece na lista

#### Scenario: Concessão individual de colega não aparece
- **WHEN** um compartilhamento entre unidades foi feito para outra pessoa da
  minha unidade
- **THEN** o item não aparece na minha lista
