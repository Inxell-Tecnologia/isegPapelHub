# Design

## Context

Ver `proposal.md` — Why. O que importa aqui é o estado do código que esta change
encontra.

**A exigência dos dados está presa à rota, não ao item.** `POST /files/upload-url`
publica um documento e exige quatro campos; `POST /files/upload-urls` é lote e
pasta e dispensa todos. As decisões **D7 e D9** de `controle-documental`
escolheram essa divisão por um motivo concreto: o lote pede URL para **um** item
ao repetir uma transferência que falhou, e exigir quatro campos nessa repetição
quebraria o relato de falha independente que `envio-lote` entrega.

**A situação nunca é gravada.** `DOCUMENT_STATUS_SQL` em
`apps/api/src/lib/document-control.ts` deriva-a no `SELECT`, pelo relógio do
Postgres, e um teste trava a ausência de coluna de situação para que ninguém
"otimize" a derivação de volta a uma janela de mentira.

**Já existe uma regra de circulação restritiva, e ela tem forma.** O documento
obsoleto é subtraído em exatamente quatro lugares — os quatro caminhos por onde
bytes de um arquivo alcançam alguém:

| Caminho | Local |
| :--- | :--- |
| Listagem de pasta | `routes/folders.ts:125` — `nonObsoleteClause(ctx)` |
| Busca | `routes/search.ts:90` — idem, ao lado de `visibleResourceClause` |
| Identificador direto | `lib/access.ts` — recusa em `hasAccess`, antes dos ramos de concessão |
| Manifesto de download de pasta | `lib/folder-tree.ts:306` — idem |

`nonObsoleteClause` resolve para `TRUE` quando quem consulta é administrador da
unidade, e para `lifecycle_state IS DISTINCT FROM 'obsolete'` nos demais casos.
Nunca concede: compõe-se por `AND` com a resolução de acesso.

**Restrições que moldam o desenho**: `files` já está sob a fronteira de
isolamento (coluna `unit_id` + policy RLS de `0002_enable_rls.sql`), então
campos novos em `files` não pedem policy nova; `files.status` já existe e
significa **estado da transferência** (`pending`/`active`/`over_quota`), que é
outro eixo; e `NotificationPort` é idempotente por
`(recipientUserId, kind, sourceRef)`.

## Goals / Non-Goals

**Goals:**

- Exigência dos dados de controle **por item**, válida igualmente no envio
  unitário e no lote, sem quebrar a repetição de item falho que motivou D9.
- Dois estados novos que o acervo precisa saber distinguir: o arquivo que
  **nunca terá** dados de controle (Arquivo geral) e o que **ainda não tem**
  (Pendente de cadastro).
- Visibilidade do pendente com a mesma forma já provada pelo obsoleto —
  restritiva, nos mesmos quatro caminhos.
- Preservar o acervo anterior exatamente como está.

**Non-Goals:**

- Nenhuma alteração em tráfego de bytes. O pendente não muda nada no caminho de
  URL assinada: bucket segue privado, permissão segue checada no servidor antes
  de qualquer assinatura, e os TTL de `view-url` e `download-url` seguem
  distintos. A única mudança é que um arquivo pendente **não é alcançado** por
  quem não é o remetente nem a administração — recusa antes da assinatura, não
  assinatura diferente.
- Nenhuma tabela nova, portanto nenhuma policy RLS nova.
- Nenhum backfill, nenhuma rotina programada.

## Decisions

### D1 — O estado pendente é um marcador gravado, não uma derivação da ausência de dados

`files` ganha `awaiting_registration boolean NOT NULL DEFAULT false`.

A tentação é derivar: "arquivo sem tipo/código/revisão está pendente de
cadastro". **Não serve**, e a razão é o cenário 3 da US 10.5. O acervo enviado
antes do controle documental também não tem esses campos — pela derivação, todo
ele viraria "Pendente de cadastro" retroativamente e **desapareceria dos
leitores de uma vez**. Seria uma regressão de alcance silenciosa, atingindo
exatamente os arquivos que o PRD promete não invalidar.

