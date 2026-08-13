# Spec — web-shell-e-auth (delta)

O shell ganha duas mudanças que se reforçam.

A primeira é o **painel sobreposto**: abaixo do ponto de ruptura único
(capability `web-responsividade`), a navegação lateral permanente daria 200px de
uma tela de 360px à moldura. Ela passa a ser um painel chamado sob demanda,
alimentado pela **mesma** origem de itens do modo largo — nunca por uma segunda
lista, que divergiria em silêncio quando um item filtrado por papel fosse
acrescentado só num dos lados.

A segunda é o **reposicionamento do acesso auxiliar**: o manual do usuário deixa
a área separada do rodapé e passa a ser o **último item** da navegação, junto dos
destinos internos. Isto reverte deliberadamente a decisão D6/D8 do change
arquivado `acesso-ao-manual-no-shell`. Das três cláusulas que aquele change
introduziu, apenas a de posicionamento cai; a não-participação na indicação de
tela corrente e a exigência de nome acessível permanecem — e a segunda **ganha
peso**, porque, sem a separação visual, passa a ser a única portadora da
distinção entre "sai da aplicação" e "mais uma tela da aplicação". Ver design.md
D2, D3.

## MODIFIED Requirements

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
