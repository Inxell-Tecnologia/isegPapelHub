# web-upload Specification

## Purpose

Define os requisitos verificáveis do envio de arquivos na SPA do GDoc, a
partir do explorador (change `web-navegacao`): seleção múltipla de arquivos e
seleção de pasta inteira, pedido de URLs assinadas em **lote** via
`POST /files/upload-urls` (um pedido por lote, um item por arquivo) e PUT
direto de cada arquivo ao GCS pela URL assinada retornada, com progresso,
desfecho e nova tentativa **independentes por item**. Cobre o lado de
frontend da **US 3.1** (progresso e falha independentes, aviso de cota) e da
**US 3.2** (envio de pasta preservando a hierarquia de subpastas) e dos
**RF #6/#13** do PRD (`docs/prd_final.md`), consumindo o endpoint já pronto
em `apps/api/src/routes/files.ts` sem re-descrever seus cenários de backend
(ver capabilities `envio-lote`/`envio-pasta`).

## Requirements

### Requirement: Envio de múltiplos arquivos em lote

A partir do explorador, a SPA SHALL permitir selecionar **vários arquivos** e
enviá-los para a pasta corrente. Para iniciar o envio, a SPA SHALL chamar
`POST /files/upload-urls` **uma vez**, com `destinationFolderId` igual à pasta
corrente (ausente na raiz da unidade) e **um item por arquivo** selecionado
(`fileName`, `contentType`, `declaredSizeBytes`). Para cada item aceito
(`ok: true`), a SPA SHALL transferir os bytes por **PUT direto ao GCS** na URL
assinada retornada. O desfecho (sucesso ou falha) de cada arquivo SHALL ser
apresentado **de forma independente dos demais**.

O andamento da transferência NÃO SHALL ser apresentado como um indicador por
arquivo: ele é o **progresso macro do conjunto**, definido no requisito
"Progresso macro do envio medido em bytes" (change
`envio-multiplas-pastas-com-prechecagem`, design.md D6). A chamada de lote passa
a ser **uma por fatia** do envio, e não uma por seleção — ver "Envio dividido em
fatias com URLs pedidas por fatia".

Referência: PRD US 3.1 (cenário 1), RF #6; design.md D1/D2/D3.

#### Scenario: Progresso individual de cada arquivo do lote
- **WHEN** o usuário seleciona vários arquivos e inicia o envio
- **THEN** a SPA pede as URLs assinadas de cada fatia numa única chamada e
  apresenta um progresso único do conjunto, sinalizando ao final quantos
  arquivos concluíram e quantos falharam, com o desfecho de cada um
  independente dos demais

#### Scenario: Bytes transferidos direto ao GCS pela URL assinada
- **WHEN** um item do lote é aceito pelo servidor com uma URL assinada
- **THEN** a SPA envia os bytes desse arquivo por PUT diretamente à URL assinada
  do GCS, sem trafegar o conteúdo pela própria aplicação

### Requirement: Falha independente com nova tentativa apenas do item afetado


O envio de cada arquivo SHALL falhar de forma **isolada**: uma falha — seja
por o servidor recusar o item (`ok: false`, ex.: cota) seja por o PUT ao GCS não
concluir — NÃO SHALL impedir os demais arquivos do mesmo lote de concluir. Os
arquivos que concluíram SHALL permanecer enviados. Um arquivo que falhou SHALL
ser **sinalizado** e SHALL oferecer **nova tentativa que reenvia apenas aquele
item**, sem reprocessar os que já concluíram.

A nova tentativa SHALL reusar a URL assinada já obtida **somente enquanto ela
estiver vigente com margem**, e SHALL solicitar uma URL nova quando o prazo de
validade já tiver passado ou estiver a ponto de passar. Uma nova tentativa NÃO
SHALL repetir indefinidamente um envio com uma URL expirada. A avaliação de
vigência pelo relógio do cliente SHALL ser tratada como otimização — evitar uma
requisição inútil —, nunca como a garantia de correção: uma nova tentativa que
falhe novamente SHALL solicitar URL nova ainda que a URL anterior tivesse sido
julgada vigente.

