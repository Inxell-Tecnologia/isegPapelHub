## 1. Contratos compartilhados (`packages/shared`)

- [x] 1.1 Definir os DTOs de pedido do lote (`ids: string[]`,
  `destinationFolderId: string | null`) e o envelope de resposta com veredito por
  item (`{ id, ok: true } | { id, ok: false, error }`), no molde do
  `PreparedItem` de `upload-urls` (design.md D2) — verificar que `npm run build
  --workspace packages/shared` compila sem erro.
- [x] 1.2 Acrescentar o código de erro `move_batch_limit_exceeded`, no molde de
  `grant_subjects_limit_exceeded` e `download_manifest_limit_exceeded` —
  verificar que o tipo é exportado e consumível a partir de `dist/`.
- [x] 1.3 Recompilar `packages/shared` para que api e web enxerguem os tipos
  novos (`npm run build --workspace packages/shared`).

## 2. Configuração (`apps/api`)

- [x] 2.1 Acrescentar `config.moveBatch.maxItems` lido de `MOVE_BATCH_MAX_ITEMS`
  com padrão 100, no molde de `config.downloadManifest` e do teto de grants —
  verificar que o padrão vale sem a variável definida e que a variável a
  sobrescreve.
- [x] 2.2 Documentar `MOVE_BATCH_MAX_ITEMS` em `.env.example` — verificar que o
  arquivo lista a variável com o valor padrão.

## 3. Rota de lote de arquivos (`POST /files/move`)

- [x] 3.1 Implementar a rota em `routes/files.ts` com a pré-condição global
  (conjunto vazio, teto excedido, destino inexistente/de outra unidade/na
  lixeira/sem `canReorganize`) derrubando o lote sem mover nada (design.md D2) —
  verificar com teste que nenhuma linha muda quando a pré-condição falha.
- [x] 3.2 Implementar o laço por item dentro de uma única
  `withTenantTransaction`, aplicando `canReorganize` a cada arquivo e acumulando
  veredito sem abortar os demais — verificar com teste que um item sem alcance
  não impede os outros de serem movidos.
- [x] 3.3 Gravar auditoria `AuditAction.MOVE` **somente** para os itens com
  `ok: true`, após a transação (design.md D6) — verificar com teste que um lote
  com 3 sucessos e 1 recusa produz exatamente 3 eventos.
- [x] 3.4 Verificar por teste que a rota preserva `object_path`, `owner_id`,
  `file_name`, `size_bytes`, a cota de todos os donos e as concessões existentes
  sobre cada arquivo movido.

## 4. Rota de lote de pastas (`POST /folders/move`)

- [x] 4.1 Implementar a rota em `routes/folders.ts` com a mesma pré-condição
  global da rota de arquivos — verificar com teste que destino sem alcance e
  destino de outra unidade produzem a mesma resposta e não movem nada.
- [x] 4.2 Implementar o laço por item com `canReorganize`, `wouldCreateCycle`
  (camada 1, retorna bool) e `hasFolderNameConflict`, acumulando veredito por
  item sem abortar os demais — verificar com teste que ciclo e colisão de nome
  recusam apenas a pasta culpada e são distinguíveis entre si na resposta.
- [x] 4.3 Chamar `assertNoCycleAfterMove` **uma vez, ao fim**, sobre as pastas
  efetivamente movidas, traduzindo `FolderCycleError` para `409 folder_cycle` do
  lote inteiro (design.md D5) — verificar com teste que o disparo da camada 2
  deixa a hierarquia exatamente como estava, sem nenhuma pasta movida.
- [x] 4.4 Verificar por teste que mover pasta em lote não grava nenhum evento de
  auditoria, nem para as pastas nem para os arquivos das subárvores
  (design.md D6).

## 5. Roteamento e invariantes de servidor

- [x] 5.1 Acrescentar teste fixando que `POST /files/move` e `POST /folders/move`
  resolvem para as rotas de lote e **não** casam com as rotas por item
  (design.md D1, Risks) — verificar que o teste falha se a ordem de registro ou
  um caminho novo de dois segmentos quebrar a resolução.
- [x] 5.2 Verificar que `web-serving.test.ts` continua passando sem alteração e
  que nenhum prefixo novo foi acrescentado a `api-prefixes.ts`,
  `apps/web/vite.config.ts` ou `infra/terraform/locals.tf` — a invariante das
  três pontas permanece intacta.
