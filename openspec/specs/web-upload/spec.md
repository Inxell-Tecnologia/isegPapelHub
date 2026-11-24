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

### Requirement: Envio de um documento pede os dados exigidos pelo seu tipo

A SPA SHALL solicitar, quando a pessoa envia **um único** documento, os dados de
controle exigidos pelo **tipo** escolhido — tipo, código, revisão, responsável e
data de próxima revisão para documento controlado — antes de concluir a
publicação. O conjunto exigido SHALL ser o mesmo que o servidor exige, derivado
do contrato compartilhado, e NÃO SHALL ser mantido como uma segunda lista no
cliente.

Referência: PRD US 10.5 (cenário 1), US 10.8; demanda, Regra da seção 2;
design.md D9.

#### Scenario: Envio de um documento apresenta o formulário
- **WHEN** uma pessoa seleciona um único arquivo para enviar
- **THEN** a SPA pede tipo, código, revisão, responsável e data de próxima
  revisão antes de concluir a publicação

#### Scenario: O responsável é exigido como os demais
- **WHEN** uma pessoa preenche tipo, código, revisão e data de próxima revisão e
  deixa o responsável em branco
- **THEN** a SPA sinaliza a falta antes de enviar, em vez de deixar a recusa
  para o servidor

#### Scenario: O conjunto exigido acompanha o do servidor
- **WHEN** o conjunto de dados exigidos para publicar um documento controlado é
  alterado
- **THEN** a exigência apresentada pela SPA acompanha a alteração sem edição de
  uma lista própria, de modo que a tela não exija menos campos do que o servidor

#### Scenario: Código em uso é apresentado como recusa específica
- **WHEN** o servidor recusa a publicação porque o código informado já pertence
  a outro documento da unidade
- **THEN** a SPA apresenta aviso específico de código em uso, distinguível da
  recusa por dado faltante e da recusa por permissão

### Requirement: Tabela de cadastro com uma linha por arquivo

A SPA SHALL apresentar, ao receber uma seleção de mais de um arquivo ou de uma
pasta, uma tabela de cadastro com **uma linha por arquivo**, com os campos tipo,
código, título, revisão, responsável e data de próxima revisão. A tabela SHALL
ser a confirmação do envio e SHALL ser apresentada **depois** do veredito de
espaço disponível, nunca antes. Nenhuma URL de envio SHALL ser solicitada antes
da confirmação.

Referência: demanda 2.1 e 2.2; design.md D1.

#### Scenario: Seleção de vários arquivos abre a tabela
- **WHEN** uma pessoa seleciona vários arquivos e a seleção cabe no espaço
  disponível
- **THEN** a SPA apresenta uma tabela com uma linha para cada arquivo
  selecionado, com os campos de cadastro editáveis por linha

#### Scenario: Nada é cadastrado antes de o espaço ser verificado
- **WHEN** a seleção da pessoa é maior que o espaço disponível
- **THEN** a SPA apresenta a recusa por espaço e não apresenta a tabela de
  cadastro, de modo que nenhum dado seja digitado para um envio que não
  aconteceria

#### Scenario: Enviar só o que cabe cadastra apenas o subconjunto enviável
- **WHEN** a pessoa opta por enviar apenas o subconjunto que cabe no espaço
  disponível
- **THEN** a tabela de cadastro apresenta somente os arquivos desse subconjunto

#### Scenario: Nenhuma requisição de envio antes da confirmação
- **WHEN** a tabela de cadastro está aberta e a pessoa ainda não confirmou
- **THEN** nenhuma URL assinada de envio foi solicitada e nenhum byte foi
  transferido

### Requirement: A tabela de cadastro não degrada a interface em seleções grandes

A SPA NÃO SHALL renderizar uma linha de cadastro para cada arquivo de uma
seleção grande ao mesmo tempo: o cadastro SHALL ter uma entrada por arquivo no
estado, e a apresentação SHALL se limitar à parte visível da tabela. A SPA NÃO
SHALL impor teto próprio de quantidade de arquivos para abrir a tabela — a única
recusa por tamanho continua sendo a justificada pelo espaço disponível.

