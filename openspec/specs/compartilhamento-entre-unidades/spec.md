# compartilhamento-entre-unidades Specification

## Purpose

Define o compartilhamento somente leitura de pastas e arquivos entre a
unidade marcada como SEDE e as demais unidades (PRD Épico 5, US 5.2). É uma
exceção controlada ao isolamento por unidade: tem a SEDE numa das pontas,
alcança uma pessoa ou uma unidade inteira, inclui a subárvore da pasta e
cobre só visualizar e baixar. O alcance é resolvido no servidor a cada
requisição, sem afrouxar a RLS por `unit_id` nem a resolução comum de
`hasAccess`.

## Requirements

### Requirement: Concessão de compartilhamento entre unidades

O servidor SHALL permitir que o `global_admin` e o `unit_admin` compartilhem
uma pasta ou um arquivo **da própria unidade** com uma unidade de destino
inteira ou com pessoas ativas dessa unidade de destino, com os verbos `view`
e/ou `download` e prazo de expiração opcional. As recusas são as
seguintes. Colaborador recebe 403. Recurso inexistente, na lixeira ou de
outra unidade recebe 404, sem distinguir os casos. Destino igual à origem,
destino inativo ou par origem/destino sem a SEDE numa das pontas recebe 422
`cross_unit_destination_not_allowed`. Verbo diferente de `view`/`download`
ou prazo não futuro recebe 400. Pessoa inexistente, inativa ou de unidade
diferente da de destino recebe 404, tudo ou nada, sem apontar qual. Reconceder o mesmo verbo ao mesmo destino SHALL
atualizar prazo e autor, sem duplicar. Referência: PRD US 5.2, cenários 1 a
3; design.md D7.

#### Scenario: Administradora Global compartilha pasta da SEDE com uma unidade
- **WHEN** a `global_admin` da SEDE compartilha a pasta Governança com a
  Unidade Norte, com o verbo `view`
- **THEN** a concessão é criada com origem SEDE e destino Unidade Norte
  inteira, e a resposta é 201

#### Scenario: Compartilhamento com pessoa de outra unidade
- **WHEN** a `global_admin` da SEDE compartilha a pasta Governança com a
  Raíra, da Unidade Norte, com `view`
- **THEN** a concessão é criada com destino Unidade Norte e pessoa Raíra

#### Scenario: Administrador de unidade compartilha com a SEDE
- **WHEN** o `unit_admin` da Unidade Norte compartilha um arquivo da Unidade
  Norte com a SEDE
- **THEN** a concessão é criada

#### Scenario: Unidade não compartilha com outra unidade que não a SEDE
- **WHEN** o `unit_admin` da Unidade Norte tenta compartilhar um item com a
  Unidade Sul, e nenhuma das duas é a SEDE
- **THEN** a resposta é 422 `cross_unit_destination_not_allowed` e nada é
  gravado

#### Scenario: Verbo de escrita é recusado
- **WHEN** um administrador tenta compartilhar com outra unidade incluindo
  `upload`, `rename` ou `delete`
- **THEN** a resposta é 400 e nada é gravado

#### Scenario: Administrador não compartilha conteúdo de outra unidade
- **WHEN** a `global_admin` da SEDE tenta compartilhar um item que pertence à
  Unidade Norte
- **THEN** a resposta é 404, indistinguível de item inexistente

#### Scenario: Pessoa que não pertence ao destino
- **WHEN** a concessão informa uma pessoa que não é da unidade de destino
- **THEN** a resposta é 404 e nenhuma concessão da requisição é gravada

### Requirement: Pasta compartilhada entre unidades inclui a subárvore

O compartilhamento entre unidades de uma pasta SHALL alcançar a própria
pasta e todo o conteúdo dela, em qualquer profundidade, inclusive itens
criados, enviados ou movidos para dentro depois da concessão. A cobertura
SHALL ser avaliada no momento da requisição: item movido para fora deixa de
ser alcançado na requisição seguinte. Esta inclusão da subárvore NÃO SHALL
alterar a regra sem herança da concessão comum dentro da unidade (US 4.1,
cenário 2). Referência: PRD US 5.2, cenário 1; design.md D5.

#### Scenario: Documento interno é alcançado
- **WHEN** a pasta Governança foi compartilhada com a Unidade Norte e uma
  pessoa da Unidade Norte pede para visualizar um arquivo em
  Governança/Atas
- **THEN** a URL de visualização é emitida

#### Scenario: Item adicionado depois entra no compartilhamento
- **WHEN** um arquivo novo é enviado para dentro da pasta compartilhada
- **THEN** a pessoa do destino o alcança sem nova concessão

#### Scenario: Item movido para fora sai do compartilhamento
- **WHEN** um arquivo é movido de dentro da pasta compartilhada para fora
  dela
- **THEN** a pessoa do destino é recusada ao pedi-lo na requisição seguinte

#### Scenario: Concessão comum continua sem herança
- **WHEN** uma pasta recebe concessão comum `view` dentro da própria unidade
- **THEN** o conteúdo interno continua acessível só por concessão explícita,
  como antes

### Requirement: Alcance do compartilhamento entre unidades é somente leitura e não amplia o restante

