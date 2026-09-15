# Design — mover-itens-em-lote

## Context

Ver proposal.md — Why. O que importa aqui é o **estado do código**: a mecânica de
mover está inteira e não muda.

- `lib/access.ts::canReorganize` — dono OU admin da unidade, **sem** ramo de
  grant, exigido nos dois lados (item e destino).
- `lib/folder-tree.ts` — `wouldCreateCycle` (**retorna bool**, camada 1, antes do
  `UPDATE`), `assertNoCycleAfterMove` (**lança `FolderCycleError`**, camada 2,
  depois do `UPDATE` e antes do commit), `hasFolderNameConflict`,
  `findFolderById`, `validateAnchor`.
- `routes/files.ts::POST /files/:id/move` e
  `routes/folders.ts::POST /folders/:id/move` — as rotas por item, que
  **permanecem**.
- `MoverItemModal.tsx` — drill-down sobre `GET /folders/:id/contents`, trilha
  clicável, reabertura na raiz.
- `ExplorerPage.tsx` — `Table` com `rowKey="key"` e
  `Row = { kind: 'folder' | 'file' }`, **sem** `rowSelection`.

Restrições que moldam o desenho:

- Mover é `UPDATE` de uma coluna. Nenhum byte se desloca, nenhuma URL assinada é
  emitida, nenhuma cota muda — a árvore do produto é puramente lógica e
  `object_path` é `/{unit_id}/{owner_id}/{uuid}`, sem pasta no caminho. Nada
  nesta mudança toca o tráfego de bytes: o bucket segue privado e nenhuma rota
  nova assina URL.
- Toda query tenant-scoped roda em `withTenantTransaction`, com `SET LOCAL` por
  transação. Nenhuma tabela é criada e nenhuma coluna nova aparece, então não há
  RLS nova a escrever — as tabelas `files` e `folders` já têm `unit_id` e policy.
- A invariante das três pontas (`api-prefixes.ts`, `vite.config.ts`,
  `locals.tf`) restringe quais caminhos de rota são baratos.
- O repositório tem **três precedentes de lote que discordam entre si**:
  `POST /grants` (tudo-ou-nada, fail-closed integral),
  `POST /folders/:id/download-manifest` (parcial silencioso) e
  `POST /files/upload-urls` (pré-condição global aborta; erro por item não).

## Goals / Non-Goals

**Goals:**

- Reusar `canReorganize`, `wouldCreateCycle`, `hasFolderNameConflict` e
  `MoverItemModal` sem alterar assinatura — o lote é um **chamador novo** de
  regras existentes, não uma regra nova.
- Não abrir nenhum caminho de permissão que a operação por item não tenha.
- Entregar veredito por item, para que o aviso seja acionável.
- Custar zero em infraestrutura: sem migração, sem Terraform, sem prefixo de
  rota de topo novo.

**Non-Goals:**

- Não unificar arquivo e pasta numa rota só (ver D4).
- Não introduzir `SAVEPOINT` nem transação por item (ver D5).
- Não pagar a dívida de auditoria de pasta (ver D6).
- Não generalizar a `rowSelection` para outras ações agora — excluir, baixar e
  conceder permissão em lote seguem fora, cada uma com regra própria a decidir.

## Decisions

### D1 — Duas rotas plurais, reusando os prefixos existentes

Escolhido: **`POST /files/move`** e **`POST /folders/move`**, ambas
`{ ids: string[], destinationFolderId: string | null }`, devolvendo
`{ results: [...] }`.

Verificado que não há colisão nem requisito de ordenação de registro no Express:

```
files.ts     POST /files/upload-url        2 segmentos  ← já convive
             POST /files/upload-urls       2 segmentos  ← já convive
             POST /files/move              2 segmentos  ← novo
             POST /files/:id/move          3 segmentos
             (não existe POST /files/:id)

folders.ts   POST /folders                 1 segmento, casamento exato
             POST /folders/move            2 segmentos  ← novo
             POST /folders/:id/move        3 segmentos
             (não existe POST /folders/:id)
```

Como não existe rota `POST` de dois segmentos com parâmetro em nenhum dos dois
routers, `:id` nunca é testado nesse comprimento. Isso é **diferente** de
`/folders/root/download-manifest`, que precisa vir antes de
`/folders/:id/download-manifest` porque ambos têm três segmentos e `'root'`
casaria com `:id`. Aqui não há ordem a respeitar — mas vale um teste que fixe
isso, porque é exatamente o tipo de invariante que uma rota futura quebra em
silêncio.

