# web-shell-e-auth Specification

## Purpose

Define os requisitos verificáveis do shell web (SPA) do GDoc — como a
aplicação é servida na mesma origem da API, como a autenticação por sessão de
servidor é consumida no cliente (login, bootstrap de sessão, logout), como as
rotas autenticadas são protegidas por identidade e por papel, e o shell de
layout (navegação, cabeçalho com identidade/papel, logout) sobre o qual as
demais fatias do produto montam suas telas. Implementa o Épico 1 / US 1.2 do
PRD (`docs/prd_final.md`) do lado do cliente, complementando o spec
`autenticacao` (que cobre a emissão/verificação de sessão no backend) sem
re-descrever seus cenários.

## Requirements

### Requirement: SPA servida na mesma origem da API

A aplicação web SHALL ser servida na **mesma origem** da API, de modo que o
cookie de sessão `HttpOnly`/`SameSite=Strict` acompanhe as requisições sem
necessidade de CORS e sem qualquer alteração no backend. Em desenvolvimento,
o servidor de dev SHALL encaminhar (proxy) os prefixos de API existentes
(`/auth`, `/files`, `/folders`, `/users`, `/grants`, `/trash`, `/audit`,
`/dashboard`, `/search`, `/health`) para a API local. Em produção, o url-map
do load balancer SHALL rotear esses mesmos prefixos para a API (Cloud Run) e as
demais rotas para o bucket estático da SPA. O cliente NÃO SHALL ler nem
persistir o token de sessão (é `HttpOnly`).

Referência: PRD US 1.2, NFR de Segurança; `apps/api/src/lib/session-cookie.ts`;
design.md D1/D2/D3 do change `web-shell-e-auth`.

#### Scenario: Requisição autenticada carrega o cookie de sessão
- **WHEN** a SPA faz uma chamada a um endpoint de API pela mesma origem
- **THEN** o cookie de sessão é enviado automaticamente pelo browser, sem CORS,
  e o cliente não manipula o token diretamente

### Requirement: Autenticação por login com sessão de servidor

A SPA SHALL oferecer uma página de **login** que envia e-mail e senha a
`POST /auth/login`; em caso de sucesso, SHALL registrar a identidade retornada
(`AuthenticatedIdentity`) e navegar **sempre para a tela de Início (`/`)** do
shell autenticado, independentemente da rota que a pessoa tenha tentado acessar
antes do login. Em caso de credenciais inválidas (`401`), SHALL exibir **uma
mensagem genérica** que não revela se o e-mail existe ou se a senha estava
errada (US 1.2 cenário 2). Em caso de conta desativada (`403`, resposta distinta
que a API já produz em `POST /auth/login`), SHALL exibir um **aviso específico de
conta indisponível**, sem confundir com a mensagem genérica de credenciais
inválidas (US 1.2 cenário 3). Ao abrir a aplicação, a SPA SHALL fazer
**bootstrap da sessão** por `GET /auth/me`; se houver sessão válida, entra
autenticada, caso contrário permanece deslogada. O **logout** SHALL chamar
`POST /auth/logout` e limpar o estado de sessão do cliente.

Referência: PRD US 1.2 (cenários 1, 2 e 3); design.md D3.

#### Scenario: Login com credenciais válidas navega para a Início
- **WHEN** a pessoa informa e-mail e senha corretos e confirma o login
- **THEN** a identidade é registrada no cliente e a aplicação navega para a tela
  de Início (`/`) do shell autenticado

#### Scenario: Login descarta o deep-link solicitado antes da autenticação
- **WHEN** uma pessoa sem sessão tenta abrir uma rota autenticada específica, é
  redirecionada ao login e então autentica com credenciais válidas
- **THEN** a aplicação navega para a tela de Início (`/`), e não para a rota
  originalmente solicitada

#### Scenario: Login com credenciais inválidas mostra mensagem genérica
- **WHEN** a pessoa informa e-mail inexistente ou senha incorreta
- **THEN** a SPA exibe uma única mensagem genérica de credenciais inválidas, sem
  distinguir e-mail de senha, e permanece na página de login

