# Spec Delta

## Purpose

Reúne, num só destino, o acervo que a pessoa alcança **por concessão recebida** —
a contrapartida da permissão granular, que sem herança pode liberar um recurso em
qualquer profundidade de uma árvore que a pessoa não percorre. Define o que compõe
a lista, que alcance ela tem e o que o acionamento de cada item faz.

## ADDED Requirements

### Requirement: A lista apresenta os recursos alcançados por concessão recebida

O sistema SHALL apresentar, num destino próprio da navegação, as pastas e os
arquivos sobre os quais a pessoa tem concessão vigente como destinatária. O
destino SHALL estar disponível a **qualquer papel autenticado**, por não ser item
de administração. A lista NÃO SHALL incluir concessão cuja destinatária seja
outra pessoa, qualquer que seja o papel de quem consulta. Referência: PRD US 4.4;
US 4.1.

#### Scenario: Pasta e arquivo concedidos compõem a lista
- **WHEN** uma pessoa com concessão vigente sobre uma pasta e sobre um arquivo de
  outra pessoa abre o destino
- **THEN** vê os dois itens, cada um identificado como pasta ou como arquivo

#### Scenario: Colaborador alcança o destino
- **WHEN** uma pessoa de papel `collaborator` percorre os destinos da navegação
- **THEN** encontra o destino de compartilhados e o abre sem recusa

#### Scenario: Concessão de terceiro não compõe a lista
- **WHEN** existe concessão vigente sobre um recurso para outra pessoa, e quem
  consulta não tem concessão própria sobre ele
- **THEN** o recurso não aparece na lista de quem consulta, nem seu nome, nem a
  pasta que o contém

#### Scenario: Sem concessão recebida, a tela orienta
- **WHEN** uma pessoa sem nenhuma concessão vigente recebida abre o destino
- **THEN** a tela explica que nada foi compartilhado com ela, em vez de
  apresentar uma tabela vazia sem explicação

### Requirement: A lista é ordenada do compartilhamento mais recente para o mais antigo

O sistema SHALL ordenar os itens pela data da concessão, do mais recente para o
mais antigo, e SHALL informar essa data em cada item. Quando um recurso reúne
concessões de datas diferentes, a data considerada SHALL ser a mais recente
delas. Referência: PRD US 4.4; US 11.2 (mesmo critério da lista de recentes).

#### Scenario: O compartilhamento mais recente vem primeiro
- **WHEN** a pessoa recebeu concessões sobre recursos distintos em datas
  diferentes
- **THEN** vê os itens ordenados do compartilhamento mais recente para o mais
  antigo, cada um com a sua data

#### Scenario: Verbo acrescentado depois atualiza a posição do item
- **WHEN** a administração acrescenta hoje um verbo sobre recurso concedido à
  pessoa meses atrás
- **THEN** o item passa a figurar pela data mais recente das suas concessões

### Requirement: Cada recurso ocupa um único item, com o conjunto dos verbos concedidos

O sistema SHALL apresentar **um item por recurso**, reunindo nele todos os verbos
vigentes concedidos àquela pessoa sobre aquele recurso, em vez de um item por
concessão. Acrescentar verbo sobre recurso já listado NÃO SHALL produzir item
adicional. Referência: PRD US 4.1, cenário de concessão de múltiplos verbos.

#### Scenario: Dois verbos sobre o mesmo arquivo formam um item
- **WHEN** a pessoa tem `view` e `download` vigentes sobre o mesmo arquivo
- **THEN** vê um único item para esse arquivo, indicando que pode visualizar e
  baixar

#### Scenario: Verbo acrescentado não duplica o item
- **WHEN** a administração acrescenta um verbo sobre um recurso que já constava
  da lista da pessoa
- **THEN** o item continua único, agora indicando também o verbo acrescentado

### Requirement: Somente a concessão vigente compõe a lista

O sistema SHALL avaliar a vigência de cada concessão **no momento da consulta,
pelo relógio do servidor**, sem depender de nenhuma rotina programada, e SHALL
excluir da lista a concessão cujo prazo já tenha sido atingido. A lista SHALL
informar o **prazo** de cada item que o tenha. Referência: PRD US 4.3; design.md
D2 do change `expiracao-permissoes`.

#### Scenario: Concessão sem prazo compõe a lista sem vencimento
- **WHEN** a pessoa tem concessão permanente sobre um recurso
- **THEN** o item aparece, sem indicação de prazo

#### Scenario: Concessão com prazo futuro informa o vencimento
- **WHEN** a pessoa tem concessão com prazo futuro sobre um recurso
- **THEN** o item aparece informando até quando o acesso vale

#### Scenario: Concessão vencida não compõe a lista
- **WHEN** o prazo de uma concessão foi atingido
- **THEN** o recurso não aparece na lista, ainda que a concessão permaneça
  registrada para a administração

#### Scenario: O vencimento retira o item sem rotina ter rodado
- **WHEN** uma concessão vence entre duas consultas e nenhuma rotina programada
  foi executada nesse intervalo
- **THEN** o recurso deixa de aparecer na consulta seguinte