- [x] 5.3 Verificar por teste que `rls-isolation.test.ts`,
  `isolamento-unidade.test.ts` e `permission.test.ts` seguem verdes: o lote não
  abre nenhum caminho de permissão que a operação por item não tenha.

## 6. Seleção múltipla no explorador (`apps/web`)

- [x] 6.1 Acrescentar `rowSelection` à `Table` do `ExplorerPage` sobre o
  `rowKey="key"` já existente, com estado de seleção admitindo arquivos e pastas
  no mesmo conjunto — verificar por teste que marcar itens dos dois tipos os
  mantém selecionados juntos.
- [x] 6.2 Esvaziar a seleção sempre que a pasta corrente mudar — entrar em
  subpasta, voltar pela trilha ou chegar por outra rota (design.md D3) —
  verificar por teste que a seleção fica vazia após navegar.
- [x] 6.3 Acrescentar a barra de ação em lote, visível a partir de um item
  selecionado, exibindo a quantidade e oferecendo "Mover para..." — verificar por
  teste que ela aparece com seleção não vazia e some quando a seleção é
  esvaziada.
- [x] 6.4 Verificar por teste que a seleção permanece alcançável abaixo do
  breakpoint `lg` (design.md D8), usando o utilitário de viewport já existente em
  `src/__tests__/viewport.ts`.

## 7. Mover em lote na SPA

- [x] 7.1 Generalizar `MoverItemModal` de `item: MovingItem` para
  `items: MovingItem[]`, mantendo drill-down, trilha e escolha da raiz
  inalterados, e exibindo quantos itens serão movidos (design.md D7) — verificar
  por teste que o modal indica o tamanho do conjunto antes da confirmação.
- [x] 7.2 Acrescentar as mutações de lote em `navegacao/queries.ts` e disparar
  `POST /folders/move` e `POST /files/move` para seleção mista, consolidando os
  dois `results` num único aviso (design.md D4) — verificar por teste que uma
  seleção mista gera as duas chamadas e um só aviso.
- [x] 7.3 Relatar falha parcial informando quantos foram movidos e listando
  nominalmente cada item recusado com o motivo (permissão, ciclo, nome já
  existente) — verificar por teste que um resultado parcial não é exibido como
  falha total nem como sucesso total.
- [x] 7.4 Recusar o envio com aviso próprio quando a seleção exceder o teto,
  distinguindo-o da recusa por permissão — verificar por teste que nada é enviado
  nesse caso.
- [x] 7.5 Recarregar a listagem e esvaziar a seleção ao fim de toda operação de
  lote, inclusive parcial — verificar por teste que a seleção fica vazia e a
  listagem é invalidada.
- [x] 7.6 Verificar por teste que escolher como destino uma pasta selecionada não
  é bloqueado na interface e que o aviso de ciclo vem da recusa do servidor
  (design.md D7).

## 8. Documentação

- [x] 8.1 Acrescentar a US 2.4 (mover em lote) a `docs/prd_final.md`, com os
  cenários de lote bem-sucedido, falha parcial com veredito por item, destino sem
  alcance derrubando o lote, teto excedido e seleção limpa ao navegar — verificar
  que as specs desta change referenciam a US pelo número correto.
- [x] 8.2 Atualizar `docs/manual/docs/colaborador/renomear-e-excluir.md` para
  cobrir a seleção múltipla e o mover em lote, com fidelidade à tela entregue —
  verificar que descreve apenas o que a interface efetivamente oferece.
- [x] 8.3 Atualizar `docs/manual/docs/referencia/tarefas-rapidas.md` onde
  descreve mover, incluindo a forma em lote — verificar que o texto continua
  coerente com a página do colaborador.

## 9. Validação final

- [x] 9.1 Rodar `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` na raiz — verificar que todos passam, lembrando que
  `format:check` é gate da CI e que `openspec/` e `docs/` ficam fora do Prettier
  por decisão.
- [x] 9.2 Rodar `openspec validate --strict` para a change — verificar que os
  três deltas de spec são aceitos.
- [x] 9.3 Verificar por inspeção que nenhuma migração SQL, arquivo Terraform ou
  script de job foi acrescentado ou alterado nesta change.
