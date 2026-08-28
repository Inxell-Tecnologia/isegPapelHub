# Design — mover-e-renomear-itens

## Context

A árvore do PapelHub é lógica, não física. `files.object_path` é
`/{unit_id}/{owner_id}/{uuid}` (`0005_replace_pending_object_path.sql`) e não
contém pasta alguma; a hierarquia vive inteiramente em `files.folder_id` e
`folders.parent_id`. Consequência direta: **mover é um `UPDATE` de uma coluna**,
sem deslocamento de byte, sem URL assinada, sem delta de cota (o dono não muda),
sem evento de finalize a reconciliar.

Duas propriedades do sistema atual condicionam o desenho, e as duas existem
porque `parent_id` nunca foi reescrito depois da criação:

1. **Nenhuma travessia da árvore tem guarda de ciclo.** `buildBreadcrumb`
   (`routes/folders.ts`) sobe a cadeia com um `while (parentId)` sem conjunto de
   visitados; `collectSubtreeFolderIds` desce com `WITH RECURSIVE ... UNION ALL`
   sem `CYCLE`. Ambos são corretos hoje porque a estrutura torna o ciclo
   impossível — `POST /folders` só aponta para um pai preexistente. Mover é a
   primeira operação que reescreve `parent_id`, e transfere essa invariante de
   estrutural para **validada**.
2. **O índice único de nome de pasta não cobre a raiz.**
   `folders_unit_parent_name_uidx` é `(unit_id, parent_id, lower(name)) WHERE
   deleted_at IS NULL` e, como `NULL != NULL` em índice único do Postgres, duas
   pastas homônimas em `parent_id IS NULL` passam. O gap está documentado na
   `0006` e remendado dentro de `ensureFolderPath` com uma leitura explícita.

Restrições herdadas e não renegociadas: RLS por `unit_id` em toda tabela
tenant-scoped; `SET LOCAL` por transação, nunca `SET` de sessão; o bypass de
`global_admin` vale **só para agregados** — rota de conteúdo sempre compara
`resource.unit_id === ctx.unitId`; item na lixeira resolve como **inexistente**
em toda via viva (Épico 6, D2).

## Goals / Non-Goals

**Goals:**

- Reorganizar arquivos e pastas sem reenviar, sem custo de cota e sem perder
  auditoria nem concessões.
- Fechar a lacuna do renomear pasta, que não existia.
- Não degradar nenhum invariante de segurança: isolamento por unidade, ausência
  de herança de permissão, fail-closed sem vazar existência.
- Tornar impossível o ciclo, em vez de torná-lo improvável.

**Non-Goals:**

- Mover/renomear por concessão a terceiro (D2), lote e arrastar-e-soltar (D7),
  auditoria de operação sobre pasta (D6), mover entre unidades (impossível por
  RLS).

## Decisions

### D1 — Alcance é "dono OU admin da unidade", nos dois lados da operação

A resolução de mover e de renomear pasta é **dono do recurso OU administrador da
unidade do recurso**, sem consultar `grants`. É exatamente a forma de
`canReadAudit` (`lib/access.ts`), que já existe e já é descrita como
"deliberadamente sem o ramo de `grant`" — reusa-se o molde, não o código, porque
`canReadAudit` é específico de `files`.

Vale para **os dois** recursos envolvidos:

```
  mover(item, destino)  permitido  ⟺  alcance(item) ∧ alcance(destino)

  alcance(x) = x.owner_id == ctx.userId
             ∨ isAdminOfUnit(ctx, x.unit_id)

  alcance(raiz da unidade) = true      // a raiz não tem dono; criar pasta nela
                                       // já é livre a qualquer pessoa da unidade
```

Herda de `isAdminOfUnit` a trava do bypass de `global_admin`: a comparação
explícita `resource.unit_id === ctx.unitId` é o que impede o admin global de
reorganizar conteúdo de outra unidade — a RLS o deixaria enxergar a linha, e é a
aplicação que recusa. Isto é o cenário 6 da US 2.3.

Fail-closed e sem vazamento: item inexistente, item de outra unidade (invisível
pela RLS), item na lixeira e item de terceiro devolvem **o mesmo `403`**, sem
distinguir os casos — mesmo tratamento de `findAccessibleFile` e do
`DELETE /folders/:id`.

