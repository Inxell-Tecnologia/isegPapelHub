# Design

## Context

Motivação em `proposal.md`; requisitos nos deltas de `specs/`. Estado atual que
molda a solução:

- `AppShell.tsx`: `Layout` com `Sider` (≥ lg) ou `Drawer` (< lg), `Header`
  branco com a busca, o botão "Enviar documento", o sino e a ajuda, e
  `<Content style={{ margin: isNarrow ? 12 : 24 }}>` com o `<Outlet />`. O fundo
  da área principal é `paleta.superficie` (`#F3F7F9`). A marca d'água da
  navegação (`MarcaDaguaDaNavegacao.tsx`, fatia A) é um `<img>` absoluto dentro
  da coluna com `overflow: hidden`.
- `InicioPage.tsx`: um `flex-wrap` com o conteúdo principal (`flex: 999 1 480px`)
  e a coluna direita (`flex: 1 1 340px`). A saudação, o convite ao tour e os
  atalhos ficam **dentro** do conteúdo principal; os atalhos são um `Row` com
  `Col xs=24 sm=12 xxl=6` — breakpoints da **janela**, por isso em 1366 px eles
  quebram em 2×2 (o conteúdo principal tem ~690 px ali).
- O convite ao tour é um `<Link>` simples, alinhado pela linha de base do título.
- `BuscaNoCabecalho.tsx`: `Input` com o acionador `Button size="small"` como
  `suffix`. No tema, `controlHeightSM = controlHeight = 44`
  (`ALTURA_MINIMA_ACIONAMENTO`): o acionador interno tem 44 px e a caixa do
  campo soma a ele o seu preenchimento vertical e a borda — o campo fica
  **mais alto** que o botão de envio (44 px). É esse o "busca mais baixa" do
  item 9; a medição na app confirma o número antes da correção (tarefa 4.1).
- `NotificationCenter.tsx`: `<Badge count size="small">` com a cor padrão do
  design system (`#ff4d4f`), que mede **3,27:1** com o número branco. O botão
  tem `aria-label="Notificações"`, sem a quantidade.
- `RotuloDeTipoDocumental`: `Tag` com os tons de `tonsDeTipoDocumental`
  (contraste já testado), peso normal, largura do conteúdo; usado na lista de
  recentes e no explorador.
- `TabelaDeRecentes`: coluna Documento com `fileName` cru como link e o
  `documentCode` embaixo. Não existe campo de título nos dados de controle.
- Símbolo (`apps/web/public/isetes-simbolo.png`): pixel opaco mais escuro
  `rgb(0, 140, 90)`, mais claro `rgb(0, 226, 138)` — apurado por amostragem do
  PNG servido.

## Goals / Non-Goals

**Goals:**

- Fechar os itens 5, 6, 8, 9, 10, 11 e 12 com o piso de `sistema-de-design`
  (contraste por cálculo, foco visível, 44 px) intacto.
- Medir na app o que a demanda descreve em pixels (altura da busca, atalhos em
  uma linha), em vez de estimar.

**Non-Goals:**

- Contagem de documentos e ícone tingido das pastas (item 7, fatia C).
- Mudar as siglas dos tipos: o mockup escreve "FOR", mas a sigla do formulário
  é **FRM**, decidida em `controle-documental` a partir da Matriz do cliente. A
  imagem é ilustrativa; a sigla não muda nesta fatia.
- Mudar a largura da navegação, a ordem do menu ou o orçamento de altura da
  fatia A (nenhum item de menu entra).

## Decisions

### D1 — Marca d'água da área principal: camada fixa, atrás, cartões opacos

Componente decorativo novo, `MarcaDaguaDaAreaPrincipal`, ao lado de
`MarcaDaguaDaNavegacao` e reutilizando `ATIVOS_DA_MARCA.simbolo`, montado **uma
vez** no `AppShell` — logo vale para todas as rotas do shell e para nenhuma fora
dele (login).

- **Camada:** um contêiner `position: fixed` que cobre só a área principal
  (`top` = altura do `Header`, `left` = largura atual da navegação — 264, 80 ou
  0 no modo estreito —, `right: 0`, `bottom: 0`), com `overflow: hidden`,
  `pointer-events: none`, `aria-hidden` e `z-index: 0`. O `<img alt="">` fica
  ancorado à direita e centralizado na vertical, com altura
  `min(70vh, 560px)`, deslocado para que ~⅓ saia pela borda direita, como no
  mockup. O `Content` recebe `position: relative; z-index: 1`.
