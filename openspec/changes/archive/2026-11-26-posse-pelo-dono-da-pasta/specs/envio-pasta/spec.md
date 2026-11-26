# Spec Delta

## ADDED Requirements

### Requirement: Pastas recriadas no envio seguem a regra de posse

O sistema SHALL criar cada pasta que faltar na hierarquia do envio de pasta com o dono definido pela capability `posse-e-autoria`: o dono imediato da pasta em que aquele nível nasce. O remetente SHALL ser registrado como autor de cada pasta criada, e cada arquivo SHALL ter como dono o dono da pasta-folha em que reside. Pastas reaproveitadas NÃO SHALL ter dono ou autor alterados.

#### Scenario: Árvore enviada para a pasta de outra pessoa
- **WHEN** um colaborador com concessão `upload` sobre a pasta de Daniel envia a
  pasta `Relatorios/2025/outro.pdf` para ela
- **THEN** as pastas `Relatorios` e `2025` são criadas com Daniel como dono e o
  colaborador como autor, e `outro.pdf` é registrado com Daniel como dono

#### Scenario: Árvore enviada para pasta própria ou para a raiz
- **WHEN** uma pessoa envia uma pasta para uma pasta da qual é dona, ou para a raiz
  da unidade
- **THEN** todas as pastas e arquivos criados têm essa pessoa como dona e autora

#### Scenario: Pasta reaproveitada mantém dono e autor
- **WHEN** o envio reaproveita uma pasta já existente no caminho
- **THEN** o dono e o autor dessa pasta não mudam, e os itens criados dentro dela
  têm como dono o dono dela
