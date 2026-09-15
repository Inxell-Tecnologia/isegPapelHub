## ADDED Requirements

### Requirement: Seleção de várias pastas e arquivos por arrastar e soltar

A SPA SHALL oferecer, no explorador, uma área que aceite **pastas e arquivos
soltos de uma só vez** por arrastar e soltar, tratando o conjunto como um envio
único para a pasta corrente. A SPA SHALL percorrer recursivamente cada pasta
solta e SHALL derivar o caminho relativo de cada arquivo do mesmo modo que na
seleção pelo seletor de pasta, de forma que a hierarquia de **todas** as pastas
soltas seja recriada preservada.

A SPA SHALL manter os acionadores de seleção por botão — envio de arquivos e
envio de pasta — em conjunto com a área de soltar, e NÃO SHALL torná-los
dependentes dela: arrastar e soltar não é acionável por teclado nem existe em
aparelhos de toque. A área de soltar SHALL seguir a mesma regra de
indisponibilidade por dispositivo já aplicada ao envio de pasta, de modo que em
celular e tablet o envio de arquivos avulsos permaneça íntegro.

Referência: PRD US 3.2, RF #6; design.md D1 do change
`envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Duas pastas soltas juntas viram um envio só
- **WHEN** o usuário arrasta duas ou mais pastas e as solta na área de envio
- **THEN** todos os arquivos das pastas são reunidos num único envio e a
  hierarquia de cada pasta é recriada preservada dentro da pasta corrente

#### Scenario: Pastas e arquivos soltos misturados na mesma interação
- **WHEN** o usuário solta, ao mesmo tempo, pastas e arquivos que não pertencem a
  pasta alguma
- **THEN** os arquivos soltos vão para a pasta corrente e os das pastas vão para
  as subpastas correspondentes, tudo no mesmo envio

#### Scenario: Botões de envio permanecem disponíveis
- **WHEN** o usuário prefere selecionar pelos botões, ou usa teclado, ou está em
  um aparelho sem arrastar e soltar
- **THEN** os acionadores de envio de arquivos e de envio de pasta continuam
  disponíveis e funcionais

### Requirement: Verificação de viabilidade antes de qualquer transferência

A SPA SHALL analisar a seleção **antes** de transferir qualquer byte, apurando a
quantidade de arquivos e a soma dos tamanhos sem ler o conteúdo dos arquivos, e
SHALL confrontar esse total com o espaço disponível consultado ao servidor.
Nenhuma transferência e nenhum pedido de URL assinada SHALL ocorrer antes desse
veredito.

A SPA SHALL apresentar um estado de análise em andamento enquanto percorre a
seleção, com possibilidade de cancelar, já que percorrer milhares de entradas
leva tempo perceptível. A SPA NÃO SHALL inferir a cota localmente: o espaço
disponível SHALL vir da consulta ao servidor, e o veredito SHALL ser tratado como
retrato do instante, sem substituir a validação que o servidor faz a cada pedido
de URLs.

Quando a seleção couber, a SPA SHALL apresentar um resumo do que será enviado —
quantidade de arquivos e volume — e SHALL aguardar confirmação antes de iniciar,
já que um envio pode durar dezenas de minutos.

Referência: PRD US 3.1, RF #13; design.md D2/D3 do change
`envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Seleção inviável não transfere nada
- **WHEN** a seleção do usuário é maior que o espaço disponível
- **THEN** nenhum arquivo é transferido, nenhuma URL de envio é solicitada, e o
  usuário recebe o veredito antes de qualquer espera

#### Scenario: Análise de seleção grande é visível e cancelável
- **WHEN** o usuário solta uma seleção com milhares de arquivos
- **THEN** a SPA indica que está analisando a seleção e permite cancelar antes de
  qualquer requisição

#### Scenario: Envio viável é confirmado antes de começar
- **WHEN** a seleção cabe no espaço disponível
- **THEN** a SPA apresenta a quantidade de arquivos e o volume a enviar e só
  inicia a transferência após confirmação

### Requirement: Recusa por espaço detalha onde o espaço está preso

A SPA SHALL informar, ao recusar uma seleção por falta de espaço, o volume da
seleção, o volume disponível, o quanto falta, e a **decomposição do espaço
utilizado** entre arquivos ativos, arquivos retidos na lixeira e envios ainda
não reconciliados. A recusa SHALL declarar explicitamente que **excluir arquivos
não libera espaço de imediato**, informando que o espaço retido na lixeira
retorna somente após o prazo de retenção.

