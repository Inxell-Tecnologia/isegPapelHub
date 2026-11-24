# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Tela de login apresenta campo visual derivado da logomarca

**Reason**: A cor de marca da tela de login deixa de ser amostrada da arte da
logomarca e passa a vir da paleta da identidade, e a logomarca deixa de residir
sobre o cartão claro para ocupar o campo escuro da composição em dois campos.
Os cenários do requisito antigo nomeavam explicitamente a derivação da arte e o
cartão claro como portador da logomarca — ambos deixam de descrever o
comportamento entregue, e mantê-los sob MODIFIED produziria nomes de cenário em
contradição com o próprio corpo.

**Migration**: Substituído pelo requisito "Tela de login apresenta campo de
marca com cor da paleta", que preserva as três garantias do anterior — fundo de
marca em vez do neutro do design system, logomarca sempre contida em campo
escuro, e contraste apurado por cálculo no nível AAA — e acrescenta a garantia
de legibilidade do cartão sobre a composição. Nenhuma garantia é perdida.