- **Por que fixa:** acompanha a viewport e não a altura da página — a marca
  d'água fica visível em telas longas sem precisar de uma imagem do tamanho do
  documento. Como o contêiner fixo recorta a si mesmo e não participa do fluxo,
  **não gera rolagem** em nenhuma direção (requisito novo de
  `identidade-visual`), o que um `<img>` absoluto com deslocamento negativo
  dentro do `Content` geraria.
- **Cartões opacos:** a marca d'água fica **atrás** de tudo. Os cartões
  (`Card`, `Table`) são brancos e opacos, então o texto deles não muda de
  contraste; o símbolo aparece no fundo `superficie` entre e ao redor deles. O
  mockup insinua o símbolo atravessando o cartão de Avisos — reproduzir isso
  exigiria a camada **acima** do conteúdo e um cálculo de contraste para cada
  par de cada cartão de cada tela. Não vale o risco para um elemento decorativo;
  registrado como fora de escopo na proposta.
- **Por que 6% e não mais:** num fundo **claro**, o símbolo **escurece** o fundo
  — o pior caso para texto escuro é o pixel **mais escuro** do símbolo (o inverso
  da navegação, onde o pior era o mais claro). Mistura de `rgb(0,140,90)` com
  `superficie`, contra os textos que aparecem direto sobre o fundo:

  | opacidade | `textoApoio` | `texto` | `azulLink` | `verdeAcao` (texto) |
  | :-- | :-- | :-- | :-- | :-- |
  | 0% | 5,85:1 | 15,92:1 | 7,48:1 | 4,98:1 |
  | **6%** | **5,44:1** | **14,81:1** | **6,96:1** | **4,63:1** |
  | 8% | 5,29:1 | 14,39:1 | 6,76:1 | 4,50:1 |
  | 10% | 5,16:1 | 14,04:1 | 6,60:1 | 4,39:1 ✗ |

  6% (o valor do cliente) passa todos os pares; 8% fica no limite do verde de
  ação usado como texto; 10% reprova. A tabela vai em comentário junto da
  constante `OPACIDADE_MARCA_DAGUA_AREA_PRINCIPAL`, e o teste de contraste refaz
  a conta a partir dela e de `COR_MAIS_ESCURA_DO_SIMBOLO`.
- **Modo estreito:** mantida (a decisão do cliente é "todas as telas"), com o
  mesmo componente; `left: 0` porque a navegação vira `Drawer`. A altura
  `min(70vh, 560px)` reduz o símbolo em telas baixas.

*Alternativa descartada:* `background-image` no `Content`. Não aceita opacidade
própria sem pseudo-elemento, e o pseudo-elemento rolaria com a página ou
exigiria `background-attachment: fixed`, que navegadores móveis ignoram.

### D2 — Início em duas faixas: cabeçalho e atalhos em largura total

No mockup, saudação, convite e os quatro atalhos ocupam **a largura inteira**
da área; a divisão entre conteúdo principal e coluna de Leitura obrigatória /
Avisos começa abaixo deles. A tela passa a ter essa estrutura:

```
[saudação · contexto ............................ convite ao tour]
[atalho][atalho][atalho][atalho]
[pastas + recentes (flex 999 1 480px)] [leitura + avisos (flex 1 1 340px)]
```

Em 1366×768 com a navegação expandida, a área de conteúdo tem ~1054 px, e os
quatro atalhos cabem com folga (~250 px cada). Dentro do conteúdo principal,
como hoje, eles teriam ~690 px — insuficiente para quatro sem cortar.

A coluna direita e o seu comportamento (cerca de 340 px, desce quando não cabe)
não mudam; os alvos `data-tour` continuam nos mesmos elementos, e a ordem do
tour não muda.

### D3 — Atalhos: grade por container query

A disposição é decidida pela **largura da área** (requisito novo de
`tela-inicial`), não da janela: a área muda com a navegação expandida (264 px),
colapsada (80 px) ou no `Drawer` (0), e o `Row`/`Col` do design system só
conhece a janela.

- O contêiner dos atalhos declara `container-type: inline-size`, e a grade
  interna é CSS Grid: 1 coluna por padrão, `repeat(2, 1fr)` a partir de
  `LIMIAR_ATALHOS_DUAS_COLUNAS` e `repeat(4, 1fr)` a partir de
  `LIMIAR_ATALHOS_QUATRO_COLUNAS`, com `gap` de 16 px.
- As regras entram em `ESTILO_GLOBAL` de `theme.ts`, a **única** folha de estilo
  da aplicação (o comentário dela diz que nenhuma tela acrescenta outra — e esta
  não acrescenta). Os limiares são constantes TypeScript interpoladas no CSS,
  como `PREENCHIMENTO_ROTULO_DE_GRUPO`.
