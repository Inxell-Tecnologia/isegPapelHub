# Tasks — fundo-marca-tela-login

## 1. Cor de marca

- [ ] 1.1 Registrar `#063c7c` em `apps/web/src/auth/LoginPage.tsx` como
  constante nomeada, com comentário citando a origem: amostrada de
  `docs/images/logo_papel_hub.jpg` como o pixel de maior componente azul
  relativo da arte (design.md D1). O rastro importa — uma troca futura de
  logomarca precisa saber que esta cor deriva dela.
- [ ] 1.2 **Não** tocar `apps/web/src/app/theme.ts`. O token
  `colorPrimary: '#1d4ed8'` permanece por decisão (design.md D3), assumindo que
  o botão primário fique mais luminoso que o fundo que o contém.
- [ ] 1.3 **Não** tocar `apps/web/src/shell/BrandMark.tsx`. A moldura escura
  `#141414` é o que mantém válido o requisito de moldura da capability
  `identidade-visual` (design.md D2).
- [ ] 1.4 Confirmar por cálculo que o contraste de `#063c7c` com branco é
  10,8:1 (luminância relativa 0,047) e deixar o número no comentário — o
  requisito de spec exige verificação numérica, não visual.

## 2. Cobertura do viewport

- [ ] 2.1 Trocar `minHeight: '100vh'` por `100dvh` no container do login.
  Navegadores sem suporte a `dvh` (Safari iOS < 15.4, Chrome < 108) ignoram o
  valor e degradam para o comportamento atual — sem `fallback` elaborado
  (design.md D4).
- [ ] 2.2 Resolver a incógnita mecânica de D4: pintar somente a `<div>` do login
  **não** cobre o *overscroll* elástico do iOS, que revela a cor do elemento
  raiz. Verificar em navegador real e, se confirmado, garantir que a cor alcance
  o elemento raiz **enquanto a rota de login estiver ativa** — sem vazar para as
  telas do shell, que permanecem claras. Como a SPA não tem arquivo `.css`,
  decidir e registrar o mecanismo (efeito no `LoginPage` que pinta e restaura,
  ou equivalente) sem introduzir folha de estilo global.
- [ ] 2.3 Manter `minHeight` (nunca `height` fixa) e padding vertical no
  container, para que a página cresça e role quando o teclado virtual reduzir o
  viewport. **Não** usar `position: fixed`, `scrollIntoView` manual nem a API
  `visualViewport` (design.md D5).

## 3. Cartão de acesso

- [ ] 3.1 `Card style={{ width: 360 }}` passa a largura fluida com teto
  (`width: '100%'`, `maxWidth: 360`), e o container ganha padding lateral
  próprio, para que em 375px o cartão tenha margem visível dos dois lados
  (design.md D5).
- [ ] 3.2 Conferir que a composição interna do cartão não muda: logomarca em
  moldura escura, heading `PapelHub` puro, identificação do cliente abaixo,
  subtítulo, formulário. O nome acessível do heading continua sendo o nome da
  aplicação sem a identificação do cliente (US 1.2; requisito vigente de
  `identidade-visual`).

## 4. Testes

- [ ] 4.1 `apps/web/src/__tests__/login.test.tsx`: conferir primeiro que as
  asserções existentes continuam passando sem alteração — elas verificam
  heading, identificação do cliente e mensagens de erro, não estilo.
- [ ] 4.2 Caso novo: a tela de login aplica a cor de marca como fundo. Assertar
  pelo valor da constante exportada, não pela string literal repetida no teste —
  senão o teste vira cópia do código em vez de trava.
- [ ] 4.3 Caso novo: o cartão de acesso não excede a largura do viewport em tela
  estreita. Reconhecer o limite do ambiente — jsdom não faz layout, então este
  teste trava a **declaração** (largura fluida com teto), e a verificação real é
  a de 5.2.
- [ ] 4.4 Rodar a suíte completa da web. Nenhum outro teste monta a tela de
  login, mas vários montam `/auth/public-config`; confirmar que nada regrediu.

## 5. Verificação em navegador real

- [ ] 5.1 Conferir a tela em 375px de largura: cartão inteiro, margem dos dois
  lados, sem rolagem horizontal.
- [ ] 5.2 Conferir os dois defeitos de D4 que jsdom **não** consegue detectar:
  (a) rolar num navegador móvel com barra de endereço retrátil, verificando que
  nenhuma faixa de outra cor aparece; (b) puxar além do limite, verificando que
  a rolagem elástica mostra a mesma cor de fundo.
- [ ] 5.3 Focar um campo do formulário com teclado virtual aberto e confirmar
  que o cartão continua alcançável por rolagem normal.
- [ ] 5.4 Conferir que o fundo **não** vazou para nenhuma tela do shell
  autenticado — entrar e percorrer ao menos Início e Arquivos.

## 6. Documentação

- [ ] 6.1 `docs/manual/docs/a-tela.md`: atualizar a descrição da tela de login
  para refletir a aparência entregue. Fidelidade à interface é exigência da
  capability `documentacao-usuario` e regra do `CLAUDE.md` — a documentação
  acompanha o commit da feature.
- [ ] 6.2 Não formatar `docs/` nem `openspec/` com Prettier (`.prettierignore`
  já cobre os dois). Rodar `npm run format` apenas sobre o código alterado.

## 7. Fechamento

- [ ] 7.1 `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` limpos na raiz.
- [ ] 7.2 `openspec validate fundo-marca-tela-login --strict`.
