# identidade-visual Specification

## Purpose

Definir os requisitos verificáveis da identidade visual do produto — o nome
comercial da aplicação (**PapelHub**), a logomarca oficial e a identificação do
cliente da implantação (ex.: **SETES**) — como propriedade **configurada por
implantação**, entregue ao SPA por um endpoint público restrito a branding
(porque a tela onde ela aparece é anterior ao login), exibida na tela de login
e no shell autenticado sem contaminar o nome acessível do heading, e
degradando de forma transparente para "sem identificação de cliente" quando a
configuração está ausente ou indisponível. Não decorre de uma US do PRD
(`docs/prd_final.md`) — é um pedido direto do cliente sobre nome comercial,
logomarca e identificação da organização. Onde toca comportamento já
normatizado, preserva-o: o nome acessível do heading de login continua sendo o
nome da aplicação puro, conforme a US 1.2. A logomarca oficial é a logo branca do
Instituto SETES, de fundo transparente, apresentada sem moldura e apenas sobre
os fundos escuros da marca; o símbolo isolado representa a marca na navegação
colapsada, no favicon e como marca d'água (change
`identidade-isetes-e-menu-compacto`).

## Requirements

### Requirement: Nome da aplicação exibido é PapelHub

A aplicação SHALL exibir **PapelHub** como nome do produto em toda a camada
de apresentação: título do documento no navegador, cabeçalho da tela de
login, marca do shell autenticado e tela de Início. O nome NÃO SHALL variar
por papel, por unidade ou por estado de autenticação.

O **título do documento** SHALL ser composto pelo nome da aplicação seguido
da identificação do cliente, quando esta estiver configurada, no formato
`PapelHub - SETES`. O título estático servido no documento SHALL conter
**apenas o nome da aplicação**, e a composição com a identificação do cliente
SHALL ocorrer em tempo de execução, após a resolução da configuração — de
modo que a identificação NÃO SHALL ser fixada em tempo de compilação. Sem
identificação configurada, o título SHALL permanecer apenas com o nome da
aplicação. Identificadores internos de código e infraestrutura (scope npm,
nomes de banco, `name_prefix` do Terraform) permanecem inalterados e não são
objeto deste requisito.

#### Scenario: Título do documento compõe nome e identificação do cliente
- **WHEN** uma pessoa abre a aplicação no navegador com a identificação do cliente
  configurada como `SETES`
- **THEN** o título do documento apresenta `PapelHub - SETES`

#### Scenario: Sem identificação configurada o título fica só com o nome
- **WHEN** uma pessoa abre a aplicação numa implantação sem identificação de
  cliente configurada
- **THEN** o título do documento apresenta apenas `PapelHub`

#### Scenario: Identificação do cliente não é fixada em tempo de compilação
- **WHEN** a identificação do cliente é alterada na configuração da implantação
- **THEN** o título do documento passa a refletir a nova identificação sem exigir
  nova compilação do frontend

#### Scenario: Tela de login apresenta o nome da aplicação
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** o cabeçalho da tela apresenta o nome **PapelHub**

#### Scenario: Shell autenticado apresenta a marca em ambos os estados
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida e
  depois colapsada
- **THEN** a marca apresenta o nome **PapelHub** em texto no estado expandido e,
  no estado colapsado, o símbolo da marca cujo nome acessível é **PapelHub**

### Requirement: Logomarca oficial é exibida na tela de login e no shell expandido

A aplicação SHALL exibir a logomarca oficial — a logo **branca** do Instituto
SETES, de fundo transparente — na tela de login e no shell autenticado com a
navegação expandida. A logomarca SHALL ser apresentada apenas sobre os fundos
escuros da marca (o degradê da navegação e o campo escuro da tela de login), e
NÃO SHALL ser exibida sobre fundo claro. Por ter fundo transparente, ela NÃO
SHALL receber moldura própria.

Referência: `docs/demanda_cliente_3.md`, item 1; dependência externa E1 de
`docs/plano_demanda_cliente_2.md`.

#### Scenario: Logomarca aparece na tela de login
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a logomarca oficial é exibida sobre o campo escuro da composição,
  junto ao cabeçalho com o nome da aplicação, sem moldura própria