Descartado: **`POST /items/move`**, com `{ items: [{ id, kind }], ... }`. É o
desenho semanticamente mais limpo e resolveria a seleção mista numa requisição
só, mas `/items` é **prefixo de rota de topo novo** — exigiria sincronizar
`api-prefixes.ts`, `vite.config.ts` e `locals.tf`, tocando Terraform por uma
fatia que de resto não tem nada de infraestrutura. Fica registrado como o
caminho natural caso outras ações em lote (excluir, baixar) apareçam e o
argumento de custo se inverta.

Descartado: **N chamadas do cliente às rotas por item**. Custa zero backend, mas
não tem teto no servidor, não tem pré-condição global de destino, e contraria o
precedente do `POST /grants`, que fez exatamente o caminho oposto de propósito.

### D2 — Falha parcial: pré-condição global aborta, erro por item não

Escolhido: a postura do **`POST /files/upload-urls`**.

```
┌─ PRÉ-CONDIÇÃO GLOBAL ─── derruba o lote, nada se move ──────────────┐
│  conjunto vazio                          → 400                      │
│  |ids| > teto                            → 400 move_batch_limit_    │
│                                                 exceeded            │
│  destino inexistente / outra unidade /   → 403 forbidden            │
│  na lixeira / sem canReorganize             (indistinguíveis)       │
└─────────────────────────────────────────────────────────────────────┘
┌─ POR ITEM ─── recusa aquele, os demais passam ──────────────────────┐
│  sem canReorganize / inexistente /       → { ok:false,              │
│  outra unidade / na lixeira                  error:'forbidden' }    │
│  destino ⊂ subárvore(item)   (pastas)    → 'folder_cycle'           │
│  homônima viva no destino    (pastas)    → 'folder_name_conflict'   │
└─────────────────────────────────────────────────────────────────────┘
                              ▼
        200 { results: [{ id, ok:true } | { id, ok:false, error }] }
```

O envelope espelha o `PreparedItem` do `upload-urls`
(`{ ok: true, ... } | { ok: false, error }`).

**Por que o fail-closed integral do `POST /grants` não transporta.** Lá a recusa
parcial vazaria **existência de conta**: os `subjectUserIds` são informados por
quem chama e podem ser chutados, então dizer "o id X não existe" transforma a
rota num oráculo de contas. Aqui os `ids` vêm de uma listagem que a própria API
acabou de autorizar e devolver — o autor marcou caixinhas numa tela. Ele já sabe
que os itens existem; saber que **não pode mover** um deles não lhe revela nada
novo. Sem segredo a proteger, o fail-closed integral só destrói informação útil:
"não deu" em vez de "estes dois não puderam, por isto".

Isso não relaxa o fail-closed onde ele importa: a pré-condição de **destino**
continua indistinguível entre inexistente, de outra unidade, na lixeira e sem
alcance — o destino é o único ponto da operação onde quem chama pode sondar um
id que não veio de uma listagem sua.

Descartado: **parcial silencioso** (postura do `download-manifest`), que filtra
item a item sem contar ao usuário o que ficou de fora. Ali faz sentido porque o
manifesto é "baixe o que eu posso lhe dar"; aqui o usuário nomeou os itens e
esperar que todos cheguem ao destino é razoável — a omissão seria uma surpresa.

### D3 — Seleção escopada à pasta corrente, e o que isso elimina de graça

Escolhido: a seleção vive na pasta corrente e é **esvaziada ao navegar**.

A consequência é maior do que a ergonomia sugere: se toda a seleção vem de um
único pai, **todos os itens selecionados são irmãos**. Disso decorrem três
propriedades, sem custo de código:

```
Seleção ⊆ filhos diretos de P.   Destino D, único para todo o lote.

(a) Pai e filho selecionados juntos — IMPOSSÍVEL
    Nenhum irmão é ancestral de outro irmão.

(b) Ciclo formado pela COMBINAÇÃO de dois itens — IMPOSSÍVEL
    A→D e B→D deixam A e B irmãos sob D; nenhum vira ancestral do outro.
    Ciclo só se D ⊂ subárvore(A) — condição per-item, já vista por
    wouldCreateCycle(A, D).

(c) Colisão de nome ENTRE itens do lote — IMPOSSÍVEL
    Irmãs já têm nome único por folders_unit_parent_name_uidx
    (NULLS NOT DISTINCT, migração 0014). Colisão só contra o que já
    mora em D. Arquivo nem entra: `files` não tem unicidade de nome.
```

