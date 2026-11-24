# Proposal

## Why

O veredito do ponto de ruptura chega **um render depois** da montagem: `useNarrowMode`
(`apps/web/src/app/responsive.ts`) lê `Grid.useBreakpoint()`, que devolve `{}` no primeiro
render — e como a leitura é `screens['lg'] === false`, `undefined` responde "formato largo".
A correção só vem na subscrição ao observador do design system, feita num efeito. Todo
componente responsivo da SPA portanto monta uma vez no formato largo e se corrige em
seguida, num segundo render.

Em produção isso não chega à tela (o efeito do `rc-util` é `useLayoutEffect`, que roda antes
do paint), mas o custo é real: em celular, toda tela responsiva monta duas vezes — a primeira
na forma que não será usada, incluindo tabelas largas e o `Sider` permanente. E em
`NODE_ENV=test` o `rc-util` troca esse efeito por `useEffect`, de modo que o estado
intermediário fica observável: foi o que reprovou a CI do PR #75, em
`upload.test.tsx`, com a área de arrastar e soltar montada em viewport de 360px. O contorno
aplicado ali (`waitFor`/`findByRole` em quatro asserções, commit `e746f91`) é correto, porém
trata o sintoma: qualquer teste de modo estreito escrito amanhã pode sortear a mesma borda,
e a condição depende de quanto trabalho de render o resto da tela faz — ou seja, de algo
que nenhum autor de teste controla.

## What Changes

- `useNarrowMode` passa a resolver o ponto de ruptura **de forma síncrona no primeiro
  render**, continuando a derivar o limiar dos tokens do design system — nenhum valor de
  breakpoint é escrito à mão, e o limiar segue tendo definição única.
- Com isso a SPA deixa de montar componente responsivo no formato errado: desaparece o
  render descartado em toda tela responsiva aberta em tela estreita.
- Teste novo trava a garantia pelo que ela afirma — o veredito do modo estreito disponível
  na **primeira** árvore renderizada, sem espera —, de modo que uma regressão para o
  comportamento de dois renders reprove.
- Os `waitFor`/`findBy` do commit `e746f91` **permanecem**: esperar pela marca do formato
  estreito é boa prática de teste assíncrono de qualquer modo, e removê-los só devolveria
  fragilidade a troco de nada.
- Fora de escopo: o valor do limiar (`lg`, 992px) e a decisão D1 de
  `responsividade-mobile-tablet`, que seguem como estão; a troca do design system como
  **origem do limiar** — a consulta de mídia continua derivada do token `screenLG`; e
  qualquer alteração nos componentes que consomem o hook — a assinatura (`(): boolean`) não
  muda, e nenhum deles é tocado.

## Capabilities

### New Capabilities

Nenhuma. O comportamento já é governado por `web-responsividade`.

### Modified Capabilities

- `web-responsividade`: o requisito **"Aplicação adota um ponto de ruptura único e
  declarado"** passa a exigir também *quando* o veredito vale — já na primeira árvore
  renderizada, sem montagem intermediária no formato que não será apresentado. Hoje o
  requisito governa só a existência e a unicidade do limiar, e é silencioso sobre o momento
  da resolução; foi nesse silêncio que o render descartado se acomodou.

## Impact

- **Código**: `apps/web/src/app/responsive.ts` (único arquivo de produção) e um teste novo
  em `apps/web/src/__tests__/`. Os consumidores do hook — `AppShell`, `ExplorerPage`,
  `UploadArea`, `BuscaPage`, `PreviewModal`, `GraficoBarras` — não mudam.
- **API, banco, permissão, auditoria, bytes**: nada. A mudança é de apresentação e não toca
  rota, DTO, RLS ou URL assinada; a API permanece o único guardião de permissão.
- **Dependências**: nenhuma nova. O limiar continua vindo dos tokens do Ant Design.
- **Testes**: a suíte da web passa a cobrir o momento da resolução. Os quatro testes de modo
  estreito ajustados em `e746f91` seguem válidos e inalterados.
