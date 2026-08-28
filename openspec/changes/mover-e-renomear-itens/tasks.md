# Tasks — mover-e-renomear-itens

> Ordem obrigatória: a migração `0014` (seção 1) precisa estar aplicada **antes**
> de qualquer rota de mover/renomear aceitar tráfego — a unicidade de nome na raiz
> passa a ser garantia do índice, e as rotas contam com ela (design.md D5, Migration
> Plan). As guardas de ciclo (seção 4) precisam existir **antes** das rotas
> (seção 5): publicar o mover sem elas expõe as travessias sem guarda a laço
> infinito e a esgotamento de recursão (design.md D3).

## 1. Banco (migração `0014`)

- [ ] 1.1 Antes de escrever a migração, verificar na base de dev e na de produção
  se existem pastas **vivas** homônimas na raiz (`parent_id IS NULL`, mesmo
  `unit_id`, mesmo `lower(name)`, `deleted_at IS NULL`). Se houver, resolver com o
  time antes de seguir — a migração aborta de propósito.
- [ ] 1.2 `apps/api/src/db/migrations/0014_*.sql`: bloco `DO $$` de detecção de
  duplicatas no **molde exato da `0006`**, agora cobrindo também a raiz, que
  `RAISE EXCEPTION` com mensagem acionável em vez de deduplicar em silêncio.
- [ ] 1.3 `DROP` e recriação de `folders_unit_parent_name_uidx` com
  `NULLS NOT DISTINCT`, mantendo `WHERE deleted_at IS NULL` (Épico 6: pasta
  excluída não ocupa o nome).
- [ ] 1.4 Ampliar o `CHECK` de `audit_events.action` com `'move'`, no mesmo padrão
  incremental de `0004` e `0008` (`DROP CONSTRAINT` + `ADD CONSTRAINT`).
- [ ] 1.5 Nenhuma coluna nova, nenhum backfill, nenhuma tabela nova — logo, nenhuma
  policy RLS nova a escrever. Confirmar que é assim ao revisar.
- [ ] 1.6 `npm run migrate --workspace apps/api` e confirmar aplicação.

## 2. DTOs compartilhados (`packages/shared`)

- [ ] 2.1 `AuditAction.MOVE` em `audit.ts`.
- [ ] 2.2 DTO de mover, com o destino sempre **presente** e admitindo `null`
  (`{ destinationFolderId: string | null }`) — nulo = raiz. Não usar campo
  opcional: `undefined` e `null` precisam ser indistinguíveis do lado do servidor,
  e "mover para a raiz" é caso real (design.md, D1).
- [ ] 2.3 DTO de renomear pasta (`{ name: string }`) e resposta reusando
  `FolderResponse`.
- [ ] 2.4 Códigos de erro identificáveis para as duas recusas específicas
  (conflito de nome e destino inválido por ciclo), para a SPA distinguir os avisos.
- [ ] 2.5 `npm run build --workspace packages/shared`.

## 3. Resolução de alcance (`apps/api/src/lib/access.ts`)

- [ ] 3.1 Nova função de alcance "**dono OU admin da unidade**, sem ramo de
  grant", no molde de `canReadAudit` mas genérica por `GrantResourceType` (o
  `canReadAudit` é específico de `files`). Fail-closed: recurso inexistente, de
  outra unidade ou na lixeira ⇒ `false`.
- [ ] 3.2 Reusar `isAdminOfUnit` para herdar a trava do bypass de `global_admin`
  (comparação explícita `resource.unit_id === ctx.unitId`). **Não** replicar a
  lógica de admin à mão.
- [ ] 3.3 Comentário no arquivo explicando por que esta resolução **não** consulta
  `grants`, com ponteiro para design.md D2 — é a informação que impede a próxima
  pessoa de "consertar" a omissão sem ler a análise da escalação.

## 4. Árvore: ciclo, colisão e o remendo que sai (`apps/api/src/lib/folder-tree.ts`)

