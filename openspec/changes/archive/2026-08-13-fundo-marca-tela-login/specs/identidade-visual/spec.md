# Spec — identidade-visual (delta)

A capability normatiza hoje o nome exibido, a logomarca, o favicon e a
identificação do cliente — tudo que a marca **coloca** na tela — mas não o campo
visual em que esses elementos aparecem. A tela de login, primeira e às vezes
única superfície vista por quem chega, permanece com o fundo branco herdado do
reset do design system.

Este delta acrescenta o **fundo da tela de login** ao conjunto de propriedades da
identidade, derivado da logomarca oficial em vez de escolhido à parte, e obriga
que ele cubra a área visível integralmente — inclusive em navegadores móveis,
onde altura de viewport e rolagem elástica revelam a cor do documento por baixo
de um container mal medido. Ver design.md D1, D2, D4, D5.

O requisito de moldura escura da logomarca permanece **inalterado e satisfeito**:
o cartão de acesso continua claro, de modo que a logomarca segue contida na sua
moldura própria e nunca solta sobre fundo claro (design.md D2).

## ADDED Requirements

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

Referência: PRD NFR de Usabilidade ("interface limpa e premium"); design.md
D1/D2/D3 do change `fundo-marca-tela-login`.

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

Referência: design.md D4/D5 do change `fundo-marca-tela-login`.

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