A SPA NÃO SHALL orientar o usuário a excluir arquivos como forma de liberar
espaço para o envio corrente, porque a exclusão move o arquivo para a lixeira sem
devolver cota até o expurgo por retenção — orientação que produziria uma nova
tentativa idêntica e igualmente recusada.

A SPA SHALL oferecer, como saída imediata, enviar apenas o subconjunto da
seleção que cabe no espaço disponível, identificando com clareza o que ficou de
fora.

Referência: PRD US 3.1, RF #13; design.md D4 do change
`envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Recusa mostra a decomposição do espaço
- **WHEN** a seleção não cabe no espaço disponível
- **THEN** o usuário vê o volume pedido, o disponível, o que falta, e quanto do
  seu espaço está em arquivos ativos, na lixeira e em envios pendentes

#### Scenario: Recusa desmente a expectativa de liberação imediata
- **WHEN** a recusa é apresentada e parte do espaço está retido na lixeira
- **THEN** a mensagem informa que excluir arquivos não libera espaço de imediato e
  que o espaço da lixeira retorna após o prazo de retenção

#### Scenario: Enviar só o que cabe
- **WHEN** o usuário opta por enviar apenas o que cabe no espaço disponível
- **THEN** a SPA envia esse subconjunto e identifica quais arquivos ficaram de
  fora

### Requirement: Envio dividido em fatias com URLs pedidas por fatia

A SPA SHALL dividir o envio em fatias limitadas por quantidade de itens **e** por
volume de bytes, o que for atingido primeiro, e SHALL solicitar as URLs
assinadas de cada fatia **imediatamente antes** de transferi-la, nunca todas de
uma vez no início. Cada fatia SHALL respeitar o teto de itens por requisição
imposto pelo servidor, de modo que o uso normal jamais o atinja.

A divisão em fatias SHALL ser **invisível ao usuário**: o envio SHALL ser
apresentado como uma operação única, e a SPA NÃO SHALL impor ao usuário um limite
próprio de quantidade de arquivos por envio — a única recusa por tamanho SHALL
ser a justificada pelo espaço disponível.

A fila de transferências simultâneas SHALL atravessar as fatias sem reiniciar a
cada uma, de modo que a transição entre fatias não interrompa o fluxo de
transferência.

Referência: PRD US 3.1, US 3.2; design.md D5 do change
`envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Envio grande é fatiado sem o usuário perceber
- **WHEN** o usuário confirma o envio de uma seleção maior que uma fatia
- **THEN** a SPA transfere tudo como uma única operação aos olhos do usuário,
  solicitando as URLs de cada fatia pouco antes de usá-las

#### Scenario: Fatia respeita o limite de volume além do de itens
- **WHEN** uma fatia atingiria o limite de bytes antes do limite de itens
- **THEN** a fatia é fechada pelo limite de bytes, com menos itens que o máximo

#### Scenario: Não há limite próprio de quantidade por envio
- **WHEN** o usuário seleciona uma quantidade de arquivos muito acima do teto de
  uma requisição
- **THEN** a SPA não recusa por quantidade, e decide apenas pelo espaço
  disponível

### Requirement: Progresso macro do envio medido em bytes

A SPA SHALL apresentar o andamento do envio como um progresso **único do
conjunto**, medido pela proporção de **bytes transferidos** sobre o total de
bytes do envio, e NÃO SHALL medir esse progresso pela contagem de arquivos
concluídos. A quantidade de arquivos concluídos, o arquivo em transferência e a
quantidade de falhas SHALL ser apresentados como informação complementar ao
progresso, não como sua medida.

A SPA NÃO SHALL renderizar um indicador de progresso por arquivo para o conjunto
inteiro, de modo que um envio com milhares de arquivos não degrade a interface
durante a transferência. Os arquivos que falharem SHALL ser contabilizados e
SHALL poder ser listados sob demanda, mantendo a nova tentativa por item
disponível.

