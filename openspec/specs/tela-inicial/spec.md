# tela-inicial Specification

## Purpose

Definir o que a tela de entrada apresenta a quem acabou de entrar — quem é,
onde está, o que pode fazer e o que mudou recentemente — e as garantias de
permissão e isolamento por unidade que essa apresentação não pode violar.

## Requirements

### Requirement: Tela inicial identifica a pessoa pelo nome

A tela inicial SHALL saudar a pessoa autenticada pelo **primeiro nome**, com a
saudação do horário — "Bom dia", "Boa tarde" ou "Boa noite" — apurada pelo
relógio de quem vê a tela. Abaixo da saudação SHALL apresentar a sua **função —
o cargo do cadastro —**, o seu **setor** e a sua unidade, com a unidade escrita
como está no cadastro. Quando a função não estiver preenchida, a tela SHALL
apresentar, em seu lugar, o rótulo do **papel de acesso**, pela origem única
desse rótulo; quando o setor não existir, SHALL omiti-lo sem espaço reservado.
NÃO SHALL apresentar identificador interno, fragmento de identificador ou
qualquer valor que a pessoa não reconheça como seu. Referência: PRD US 11.1;
demanda do cliente nº 2, seção 1.3; `docs/respostas_a1_funcao_e_setor.txt`,
resposta 1 (a).

#### Scenario: Pessoa vê o próprio nome ao entrar
- **WHEN** uma pessoa autenticada abre a tela inicial
- **THEN** vê a saudação com o seu primeiro nome e, abaixo dela, sua função, seu
  setor e sua unidade

#### Scenario: Saudação acompanha o horário
- **WHEN** uma pessoa abre a tela inicial pela manhã, à tarde ou à noite, pelo
  relógio do seu dispositivo
- **THEN** a saudação é, respectivamente, "Bom dia", "Boa tarde" ou "Boa noite",
  seguida do seu primeiro nome

#### Scenario: Função do cadastro prevalece sobre o papel de acesso
- **WHEN** uma pessoa com cargo preenchido no cadastro — por exemplo "Gerente de
  Governança" — abre a tela inicial, tendo papel de acesso `collaborator`
- **THEN** lê o seu cargo, e **não** o rótulo do papel de acesso

#### Scenario: Conta sem função recorre ao rótulo do papel
- **WHEN** uma pessoa cuja conta não tem cargo preenchido abre a tela inicial
- **THEN** lê o rótulo do seu papel de acesso no lugar da função, com exatamente
  o mesmo texto usado nas demais telas que exibem papel

#### Scenario: Pessoa sem nome cadastrado não vê identificador interno
- **WHEN** uma pessoa cuja conta não tem nome cadastrado abre a tela inicial
- **THEN** a saudação é apenas a do horário, sem nome, e em nenhum momento
  apresenta o identificador interno da conta

### Requirement: Atalhos da tela inicial refletem o que o perfil pode fazer

A tela inicial SHALL apresentar, como cartões soltos e sem título de seção, os
atalhos **Enviar documento**, **Nova pasta**, **Buscar documento** e **Manual
do usuário**, cada um com ícone, título e descrição, restritos aos que o perfil
da pessoa pode executar. O atalho do manual SHALL ser apresentado somente
quando a implantação tiver manual configurado, SHALL abri-lo fora da aplicação
e SHALL anunciar essa saída no seu nome acessível. NÃO SHALL apresentar atalho
que resultaria em recusa ao ser acionado. Cada atalho SHALL conduzir à ação que
anuncia, e NÃO SHALL deixar a ação por localizar na tela de destino; dois
atalhos distintos NÃO SHALL conduzir ao mesmo ponto de partida. Referência: PRD
US 11.1; demanda do cliente nº 2, seção 1.3.

#### Scenario: Atalho fora do alcance do perfil não é apresentado
- **WHEN** uma pessoa cujo perfil não permite determinada ação abre a tela
  inicial