- [ ] 4.1 Verificação de ciclo **antes** do `UPDATE`: recusar se o destino é a
  própria pasta ou pertence à sua subárvore, reusando a travessia recursiva já
  existente.
- [ ] 4.2 Reverificação **depois** do `UPDATE` e antes do commit, na mesma
  transação: subir a cadeia de `parent_id` com conjunto de visitados e teto de
  profundidade; ao detectar ciclo, abortar a transação. É o que fecha a corrida
  entre dois movimentos cruzados (design.md D3).
- [ ] 4.3 Guarda de ciclo em `buildBreadcrumb` (`routes/folders.ts`): conjunto de
  visitados e teto de profundidade, terminando com erro tratado em vez de laço
  infinito.
- [ ] 4.4 Guarda de ciclo em `collectSubtreeFolderIds`: `UNION` com ciclo detectado
  ou cláusula `CYCLE`, em vez do `UNION ALL` nu.
- [ ] 4.5 Verificação de colisão de nome em pasta, com erro identificável
  (`folder_name_conflict`) antes de deixar o `23505` cru escapar — a constraint
  continua sendo a garantia, a verificação dá o erro legível.
- [ ] 4.6 **Remover** a leitura-remendo de raiz de `findOrCreateChild` /
  `ensureFolderPath` que existia só porque o índice não cobria `parent_id IS NULL`,
  e atualizar o comentário que documentava o gap (design.md D5).
- [ ] 4.7 Corrigir o comentário de `buildBreadcrumb` que afirma que "todo ancestral
  já pertence ao mesmo dono" — já é falso desde o Épico 3 e esta mudança o torna
  rotineiro (design.md, Risks).

## 5. Rotas da API

- [ ] 5.1 `POST /files/:id/move` em `routes/files.ts`: alcance sobre o arquivo
  **e** sobre o destino (seção 3), `UPDATE files SET folder_id = $1`, e nada mais —
  `object_path`, `size_bytes`, `owner_id` e `status` intocados.
- [ ] 5.2 Auditar `move` **por arquivo movido**, no mesmo padrão de `recordAudit`
  já usado por `rename`/`replace`. Só no sucesso.
- [ ] 5.3 `POST /folders/:id/move` em `routes/folders.ts`: alcance sobre a pasta
  **e** sobre o destino, verificação de ciclo (4.1/4.2), verificação de colisão
  (4.5), `UPDATE folders SET parent_id = $1`. **Sem** escrita em `audit_events`
  (design.md D6).
- [ ] 5.4 `PATCH /folders/:id`: alcance sobre a pasta, verificação de colisão,
  `UPDATE folders SET name = $1`. Espelhar a validação de nome do
  `PATCH /files/:id` (string não-vazia após `trim`). **Sem** escrita em
  `audit_events`.
- [ ] 5.5 Destino nulo aceito nas três rotas como "raiz da unidade", sem exigir
  alcance sobre a raiz (design.md D1).
- [ ] 5.6 Recusas fail-closed e **indistinguíveis** para inexistente / outra
  unidade / lixeira / terceiro sem alcance ⇒ mesmo `403`. Ciclo e conflito de nome
  são recusas **distintas** e identificáveis, porque não vazam existência de nada
  que o solicitante já não pudesse ver.
- [ ] 5.7 Confirmar que nenhum prefixo de rota de topo foi criado — `/files` e
  `/folders` já constam de `lib/api-prefixes.ts`, `apps/web/vite.config.ts` e
  `infra/terraform/locals.tf`. **Nada a sincronizar nas três pontas.**

## 6. Interface (`apps/web/src/navegacao`)

- [ ] 6.1 `MoverItemModal`: seletor de destino navegando nível a nível sobre
  `GET /folders/root/contents` e `GET /folders/:id/contents`, com indicação do
  nível corrente, opção explícita de escolher a **raiz** e confirmação.
- [ ] 6.2 Generalizar `RenameFileModal` para atender pasta também, ou extrair o
  modal comum — sem duplicar a validação de nome.