A pessoa da unidade de destino SHALL alcançar o conteúdo compartilhado só
para visualizar (verbo `view`) e baixar (verbo `download`), conforme os
verbos concedidos. Ela NÃO SHALL enviar, criar pasta, renomear, substituir,
mover, excluir, restaurar, gerir permissões nem favoritar item de outra
unidade. Fora do compartilhamento, toda via (navegação, link direto por id)
SHALL recusar como antes, sem distinguir o item fora do compartilhamento de
um item inexistente. Documento obsoleto, arquivo pendente de cadastro e item
na lixeira dentro da pasta compartilhada SHALL resolver como inexistentes
para o destino: a subtração vence a concessão. Referência: PRD US 5.2,
cenários 4 e 5; design.md D4/D6.

#### Scenario: Item fora do compartilhamento
- **WHEN** uma pessoa da Unidade Norte, com a Governança compartilhada, pede
  a URL de um arquivo da SEDE fora da Governança
- **THEN** a resposta é a mesma recusa dada a um item inexistente, e nenhuma
  URL é emitida nem auditada

#### Scenario: Verbo não concedido
- **WHEN** a pasta foi compartilhada só com `view` e a pessoa do destino pede
  a URL de download de um arquivo interno
- **THEN** a resposta é 403 e nenhuma URL é emitida

#### Scenario: Escrita em conteúdo compartilhado
- **WHEN** a pessoa do destino tenta enviar, renomear, mover ou excluir um
  item compartilhado
- **THEN** a operação é recusada como se o item não existisse

#### Scenario: Obsoleto, pendente e lixeira ficam de fora
- **WHEN** um arquivo dentro da pasta compartilhada está obsoleto, pendente
  de cadastro ou na lixeira
- **THEN** a pessoa do destino é recusada ao pedi-lo, e ele não aparece na
  listagem da pasta

#### Scenario: Terceira unidade não alcança
- **WHEN** a Governança foi compartilhada com a Unidade Norte e uma pessoa da
  Unidade Sul pede um arquivo dela
- **THEN** a resposta é a recusa de item inexistente

### Requirement: Vigência, revogação e dependência da SEDE avaliadas a cada requisição

O servidor SHALL considerar um compartilhamento entre unidades válido
somente enquanto todas as condições a seguir forem verdadeiras: o prazo não
venceu (pelo relógio do banco); a concessão não foi revogada; uma das pontas
é, naquele momento, a unidade marcada como SEDE; a unidade de origem está
ativa; e, na concessão por pessoa, ela continua pertencendo à unidade de
destino. Faltando qualquer condição, o acesso SHALL terminar na requisição
seguinte, sem depender de rotina programada, e a concessão SHALL voltar a
valer se a condição for restabelecida antes do vencimento. Somente o
administrador da unidade de origem (`global_admin` ou `unit_admin` dela)
SHALL listar e revogar os compartilhamentos de um recurso. Referência: PRD
US 5.2, cenário 6; design.md D4/D11.

#### Scenario: Prazo vencido
- **WHEN** o prazo do compartilhamento é atingido
- **THEN** a pessoa do destino é recusada na requisição seguinte

#### Scenario: Revogação
- **WHEN** o administrador da origem revoga o compartilhamento
- **THEN** a pessoa do destino é recusada na requisição seguinte

#### Scenario: SEDE desmarcada adormece o compartilhamento
- **WHEN** a marcação de SEDE é removida da unidade de origem
- **THEN** os compartilhamentos que dependiam dela deixam de valer, sem ser
  apagados, e voltam a valer se a marcação for restabelecida

#### Scenario: Pessoa transferida de unidade
- **WHEN** a pessoa destinatária passa a pertencer a outra unidade
- **THEN** a concessão por pessoa deixa de valer para ela

#### Scenario: Destino não gere o compartilhamento
- **WHEN** o administrador da unidade de destino tenta listar ou revogar um
  compartilhamento recebido
- **THEN** a resposta é 404

### Requirement: Leitura de outra unidade só em transação de visita confinada à origem

O servidor SHALL ler linhas de outra unidade, em nome de uma pessoa, apenas
numa transação de visita. Nessa transação, o contexto RLS é a unidade de
origem, com papel sem bypass (`shared_visitor`). A transação só é aberta
pelo módulo de compartilhamento entre unidades, depois de a transação
própria da pessoa encontrar compartilhamento vigente vindo daquela origem, e
SHALL reconfirmar o compartilhamento dentro de si antes de qualquer uso. A
unidade de origem NÃO SHALL vir de valor informado pelo solicitante. A
resolução comum (`hasAccess`) SHALL ser tentada primeiro e permanecer
inalterada. Referência: design.md D3/D4.

#### Scenario: A visita não alcança terceira unidade
- **WHEN** uma transação de visita está aberta com origem SEDE
- **THEN** linhas de qualquer unidade diferente da SEDE não são visíveis
  nela, inclusive as da própria unidade da pessoa

#### Scenario: Só o módulo de compartilhamento abre visita
- **WHEN** a suíte de testes inspeciona o código da API
- **THEN** nenhum módulo além do de compartilhamento entre unidades chama a
  abertura de transação de visita

#### Scenario: Quem já tem acesso comum não passa pela visita
- **WHEN** o dono de um arquivo pede a URL de visualização dele
- **THEN** o acesso é resolvido pelo caminho comum, sem transação de visita
