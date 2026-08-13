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
system Ant Design) com área de navegação, cabeçalho exibindo a identidade e o
papel do usuário corrente e a ação de logout, e uma área de conteúdo onde as
demais fatias montam suas telas. Os itens de navegação SHALL respeitar o papel
do usuário (itens de administração só aparecem para administradores).

A identidade no cabeçalho SHALL ser um **menu** que reúne o acesso a "Minha conta"
(rota `/minha-conta`, ver capability `web-minha-conta`) e a ação de logout. O acesso
a "Minha conta" SHALL ser oferecido a **qualquer** papel, inclusive `collaborator`,
por não ser item de administração.

A navegação SHALL distinguir **destinos internos** — telas da aplicação,
filtradas por papel, das quais exatamente uma reflete a tela corrente — de
**acessos auxiliares**, que levam a recurso externo à aplicação. O acesso
auxiliar SHALL ocupar a **última posição** da navegação, depois de todos os
destinos internos, e NÃO SHALL participar da indicação de tela corrente, por
não ser uma tela. A distinção entre as duas naturezas SHALL ser perceptível a
quem não enxerga a tela, pelo nome acessível do item, que SHALL anunciar que o
acesso leva para fora da aplicação — sendo esta a **única** portadora da
distinção, uma vez que o acesso auxiliar deixou de ocupar área visualmente
separada.

Abaixo do ponto de ruptura definido pela capability `web-responsividade`, a
navegação SHALL ser apresentada como **painel sobreposto**, acionado a partir do
cabeçalho, em vez de ocupar permanentemente uma faixa lateral da tela. O painel
SHALL oferecer exatamente os mesmos itens da navegação do modo largo, para o
mesmo papel, e ambos SHALL ser alimentados por uma origem única — a SPA NÃO SHALL
manter listas de navegação paralelas por modo de apresentação.

Acionar um **destino interno** no painel sobreposto SHALL navegar e **fechar** o
painel. Acionar o **acesso auxiliar** NÃO SHALL fechá-lo, por não haver navegação
dentro da aplicação a refletir.

Com a navegação colapsada, todo item — destino interno ou acesso auxiliar —
SHALL permanecer identificável por seu nome, sem depender do reconhecimento do
ícone isolado.

Referência: PRD NFR de Usabilidade ("interface limpa e premium, navegação
familiar"); PRD US 1.3; design.md D5/D6 do change `web-shell-e-auth`; design.md
D6/D8 do change `acesso-ao-manual-no-shell`, cuja decisão de posicionamento é
substituída por design.md D2/D3 do change `responsividade-mobile-tablet`.

#### Scenario: Shell mostra identidade e navegação conforme o papel
- **WHEN** uma pessoa autenticada visualiza o shell
- **THEN** vê seu nome/identidade e papel, a ação de logout e apenas os itens de
  navegação permitidos ao seu papel

#### Scenario: Menu de identidade dá acesso a Minha conta em qualquer papel
- **WHEN** uma pessoa com papel `collaborator` abre o menu de identidade no
  cabeçalho
- **THEN** encontra o acesso a "Minha conta" e a ação de logout

#### Scenario: Acesso auxiliar não é apresentado como tela corrente
- **WHEN** uma pessoa autenticada navega para qualquer tela da aplicação
- **THEN** o acesso auxiliar permanece sem marcação de seleção, qualquer que seja
  a tela em que ela esteja

#### Scenario: Acesso auxiliar é distinguível dos destinos internos
- **WHEN** uma pessoa autenticada percorre a navegação
- **THEN** o acesso auxiliar aparece na última posição, depois de todos os
  destinos internos, e seu nome acessível indica que leva para fora da aplicação

#### Scenario: Navegação colapsada preserva o nome de cada item
- **WHEN** uma pessoa autenticada colapsa a navegação lateral e aponta para um
  item, seja destino interno ou acesso auxiliar
- **THEN** o nome do item é apresentado, sem exigir que ela identifique o ícone
  sozinho

#### Scenario: Abaixo do limiar a navegação é chamada sob demanda
- **WHEN** uma pessoa autenticada abre a aplicação numa tela mais estreita que o
  ponto de ruptura
- **THEN** a navegação não ocupa faixa lateral permanente, e é apresentada como
  painel sobreposto acionado a partir do cabeçalho

#### Scenario: Painel sobreposto oferece os mesmos itens do modo largo
- **WHEN** a mesma pessoa, com o mesmo papel, percorre a navegação no modo largo
  e no painel sobreposto
- **THEN** encontra exatamente os mesmos itens, na mesma ordem, incluindo os
  itens de administração permitidos ao seu papel

#### Scenario: Navegar por destino interno fecha o painel sobreposto
- **WHEN** uma pessoa aciona um destino interno no painel sobreposto
- **THEN** a aplicação navega para a tela correspondente e o painel se fecha,
  revelando o conteúdo alcançado

#### Scenario: Acionar o acesso auxiliar não fecha o painel sobreposto
- **WHEN** uma pessoa aciona o acesso auxiliar no painel sobreposto
- **THEN** o recurso externo é aberto fora da aplicação e o painel permanece como
  estava, por não ter havido navegação interna
