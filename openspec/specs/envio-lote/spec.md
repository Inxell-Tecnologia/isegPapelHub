# envio-lote Specification

## Purpose

Define os requisitos verificáveis de envio de múltiplos arquivos em uma única
operação (envio em lote) do GDoc — emissão de URLs assinadas por item e reserva
de cota consciente do conjunto — na fatia do Épico 3 / US 3.1 do PRD
(`docs/prd_final.md`). O backend garante que o resultado de cada item é
independente dos demais e que a nova tentativa pode ser só do item que falhou; a
camada visual (barra de progresso por arquivo) é consumo do contrato pelo
frontend e está fora desta fatia. Os cenários Given/When/Then da US 3.1 são
vinculantes e este spec os torna verificáveis no backend.

## Requirements

### Requirement: Emissão de URLs de envio em lote

O sistema SHALL aceitar, em `POST /files/upload-urls`, uma lista de itens a enviar,
cada item podendo trazer os **seus próprios** dados de controle, e SHALL responder
com um resultado **por item**, na mesma ordem, contendo ou uma URL
assinada de PUT (com o caminho do objeto, o prazo de expiração e a indicação de que
o item nasce publicado ou pendente de cadastro) em caso de sucesso,
ou um erro descritivo em caso de recusa. A falha de um item NÃO SHALL impedir a
emissão de URL para os demais itens válidos do mesmo lote. Cada item bem-sucedido
SHALL ter uma linha de arquivo `pending` inserida, seguindo o mesmo ciclo do envio
individual (PUT direto no storage → reconciliação em `POST /internal/storage-events`).
Referência: PRD US 3.1 e US 10.5.

#### Scenario: Lote totalmente válido
- **WHEN** uma pessoa solicita o envio de vários arquivos válidos em uma requisição
- **THEN** recebe, para cada arquivo, uma URL assinada própria e independente, e cada
  arquivo pode ser enviado e concluído separadamente dos demais

#### Scenario: Falha parcial não derruba o lote
- **WHEN** um dos itens do lote é recusado (por exemplo, por estourar a cota) e os
  demais são válidos
- **THEN** os itens válidos recebem suas URLs e podem concluir normalmente, enquanto o
  item recusado é sinalizado com seu erro, sem afetar os que concluíram

#### Scenario: Nova tentativa apenas do item que falhou
- **WHEN** um item foi recusado ou falhou no envio e a pessoa reenvia somente aquele
  arquivo em uma nova requisição
- **THEN** o item é processado isoladamente, sem exigir o reenvio dos itens que já
  haviam concluído

#### Scenario: Dados de controle são lidos por item
- **WHEN** um lote é enviado com dados de controle informados para alguns itens e
  ausentes em outros
- **THEN** cada item é tratado pelos dados que lhe pertencem, sem que os dados de um
  item sejam aplicados a outro

#### Scenario: A resposta diz, por item, se ele nasce pendente de cadastro
- **WHEN** um lote mistura itens com dados de controle completos e itens sem eles
- **THEN** o resultado de cada item informa a sua condição, de modo que quem enviou
  saiba quais arquivos ficaram pendentes de cadastro sem precisar consultá-los um a um

#### Scenario: Dado de controle inválido recusa só o seu item
- **WHEN** um item do lote informa dado de controle inválido e os demais itens são
  válidos
- **THEN** apenas aquele item é recusado, com a indicação do problema, e os demais
  recebem suas URLs normalmente
### Requirement: Reserva de cota consciente do lote

Ao pré-checar a **cota efetiva** do usuário (capability `cota-individual`) para um
lote, o sistema SHALL considerar a soma dos tamanhos declarados dos itens do próprio
lote **e** dos envios ainda pendentes do mesmo usuário, não apenas o volume já
finalizado (`storage_used_bytes`). Os itens que couberem dentro do limite SHALL
receber URL; os que ultrapassarem o limite SHALL ser sinalizados com erro de cota,
sem impedir os itens que couberem. Nenhuma linha de arquivo SHALL ser inserida para
um item recusado por cota.

O limite aplicado SHALL ser o da pessoa que envia — sua exceção nominal quando
houver, o padrão da plataforma quando não houver —, e NÃO SHALL ser um valor fixo
do produto. Referência: PRD US 3.1, US 8.1.

#### Scenario: Lote que excede a cota no conjunto
- **WHEN** os arquivos do lote cabem individualmente, mas a soma deles (com os envios
  pendentes) ultrapassa a cota efetiva do usuário
- **THEN** os primeiros itens que couberem recebem URL e os que excederem o limite são
  recusados com erro de cota, sem que nenhuma linha seja inserida para os recusados

#### Scenario: Item recusado por cota não consome reserva
- **WHEN** um item do lote é recusado por cota
- **THEN** nenhuma linha `pending` é criada para ele e o volume reservado do usuário
  não é acrescido por esse item