Referência: PRD US 3.1 (cenário 1); design.md D2.

#### Scenario: Seleção de milhares de arquivos não renderiza milhares de linhas
- **WHEN** uma pessoa seleciona milhares de arquivos e a tabela de cadastro é
  apresentada
- **THEN** apenas uma fração visível das linhas é renderizada, e a interface
  permanece responsiva à digitação e à rolagem

#### Scenario: Quantidade de arquivos não impede abrir a tabela
- **WHEN** uma seleção tem muito mais arquivos do que cabem numa requisição de
  envio
- **THEN** a tabela de cadastro é apresentada normalmente, sem recusa por
  quantidade

### Requirement: Título pré-preenchido com o nome do arquivo, editável e preservando a extensão

A SPA SHALL pré-preencher o título de cada linha com o nome do arquivo
selecionado e SHALL permitir editá-lo. O título editado SHALL ser o nome com que
o arquivo é gravado, e a SPA SHALL preservar a extensão original do arquivo, de
modo que nome e conteúdo não discordem. A SPA NÃO SHALL aceitar título vazio em
linha alguma, ainda que a linha fique incompleta nos demais campos.

Referência: demanda 2.2; design.md D3; design.md D8 do change
`arquivo-geral-e-pendente-de-cadastro`.

#### Scenario: Título vem do nome do arquivo
- **WHEN** a tabela de cadastro é apresentada para uma seleção
- **THEN** cada linha já traz o título preenchido com o nome do arquivo
  correspondente

#### Scenario: Título editado renomeia o arquivo preservando a extensão
- **WHEN** a pessoa altera o título de uma linha e confirma o envio
- **THEN** o arquivo é gravado com o título informado e com a extensão original
  preservada

#### Scenario: Título vazio impede o envio daquela linha
- **WHEN** a pessoa apaga o título de uma linha
- **THEN** a SPA sinaliza a falta e não envia aquele arquivo sem título, por não
  haver pendência de cadastro que cubra a ausência do nome

### Requirement: Sugestão de tipo e código a partir do nome do arquivo

A SPA SHALL sugerir tipo e código para a linha cujo nome de arquivo segue o
padrão `SIGLA-AREA-Nº`, reconhecendo as siglas como o cliente as escreve nos
nomes dos arquivos, e NÃO SHALL depender apenas das siglas apresentadas na
interface. A sugestão SHALL ser editável e SHALL ser **visivelmente
distinguível** de um valor confirmado pela pessoa. Nome que não segue o padrão
NÃO SHALL receber sugestão alguma. A sigla `CHK` SHALL sugerir Checklist, e as
siglas `FOR` e `FRM` SHALL sugerir Formulário.

Referência: demanda 2.1 (item 4); design.md D4; change `tipo-checklist`,
design.md D4.

#### Scenario: Nome no padrão sugere tipo e código
- **WHEN** um arquivo chamado `PRT-NSP-001_Identificacao.pdf` entra na tabela
- **THEN** a linha sugere o tipo Protocolo e o código `PRT-NSP-001`, ambos
  editáveis

#### Scenario: Sigla escrita como o cliente a usa é reconhecida
- **WHEN** um arquivo cuja sigla é uma das formas usadas pelo cliente, e não a
  apresentada na interface, entra na tabela
- **THEN** o tipo correspondente é sugerido, em vez de a linha ficar sem
  sugestão

#### Scenario: Checklist e formulário são sugeridos como tipos distintos
- **WHEN** entram na tabela um arquivo chamado `CHK-NSP-002.xlsx` e outro
  chamado `FOR-NSP-003.xlsx`
- **THEN** o primeiro recebe a sugestão Checklist e o segundo, Formulário

#### Scenario: Sugestão é distinguível de valor confirmado
- **WHEN** uma linha tem tipo e código sugeridos e outra tem os mesmos campos
  preenchidos pela pessoa
- **THEN** a interface distingue as duas situações, de modo que uma sugestão
  errada não passe por decisão deliberada

#### Scenario: Nome fora do padrão não recebe sugestão
- **WHEN** um arquivo cujo nome não segue o padrão entra na tabela
- **THEN** os campos de tipo e código daquela linha permanecem vazios