#### Scenario: Conta desativada mostra aviso específico no login
- **WHEN** a pessoa informa credenciais corretas de uma conta desativada pela
  administração
- **THEN** a SPA exibe um aviso específico de conta indisponível (distinto da
  mensagem genérica de credenciais inválidas) e permanece na página de login

#### Scenario: Bootstrap de sessão ao abrir a aplicação
- **WHEN** a aplicação é aberta e existe uma sessão válida no cookie
- **THEN** `GET /auth/me` resolve a identidade e a aplicação entra autenticada
  sem exigir novo login

#### Scenario: Logout encerra a sessão no cliente
- **WHEN** a pessoa aciona o logout
- **THEN** a SPA chama `POST /auth/logout`, limpa o estado de sessão e volta à
  página de login

### Requirement: Guarda de rota por autenticação e por papel

As rotas autenticadas SHALL ser protegidas: sem identidade resolvida, o acesso
SHALL redirecionar para `/login`. As áreas restritas a administração (gestão de
pessoas, painel gerencial e consulta ampla de auditoria) SHALL exigir papel
`unit_admin` ou `global_admin`; um `collaborator` que tente acessá-las SHALL ser
impedido no cliente. Uma resposta **401** de qualquer chamada autenticada
(sessão expirada ou conta desativada, revalidada pelo servidor a cada
requisição) SHALL encerrar a sessão no cliente e redirecionar para `/login`.

Referência: PRD US 1.2 (cenário 3), RF #3; design.md D4/D6.

#### Scenario: Rota protegida sem sessão redireciona ao login
- **WHEN** uma pessoa sem sessão tenta abrir uma rota autenticada
- **THEN** é redirecionada para `/login`, sem renderizar a rota protegida

#### Scenario: 401 em chamada autenticada encerra a sessão
- **WHEN** uma chamada autenticada retorna 401 (sessão expirada ou conta
  desativada)
- **THEN** o cliente limpa o estado de sessão e redireciona para `/login`

#### Scenario: Área de administração exige papel de administrador
- **WHEN** um `collaborator` tenta acessar uma rota restrita a administração
- **THEN** o acesso é impedido no cliente (o item de menu não é oferecido e a
  rota não é renderizada para o papel)

### Requirement: Shell de layout com identidade e navegação

A aplicação autenticada SHALL apresentar um **shell** de layout (usando o design
system Ant Design) com área de navegação, uma barra superior com as ações
permanentemente ao alcance, e uma área de conteúdo onde as demais fatias montam
suas telas. A identidade e o papel do usuário corrente, junto da ação de
logout, SHALL ser apresentados no **rodapé da navegação**, e NÃO SHALL ocupar a
barra superior. Os itens de navegação SHALL respeitar o papel do usuário (itens
de administração só aparecem para administradores).

A identidade apresentada SHALL ser o **nome da pessoa**, e NÃO SHALL ser um
identificador interno nem um fragmento dele. Conta sem nome cadastrado SHALL
recorrer a um tratamento genérico, nunca ao identificador.

O conjunto de destinos internos SHALL cobrir a tela inicial, os documentos, os
recentes, **os favoritos**, os compartilhados comigo, **a leitura obrigatória**
e a lixeira, nessa ordem, acrescidos dos destinos de administração permitidos ao
papel. Os destinos de favoritos, de compartilhados e de leitura obrigatória
SHALL ser oferecidos a **qualquer** papel autenticado, inclusive
`collaborator`, por não serem itens de administração (ver capabilities
`favoritos`, `compartilhados-comigo` e `leitura-obrigatoria`). O item de
leitura obrigatória SHALL apresentar o **contador** das leituras abertas da
pessoa — pendentes e atrasadas — quando houver ao menos uma, e o nome acessível
do item SHALL incluir essa contagem; sem leitura aberta, o contador NÃO SHALL
ser apresentado. A busca NÃO SHALL
ocupar um destino da navegação, por estar permanentemente acessível na barra
superior (ver capability `web-busca`).

O acesso a "Minha conta" (rota `/minha-conta`, ver capability `web-minha-conta`)
SHALL ser alcançável a partir da identidade no rodapé da navegação, e SHALL ser
oferecido a **qualquer** papel, inclusive `collaborator`, por não ser item de
administração.

