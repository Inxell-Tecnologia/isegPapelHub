# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
cerca de 340 px com os cartões **"Leitura obrigatória"** e **"Avisos"**. Até
que a leitura obrigatória exista, cada cartão SHALL dizer por escrito o que vai
apresentar, e NÃO SHALL afirmar ausência de pendências. Quando a largura não
comportar as duas colunas, a coluna SHALL passar para depois do conteúdo
principal, ocupando a largura disponível, sem rolagem horizontal. Referência:
demanda do cliente nº 2, seção 1.3 (coluna direita).

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

#### Scenario: Cartão diz o que vai apresentar
- **WHEN** uma pessoa lê o cartão "Leitura obrigatória" antes de a leitura
  obrigatória existir
- **THEN** lê o que vai aparecer ali, e não uma afirmação de que não há
  pendências