_Alternativa descartada:_ exigir alcance só sobre o item, deixando o destino
livre. Permitiria despejar conteúdo dentro da pasta de outra pessoa sem nenhuma
permissão sobre ela — o inverso exato do que `validateAnchor` protege no upload.

### D2 — Nesta fatia, nenhum verbo de `grants` governa mover

Descartadas as três formas de abrir a operação a terceiros:

| | Verbo na origem | Por que não agora |
|---|---|---|
| A | `rename` | Abre escalação de privilégio (abaixo) |
| B | `delete` | Fecha a escalação, mas exige o verbo destrutivo para uma ação reversível — na prática ninguém concede |
| C | novo `move` | Correto, porém custa migração no `CHECK` de `grants`, cresce a tela de permissões e, sem herança, precisa ser concedido item a item |

A escalação da opção A é concreta, e é o motivo de a fatia nascer fechada. O
`DELETE /folders/:id` varre a subárvore **sem checar dono item a item**:

```sql
UPDATE files SET deleted_at = now(), trash_root_id = $2
 WHERE folder_id = ANY($3::uuid[]) AND deleted_at IS NULL
```

Combinada com um mover governado por `rename`:

```
  A é dona do arquivo X e concede a B apenas `rename` sobre X.
  B move X para uma pasta que B possui.
  B exclui essa pasta  ⇒  a cascata marca X, com trash_root_id = pasta de B.
  A não consegue restaurar: só raízes de exclusão são restauráveis, e restaurar
  a raiz (pasta de B) exige alcance de `delete` sobre ela, que A não tem.
  30 dias depois, purge-trash apaga os bytes de X e seus audit_events.

  Resultado: `rename` — o verbo mais inócuo do enum — virou destruição.
```

Hoje isso é impossível, porque não existe forma de levar um arquivo alheio para
dentro da própria pasta. Mover cria essa forma. Com o alcance de D1 a escalação
não nasce: quem move já é dono ou admin, e admin já podia excluir diretamente —
mover-e-excluir não lhe concede nada novo.

Fatia futura que abrir a terceiros deve decidir entre B e C **antes** de tocar
código, e reler este bloco.

### D3 — Ciclo é impossível por validação em duas camadas, na mesma transação

Ciclo não é dado feio: é indisponibilidade. `buildBreadcrumb` entra em laço
infinito no processo Node e o `WITH RECURSIVE ... UNION ALL` recursiona até
estourar no Postgres — cada um deles derruba as rotas de conteúdo e de exclusão
de pasta, respectivamente.

Camada 1, antes do `UPDATE`: recusar se `destino == item` ou se `destino ∈
subárvore(item)`, reusando a travessia recursiva já existente.

Camada 2, depois do `UPDATE` e **antes do commit**: subir a cadeia de `parent_id`
a partir do item movido, com conjunto de visitados e teto de profundidade; se
revisitar um nó ou estourar o teto, `ROLLBACK`.

A segunda camada não é redundância decorativa — ela cobre uma corrida que a
primeira não vê:

```
  t0   A→B e B→A chegam em transações concorrentes
  t1   ambas verificam "destino está na minha subárvore?"  →  ambas: NÃO
  t2   ambas commitam                        ┌───┐    ┌───┐
  t3   ciclo instalado                       │ A │───▶│ B │
                                             └───┘◀───└───┘
```

Escolhida a reverificação pós-`UPDATE` em vez de `SELECT ... FOR UPDATE` na
cadeia de ancestrais: a verdade fica no banco, na mesma transação, sem lock
aplicacional e sem depender de ordem de aquisição (que entre dois movimentos
cruzados é justamente onde nasce deadlock).

Independentemente disso, `buildBreadcrumb` e `collectSubtreeFolderIds` ganham
guarda de ciclo própria. Uma linha de dado corrompida por qualquer via não pode
derrubar rota de leitura.

### D4 — Colisão de nome recusa; não funde e não renomeia sozinha

Mover ou renomear uma pasta para um nome já ocupado por outra pasta **viva** no
mesmo destino devolve `409 folder_name_conflict`.

