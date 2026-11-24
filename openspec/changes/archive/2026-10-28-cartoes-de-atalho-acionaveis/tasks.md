# Tasks

## 1. Cartões acionáveis em toda a área

- [x] 1.1 Em `apps/web/src/inicio/InicioPage.tsx`, na seção "O que você pode
      fazer", passar o `<Link>` a envolver o `<Card>` (design.md D1), declarando o
      rótulo como nome acessível do link (D2) e mantendo o link envolvente neutro
      de cor e decoração, com o rótulo conservando a aparência de link a partir
      do token (D3). Verificar com `npm run test --workspace apps/web -- src/__tests__/tela-inicial.test.tsx`,
      que localiza os atalhos por `role="link"` + rótulo e deve seguir passando
      sem alteração.
- [x] 1.2 Aplicar a mesma forma aos cartões da seção "Suas pastas" no mesmo
      arquivo, sem `aria-label` (D2 — o ícone já é decorativo e o nome acessível
      segue sendo o nome da pasta). Verificar pelo mesmo arquivo de teste, cujas
      asserções de `href` dos cartões de pasta devem seguir passando.
- [x] 1.3 Acrescentar a `apps/web/src/__tests__/tela-inicial.test.tsx` a
      verificação estrutural de D7 nas duas seções: cada cartão está contido no
      elemento de link (`closest('a')`) e esse link aponta para o destino
      esperado, mais o nome acessível curto dos atalhos. Verificar que os casos
      novos reprovam contra o markup anterior (link só no rótulo) e passam com o
      desta change.
- [x] 1.4 Conferir o anel de foco de teclado sobre o cartão inteiro (Risks):
      percorrer a tela inicial por teclado e confirmar indicação visível em cada
      cartão, ajustando apenas o raio de canto se necessário, dentro de
      `ESTILO_GLOBAL` e derivado de token — sem folha de estilo nova. Verificar
      com `npm run test --workspace apps/web` e inspeção da tela.

## 2. Atalho de envio conduzindo ao envio

- [x] 2.1 Em `apps/web/src/inicio/atalhos.ts`, apontar o atalho `enviar` para
      `/pastas` com o parâmetro de consulta de pedido de envio (design.md D4),
      mantendo `documentos` em `/pastas` e a filtragem por papel como está (D6).
      Verificar que `apps/web/src/__tests__/tela-inicial.test.tsx` segue passando,
      inclusive o caso que compara os destinos de `atalhosDoPapel` com a lista
      declarada — que passa a registrar destinos distintos para os dois atalhos.
- [x] 2.2 Em `apps/web/src/navegacao/ExplorerPage.tsx`, ler o parâmetro e chamar
      o `focarAreaDeEnvio` existente **somente** depois de o conteúdo chegar e
      apenas quando `data.canUpload` (design.md D5), removendo em seguida o
      parâmetro do endereço com substituição da entrada de histórico. Verificar
      pelos casos da tarefa 2.3.
- [x] 2.3 Cobrir o comportamento nos testes do explorador: com permissão de envio
      o foco chega à área de envio; sem permissão a tela apresenta o conteúdo e o
      foco não se desloca; e o pedido não se repete após o atendimento. Verificar
      com `npm run test --workspace apps/web -- src/__tests__/explorer.test.tsx`.
- [x] 2.4 Atualizar `docs/manual/docs/a-tela.md` na seção "Tela inicial": os
      cartões das duas áreas são acionáveis em qualquer ponto, e o atalho de envio
      leva à área de envio quando a pessoa pode enviar ali. Verificar lendo a
      página contra a interface efetivamente entregue, sem descrever capacidade
      sem tela que a acione.

## 3. Verificação integrada

- [x] 3.1 Rodar `npm run lint`, `npm run build`, `npm run test` e
      `npm run format:check` na raiz e confirmar tudo verde — com atenção a
      `web-serving.test.ts`, que deve seguir passando intocado, já que o pedido de
      envio não acrescenta prefixo de rota de topo.
- [x] 3.2 Subir a SPA (`npm run dev:api` + `npm run dev:web`) e percorrer a tela
      inicial nos três papéis: acionar cada cartão fora do texto do rótulo e
      confirmar que todos conduzem ao destino, que o atalho de envio deixa a área
      de envio pronta para uso onde há permissão, e que onde não há a chegada ao
      explorador é a comum.
- [x] 3.3 Rodar `openspec validate "cartoes-de-atalho-acionaveis" --strict` e
      confirmar que a implementação cobre cada cenário dos dois deltas de spec.
