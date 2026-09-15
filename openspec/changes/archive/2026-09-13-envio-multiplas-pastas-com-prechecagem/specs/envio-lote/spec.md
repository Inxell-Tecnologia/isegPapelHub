## ADDED Requirements

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