Referência: PRD US 3.1 (cenário 2), RF #6; design.md D3/D4 do change
`web-upload` e D5 do change `corrige-defeitos-envio-lote`.

#### Scenario: Falha parcial preserva os concluídos
- **WHEN** um dos arquivos falha durante o envio enquanto os demais concluem
- **THEN** os que concluíram permanecem enviados e o que falhou é sinalizado

#### Scenario: Repetir reenvia só o item que falhou
- **WHEN** o usuário aciona a nova tentativa de um arquivo que falhou
- **THEN** a SPA reenvia apenas aquele arquivo, sem reprocessar os que já
  concluíram

#### Scenario: Repetir renova a URL assinada vencida
- **WHEN** o usuário aciona a nova tentativa de um arquivo cuja URL assinada já
  passou do prazo de validade
- **THEN** a SPA solicita uma URL nova para aquele arquivo antes de transferir,
  em vez de reusar a URL vencida

#### Scenario: Segunda falha renova a URL mesmo se julgada vigente
- **WHEN** uma nova tentativa que reusou a URL tida como vigente falha outra vez
- **THEN** a tentativa seguinte solicita uma URL nova, sem depender do relógio do
  cliente para decidir

### Requirement: Envio de pasta preservando a hierarquia de subpastas

A SPA SHALL permitir selecionar uma **pasta inteira** para envio. Para cada
arquivo da seleção, a SPA SHALL derivar o **`relativePath`** a partir do
caminho relativo da pasta selecionada (o trecho de diretório, incluindo o nome
da pasta-raiz e excluindo o nome do arquivo) e o SHALL enviar no item
correspondente de `POST /files/upload-urls`. A SPA SHALL confiar na recriação
da cadeia de subpastas pelo servidor sob a pasta corrente, de modo que a
**hierarquia original seja preservada de forma idêntica**.

Referência: PRD US 3.2 (cenário 1), RF #6; design.md D5.

#### Scenario: Estrutura de subpastas recriada de forma idêntica
- **WHEN** o usuário seleciona uma pasta com subpastas e conclui o envio
- **THEN** a SPA envia cada arquivo com o `relativePath` correspondente e a
  hierarquia de subpastas e arquivos é recriada de forma idêntica dentro da
  pasta corrente

### Requirement: Aviso reativo ao atingir a cota

A SPA SHALL exibir um **aviso** informando que a cota de armazenamento foi
atingida sempre que o servidor recusar um item com erro de **cota excedida**
(`ok: false` com `error` de cota) e SHALL marcar **apenas aquele item** como
falho, deixando os demais itens do lote seguir. A SPA NÃO SHALL inferir a cota
localmente; o limite é decidido e reservado pelo servidor.

Referência: PRD US 3.1, RF #13; design.md D4.

#### Scenario: Item recusado por cota é sinalizado sem derrubar o lote
- **WHEN** o servidor recusa um dos arquivos por cota excedida
- **THEN** a SPA exibe um aviso de cota atingida, marca aquele arquivo como
  falho e os demais arquivos do lote continuam podendo concluir

### Requirement: Arquivo enviado aparece como pendente até a reconciliação

Após a conclusão bem-sucedida do PUT ao GCS, a SPA SHALL considerar o arquivo
**enviado** e SHALL **invalidar a listagem** da pasta corrente, sem aguardar a
promoção do arquivo a `active`. A reconciliação de estado
(`pending`→`active`) e a atualização da cota ocorrem **fora da SPA**
(reconciliação por notificação de finalização). A SPA NÃO SHALL fazer polling à
espera do estado `active`; o arquivo recém-enviado SHALL ser exibido na listagem
com seu estado atual (ex.: `pending`) conforme retornado pelo servidor.

Referência: PRD US 3.1, RF #6; design.md D6.

#### Scenario: Listagem reflete o arquivo recém-enviado sem polling
- **WHEN** o PUT de um arquivo ao GCS conclui com sucesso
- **THEN** a SPA marca o arquivo como enviado e recarrega a listagem da pasta, e
  o arquivo aparece com o estado retornado pelo servidor, sem que a SPA fique
  aguardando a promoção a `active`

