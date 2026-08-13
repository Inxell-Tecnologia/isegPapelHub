# Tasks — responsividade-mobile-tablet

Ordem deliberada: o limiar (1) antes de tudo, porque todo o resto o consome; a
navegação (2–3) antes das telas, porque é onde mora o risco estrutural; as telas
otimizadas (4–6) antes das utilizáveis (7), que são baratas.

## 1. Ponto de ruptura

- [x] 1.1 Criar a constante única do limiar em `apps/web/src` (`lg`, 992px),
  com comentário citando design.md D1 — a escolha de `lg` sobre `md` é
  deliberada: entrega ao tablet em retrato (768px) a largura toda para o
  preview, ao custo de a navegação ficar a um toque.
- [x] 1.2 Ler o modo estreito por `Grid.useBreakpoint` do Ant Design, **não**
  por `window.matchMedia` escrito à mão — a segunda forma duplicaria a definição
  do limiar e sairia de sincronia com os tokens do design system.
- [x] 1.3 Expor a leitura como um hook único consumido por todas as telas.
  Nenhum componente SHALL decidir seu próprio limiar (requisito "Aplicação adota
  um ponto de ruptura único e declarado").
- [x] 1.4 Conferir que `apps/web/src/__tests__/setup.ts` já mocka `matchMedia` de
  forma compatível com `useBreakpoint`, e decidir como os testes escolhem o modo
  — o mock atual foi escrito para o `Sider`, não para alternar breakpoints.

## 2. Navegação — origem única de itens

- [x] 2.1 Extrair de `apps/web/src/shell/AppShell.tsx` a lista de itens de
  navegação (destinos internos filtrados por papel **+** manual) para uma origem
  única, consumida pelos dois contêineres (design.md D2). Este é o **risco
  estrutural** da change: duas listas paralelas divergiriam em silêncio quando um
  item de administração fosse acrescentado só num lado.
- [x] 2.2 O manual passa a ser o **último item** da lista única (design.md D3).
  Removem-se o segundo `<Menu>`, o `selectable={false}` e o wrapper flex com
  `margin-top: auto`.
- [x] 2.3 Remover também o comentário de `AppShell.tsx` que explica por que
  `.ant-layout-sider-children` precisava do wrapper flex — fica obsoleto junto
  com o arranjo que descrevia. Substituir por comentário citando a reversão
  (design.md D3 desta change reverte D6/D8 de `acesso-ao-manual-no-shell`), para
  que o rastro não se perca.
- [x] 2.4 Confirmar que a não-seleção do manual continua garantida: `selectedKeys`
  é controlado e deriva de `location.pathname`, que nunca coincide com a chave do
  manual. A garantia migra de `selectable={false}` para o controle de
  `selectedKeys` — **o teste que a trava permanece**.
- [x] 2.5 Preservar `target="_blank"`, `rel="noopener noreferrer"` e o
  `aria-label` que anuncia a saída da aplicação. Sem a separação visual, o nome
  acessível passa a ser a **única** portadora da distinção (design.md D3) —
  afrouxá-lo agora é regressão de acessibilidade, não detalhe.

## 3. Navegação — painel sobreposto

- [x] 3.1 Abaixo do limiar, apresentar a navegação como painel sobreposto
  acionado do cabeçalho; acima, manter o `<Sider collapsible>` **exatamente** como
  hoje, inclusive o tooltip do estado colapsado.
- [x] 3.2 Acionar destino interno navega **e fecha** o painel (design.md D2) —
  sem isso a pessoa toca "Arquivos" e continua olhando o menu.
- [x] 3.3 Acionar o manual **não** fecha o painel: abre outra aba e a aplicação
  continua onde estava. Comportamentos distintos no mesmo menu; é o ponto fácil
  de errar.
- [x] 3.4 Gatilho da navegação no cabeçalho, com nome acessível — presente apenas
  abaixo do limiar.
- [x] 3.5 Rever `shell/NotificationCenter.tsx` (`width: 360` fixo), que estoura
  uma tela de 360px contando as margens.

## 4. Explorador — ações do item

- [x] 4.1 `navegacao/ExplorerPage.tsx`: abaixo do limiar, manter `Visualizar`
  direta e agrupar `Baixar`, `Renomear`, `Permissões`, `Auditoria` e `Excluir`
  num menu de ações (design.md D4). Acima do limiar, nada muda.
- [x] 4.2 Preservar a regra vigente de `web-navegacao`: a SPA **não infere
  permissão no cliente**. O agrupamento decorre só do espaço; as ações continuam
  sendo oferecidas e o `403` do servidor continua sendo a fonte do aviso de
  permissão insuficiente. Os gates existentes por papel/propriedade
  (`isAdmin`, `ownerId === identity?.id`) permanecem como estão — são UX, não
  defesa.
- [x] 4.3 Manter a confirmação de exclusão dentro do menu agrupado; agrupar não
  pode remover a confirmação.
- [x] 4.4 Barra de ações da pasta corrente (`Nova pasta`, `Baixar esta pasta`,
  `Excluir esta pasta`) e trilha de navegação: conferir o comportamento em 360px,
  onde a trilha de uma subpasta profunda é o que mais facilmente estoura.

## 5. Download de pasta — recusa por dispositivo

- [x] 5.1 Abaixo do limiar, **manter o botão visível** e recusar no acionamento,
  com mensagem que informe a indisponibilidade no dispositivo e oriente a usar um
  computador (design.md D5). Ocultar o botão contrariaria o requisito de
  `download-pasta`; recusar preserva-o inteiro.
- [x] 5.2 A recusa acontece **antes** de qualquer chamada a
  `POST /folders/:id/download-manifest` — nenhuma URL assinada emitida, nenhum
  evento de auditoria registrado. Mesma disciplina da recusa por limite.
- [x] 5.3 Redigir a mensagem de modo distinguível das outras duas recusas
  (limite excedido; permissão insuficiente). Três situações, três textos —
  requisito explícito de spec.
- [x] 5.4 Registrar em `navegacao/zip-download.ts` o motivo técnico da recusa
  (design.md D5): `triggerBlobDownload` materializa o `Blob` inteiro em memória
  via `URL.createObjectURL`, e o Safari iOS tem comportamento irregular com
  `download` em URLs de blob. **Não** alterar a implementação do modo largo.

## 6. Preview

- [x] 6.1 `visualizacao/PreviewModal.tsx`: abaixo do limiar, o preview aproveita
  a largura útil em vez do `width={800}` fixo (design.md D6). Visualizar é o ato
  central do uso móvel — esta é a tela principal do modo estreito, não um modal
  acessório.
- [x] 6.2 Substituir `height: '70vh'` do visualizador embutido por altura que
  acompanhe a área **efetivamente visível** — `70vh` reproduz aqui o problema de
  barra de endereço retrátil já tratado na change `fundo-marca-tela-login`.
- [x] 6.3 Resolver a incógnita registrada em design.md D6: verificar em Safari
  iOS e Chrome Android se o PDF embutido renderiza inline. Se não renderizar,
  apresentar indisponibilidade explicável — **nunca** retângulo vazio (requisito
  de spec). Verificação real em Safari iOS/Chrome Android não é possível neste
  sandbox; mitigado com o link "Abrir em nova aba" sempre visível junto ao
  `iframe`, que garante uma saída explicável independente do navegador.
- [x] 6.4 Conferir imagem, vídeo e áudio no modo estreito: os três já usam
  largura relativa e devem passar sem mudança. Confirmado — nenhuma mudança
  necessária.

## 7. Demais telas — nível utilizável

- [x] 7.1 Rolagem própria do contêiner nas seis tabelas —
  `navegacao/ExplorerPage.tsx`, `busca/BuscaPage.tsx`, `lixeira/LixeiraPage.tsx`,
  `pessoas/PessoasPage.tsx`, `unidades/UnidadesPage.tsx`,
  `auditoria/AuditoriaModal.tsx`. É uma linha cada e tira a rolagem horizontal do
  documento em toda a aplicação.
- [x] 7.2 `painel/PainelPage.tsx`: os quatro `<Col span={6}>` fixos viram colunas
  responsivas — em 360px, quatro cartões de ~85px são ilegíveis. Rever também
  `painel/GraficoBarras.tsx` (rótulo com `width: 160` fixo).
- [x] 7.3 `busca/BuscaPage.tsx`: os filtros já usam `Space wrap` e degradam sem
  quebrar; conferir as larguras fixas (240/200/200) e o `RangePicker`, que é o
  mais largo dos controles.
- [x] 7.4 `upload/UploadArea.tsx`: o `<Upload directory>` depende de
  `webkitdirectory`, ausente em Safari iOS e Chrome Android. Aplicar o mesmo
  princípio de D5 — manter visível, recusar com explicação no acionamento.
  Envio de **arquivo** continua funcionando normalmente e não é tocado.
- [x] 7.5 `Content margin: 24` do shell: em 360px são 48px (13% da tela) só de
  margem. Reduzir abaixo do limiar.

## 8. Testes

- [x] 8.1 `explorer.test.tsx` e `unidades.test.tsx`: as 10 asserções em botões de
  ação passam a depender do modo. **Alteração deliberada** (design.md D4) —
  manter cobertura nos dois modos, não simplesmente afrouxar as asserções para o
  agrupamento. Testes novos do modo estreito acrescentados a `explorer.test.tsx`
  (agrupamento e recusa de download); `unidades.test.tsx` não sofre alteração
  funcional (`UnidadesPage` não é tela otimizada — D4 é exclusivo do explorador)
  e a suíte completa já comprova que continua passando sem alteração.
- [x] 8.2 `shell-manual-do-usuario.test.tsx`: a estrutura de dois menus deixa de
  existir. Reescrever para o item como **último** da navegação, preservando as
  asserções de `href`, `target`, `rel`, nome acessível e ausência de marcação de
  seleção — essas continuam sendo o contrato.
- [x] 8.3 `shell-identidade-visual.test.tsx`: conferir que passa sem alteração —
  o `Sider` colapsável permanece acima do limiar. Se o teste renderizar em modo
  estreito por causa do mock de `matchMedia` (ver 1.4), ajustar o **ambiente** do
  teste, não o comportamento.
- [x] 8.4 Teste novo do risco estrutural (design.md D2): mesmo papel, os dois
  contêineres de navegação oferecem os **mesmos** itens, na mesma ordem. Fazer
  com ao menos um papel de administração, onde a divergência seria mais provável.
- [x] 8.5 Testes novos do painel sobreposto: destino interno navega e fecha; o
  manual abre em nova aba e **não** fecha.
- [x] 8.6 Testes novos das duas recusas por capacidade (download de pasta, envio
  de pasta): ação visível, recusa no acionamento, mensagem distinguível da recusa
  por permissão, e — no download de pasta — nenhuma chamada de manifesto disparada.
- [x] 8.7 Rodar a suíte completa dos dois workspaces. A API não é tocada por esta
  change; confirmar que continua verde, não presumir. Confirmado: 20 arquivos/126
  testes em `apps/web` e 28 arquivos/243 testes em `apps/api`, ambos verdes.

## 9. Verificação em navegador real

- [x] 9.1 Reconhecer o limite do ambiente: **jsdom não faz layout**. Nenhum teste
  da suíte prova que algo cabe na tela — a seção 8 trava declarações e presença
  de elementos. As verificações abaixo são a única evidência real. Feito com
  Chromium real (Playwright) contra `npm run dev:api` + `npm run dev:web`, nas
  larguras 360/768/1280px — não em dispositivo físico Safari iOS/Chrome Android
  (indisponível neste sandbox); ver nota em 6.3.
- [x] 9.2 Percorrer as telas otimizadas em 360px e em 768px: login, Início,
  explorador (incluindo subpasta profunda), preview (PDF, imagem, vídeo), busca.
  Confirmado: painel sobreposto abre com todos os itens na ordem correta, menu
  agrupado do explorador abre com Baixar/Permissões/Excluir, upload de arquivo e
  preview em largura útil (`teste.txt`) com o link de fallback visível.
- [x] 9.3 Percorrer as telas utilizáveis nas mesmas larguras, confirmando que a
  tabela rola no próprio contêiner e **o documento não rola horizontalmente**.
  Verificado por script (nenhuma das 7 telas em nenhuma das 3 larguras produziu
  `scrollWidth > clientWidth`) e por captura visual (painel 2x2, busca com
  filtros em `Space wrap`, tabelas com coluna "Ações" cortada no próprio
  contêiner).
- [x] 9.4 Conferir os dois papéis de administração — os itens extras de navegação
  são justamente onde uma divergência entre contêineres apareceria. Verificado
  com `global_admin` (Pessoas, Painel, Unidades presentes e idênticos nos dois
  contêineres); `unit_admin` já coberto por `role-guard.test.tsx` e
  `shell-painel-sobreposto.test.tsx`.
- [x] 9.5 **Regressão do modo largo**: percorrer as mesmas telas acima de 992px e
  confirmar que nada mudou, inclusive o `Sider` colapsado com seu tooltip. Este é
  o risco silencioso da change. Confirmado em 1280px: `Sider` com o mesmo menu
  único (agora incluindo o manual como último item, por design), sem gatilho de
  navegação no cabeçalho, toolbar do explorador em linha única.

## 10. Documentação

- [x] 10.1 `docs/manual/docs/a-tela.md`: hoje diz "Ao pé do menu lateral,
  separado dos itens acima" — passa a descrever o manual como último item da
  navegação, e a navegação como painel chamado sob demanda em telas estreitas.
- [x] 10.2 `docs/manual/docs/colaborador/visualizar-e-baixar.md` e
  `docs/manual/docs/referencia/limites.md`: registrar que o download de pasta não
  está disponível em celular e tablet, com a orientação de usar um computador.
- [x] 10.3 Conferir se `docs/manual/docs/colaborador/enviar.md` menciona envio de
  pasta e, se mencionar, registrar a mesma indisponibilidade. Mencionava —
  registrado, com referência cruzada a `limites.md`.
- [x] 10.4 Fidelidade à interface entregue (capability `documentacao-usuario`):
  descrever o que a tela faz, não o que a change pretendia. Conferido contra as
  capturas de tela reais da seção 9 (painel sobreposto, menu agrupado, recusas
  por dispositivo) antes de escrever o texto.
- [x] 10.5 Não formatar `docs/` nem `openspec/` com Prettier (`.prettierignore`
  já cobre os dois). Rodar `npm run format` apenas sobre o código alterado.

## 11. Fechamento

- [x] 11.1 `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` limpos na raiz. Confirmado: lint sem erros, build dos
  três workspaces ok, testes verdes (api 28/243, web 20/126), format:check ok.
- [x] 11.2 Confirmar que nenhum prefixo de rota mudou — `api-prefixes.ts`,
  `apps/web/vite.config.ts` e `infra/terraform/locals.tf` **não** devem ser
  tocados. Toda a change é de apresentação. Confirmado via `git status`.
- [x] 11.3 `openspec validate responsividade-mobile-tablet --strict`. Válido.