De (a) decorre que a **normalização de seleção** — descartar da operação os
descendentes de itens selecionados, como fazem os gerenciadores de arquivos — foi
considerada e é **desnecessária**. Ela existe para evitar que mover A e B (com
B ⊂ A) para D achate a hierarquia, deixando B irmão de A em vez de dentro dele.
Com a seleção escopada, o caso não se forma.

De (b) e (c) decorre a conclusão que sustenta o resto do desenho: **o lote não
introduz nenhuma regra de integridade nova**. Toda verificação continua sendo
uma das que já existiam, aplicada por item.

Descartado: **seleção persistente entre pastas**. É ela que reintroduz (a), (b) e
(c) de uma vez, e ainda cobra uma interface que explique "3 itens selecionados em
outra pasta". O ganho — mover itens de pastas diferentes num gesto — não paga
três classes de caso de borda mais a superfície de UI. Registrado como fora de
escopo na proposal.

### D4 — Seleção mista envia duas requisições; o cliente consolida

Escolhido: a SPA dispara `POST /folders/move` e `POST /files/move` e junta os
dois `results` num único aviso. A ordem entre elas é irrelevante — o destino é
fixo e as operações não têm interdependência (mover uma pasta do lote não altera
o resultado de mover um arquivo do lote, porque nenhum arquivo selecionado está
dentro de uma pasta selecionada, por D3).

Trade-off aceito: perde-se atomicidade entre os dois tipos. Sob D2 isso quase
não custa — a tolerância parcial já é a postura, então "as pastas foram e os
arquivos não" é um desfecho que o relato por item cobre naturalmente. O que se
compra é D1: zero infraestrutura.

A pré-condição de destino é avaliada duas vezes, uma por requisição. É trabalho
duplicado e barato, e mantém cada rota íntegra sozinha.

### D5 — Guarda de concorrência é tudo-ou-nada; falha de item é per-item

Este é o problema que D2 cria, e é específico:

```ts
// lib/folder-tree.ts:214
export async function assertNoCycleAfterMove(client, movedFolderId) {
  ...
  if (visited.has(parentId)) throw new FolderCycleError();   // → ROLLBACK
}
```

Num lote sob uma `withTenantTransaction`, um `throw` no sétimo item derruba os
seis já movidos — o oposto de D2.

Escolhido: **a camada 2 roda uma vez, ao fim, sobre as pastas efetivamente
movidas**; se lançar, o lote de pastas inteiro cai com `409 folder_cycle`. A
camada 1 (`wouldCreateCycle`, que **retorna bool**) continua avaliada por item e
segue produzindo veredito individual.

A linha de princípio, que vale além desta rota:

> **A tolerância parcial cobre desfechos determinísticos, per-item e explicáveis
> ao usuário** — falta de alcance, ciclo previsível, nome ocupado no destino.
> **A guarda de concorrência permanece tudo-ou-nada.**

O racional está no próprio comentário da função: a camada 2 existe para *"fechar
a corrida que a camada 1 não vê — duas transações concorrentes que cada uma
verificou 'meu destino não está na minha subárvore' antes de qualquer `UPDATE`
commitar"*. Ela **não dispara por erro de quem pediu**: dispara porque outra
pessoa moveu uma pasta no intervalo. Atribuí-la como veredito de um item
específico seria mentir sobre a causa — o item apontado não é o culpado.
"Ninguém foi movido, tente de novo" é a resposta honesta, e é rara.

Descartado: **uma transação por item**. Correto e simples, mas paga N× o
`SET LOCAL` do `withTenantTransaction` e abre mão de qualquer consistência de
lote — inclusive tornando possível um estado em que metade das pastas moveu e a
camada 2 nunca teve o conjunto para avaliar.

Descartado: **`SAVEPOINT` por item**. Resolveria com precisão cirúrgica, mas não
existe um único `SAVEPOINT` no repositório hoje; introduzir a técnica por causa
de um caso que só ocorre sob corrida é preço alto por ganho raro.

### D6 — Auditoria: um evento por arquivo movido, nada para pasta