- [ ] 6.3 Ações "Mover para..." e "Renomear" (pasta) no menu por linha do
  `ExplorerPage`, entrando no `GroupedActions` em tela estreita como as demais.
- [ ] 6.4 Mutações em `queries.ts`, invalidando a listagem da pasta corrente ao
  sucesso.
- [ ] 6.5 Avisos **distinguíveis** para as três recusas: permissão insuficiente,
  destino inválido por ciclo e conflito de nome.
- [ ] 6.6 Não inferir permissão no cliente em nenhum ponto — oferecer a ação e
  deixar o `403` falar, como o resto do explorador já faz.

## 7. Manual do usuário (`docs/manual`)

- [ ] 7.1 `docs/manual/docs/colaborador/renomear-e-excluir.md`: cobrir **mover**
  arquivo e pasta e **renomear pasta**, com os rótulos exatos exibidos na tela.
- [ ] 7.2 Dizer com todas as letras que **mover para uma pasta compartilhada não
  compartilha o item** — a expectativa que a feature torna visível (design.md,
  Risks). Este é o ponto de maior valor da atualização do manual.
- [ ] 7.3 Registrar as recusas que o usuário pode encontrar: nome já existente no
  destino e destino dentro da própria pasta.
- [ ] 7.4 Avaliar se `referencia/tarefas-rapidas.md` merece a entrada "mover um
  arquivo"; ajustar o título da página em `mkdocs.yml` se o escopo dela deixar de
  ser descrito por "Renomear e excluir".
- [ ] 7.5 Documentar apenas o que a tela entrega — nada de capacidade só de
  backend (regra dura da capability `documentacao-usuario`).

## 8. Testes

- [ ] 8.1 **Ciclo direto**: mover pasta para si mesma ⇒ recusa, hierarquia intacta.
- [ ] 8.2 **Ciclo em profundidade**: mover pasta para uma descendente a 3+ níveis
  ⇒ recusa.
- [ ] 8.3 **Travessias resistentes a ciclo**: com uma linha em ciclo forçada
  diretamente no banco, `buildBreadcrumb` e `collectSubtreeFolderIds` terminam com
  erro tratado, sem pendurar o processo.
- [ ] 8.4 **Colisão na raiz** — o caso que o índice não pegava antes: mover/renomear
  pasta para nome já ocupado na raiz ⇒ recusa. Este teste é a razão de ser da
  migração `0014`.
- [ ] 8.5 Colisão sob pasta-pai e colisão que difere só por maiúsculas ⇒ recusa;
  homônima **na lixeira** ⇒ aceita.
- [ ] 8.6 Arquivos homônimos na mesma pasta após mover ⇒ aceito (sem constraint).
- [ ] 8.7 **Sem alcance**: não-dono com grant `rename` sobre o item e `upload`
  sobre o destino ⇒ `403` nas três rotas. Codifica o recorte de D2.
- [ ] 8.8 **Isolamento**: `global_admin` de outra unidade ⇒ `403`, indistinguível
  de inexistente. Somar ao `isolamento-unidade.test.ts` / `rls-isolation.test.ts`,
  que são contrato.
- [ ] 8.9 **Lixeira**: item na lixeira não é origem nem destino, nas três rotas.
- [ ] 8.10 **Preservação**: após mover, `object_path` inalterado, `size_bytes` e
  espaço utilizado do dono inalterados, concessões sobre o item ainda vigentes e
  `audit_events` anteriores preservados.
- [ ] 8.11 **Auditoria**: mover arquivo grava um evento `move`; mover/renomear
  pasta não gravam nada; `GET /files/:id/audit` continua devolvendo só
  `view`/`download`.
- [ ] 8.12 **Web**: modal de destino navega níveis e escolhe a raiz; as três
  recusas produzem avisos distintos; ações alcançáveis em tela estreita
  (`viewport.ts` já existe para isso).
- [ ] 8.13 `npm run lint`, `npm run build`, `npm run test` e `npm run format` na
  raiz — `format:check` é gate da CI, e `openspec/` e `docs/` ficam **fora** do
  Prettier de propósito.
