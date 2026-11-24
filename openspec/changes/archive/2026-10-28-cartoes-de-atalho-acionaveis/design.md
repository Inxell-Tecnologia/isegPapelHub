# Design

## Context

Ver `proposal.md` — Why para a motivação. O que condiciona o desenho:

- Os cartões das duas seções saem de `InicioPage.tsx` com a mesma forma:
  `<Card size="small" hoverable>` contendo um `<Link>` inline. O `hoverable` do
  design system aplica `cursor: pointer` ao cartão todo; o `<Link>` entrega uma
  caixa do tamanho do texto. A assimetria é do markup, não de estilo da casa.
- O **envio não é modal nem rota**: a `UploadArea` vive permanentemente dentro do
  explorador (`ExplorerPage.tsx:800`), parametrizada pela pasta aberta. E o
  explorador já tem o gesto de apontar para ela — `focarAreaDeEnvio`
  (`ExplorerPage.tsx:226-231`), usado pelo botão do estado de pasta vazia.
- A tela inicial dispara **três consultas independentes e paralelas** (identidade,
  pastas de primeiro nível, recentes), e cada área aparece quando a sua resposta
  chega. Os atalhos não esperam nenhuma delas.
- `canUpload` é veredito do servidor, entregue no DTO de conteúdo da pasta
  (`web-navegacao`, "Pasta sem conteúdo orienta…"). A SPA reflete; não infere.
- O nome acessível dos atalhos é contrato já firmado: spec e testes localizam cada
  um por `role="link"` + o rótulo curto.
- A folha global (`theme.ts`, `ESTILO_GLOBAL`) é declaradamente a única da
  aplicação, e derivada dos tokens — qualquer necessidade de estilo tem de caber
  nela ou em estilo inline derivado de token, nunca numa folha nova.

## Goals / Non-Goals

**Goals:**

- Uma única forma de cartão acionável, idêntica nas duas seções — não duas regras
  de clique para dois blocos visualmente iguais.
- Manter o cartão um **link de verdade**: `href`, foco de teclado, Ctrl/⌘+clique,
  "abrir em nova aba", menu de contexto.
- Preservar intactos o nome acessível dos atalhos e os seletores dos testes.
- O pedido de envio expresso **no endereço**, para que o atalho continue sendo um
  link com `href` verificável.

**Non-Goals:**

- Alvo de clique na linha da tabela de recentes (competiria com as ações por
  linha).
- Abrir o seletor de arquivos do sistema automaticamente.
- Qualquer alteração em `API_PREFIXES` e nas duas pontas que ela espelha: o pedido
  de envio não cria prefixo de topo.

## Decisions

### D1 — O `<Link>` envolve o `<Card>`, nas duas seções

O cartão passa a ser o conteúdo do link, e não o contrário. A área sensível vira a
do cartão, o que satisfaz o piso de 44px de `sistema-de-design` pela própria
altura do cartão, sem estilo criado para isso.

Alternativas consideradas:

- **`onClick` no `Card`** — diff menor, mas troca um `<a>` por um `<div>`
  clicável: perde `href`, foco de teclado, Ctrl+clique e o `role="link"` de que a
  spec e os testes dependem. Seria corrigir um defeito de ponteiro criando um de
  teclado; o requisito "Navegação por teclado revela o elemento focado" já veda.
- **"Stretched link"** (`position: absolute; inset: 0` sobre cartão
  `position: relative`) — preserva o nome acessível sem `aria-label`, mas é
  camada de truque sobre o design system e precisaria de estilo que a folha única
  não comporta bem. Rejeitada por custo de manutenção, não por não funcionar.

### D2 — O nome acessível do atalho continua sendo só o rótulo

Com o cartão dentro do link, o nome acessível passaria a ser a concatenação de
rótulo e descrição ("Enviar documentos Publicar arquivos ou uma pasta inteira."):
anúncio verboso em leitor de tela e quebra dos seletores existentes. O link dos
atalhos declara portanto o rótulo como seu nome acessível, e a descrição segue
sendo texto do cartão, não parte do nome do destino.

Em **"Suas pastas"** nada disso é necessário: o conteúdo do cartão é o ícone — que
o design system já marca como decorativo — e o nome da pasta. O nome acessível
continua a ser o nome da pasta por consequência natural, e é por isso que as duas
seções compartilham a forma de D1 sem compartilhar este ajuste.

### D3 — A aparência de link fica no rótulo, não no cartão inteiro

O `<a>` envolvente herdaria cor e sublinhado de link para todo o conteúdo do
cartão, pintando de azul também a descrição secundária. O link envolvente é
portanto neutro quanto a cor e decoração, e o rótulo mantém a aparência de link
que ele já tem — a cor vem do token, nunca de literal. O `hoverable` permanece: a
partir desta change ele passa a dizer a verdade.

### D4 — O pedido de envio viaja como parâmetro de consulta em `/pastas`

O atalho de envio aponta para `/pastas` com um parâmetro de consulta pedindo o
envio, no mesmo padrão já usado por `/busca?q=` (`BuscaPage.tsx:82`).