### Requirement: Falha ao obter as URLs de envio é tratada sem bloquear a navegação

A SPA SHALL exibir um aviso de **permissão insuficiente** ou destino
indisponível e NÃO SHALL iniciar transferência alguma quando
`POST /files/upload-urls` responder erro de destino (**404** destino inexistente
ou **403** sem permissão sobre a pasta de destino). Uma resposta **401** SHALL
continuar sendo tratada centralmente, encerrando a sessão e redirecionando a
`/login`.

Referência: PRD US 3.1, RF #10; design.md D4/D7.

#### Scenario: Destino sem permissão bloqueia o lote inteiro
- **WHEN** o usuário tenta enviar para uma pasta sobre a qual não tem permissão
  e a API responde 403 ao pedido de URLs
- **THEN** a SPA exibe um aviso de permissão insuficiente e nenhum arquivo é
  transferido

### Requirement: Transferências simultâneas limitadas por fila


A SPA SHALL manter, a qualquer instante, no máximo um número configurado de
transferências de arquivo em andamento, enfileirando os demais itens aceitos e
iniciando o próximo assim que uma transferência termina — **por sucesso ou por
falha**, indiferentemente. A SPA NÃO SHALL disparar a transferência de todos os
itens aceitos de uma vez.

A fila SHALL preservar a independência já exigida por item: o progresso, o
desfecho e a nova tentativa de cada arquivo continuam próprios, e um item que
falha NÃO SHALL travar o avanço da fila. Um item ainda enfileirado SHALL ser
distinguível de um item em transferência, para que a pessoa não leia "parado"
como "falhou".

A limitação SHALL existir independentemente do comportamento do navegador ou do
protocolo de transporte: o multiplexamento de HTTP/2 usado pelo armazenamento
não impõe teto de requisições concorrentes, de modo que sem a fila todas as
transferências disputariam a mesma banda e nenhuma concluiria cedo.
Referência: PRD US 3.1; design.md D4 do change `corrige-defeitos-envio-lote`.

#### Scenario: Apenas o número configurado de arquivos transfere ao mesmo tempo
- **WHEN** o usuário inicia o envio de uma quantidade de arquivos muito maior que
  o teto de transferências simultâneas
- **THEN** no máximo o número configurado de arquivos está em transferência a
  qualquer momento, e os demais aguardam a vez

#### Scenario: Item que falha não trava a fila
- **WHEN** um dos arquivos em transferência falha
- **THEN** a vaga liberada é imediatamente ocupada pelo próximo item da fila, e
  o arquivo que falhou é sinalizado sem impedir o avanço dos demais

### Requirement: Reconhecimento da recusa por teto de itens vinda do servidor


A SPA NÃO SHALL recusar uma seleção por **quantidade de arquivos**: com o envio
dividido em fatias abaixo do teto por requisição, o teto deixou de ser alcançável
por uso normal, e apresentá-lo ao usuário anunciaria um limite que ele nunca
encontra — o mesmo limite que "Envio dividido em fatias com URLs pedidas por
fatia" proíbe impor (change `envio-multiplas-pastas-com-prechecagem`, design.md
D5). A única recusa por tamanho é a justificada pelo espaço disponível.

A SPA SHALL, ainda assim, reconhecer o código de erro próprio do teto quando ele
vier do servidor — rede de segurança para uma implantação que aperte o teto
abaixo do tamanho da fatia — e SHALL apresentá-lo como recusa por quantidade,
nunca como falha genérica que convide a repetir a mesma operação. Referência:
design.md D2 do change `corrige-defeitos-envio-lote`.

#### Scenario: Recusa vinda do servidor é apresentada como recusa por quantidade
- **WHEN** o servidor recusa a requisição com o código de erro próprio do teto
- **THEN** a SPA informa que a quantidade excedeu o limite, em vez de sugerir
  nova tentativa da mesma operação

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