Contraste deliberado com `ensureFolderPath`, que **funde** homônimas: lá o pedido
é "garanta que este caminho exista" e reaproveitar é a resposta certa; aqui é
"mova este item", e fundir duas árvores é irreversível e nunca foi pedido.
Renomear automaticamente para "(2)" foi descartado pelo mesmo motivo: inventa um
nome que o usuário não escolheu.

Arquivos **não** entram nessa regra — `files` não tem unicidade de nome por pasta,
e dois arquivos homônimos na mesma pasta já são possíveis hoje via upload. Mover
arquivo, portanto, nunca colide. Não se cria constraint nova para alinhar os dois.

Vazamento assumido: o `409` revela que existe *alguma* pasta com aquele nome no
destino, possivelmente de outra pessoa e invisível ao solicitante. Aceito porque o
alcance de D1 exige que o solicitante seja dono ou admin do destino — não há
terceiro para quem vazar.

### D5 — O índice único passa a cobrir a raiz, em vez de mais um remendo

Migração recria o índice com `NULLS NOT DISTINCT` (Postgres 15+; o projeto roda
**16** no CI, no Cloud SQL e no dev):

```sql
CREATE UNIQUE INDEX folders_unit_parent_name_uidx
  ON folders (unit_id, parent_id, lower(name)) NULLS NOT DISTINCT
  WHERE deleted_at IS NULL;
```

Sem isso, "renomear pasta de raiz" e "mover pasta para a raiz" precisariam repetir
o remendo de leitura explícita que hoje existe dentro do `ensureFolderPath` — o
mesmo gap sustentado em três lugares em vez de um. Com o índice cobrindo, o
remendo do `ensureFolderPath` sai junto, e a garantia passa a ser do banco, válida
para qualquer chamador futuro.

Precede a criação o bloco `DO $$` de detecção de duplicatas no molde exato da
`0006`: se houver raízes homônimas preexistentes, a migração **aborta com mensagem
acionável** em vez de deduplicar em silêncio. A verificação em código não
substitui o índice — ela dá erro legível (`409`) em vez do `23505` cru.

### D6 — Auditoria registra `move` de arquivo; operação de pasta não gera evento

`audit_events.file_id` é `NOT NULL`, então uma operação sobre pasta não tem como
gerar linha própria. O precedente da casa é o `DELETE /folders/:id`, que audita
**cada arquivo** da subárvore. Aplicado a renomear pasta, esse precedente produz
uma afirmação falsa — nenhum arquivo foi renomeado — e o mesmo vale, mais
suavemente, para mover pasta, já que o `folder_id` dos arquivos não muda.

A linha adotada:

> A auditoria deste produto registra **acesso** (`view`, `download`),
> **destruição** (`delete`, `restore`) e **alteração de conteúdo** (`rename`,
> `replace`) — não reorganização de pasta. Criar pasta já não gera evento hoje;
> mover e renomear pasta seguem a mesma regra.

Portanto: `AuditAction.MOVE` novo, gravado **só** no mover de arquivo, onde o
sujeito do evento é inequívoco. `PATCH /folders/:id` e `POST /folders/:id/move`
não escrevem em `audit_events`.

_Alternativa custeada e adiada:_ tornar `audit_events` ciente de pasta
(`file_id` nullable + `folder_id` + `CHECK (num_nonnulls(file_id, folder_id) = 1)`).
É mais barato do que parece — existe **um** leitor no produto inteiro
(`GET /files/:id/audit`, já filtrando por `file_id`) e um `DELETE ... WHERE
file_id` no `purge-trash`, nenhum dos dois afetado. Foi adiada porque puxa junto a
revisão do `DELETE /folders/:id` (1 evento em vez de N) e a questão de haver leitor
para o evento de pasta — escopo próprio, não carona desta mudança.

### D7 — Seletor de destino em modal, drill-down sobre o endpoint que já existe

O `ExplorerPage` é uma `Table` do Ant Design com ações agrupadas por linha
(`GroupedActions`), sem `rowSelection` e sem arrastar-e-soltar.

Escolhido: ação "Mover para..." no menu do item, abrindo um modal cujo seletor
navega nível a nível com o **`GET /folders/:id/contents` já existente** — sem
endpoint de leitura novo. Molde igual ao de `RenameFileModal` e
`DownloadFolderModal`, e funciona em tela estreita, onde o projeto já recusa
deliberadamente o download de pasta (`web-responsividade`).