- **THEN** o atalho correspondente não é apresentado

#### Scenario: Os quatro atalhos da tela inicial
- **WHEN** uma pessoa abre a tela inicial numa implantação com manual
  configurado
- **THEN** vê os atalhos Enviar documento, Nova pasta, Buscar documento e Manual
  do usuário, cada um com ícone, título e descrição, sem título de seção acima
  deles

#### Scenario: Sem manual configurado, o atalho do manual não aparece
- **WHEN** uma pessoa abre a tela inicial numa implantação sem manual
  configurado
- **THEN** o atalho Manual do usuário não é apresentado, e os demais sim

#### Scenario: Atalho apresentado conduz a uma ação executável
- **WHEN** uma pessoa aciona qualquer atalho apresentado na sua tela inicial
- **THEN** alcança a ação correspondente, sem recusa por permissão

#### Scenario: O atalho de envio conduz ao envio, não só à tela que o contém
- **WHEN** uma pessoa que pode enviar documentos aciona o atalho de envio
- **THEN** alcança a área de envio em condição de usá-la de imediato, sem precisar
  localizá-la na tela de destino

#### Scenario: O atalho de envio não conduz a uma recusa
- **WHEN** uma pessoa aciona o atalho de envio e a pasta de destino não lhe
  permite enviar
- **THEN** alcança a tela de destino normalmente, sem ser conduzida a uma área de
  envio que recusaria a ação

#### Scenario: O atalho de nova pasta conduz ao formulário
- **WHEN** uma pessoa aciona o atalho de nova pasta
- **THEN** alcança a raiz da sua unidade com o formulário de nova pasta
  apresentado

#### Scenario: O atalho de busca conduz ao campo de busca
- **WHEN** uma pessoa aciona o atalho de busca
- **THEN** alcança a tela de busca com o campo de termo pronto para digitar

#### Scenario: Atalhos distintos têm destinos distintos
- **WHEN** uma pessoa compara os atalhos apresentados na sua tela inicial
- **THEN** cada um conduz a um ponto de partida próprio, sem dois atalhos
  diferentes levando ao mesmo lugar

### Requirement: Tela inicial oferece acesso rápido às pastas permitidas