O marcador separa os dois: ele é **fato sobre o envio** ("este item entrou sem os
dados, sob a regra nova"), não inferência sobre o estado atual das colunas. O
acervo antigo nasce `false` pelo `DEFAULT` e continua "Sem controle de revisão",
visível como sempre.

Isto **não** contradiz "a situação nunca é gravada": o que se grava é o fato do
envio; a situação continua derivada no `SELECT` (D2).

*Alternativas consideradas*: (a) derivar da ausência de dados — descartada acima;
(b) usar `created_at > <data da migração>` como corte — faz a regra depender de
uma data mágica no código e quebra em qualquer reimportação de acervo; (c)
reaproveitar `lifecycle_state` — conflaria o estado **declarado** do documento
(obsoleto, em revisão) com o estado do **cadastro**, e a derivação do obsoleto
passaria a competir com a do pendente no mesmo campo.

### D2 — Os dois estados novos entram na derivação da situação, não num segundo campo de etiqueta

`DOCUMENT_STATUS_SQL` ganha dois ramos, **antes** dos existentes:

```
WHEN awaiting_registration THEN 'awaiting_registration'
WHEN document_type = 'general_file' THEN 'not_applicable'
WHEN lifecycle_state = 'obsolete' THEN 'obsolete'      ← ramos atuais,
WHEN lifecycle_state = 'in_review' THEN 'in_review'       inalterados
WHEN next_review_at IS NULL THEN 'uncontrolled'
...
```

A ordem é a regra, como já é hoje para "estado declarado prevalece sobre a
data". Pendente vem primeiro porque é o estado mais cedo do ciclo: um arquivo que
ainda não foi cadastrado não tem situação de revisão a apurar. Arquivo geral vem
em seguida porque a ausência de situação nele é **definitiva**, não um estágio.

Isso mantém **uma** etiqueta por linha na listagem — o componente
`RotuloDeEstado` já existe e recebe tom semântico — em vez de um segundo campo
que a interface teria de combinar com o primeiro.

`not_applicable` existe para manter `documentStatus` **total e não-nulável**: a
alternativa (campo nulável) espalharia tratamento de `null` por toda leitura do
DTO para expressar o mesmo. A interface renderiza **ausência de etiqueta** para
`not_applicable` — é o que a demanda pede ("não tem situação"), decidido na
apresentação e não no contrato.

### D3 — A visibilidade do pendente espelha o obsoleto, com uma relaxação que precisa ser justificada

Fragmento novo `visibleRegistrationClause(ctx, ownerIdParam)`, aplicado nos
**mesmos quatro lugares** de `nonObsoleteClause`:

- administrador da unidade → `TRUE`;
- demais → `(awaiting_registration IS NOT TRUE OR owner_id = <ownerIdParam>)`.

E em `hasAccess`, recusa antes dos ramos de concessão, no mesmo ponto em que o
obsoleto já recusa, com a mesma indistinguibilidade de recurso inexistente.

**A diferença em relação ao obsoleto merece atenção, porque é uma relaxação
dentro de uma cláusula restritiva.** O obsoleto nunca relaxa: some até para o
dono. O pendente **não** some para o dono — tem de aparecer para ele,
justamente para que ele complete os dados. O `OR owner_id = …` é o que expressa
isso.

Por que isso não abre furo: a cláusula entra por `AND` depois de
`visibleResourceClause`, que já recortou por dono/concessão/admin **e por
unidade**. O ramo `owner_id = ctx.userId` só pode fazer reaparecer linha que a
cláusula externa já autorizou — e `owner_id = ctx.userId` nunca casa com arquivo
de outra unidade, porque a pessoa pertence a uma unidade só. A relaxação é sobre
**a própria restrição**, não sobre o alcance. Fica dito aqui porque a propriedade
"só subtrai" deixou de ser verdadeira por inspeção e passou a depender da
composição — e por isso ganha teste próprio, inclusive o caso cross-unit.

*Alternativa considerada*: tratar o pendente só em `hasAccess`, deixando a
listagem mostrá-lo a todos e barrar só a abertura. Descartada: a demanda diz
"não aparece para os leitores **nem na busca**", e um item visível na lista que
recusa ao ser aberto é pior que não aparecer.

### D4 — "Governança" é o administrador da unidade do arquivo

A demanda diz que o pendente "aparece só para quem enviou e para a Governança".
Não existe Governança no modelo: existem `collaborator`, `unit_admin` (rotulado
**Gestor** na interface) e `global_admin`. O único equivalente é o
**administrador da unidade do arquivo** — exatamente quem o obsoleto já elege
para continuar enxergando o que saiu de circulação.

A tradução é consciente e tem consequência: numa unidade com vários
administradores, todos veem os pendentes dela, o que é mais largo que "a
Gerência de Governança da Sede". Levar ao aceite. Um recorte mais fino depende
da decisão **D4 do plano** (setor como entidade) e, se a intenção for Governança
da Sede enxergando pendentes de **outras** unidades, da **D1 do plano** — que
esta change não abre, por ser a trava do bypass de `global_admin`.

### D5 — O conjunto de campos exigidos cresce para cinco, e passa a depender do tipo

Hoje `REQUIRED_CONTROL_FIELDS` tem quatro entradas (tipo, código, revisão,
próxima revisão). A tabela 2.2 da demanda marca **seis** campos como
obrigatórios: Tipo, Código, Título, Revisão, Responsável e Próxima revisão.

- **Responsável** entra no conjunto exigido — é o quinto campo. Isso altera
  também o **envio unitário**, porque a Regra da seção 2 vale "sozinho ou em
  lote". Consequência registrada: a US 10.5 cenário 1 passa a nomear cinco
  campos.
- **Título** não entra, porque já é obrigatório por outro caminho: mapeia para
  `file_name`, que nenhum envio consegue omitir (D8).
- **Arquivo geral** não exige nenhum dos cinco — "pede só o Título". O conjunto
  exigido passa, então, a ser **função do tipo**, e `parseDocumentControl`
  resolve `requireAll` depois de conhecer `documentType`, não antes.

### D6 — A exigência passa a ser por item; D7/D9 de `controle-documental` ficam superadas

`POST /files/upload-urls` passa a aceitar `documentControl` **por item**. A
divisão por rota deixa de ser o mecanismo da regra.

O motivo que sustentava D9 — repetir um item falho não é publicar documento novo
— continua válido e continua atendido, por outro meio: a repetição reenvia os
mesmos dados do item, e se o item não os tem, **é aceito como pendente** em vez
de recusado. Não há caso em que repetir um envio falho seja barrado por falta de
dados.

É isso que permite o que D7/D9 não permitiam: exigir sem recusar. A recusa
existe só para dado **inválido** (tipo fora do conjunto, data impossível,
revisão negativa, código duplicado na unidade) — nunca para dado **ausente**,
que produz pendente.

### D7 — Um aviso por arquivo pendente, sem rotina de insistência

`NotificationKind` ganha `registration_pending`, emitido a quem enviou, com
`sourceRef` = identificador do arquivo. A idempotência por
`(recipientUserId, kind, sourceRef)` que a capability já garante dá de graça o
comportamento correto: o mesmo arquivo nunca gera dois avisos, e repetir a
transferência do item não duplica nada.

A demanda diz "recebe aviso no sino **até completar os dados**". Leitura adotada:
a notificação **persiste** no sino até ser lida, e a lista de pendentes é a
superfície durável do problema. Uma rotina diária de reinsistência foi
descartada para esta fatia — exigiria competência temporal no `sourceRef` para
não reavisar a cada execução (o problema que a fatia C3 do plano terá de
resolver para os atrasos), e insistência diária sobre arquivo que a pessoa já
viu é ruído, não serviço.

### D8 — Título é `file_name`; nenhuma coluna nova

A demanda trata Título como campo de cadastro ("vem do nome do arquivo;
editável"). No modelo isso é `file_name`, que já existe, já é obrigatório, já é
renomeável por `PATCH /files/:id` sob o verbo `rename` — o mesmo verbo que a
edição dos dados de controle exige. Um campo `title` separado criaria duas
fontes para a mesma coisa e a pergunta insolúvel de qual delas a busca por nome
deve consultar.

### D9 — `awaiting_registration` é ortogonal a `files.status`

`files.status` significa estado da **transferência** (`pending` = bytes ainda não
reconciliados). `awaiting_registration` significa estado do **cadastro**. São
eixos independentes: um arquivo pode estar `active` e aguardando cadastro, ou
`pending` e já com todos os dados.

O nome foi escolhido para não colidir com `status='pending'` — `registration_pending`
convidaria à confusão exatamente no ponto em que ela é mais caustosa. A
reconciliação de cota não muda: bytes pendentes de cadastro ocupam espaço como
quaisquer outros.

### D10 — Completar os dados avalia a linha resultante, não a requisição

`PATCH /files/:id/document-control` hoje aceita preenchimento parcial
(`requireAll: false`). Passa a, **depois** de aplicar a alteração, avaliar se a
linha resultante tem os cinco campos (ou é Arquivo geral) e, em caso positivo,
limpar `awaiting_registration` na mesma transação.

Avaliar a requisição em vez da linha obrigaria quem completa a reenviar campos
que já estão gravados, só para provar que o conjunto está completo — e
transformaria "completar aos poucos" em "preencher tudo de novo".

## Risks / Trade-offs

**A janela entre B1 e B2 degrada o envio em lote** → decidido e aceito
(`proposal.md` — Impact): todo lote nasce pendente até a tabela de cadastro
existir, e a saída é a ação "Dados de controle" por item, que já existe. Mitigação
é de sequenciamento: emendar B2 imediatamente.

**A relaxação por dono em cláusula restritiva deixa de ser segura por inspeção**
→ teste de isolamento próprio, no nível dos testes do obsoleto: os quatro
caminhos, o não-atravessamento de unidade, e o caso em que o pendente é de
outra pessoa da mesma unidade (não aparece ao colaborador, aparece ao admin).

**`DocumentStatus` ganha dois valores e pode ter mapeamento exaustivo
desatualizado na SPA** → o rótulo de estado é um mapa único; valor sem entrada
deve cair em neutro, nunca em tela quebrada. Teste de apresentação para os dois
valores novos.

**Expandir o conjunto exigido altera o envio unitário, que já estava entregue** →
é mudança de comportamento visível (um envio que passava agora pede Responsável).
Está dito na proposal e vira cenário de spec alterado, não efeito colateral.

**Arquivo geral pode ser usado para fugir do controle documental** → o tipo é uma
declaração registrada e auditável, não um atalho silencioso; e a trava de leitura
obrigatória (fatia C1) depende dela. Vale acompanhar a proporção de "Arquivo
geral" no acervo depois da entrega, do mesmo modo que `controle-documental` já
registrou como risco a proporção de "Sem controle de revisão".

## Migration Plan

Migração **aditiva**, no molde de `0016_document_control.sql`:

1. `ALTER TABLE files ADD COLUMN awaiting_registration boolean NOT NULL DEFAULT false`
   — o `DEFAULT false` é o que preserva o acervo anterior (D1).
2. O nono valor de tipo é dado do enum compartilhado; `document_type` é `text`
   sem `CHECK` enumerado, validado na aplicação contra `DOCUMENT_TYPES` — nada a
   alterar no banco.
3. **Sem backfill**, por decisão (D1).
4. Índice: nenhum de início. A cláusula nova entra por `AND` em consultas que já
   filtram por `deleted_at`, `unit_id` e pasta; medir antes de acrescentar
   índice, como foi feito em `0017`.

**Rollback**: a coluna fica inerte se o código for revertido — nenhum dado é
perdido e nenhum arquivo muda de visibilidade, porque `false` é o estado que o
código anterior pressupõe para todos.