#### Scenario: Lote de quem tem exceção nominal usa o limite da exceção
- **WHEN** um usuário com exceção nominal acima do padrão da plataforma envia um lote
  cuja soma ultrapassa o padrão, mas cabe na sua exceção
- **THEN** todos os itens do lote recebem URL, sem recusa por cota

### Requirement: Teto de itens por requisição de envio em lote

O sistema SHALL recusar, em `POST /files/upload-urls`, qualquer requisição cuja
lista de itens exceda o teto configurado, respondendo com um código de erro
próprio que identifique o teto como causa. A recusa SHALL ocorrer **antes** de
qualquer efeito: nenhuma linha de arquivo `pending` SHALL ser inserida, nenhuma
pasta do caminho relativo SHALL ser criada e nenhuma URL assinada SHALL ser
emitida. O teto SHALL ser configurável por ambiente, no molde dos demais tetos
por requisição já existentes (manifesto de download, destinatários de concessão,
itens de movimentação em lote), e seu padrão SHALL ser conhecido também pelo
cliente, para que a recusa possa acontecer antes da requisição — sem que isso
dispense a validação no servidor. Referência: PRD US 3.1; design.md D2 do change
`corrige-defeitos-envio-lote`.

#### Scenario: Lote acima do teto é recusado sem efeito colateral
- **WHEN** uma pessoa solicita URLs de envio para uma quantidade de itens acima
  do teto configurado
- **THEN** a requisição é recusada com o código de erro próprio do teto, e nem
  arquivo pendente, nem pasta, nem URL assinada são criados

#### Scenario: Lote no teto é aceito normalmente
- **WHEN** uma pessoa solicita URLs de envio para exatamente a quantidade máxima
  permitida de itens válidos
- **THEN** a requisição é processada normalmente e cada item recebe seu
  resultado próprio

### Requirement: Recusa por requisição malformada distinguível de falha interna

O sistema SHALL responder a uma requisição cujo corpo exceda o tamanho máximo
aceito com um status próprio de corpo grande demais, e a uma requisição cujo
corpo não seja JSON válido com um status próprio de requisição inválida, em
ambos os casos com um código de erro estável — nunca com o status genérico de
falha interna do servidor. O tamanho máximo de corpo aceito SHALL ser
configurável por ambiente e SHALL ser folgado o bastante para acomodar o teto de
itens do envio em lote no pior caso de comprimento de nome e caminho relativo.

Falhas que **não** sejam de requisição malformada SHALL continuar respondendo
com o status genérico de falha interna, sem expor mensagem, tipo ou rastro do
erro original. A distinção SHALL cobrir somente as classes de erro de leitura do
corpo reconhecidas, nunca um status arbitrário carregado por um erro qualquer.
Referência: design.md D1 do change `corrige-defeitos-envio-lote`.

#### Scenario: Corpo grande demais é reportado como tal
- **WHEN** um cliente envia uma requisição cujo corpo excede o tamanho máximo
  aceito
- **THEN** a resposta indica corpo grande demais, com código de erro próprio, e
  o cliente consegue distinguir essa recusa de uma falha do servidor

#### Scenario: JSON inválido é reportado como requisição inválida
- **WHEN** um cliente envia uma requisição cujo corpo não é JSON válido
- **THEN** a resposta indica requisição inválida, com código de erro próprio, e
  não a falha interna genérica

#### Scenario: Falha interna permanece opaca
- **WHEN** uma requisição falha por um erro que não é de leitura do corpo
- **THEN** a resposta é a falha interna genérica, sem mensagem, tipo ou rastro
  do erro original

### Requirement: Consulta do espaço de armazenamento do próprio solicitante

O sistema SHALL expor uma consulta que informe, **a quem pede, sobre si mesmo**,
a cota total de armazenamento, o volume já utilizado, o volume retido em
arquivos na lixeira, o volume reservado por envios ainda não reconciliados e o
volume disponível para novos envios. A consulta SHALL derivar a identidade do
solicitante exclusivamente do contexto de sessão e NÃO SHALL aceitar
identificador de pessoa como parâmetro — não existindo, portanto, forma de
consultar a cota de outra pessoa, ainda que da mesma unidade.

O volume retido na lixeira SHALL ser informado como **decomposição
explicativa** do volume utilizado, e NÃO SHALL ser subtraído do disponível: um
arquivo na lixeira continua ocupando cota até o expurgo por retenção, de modo
que já está contido no volume utilizado. O volume disponível SHALL descontar do
total tanto o utilizado quanto o reservado por envios pendentes, refletindo a
mesma reserva consciente do lote já aplicada na emissão de URLs.