A tela inicial SHALL apresentar, sob o título **"Pastas da unidade"**, acesso
rápido às pastas de primeiro nível da unidade da pessoa a que ela tem acesso,
em grade, com um caminho para a lista completa de pastas. A seleção SHALL
respeitar a resolução de acesso já existente, e NÃO SHALL revelar a existência
de pasta que a pessoa não possa abrir. NÃO SHALL apresentar unidades no lugar
das pastas: cada pessoa pertence a uma unidade só. Referência: PRD US 11.1;
`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, respostas 1 (a) e 4 (a).

#### Scenario: Apenas pastas acessíveis aparecem
- **WHEN** uma pessoa com acesso a parte das pastas de primeiro nível da sua
  unidade abre a tela inicial
- **THEN** vê acesso rápido apenas às pastas que pode abrir, sem menção às
  demais

#### Scenario: Cartão de pasta abre a pasta
- **WHEN** uma pessoa aciona o cartão de uma pasta em "Pastas da unidade"
- **THEN** alcança o conteúdo daquela pasta no explorador

#### Scenario: Caminho para todas as pastas
- **WHEN** uma pessoa aciona "Ver todas as pastas"
- **THEN** alcança a raiz da sua unidade no explorador

#### Scenario: Sem pastas acessíveis a área orienta em vez de ficar vazia
- **WHEN** uma pessoa sem acesso a nenhuma pasta de primeiro nível abre a tela
  inicial
- **THEN** a área informa a ausência de pastas disponíveis, em vez de permanecer
  vazia sem explicação

### Requirement: Tela inicial lista os documentos alterados recentemente

A tela inicial SHALL apresentar, sob o título **"Documentos recentes"**, os
documentos alterados recentemente, ordenados da alteração mais recente para a
mais antiga, limitados a **cinco** na tela inicial, com um caminho para o
recorte completo. Cada linha SHALL apresentar o tipo, o nome do documento com o
código abaixo dele, a unidade, a revisão, a situação e a data da alteração.
SHALL considerar alteração a publicação, a substituição, a renomeação e a
movimentação do documento. Referência: PRD US 11.2; demanda do cliente nº 2,
seção 1.3.

#### Scenario: Alterações aparecem da mais recente para a mais antiga
- **WHEN** documentos a que a pessoa tem acesso foram publicados, substituídos,
  renomeados ou movidos em instantes distintos
- **THEN** a lista os apresenta ordenados da alteração mais recente para a mais
  antiga, com a data de cada alteração

#### Scenario: A tela inicial apresenta no máximo cinco documentos
- **WHEN** mais de cinco documentos ao alcance da pessoa foram alterados
- **THEN** a tela inicial apresenta os cinco mais recentes, e o caminho para o
  recorte completo leva aos demais

#### Scenario: Linha apresenta tipo, código, unidade, revisão e situação
- **WHEN** a lista apresenta um documento com dados de controle
- **THEN** a linha mostra o tipo, o nome com o código abaixo, a unidade, a
  revisão, a situação e a data da alteração

#### Scenario: Ausência de alterações é informada
- **WHEN** nenhum documento ao alcance da pessoa foi alterado
- **THEN** a área informa a ausência de alterações recentes, em vez de
  permanecer vazia sem explicação

### Requirement: A lista de recentes não amplia alcance

A lista de documentos recentes SHALL apresentar exclusivamente documentos que a
pessoa já poderia alcançar por navegação. NÃO SHALL revelar nome, pasta nem
existência de documento sobre o qual a pessoa não tenha permissão, e NÃO SHALL
apresentar documento de outra unidade, qualquer que seja o papel do
solicitante. Referência: PRD US 11.2.

#### Scenario: Documento sem permissão não aparece
- **WHEN** um documento sobre o qual a pessoa não tem permissão é alterado
- **THEN** ele não aparece na lista, nem seu nome, nem a pasta que o contém

#### Scenario: A lista não atravessa unidades
- **WHEN** documentos de outra unidade são alterados
- **THEN** nenhum deles aparece na lista, inclusive para o administrador global

#### Scenario: Perda de acesso remove o documento da lista
- **WHEN** a concessão que dava acesso a um documento listado expira ou é
  revogada
- **THEN** o documento deixa de aparecer na lista na consulta seguinte

### Requirement: Cartão da tela inicial é acionável em toda a sua área

Todo cartão que a tela inicial apresenta como caminho para um destino SHALL ser
acionável em qualquer ponto da sua área, e NÃO SHALL restringir o acionamento ao
texto do seu rótulo. A área sensível SHALL ser a do cartão apresentado, de modo
que o aspecto de superfície acionável corresponda ao que de fato aciona.
Referência: PRD US 11.1.

#### Scenario: Acionamento fora do texto do rótulo conduz ao destino
- **WHEN** uma pessoa aciona um cartão da tela inicial num ponto da sua área que
  não é o texto do rótulo — a descrição, o espaço livre à volta dela ou a margem
  interna do cartão
- **THEN** alcança o mesmo destino que alcançaria acionando o rótulo

#### Scenario: Aspecto acionável corresponde à área que aciona
- **WHEN** uma pessoa percorre com o ponteiro a área de um cartão da tela inicial
- **THEN** não encontra região que se apresente como acionável sem conduzir ao
  destino do cartão

#### Scenario: Cartão é alcançável e acionável pelo teclado
- **WHEN** uma pessoa percorre a tela inicial usando apenas o teclado
- **THEN** cada cartão recebe o foco, com indicação visível, e é acionável a
  partir dele, conduzindo ao seu destino

#### Scenario: Cartão respeita a área mínima de acionamento
- **WHEN** uma pessoa aciona um cartão da tela inicial em dispositivo de toque
- **THEN** a área sensível tem ao menos a altura mínima de acionamento exigida
  pelo piso de acessibilidade da aplicação

#### Scenario: Destino do cartão é identificável antes do acionamento
- **WHEN** uma pessoa aponta para um cartão da tela inicial, ou usa o recurso do
  navegador para abrir um destino em nova aba
- **THEN** o cartão expõe o endereço do seu destino, como qualquer link da
  aplicação

#### Scenario: Cartão é anunciado pelo seu rótulo
- **WHEN** uma pessoa que usa leitor de tela alcança um cartão da tela inicial
- **THEN** ele é anunciado pelo seu rótulo, sem que a descrição auxiliar seja
  incorporada ao nome do destino

### Requirement: Tela inicial conta os documentos novos ao alcance

A tela inicial SHALL apresentar, na linha abaixo da saudação, quantos
documentos **ao alcance da pessoa** foram publicados nos últimos **7 dias**,
apurados pelo relógio do servidor de banco. A contagem SHALL passar pela mesma
resolução de acesso da lista de recentes, e NÃO SHALL contar documento que a
pessoa não alcançaria por navegação nem documento de outra unidade, qualquer
que seja o papel do solicitante. Quando a quantidade exceder o teto de
apuração, a tela SHALL dizer que há **pelo menos** um número, e NÃO SHALL
apresentar o teto como contagem exata. A falha da contagem NÃO SHALL impedir o
restante da tela de aparecer. Referência: PRD US 11.1;
`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, resposta 3 (b).

