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
recentes, **os compartilhados comigo** e a lixeira, acrescidos dos destinos de
administração permitidos ao papel. O destino de compartilhados SHALL ser
oferecido a **qualquer** papel autenticado, inclusive `collaborator`, por não ser
item de administração (ver capability `compartilhados-comigo`). A busca NÃO SHALL
ocupar um destino da navegação, por estar permanentemente acessível na barra
superior (ver capability `web-busca`).

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

#### Scenario: Compartilhados comigo é destino de qualquer papel
- **WHEN** uma pessoa de papel `collaborator` percorre os destinos da navegação
- **THEN** encontra "Compartilhados comigo" entre eles, e acioná-lo a leva ao
  destino sem recusa