#### Scenario: Logomarca aparece no shell expandido
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** a logomarca oficial é exibida diretamente sobre o fundo da navegação,
  no topo, sem moldura própria

#### Scenario: Logomarca não aparece sobre fundo claro
- **WHEN** qualquer tela da aplicação apresenta a logomarca oficial
- **THEN** o fundo imediatamente atrás dela é um dos fundos escuros da marca

### Requirement: Logomarca no shell expandido preserva o nome acessível da marca

A aplicação SHALL garantir que o nome do produto seja anunciado uma única vez
no shell expandido, pelo texto **PapelHub** que acompanha a logomarca. Por
conter o nome da organização, a logomarca do shell SHALL carregar como nome
acessível o nome da organização, e NÃO SHALL repetir o nome do produto. Na
tela de login, onde a identificação do cliente já está em texto, a logomarca
SHALL ser decorativa.

Referência: design.md D7 do change `identidade-visual-isetes`, cuja premissa de
"imagem como única portadora" é substituída por design.md D5 do change
`menu-lateral-e-barra-superior`, por sua vez ajustada por design.md D3 do
change `identidade-isetes-e-menu-compacto`.

#### Scenario: Tecnologia assistiva consulta a marca do shell expandido
- **WHEN** uma tecnologia assistiva consulta a marca do shell com a
  navegação expandida
- **THEN** o nome da aplicação é anunciado uma única vez, pelo texto, e a
  logomarca é anunciada pelo nome da organização

#### Scenario: Logomarca acompanhada de texto não repete o nome
- **WHEN** o nome do produto é apresentado em texto abaixo da logomarca no shell
  expandido
- **THEN** a logomarca não repete o nome do produto, e o nome é anunciado apenas
  pelo texto

#### Scenario: Logomarca do login é decorativa
- **WHEN** uma tecnologia assistiva percorre a tela de login
- **THEN** a logomarca não é anunciada, e o nome da aplicação e a
  identificação do cliente são anunciados pelo texto

### Requirement: Favicon reflete a logomarca oficial

O favicon da aplicação SHALL ser derivado do **símbolo** da logomarca oficial,
enquadrado em proporção quadrada **sem distorcer** a arte — por margem
transparente ou recorte que preserve o símbolo inteiro, nunca por estiramento.

#### Scenario: Aba do navegador exibe o favicon derivado da logomarca
- **WHEN** uma pessoa abre a aplicação no navegador
- **THEN** o ícone exibido na aba é o símbolo da logomarca oficial, inteiro, sem
  aparecer esticado ou distorcido

### Requirement: Fundo da tela de login cobre a área visível integralmente

O fundo da tela de login SHALL cobrir toda a área visível do navegador em
qualquer tamanho de tela, e NÃO SHALL deixar aparecer faixa de outra cor — nem ao
fim da rolagem, nem durante a rolagem elástica além dos limites do documento,
nem quando a barra de endereço de um navegador móvel recolhe e o viewport cresce.

O cartão de acesso SHALL permanecer integralmente visível e legível em telas
estreitas, com respiro lateral em relação às bordas, e NÃO SHALL produzir rolagem
horizontal do documento. A altura do container do login NÃO SHALL ser fixada de
modo que impeça a página de crescer quando o conteúdo não couber — em particular
quando o teclado virtual reduz o viewport.

#### Scenario: Barra de endereço retrátil não revela faixa de outra cor
- **WHEN** uma pessoa abre a tela de login num navegador móvel cuja barra de
  endereço recolhe ao rolar
- **THEN** o fundo continua cobrindo a área visível, sem faixa de outra cor
  surgindo ao pé da tela

#### Scenario: Rolagem elástica não expõe a cor do documento
- **WHEN** uma pessoa puxa a tela de login além do seu limite num navegador com
  rolagem elástica
- **THEN** a área revelada apresenta a mesma cor de fundo da tela, e não a cor do
  documento por baixo

#### Scenario: Cartão de acesso respira em tela estreita
- **WHEN** uma pessoa abre a tela de login numa tela de 375 pixels de largura
- **THEN** o cartão de acesso aparece inteiro, com margem visível dos dois lados,
  sem que a página role horizontalmente

