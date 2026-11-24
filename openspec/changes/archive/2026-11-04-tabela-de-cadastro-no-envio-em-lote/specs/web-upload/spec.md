# web-upload — delta

## ADDED Requirements

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
NÃO SHALL receber sugestão alguma.

Referência: demanda 2.1 (item 4); design.md D4.

#### Scenario: Nome no padrão sugere tipo e código
- **WHEN** um arquivo chamado `PRT-NSP-001_Identificacao.pdf` entra na tabela
- **THEN** a linha sugere o tipo Protocolo e o código `PRT-NSP-001`, ambos
  editáveis

#### Scenario: Sigla escrita como o cliente a usa é reconhecida
- **WHEN** um arquivo cuja sigla é uma das formas usadas pelo cliente, e não a
  apresentada na interface, entra na tabela
- **THEN** o tipo correspondente é sugerido, em vez de a linha ficar sem
  sugestão

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

## REMOVED Requirements

### Requirement: Envio de um documento pede os dados de controle antes de publicar

**Reason**: O requisito declarava, como garantia, que a SPA **não** pediria os
dados de controle quando o envio abrangesse vários arquivos ou uma pasta —
contraparte de frontend da dispensa que o change
`arquivo-geral-e-pendente-de-cadastro` já removeu do servidor (decisões D7/D9 de
`controle-documental`, superadas pela D6 daquele change). Com a dispensa extinta
no servidor e a tabela de cadastro entrando aqui, essa cláusula passou a ser a
única coisa que mantinha todo envio em lote nascendo Pendente de cadastro. O
cenário "Envio de vários arquivos não apresenta o formulário" **nomeia** a
dispensa, e mantê-lo sob MODIFIED produziria nome de cenário em contradição com
o corpo do requisito — mesmo tratamento que a B1 deu ao caso equivalente em
`controle-documental`, e antes dela o change `identidade-visual-isetes`. O
requisito também enumerava quatro campos, e a B1 levou o conjunto para cinco.

**Migration**: Substituído por dois requisitos. "Envio de um documento pede os
dados exigidos pelo seu tipo" preserva as garantias do anterior — o formulário
antes da publicação no envio unitário e as três recusas distinguíveis (código em
uso, dado faltante, permissão) — e corrige duas divergências com o servidor: o
conjunto passa a ser de cinco campos, com o responsável, e passa a depender do
tipo, de modo que o Arquivo geral pede só o título. "Tabela de cadastro com uma
linha por arquivo" e os requisitos que a acompanham substituem a dispensa pelo
cadastro por arquivo. A recusa por dado faltante permanece distinguível, agora
também por linha da tabela. Nenhuma garantia é perdida; a dispensa do lote é a
única coisa que deixa de valer, e é o objeto desta change.
