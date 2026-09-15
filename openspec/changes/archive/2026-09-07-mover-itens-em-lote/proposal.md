# Proposal — mover-itens-em-lote

## Why

Mover existe desde `mover-e-renomear-itens` (US 2.3), mas **um item por vez**:
a ação "Mover para..." mora no menu de uma linha do explorador, e reorganizar
uma pasta com trinta arquivos custa trinta aberturas do mesmo modal, trinta
navegações até o mesmo destino e trinta confirmações. O custo é linear no
tamanho da bagunça, que é exatamente o caso em que reorganizar importa.

Isso não é uma lacuna descoberta agora — é uma fatia **reservada por escrito**.
O change `mover-e-renomear-itens` registrou, em "Fora de escopo":

> **Seleção múltipla e mover em lote.** O explorador não tem `rowSelection`
> hoje; introduzi-la é mudança de arquitetura da tabela. O precedente de lote
> existe (`POST /files/upload-urls`) para quando a hora chegar. Ver D7.

A hora chegou, e o que falta é barato: **a mecânica de mover está inteira**.
`canReorganize` resolve o alcance, `wouldCreateCycle` e
`assertNoCycleAfterMove` guardam a hierarquia, `hasFolderNameConflict` guarda o
nome, `AuditAction.MOVE` já existe, e o `MoverItemModal` já navega a árvore
sobre o `GET /folders/:id/contents`. Nenhuma dessas peças muda. O que esta
mudança acrescenta é a **noção de conjunto** — na tabela, na requisição e no
aviso de resultado.

## What Changes

- **Seleção múltipla no explorador** — `rowSelection` na `Table` do
  `ExplorerPage`, com barra de ação que aparece a partir de um item marcado. A
  seleção é **escopada à pasta corrente e limpa ao navegar**: não sobrevive a
  entrar numa subpasta, voltar pela trilha ou trocar de rota. Não é
  conveniência de implementação — é o que torna o lote seguro, ver a seção de
  impacto e D3.
- **Mover em lote** — `POST /files/move` e `POST /folders/move`, ambas
  recebendo `{ ids: string[], destinationFolderId: string | null }` (nulo =
  raiz da unidade). Uma seleção mista dispara **duas requisições**, e a
  interface junta os dois resultados num aviso só. As rotas por item
  (`POST /files/:id/move`, `POST /folders/:id/move`) **permanecem**, intactas.
- **Falha parcial com veredito por item** — a postura é a do
  `POST /files/upload-urls`, não a do `POST /grants`:
  - **Pré-condição global derruba o lote inteiro, e nada se move**: teto
    excedido (`400 move_batch_limit_exceeded`); destino inexistente, de outra
    unidade, ou sobre o qual o autor não tem alcance (`403`).
  - **Erro por item não aborta os demais**: item sem alcance, destino dentro da
    própria subárvore (ciclo), ou nome de pasta já ocupado no destino recusam
    **aquele** item e deixam os outros passarem.
  - Resposta `200 { results: [...] }` com um veredito por id, espelhando o
    `PreparedItem` do `upload-urls`.

  O fail-closed **integral** do `POST /grants` não se aplica aqui, e a razão é
  específica: lá o segredo protegido era a **existência de conta** — o autor
  informava ids que podia estar chutando, e recusa parcial vazaria quais
  existem. Aqui o autor marcou caixinhas numa listagem que a própria API acabou
  de lhe devolver; ele já sabe que os itens existem. Não há existência a vazar,
  e dizer *quais* falharam é a diferença entre um aviso acionável e um "não
  deu". Ver D2.
- **A guarda de concorrência permanece tudo-ou-nada** — a camada 2 da detecção
  de ciclo (`assertNoCycleAfterMove`) **lança**, e lançar dentro de um lote
  derrubaria por `ROLLBACK` os itens já movidos. Ela passa a rodar **uma vez,
  ao fim**, sobre as pastas movidas; se disparar, o lote de pastas inteiro cai
  com `409 folder_cycle`. A linha de princípio: *tolerância parcial cobre
  desfechos determinísticos, per-item e explicáveis ao usuário; corrida entre
  transações não é erro de quem pediu, e não se atribui a um item específico.*
  Ver D5.
- **Teto explícito** — `MOVE_BATCH_MAX_ITEMS` (padrão 100), por requisição, com
  código de erro próprio `move_batch_limit_exceeded`, no molde já estabelecido
  por `GRANTS_MAX_SUBJECTS` e `DOWNLOAD_MANIFEST_MAX_FILES`.
- **Modal de destino generalizado** — `MoverItemModal` passa de
  `item: MovingItem` para `items: MovingItem[]`. O drill-down, a trilha
  clicável, a reabertura na raiz e a escolha da raiz da unidade ficam
  **inalterados**. Nenhum endpoint de leitura novo.
- **Manual do usuário** — a página do colaborador que hoje cobre mover passa a
  cobrir a seleção múltipla e o mover em lote, com fidelidade à tela entregue.

Fora de escopo (registrado em design.md):