#### Scenario: Teclado virtual não impede o alcance do conteúdo
- **WHEN** uma pessoa toca um campo do formulário num dispositivo com teclado
  virtual, reduzindo a área visível
- **THEN** o formulário permanece alcançável por rolagem normal da página, sem
  que parte do cartão fique inacessível

### Requirement: Identificação do cliente é configurada por implantação

O sistema SHALL obter a identificação do cliente de uma configuração de ambiente
da implantação (`APP_CLIENT_NAME`), e NÃO SHALL embuti-la como literal no código
da interface. Quando a configuração estiver ausente ou vazia, a aplicação SHALL
operar normalmente e simplesmente NÃO exibir identificação de cliente, sem erro,
sem espaço reservado e sem degradação de nenhuma outra funcionalidade. A
identificação SHALL ser única por implantação, NÃO variando por unidade nem por
pessoa autenticada.

#### Scenario: Identificação configurada é exibida
- **WHEN** a implantação define a identificação do cliente como `SETES`
- **THEN** a aplicação exibe `SETES` como identificação do cliente

#### Scenario: Ausência de configuração não exibe identificação nem quebra a tela
- **WHEN** a implantação não define identificação de cliente
- **THEN** nenhuma identificação de cliente é exibida e a tela de login permanece
  plenamente funcional

#### Scenario: Identificação não varia por unidade
- **WHEN** pessoas de unidades diferentes acessam a mesma implantação
- **THEN** todas veem a mesma identificação de cliente

### Requirement: Configuração de identidade visual disponível sem autenticação

O sistema SHALL expor a configuração pública de apresentação por um endpoint
que responde **sem sessão autenticada**, porque a tela onde parte dela precisa
aparecer é anterior ao login. Esse endpoint SHALL devolver **exclusivamente**
os valores desta lista nominal:

- o nome da aplicação;
- a identificação do cliente;
- o endereço do manual do usuário (capability `documentacao-usuario`);
- o contato do suporte da implantação.

O endpoint NÃO SHALL expor nenhum outro valor de configuração, ambiente,
versão, limite ou recurso de infraestrutura. Acrescentar um quinto valor à
resposta SHALL exigir a modificação explícita desta lista, e NÃO SHALL ser
tratado como extensão natural do contrato. Todo valor da lista SHALL ser
público por natureza — nenhum SHALL transitar pelo `SecretsPort`. O endpoint
NÃO SHALL abrir contexto de unidade nem consultar dado tenant-scoped.

#### Scenario: Requisição sem sessão obtém a identidade visual
- **WHEN** um cliente sem sessão autenticada requisita a configuração pública
  de apresentação
- **THEN** recebe o nome da aplicação, a identificação do cliente, o endereço
  do manual e o contato do suporte, sem erro de autenticação

#### Scenario: A resposta não carrega configuração além de identidade visual
- **WHEN** um cliente requisita a configuração pública de apresentação
- **THEN** a resposta contém apenas os valores da lista nominal, e nenhum dado
  de ambiente, versão, limite ou infraestrutura

#### Scenario: Valor não configurado é devolvido como ausência, não omitido
- **WHEN** a identificação do cliente, o endereço do manual ou o contato do
  suporte não está configurado na implantação
- **THEN** o valor correspondente é devolvido vazio, mantendo a forma da
  resposta estável para o consumidor

### Requirement: Rota de identidade visual não introduz prefixo de topo novo

A rota que serve a identidade visual SHALL residir sob um prefixo de API já
declarado nas listas de prefixo existentes, de modo que o fallback de
`index.html` da SPA continue sem sombreá-la e as três listas
(`apps/api/src/lib/api-prefixes.ts`, `apps/web/vite.config.ts` e
`infra/terraform/locals.tf`) permaneçam inalteradas. Referência: capability
`publicacao-frontend`, requisito "Rotas de API nunca sombreadas pelo estático".

#### Scenario: A rota é servida pela API e não pelo estático
- **WHEN** a rota de identidade visual é requisitada na implantação de produção
- **THEN** a resposta vem da API, e não do `index.html` da SPA

