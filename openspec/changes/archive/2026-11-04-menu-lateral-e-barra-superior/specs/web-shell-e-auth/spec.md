# Spec Delta

## MODIFIED Requirements

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
recentes e a lixeira, acrescidos dos destinos de administração permitidos ao
papel. A busca NÃO SHALL ocupar um destino da navegação, por estar
permanentemente acessível na barra superior (ver capability `web-busca`).

O acesso a "Minha conta" (rota `/minha-conta`, ver capability `web-minha-conta`)
SHALL ser alcançável a partir da identidade no rodapé da navegação, e SHALL ser
oferecido a **qualquer** papel, inclusive `collaborator`, por não ser item de
administração.

A navegação SHALL distinguir **destinos internos** — telas da aplicação,
filtradas por papel, das quais exatamente uma reflete a tela corrente — de
**acessos auxiliares**, que levam a recurso externo à aplicação. As duas
naturezas SHALL ser reunidas em grupos distintos e rotulados, e o acesso
auxiliar NÃO SHALL participar da indicação de tela corrente, por não ser uma
tela. A distinção SHALL permanecer perceptível a quem não enxerga a tela, pelo
nome acessível do item, que SHALL anunciar que o acesso leva para fora da
aplicação — o rótulo do grupo acrescenta a distinção visual, e NÃO SHALL
dispensar o nome acessível.

Abaixo do ponto de ruptura definido pela capability `web-responsividade`, a
navegação SHALL ser apresentada como **painel sobreposto**, acionado a partir da
barra superior, em vez de ocupar permanentemente uma faixa lateral da tela. O
painel SHALL oferecer exatamente os mesmos itens da navegação do modo largo,
nos mesmos grupos, para o mesmo papel, e ambos SHALL ser alimentados por uma
origem única — a SPA NÃO SHALL manter listas de navegação paralelas por modo de
apresentação. O painel SHALL apresentar também a identidade no seu rodapé, pela
mesma origem única.

Acionar um **destino interno** no painel sobreposto SHALL navegar e **fechar** o
painel. Acionar o **acesso auxiliar** NÃO SHALL fechá-lo, por não haver navegação
dentro da aplicação a refletir.

Com a navegação colapsada, todo item — destino interno ou acesso auxiliar —
SHALL permanecer identificável por seu nome, sem depender do reconhecimento do
ícone isolado.

Referência: PRD NFR de Usabilidade ("interface limpa e premium, navegação
familiar"); PRD US 1.3; PRD US 11.1; design.md D5/D6 do change
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
- **THEN** o acesso auxiliar aparece num grupo rotulado distinto do grupo dos
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
- **WHEN** uma pessoa aciona o acesso auxiliar no painel sobreposto
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

## ADDED Requirements

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

### Requirement: Identidade no rodapé da navegação apresenta nome, papel e unidade

O rodapé da navegação SHALL apresentar, de forma permanentemente visível e sem
exigir acionamento, as iniciais do nome, o nome, o papel e a unidade da pessoa
autenticada, e SHALL oferecer a ação **Sair**. As iniciais SHALL derivar do
nome, nunca do identificador interno. O controle de recolher a navegação SHALL
permanecer disponível.

Referência: PRD US 11.1 cenário 1; demanda do cliente nº 2, seção 1.1.

#### Scenario: Rodapé apresenta a identidade sem exigir acionamento
- **WHEN** uma pessoa autenticada visualiza a navegação expandida
- **THEN** lê no rodapé suas iniciais, seu nome, seu papel e sua unidade, sem
  precisar abrir nenhum menu

#### Scenario: Sair está ao alcance no rodapé
- **WHEN** uma pessoa autenticada quer encerrar a sessão
- **THEN** alcança a ação Sair a partir do rodapé da navegação

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

#### Scenario: O rodapé da navegação permanece visível em página longa
- **WHEN** uma pessoa autenticada abre uma tela cujo conteúdo é mais alto que a
  área visível
- **THEN** a identidade no rodapé da navegação continua visível sem rolar a
  página, e o controle de recolher não a encobre

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