Escolhido: `AuditAction.MOVE` (já existente) gravado **somente** para os
arquivos com `ok: true`, depois da transação. Itens recusados dentro do lote não
geram evento; lote derrubado por pré-condição global não gera nenhum.

Emitir N eventos numa operação já é o padrão do produto: o
`download-manifest` grava um evento `download` por arquivo incluído.

Pasta continua sem evento próprio, porque `audit_events.file_id` é `NOT NULL` —
dívida conhecida, registrada em D6 de `mover-e-renomear-itens`, e explicitamente
**não paga aqui**. Torná-la ciente de pasta puxa junto "excluir pasta devia
emitir 1 evento em vez de N", que é change próprio.

### D7 — `MoverItemModal` no plural, sem antecipar validade do destino

Escolhido: `item: MovingItem` → `items: MovingItem[]`. O drill-down, a trilha
clicável, a reabertura na raiz e a escolha da raiz da unidade ficam
**inalterados** — nenhum endpoint de leitura novo. O título e o botão passam a
refletir a quantidade.

O modal **não** impede navegar para dentro de uma pasta selecionada. Bloquear a
própria pasta seria trivial, mas bloquear uma **subpasta** dela exigiria o
cliente conhecer a subárvore — leitura extra só para antecipar uma recusa que o
servidor já dá corretamente, e que sob D2 custa apenas aquele item. Isso é
coerente com o que o componente já documenta: *"Não antecipa a decisão de
permissão sobre o destino"*.

### D8 — Seleção disponível também em tela estreita

Escolhido: a `rowSelection` aparece abaixo do breakpoint `lg` (992 px,
`useNarrowMode` em `apps/web/src/app/responsive.ts`), onde a tabela já colapsa
ações em `GroupedActions`.

Mover **não** herda a recusa em tela estreita aplicada ao download de pasta. A
recusa de lá (`web-responsividade` D5) existe porque o `.zip` é montado no
navegador, em streaming, e dispositivo estreito não dá conta. Aqui nenhum byte
se desloca: é um `UPDATE` de coluna. Aplicar a mesma recusa seria imitar a forma
da regra sem sua razão.

Custo aceito: a coluna de caixas de seleção consome largura numa tabela que já é
apertada. A barra de ação em lote se acomoda no espaço já usado pelo cabeçalho da
listagem.

## Risks / Trade-offs

- **Rota futura de dois segmentos sob `/files` ou `/folders` reintroduz risco de
  casamento** → o teste de roteamento deve fixar que `POST /files/move` e
  `POST /folders/move` resolvem para o lote e não para a rota por item, para que
  a quebra apareça como teste vermelho e não como comportamento estranho.
- **Seleção mista sem atomicidade entre os dois tipos** (D4) → mitigado pelo
  relato consolidado item a item, que torna o desfecho parcial legível em vez de
  surpreendente; e a operação é idempotente na prática — reenviar o que faltou
  não corrompe nada.
- **Lote de pastas derrubado por corrida** (D5) → raro por construção (exige
  duas movimentações concorrentes de pastas encadeadas na mesma unidade), e a
  resposta é acionável: repetir a operação resolve.
- **Um lote grande de pastas segura uma transação por mais tempo**, com `UPDATE`
  e verificação de ciclo por item → mitigado pelo teto de 100 itens por
  requisição e pelo fato de cada operação ser um `UPDATE` de coluna indexada,
  sem I/O de storage.
- **A tela pode ficar dessincronizada após falha parcial** (parte moveu, parte
  não) → a SPA recarrega a listagem e esvazia a seleção ao fim de toda operação
  de lote, inclusive quando parcial.
- **`rowSelection` estreita a tabela em telas pequenas** (D8) → aceito
  conscientemente; se se mostrar ruim na prática, esconder a seleção abaixo do
  breakpoint é mudança local e reversível, sem tocar a API.

## Migration Plan

Sem migração de banco, sem Terraform, sem job novo, sem prefixo de rota novo.

Ordem de implantação: `packages/shared` (DTOs e o código
`move_batch_limit_exceeded`) precisa ser recompilado antes de api e web, porque
é consumido de `dist/`. As rotas novas são puramente aditivas — as rotas por
item permanecem, então a SPA antiga continua funcionando contra a API nova
durante qualquer janela de implantação.

Reversão: remover as duas rotas e a `rowSelection` restaura o comportamento
anterior sem deixar estado residual, já que nada é persistido além do
`folder_id`/`parent_id` que a operação por item também escreve.
