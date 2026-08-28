# Proposal — mover-e-renomear-itens

## Why

Hoje o PapelHub não tem como **reorganizar** o que já foi enviado. Um arquivo
nasce na pasta escolhida no momento do upload e morre lá; uma pasta nasce sob o
pai escolhido na criação e nunca mais se move. `files.folder_id` e
`folders.parent_id` são escritos uma única vez, na criação, e nenhuma rota os
reescreve.

O custo disso recai inteiro sobre o usuário: a única forma de mover um arquivo é
**excluir e reenviar** — o que consome banda, consome cota duas vezes até o
expurgo devolver o espaço (a lixeira retém 30 dias, `jobs/purge-trash.ts`),
descarta a trilha de auditoria do arquivo original (`purge-trash` apaga os
`audit_events` do arquivo expurgado) e não é sequer possível para uma pasta com
subárvore. Renomear pasta simplesmente **não existe**: há `PATCH /files/:id`
para arquivo, e nada equivalente para pasta.

Isso é caro por um motivo bobo — a árvore do produto é **puramente lógica**. O
objeto no bucket é `/{unit_id}/{owner_id}/{uuid}` (`0005_replace_pending_object_path.sql`):
não há pasta no caminho físico. Mover é um `UPDATE` de uma coluna. Nenhum byte
se desloca, nenhuma URL é assinada, nenhuma cota muda (o dono não muda), nenhuma
reconciliação de Pub/Sub é disparada. O que falta é a regra, não a mecânica.

Esta mudança implementa a **US 2.3** do PRD (`docs/prd_final.md`), introduzida
por ela.

## What Changes

- **Mover arquivo e pasta** — `POST /files/:id/move` e `POST /folders/:id/move`,
  ambos recebendo `destinationFolderId` (nulo = raiz da unidade). O item passa a
  residir no destino preservando conteúdo, dono, cota e **todas as concessões**
  — grants são por `resource_id`, então viajam com o item.
- **Renomear pasta** — `PATCH /folders/:id`, espelhando o `PATCH /files/:id` que
  já é o renomear de arquivo. Fecha uma lacuna anterior a esta mudança: a pasta
  era o único recurso do produto sem renomear.
- **Alcance restrito a dono e administrador da unidade** — mover e renomear pasta
  **não** são governados por nenhum verbo de `grants` nesta fatia. A resolução é
  "dono OU admin da unidade do recurso", a mesma forma já usada por
  `canReadAudit` (`lib/access.ts`), deliberadamente sem o ramo de concessão. Vale
  para os **dois** lados da operação: o item e o destino. Ver D1 e a análise da
  escalação descartada em D2.
- **Ciclo é recusado** — mover uma pasta para dentro da própria subárvore SHALL
  ser bloqueado, em duas camadas (verificação antes do `UPDATE` e reverificação
  depois, na mesma transação). Não é preciosismo: hoje `buildBreadcrumb`
  (`routes/folders.ts`) e o `WITH RECURSIVE ... UNION ALL` de
  `collectSubtreeFolderIds` **não têm guarda de ciclo**, porque a estrutura os
  tornava impossíveis. Mover é a primeira operação que reescreve `parent_id`; um
  ciclo derrubaria as duas travessias. Ver D3.
- **Colisão de nome recusa, não funde** — mover ou renomear uma pasta para um
  nome já ocupado por outra pasta viva no mesmo destino devolve
  `folder_name_conflict`. Deliberadamente **diferente** do `ensureFolderPath`, que
  funde homônimas no envio de pasta: ali o usuário pediu "garanta este caminho",
  aqui pediu "mova este item". Ver D4.
- **O índice único de nome de pasta passa a cobrir a raiz** — migração recria
  `folders_unit_parent_name_uidx` com `NULLS NOT DISTINCT` (Postgres 15+; o
  projeto roda 16 no CI, no Cloud SQL e no dev). Hoje o índice não pega colisão
  entre pastas de raiz, porque `NULL != NULL` — um gap conhecido e remendado em
  código dentro de `ensureFolderPath`. Renomear e mover-para-a-raiz precisariam do
  mesmo remendo em mais dois lugares; fechar no banco resolve para todos os
  chamadores de uma vez, inclusive retirando o remendo existente. Ver D5.
- **Auditoria: `move` de arquivo, e só** — novo `AuditAction.MOVE`, gravado no
  mover de **arquivo**. Operação de pasta (mover, renomear) **não** gera evento,
  em coerência com o `POST /folders` de hoje, que também não audita. A linha de
  princípio está em D6.
