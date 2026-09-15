## ADDED Requirements

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