Referência: PRD US 3.1 (cenário 1), RF #6; design.md D6 do change
`envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Progresso avança proporcional aos bytes
- **WHEN** um envio contém arquivos de tamanhos muito diferentes entre si
- **THEN** o progresso avança proporcionalmente aos bytes transferidos, e não em
  saltos iguais por arquivo concluído

#### Scenario: Envio com milhares de arquivos não lista um por um
- **WHEN** um envio contém milhares de arquivos
- **THEN** a SPA exibe um progresso único do conjunto, sem renderizar um
  indicador por arquivo

#### Scenario: Falhas são contadas e detalháveis sob demanda
- **WHEN** alguns arquivos do envio falham
- **THEN** a quantidade de falhas é exibida junto ao progresso e o usuário pode
  listar os arquivos que falharam e repetir cada um deles

### Requirement: Falta de espaço durante o envio pausa e reapresenta o veredito

A SPA SHALL **pausar** o envio quando uma fatia for recusada por falta de
espaço, e NÃO SHALL prosseguir para as fatias seguintes. Os arquivos já
transferidos SHALL permanecer enviados. A SPA SHALL reconsultar o espaço
disponível e SHALL reapresentar o mesmo detalhamento da recusa por espaço,
informando quantos arquivos do envio ficaram por transferir.

A pausa SHALL deixar explícito que o envio ficou **incompleto**, já que a
hierarquia recriada no destino refletirá apenas a parte transferida.

Referência: PRD US 3.1 (cenário 2), RF #13; design.md D7 do change
`envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Cota esgotada no meio do envio pausa o restante
- **WHEN** o espaço disponível se esgota durante um envio já em andamento
- **THEN** a SPA interrompe o envio das fatias seguintes, preserva o que já foi
  transferido e apresenta o detalhamento do espaço com o que falta enviar

#### Scenario: Envio pausado é sinalizado como incompleto
- **WHEN** um envio é pausado por falta de espaço
- **THEN** o usuário é informado de que o envio ficou incompleto e de quantos
  arquivos não foram transferidos

## MODIFIED Requirements

### Requirement: Envio de múltiplos arquivos com progresso individual

A cláusula de **progresso próprio de cada arquivo** é substituída pelo progresso
macro do conjunto — ver o requisito "Progresso macro do envio medido em bytes"
desta mesma fatia. O restante do requisito permanece: a chamada única de lote por
fatia, os itens por arquivo e o PUT direto ao GCS na URL assinada continuam
valendo, e o desfecho de cada arquivo continua independente dos demais.

A perda do progresso por item é consciente (design.md D6): com 2.000 arquivos,
renderizar um indicador por item trava a aba **antes** do envio — e o envio ainda
precisa rodar por dezenas de minutos naquela mesma aba. O detalhe por item
permanece onde é acionável: a lista de falhas, curta por natureza.

#### Scenario: Progresso individual de cada arquivo do lote
- **WHEN** o usuário seleciona vários arquivos e inicia o envio
- **THEN** a SPA pede as URLs assinadas de cada fatia numa única chamada e
  apresenta um progresso único do conjunto, sinalizando ao final quantos
  arquivos concluíram e quantos falharam, com o desfecho de cada um
  independente dos demais

### Requirement: Recusa antecipada de seleção acima do teto de itens por requisição

A recusa **antecipada pela SPA** deixa de existir: com o envio dividido em fatias
abaixo do teto por requisição, o teto deixou de ser alcançável por uso normal, e
apresentá-lo ao usuário seria anunciar um limite que ele nunca encontra —
justamente o limite que o requisito "Envio dividido em fatias com URLs pedidas
por fatia" proíbe impor (design.md D5). A SPA NÃO SHALL mais recusar uma seleção
por quantidade de arquivos.

O **reconhecimento do código de erro vindo do servidor permanece**, como rede de
segurança para uma implantação que aperte o teto abaixo do tamanho da fatia: a
SPA SHALL continuar apresentando essa recusa como recusa por quantidade, nunca
como falha genérica que convide a repetir a mesma operação.

#### Scenario: Recusa vinda do servidor é apresentada como recusa por quantidade
- **WHEN** o servidor recusa a requisição com o código de erro próprio do teto
- **THEN** a SPA informa que a quantidade excedeu o limite, em vez de sugerir
  nova tentativa da mesma operação

## RENAMED Requirements

- FROM: `### Requirement: Envio de múltiplos arquivos com progresso individual`
- TO: `### Requirement: Envio de múltiplos arquivos em lote`

O título prometia o que o requisito deixou de exigir: o progresso passou a ser do
conjunto, medido em bytes (design.md D6). O que o requisito guarda — a chamada de
lote e o PUT direto ao GCS na URL assinada — é o que o novo nome descreve.

- FROM: `### Requirement: Recusa antecipada de seleção acima do teto de itens por requisição`
- TO: `### Requirement: Reconhecimento da recusa por teto de itens vinda do servidor`

A recusa antecipada foi removida (design.md D5); o que resta do requisito é o
reconhecimento do código de erro do servidor, como rede de segurança.
