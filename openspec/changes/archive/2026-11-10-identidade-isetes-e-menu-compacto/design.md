# Design

## Context

Motivação em `proposal.md`. Estado atual que molda a solução:

- A navegação é montada por uma função única, `navegacao()` em
  `apps/web/src/shell/AppShell.tsx`, consumida pelo `Sider` (≥ lg) e pelo
  `Drawer` (< lg). Ordem vertical: marca → `Menu` (`flex: 1`,
  `overflowY: 'auto'`) → `CartaoDoUsuario`. O `Sider` é `sticky` com
  `height: 100vh` e reserva 64 px (`ALTURA_GATILHO_RECOLHER`) para o gatilho
  nativo do design system, fixo ao pé da viewport.
- A marca (`MarcaDoProduto` + `BrandMark`) usa `logo-papelhub.jpg` (301×502,
  sem transparência) a 96 px de altura, dentro de moldura `#141414`, mais
  "PapelHub", o descritor e, quando configurada, a linha da identificação do
  cliente. No colapsado, o texto "PH".
- `theme.ts`: `Menu.itemHeight = ALTURA_MINIMA_ACIONAMENTO` (44), com a margem
  vertical padrão do design system entre itens (4 px); rótulo de grupo com o
  espaçamento padrão (~38 px).
- `CartaoDoUsuario`: avatar + nome + "função · unidade" (até 2 linhas) e, abaixo,
  um botão "Sair" de largura inteira.
- `LoginPage` usa o mesmo `BrandMark`, decorativo, no campo escuro
  (`paleta.marinhoEscuro`).
- Ativos novos (`docs/images/demanda_3/`): logo branca e logo colorida,
  1984×849 (≈ 2,34:1), e símbolo, 426×841, todos RGBA transparentes.

## Goals / Non-Goals

**Goals:**

- Fechar o orçamento de altura da navegação em 768 px para o pior caso
  (`global_admin`, manual configurado), sem baixar o piso de 44 px.
- Uma única família de ativos da marca, servida de `apps/web/public/`, usada no
  shell, no login e no favicon.

**Non-Goals:**

- Mudar a largura da navegação (`LARGURA_NAVEGACAO` = 264 continua).
- Mudar a ordem ou o conjunto de itens do menu — todos já existem.
- Marca d'água da área principal (fatia B).
- Usar a logo colorida nesta fatia: ela entra no repositório para a fatia B e
  para o manual, mas nenhuma superfície clara da fatia A a exibe.

## Decisions

### D1 — Orçamento de altura: cinco alavancas, nenhuma no alvo de 44 px

Pior caso: 10 destinos (`global_admin`) + 2 acessos auxiliares = 12 itens.

```
                         hoje (aprox.)   alvo
marca                         ~190        ~110   logo 150×64 + texto 18 + folgas
rótulo NAVEGAÇÃO                38          24
12 itens × (44 + margem)       576         528   margem vertical 0
rótulo AJUDA                    38          24
cartão do usuário             ~130         ~76   1 linha de ação, texto em 2 linhas
gatilho de recolher             64           0   vai para o topo (D4)
────────────────────────────────────────────────
total                        ~1036        ~762   ≤ 768
```

- **Itens:** `itemMarginBlock: 0` no token do `Menu`. A área de acionamento
  continua 44 px; some só a folga entre eles. O realce do item selecionado
  passa a encostar no vizinho — aceitável, pois o raio de canto do design
  system mantém a separação visual.
- **Rótulos de grupo:** 13 px (`TAMANHO_MINIMO_TEXTO`), altura de linha 16 e
  preenchimento vertical de 4 px → 24 px. Não são acionáveis, então o piso de
  44 px não se aplica a eles.
- **Marca:** logo a **150 px de largura** (medida da demanda nº 2, seção 1.1),
  ou seja, 64 px de altura pela proporção do ativo; "PapelHub · Gestão de
  Documentos" numa linha de 18 px abaixo. A linha da identificação do cliente
  sai (D3).
- **Cartão:** D5.

