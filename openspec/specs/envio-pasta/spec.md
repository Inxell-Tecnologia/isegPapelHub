# envio-pasta Specification

## Purpose

Define os requisitos verificáveis de envio de pastas inteiras do GDoc — recriação
idempotente da hierarquia de subpastas a partir dos caminhos relativos dos arquivos
enviados e ancoragem da árvore na pasta de destino com isolamento por unidade — na
fatia do Épico 3 / US 3.2 do PRD (`docs/prd_final.md`). Reutiliza o modelo de
`folders` já especificado na capability `navegacao` (Épico 2); aqui a árvore é
recriada em lote a partir dos caminhos relativos dos arquivos enviados. Os cenários
Given/When/Then da US 3.2 são vinculantes e este spec os torna verificáveis no
backend.

## Requirements

### Requirement: Recriação idempotente da hierarquia de pastas no envio

O sistema SHALL **garantir** a existência de toda a cadeia de pastas descrita
pelo caminho relativo (`relativePath`) que cada item do lote PODE informar — o
caminho indica a subpasta em que o arquivo deve residir dentro da pasta de
destino (ou da raiz da unidade, quando não houver pasta de destino) —, criando
os níveis que faltarem e reaproveitando os que já existirem, e SHALL vincular o
arquivo à pasta-folha resultante. A criação de caminho SHALL ser **idempotente**:
reenviar o mesmo lote NÃO SHALL duplicar pastas. Todas as pastas criadas SHALL
pertencer à unidade do remetente e residir sob a pasta de destino informada, com
o isolamento entre unidades imposto por RLS. Referência: PRD US 3.2.

#### Scenario: Estrutura de subpastas preservada
- **WHEN** uma pessoa envia arquivos cujos caminhos relativos descrevem uma pasta com
  subpastas (por exemplo, `Relatorios/2024/arquivo.pdf` e `Relatorios/2025/outro.pdf`)
- **THEN** a hierarquia de subpastas é recriada de forma idêntica dentro do sistema e
  cada arquivo passa a residir na subpasta correspondente ao seu caminho

#### Scenario: Reaproveitamento de pasta existente
- **WHEN** parte do caminho relativo de um item já existe como pasta na unidade
- **THEN** as pastas existentes são reaproveitadas e apenas os níveis faltantes são
  criados, sem duplicar as pastas já presentes

#### Scenario: Reenvio do mesmo lote não duplica pastas
- **WHEN** uma pessoa reenvia um lote com os mesmos caminhos relativos de um envio
  anterior
- **THEN** nenhuma pasta é duplicada e a árvore resultante permanece idêntica

### Requirement: Envio de pasta ancorado no destino e isolado por unidade

A árvore recriada a partir dos caminhos relativos SHALL, quando o lote informar
uma pasta de destino, ser ancorada **sob essa pasta de destino**, e a pasta de
destino SHALL pertencer à mesma unidade do remetente. Um caminho relativo que
aponte para fora da unidade ou uma pasta de destino de outra unidade NÃO SHALL
ser utilizável, sem revelar a existência de conteúdo de outra unidade.
Referência: PRD US 3.2.

#### Scenario: Árvore ancorada na pasta de destino
- **WHEN** uma pessoa envia uma pasta informando uma pasta de destino da sua unidade
- **THEN** a hierarquia enviada é recriada dentro dessa pasta de destino, preservando
  a estrutura relativa dos arquivos

#### Scenario: Pasta de destino de outra unidade não é utilizável
- **WHEN** uma pessoa tenta enviar uma pasta apontando como destino uma pasta de outra
  unidade
- **THEN** a operação é recusada e nenhuma pasta ou arquivo é criado, sem revelar a
  existência da pasta de outra unidade

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
