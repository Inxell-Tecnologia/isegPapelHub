# Design

## Context

Ver proposal.md — Why. O estado atual, em uma linha de código:

```ts
// apps/web/src/app/responsive.ts
const screens = Grid.useBreakpoint();
return screens[NARROW_MODE_BREAKPOINT] === false;
```

`Grid.useBreakpoint` guarda os screens num `useRef(defaultScreens)` cujo padrão é `{}` e
subscreve o observador de breakpoints num efeito. No primeiro render, portanto,
`screens['lg']` é `undefined` — e `undefined === false` é `false`, ou seja: **formato
largo**. O veredito verdadeiro chega no render que a subscrição provoca.

Duas restrições moldam o que se pode fazer aqui:

1. A decisão D1 de `responsividade-mobile-tablet` fixou que o limiar vem dos **tokens do
   design system**, em definição única — não de um número escrito à mão. Qualquer solução
   tem de continuar lendo o token.
2. O hook é consumido por seis componentes com a assinatura `(): boolean`. Trocar a
   assinatura espalharia a mudança por toda a SPA sem necessidade.

Vale registrar que em produção o render descartado **não** chega à tela: o efeito que o
`rc-util` usa é `useLayoutEffect`, que roda antes do paint. O que se paga em produção é
trabalho de render dobrado em toda tela responsiva aberta em tela estreita; o que se paga em
teste é a observabilidade do estado intermediário, porque em `NODE_ENV=test` o `rc-util`
degrada esse efeito para `useEffect` de propósito (para não emitir aviso de SSR).

## Goals / Non-Goals

**Goals:**

- O veredito do modo estreito disponível no primeiro render, com o limiar ainda derivado do
  token do design system.
- Uma trava de teste que reprove a volta ao comportamento de dois renders — e que para isso
  afirme sobre a **sequência de renders**, não sobre o DOM final (o DOM final já está correto
  hoje; é exatamente por isso que nenhum teste atual pega a regressão).
- Nenhuma mudança na assinatura do hook nem nos seus consumidores.

**Non-Goals:**

- Eliminar o duplo render de componentes internos do design system que leiam breakpoint por
  conta própria. Este change governa o hook da aplicação, não o Ant Design.
- Mudar o limiar ou a sua origem: o veredito contínuo passa a vir da `MediaQueryList`
  diretamente, mas o valor que a define continua sendo o token do design system.
- Remover os `waitFor`/`findBy` dos testes de modo estreito (ver D3).

## Decisions

### D1 — Snapshot síncrono da `MediaQueryList`, com a consulta derivada do token

`useNarrowMode` lê o token `screenLG` do design system, monta a consulta de mídia a partir
dele — `(min-width: ${screenLG}px)`, a mesma forma que o design system usa para `lg` — e a
consome por `useSyncExternalStore`: `getSnapshot` é o `matches` da `MediaQueryList`, logo
síncrono no primeiro render; `subscribe` é o evento `change` da mesma `MediaQueryList`, que
mantém a reação a redimensionamento e rotação de tela.

```
token.screenLG ──▶ matchMedia(`(min-width: ${screenLG}px)`)
                        │                    │
      getSnapshot ──────┘                    └────── subscribe('change')
      veredito já no render #1                       reação contínua
```

**Por que não semear `Grid.useBreakpoint`, que era a primeira escolha:** o hook aceita
`defaultScreens` — o valor do primeiro render — mas isso **não é público**. A superfície
exportada declara `useBreakpoint(): ScreenMap`, sem parâmetros
(`antd/lib/grid/index.d.ts`); os dois argumentos existem só no módulo interno
`antd/lib/grid/hooks/useBreakpoint`, que teria de ser importado por caminho profundo — uma
dependência de órgão interno de biblioteca, sem garantia entre versões, para economizar as
oito linhas do leitor. Descartada na implementação, com o motivo registrado aqui.

**Por que não escrever o limiar à mão:** o valor continua vindo de `screenLG`. A consulta é
montada a partir do token, e não ao lado dele — é a mesma derivação que o design system faz
internamente para `lg`, não um segundo limiar. O que deixa de vir do design system é o
*mecanismo de subscrição*, não o limiar.

**Alternativa considerada — manter o hook e viver com os `waitFor`:** é o estado que este
change existe para encerrar. O contorno é correto para quem o escreve sabendo do problema, e
armadilha para quem não sabe: a borda depende de quanto trabalho de render o resto da tela
faz, o que nenhum autor de teste controla.

### D2 — `matchMedia` ausente cai no comportamento de hoje, não em erro

A semente é condicionada à existência de `window.matchMedia`. Onde ele não exista, o hook
devolve o que devolve hoje — formato largo no primeiro render, correto no segundo —, em vez
de lançar. O ambiente de teste da SPA mocka `matchMedia` em cada caso (`__tests__/setup.ts`)
e o navegador o tem universalmente; a guarda existe para que um ambiente futuro sem ele
degrade em desempenho, nunca em funcionamento.

### D3 — A trava nova não substitui a disciplina de espera nos testes

Os `waitFor`/`findBy` introduzidos em `e746f91` permanecem. Esperar pela marca do formato
estreito antes de afirmar o que o formato largo não deve ter é correto em teste assíncrono de
qualquer modo — a montagem ainda depende da resposta da API —, e removê-los devolveria
fragilidade sem devolver nada em troca. O que este change elimina é a **necessidade** de
conhecer o atraso de um render para escrever um teste de modo estreito que não trinque.

### D4 — A coerência entre semente e observador é verificada nas duas bordas

Além da trava do primeiro render, o teste exercita o limiar logo abaixo e logo acima
(991px/992px) e afirma que o veredito é o mesmo **antes e depois** de os efeitos rodarem. É
isso que impede a semente de divergir silenciosamente da query que o design system usa: uma
divergência apareceria como veredito que muda sozinho entre o primeiro e o segundo render.

## Risks / Trade-offs

- **A subscrição a mudança de largura passa a ser nossa** → são duas linhas sobre o evento
  `change`, o mesmo mecanismo que o design system usa internamente; o caminho de
  redimensionamento em runtime não é coberto por teste, porque o `matchMedia` simulado da
  suíte não emite eventos (nem antes deste change emitia).
- **A consulta duplica, em um ponto, a forma que o design system monta internamente** → é só
  o breakpoint `lg`, derivado do mesmo token `screenLG`, e o D4 trava a coerência nas duas
  bordas.
- **Ganho invisível ao usuário** → em produção ninguém vê o render descartado desaparecer; o
  retorno é trabalho de render economizado em aparelho fraco e uma classe de teste frágil
  encerrada. Assumido de propósito: é mudança de mecanismo, não de interface.
- **Rollback** → reverter o commit devolve o estado atual, que é funcional; os testes de modo
  estreito seguem passando por conta das esperas do D3, exceto a trava nova, que é o sinal
  esperado.