- **Valores dos limiares:** derivados da largura mínima de um cartão que mostra o
  rótulo e a descrição mais longos numa linha. *Ajustado na implementação:* a
  estimativa inicial (ícone ao lado do texto, ~210 px por cartão, 890 px) foi
  substituída pela medição — com o ícone ao lado, a descrição "Arraste ou
  selecione o arquivo" quebrava em 1366 px. O cartão passou a ter o ícone
  **acima** do texto, como no mockup; a descrição mais longa mede 176 px, o
  cartão mínimo 202 px, e os limiares finais são **880 px** (4 colunas) e
  **440 px** (2 colunas). Medições em tasks.md.
- O jsdom não avalia container queries: os testes de componente afirmam a
  estrutura (classe do contêiner, quatro filhos na grade), e a disposição real é
  medida na app.
- O ícone fica num quadrado de 40 px tingido do **próprio tom**, como hoje, mas
  os tons passam a ser quatro **matizes distintos** (verde, azul, roxo, laranja,
  como no mockup) num token novo `tonsDeAtalho` em `theme.ts`, cada um com
  `icone` e `fundo`. Hoje dois dos quatro são marinhos, e o "ícones coloridos"
  do item 6 não se cumpre. O ícone é gráfico, não texto: o par ícone/fundo é
  apurado em `contraste.test.ts` contra o piso de **3:1** de elemento gráfico.
  Os matizes reaproveitam os tons de texto já apurados de `tonsDeTipoDocumental`
  (`#067A52`, `#025484`, `#5B3A9B`, `#8A4B00`).

*Alternativa descartada:* `Col` com `xl={6}`. Acertaria em 1366 com a navegação
expandida, mas erraria ao colapsar ou em 1024–1200 px, que é exatamente o que o
plano mandou evitar ("decidida pela largura do contêiner, não da janela").

### D4 — Descrições dos atalhos

Do mockup, com um ajuste de fidelidade:

| Atalho | Descrição | Observação |
| :-- | :-- | :-- |
| Enviar documento | Arraste ou selecione o arquivo | a área de envio é de arrastar e soltar |
| Nova pasta | Organize por setor ou tema | |
| Buscar documento | Por nome ou código | o mockup diz "nome, código ou conteúdo", mas a busca (`busca`, `web-busca`) não alcança o conteúdo dos arquivos |
| Manual do usuário | Passo a passo de cada tela | o mockup diz "com imagens", mas o manual publicado não tem imagens |

### D5 — Convite ao tour em cápsula

O `<Link>` ganha estilo de cápsula: `display: inline-flex`, `align-items:
center`, `gap: 8`, `min-height: 44` (`ALTURA_MINIMA_ACIONAMENTO`), preenchimento
lateral de 16 px, raio total, fundo `tonsDeEstado.informativo.fundo`
(`#E8F1F7`) com borda `tonsDeEstado.informativo.borda`, texto `paleta.azulLink`
em peso 600. Ícone novo `IconeIniciarTour` (lucide `CirclePlay`) no módulo
único de ícones, `aria-hidden` como todos. O par `azulLink` sobre o fundo
informativo é apurado em `contraste.test.ts` (7,05:1 pela conta prévia). O anel de foco é
o `a:focus-visible` global, que já vale para links. A linha da saudação passa de
`alignItems: baseline` para `center`, porque a cápsula tem altura própria.

O mesmo `DESTINO_PEDIDO_DE_TOUR` e a mesma condição `!identity.tourCompleted`.

### D6 — Busca com 44 px: o acionador ocupa a altura do campo

O campo passa a ter **altura total de 44 px** (borda incluída), igual ao botão
de envio:

- a caixa do campo (`ant-input-affix-wrapper`) perde o preenchimento vertical
  (`paddingBlock: 0`) e fixa `height: ALTURA_MINIMA_ACIONAMENTO`;
- o acionador interno mantém **44 px de altura** e se estende sobre a borda de
  1 px em cima e embaixo (`marginBlock: -1`), encostado na borda direita com o
  raio do controle — a área sensível continua com 44 px, e o piso não é
  relaxado.

A constante de estilo fica em `BuscaNoCabecalho.tsx`, com o comentário da
medição. Antes da correção, a tarefa 4.1 mede a altura do campo e do botão na app
e registra os dois números; depois, a 4.3 mede de novo, em 1366 px e em 375 px.

*Alternativa descartada:* acionador de 42 px dentro da borda. Ficaria 2 px abaixo
do piso de 44 px, que `sistema-de-design` não admite relaxar.

*Alternativa descartada:* aumentar o botão de envio para a altura do campo. O
cliente pede a busca **mais baixa**.

### D7 — Sino: token de vermelho apurado e quantidade no nome acessível