#### Scenario: As listas de prefixo permanecem em sincronia
- **WHEN** a rota de identidade visual é adicionada
- **THEN** nenhuma das três listas de prefixo de API precisa ser alterada, e a
  cobertura de sombreamento de rotas continua passando

### Requirement: Identificação do cliente não contamina o nome acessível do título

A identificação do cliente SHALL ser apresentada **abaixo** do nome da aplicação,
em elemento distinto do heading. O **nome acessível** do heading da tela de login
SHALL permanecer sendo o nome da aplicação puro, sem a identificação do cliente e
sem qualquer conteúdo decorativo. No estado colapsado da navegação do shell, a
identificação do cliente NÃO SHALL ser renderizada. Referência: PRD US 1.2.

#### Scenario: Heading de login mantém nome acessível puro
- **WHEN** uma tecnologia assistiva consulta o heading da tela de login com a
  identificação do cliente configurada
- **THEN** o nome acessível do heading é exatamente o nome da aplicação, sem a
  identificação do cliente

#### Scenario: Identificação aparece abaixo do nome na tela de login
- **WHEN** uma pessoa não autenticada abre a tela de login com a identificação do
  cliente configurada
- **THEN** vê a identificação do cliente apresentada abaixo do nome da aplicação

#### Scenario: Navegação colapsada omite a identificação
- **WHEN** uma pessoa autenticada colapsa a navegação do shell
- **THEN** apenas a forma abreviada da marca é exibida, sem a identificação do
  cliente

### Requirement: Falha ao obter a identidade visual não impede o login

Quando a obtenção da configuração de identidade visual falhar por indisponibilidade
ou erro, a aplicação SHALL prosseguir tratando o caso como "sem identificação de
cliente" e SHALL permitir que a pessoa faça login normalmente. A falha NÃO SHALL
bloquear a renderização da tela de login, NÃO SHALL produzir tela de erro e NÃO
SHALL introduzir estado de carregamento perceptível além do bootstrap de sessão já
existente.

#### Scenario: Indisponibilidade da configuração ainda permite autenticar
- **WHEN** a obtenção da identidade visual falha e uma pessoa abre a aplicação
- **THEN** a tela de login é exibida sem identificação de cliente e a pessoa
  consegue autenticar normalmente

#### Scenario: Carregamento não produz alternância visível de conteúdo
- **WHEN** uma pessoa abre a aplicação com a identificação do cliente configurada
- **THEN** a tela de login é apresentada já com a identificação, sem exibir antes
  um estado sem ela

### Requirement: Tela de login apresenta a proposta de valor do produto

A tela de login SHALL apresentar, ao lado do cartão de acesso, a logomarca e um
texto curto que diga o que o produto faz e a quem serve. Esse conteúdo SHALL ser
constante de apresentação, versionada com o código, e NÃO SHALL variar por
pessoa — a tela é anterior ao login e não conhece quem acessa.

#### Scenario: Pessoa não autenticada vê o que o produto faz
- **WHEN** uma pessoa não autenticada abre a tela de login em tela larga
- **THEN** além do cartão de acesso, a tela apresenta a logomarca e um texto que
  descreve a finalidade do produto

#### Scenario: Conteúdo de apresentação não varia por quem acessa
- **WHEN** duas pessoas diferentes abrem a tela de login
- **THEN** ambas veem o mesmo texto de apresentação

### Requirement: Tela de login apresenta campo de marca com cor da paleta

A tela de login SHALL apresentar como fundo uma cor da paleta da marca, e NÃO
SHALL usar o fundo neutro herdado do design system. A cor SHALL ser constante de
apresentação, versionada com o código, e NÃO SHALL ser configuração por
implantação. O conteúdo sobreposto SHALL preservar contraste verificado por
cálculo, nunca por inspeção visual.

#### Scenario: Fundo da tela de login usa a cor de marca
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** o fundo da tela apresenta a cor de marca da paleta, e não o fundo
  neutro do design system

#### Scenario: Logomarca permanece contida em campo escuro
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a logomarca é exibida dentro do campo escuro da composição, sem ser
  apresentada solta sobre fundo claro

