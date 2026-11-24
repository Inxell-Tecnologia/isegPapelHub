# Spec Delta

## MODIFIED Requirements

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