- Token novo `paleta.vermelhoIndicador = '#CF1322'`, que mede **5,57:1** com o
  número branco (o padrão `#ff4d4f` mede 3,27:1; `#D9363E` passa raspando com
  4,62:1). É vermelho vivo o bastante para ler como "alerta" e tem margem sobre
  o piso. Aplicado via `color` do `Badge`; apurado em `contraste.test.ts`.
- O nome acessível do botão passa a `Notificações, N não lidas` (`Notificações`
  sem não lidas), e o número **visual** do indicador sai da árvore acessível
  (`aria-hidden` no elemento do indicador), para a quantidade não ser anunciada
  duas vezes. A forma de aplicar o `aria-hidden` ao indicador do `Badge` é
  detalhe de implementação; o teste afirma o resultado (nome do botão e ausência
  de texto numérico anunciado fora dele).
- `size="small"` continua; `overflowCount` do padrão (99+).

### D8 — Etiqueta de tipo uniforme

`RotuloDeTipoDocumental` passa a ter sigla em **peso 600**, `min-width` fixo
(`LARGURA_ROTULO_DE_TIPO`, suficiente para três letras maiúsculas com o
preenchimento) e texto centralizado. Os tons não mudam — continuam os de
`tonsDeTipoDocumental`, com a borda decorativa. A mudança vale no explorador
também: o componente é único de propósito, e etiquetas alinhadas são melhores
lá pelo mesmo motivo.

### D9 — Título limpo: função pura na apresentação

`tituloDoDocumento(fileName, documentCode)` em `apps/web/src/shell/document-control-labels.ts`
(onde já moram `formatarRevisao` e as siglas):

1. remove a extensão final (`.` seguido de 1 a 5 caracteres alfanuméricos), se
   sobrar algo antes dela;
2. se houver `documentCode` e o nome começar por ele (sem distinguir maiúsculas)
   seguido de fim ou de caractere não alfanumérico, remove o código e os
   separadores iniciais (espaço, `-`, `–`, `—`, `_`, `.`, `:`);
3. se o resultado for vazio, devolve o nome sem a extensão.

Na `TabelaDeRecentes`, o link mostra o título em negrito (o `Button type="link"`
continua, para a ação de abrir no visualizador), com `title={fileName}` e
`aria-label={fileName}` — o nome íntegro na dica e no nome acessível; o código
segue embaixo, em texto secundário. Como a tabela é a mesma de `/recentes`, a
tela Recentes ganha o mesmo título.

*Alternativa descartada:* calcular o título na API. É apresentação pura, sem
regra de negócio; um campo novo no DTO pediria contrato compartilhado para algo
que um título **cadastrado** (mudança futura) substituiria.

### D10 — Rótulo de grupo no colapsado

Na `navegacao()` do `AppShell`, quando `modoColapsado`, o `label` do grupo vira
um `<span>` visualmente oculto (mesma técnica de "somente leitor de tela", com
`clip`) com o texto do rótulo, e uma regra em `ESTILO_GLOBAL` desenha, em
`.ant-menu-inline-collapsed .ant-menu-item-group-title`, um traço de 1 px em
`textoSobreEscuro` a 40% centralizado na coluna. O grupo continua com o nome
acessível do rótulo, e o orçamento de altura da fatia A não muda (o título de
grupo continua com os mesmos 24 px).

## Risks / Trade-offs

- [Limiares da grade estimados] → a medição em 1366, 1280, 1024 e 992 px, com a
  navegação expandida e colapsada, fixa os valores (tarefa 3.4); nenhum rótulo
  pode ter `scrollWidth > clientWidth`.
- [Marca d'água fixa com `left` dependente da navegação] → a largura da navegação
  já é constante única (`LARGURA_NAVEGACAO` e a do colapsado); o componente a
  recebe do `AppShell`, sem medir o DOM.
- [Acionador da busca sobre a borda] → pode deixar o realce de foco/hover do
  acionador visualmente colado à borda do campo; inspeção por captura de tela é
  parte da tarefa 4.3.
- [Etiqueta de tipo mais larga no explorador] → coluna Tipo do explorador cresce
  alguns pixels; verificar que a tabela continua sem rolagem horizontal em
  1366 px.
- [Título limpo esconde parte do nome] → o nome íntegro fica na dica e no nome
  acessível, e o arquivo baixado conserva o nome original; nada se perde.
- [Contraste do verde de ação sobre a marca d'água] → a 6% fica em 4,63:1, com
  pouca margem; o teste de contraste trava a constante e falha se ela subir.

## Migration Plan

Sem migração de dados nem de infraestrutura: só SPA e manual. Deploy normal da
SPA; reverter = reverter o commit.