#### Scenario: A contagem considera só o que a pessoa alcança
- **WHEN** documentos foram publicados nos últimos 7 dias na unidade da pessoa,
  alguns sem permissão para ela
- **THEN** a contagem considera apenas os que ela pode visualizar

#### Scenario: A contagem não atravessa unidades
- **WHEN** documentos de outra unidade foram publicados nos últimos 7 dias
- **THEN** nenhum deles entra na contagem, inclusive para o administrador global

#### Scenario: Documento publicado antes da janela não é novo
- **WHEN** um documento foi publicado há mais de 7 dias e alterado ontem
- **THEN** ele aparece entre os recentes, mas não entra na contagem de novos

#### Scenario: Acima do teto, a tela diz "pelo menos"
- **WHEN** a quantidade de candidatos excede o teto de apuração
- **THEN** a linha informa que há pelo menos um número de documentos novos, sem
  apresentá-lo como contagem exata

### Requirement: Tela inicial reserva a coluna de leitura obrigatória e avisos

A tela inicial SHALL apresentar, à direita do conteúdo principal, uma coluna de
cerca de 340 px com os cartões **"Leitura obrigatória"** e **"Avisos"**. O
cartão "Leitura obrigatória" SHALL listar as leituras obrigatórias **abertas**
da pessoa — pendentes e atrasadas, a atrasada sinalizada —, cada uma com o
documento, o prazo e o botão **"Ler e confirmar ciência"**, que SHALL abrir o
documento no visualizador; SHALL oferecer o acesso à lista completa; e, sem
leitura aberta, SHALL dizer que não há leitura pendente. Leitura aberta cujo
documento a pessoa não alcança mais NÃO SHALL oferecer o botão. O cartão
"Avisos" SHALL listar os avisos de leitura obrigatória da pessoa — nova
pendência, atraso e atraso da equipe —, os mais recentes primeiro, com a data;
sem nenhum, SHALL dizer que não há aviso de leitura obrigatória e que os demais
avisos estão no sino. Quando a largura não
comportar as duas colunas, a coluna SHALL passar para depois do conteúdo
principal, ocupando a largura disponível, sem rolagem horizontal. Referência:
PRD US 12.4 e 12.5; demanda do cliente nº 2, seções 1.3 (coluna direita), 3.2 (etapa
2, item 3) e 3.5 (Início).