#### Scenario: Cartão de acesso permanece claro e legível
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** o cartão que recebe e-mail e senha é claro, e seu texto mantém
  contraste suficiente com a própria superfície

#### Scenario: Contraste do conteúdo sobre o fundo é verificado por cálculo
- **WHEN** a cor de fundo da tela de login é definida ou alterada
- **THEN** seu contraste com o branco é apurado numericamente e atende ao nível
  AAA, em vez de ser aceito por avaliação visual

### Requirement: Composição da tela de login empilha em tela estreita

A tela de login SHALL empilhar seus campos verticalmente em tela estreita,
preservando o acesso ao formulário sem rolagem horizontal. O cartão de acesso
SHALL permanecer alcançável, e o conteúdo de apresentação NÃO SHALL empurrá-lo
para fora da área visível a ponto de exigir rolagem para descobri-lo.

#### Scenario: Tela estreita mantém o formulário alcançável
- **WHEN** uma pessoa abre a tela de login numa tela de 375 pixels de largura
- **THEN** os campos aparecem empilhados, o cartão de acesso está alcançável e a
  página não rola horizontalmente

### Requirement: Tela de login não oferece controle sem efeito

A tela de login NÃO SHALL apresentar controle, link ou opção que o sistema não
atenda. Recurso previsto em desenho mas ausente do servidor SHALL ficar fora da
tela até existir, em vez de ser exibido inerte. A orientação a quem não
consegue entrar SHALL ser dada por um caminho que funcione de fato.

#### Scenario: Opção sem suporte do servidor não é apresentada
- **WHEN** uma pessoa não autenticada percorre a tela de login
- **THEN** não encontra opção de manter a sessão ativa além do prazo padrão nem
  de redefinir a própria senha, por não existirem no servidor

#### Scenario: Quem não consegue entrar recebe caminho que funciona
- **WHEN** uma pessoa não consegue entrar e procura ajuda na tela de login
- **THEN** encontra o contato do suporte da implantação, que é o caminho pelo
  qual a redefinição de senha efetivamente ocorre

### Requirement: Contato do suporte é configurado por implantação

O sistema SHALL obter o contato do suporte de uma configuração de ambiente da
implantação, e NÃO SHALL embuti-lo como literal no código da interface. Quando a
configuração estiver ausente ou vazia, a aplicação SHALL operar normalmente e
simplesmente NÃO exibir o aviso de contato, sem erro e sem espaço reservado.

#### Scenario: Contato configurado é exibido na tela de login
- **WHEN** a implantação define um contato de suporte
- **THEN** a tela de login apresenta esse contato como orientação a quem tem
  dificuldade para entrar

#### Scenario: Ausência de contato configurado não quebra a tela
- **WHEN** a implantação não define contato de suporte
- **THEN** nenhum aviso de contato é exibido e o login permanece plenamente
  funcional

### Requirement: Marca do shell expandido apresenta o nome e o descritor do produto

A marca do shell com a navegação expandida SHALL apresentar, junto da
logomarca, o nome do produto e um **descritor** do que ele faz, ambos em texto
legível sobre o fundo da navegação. O descritor SHALL ser constante do produto,
e NÃO SHALL variar por papel, por unidade nem por implantação. A marca
expandida NÃO SHALL repetir a identificação do cliente em texto, por a
logomarca já identificar a organização; a identificação continua no título do
documento e na tela de login.

Referência: demanda do cliente nº 2, seção 1.1; `docs/demanda_cliente_3.md`,
item 1.

#### Scenario: Marca expandida apresenta nome e descritor
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** lê, logo abaixo da logomarca, o nome do produto e o descritor do que
  ele faz, ambos em texto

#### Scenario: Descritor não se confunde com a identificação do cliente
- **WHEN** uma pessoa autenticada visualiza a marca expandida numa implantação
  com identificação de cliente configurada
- **THEN** a marca apresenta a logomarca, o nome e o descritor, sem uma linha
  de texto com a identificação do cliente, e o descritor é o mesmo em qualquer
  implantação

#### Scenario: Navegação colapsada não apresenta o descritor
- **WHEN** uma pessoa autenticada colapsa a navegação
- **THEN** o descritor não é apresentado, por não haver largura que o acomode
  sem truncá-lo