- **Outras ações em lote** — excluir, baixar e conceder permissão sobre vários
  itens. A `rowSelection` introduzida aqui as viabiliza, e a de permissões foi
  deferida pelo change `concessao-multipla-e-nomenclatura-colaborador` ("a
  seleção múltipla de recursos — o diálogo continua sendo por item do
  explorador"). Cada uma tem regra própria a decidir e vira fatia própria.
- **Seleção que sobrevive à navegação entre pastas.** Deliberadamente recusada:
  é ela que reintroduz colisão de nome intra-lote, ciclo combinado entre itens
  e uma interface que precisa explicar "3 itens selecionados em outra pasta".
  Ver D3.
- **Mover ou renomear por concessão a terceiro.** Continua fora, pelo mesmo
  motivo de `mover-e-renomear-itens` D2 (a escalação de privilégio via verbo
  `rename`). O lote não muda o alcance: é `canReorganize`, item a item.
- **Arrastar e soltar** e **recortar/colar**. Descartados em
  `mover-e-renomear-itens` D7; a seleção múltipla não os ressuscita.
- **Auditoria de operação sobre pasta.** `audit_events.file_id` é `NOT NULL`;
  mover pasta continua sem evento próprio, e a subárvore que ela arrasta segue
  invisível na trilha. Dívida conhecida (`mover-e-renomear-itens` D6) — não é
  esta fatia que a paga.
- **Rota `/items` unificada.** Custaria um prefixo de rota de topo novo e a
  sincronia das três pontas (`api-prefixes.ts`, `vite.config.ts`,
  `locals.tf`). Ver D4.

## Capabilities

### New Capabilities

<!-- Nenhuma capability nova: o lote estende requisitos já existentes. -->

### Modified Capabilities

- `gestao-arquivos`: mover arquivo deixa de ser exclusivamente por item —
  ganha a forma em lote, com pré-condição global de destino, veredito por item
  e auditoria emitida somente para os arquivos efetivamente movidos.
- `navegacao`: mover pasta ganha a forma em lote, com a mesma pré-condição
  global, recusa per-item de ciclo e de colisão de nome, e a guarda de
  concorrência pós-`UPDATE` avaliada uma vez sobre o conjunto movido.
- `web-navegacao`: o explorador ganha seleção múltipla escopada à pasta
  corrente, barra de ação em lote, o seletor de destino operando sobre um
  conjunto, e o relato de resultado parcial item a item.

## Impact

- **Banco:** **nenhuma migração**. `folders_unit_parent_name_uidx` (com
  `NULLS NOT DISTINCT`, migração `0014`) e o `CHECK` de `audit_events.action`
  com `'move'` já estão no lugar desde `mover-e-renomear-itens`.
- **API (`apps/api/src`):** `routes/files.ts` — `POST /files/move`;
  `routes/folders.ts` — `POST /folders/move`; `config.ts` — `moveBatch.maxItems`.
  `lib/access.ts` e `lib/folder-tree.ts` são **reusados sem alteração de
  assinatura**, com uma exceção: a camada 2 de ciclo passa a ser chamada uma
  vez sobre o conjunto, o que é mudança de **chamador**, não de função.
- **Shared (`packages/shared/src`):** DTOs de lote (pedido e envelope de
  `results`) e o código `move_batch_limit_exceeded`. Exige
  `npm run build --workspace packages/shared`.
- **Web (`apps/web/src/navegacao`):** `ExplorerPage.tsx` (`rowSelection`, estado
  da seleção com limpeza ao navegar, barra de ação em lote),
  `MoverItemModal.tsx` (plural), `queries.ts` (mutações de lote e junção dos
  dois `results`).
- **Rotas e prefixos:** **nenhum prefixo de topo novo.** `POST /files/move` e
  `POST /folders/move` têm dois segmentos e não colidem com
  `POST /files/:id/move` nem `POST /folders/:id/move` (três segmentos); não
  existe `POST /files/:id` nem `POST /folders/:id` de dois segmentos, e
  `/files/upload-url`/`upload-urls` já convivem nesse formato. Diferente de
  `/folders/root/download-manifest`, **não há requisito de ordenação de
  registro**. A invariante das três pontas (`api-prefixes.ts`,
  `vite.config.ts`, `locals.tf`) permanece intacta, e `web-serving.test.ts`
  continua válido sem alteração.
- **Infraestrutura:** nenhuma. Sem Terraform, sem job novo, sem scheduler, sem
  tópico.
- **Invariantes preservados, sem exceção:** bytes não passam pela API e nenhuma
  URL assinada é emitida (mover é `UPDATE` de coluna); `object_path`
  (`/{unit_id}/{owner_id}/{uuid}`) não muda; a cota não se mexe porque o dono
  não muda; grants são por `resource_id` e viajam com o item; a RLS por
  `unit_id` e o `withTenantTransaction` seguem sendo o caminho único.
- **Documentação:** `docs/prd_final.md` ganha a US de mover em lote — a US 2.3
  cobre apenas o singular ("movo o item"); `docs/manual/docs/colaborador/`
  cobre a seleção múltipla e o lote.
- **Testes:** lote misto; falha parcial preservando os demais; pré-condição
  global (destino sem alcance, destino de outra unidade) não movendo nada; teto
  excedido; ciclo recusando só o item culpado; colisão de nome recusando só a
  pasta homônima; auditoria emitida **somente** para os arquivos com sucesso;
  cota e concessões intactas após o lote; e, na web, a limpeza da seleção ao
  navegar e a barra de ação em lote.
