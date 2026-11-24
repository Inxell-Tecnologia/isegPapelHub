# Tasks

## 1. Veredito síncrono no hook

- [x] 1.1 Semear o primeiro render de `useNarrowMode` (`apps/web/src/app/responsive.ts`) com
  `matchMedia` sobre o token `screenLG` do design system, entregue a `Grid.useBreakpoint`
  como `defaultScreens` (design.md D1); verificar que a assinatura segue `(): boolean`, que
  nenhum dos seis consumidores (`AppShell`, `ExplorerPage`, `UploadArea`, `BuscaPage`,
  `PreviewModal`, `GraficoBarras`) é tocado — `git diff --name-only` lista só este arquivo —
  e que `npm run lint` e `npm run build` passam.
- [x] 1.2 Condicionar a semente à existência de `window.matchMedia`, caindo no comportamento
  de hoje quando ausente (design.md D2); verificar com um caso que apaga
  `window.matchMedia` antes do render e espera veredito correto após os efeitos, sem
  exceção lançada.
- [x] 1.3 Atualizar o comentário normativo do hook para registrar que o veredito vale desde o
  primeiro render e por que a semente deriva do token em vez de fixar o limiar
  (`design.md` D1 deste change, ao lado da referência a D1 de
  `responsividade-mobile-tablet` que já está lá); verificar que o texto não contradiz mais
  a afirmação de que `matchMedia` não é lido à mão.

## 2. Trava de regressão do primeiro render

- [x] 2.1 Teste novo em `apps/web/src/__tests__/` que colete o veredito de **cada** render de
  um componente mínimo consumidor de `useNarrowMode` e afirme que o **primeiro** valor já é
  `true` em 360px e `false` em 1920px; verificar que o teste reprova ao reverter a tarefa
  1.1 e passa com ela (requisito "A primeira composição já está na forma correta").
- [x] 2.2 No mesmo arquivo, exercitar as bordas do limiar (991px e 992px) e afirmar que o
  veredito é idêntico antes e depois de os efeitos rodarem (design.md D4); verificar que uma
  semente deliberadamente divergente — por exemplo `max-width` no lugar de `min-width` —
  reprova este caso.
- [x] 2.3 Rodar `npm run test --workspace apps/web` e confirmar a suíte inteira verde, com os
  quatro testes de modo estreito ajustados em `e746f91` (`upload.test.tsx`,
  `explorer.test.tsx`) inalterados e passando.

## 3. Verificação de integração

- [x] 3.1 Rodar `npm run lint`, `npm run format:check`, `npm run build` e `npm run test` na
  raiz; verificar os quatro verdes, incluindo a suíte da API, que não deve ser afetada.
- [x] 3.2 Rodar `npx openspec validate modo-estreito-no-primeiro-render --strict` e verificar
  que a change valida, com o delta de `web-responsividade` reconhecido como MODIFIED.

O manual do usuário (`docs/manual/`) não muda: nenhuma tela, rótulo ou fluxo é alterado — o
que muda é o momento em que a forma correta é decidida, e o usuário já via só a forma
correta.

## Workflow follow-up

- Arquivar a change depois do merge, sincronizando o delta de `web-responsividade` em
  `openspec/specs/`.
- Verificar o resultado arquivado com `openspec validate --all --strict`.
