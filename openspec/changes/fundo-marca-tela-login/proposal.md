# Proposal — fundo-marca-tela-login

## Why

A tela de login é a primeira — e, para quem ainda não tem conta ativa, a única
— superfície do produto. Hoje ela é um cartão branco centralizado sobre fundo
branco: a logomarca aparece (capability `identidade-visual`), o nome
**PapelHub** aparece, a identificação do cliente aparece, mas o **campo visual
em volta não pertence à marca**. O resultado é uma tela correta e anônima, que
não cumpre o NFR de usabilidade do PRD ("interface limpa e premium").

A logomarca oficial (`docs/images/logo_papel_hub.jpg`) já carrega a paleta que
falta. Esta change usa a cor de marca **derivada da própria arte** como fundo da
tela de login, mantendo intacto tudo que a capability `identidade-visual` já
normatiza — inclusive a regra de que a logomarca nunca aparece solta sobre fundo
claro.

Como o fundo passa a ser uma cor sólida em vez de branco, dois defeitos que hoje
são invisíveis passam a ser visíveis em telas pequenas — a altura `100vh` em
navegadores móveis e o cartão de largura fixa em `360px`. Ambos entram nesta
change, porque são consequência direta de pintar o fundo, não trabalho
independente de responsividade (que é objeto da change
`responsividade-mobile-tablet`).

## What Changes

- **Fundo da tela de login em `#063c7c`** (`apps/web/src/auth/LoginPage.tsx`) —
  o azul mais profundo presente na logomarca, amostrado da própria arte
  (design.md D1). Substitui o branco herdado do reset do Ant Design.
- **Cartão de acesso permanece branco**, com a logomarca contida na sua moldura
  escura própria, exatamente como hoje (design.md D2). Nenhuma exceção precisa
  ser aberta no requisito de moldura da capability `identidade-visual`.
- **Cobertura integral do viewport** — o fundo cobre a área visível em qualquer
  tamanho de tela, sem faixa de outra cor no fim da rolagem nem no *overscroll*
  elástico dos navegadores móveis (design.md D4).
- **Cartão de largura fluida** — `maxWidth` em vez de largura fixa, com respiro
  lateral garantido em telas estreitas (design.md D5). Em `375px` (iPhone SE) o
  cartão hoje encosta nas duas bordas.
- **Manual atualizado no mesmo commit** — `docs/manual/docs/a-tela.md` descreve
  a tela de login; a menção passa a refletir a aparência entregue, conforme a
  regra de fidelidade da capability `documentacao-usuario` e o `CLAUDE.md`.

Fora de escopo (registrado em design.md):

- **Realinhar `colorPrimary` do tema** (hoje `#1d4ed8`, que não deriva da
  logomarca) — avaliado e recusado nesta change (design.md D3). O botão
  primário do login fica mais claro que o fundo que o contém, o que é uma
  escolha defensável de destaque; mudar o token afetaria **toda** a aplicação e
  é decisão de outra ordem.
- **Repaginar o layout da tela de login** (split-screen com painel de marca,
  cartão escuro, vidro fosco) — avaliado e recusado (design.md D2). Esta change
  troca o campo visual, não a composição.
- **Fundo de marca em outras telas** — o shell autenticado já tem sua identidade
  pelo `Sider` escuro; a área de conteúdo permanece clara por legibilidade.
- **Responsividade das demais telas** — objeto da change
  `responsividade-mobile-tablet`. Aqui só entra o que a própria tela de login
  exige para que o fundo não apresente defeito.

## Capabilities

### Added Capabilities

Nenhuma.

### Modified Capabilities

- `identidade-visual`: ganha requisito de **campo visual da tela de login** — a
  cor de fundo passa a ser propriedade normatizada da identidade, derivada da
  logomarca oficial, com obrigação de cobrir a área visível integralmente e de
  preservar o contraste do conteúdo sobreposto. A capability já normatiza nome,
  logomarca, favicon e identificação do cliente; o fundo da primeira tela é a
  peça que faltava para que a identidade seja percebida antes do login.

## Impact

- **Web (`apps/web/src`):** `auth/LoginPage.tsx` — único arquivo de
  implementação. Sem mudança em `app/theme.ts` (ver design.md D3), em
  `shell/BrandMark.tsx` (a moldura escura é preservada) nem no shell.
- **Testes:** `apps/web/src/__tests__/login.test.tsx` — nenhuma asserção atual
  quebra (as existentes verificam heading, identificação do cliente e mensagens
  de erro, não estilo). Casos novos para a cor de fundo e para o cartão não
  exceder a largura do viewport.
- **Docs:** `docs/manual/docs/a-tela.md`.
- **Sem mudança de API, de contrato compartilhado, de configuração de ambiente,
  de Terraform ou de banco.** A cor é constante de apresentação derivada da
  logomarca, não configuração por implantação — a logomarca também não é
  (design.md D1).
