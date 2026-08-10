# Spec — web-shell-e-auth (delta)

O shell ganha uma área de **acesso auxiliar** no rodapé da navegação lateral,
distinta da lista de destinos internos. O requisito vigente descreve a
navegação como um conjunto único governado por papel; passa a distinguir duas
naturezas de item, porque um recurso externo disponível a todos não se comporta
como um destino da SPA — não é selecionável, não reflete "tela atual" e leva
para fora da aplicação. Ver design.md D6, D8.

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

A navegação lateral SHALL distinguir **destinos internos** — telas da aplicação,
filtradas por papel, das quais exatamente uma reflete a tela corrente — de
**acessos auxiliares**, que levam a recurso externo à aplicação. O acesso
auxiliar SHALL ocupar área própria ao pé da navegação, visualmente separada dos
destinos internos, e NÃO SHALL participar da indicação de tela corrente, por
não ser uma tela. A separação SHALL ser perceptível também a quem não enxerga a
tela, pelo nome acessível do item.

Com a navegação colapsada, todo item — destino interno ou acesso auxiliar —
SHALL permanecer identificável por seu nome, sem depender do reconhecimento do
ícone isolado.

Referência: PRD NFR de Usabilidade ("interface limpa e premium, navegação
familiar"); PRD US 1.3; design.md D5/D6 do change `web-shell-e-auth`; design.md
D6/D8 do change `acesso-ao-manual-no-shell`.

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
- **THEN** o acesso auxiliar no rodapé permanece sem marcação de seleção,
  qualquer que seja a tela em que ela esteja

#### Scenario: Acesso auxiliar é distinguível dos destinos internos
- **WHEN** uma pessoa autenticada percorre a navegação lateral
- **THEN** o acesso auxiliar aparece separado do bloco de destinos internos, e
  seu nome acessível indica que leva para fora da aplicação

#### Scenario: Navegação colapsada preserva o nome de cada item
- **WHEN** uma pessoa autenticada colapsa a navegação lateral e aponta para um
  item, seja destino interno ou acesso auxiliar
- **THEN** o nome do item é apresentado, sem exigir que ela identifique o ícone
  sozinho