Alternativas consideradas:

- **Rota própria `/pastas/enviar`** — colide com `/pastas/:folderId`, que
  capturaria `enviar` como identificador de pasta. Descartada de saída.
- **Estado de navegação do roteador** (`<Link state={…}>`) — não aparece no
  endereço, e um cartão sem `href` para o destino deixaria de ser verificável por
  `href`, além de não sobreviver a recarregar nem a abrir em nova aba.
- **Fragmento (`#enviar`)** — funcionaria, mas o fragmento é âncora de documento
  por convenção, e a casa já tem o idioma do parâmetro de consulta.

### D5 — O explorador atende ao pedido depois do veredito do servidor

O explorador lê o parâmetro e chama `focarAreaDeEnvio` — a função que já serve o
estado de pasta vazia, reaproveitada em vez de duplicada — **condicionado a
`canUpload`** do conteúdo recebido. Enquanto o conteúdo não chega, nada acontece;
sem permissão, nada acontece nunca. Assim o atalho não conduz a uma recusa, e o
cliente não antecipou decisão alguma: quem decidiu foi o servidor.

Chegado o veredito, o parâmetro é removido do endereço **substituindo** a entrada
do histórico (sem empilhar nova). Sem isso, recarregar a tela ou voltar a ela
roubaria o foco de quem já está trabalhando na pasta — e o endereço guardado nos
favoritos carregaria para sempre um pedido que fazia sentido uma única vez.

O parâmetro sai **tenha o pedido sido atendido ou não**. A primeira versão só o
removia no caso atendido, e a verificação na app mostrou o que isso deixava para
trás: numa pasta sem envio permitido o parâmetro sobrevivia no endereço, de onde
uma revalidação que trocasse `canUpload` faria o foco saltar para a área de envio
muito depois do clique que o pediu. O pedido se consome quando o veredito chega,
que é o momento em que ele foi efetivamente decidido.

### D6 — A filtragem dos atalhos continua por papel, nunca por `canUpload`

Suprimir o atalho de envio para quem não pode enviar na raiz exigiria conhecer
`canUpload` antes de pintar os atalhos, isto é, esperar a consulta de conteúdo —
exatamente o acoplamento que o paralelismo das três consultas da tela inicial
existe para evitar. A garantia de "não conduzir a uma recusa" é obtida em D5, no
destino, onde o veredito já existe, e não na origem, onde ele ainda não chegou.

### D7 — A cobertura verifica a estrutura do link, não um clique simulado

Os testes verificam, para os cartões das duas seções, que o cartão está **dentro**
do elemento de link e que esse link aponta para o destino esperado, além do nome
acessível de D2. É isso que corresponde ao que o requisito afirma: o que estende a
área acionável é o link ser ancestral do cartão.

O ambiente de teste não calcula geometria, de modo que um clique simulado também
não mediria área — ele mediria propagação de evento, que é consequência da mesma
estrutura. A verificação estrutural diz a mesma coisa de forma direta e legível.
O comportamento do pedido de envio (D5), por ser comportamento e não estrutura, é
coberto nos testes do explorador: com permissão a área de envio recebe o foco, sem
permissão não recebe, e o pedido não se repete.

## Risks / Trade-offs

- **Anel de foco do teclado passa a circundar o cartão inteiro** → É o
  comportamento correto (o alvo focado é o cartão), e o anel declarado em
  `ESTILO_GLOBAL` já o cobre. O raio de canto do anel foi pensado para texto e é
  menor que o do cartão; ajuste cosmético, verificado ao implementar, sem folha
  nova.
- **Cartão de pasta e cartão de atalho passam a ter a mesma forma e tamanhos de
  conteúdo diferentes** → O cartão de pasta tem uma linha; o de atalho, duas. A
  área acionável de ambos continua acima do piso de 44px, que é o que o requisito
  exige — altura uniforme não é requisito e não é perseguida aqui.
- **O atalho de envio vira um `href` que alguém pode guardar nos favoritos** →
  Mitigado por D5: atendido uma vez, o parâmetro sai do endereço; e um endereço com
  o parâmetro, aberto por quem não pode enviar, se comporta como uma chegada comum
  ao explorador.
- **Dois cartões deixam de levar ao mesmo lugar, e "Ver documentos" perde a
  companhia** → É o efeito desejado (a duplicata era o defeito), mas muda o que
  uma pessoa acostumada aos dois cartões espera do de envio. Coberto pelo ajuste
  do manual no mesmo commit.
- **Permissão, isolamento por unidade, auditoria e tráfego de bytes** → Nada nesta
  change os toca: não há rota de API nova, nenhuma tabela, nenhuma URL assinada e
  nenhum byte passando pela API. `canUpload` é consumido como já é, e a recusa de
  envio continua sendo do servidor, na emissão da URL assinada.

## Migration Plan

Não se aplica: mudança de apresentação na SPA, sem migração de dados, sem
alteração de contrato de API e sem etapa de implantação própria. A reversão é o
`revert` do commit.