A navegação SHALL distinguir **destinos internos** — telas da aplicação,
filtradas por papel, das quais exatamente uma reflete a tela corrente — de
**acessos auxiliares** — ajuda ao uso, que não é tela: o manual, que leva a
recurso externo à aplicação, e o tour guiado, que é ação dentro dela (ver
capability `tour-guiado`). As duas naturezas SHALL ser reunidas em grupos
distintos e rotulados, e o acesso auxiliar NÃO SHALL participar da indicação de
tela corrente, por não ser uma tela. O acesso auxiliar que leva para fora da
aplicação SHALL anunciar isso no seu nome acessível — o rótulo do grupo
acrescenta a distinção visual, e NÃO SHALL dispensar o nome acessível; o acesso
auxiliar interno NÃO SHALL anunciar saída que não acontece.

Abaixo do ponto de ruptura definido pela capability `web-responsividade`, a
navegação SHALL ser apresentada como **painel sobreposto**, acionado a partir da
barra superior, em vez de ocupar permanentemente uma faixa lateral da tela. O
painel SHALL oferecer exatamente os mesmos itens da navegação do modo largo,
nos mesmos grupos, para o mesmo papel, e ambos SHALL ser alimentados por uma
origem única — a SPA NÃO SHALL manter listas de navegação paralelas por modo de
apresentação. O painel SHALL apresentar também a identidade no seu rodapé, pela
mesma origem única.

Acionar um **destino interno** ou o **tour guiado** no painel sobreposto SHALL
navegar e **fechar** o painel. Acionar o acesso auxiliar **externo** NÃO SHALL
fechá-lo, por não haver navegação dentro da aplicação a refletir.

Com a navegação colapsada, todo item — destino interno ou acesso auxiliar —
SHALL permanecer identificável por seu nome, sem depender do reconhecimento do
ícone isolado.