### Requirement: Navegação colapsada apresenta o símbolo da marca

O shell autenticado, com a navegação colapsada, SHALL apresentar o **símbolo**
da logomarca no lugar da marca, com nome acessível **PapelHub**, e NÃO SHALL
apresentar a logo com texto, o nome em texto nem o descritor.

#### Scenario: Navegação colapsada mostra o símbolo
- **WHEN** uma pessoa autenticada colapsa a navegação do shell
- **THEN** a marca é apresentada pelo símbolo, inteiro e sem distorção, e
  tecnologia assistiva o anuncia como PapelHub

### Requirement: Marca d'água do símbolo no pé da navegação

A navegação expandida SHALL apresentar o símbolo da marca como **marca d'água**
no seu pé, puramente decorativa: NÃO SHALL ser anunciada por tecnologia
assistiva, NÃO SHALL receber acionamento e NÃO SHALL reduzir o contraste de
nenhum texto que passe sobre ela abaixo do piso de `sistema-de-design`, apurado
por cálculo contra a cor mais clara do símbolo. Na navegação colapsada ela NÃO
SHALL ser apresentada.

Referência: `docs/demanda_cliente_3.md`, item 3.

#### Scenario: Marca d'água aparece no pé da navegação
- **WHEN** uma pessoa autenticada visualiza a navegação expandida
- **THEN** vê o símbolo da marca, bem claro, no pé da coluna, atrás do conteúdo

#### Scenario: Marca d'água não intercepta o acionamento
- **WHEN** uma pessoa aciona um item da navegação ou o cartão do usuário que
  esteja sobre a marca d'água
- **THEN** o acionamento chega ao item ou ao cartão, como se a marca d'água não
  existisse

#### Scenario: Marca d'água não é anunciada
- **WHEN** uma tecnologia assistiva percorre a navegação
- **THEN** a marca d'água não é anunciada

#### Scenario: Texto sobre a marca d'água mantém o contraste mínimo
- **WHEN** a opacidade da marca d'água é definida ou alterada
- **THEN** o contraste do texto da navegação sobre o ponto mais claro do símbolo,
  no trecho mais claro do degradê, é apurado numericamente e atende ao piso de
  4,5:1

### Requirement: Marca d'água do símbolo na área principal

A aplicação SHALL apresentar o símbolo da marca como marca d'água no lado direito da área principal de toda tela autenticada, a 6% de opacidade, atrás do conteúdo e puramente decorativa: não anunciada, sem receber acionamento, sem produzir rolagem e sem baixar abaixo de 4,5:1 o contraste de texto sobre ela, apurado por cálculo. Referência: `docs/demanda_cliente_3.md`, item 5.

#### Scenario: Marca d'água aparece em qualquer tela autenticada
- **WHEN** uma pessoa autenticada abre a tela inicial, o explorador de
  documentos ou qualquer outra tela do shell
- **THEN** vê o símbolo da marca, bem claro, no lado direito da área principal,
  atrás do conteúdo

#### Scenario: Marca d'água não aparece fora do shell autenticado
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a marca d'água da área principal não é apresentada

#### Scenario: Marca d'água não intercepta o acionamento
- **WHEN** uma pessoa aciona um controle, link ou cartão da área principal que
  esteja sobre a marca d'água
- **THEN** o acionamento chega ao controle, como se a marca d'água não existisse

#### Scenario: Marca d'água não é anunciada
- **WHEN** uma tecnologia assistiva percorre a área principal
- **THEN** a marca d'água não é anunciada

#### Scenario: Marca d'água não produz rolagem
- **WHEN** uma pessoa abre qualquer tela autenticada, em qualquer largura e altura
  de tela
- **THEN** a marca d'água não acrescenta rolagem horizontal nem vertical ao
  documento

#### Scenario: Texto sobre a marca d'água mantém o contraste mínimo
- **WHEN** a opacidade da marca d'água da área principal é definida ou alterada
- **THEN** o contraste do texto apresentado diretamente sobre o fundo da área
  principal, contra a mistura desse fundo com o ponto mais escuro do símbolo, é
  apurado numericamente e atende ao piso de 4,5:1