A consulta SHALL ser um retrato do instante, e NÃO SHALL ser tratada como
garantia de aceitação de envio futuro: a decisão de aceitar cada item continua
sendo do servidor, no momento da emissão das URLs, avaliada em transação.
Referência: PRD US 3.1, US 8.1; design.md D2 do change
`envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Pessoa consulta o próprio espaço disponível
- **WHEN** uma pessoa consulta seu espaço de armazenamento
- **THEN** recebe a cota total, o utilizado, o retido na lixeira, o reservado por
  envios pendentes e o disponível, todos referentes a ela própria

#### Scenario: Arquivo na lixeira aparece como retido, sem inflar o disponível
- **WHEN** uma pessoa tem arquivos na lixeira ainda não expurgados e consulta seu
  espaço
- **THEN** o volume desses arquivos é informado como retido na lixeira e
  permanece contabilizado no utilizado, sem aumentar o volume disponível

#### Scenario: Envio pendente reduz o disponível
- **WHEN** uma pessoa tem envios ainda não reconciliados e consulta seu espaço
- **THEN** o volume desses envios é descontado do disponível, refletindo a
  reserva já aplicada na emissão de URLs

#### Scenario: Não há como consultar o espaço de outra pessoa
- **WHEN** alguém tenta obter o espaço de armazenamento de outra pessoa
- **THEN** a consulta responde sobre quem pede, e não sobre a pessoa indicada,
  inclusive para administrador da mesma unidade

### Requirement: Conflito de código recusa só o seu item no envio em lote

O sistema SHALL recusar, em `POST /files/upload-urls`, **apenas o item** cujo
código de documento já pertença a outro documento não excluído da mesma unidade,
emitindo URL normalmente para os demais itens do lote. A recusa SHALL trazer
erro próprio do conflito de código, distinguível do erro de cota e do erro de
dado inválido, e NÃO SHALL revelar dado algum de documento de outra unidade.
Referência: PRD US 10.2, US 3.1; `controle-documental` ("Código do documento é
único dentro da unidade").

#### Scenario: Item com código do acervo é recusado sem derrubar o lote
- **WHEN** um lote traz um item cujo código já pertence a outro documento ativo
  da mesma unidade, e os demais itens são válidos
- **THEN** só aquele item é recusado, com erro próprio de conflito de código, e
  os demais recebem suas URLs

#### Scenario: Código existente apenas em outra unidade não conflita
- **WHEN** um item do lote traz código que existe somente em outra unidade
- **THEN** o item é aceito, sem que qualquer informação do documento homônimo
  seja revelada

### Requirement: Dois itens do mesmo lote não podem declarar o mesmo código

O sistema SHALL recusar, **por item**, o segundo e os seguintes itens de um
mesmo lote que declarem um código já declarado por outro item **daquele lote**,
ainda que nenhum deles exista no acervo no momento da requisição. Referência:
PRD US 10.2, US 3.1; design.md D6 do change
`arquivo-geral-e-pendente-de-cadastro`.

#### Scenario: Dois itens com o mesmo código no mesmo lote
- **WHEN** um lote traz dois itens declarando o mesmo código e outros itens
  válidos
- **THEN** o primeiro é aceito, o segundo é recusado com erro de conflito de
  código, e os itens válidos recebem suas URLs

#### Scenario: Colisão interna não derruba o lote inteiro
- **WHEN** dois itens do mesmo lote colidem em código
- **THEN** nenhum item válido do lote deixa de receber a sua URL, e a operação
  não é recusada por inteiro

#### Scenario: Diferença só de caixa é a mesma colisão
- **WHEN** dois itens do mesmo lote declaram o mesmo código diferindo apenas em
  maiúsculas e minúsculas
- **THEN** a colisão é reconhecida e o segundo item é recusado, em vez de ambos
  serem aceitos e colidirem na gravação

### Requirement: Código preso a envio pendente de quem pede é retomada, não conflito

O sistema SHALL tratar como **retomada** da mesma publicação o item cujo código
esteja ocupado por um arquivo ainda não reconciliado (`pending`) **do próprio
solicitante**, reaproveitando aquela linha em vez de recusar o item por
conflito. Referência: PRD US 3.1 ("nova tentativa apenas do item que falhou"),
US 10.2.

#### Scenario: Repetir um item cujo envio falhou não é conflito de código
- **WHEN** a transferência de um item do lote falha e a pessoa reenvia aquele
  arquivo com o mesmo código
- **THEN** o item é aceito como retomada da mesma publicação, sem recusa por
  conflito de código

#### Scenario: A retomada não troca o identificador do arquivo
- **WHEN** um item é aceito como retomada
- **THEN** o arquivo mantém o mesmo identificador, de modo que nenhum aviso
  duplicado é emitido e nenhuma concessão ou registro de auditoria perde o seu
  alvo

#### Scenario: Código preso a envio pendente de outra pessoa continua conflito
- **WHEN** um item declara código ocupado por um envio ainda não reconciliado de
  **outra** pessoa
- **THEN** o item é recusado com erro de conflito de código, sem ser tratado
  como retomada