Referência: PRD NFR de Usabilidade ("interface limpa e premium, navegação
familiar"); PRD US 1.3; PRD US 11.1; PRD US 12.4; demanda do cliente nº 2,
seções 1.1 e 3.2 (etapa 2, item 2); design.md D5/D6 do change
`web-shell-e-auth`; design.md D6/D8 do change `acesso-ao-manual-no-shell`, cuja
decisão de posicionamento é substituída por design.md D2/D3 do change
`responsividade-mobile-tablet`, por sua vez ajustada por design.md D1/D2 do
change `menu-lateral-e-barra-superior`.

#### Scenario: Shell mostra identidade e navegação conforme o papel
- **WHEN** uma pessoa autenticada visualiza o shell
- **THEN** vê seu nome/identidade e papel no rodapé da navegação, a ação de
  logout e apenas os itens de navegação permitidos ao seu papel

#### Scenario: A identidade não ocupa a barra superior
- **WHEN** uma pessoa autenticada percorre a barra superior do shell
- **THEN** não encontra ali seu nome, suas iniciais nem seu papel, por estarem
  no rodapé da navegação

#### Scenario: Menu de identidade dá acesso a Minha conta em qualquer papel
- **WHEN** uma pessoa com papel `collaborator` aciona a identidade no rodapé da
  navegação
- **THEN** encontra o acesso a "Minha conta" e a ação de logout

#### Scenario: Acesso auxiliar não é apresentado como tela corrente
- **WHEN** uma pessoa autenticada navega para qualquer tela da aplicação
- **THEN** o acesso auxiliar permanece sem marcação de seleção, qualquer que seja
  a tela em que ela esteja

#### Scenario: Acesso auxiliar é distinguível dos destinos internos
- **WHEN** uma pessoa autenticada percorre a navegação
- **THEN** os acessos auxiliares aparecem num grupo rotulado distinto do grupo
  dos destinos internos, e o nome acessível do manual indica que leva para fora
  da aplicação

#### Scenario: Navegação colapsada preserva o nome de cada item
- **WHEN** uma pessoa autenticada colapsa a navegação lateral e aponta para um
  item, seja destino interno ou acesso auxiliar
- **THEN** o nome do item é apresentado, sem exigir que ela identifique o ícone
  sozinho

#### Scenario: Abaixo do limiar a navegação é chamada sob demanda
- **WHEN** uma pessoa autenticada abre a aplicação numa tela mais estreita que o
  ponto de ruptura
- **THEN** a navegação não ocupa faixa lateral permanente, e é apresentada como
  painel sobreposto acionado a partir da barra superior

#### Scenario: Painel sobreposto oferece os mesmos itens do modo largo
- **WHEN** a mesma pessoa, com o mesmo papel, percorre a navegação no modo largo
  e no painel sobreposto
- **THEN** encontra exatamente os mesmos itens, nos mesmos grupos e na mesma
  ordem, incluindo os itens de administração permitidos ao seu papel, e a
  identidade no rodapé dos dois

#### Scenario: Navegar por destino interno fecha o painel sobreposto
- **WHEN** uma pessoa aciona um destino interno no painel sobreposto
- **THEN** a aplicação navega para a tela correspondente e o painel se fecha,
  revelando o conteúdo alcançado

#### Scenario: Acionar o acesso auxiliar não fecha o painel sobreposto
- **WHEN** uma pessoa aciona o manual no painel sobreposto
- **THEN** o recurso externo é aberto fora da aplicação e o painel permanece como
  estava, por não ter havido navegação interna

#### Scenario: A identidade apresentada é o nome, não o identificador
- **WHEN** uma pessoa autenticada visualiza o shell
- **THEN** a identidade apresentada é o seu nome, e em nenhum lugar do shell
  aparece o identificador interno da sua conta ou parte dele

#### Scenario: Conta sem nome recorre a tratamento genérico
- **WHEN** uma pessoa cuja conta não tem nome cadastrado visualiza o shell
- **THEN** a identidade é apresentada por um tratamento genérico, sem recorrer
  ao identificador interno

#### Scenario: A busca não ocupa destino da navegação
- **WHEN** uma pessoa autenticada percorre os destinos da navegação
- **THEN** não encontra a busca entre eles, por estar permanentemente acessível
  na barra superior

#### Scenario: Compartilhados comigo é destino de qualquer papel
- **WHEN** uma pessoa de papel `collaborator` percorre os destinos da navegação
- **THEN** encontra "Compartilhados comigo" entre eles, e acioná-lo a leva ao
  destino sem recusa

#### Scenario: Favoritos é destino de qualquer papel, antes de compartilhados
- **WHEN** uma pessoa de papel `collaborator` percorre os destinos da navegação
- **THEN** encontra o destino de favoritos logo depois de recentes e antes de
  compartilhados comigo, e o abre sem recusa

#### Scenario: O tour guiado é acesso auxiliar interno
- **WHEN** uma pessoa autenticada, de qualquer papel, percorre o grupo AJUDA
- **THEN** encontra o item Tour guiado, sem marcação de tela corrente e sem
  anúncio de saída da aplicação no nome acessível

#### Scenario: Acionar o tour no painel sobreposto fecha o painel
- **WHEN** uma pessoa aciona o tour guiado no painel sobreposto
- **THEN** o painel se fecha e o tour começa na tela inicial

#### Scenario: Leitura obrigatória é destino de qualquer papel, com contador
- **WHEN** uma pessoa de papel `collaborator` com duas leituras obrigatórias
  abertas percorre os destinos da navegação
- **THEN** encontra "Leitura obrigatória" depois de compartilhados comigo e
  antes da lixeira, com o contador 2, e o nome acessível do item diz que há 2
  pendentes

#### Scenario: Sem leitura aberta, sem contador
- **WHEN** uma pessoa sem leitura obrigatória aberta percorre a navegação
- **THEN** o item "Leitura obrigatória" aparece sem contador

### Requirement: Navegação reúne os itens em grupos rotulados

A navegação SHALL reunir seus itens em grupos com rótulo visível: os destinos
internos sob **NAVEGAÇÃO** e os acessos auxiliares sob **AJUDA**. O rótulo do
grupo SHALL ser apresentado como título de seção, e NÃO SHALL ser acionável —
não é destino. Grupo sem nenhum item visível ao papel corrente NÃO SHALL
apresentar seu rótulo.

#### Scenario: Destinos e acessos auxiliares aparecem sob rótulos distintos
- **WHEN** uma pessoa autenticada visualiza a navegação expandida
- **THEN** encontra os destinos internos sob o rótulo NAVEGAÇÃO e o acesso ao
  manual sob o rótulo AJUDA

#### Scenario: Rótulo de grupo não é acionável
- **WHEN** uma pessoa aciona o rótulo de um grupo da navegação
- **THEN** nenhuma navegação acontece e nenhuma seleção muda

#### Scenario: Grupo sem item visível não apresenta rótulo
- **WHEN** o único item de um grupo não está disponível para o papel ou para a
  implantação corrente
- **THEN** o rótulo daquele grupo não é apresentado, em vez de encabeçar uma
  seção vazia

### Requirement: Largura da navegação acomoda o rótulo integral de cada item

A navegação expandida SHALL ter largura suficiente para apresentar o rótulo
**integral** de todo item oferecido, e nenhum rótulo de item SHALL ser
truncado. A largura SHALL ser declarada em um único lugar do código, de modo
que a coluna lateral e o painel sobreposto não divirjam.

#### Scenario: Nenhum rótulo de item aparece cortado
- **WHEN** uma pessoa autenticada percorre a navegação expandida, com todos os
  itens permitidos ao seu papel
- **THEN** cada rótulo é apresentado por inteiro, sem reticências de corte

### Requirement: Identidade no rodapé da navegação apresenta nome, função e unidade

O rodapé da navegação SHALL apresentar, de forma permanentemente visível e sem
exigir acionamento, as iniciais do nome, o nome, a **função** — o cargo do
cadastro — e a unidade da pessoa autenticada, e SHALL oferecer a ação **Sair**.
Quando a função não estiver preenchida, o rodapé SHALL apresentar o rótulo do
**papel de acesso** em seu lugar, pela origem única desse rótulo. As iniciais
SHALL derivar do nome, nunca do identificador interno. O controle de recolher a
navegação SHALL permanecer disponível.

A ação **Sair** SHALL ser um controle compacto ao lado da identidade, com
nome acessível "Sair" e dica ao apontar, e SHALL respeitar a área mínima de
acionamento de `sistema-de-design`. Ela NÃO SHALL ficar dentro do acesso a
"Minha conta", para que os dois alvos não se confundam.

Referência: PRD US 11.1 cenário 1; demanda do cliente nº 2, seção 1.1;
`docs/respostas_a1_funcao_e_setor.txt`, resposta 1 (a);
`docs/demanda_cliente_3.md`, item 4.

#### Scenario: Rodapé apresenta a identidade sem exigir acionamento
- **WHEN** uma pessoa autenticada visualiza a navegação expandida
- **THEN** lê no rodapé suas iniciais, seu nome, sua função e sua unidade, sem
  precisar abrir nenhum menu

#### Scenario: Conta sem função recorre ao rótulo do papel
- **WHEN** uma pessoa cuja conta não tem cargo preenchido visualiza o rodapé da
  navegação
- **THEN** lê o rótulo do seu papel de acesso no lugar da função, com o mesmo
  texto exibido nas demais telas que apresentam papel

#### Scenario: Sair está ao alcance no rodapé
- **WHEN** uma pessoa autenticada quer encerrar a sessão
- **THEN** alcança a ação Sair a partir do rodapé da navegação

#### Scenario: Sair compacto mantém nome e alvo
- **WHEN** uma pessoa percorre o rodapé da navegação expandida por teclado ou
  por tecnologia assistiva
- **THEN** encontra a ação Sair como controle próprio, separado do acesso a
  "Minha conta", anunciado como "Sair" e com ao menos 44 pixels de altura de
  área de acionamento

#### Scenario: Nome longo não rompe a largura da navegação
- **WHEN** a pessoa autenticada tem nome mais longo do que o rodapé acomoda
- **THEN** o cartão preserva a largura da navegação e o nome completo permanece
  disponível a quem aponta o cartão ou o consulta por tecnologia assistiva

#### Scenario: Recolher a navegação preserva o alcance da identidade
- **WHEN** uma pessoa autenticada recolhe a navegação
- **THEN** o controle de recolher continua disponível e a identidade permanece
  alcançável, sem que o identificador interno apareça em seu lugar

### Requirement: A navegação ocupa a altura visível da tela

A navegação em faixa lateral SHALL ocupar a altura **visível** da tela e
acompanhar a rolagem do conteúdo, de modo que o seu rodapé permaneça ao alcance
qualquer que seja o comprimento da página. O rodapé NÃO SHALL ser deslocado para
fora da área visível pelo crescimento do conteúdo, nem SHALL ser encoberto pelo
controle de recolher.

Com área visível de **768 pixels de altura** ou mais, a navegação expandida
SHALL apresentar todos os itens permitidos ao papel — inclusive o de maior
número de itens, administrador global com o manual configurado — por inteiro e
**sem barra de rolagem**. Abaixo dessa altura, a rolagem SHALL ficar restrita
à lista de itens, como último recurso, e a marca e o rodapé SHALL permanecer
visíveis.

O controle de recolher SHALL ficar no **topo** da navegação, junto da marca, e
NÃO SHALL ocupar o pé da coluna.

Referência: `docs/demanda_cliente_3.md`, item 2, e decisões do cliente
(altura-alvo de 768 px; o controle de recolher pode mudar de lugar).

#### Scenario: O rodapé da navegação permanece visível em página longa
- **WHEN** uma pessoa autenticada abre uma tela cujo conteúdo é mais alto que a
  área visível
- **THEN** a identidade no rodapé da navegação continua visível sem rolar a
  página, e o controle de recolher não a encobre

#### Scenario: Navegação cabe sem rolagem em 768 pixels de altura
- **WHEN** um administrador global, numa implantação com manual configurado,
  visualiza a navegação expandida numa área visível de 1366 × 768 pixels
- **THEN** todos os itens dos grupos NAVEGAÇÃO e AJUDA, a marca e o cartão do
  usuário aparecem por inteiro, e a navegação não apresenta barra de rolagem

#### Scenario: Abaixo da altura-alvo só a lista de itens rola
- **WHEN** uma pessoa autenticada visualiza a navegação expandida numa área
  visível mais baixa do que a navegação exige
- **THEN** apenas a lista de itens rola, e a marca no topo e o cartão do usuário
  no pé permanecem visíveis

#### Scenario: Controle de recolher fica no topo da navegação
- **WHEN** uma pessoa autenticada procura o controle de recolher na navegação
  expandida ou colapsada
- **THEN** encontra-o no topo da coluna, junto da marca, com nome acessível que
  diz a ação, e não no pé da coluna

### Requirement: Barra superior oferece a ação de envio de documento

A barra superior SHALL oferecer uma ação de **envio de documento**, apresentada
como ação principal da aplicação. A ação SHALL conduzir ao envio em si, e NÃO
SHALL conduzir a uma recusa por permissão: quem resolve se há envio permitido é
o servidor, no destino alcançado, e a SPA NÃO SHALL antecipar esse veredito.

Referência: `tela-inicial`, requisito "Atalhos da tela inicial refletem o que o
perfil pode fazer"; design.md D4/D5 do change `cartoes-de-atalho-acionaveis`.

#### Scenario: Ação de envio conduz ao envio, de qualquer tela
- **WHEN** uma pessoa autenticada aciona a ação de envio na barra superior
- **THEN** alcança o explorador de documentos com o pedido de envio anunciado, e
  a área de envio recebe o foco tão logo o servidor confirme que ela pode enviar
  naquele destino

#### Scenario: Ação de envio não conduz a uma recusa
- **WHEN** uma pessoa sem permissão de envio no destino alcançado aciona a ação
  de envio na barra superior
- **THEN** nenhuma recusa por permissão é apresentada, e a tela permanece
  utilizável para consulta

#### Scenario: Abaixo do limiar a ação cede o rótulo, não o nome acessível
- **WHEN** uma pessoa autenticada usa a aplicação numa tela mais estreita que o
  ponto de ruptura
- **THEN** a ação de envio é apresentada sem rótulo visível, para devolver
  largura ao campo de busca, e permanece identificável pelo seu nome acessível

### Requirement: Barra superior oferece acesso à ajuda

A barra superior SHALL oferecer um acesso à **ajuda**, que conduz ao mesmo
recurso externo do acesso auxiliar da navegação, a partir de uma origem única de
endereço. O acesso SHALL anunciar, por seu nome acessível, que leva para fora da
aplicação. Onde a barra não o apresentar, o recurso SHALL permanecer alcançável
pela navegação: nenhum acesso SHALL ser perdido.

#### Scenario: Ajuda na barra superior leva ao mesmo recurso do menu
- **WHEN** uma pessoa autenticada aciona o acesso à ajuda na barra superior
- **THEN** alcança o mesmo recurso externo que o acesso auxiliar da navegação
  oferece

#### Scenario: Implantação sem o recurso não oferece o acesso
- **WHEN** a implantação corrente não tem o recurso de ajuda configurado
- **THEN** nem a barra superior nem a navegação apresentam o acesso, em vez de
  oferecerem um acionador sem destino

#### Scenario: Abaixo do limiar a ajuda sai da barra sem sair do alcance
- **WHEN** uma pessoa autenticada abre a aplicação numa tela mais estreita que o
  ponto de ruptura, numa implantação com o recurso configurado
- **THEN** a barra superior não apresenta o acesso à ajuda, e o mesmo recurso
  continua alcançável no grupo de acessos auxiliares da navegação

### Requirement: Sino apresenta as notificações não lidas em vermelho legível

O acesso às notificações na barra superior SHALL apresentar, sobre o sino, a quantidade de notificações não lidas num indicador **vermelho**, cujo número SHALL atender ao piso de contraste de texto de 4,5:1 contra o vermelho, apurado por cálculo. Sem não lidas, o indicador NÃO SHALL ser apresentado. O nome acessível do acesso SHALL informar a quantidade. Referência: `docs/demanda_cliente_3.md`, item 10.

#### Scenario: Não lidas aparecem em vermelho sobre o sino
- **WHEN** uma pessoa com três notificações não lidas visualiza a barra superior
- **THEN** vê o número 3 num indicador vermelho sobre o sino

#### Scenario: Número do indicador é legível
- **WHEN** o par formado pelo número e pelo vermelho do indicador é definido ou
  alterado
- **THEN** o contraste é apurado numericamente e atende ao mínimo de 4,5:1

#### Scenario: Sem não lidas não há indicador
- **WHEN** uma pessoa sem notificação não lida visualiza a barra superior
- **THEN** o sino é apresentado sem indicador numérico

#### Scenario: Quantidade anunciada a quem não vê o indicador
- **WHEN** uma tecnologia assistiva alcança o acesso às notificações de uma
  pessoa com três não lidas
- **THEN** o acesso é anunciado com o nome Notificações e a quantidade de não
  lidas

### Requirement: Navegação colapsada não apresenta rótulo de grupo cortado

Com a navegação colapsada, o rótulo de cada grupo SHALL dar lugar a um separador visual entre os grupos, e NÃO SHALL aparecer cortado por reticência. O grupo SHALL continuar nomeado pelo seu rótulo para tecnologia assistiva. Na navegação expandida, os rótulos permanecem visíveis por inteiro. Referência: registro da fatia A em `docs/plano_demanda_cliente_3.md`.

#### Scenario: Colapsada, grupos separados sem texto cortado
- **WHEN** uma pessoa autenticada colapsa a navegação
- **THEN** os grupos NAVEGAÇÃO e AJUDA aparecem separados por um traço, sem texto
  de rótulo cortado

#### Scenario: Grupo continua nomeado com a navegação colapsada
- **WHEN** uma tecnologia assistiva percorre a navegação colapsada
- **THEN** cada grupo é anunciado pelo seu rótulo

#### Scenario: Expandida, o rótulo volta inteiro
- **WHEN** uma pessoa autenticada expande a navegação colapsada
- **THEN** os rótulos NAVEGAÇÃO e AJUDA voltam a aparecer por inteiro