### Requirement: Aplicar a todos preenche de uma vez os campos comuns

A SPA SHALL oferecer, no topo da tabela, uma forma de preencher **tipo, revisão,
responsável e data de próxima revisão** em todas as linhas de uma só vez, por
ação explícita da pessoa. O código NÃO SHALL fazer parte dessa aplicação, por
ser individual de cada documento. Após aplicar, cada linha SHALL continuar
editável, e a edição posterior de uma linha NÃO SHALL alterar as demais.

Referência: demanda 2.1 (item 5) e 2.2; design.md D5.

#### Scenario: Aplicar preenche as quatro colunas em todas as linhas
- **WHEN** a pessoa informa tipo, revisão, responsável e próxima revisão na
  linha de aplicação e aciona a aplicação
- **THEN** todas as linhas da tabela passam a ter esses quatro valores

#### Scenario: Código não é aplicado a todos
- **WHEN** a pessoa procura aplicar um código a todas as linhas
- **THEN** a aplicação não oferece o código, que permanece individual por linha

#### Scenario: Linha alterada depois prevalece
- **WHEN** a pessoa aplica valores a todas as linhas e em seguida altera uma
  delas
- **THEN** a linha alterada mantém o valor que a pessoa informou e as demais
  permanecem com o valor aplicado

#### Scenario: Aplicar não acontece durante a digitação
- **WHEN** a pessoa digita na linha de aplicação sem acioná-la
- **THEN** nenhuma linha da tabela é alterada

### Requirement: Linha completa é distinguível de linha incompleta

A SPA SHALL indicar, em cada linha, se o cadastro está completo ou incompleto, e
SHALL considerar completa a linha que tem todos os dados exigidos pelo **tipo**
escolhido. A SPA SHALL apresentar, antes da confirmação, quantos arquivos serão
publicados e quantos ficarão pendentes de cadastro.

Referência: demanda 2.1 (itens 6 e 8); design.md D6.

#### Scenario: Linha com todos os dados aparece completa
- **WHEN** uma linha tem tipo, código, título, revisão, responsável e próxima
  revisão preenchidos
- **THEN** a linha é apresentada como completa

#### Scenario: Linha sem um dado exigido aparece incompleta
- **WHEN** uma linha deixa de ter algum dado exigido pelo seu tipo
- **THEN** a linha é apresentada como incompleta, sem impedir o envio

#### Scenario: A contagem dos dois grupos precede a confirmação
- **WHEN** a tabela tem linhas completas e incompletas e a pessoa vai confirmar
- **THEN** a SPA informa quantos arquivos serão publicados e quantos ficarão
  pendentes de cadastro, antes de qualquer transferência

### Requirement: Publicar envia as linhas completas e as incompletas na mesma operação

A SPA SHALL enviar, ao confirmar, **todas** as linhas da tabela: as completas
são publicadas e as incompletas ficam pendentes de cadastro, conforme o servidor
decide por item. A SPA NÃO SHALL descartar silenciosamente as linhas
incompletas, e NÃO SHALL apresentar a ação de publicar como se ela alcançasse
apenas as completas sem dizer o que acontece com as demais.

Referência: demanda 2.1 (itens 7 e 8); PRD US 10.5 (cenário 2); design.md D6.

#### Scenario: Lote misto publica as completas e deixa pendentes as incompletas
- **WHEN** a pessoa confirma o envio de uma tabela com linhas completas e
  incompletas
- **THEN** os arquivos das linhas completas são publicados e os das incompletas
  são enviados e ficam pendentes de cadastro

#### Scenario: Nenhuma linha é descartada sem aviso
- **WHEN** a tabela tem linhas incompletas no momento da confirmação
- **THEN** a interface declara que esses arquivos serão enviados e ficarão
  pendentes de cadastro, em vez de omiti-los da ação

### Requirement: Código repetido dentro do próprio lote é barrado antes do envio

A SPA SHALL impedir a confirmação do envio enquanto duas linhas da tabela
declararem o **mesmo código**, apontando **todas** as linhas em conflito. A
comparação SHALL ser insensível a caixa e a espaços nas pontas, acompanhando a
unicidade aplicada pelo servidor. A SPA NÃO SHALL antecipar a verificação do
código contra o acervo já existente: essa recusa continua sendo do servidor.

