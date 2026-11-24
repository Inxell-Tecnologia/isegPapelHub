# Tasks

Fatia **A2** de `docs/plano_demanda_cliente_2.md` (demanda nº 2, seções 1.1 e
1.2). Toda a fatia é de apresentação, em `apps/web` — **nenhuma** tarefa de
infraestrutura (Terraform/GCP) e nenhuma de paridade de dev (SessionStart hook,
sandbox): não há tabela, coluna, rota de topo nem job novo. Os três prefixos de
`api-prefixes.ts` / `vite.config.ts` / `locals.tf` ficam intactos.

## 1. Tokens de apresentação

- [x] 1.1 Acrescentar `paleta.azulAvatar = '#9ED8F6'` e `LARGURA_NAVEGACAO = 264`
      a `apps/web/src/app/theme.ts`, com o comentário de origem no estilo do
      arquivo (capability + requisito + decisão). Verificar: `npm run build
      --workspace apps/web` compila.
- [x] 1.2 Fixar no tema os dois tokens de `Menu` que o desenho exige —
      `darkGroupTitleColor: paleta.textoSobreEscuro` (D2) e `itemHeight:
      ALTURA_MINIMA_ACIONAMENTO` (D8). Verificar: os valores aparecem em
      `theme.components.Menu` e o build compila.
- [x] 1.3 Estender `apps/web/src/__tests__/contraste.test.ts` com os pares novos,
      apurados por cálculo: `azulAvatar` × `paleta.texto` ≥ 4,5 (espera-se
      ~11,12), `azulAvatar` × `branco` **abaixo** de 4,5 (espera-se ~1,54, caso
      que o requisito recusa), `azulAvatar` × `marinhoClaro` ≥ 3 (superfície,
      ~5,29) e `textoSobreEscuro` × `marinhoClaro` ≥ 4,5 já coberto. Verificar:
      `npm run test --workspace apps/web -- src/__tests__/contraste.test.ts`
      passa.

## 2. Marca do menu com nome e descritor

- [x] 2.1 Compor em `shell/BrandMark.tsx` (ou no bloco de marca de `AppShell`) a
      logomarca com "PapelHub" e "Gestão de Documentos" abaixo, mantendo a
      moldura escura do ativo opaco e usando `paleta.branco` para o nome e
      `paleta.textoSobreEscuro` para o descritor. Verificar: a marca renderiza
      os dois textos no estado expandido.
- [x] 2.2 Tornar a logomarca **decorativa** nesse estado (sem `alt`,
      `aria-hidden`), deixando o nome acessível no texto irmão — requisito
      "Logomarca no shell expandido preserva o nome acessível da marca" na forma
      modificada. Verificar: no teste, `getByText('PapelHub')` encontra o nome
      e a consulta por imagem com nome acessível "PapelHub" **não** encontra
      segunda ocorrência.
- [x] 2.3 Não apresentar o descritor no estado colapsado. Verificar: caso de
      teste colapsando a navegação e afirmando a ausência de "Gestão de
      Documentos".
- [x] 2.4 Cobrir 2.1–2.3 em `__tests__/shell-identidade-visual.test.tsx`
      (arquivo que já guarda os casos de marca). Verificar: `npm run test
      --workspace apps/web -- src/__tests__/shell-identidade-visual.test.tsx`
      passa.

## 3. Navegação: grupos, largura e compactação

- [x] 3.1 Reorganizar a lista única de `AppShell` em dois itens `type: 'group'`
      — NAVEGAÇÃO com os destinos internos filtrados por papel, AJUDA com o
      acesso ao manual —, acrescentando o grupo AJUDA **somente** quando tiver
      filho (`publicConfig.manualUrl` configurada). Verificar: os rótulos dos
      dois grupos aparecem, e numa implantação sem `manualUrl` o rótulo AJUDA
      não aparece.
- [x] 3.2 Aplicar `LARGURA_NAVEGACAO` ao `width` do `Sider` e ao `width` do
      `Drawer`, substituindo a largura padrão não declarada e o 280 do painel.
      Verificar: os dois consomem a mesma constante, sem número literal.
- [x] 3.3 Confirmar que o rótulo de grupo não entra em `selectedKeys` e não é
      acionável, e que o acesso ao manual continua fora da seleção. Verificar:
      casos de teste em `__tests__/shell-manual-do-usuario.test.tsx` afirmando
      que acionar o rótulo não navega e que o manual nunca fica selecionado.
- [x] 3.4 Atualizar `__tests__/shell-painel-sobreposto.test.tsx` para exigir os
      **mesmos grupos, na mesma ordem**, no modo largo e no painel sobreposto.
      Verificar: `npm run test --workspace apps/web -- src/__tests__/shell-painel-sobreposto.test.tsx`
      passa.

## 4. Cartão do usuário no rodapé da navegação

- [x] 4.1 Criar `shell/CartaoDoUsuario.tsx` com avatar (iniciais do **nome**,
      em `paleta.texto` sobre `paleta.azulAvatar`), nome, perfil (`ROLE_LABEL`) e
      unidade; corpo do cartão como link para `/minha-conta` e **Sair** como
      botão irmão, fora do link. Conta sem nome recorre ao ícone genérico, nunca
      ao identificador. Verificar: o cartão renderiza os quatro dados e os dois
      acionadores.
- [x] 4.2 Consumir o cartão no rodapé do `Sider` e no rodapé do `Drawer`, a
      partir dessa origem única. Verificar: o mesmo componente aparece nos dois
      modos, sem segunda composição.
- [x] 4.3 Truncar nome longo com reticências preservando o valor íntegro em
      `title`, e manter o estado colapsado com só o avatar (nome, perfil e
      unidade em `title`), com o controle de recolher disponível. Verificar:
      casos de teste com nome longo e com a navegação colapsada.