#### Scenario: Coluna lateral na forma larga
- **WHEN** uma pessoa abre a tela inicial numa largura que comporta as duas
  colunas
- **THEN** vê os cartões "Leitura obrigatória" e "Avisos" numa coluna à direita
  do conteúdo principal

#### Scenario: Coluna desce na forma estreita
- **WHEN** uma pessoa abre a tela inicial numa largura que não comporta as duas
  colunas
- **THEN** os cartões aparecem depois do conteúdo principal, sem rolagem
  horizontal da página

#### Scenario: Cartão lista as pendências com prazo
- **WHEN** uma pessoa com leituras obrigatórias abertas abre a tela inicial
- **THEN** o cartão "Leitura obrigatória" mostra cada documento com o prazo e o
  botão "Ler e confirmar ciência", e a atrasada aparece sinalizada

#### Scenario: Botão abre o documento no visualizador
- **WHEN** a pessoa aciona "Ler e confirmar ciência" no cartão
- **THEN** o documento abre no visualizador, onde ela confirma a ciência

#### Scenario: Sem pendências, o cartão diz que não há
- **WHEN** uma pessoa sem leitura obrigatória aberta abre a tela inicial
- **THEN** o cartão "Leitura obrigatória" informa que não há leitura pendente

#### Scenario: Cartão diz o que vai apresentar
- **WHEN** uma pessoa sem aviso de leitura obrigatória lê o cartão "Avisos"
- **THEN** lê que não há aviso de leitura obrigatória e que os demais avisos
  estão no sino

#### Scenario: Cartão de avisos lista os avisos de leitura
- **WHEN** uma pessoa recebeu aviso de nova leitura e aviso de atraso
- **THEN** o cartão "Avisos" mostra os dois, o mais recente primeiro, com a
  data

### Requirement: Saudação convida ao tour quem ainda não o fez

A tela inicial SHALL apresentar, à direita da saudação, o convite "Primeira vez
aqui? Faça o tour de 2 minutos" enquanto a pessoa não tiver feito o tour, e
acioná-lo SHALL começar o tour guiado. Depois de feito, o convite NÃO SHALL ser
apresentado. O convite SHALL ser apresentado como **cápsula de fundo azul-claro
com ícone de reprodução** à frente do texto, com o texto em contraste de ao menos
4,5:1 sobre esse fundo e a área de acionamento mínima da aplicação; o ícone
SHALL ser decorativo, e o nome acessível do convite SHALL ser o seu texto.
Referência: PRD US 11.3; demanda do cliente nº 2, seção 1.3;
`docs/demanda_cliente_3.md`, item 8.

#### Scenario: Quem não fez o tour vê o convite
- **WHEN** uma pessoa que nunca fez o tour abre a tela inicial
- **THEN** vê o convite à direita da saudação, e acioná-lo começa o tour

#### Scenario: Quem já fez o tour não vê o convite
- **WHEN** uma pessoa que já fez ou fechou o tour abre a tela inicial
- **THEN** o convite não é apresentado

#### Scenario: Convite tem a forma de cápsula com ícone de reprodução
- **WHEN** uma pessoa que nunca fez o tour vê o convite
- **THEN** ele aparece como cápsula de fundo azul-claro, com o ícone de
  reprodução à frente do texto

#### Scenario: Convite é anunciado só pelo texto
- **WHEN** uma tecnologia assistiva alcança o convite
- **THEN** ele é anunciado como link pelo texto "Primeira vez aqui? Faça o tour
  de 2 minutos", sem anunciar o ícone

### Requirement: Atalhos ocupam uma linha quando o conteúdo comporta