- **Interface** — ação "Mover para..." por item no explorador, abrindo um seletor
  de pasta que navega nível a nível sobre o `GET /folders/:id/contents` **já
  existente**; e "Renomear" passando a valer também para pasta. Sem endpoint de
  leitura novo. Ver D7.
- **Manual do usuário** — a página `colaborador/renomear-e-excluir.md` passa a
  cobrir mover e renomear pasta, com fidelidade ao que a tela entrega.

Fora de escopo (registrado em design.md):

- **Mover/renomear por concessão a terceiro.** Exigiria decidir qual verbo governa
  a operação, e o candidato natural (`rename`) abre uma escalação de privilégio
  real — ver D2. Fica para uma fatia própria, com a discussão do verbo feita à
  parte.
- **Seleção múltipla e mover em lote.** O explorador não tem `rowSelection` hoje;
  introduzi-la é mudança de arquitetura da tabela. O precedente de lote existe
  (`POST /files/upload-urls`) para quando a hora chegar. Ver D7.
- **Arrastar e soltar.** Morre em dispositivo estreito, e a `Table` do Ant Design
  resiste. O seletor em modal atende os dois formatos. Ver D7.
- **Auditoria de operação sobre pasta.** `audit_events.file_id` é `NOT NULL`, então
  pasta não tem como gerar linha própria. Tornar a tabela ciente de pasta é barato
  (há **um** único leitor no produto), mas puxa junto "excluir pasta devia emitir 1
  evento em vez de N" — é change próprio. Ver D6.
- **Mover entre unidades.** Nunca: a RLS por `unit_id` recusa por construção, e
  nenhuma rota desta mudança oferece a possibilidade.

## Capabilities

### Modified Capabilities

- `navegacao`: a hierarquia de pastas deixa de ser imutável após a criação —
  passa a admitir **mudança de pai** e **mudança de nome**, com recusa de ciclo e
  de colisão de nome, e com a unicidade de nome por pai valendo também na raiz.
- `gestao-arquivos`: o ciclo de vida do arquivo ganha **mover entre pastas**, ao
  lado de renomear e substituir, preservando conteúdo, dono, cota e concessões.
- `web-navegacao`: o explorador ganha a ação "Mover para..." com seletor de pasta
  de destino, e a ação de renomear passa a alcançar **pasta**, não só arquivo.

## Impact

- **Banco (`apps/api/src/db/migrations`):** nova migração `0014` — recriação de
  `folders_unit_parent_name_uidx` com `NULLS NOT DISTINCT` (precedida do bloco
  `DO $$` de detecção de duplicatas, no molde da `0006`, que **aborta com
  mensagem** em vez de deduplicar em silêncio); `CHECK` de `audit_events.action`
  ampliado com `'move'`. Nenhuma coluna nova, nenhum backfill.
- **API (`apps/api/src`):** `lib/access.ts` — nova resolução "dono OU admin",
  irmã de `canReadAudit`; `lib/folder-tree.ts` — detecção de ciclo e de colisão
  de nome, e remoção do remendo de raiz do `ensureFolderPath` agora que o índice
  cobre; `routes/files.ts` — `POST /files/:id/move`; `routes/folders.ts` —
  `POST /folders/:id/move` e `PATCH /folders/:id`; guarda de ciclo em
  `buildBreadcrumb` e em `collectSubtreeFolderIds`.
- **Shared (`packages/shared/src`):** `AuditAction.MOVE`; DTOs de mover
  (`MoveItemRequest`) e de renomear pasta; `rebuild` de `dist`.
- **Web (`apps/web/src/navegacao`):** novo `MoverItemModal` com seletor de destino
  drill-down; `RenameFileModal` generalizado para pasta; ações novas no menu por
  linha do `ExplorerPage`; mutações em `queries.ts`.
- **Infra:** nenhuma. Sem job novo, sem prefixo de rota novo — `/files` e
  `/folders` já constam de `api-prefixes.ts`, `vite.config.ts` e `locals.tf`, e
  a invariante das três pontas permanece intacta.
- **Documentação:** `docs/prd_final.md` ganha a US 2.3;
  `docs/manual/docs/colaborador/renomear-e-excluir.md` cobre mover e renomear
  pasta.
- **Testes:** ciclo recusado (direto e em profundidade); colisão recusada,
  inclusive **na raiz** (o caso que o índice não pegava); não-dono sem alcance
  mesmo com grant `rename`/`upload`; admin não alcança outra unidade; concessões
  e cota intactas após mover; item na lixeira não é origem nem destino;
  `object_path` inalterado.
