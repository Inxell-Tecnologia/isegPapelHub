# favoritos Specification

## Purpose
TBD - created by archiving change favoritos. Update Purpose after archive.

## Requirements

### Requirement: Pessoa marca e desmarca favoritos sobre o que alcança

O sistema SHALL permitir a qualquer pessoa autenticada marcar como favorito uma
pasta ou um arquivo que ela possa visualizar, e desmarcá-lo. Marcar recurso que
ela não alcança SHALL ser recusado com a mesma resposta de recurso inexistente,
sem distinguir o motivo. Marcar o que já é favorito e desmarcar o que não é
SHALL ser aceitos sem erro e sem efeito adicional. Referência: PRD US 2.5;
demanda do cliente nº 2, tabela 1.1.

#### Scenario: Marcar arquivo alcançável
- **WHEN** uma pessoa marca como favorito um arquivo que pode visualizar
- **THEN** o arquivo passa a constar da sua lista de favoritos

#### Scenario: Marcar recurso fora do alcance é recusado como inexistente
- **WHEN** uma pessoa tenta marcar um recurso sem permissão de visualizar, de
  outra unidade ou na lixeira
- **THEN** a marcação é recusada com a mesma resposta de recurso inexistente, e
  nada é registrado

#### Scenario: Marcar duas vezes não duplica
- **WHEN** uma pessoa marca de novo um recurso que já é seu favorito
- **THEN** a operação é aceita e a lista continua com um único item para ele

#### Scenario: Desmarcar sem alcance é permitido
- **WHEN** uma pessoa que perdeu o acesso a um favorito pede para desmarcá-lo
- **THEN** a marca é removida, sem revelar nada sobre o recurso

### Requirement: Favoritos têm teto por pessoa

O sistema SHALL limitar a quantidade de favoritos por pessoa a um teto
configurável, e SHALL recusar a marcação que o exceda com motivo próprio, que
oriente a desmarcar favoritos. Referência: PRD US 2.5.

#### Scenario: Marcação acima do teto é recusada
- **WHEN** uma pessoa que já atingiu o teto de favoritos marca mais um recurso
- **THEN** a marcação é recusada com motivo que informa o limite atingido

### Requirement: A lista de favoritos é pessoal e ordenada

O sistema SHALL apresentar, num destino próprio da navegação disponível a
qualquer papel autenticado, as pastas e os arquivos que a pessoa marcou, do
marcado mais recentemente para o mais antigo, com a data da marcação. NÃO SHALL
apresentar favoritos de outra pessoa, qualquer que seja o papel de quem
consulta. Sem favoritos, a tela SHALL orientar como marcá-los. Referência: PRD
US 2.5.

#### Scenario: Ordem da marcação mais recente para a mais antiga
- **WHEN** a pessoa marcou recursos em instantes diferentes
- **THEN** vê os itens do marcado mais recentemente para o mais antigo, cada um
  com a data da marcação

#### Scenario: Favorito de outra pessoa não aparece
- **WHEN** outra pessoa marcou um recurso que quem consulta também alcança
- **THEN** o recurso não aparece na lista de quem consulta, inclusive para o
  administrador da unidade

#### Scenario: Sem favoritos, a tela orienta
- **WHEN** uma pessoa sem nenhum favorito abre o destino
- **THEN** a tela explica como marcar um favorito, em vez de apresentar uma
  tabela vazia sem explicação

### Requirement: Favorito não é permissão

A marca de favorito NÃO SHALL conceder acesso algum. A lista SHALL apresentar
somente os favoritos que a resolução de acesso libera no momento da consulta, e
SHALL compor-se com as regras restritivas vigentes — documento obsoleto, arquivo
pendente de cadastro, item na lixeira e isolamento por unidade. Perder o acesso
SHALL ocultar o item sem mensagem de erro e sem apagar a marca; recuperar o
acesso SHALL fazê-lo voltar. Referência: PRD US 2.5; US 4.3; US 10.7; US 10.9;
Épico 5.

#### Scenario: Concessão vencida oculta o favorito
- **WHEN** a concessão que liberava um favorito vence
- **THEN** o item deixa de aparecer na consulta seguinte, sem rotina ter rodado e
  sem mensagem de erro

#### Scenario: Acesso recuperado devolve o favorito
- **WHEN** a pessoa volta a receber acesso a um recurso que tinha marcado
- **THEN** o item volta a aparecer na lista, sem precisar ser marcado de novo

#### Scenario: Documento obsoleto não aparece a quem não é gestão
- **WHEN** um colaborador tem como favorito um documento depois declarado
  obsoleto
- **THEN** o documento não aparece na sua lista

#### Scenario: Item na lixeira não aparece e volta ao ser restaurado
- **WHEN** um recurso favoritado vai para a lixeira e depois é restaurado
- **THEN** ele some da lista enquanto está na lixeira e volta a aparecer depois
  de restaurado

### Requirement: Item da lista segue a forma da listagem plana

Cada item SHALL apresentar o nome da pasta que o contém — ou a indicação de
raiz — e NÃO SHALL apresentar a cadeia de pastas ancestrais. Acionar um arquivo
SHALL abri-lo na visualização e acionar uma pasta SHALL abri-la no explorador.
O item SHALL oferecer somente as ações que a pessoa pode executar sobre o
recurso, resolvidas pelo servidor, além de remover dos favoritos. Referência:
PRD US 2.5; capability `compartilhados-comigo` (mesma forma).

#### Scenario: Arquivo em profundidade informa só a pasta que o contém
- **WHEN** a pessoa tem como favorito um arquivo cujas pastas intermediárias ela
  não alcança
- **THEN** o item informa a pasta que contém o arquivo e nenhum nome de pasta
  acima dela

#### Scenario: Sem verbo de baixar, a ação de baixar não aparece
- **WHEN** a pessoa pode visualizar mas não baixar um arquivo favoritado
- **THEN** o item oferece visualizar e remover dos favoritos, e não oferece
  baixar

#### Scenario: Remover da lista desmarca o favorito
- **WHEN** a pessoa aciona "Remover dos favoritos" num item
- **THEN** o item sai da lista e o recurso deixa de ser favorito