A tela inicial SHALL dispor os atalhos numa **única linha** sempre que a largura da **área de conteúdo** que os contém comportar todos com o rótulo inteiro, e SHALL distribuí-los em mais linhas, de colunas iguais, quando não comportar — decidindo pelo espaço da área, não pela largura da janela. Nenhuma disposição SHALL cortar rótulo nem produzir rolagem horizontal. Referência: `docs/demanda_cliente_3.md`, item 6.

#### Scenario: Os quatro atalhos numa linha em tela larga
- **WHEN** uma pessoa abre a tela inicial, com manual configurado, numa largura
  em que a área de conteúdo comporta os quatro atalhos com o rótulo inteiro
- **THEN** vê Enviar documento, Nova pasta, Buscar documento e Manual do usuário
  lado a lado, numa única linha, com a mesma largura, acima das pastas, dos
  documentos recentes e da coluna de leitura obrigatória e avisos

#### Scenario: A disposição acompanha a área, não a janela
- **WHEN** a janela mantém a mesma largura, mas a área de conteúdo muda de
  largura — por exemplo, ao colapsar ou expandir a navegação
- **THEN** a disposição dos atalhos acompanha a largura da área, passando entre
  uma e duas linhas sem rótulo cortado

#### Scenario: Tela estreita empilha os atalhos
- **WHEN** uma pessoa abre a tela inicial numa largura em que a área de conteúdo
  não comporta dois atalhos lado a lado
- **THEN** os atalhos aparecem um abaixo do outro, ocupando a largura da área,
  sem rolagem horizontal da página

### Requirement: Descrição do atalho é curta e fiel ao que o produto faz

Cada atalho da tela inicial SHALL trazer, abaixo do rótulo, uma descrição de uma linha que diga como a ação é feita, e NÃO SHALL prometer capacidade que o produto não oferece — a descrição do atalho de busca NÃO SHALL anunciar busca no conteúdo dos arquivos enquanto a busca alcançar só nome e código. Referência: `docs/demanda_cliente_3.md`, item 6.

#### Scenario: Descrições curtas acompanham os atalhos
- **WHEN** uma pessoa lê os atalhos da tela inicial
- **THEN** cada um traz uma descrição curta, de uma linha na disposição em linha
  única, abaixo do rótulo

#### Scenario: O atalho de busca promete só o que a busca alcança
- **WHEN** uma pessoa lê a descrição do atalho Buscar documento
- **THEN** a descrição menciona os critérios que a busca de fato aceita, e não
  menciona o conteúdo dos arquivos

### Requirement: Linha de recentes destaca o título do documento

Cada linha de "Documentos recentes" SHALL apresentar, em destaque, o **título** do documento — o nome do arquivo sem a extensão e sem o prefixo igual ao seu código — com o código abaixo, e o **nome íntegro do arquivo** SHALL permanecer disponível pelo nome acessível e pela dica. Sem título que sobre após a limpeza, SHALL apresentar o nome sem a extensão. Referência: PRD US 11.2; `docs/demanda_cliente_3.md`, item 12.

#### Scenario: Código e extensão saem do título
- **WHEN** a lista apresenta o arquivo "POP-ASS-004 - Emissão da declaração de
  óbito.pdf", de código POP-ASS-004
- **THEN** a linha mostra "Emissão da declaração de óbito" em destaque e,
  abaixo, POP-ASS-004

#### Scenario: Nome sem o prefixo do código perde só a extensão
- **WHEN** a lista apresenta o arquivo "Passagem de plantão.docx", de código
  PRT-ASS-002
- **THEN** a linha mostra "Passagem de plantão" em destaque e, abaixo,
  PRT-ASS-002

#### Scenario: Prefixo que difere do código é preservado
- **WHEN** a lista apresenta o arquivo "POP-ASS-005 rascunho.pdf", de código
  POP-ASS-004
- **THEN** o título mantém "POP-ASS-005 rascunho", porque o prefixo não é o
  código do documento