A folga é pequena (~6 px). Por isso o critério é **medido**, não estimado: a
tarefa de verificação mede, com Playwright em 1366×768, `scrollHeight ≤
clientHeight` na lista do menu para `global_admin` com o manual configurado e
função longa. Se a medição estourar, a próxima alavanca é a altura da linha de
texto da marca — nunca a altura do item.

*Alternativa descartada:* reduzir o item para 40 px. Contraria
`sistema-de-design` ("ao menos 44 pixels") e a própria demanda nº 2 ("área de
clique de 44 px").

*Alternativa descartada:* um terceiro grupo ADMINISTRAÇÃO para os itens de
admin. Acrescentaria mais um rótulo (+24 px) e mudaria a estrutura da
navegação, que o cliente não pediu.

### D2 — Rolagem só da lista, como último recurso

A estrutura `marca / Menu (flex: 1, minHeight: 0) / cartão` permanece. O
`overflowY: 'auto'` no `Menu` fica, mas agora é **último recurso**: acima de
768 px ele não é acionado (D1); abaixo disso, rola apenas a lista, e marca e
cartão continuam visíveis — exatamente o requisito "Abaixo da altura-alvo só a
lista de itens rola". Remover o `overflow` faria o cartão ser empurrado para
fora da tela em viewports baixas, o que regrediria "A navegação ocupa a altura
visível da tela".

### D3 — Ativos e nome acessível

- `apps/web/public/`: `isetes-logo-branca.png`, `isetes-logo-cor.png`,
  `isetes-simbolo.png` (cópias dos originais, redimensionados para 2× da maior
  medida exibida, para não servir 1984 px a uma imagem de 150 px);
  `logo-papelhub.jpg` sai.
- O `BrandMark` perde a moldura e a constante de proporção retrato; passa a
  receber a **variante** (`logo` | `simbolo`) e uma altura, e deriva a largura
  da proporção do ativo.
- **Nome acessível no shell expandido:** a logo contém "INSTITUTO SETES" escrito
  — é informação, não enfeite. Recebe `alt="Instituto SETES"`; o texto
  "PapelHub" segue como único portador do nome do produto, então nada é
  anunciado duas vezes. Isso substitui o D5 de `menu-lateral-e-barra-superior`
  (logo decorativa), cuja premissa era um ativo sem texto legível.
- **Login:** a logo continua decorativa — o heading "PapelHub" e a linha da
  identificação do cliente já estão em texto logo abaixo.
- **Colapsado:** o símbolo com `alt="PapelHub"`, ~40 px de altura nos 80 px da
  coluna.
- **Linha da identificação do cliente fora da marca do shell:** com a logo do
  Instituto SETES no topo, "SETES" em texto logo abaixo seria repetição e
  custaria 18 px que o orçamento não tem. A identificação continua no título do
  documento e no login, como exige "Identificação do cliente é configurada por
  implantação".

*Limitação aceita:* a logo é ativo versionado no código, específica deste
cliente — como a anterior também era. Torná-la configurável por implantação é
mudança futura, não desta fatia.

### D4 — Gatilho de recolher próprio, no topo

O `Sider` passa a `trigger={null}`, e a navegação ganha um botão próprio
(ícone de recolher/expandir, `aria-label` "Recolher navegação" / "Expandir
navegação", 44 px) no canto superior direito da marca expandida e logo abaixo
do símbolo no colapsado. `ALTURA_GATILHO_RECOLHER` e o `paddingBottom`
reservado deixam de existir. No `Drawer` (modo estreito) o botão não aparece —
lá não há recolher, como hoje.

*Alternativa descartada:* o gatilho na barra superior. Afastaria o controle da
coisa que ele controla, e a barra superior já disputa largura em tela estreita.

### D5 — Cartão compacto: Sair em ícone, sem perder o alvo

Uma linha: `[avatar 32] [nome / função · unidade] [Sair]`.

- **Função e unidade em linhas próprias**, uma linha cada, com corte por
  reticência; o texto íntegro segue no `title` e no nome acessível. *Ajustado
  na implementação:* o plano era manter "função · unidade" juntas com corte em
  2 linhas, mas a medição na app mostrou que, com a função longa do caso real
  ("Gerente de Governança e Performance Corporativa"), a **unidade** caía dentro
  da reticência — e a spec exige a unidade visível. Separadas, a altura é a
  mesma (20 + 18 + 18) e a unidade nunca disputa espaço com a função.
- **Sair** vira `Button type="text"` só com ícone, 44×44, `aria-label="Sair"` e
  `Tooltip`, **irmão** do link de "Minha conta", nunca dentro dele. O comentário
  atual que justifica a linha própria ("disputaria largura com o nome") perde a
  premissa: o mockup do cliente pede o ícone, e o nome tem `minWidth: 0` com
  corte.
- Avatar de 32 px com `flexShrink: 0` — sem isso o flex do cartão o encolhia
  e as iniciais ficavam ilegíveis (visto na medição).
- Altura resultante: 10 + 56 + 10 = 76 px, fixa.

### D6 — Marca d'água: 8%, posicionada atrás, fora da árvore acessível

- Componente decorativo absoluto no pé da coluna: o símbolo com ~200 px de
  altura (medida da demanda nº 2), `opacity: 0.08`, `pointer-events: none`,
  `aria-hidden`, `alt=""`, `z-index` abaixo do `Menu` e do cartão. Recortado
  pela coluna (`overflow: hidden` no contêiner), alinhado à esquerda e
  parcialmente para fora, como no mockup.
- **Por que 8%** — contraste apurado com o pixel mais luminoso do símbolo
  (`#00DE89`) misturado ao ponto mais claro do degradê (`marinhoClaro`
  `#0B5382`), contra `textoSobreEscuro` `#CBD5DD` (rótulos de grupo e texto
  secundário do cartão), o par mais frágil:

  | opacidade | textoSobreEscuro | branco |
  | :-- | :-- | :-- |
  | 0% | 5,48:1 | 8,16:1 |
  | 6% | 4,98:1 | 7,42:1 |
  | **8%** | **4,79:1** | **7,14:1** |
  | 10% | 4,62:1 | 6,88:1 |
  | 14% (demanda nº 2) | 4,35:1 ✗ | 6,48:1 |

  14% reprova o piso de 4,5:1; 10% passa raspando. 8% atende "bem clarinho"
  com margem. A tabela vai como comentário junto da constante, como os demais
  pares de `theme.ts`.
- Não aparece no colapsado (80 px cortariam o símbolo sem propósito). No
  `Drawer` aparece, pela mesma `navegacao()`.

### D7 — Favicon

`favicon.png` é regerado a partir do símbolo: centralizado num quadrado
transparente de 64×64 com margem lateral (o símbolo é retrato, ~1:2), sem
recorte nem estiramento. Gerado uma vez e versionado — não há etapa de build
nova.

## Risks / Trade-offs

- [Folga de ~6 px no orçamento] → a medição com Playwright é tarefa obrigatória;
  a ordem das alavancas de reserva está em D1. Uma futura entrada no menu de
  administrador estoura o orçamento: registrar isso no plano como restrição
  conhecida.
- [Nome acessível da logo muda de decorativa para "Instituto SETES"] → os
  testes de `shell-identidade-visual.test.tsx` que afirmam "anunciada uma vez"
  são reescritos para o novo contrato, não apagados.
- [`alt` em `<img>` com texto embutido] → se a logo um dia mudar, o `alt` mente;
  a constante do `alt` fica junto do caminho do ativo, no mesmo módulo.
- [Manual de usuário desatualizado] → "recolher no pé da coluna" e "Sair logo
  abaixo" mudam; as páginas são atualizadas no mesmo commit (tarefas).
- [Purpose da spec `identidade-visual` ainda fala em moldura escura] → o
  Purpose não muda por delta; atualizá-lo à mão no `openspec/specs/` ao
  arquivar.

## Migration Plan

Sem migração de dados nem de infraestrutura. O deploy da SPA troca os ativos
de uma vez; o `logo-papelhub.jpg` antigo pode sair do bucket/imagem sem
transição, pois nada fora da SPA o referencia (o manual tem cópia própria em
`docs/manual/docs/assets/`). Reverter = reverter o commit.