- [x] 4.4 Cobrir 4.1–4.3 em `__tests__/shell-identidade-e-busca.test.tsx`,
      incluindo o caso "a identidade não ocupa a barra superior" (nome, iniciais
      e papel ausentes do cabeçalho) e "Minha conta alcançável por
      `collaborator`". Verificar: `npm run test --workspace apps/web -- src/__tests__/shell-identidade-e-busca.test.tsx`
      passa.

## 5. Barra superior

- [x] 5.1 Mover `PARAM_PEDIDO_DE_ENVIO` de `inicio/atalhos.ts` para
      `navegacao/pedido-de-envio.ts` e apontar `inicio/atalhos.ts`,
      `navegacao/ExplorerPage.tsx` e o shell para lá (D4). Verificar: `npm run
      lint` e `npm run build --workspace apps/web` passam, e nenhum arquivo
      declara o nome do parâmetro por literal.
- [x] 5.2 Ajustar `shell/BuscaNoCabecalho.tsx`: lupa **interna** (sem
      `enterButton`, removendo a ramificação `!isNarrow` que existia para o
      botão), texto de apoio "Buscar por nome, código (ex.: PRT-NSP-001) ou
      palavra-chave", e largura por teto (`flex: 1`, `maxWidth: 600`,
      `minWidth: 0`). Verificar: caso de teste afirmando o texto de apoio e a
      ausência de botão de busca adjacente.
- [x] 5.3 Posicionar a busca à **esquerda** da barra e as ações à direita, com o
      botão **"Enviar documento"** (`type="primary"`, que já é `verdeAcao`)
      apontando para `/pastas?enviar=1`, oferecido a qualquer papel autenticado.
      Verificar: caso de teste afirmando que o acionamento navega para esse
      endereço, e que um `collaborator` também o recebe.
- [x] 5.4 Acrescentar o botão de **Ajuda** consumindo a mesma
      `publicConfig.manualUrl` do grupo AJUDA, com nome acessível que anuncia
      que leva para fora da aplicação, e omitido quando a implantação não a tem.
      Verificar: casos de teste com e sem `manualUrl` configurada.
- [x] 5.5 Retirar do cabeçalho o `Dropdown` de identidade e o avatar, agora no
      rodapé do menu, mantendo o acionador do painel sobreposto no modo estreito.
      Verificar: `npm run test --workspace apps/web -- src/__tests__/shell-identidade-e-busca.test.tsx src/__tests__/modo-estreito-primeiro-render.test.tsx`
      passa.

## 6. Documentação do usuário

- [x] 6.1 Atualizar `docs/manual/docs/a-tela.md` nas seções "Menu de navegação",
      "Busca no cabeçalho" e "Menu do perfil": os grupos NAVEGAÇÃO e AJUDA, o
      cartão do usuário e o Sair no **rodapé do menu** (a seção "Menu do perfil"
      deixa de descrever o canto superior direito), o botão "Enviar documento" e
      o botão de Ajuda na barra superior, e o texto de apoio novo da busca.
      Verificar: a página descreve **só** o que esta fatia entrega — sem
      Favoritos, Compartilhados comigo, Leitura obrigatória nem Tour guiado.
- [x] 6.2 Conferir que nenhuma outra página do manual descreve a identidade no
      canto superior direito. Verificar: `grep -rn "canto superior direito"
      docs/manual/docs/` não retorna menção à identidade.

## 7. Verificação integrada

> **O que a medição na app reprovou, e que a inspeção não teria pego.** Duas
> correções entraram depois de 7.1: o campo de busca colapsava para **24 px**
> em 375 px (piso de largura, ação de envio só com ícone e ajuda fora da barra
> no modo estreito — design.md D3b) e o cartão do usuário ficava em **y=977
> numa viewport de 900 px**, fora da tela (coluna fixa à viewport e reserva da
> altura do gatilho — design.md D6). As duas estão cobertas por teste.

- [x] 7.1 Subir a app (`npm run dev:api` + `npm run dev:web`) e medir a barra
      superior em **992, 1024, 1280 e 1440 px** de viewport, confirmando a
      aritmética de D3: nenhuma rolagem horizontal do documento e o campo de
      busca utilizável no limiar. Verificar: `document.scrollingElement.scrollWidth`
      não excede `clientWidth` em nenhuma das quatro larguras.
- [x] 7.2 Com a navegação expandida e **todos** os itens do papel
      `global_admin` visíveis, confirmar que nenhum rótulo de item aparece
      truncado em 264 px. Verificar: nenhum item com `scrollWidth >
      clientWidth` no seu rótulo.
- [x] 7.3 Percorrer o shell **só pelo teclado**, confirmando foco visível no
      cartão do usuário, no Sair, nos dois acionadores novos da barra e nos
      itens dos dois grupos. Verificar: cada um apresenta o anel de foco que
      `ESTILO_GLOBAL` declara por superfície.
- [x] 7.4 Rodar a suíte inteira uma vez, ao fechar as tarefas: `npm run lint`,
      `npm run format:check`, `npm run build` e `npm run test`. Verificar: os
      quatro passam.

## Workflow follow-up

- Atualizar a linha da fatia **A2** na tabela de status de
  `docs/plano_demanda_cliente_2.md` (→ `entregue`, com o nome do change
  arquivado) e registrar ali os desvios do previsto, no formato que B1 e B2 já
  usam — inclusive os quatro itens de menu adiados e o que ficou pendente de E1.
- Arquivar a change (`/opsx:archive`) depois do aceite, sincronizando os quatro
  deltas em `openspec/specs/`.
