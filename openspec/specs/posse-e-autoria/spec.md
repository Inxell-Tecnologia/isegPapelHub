# posse-e-autoria Specification

## Purpose

Define quem é o dono de uma pasta ou arquivo no momento em que ele é criado, como
fica registrado quem realmente o criou ou enviou, e qual acesso o autor mantém
quando não é o dono. Referência: PRD US 2.1, US 3.1, US 3.2, US 8.1.

## Requirements

### Requirement: Item criado dentro de uma pasta pertence ao dono dessa pasta

O sistema SHALL atribuir como dono de toda pasta ou arquivo criado dentro de uma pasta o **dono imediato** dessa pasta, qualquer que seja a via de criação (criar pasta, envio avulso, envio em lote, envio de pasta). Item criado na raiz da unidade SHALL ter como dono quem o criou. Itens já existentes NÃO SHALL ter o dono alterado por esta regra.

#### Scenario: Colaborador cria subpasta na pasta de outra pessoa
- **WHEN** um colaborador com permissão de envio sobre a pasta de Daniel cria uma
  subpasta nela
- **THEN** a subpasta é criada com Daniel como dono

#### Scenario: Colaborador envia arquivo para a pasta de outra pessoa
- **WHEN** um colaborador com permissão de envio sobre a pasta de Daniel envia um
  arquivo para ela
- **THEN** o arquivo é registrado com Daniel como dono

#### Scenario: A regra vale para o dono imediato, em cascata
- **WHEN** um item é criado numa pasta de Daniel que está dentro de uma pasta de Ana
- **THEN** o dono do item é Daniel, dono da pasta em que o item nasce

#### Scenario: Criação na raiz mantém quem cria como dono
- **WHEN** uma pessoa cria uma pasta ou envia um arquivo na raiz da unidade
- **THEN** o item é registrado com essa pessoa como dona

#### Scenario: Criação em pasta própria não muda nada
- **WHEN** o dono de uma pasta cria um item dentro dela
- **THEN** o item é registrado com ele como dono e como autor, sem concessão
  automática

### Requirement: Autoria do item é registrada e preservada

O sistema SHALL registrar, em toda pasta e todo arquivo criados, **quem os criou ou enviou** (autor), de forma independente do dono. A autoria SHALL ser imutável: mover, renomear, substituir versão ou conceder permissões NÃO SHALL alterá-la. Para itens criados antes desta regra, o autor SHALL ser o dono registrado no momento da migração.

#### Scenario: Autor e dono diferentes ficam ambos registrados
- **WHEN** um colaborador envia um arquivo para a pasta de Daniel
- **THEN** o arquivo registra Daniel como dono e o colaborador como autor

#### Scenario: Substituir versão não troca o autor
- **WHEN** outra pessoa com permissão substitui o arquivo por nova versão
- **THEN** o autor registrado do arquivo continua sendo quem o enviou originalmente

#### Scenario: Itens anteriores têm o dono como autor
- **WHEN** um item criado antes desta regra é consultado
- **THEN** o autor registrado é o seu dono

### Requirement: Autor que não é dono recebe concessões automáticas sobre o que criou

O sistema SHALL, na mesma operação que cria um item cujo dono não é o autor, conceder ao autor sobre esse item os verbos `view`, `download` e `rename` e, se o item for pasta, também `upload`. O sistema NUNCA SHALL conceder `delete` automaticamente. As concessões automáticas SHALL ser sem prazo, idempotentes e da mesma unidade do item.

#### Scenario: Autor continua vendo e enviando na subpasta que criou
- **WHEN** um colaborador cria uma subpasta na pasta de Daniel
- **THEN** ele recebe `view`, `download`, `rename` e `upload` sobre a subpasta, a
  enxerga na listagem e pode enviar arquivos para dentro dela

#### Scenario: Autor continua vendo o arquivo que enviou
- **WHEN** um colaborador envia um arquivo para a pasta de Daniel
- **THEN** ele recebe `view`, `download` e `rename` sobre o arquivo e o enxerga na
  listagem da pasta

#### Scenario: Autor não pode excluir o que criou na pasta de outra pessoa
- **WHEN** o autor de uma subpasta criada na pasta de Daniel tenta excluí-la
- **THEN** a exclusão é recusada por falta de permissão, a menos que outra regra
  (posse, administração ou concessão manual de `delete`) a autorize

#### Scenario: Recriar o mesmo caminho não duplica concessões
- **WHEN** um envio de pasta reaproveita uma subpasta já existente criada pelo
  mesmo autor
- **THEN** nenhuma concessão duplicada é criada e nenhuma operação falha por isso

#### Scenario: Falha na criação não deixa concessão órfã
- **WHEN** a criação do item é recusada ou falha
- **THEN** nenhuma concessão automática é registrada

### Requirement: Dono da pasta enxerga o que outros criaram nela

O sistema SHALL tratar como de posse do dono da pasta, para toda resolução de acesso, os itens criados nela por outras pessoas a partir desta regra, sem introduzir herança de permissão por ancestral.

#### Scenario: Dono vê o arquivo depositado por colaborador
- **WHEN** Daniel, sem ser administrador da unidade, abre a própria pasta após um
  colaborador ter enviado um arquivo para ela
- **THEN** o arquivo aparece na listagem e Daniel pode visualizá-lo, baixá-lo,
  renomeá-lo, movê-lo e excluí-lo como dono

#### Scenario: Ser dono de pasta não concede acesso ao que já existia de terceiros
- **WHEN** a pasta de Daniel contém um item criado por outra pessoa antes desta
  regra, com essa pessoa como dona
- **THEN** o item continua sendo resolvido pela regra de acesso vigente, sem que a
  posse da pasta conceda acesso a ele
