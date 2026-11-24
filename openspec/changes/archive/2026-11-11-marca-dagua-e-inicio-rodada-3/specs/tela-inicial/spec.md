# Spec Delta

## ADDED Requirements

### Requirement: Atalhos ocupam uma linha quando o conteúdo comporta

A tela inicial SHALL dispor os atalhos numa **única linha** sempre que a largura da **área de conteúdo** que os contém comportar todos com o rótulo inteiro, e SHALL distribuí-los em mais linhas, de colunas iguais, quando não comportar — decidindo pelo espaço da área, não pela largura da janela. Nenhuma disposição SHALL cortar rótulo nem produzir rolagem horizontal. Referência: `docs/demanda_cliente_3.md`, item 6.

#### Scenario: Os quatro atalhos numa linha em tela larga
- **WHEN** uma pessoa abre a tela inicial, com manual configurado, numa largura
  em que a área de conteúdo comporta os quatro atalhos com o rótulo inteiro
- **THEN** vê Enviar documento, Nova pasta, Buscar documento e Manual do usuário
  lado a lado, numa única linha, com a mesma largura, acima das pastas, dos
  documentos recentes e da coluna de leitura obrigatória e avisos

#### Scenario: A disposição acompanha a área, não a janela
- **WHEN** a janela mantém a mesma largura, mas a área de conteúdo muda de
  largura — por exemplo, ao colapsar ou expandir a navegação
- **THEN** a disposição dos atalhos acompanha a largura da área, passando entre
  uma e duas linhas sem rótulo cortado

#### Scenario: Tela estreita empilha os atalhos
- **WHEN** uma pessoa abre a tela inicial numa largura em que a área de conteúdo
  não comporta dois atalhos lado a lado
- **THEN** os atalhos aparecem um abaixo do outro, ocupando a largura da área,
  sem rolagem horizontal da página

### Requirement: Descrição do atalho é curta e fiel ao que o produto faz

Cada atalho da tela inicial SHALL trazer, abaixo do rótulo, uma descrição de uma linha que diga como a ação é feita, e NÃO SHALL prometer capacidade que o produto não oferece — a descrição do atalho de busca NÃO SHALL anunciar busca no conteúdo dos arquivos enquanto a busca alcançar só nome e código. Referência: `docs/demanda_cliente_3.md`, item 6.

#### Scenario: Descrições curtas acompanham os atalhos
- **WHEN** uma pessoa lê os atalhos da tela inicial
- **THEN** cada um traz uma descrição curta, de uma linha na disposição em linha
  única, abaixo do rótulo

#### Scenario: O atalho de busca promete só o que a busca alcança
- **WHEN** uma pessoa lê a descrição do atalho Buscar documento
- **THEN** a descrição menciona os critérios que a busca de fato aceita, e não
  menciona o conteúdo dos arquivos

### Requirement: Linha de recentes destaca o título do documento

Cada linha de "Documentos recentes" SHALL apresentar, em destaque, o **título** do documento — o nome do arquivo sem a extensão e sem o prefixo igual ao seu código — com o código abaixo, e o **nome íntegro do arquivo** SHALL permanecer disponível pelo nome acessível e pela dica. Sem título que sobre após a limpeza, SHALL apresentar o nome sem a extensão. Referência: PRD US 11.2; `docs/demanda_cliente_3.md`, item 12.

#### Scenario: Código e extensão saem do título
- **WHEN** a lista apresenta o arquivo "POP-ASS-004 - Emissão da declaração de
  óbito.pdf", de código POP-ASS-004
- **THEN** a linha mostra "Emissão da declaração de óbito" em destaque e,
  abaixo, POP-ASS-004

#### Scenario: Nome sem o prefixo do código perde só a extensão
- **WHEN** a lista apresenta o arquivo "Passagem de plantão.docx", de código
  PRT-ASS-002
- **THEN** a linha mostra "Passagem de plantão" em destaque e, abaixo,
  PRT-ASS-002

#### Scenario: Prefixo que difere do código é preservado
- **WHEN** a lista apresenta o arquivo "POP-ASS-005 rascunho.pdf", de código
  POP-ASS-004
- **THEN** o título mantém "POP-ASS-005 rascunho", porque o prefixo não é o
  código do documento

#### Scenario: Nome igual ao código não deixa a linha sem título
- **WHEN** a lista apresenta o arquivo "POP-ASS-004.pdf", de código POP-ASS-004
- **THEN** a linha mostra "POP-ASS-004" como título, em vez de um título vazio

#### Scenario: Nome íntegro do arquivo continua alcançável
- **WHEN** uma pessoa aponta para o título ou uma tecnologia assistiva o anuncia
- **THEN** o nome completo do arquivo, com extensão, é apresentado

#### Scenario: Acionar o título abre o documento
- **WHEN** uma pessoa aciona o título de uma linha de recentes
- **THEN** o documento abre no visualizador, como antes

### Requirement: Etiqueta de tipo na lista de recentes tem largura uniforme

A coluna Tipo de "Documentos recentes" SHALL apresentar a etiqueta do tipo com a sigla em destaque sobre o fundo tingido do tom do tipo, com a **mesma largura** em todas as linhas, de modo que as siglas fiquem alinhadas. A sigla SHALL continuar portando a informação, com a cor como redundância, e o nome completo do tipo SHALL seguir disponível na dica. Referência: `docs/demanda_cliente_3.md`, item 11.

#### Scenario: Etiquetas alinhadas na coluna
- **WHEN** a lista apresenta documentos de tipos POP, PRT e FOR
- **THEN** as três etiquetas têm a mesma largura e a sigla de cada uma aparece
  em destaque sobre o seu tom

#### Scenario: A sigla continua legível sem a cor
- **WHEN** uma pessoa que não distingue cores lê a coluna Tipo
- **THEN** identifica o tipo pela sigla, e o par de cores da etiqueta atende ao
  piso de contraste de texto

## MODIFIED Requirements

### Requirement: Saudação convida ao tour quem ainda não o fez

A tela inicial SHALL apresentar, à direita da saudação, o convite "Primeira vez
aqui? Faça o tour de 2 minutos" enquanto a pessoa não tiver feito o tour, e
acioná-lo SHALL começar o tour guiado. Depois de feito, o convite NÃO SHALL ser
apresentado. O convite SHALL ser apresentado como **cápsula de fundo azul-claro
com ícone de reprodução** à frente do texto, com o texto em contraste de ao menos
4,5:1 sobre esse fundo e a área de acionamento mínima da aplicação; o ícone
SHALL ser decorativo, e o nome acessível do convite SHALL ser o seu texto.
Referência: PRD US 11.3; demanda do cliente nº 2, seção 1.3;
`docs/demanda_cliente_3.md`, item 8.

#### Scenario: Quem não fez o tour vê o convite
- **WHEN** uma pessoa que nunca fez o tour abre a tela inicial
- **THEN** vê o convite à direita da saudação, e acioná-lo começa o tour

#### Scenario: Quem já fez o tour não vê o convite
- **WHEN** uma pessoa que já fez ou fechou o tour abre a tela inicial
- **THEN** o convite não é apresentado

#### Scenario: Convite tem a forma de cápsula com ícone de reprodução
- **WHEN** uma pessoa que nunca fez o tour vê o convite
- **THEN** ele aparece como cápsula de fundo azul-claro, com o ícone de
  reprodução à frente do texto

#### Scenario: Convite é anunciado só pelo texto
- **WHEN** uma tecnologia assistiva alcança o convite
- **THEN** ele é anunciado como link pelo texto "Primeira vez aqui? Faça o tour
  de 2 minutos", sem anunciar o ícone