### Requirement: Recurso de que a pessoa é dona não compõe a lista

O sistema NÃO SHALL apresentar nesta lista recurso cuja dona seja a própria
pessoa, mesmo que exista concessão registrada para ela sobre esse recurso. Dono
alcança o recurso pela navegação, e a concessão é inerte na resolução de acesso —
apresentá-lo como compartilhado afirmaria origem de acesso que não é a real.
Referência: PRD US 4.1.

#### Scenario: Concessão redundante sobre recurso próprio não aparece
- **WHEN** existe concessão vigente para a pessoa sobre um arquivo de que ela
  própria é dona
- **THEN** o arquivo não aparece na lista de compartilhados

### Requirement: A lista de compartilhados não amplia alcance

O sistema SHALL apresentar exclusivamente recursos que a pessoa já poderia
alcançar pela resolução de acesso. A lista SHALL compor-se com as regras
restritivas já vigentes — documento obsoleto, arquivo pendente de cadastro e item
na lixeira — e NUNCA SHALL conceder alcance que elas neguem. NÃO SHALL apresentar
recurso de outra unidade, qualquer que seja o papel de quem consulta.
Referência: PRD US 4.4; US 10.7; US 10.9; Épico 5.

#### Scenario: A lista não atravessa unidades
- **WHEN** existe concessão registrada sobre recurso de outra unidade
- **THEN** o recurso não aparece na lista, inclusive para o administrador global

#### Scenario: Documento obsoleto não aparece a quem não é gestão
- **WHEN** um colaborador tem concessão vigente sobre documento declarado
  obsoleto
- **THEN** o documento não aparece na lista, pela mesma regra que o retira da
  listagem, da busca e do acesso direto

#### Scenario: Arquivo pendente de cadastro não aparece a quem não o enviou
- **WHEN** uma pessoa tem concessão vigente sobre arquivo pendente de cadastro
  enviado por outra pessoa, e não é administradora da unidade
- **THEN** o arquivo não aparece na lista

#### Scenario: Item na lixeira não aparece
- **WHEN** um recurso sobre o qual a pessoa tem concessão vigente é excluído e
  está na lixeira
- **THEN** o recurso não aparece na lista, e a ausência é indistinguível de
  recurso inexistente

#### Scenario: Perda de acesso remove o item da lista
- **WHEN** a concessão que compunha um item é revogada
- **THEN** o item deixa de aparecer na consulta seguinte, sem mensagem de erro

### Requirement: A localização do item é a pasta que o contém

O sistema SHALL apresentar, para cada item, o nome da pasta que o contém, e NÃO
SHALL apresentar a cadeia de pastas ancestrais. A ausência de herança faz com que
o recurso concedido esteja frequentemente sob pastas que a pessoa não alcança;
nomeá-las revelaria estrutura fora do seu alcance. Referência: PRD US 4.1,
cenário 2; US 11.2.

#### Scenario: Arquivo em profundidade informa apenas a pasta que o contém
- **WHEN** a pessoa tem concessão sobre um arquivo cujas pastas intermediárias
  ela não alcança
- **THEN** o item informa o nome da pasta que contém o arquivo, e nenhum nome de
  pasta ancestral acima dela

#### Scenario: Recurso na raiz informa a raiz
- **WHEN** o recurso concedido está no primeiro nível da unidade
- **THEN** o item indica que está na raiz, em vez de deixar a localização vazia

### Requirement: Acionar um item alcança o recurso sem percorrer a árvore

O sistema SHALL permitir alcançar o recurso diretamente a partir do item, sem
exigir que a pessoa navegue pelas pastas que o contêm: um arquivo SHALL abrir na
visualização e uma pasta SHALL abrir no explorador daquela pasta. Referência: PRD
US 4.1; US 9.3.

#### Scenario: Arquivo abre na visualização
- **WHEN** a pessoa aciona um item de arquivo sobre o qual tem `view`
- **THEN** o arquivo abre na visualização, sem que ela tenha de abrir a pasta que
  o contém

#### Scenario: Pasta abre no explorador
- **WHEN** a pessoa aciona um item de pasta sobre a qual tem `view`
- **THEN** o explorador apresenta o conteúdo que ela alcança dentro daquela pasta

### Requirement: O item oferece apenas as ações cujos verbos foram concedidos

O sistema SHALL oferecer, em cada item, somente as ações correspondentes aos
verbos vigentes daquela pessoa sobre aquele recurso, de modo que nenhuma ação
apresentada resulte em recusa ao ser acionada. A ausência do verbo `view` NÃO
SHALL impedir a apresentação do item quando outro verbo o alcance. Referência:
PRD US 4.1; capability `tela-inicial` ("atalho apresentado conduz a uma ação
executável").

#### Scenario: Concessão apenas de download não oferece visualizar
- **WHEN** a pessoa tem somente `download` vigente sobre um arquivo
- **THEN** o item oferece baixar e não oferece visualizar

#### Scenario: Concessão apenas de visualizar não oferece baixar
- **WHEN** a pessoa tem somente `view` vigente sobre um arquivo
- **THEN** o item oferece visualizar e não oferece baixar