O descasamento que o seletor teria — `contents` filtra pastas por `view`, mas o
destino exigiria `upload` — **não existe** sob D1: o não-admin só pode mover para
pastas próprias, e o admin alcança a unidade inteira, que é exatamente o que
`contents` já lhe devolve. O recorte de alcance e o recorte de UI se sustentam
mutuamente.

Descartados: arrastar-e-soltar (morre em tela estreita, e a `Table` do Ant Design
resiste) e recortar/colar (estado global entre telas, sem ganho sobre o modal
enquanto não houver seleção múltipla).

### D8 — Mover pasta arrasta a subárvore sem checagem item a item

Mover uma pasta relocaliza tudo que está dentro dela, inclusive arquivos de
**outras pessoas** — cenário possível hoje, já que quem tem grant `upload` numa
pasta alheia pode enviar arquivos para dentro dela (Épico 3).

É a mesma escolha que o `DELETE /folders/:id` já faz: a cascata da lixeira também
não checa dono item a item. Quem controla o contêiner controla a localização do
que está nele. Registrado explicitamente para que uma revisão futura reconheça
isto como decisão, não descuido.

Consequência aceita: o dono de um arquivo pode vê-lo sair de uma pasta que ele
navega. A busca (`GET /search`) é da **unidade inteira**, não escopada por pasta,
e usa o mesmo `visibleResourceClause` — então o dono continua encontrando o
arquivo pelo nome. É resgate, não fluxo, e não muda com esta fatia.

## Risks / Trade-offs

- **Mover para pasta compartilhada não compartilha.** Sem herança (D2 do Épico 4),
  grant em pasta nunca libera o conteúdo. Hoje isso é quase invisível; com um botão
  "Mover", o usuário vai arrastar coisas para uma pasta compartilhada esperando que
  a equipe passe a ver — e não passa. Não é regressão, é uma expectativa que a
  feature torna visível. Mitigação nesta fatia: o manual diz isso com todas as
  letras. Se virar reclamação recorrente, o remédio é uma dica na própria tela de
  mover, não mudar a regra de herança.
- **A migração de índice pode abortar.** Raízes homônimas preexistentes bloqueiam a
  criação do índice. É intencional (falha legível > dedup silencioso), mas exige
  verificar a base antes do deploy — está nas tarefas.
- **`buildBreadcrumb` deixa de ter ancestral garantidamente do mesmo dono.** O
  comentário atual afirma que "todo ancestral já pertence ao mesmo dono", e isso
  **já é falso** desde o Épico 3 (`ensureFolderPath` cria pasta sob âncora de
  terceiro validada por `upload`). Um admin movendo item entre pessoas torna a
  situação rotineira. O breadcrumb não checa acesso ao subir, então nomes de
  pastas ancestrais aparecem para quem não tem `view` sobre elas. Nesta mudança:
  corrigir o comentário e registrar o vazamento de **nome** como conhecido. Fechá-lo
  é mudança de comportamento do breadcrumb, com escopo próprio.
- **Custo da verificação de ciclo.** Mover pasta paga uma travessia da subárvore
  antes do `UPDATE` e um walk de ancestrais depois. Desprezível na ordem de
  grandeza do produto (árvores de dezenas de níveis, não milhões), e o índice
  `folders_unit_id_parent_id_idx` serve as duas.

## Migration Plan

Ordem obrigatória — a migração `0014` precisa estar aplicada **antes** de qualquer
rota nova aceitar tráfego, porque a garantia de unicidade na raiz é do índice, não
do código:

1. Verificar duplicatas de raiz na base de destino (a própria migração aborta, mas
   descobrir em `migrate` é melhor que descobrir no deploy).
2. Aplicar `0014` (índice `NULLS NOT DISTINCT` + `CHECK` de `action` com `'move'`).
3. Publicar API e SPA.

A migração é **reversível na prática**: recriar o índice sem `NULLS NOT DISTINCT`
restaura o comportamento anterior, e o `CHECK` ampliado só se torna irreversível
depois que existir a primeira linha `action = 'move'`.

Nenhum dado é reescrito, nenhuma coluna é adicionada ou removida, nenhum backfill.
