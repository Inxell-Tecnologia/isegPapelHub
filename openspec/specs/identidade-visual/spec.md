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
nome da aplicação puro, conforme a US 1.2. A logomarca, sem fundo transparente
na arte fornecida, é sempre apresentada contida numa moldura escura própria —
nunca solta sobre fundo claro.

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
- **THEN** a marca apresenta o nome **PapelHub** no estado expandido e uma
  forma abreviada equivalente no estado colapsado

### Requirement: Logomarca oficial é exibida na tela de login e no shell expandido

A aplicação SHALL exibir a logomarca oficial do produto na tela de login e no
shell autenticado com a navegação expandida. A logomarca SHALL ser
apresentada sempre contida numa moldura escura própria, e NÃO SHALL ser
exibida diretamente sobre um fundo claro sem essa moldura.

#### Scenario: Logomarca aparece na tela de login
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a logomarca oficial é exibida, contida numa moldura escura, junto
  ao cabeçalho com o nome da aplicação

#### Scenario: Logomarca aparece no shell expandido
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** a logomarca oficial é exibida, contida numa moldura escura, no
  lugar da marca

### Requirement: Logomarca não é exibida no estado colapsado do shell

O shell autenticado, com a navegação colapsada, SHALL continuar apresentando
apenas a forma abreviada em texto da marca — a logomarca NÃO SHALL ser
exibida nesse estado.

#### Scenario: Navegação colapsada mantém a abreviação em texto
- **WHEN** uma pessoa autenticada colapsa a navegação do shell
- **THEN** apenas a forma abreviada em texto da marca é exibida, sem a
  logomarca

### Requirement: Logomarca no shell expandido preserva o nome acessível da marca

A aplicação SHALL fornecer à logomarca do shell expandido um nome acessível
equivalente ao nome da aplicação, já que ali a imagem substitui o texto do
nome e é a única portadora dele nesse estado — a marca SHALL continuar
perceptível por tecnologia assistiva.

#### Scenario: Tecnologia assistiva consulta a marca do shell expandido
- **WHEN** uma tecnologia assistiva consulta a marca do shell com a
  navegação expandida
- **THEN** o nome acessível da marca é o nome da aplicação

### Requirement: Favicon reflete a logomarca oficial

O favicon da aplicação SHALL ser derivado da logomarca oficial do produto,
mantendo proporção quadrada sem distorcer a arte original — por recorte, não
por estiramento da imagem original.

#### Scenario: Aba do navegador exibe o favicon derivado da logomarca
- **WHEN** uma pessoa abre a aplicação no navegador
- **THEN** o ícone exibido na aba é derivado da logomarca oficial, sem
  aparecer esticado ou distorcido

### Requirement: Tela de login apresenta campo visual derivado da logomarca

A tela de login SHALL apresentar como fundo uma cor **derivada da logomarca
oficial** do produto, e NÃO SHALL usar o fundo neutro herdado do design system.
A cor SHALL ser constante de apresentação, versionada com o código junto da
própria logomarca, e NÃO SHALL ser configuração por implantação — a logomarca de
que ela deriva também não é.

O conteúdo sobreposto ao fundo SHALL preservar contraste suficiente para leitura
confortável, verificado por cálculo e não por inspeção visual. O cartão de acesso
SHALL permanecer claro, de modo que a logomarca continue contida na sua moldura
escura própria, conforme o requisito "Logomarca oficial é exibida na tela de
login e no shell expandido" — este requisito NÃO abre exceção àquele.

#### Scenario: Fundo da tela de login deriva da logomarca
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** o fundo da tela apresenta a cor de marca derivada da logomarca
  oficial, e não o fundo neutro do design system

#### Scenario: Logomarca permanece contida em moldura escura sobre o cartão claro
- **WHEN** uma pessoa não autenticada abre a tela de login com o novo fundo
- **THEN** a logomarca continua exibida dentro de sua moldura escura, sobre um
  cartão claro, sem ser apresentada solta sobre o fundo

#### Scenario: Contraste do conteúdo sobre o fundo é verificado por cálculo
- **WHEN** a cor de fundo da tela de login é definida ou alterada
- **THEN** seu contraste com o branco é apurado numericamente e atende ao nível
  AAA, em vez de ser aceito por avaliação visual

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
- o endereço do manual do usuário (capability `documentacao-usuario`).

O endpoint NÃO SHALL expor nenhum outro valor de configuração, ambiente,
versão, limite ou recurso de infraestrutura. Acrescentar um quarto valor à
resposta SHALL exigir a modificação explícita desta lista, e NÃO SHALL ser
tratado como extensão natural do contrato. Todo valor da lista SHALL ser
público por natureza — nenhum SHALL transitar pelo `SecretsPort`. O endpoint
NÃO SHALL abrir contexto de unidade nem consultar dado tenant-scoped.

#### Scenario: Requisição sem sessão obtém a identidade visual
- **WHEN** um cliente sem sessão autenticada requisita a configuração pública
  de apresentação
- **THEN** recebe o nome da aplicação, a identificação do cliente e o endereço
  do manual, sem erro de autenticação

#### Scenario: A resposta não carrega configuração além de identidade visual
- **WHEN** um cliente requisita a configuração pública de apresentação
- **THEN** a resposta contém apenas os valores da lista nominal, e nenhum dado
  de ambiente, versão, limite ou infraestrutura

#### Scenario: Valor não configurado é devolvido como ausência, não omitido
- **WHEN** a identificação do cliente ou o endereço do manual não está
  configurado na implantação
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