Referência: demanda 2.2; design.md D7; `controle-documental` ("Código do
documento é único dentro da unidade").

#### Scenario: Duas linhas com o mesmo código não deixam confirmar
- **WHEN** duas linhas da tabela declaram o mesmo código
- **THEN** a confirmação é impedida e as duas linhas são apontadas como em
  conflito

#### Scenario: Diferença só de caixa também é conflito
- **WHEN** duas linhas declaram o mesmo código diferindo apenas em maiúsculas,
  minúsculas ou espaços nas pontas
- **THEN** o conflito é sinalizado, em vez de ser aceito pela tabela e recusado
  pelo servidor

#### Scenario: Código do acervo não é verificado antes de enviar
- **WHEN** uma linha declara um código que já pertence a outro documento da
  unidade e não há conflito dentro da tabela
- **THEN** a confirmação acontece e a recusa daquele item vem do servidor, sem
  que a SPA consulte o acervo antecipadamente

### Requirement: Item recusado por conflito de código volta corrigível sem perder o cadastro

A SPA SHALL apresentar o item recusado pelo servidor por conflito de código como
recusa **daquele código**, distinguível da falha de transferência e da recusa
por cota, e SHALL preservar os dados já informados para aquele arquivo, de modo
que corrigir o código e tentar de novo não exija reinformar o cadastro.

Referência: demanda 2.2; design.md D7.

#### Scenario: Conflito de código é apresentado como tal
- **WHEN** o servidor recusa um item do lote por conflito de código
- **THEN** a SPA informa que o código daquele arquivo está em conflito, em vez
  de apresentar falha genérica de envio

#### Scenario: Cadastro da linha recusada é preservado
- **WHEN** a pessoa vai corrigir o código de um item recusado por conflito
- **THEN** os demais dados daquele arquivo continuam preenchidos, e só o código
  precisa ser alterado

### Requirement: Arquivo geral dispensa e esvazia os campos que não admite

A SPA SHALL, ao escolher o tipo **Arquivo geral** em uma linha ou no envio de um
documento, tornar indisponíveis **e esvaziar** os campos código, revisão e data
de próxima revisão, mantendo o responsável disponível, e SHALL considerar o
cadastro **completo** com o título. A SPA NÃO SHALL enviar valor algum desses
três campos junto com o tipo Arquivo geral.

Referência: demanda 2.4; PRD US 10.8; design.md D8; `controle-documental`
("Arquivo geral é declarado fora do controle documental").

#### Scenario: Escolher Arquivo geral limpa os campos que ele recusa
- **WHEN** a pessoa já havia informado código, revisão e próxima revisão numa
  linha e muda o tipo para Arquivo geral
- **THEN** esses três campos ficam indisponíveis e vazios, e nada neles é
  enviado

#### Scenario: Arquivo geral com título conta como completo
- **WHEN** uma linha declara o tipo Arquivo geral e tem título
- **THEN** a linha é apresentada como completa e o arquivo é publicado, sem
  ficar pendente de cadastro

#### Scenario: Envio de um Arquivo geral avulso é possível pela interface
- **WHEN** uma pessoa envia um único arquivo declarando o tipo Arquivo geral
- **THEN** a publicação é concluída sem que a interface exija código, revisão ou
  data de próxima revisão

### Requirement: Recusa por campo incompatível com Arquivo geral é apresentada como tal

A SPA SHALL apresentar a recusa do servidor por campo de controle informado
junto com o tipo Arquivo geral como aviso próprio, nomeando a incompatibilidade,
e NÃO SHALL apresentá-la como falha genérica que convide a repetir a mesma
operação.

Referência: PRD US 10.8; design.md D8.

#### Scenario: Campo incompatível gera aviso específico
- **WHEN** o servidor recusa a operação porque código, revisão ou data de
  próxima revisão foi informado junto com o tipo Arquivo geral
- **THEN** a SPA informa qual campo é incompatível com esse tipo, em vez de
  sugerir nova tentativa da mesma operação
