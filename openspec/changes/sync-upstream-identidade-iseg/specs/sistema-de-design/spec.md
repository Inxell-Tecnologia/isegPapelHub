# Spec Delta

## MODIFIED Requirements

### Requirement: Paleta da marca é normatizada por função

A SPA SHALL aplicar a paleta da marca por **função de interface**, não por
preferência de tela: navegação lateral em degradê verde-petróleo escuro
derivado do turquesa da logomarca, item de navegação ativo na cor de destaque
(o laranja da logomarca), ação principal na cor de ação (turquesa
escurecido), links em turquesa escurecido, e superfícies e bordas na família
neutra clara. A função de cada cor NÃO SHALL variar por tela, por papel nem
por unidade.

#### Scenario: Navegação lateral apresenta o degradê da marca
- **WHEN** uma pessoa autenticada visualiza o shell em tela larga
- **THEN** a navegação lateral apresenta o degradê verde-petróleo da marca, e o
  item correspondente à tela corrente é destacado no laranja da marca

#### Scenario: A mesma função usa a mesma cor em telas diferentes
- **WHEN** uma pessoa compara a ação principal de duas telas distintas
- **THEN** ambas apresentam a mesma cor de ação principal

## REMOVED Requirements

### Requirement: Verde da marca não é usado como fundo de texto branco

**Reason**: a paleta deixa de ser a do Instituto SETES. O verde da marca e o
verde de ação não existem mais na interface do ISEG; a regra que eles
expressavam continua valendo, agora sobre o laranja da logomarca.

**Migration**: substituído pelo requisito "Cor de destaque da marca não é usada
como fundo de texto branco" (ADDED abaixo), de mesma regra e mesmos cenários,
reescritos com as funções da nova paleta.

## ADDED Requirements

### Requirement: Cor de destaque da marca não é usada como fundo de texto branco

A SPA NÃO SHALL usar a cor de destaque da marca (o laranja da logomarca) como
fundo de texto branco, por não alcançar o contraste mínimo exigido. Superfícies
que carregam texto branco SHALL usar a cor de ação, de tonalidade mais escura. A
cor de destaque permanece admissível em destaque, indicador e item ativo sobre
fundo escuro, sempre com texto escuro sobre si, e SHALL manter contraste
mínimo de 3:1 contra o degradê da navegação em toda a sua extensão.

#### Scenario: Botão principal usa a cor de ação
- **WHEN** uma pessoa visualiza um botão de ação principal com rótulo em branco
- **THEN** o fundo do botão é a cor de ação, cujo contraste com o branco atende
  ao mínimo exigido

#### Scenario: Cor de destaque permanece disponível para destaque
- **WHEN** o item de navegação correspondente à tela corrente é destacado sobre
  a navegação escura
- **THEN** a cor de destaque da marca é empregada, com rótulo escuro, por não
  carregar texto branco sobre si nessa função

#### Scenario: Destaque é perceptível em toda a navegação
- **WHEN** o indicador de foco ou o item ativo aparece no topo ou na base da
  navegação
- **THEN** o contraste da cor de destaque contra o fundo naquele ponto do
  degradê é de pelo menos 3:1, apurado por cálculo

### Requirement: Paleta da marca deriva da logomarca do cliente

As cores da marca SHALL ser derivadas das cores da logomarca do cliente — cada
uma delas ou um tom delas —, e cada par normatizado SHALL ser reapurado por
cálculo sempre que a derivação mudar. Referência: change
`sync-upstream-identidade-iseg`, design.md D5.

#### Scenario: Paleta deriva da logomarca
- **WHEN** a paleta da marca é definida ou alterada
- **THEN** cada cor de marca corresponde a uma das cores da logomarca ou a um
  tom dela, e seus pares de contraste são apurados numericamente