#### Scenario: Nome igual ao código não deixa a linha sem título
- **WHEN** a lista apresenta o arquivo "POP-ASS-004.pdf", de código POP-ASS-004
- **THEN** a linha mostra "POP-ASS-004" como título, em vez de um título vazio

#### Scenario: Nome íntegro do arquivo continua alcançável
- **WHEN** uma pessoa aponta para o título ou uma tecnologia assistiva o anuncia
- **THEN** o nome completo do arquivo, com extensão, é apresentado

#### Scenario: Acionar o título abre o documento
- **WHEN** uma pessoa aciona o título de uma linha de recentes
- **THEN** o documento abre no visualizador, como antes

### Requirement: Etiqueta de tipo na lista de recentes tem largura uniforme

A coluna Tipo de "Documentos recentes" SHALL apresentar a etiqueta do tipo com a sigla em destaque sobre o fundo tingido do tom do tipo, com a **mesma largura** em todas as linhas, de modo que as siglas fiquem alinhadas. A sigla SHALL continuar portando a informação, com a cor como redundância, e o nome completo do tipo SHALL seguir disponível na dica. Referência: `docs/demanda_cliente_3.md`, item 11.

#### Scenario: Etiquetas alinhadas na coluna
- **WHEN** a lista apresenta documentos de tipos POP, PRT e FOR
- **THEN** as três etiquetas têm a mesma largura e a sigla de cada uma aparece
  em destaque sobre o seu tom

#### Scenario: A sigla continua legível sem a cor
- **WHEN** uma pessoa que não distingue cores lê a coluna Tipo
- **THEN** identifica o tipo pela sigla, e o par de cores da etiqueta atende ao
  piso de contraste de texto

### Requirement: Cartão de pasta apresenta ícone colorido e o número de documentos

Cada cartão de **Pastas da unidade** SHALL apresentar o ícone de pasta colorido, sobre fundo tingido do próprio tom, e, abaixo do nome, o número de documentos que a pessoa pode abrir **dentro da pasta, incluindo as subpastas a que tem acesso**, **tal como informado pelo servidor** — a tela NÃO SHALL calcular nem estimar a contagem. O tom SHALL ser estável para a mesma pasta entre visitas, e a cor SHALL ser apenas decorativa: a informação está no texto. O nome acessível do cartão SHALL continuar sendo o nome da pasta, com o número de documentos disponível como descrição para tecnologia assistiva. Referência: `docs/demanda_cliente_3.md`, item 7; PRD US 11.1, cenário 3.

#### Scenario: O cartão mostra o número de documentos
- **WHEN** uma pessoa abre a tela inicial e o servidor informa que uma pasta
  tem 12 documentos visíveis para ela
- **THEN** o cartão da pasta mostra o nome e, abaixo, "12 documentos"

#### Scenario: Pasta organizada em subpastas mostra a soma
- **WHEN** uma pasta de primeiro nível guarda seus documentos apenas em
  subpastas a que a pessoa tem acesso, e o servidor informa a soma deles
- **THEN** o cartão mostra essa soma, e não "Nenhum documento"

#### Scenario: Singular e ausência de documentos
- **WHEN** o servidor informa um documento para uma pasta e nenhum para outra
- **THEN** os cartões mostram "1 documento" e "Nenhum documento",
  respectivamente

#### Scenario: O ícone é colorido e a cor da pasta é estável
- **WHEN** uma pessoa volta à tela inicial depois que outra pasta foi criada na
  unidade
- **THEN** cada pasta já existente mantém a mesma cor de ícone, e o ícone não é
  anunciado por tecnologia assistiva

#### Scenario: O nome acessível continua sendo o nome da pasta
- **WHEN** uma pessoa navega pelos links da tela inicial com leitor de tela
- **THEN** o cartão é anunciado pelo nome da pasta, seguido do número de
  documentos como descrição
