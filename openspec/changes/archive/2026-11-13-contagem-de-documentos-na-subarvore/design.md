# Design

## Context

Motivação em `proposal.md`; requisitos nos deltas de `specs/`. Estado atual
que molda a solução:

- `apps/api/src/routes/folders.ts::listContents(client, ctx, folderId)` é comum
  às duas rotas de conteúdo e já roda três consultas dentro de
  `withTenantTransaction`: subpastas (`visibleResourceClause(FOLDER)`),
  arquivos (`visibleResourceClause(FILE) AND nonObsoleteClause AND
  visibleRegistrationClause`) e a contagem agregada
  `SELECT folder_id, count(*) ... WHERE folder_id = ANY($k) GROUP BY folder_id`
  com os mesmos fragmentos (change `contagem-de-documentos-nas-pastas`, D1).
- Para admin da unidade os fragmentos viram `TRUE` (ou `unit_id = '<unidade>'`
  para `global_admin`, com bypass de RLS) e o placeholder do dono sai dos
  parâmetros.
- `lib/folder-tree.ts::traverseFolderSubtree` (download de pasta) já percorre a
  subárvore **podando subpasta sem `view` com toda a descendência** (design.md
  D2 de `download-pasta`) e conta `totalFiles` só no que é alcançável — é o
  precedente da regra pedida pelo cliente, mas faz uma consulta por pasta.
- `buildBreadcrumb` tem guarda de ciclo (visitados + teto
  `MAX_BREADCRUMB_DEPTH = 1000`): o projeto não presume que `parent_id` seja
  sempre acíclico.
- Índices: `folders (unit_id, parent_id)` e `files (unit_id, folder_id)`
  (migration 0004).
- O teste `contagem-documentos-pastas.test.ts` afirma
  `documentCount(X) === files.length de GET /folders/X/contents` e tem um caso
  "pasta só com subpastas tem contagem zero".

## Goals / Non-Goals

**Goals:**

- `documentCount` = documentos que o solicitante pode abrir na pasta e em toda
  subpasta que ele alcança navegando a partir dela.
- Não criar regra de acesso nova: os mesmos fragmentos, aplicados em cada nível.
- Continuar com uma consulta por requisição, sem N+1 e sem migration.

**Non-Goals:**

- Contagem no explorador, contagem de subpastas.
- Contar documento que só é alcançável por fora da árvore (compartilhado
  diretamente, dentro de subpasta podada).
- Cache ou desnormalização da contagem.

## Decisions

### D1 — Regra de alcance: poda da subpasta sem acesso com toda a descendência

Uma subpasta entra na soma só se o solicitante pode abri-la
(`visibleResourceClause(FOLDER)`: viva, e dono, admin da unidade ou concessão
vigente de `view` sobre a própria subpasta) **e** se a mãe dela já foi
alcançada. Subpasta sem acesso corta o ramo inteiro, mesmo que lá embaixo haja
uma pasta ou documento que a pessoa poderia ver.

Por quê: é a leitura literal do pedido ("se ela não tem acesso a uma subpasta,
os documentos dela ficam fora da conta"), é a mesma poda do download de pasta
— a pessoa obtém, ao baixar a pasta, um `.zip` com exatamente esse número de
arquivos (ressalvados os cortes do verbo `download`) — e garante que o número
nunca fala de conteúdo num lugar que a pessoa não consegue abrir navegando.

Alternativa descartada: contar também documento visível abaixo de subpasta
podada. O número passaria a falar de um lugar inalcançável pela navegação e
divergiria do download de pasta.

### D2 — Uma CTE recursiva com o recorte em cada nível

A consulta de contagem de `listContents` vira:

```sql
WITH RECURSIVE alcance (raiz_id, pasta_id) AS (
  SELECT id, id
  FROM folders
  WHERE id = ANY($k::uuid[])               -- subpastas recém-listadas
  UNION
  SELECT a.raiz_id, f.id
  FROM alcance a
  JOIN (SELECT id, parent_id FROM folders
        WHERE <visibleResourceClause(FOLDER)>) f   -- poda (D1)
    ON f.parent_id = a.pasta_id
)
SELECT a.raiz_id AS folder_id, count(*)::int AS n
FROM alcance a
JOIN (SELECT folder_id FROM files
      WHERE <visibleResourceClause(FILE)> AND <nonObsoleteClause>
        AND <visibleRegistrationClause>) v
  ON v.folder_id = a.pasta_id
GROUP BY a.raiz_id
```

- As raízes são **só** os ids que `visibleResourceClause(FOLDER)` acabou de
  liberar na listagem — nunca existe contagem para pasta que a pessoa não pode
  abrir.
- Os fragmentos são os mesmos (e com o mesmo placeholder do dono) das consultas
  de pastas e de arquivos. Como os fragmentos usam nomes de coluna sem
  qualificação (`deleted_at`, `owner_id`, `id`, `unit_id`), o passo recursivo e
  o `JOIN` final são escritos para que essas colunas resolvam sem ambiguidade
  na tabela certa — p.ex. o filtro de pasta numa subconsulta
  `f.id IN (SELECT id FROM folders WHERE <fragmento>)` e o de arquivo numa
  subconsulta sobre `files` —, em vez de reescrever os fragmentos com alias. A
  forma exata fica para a implementação; o requisito é reaproveitar os
  fragmentos sem duplicar regra.
- **Ciclo:** `UNION` (não `UNION ALL`) sobre `(raiz, pasta)` descarta tupla
  repetida; o conjunto é finito, então a recursão termina mesmo com
  `parent_id` cíclico, e cada pasta entra uma vez por raiz — sem contar
  arquivo em dobro e sem teto de profundidade. Na prática, descendo de uma
  pasta listada (cada pasta tem uma só mãe) só se encontra ciclo se a própria
  pasta aberta estiver nele — e aí a guarda de ciclo da trilha
  (`buildBreadcrumb`, `FolderCycleError`) interrompe a requisição antes da
  contagem, comportamento já existente e fora deste change. O `UNION` é
  defesa em profundidade: a contagem, sozinha, nunca entra em laço.
  *(Ajustado na implementação: a primeira versão previa teto de profundidade
  e `count(DISTINCT)`; o `UNION` sobre o par já garante as duas coisas.)*
- **Admin global:** o ramo admin dos fragmentos devolve `unit_id =
  '<ctx.unitId>'` para pastas e arquivos — a descida e a soma nunca saem da
  própria unidade, apesar do bypass de RLS.
- Vigência das concessões pelo `now()` do Postgres, em cada nível.

Alternativa descartada: reaproveitar `traverseFolderSubtree` por subpasta
listada — N consultas por pasta de cada nível, num caminho que roda em toda
navegação do explorador.

### D3 — Nova invariante de teste: igualdade recursiva

A igualdade antiga (`documentCount(X) === files(X)`) deixa de valer. A nova,
afirmada para dono, admin da unidade, colaborador com concessões parciais, quem
enviou o pendente e admin global:

`documentCount(X) === files(GET /folders/X/contents).length + Σ documentCount(S)`
para toda subpasta `S` listada em `GET /folders/X/contents`.

Ela amarra a contagem à listagem nível a nível: como `S` só aparece se a pessoa
pode abri-la, a soma é exatamente o que ela encontra navegando. Casos novos:

| Cenário | Esperado |
| :-- | :-- |
| Pasta só com subpastas, dono | soma dos documentos das subpastas |
| Subpasta sem `view` para o colaborador (que tem `view` na mãe e em documentos lá dentro) | documentos dela fora da soma |
| Sub-subpasta com `view`, abaixo de subpasta sem `view` | fora da soma (poda do ramo inteiro) |
| Subpasta na lixeira | fora da soma, inclusive para admin da unidade |
| Concessão de `view` sobre subpasta expirada | ramo sai da soma na requisição seguinte |
| Pasta aberta dentro de um ciclo em `parent_id` (montado com bypass) | a requisição termina (sem laço) |
| Admin global | soma só da própria unidade |

### D4 — Contrato e SPA inalterados

`FolderListItemResponse.documentCount` mantém tipo e opcionalidade; só o
comentário muda. A SPA já exibe o número tal como vem, então não há mudança de
código na web nem no `tela-inicial.test.tsx`. O texto do manual e o requisito
da `tela-inicial` mudam para dizer "incluindo as subpastas".

## Risks / Trade-offs

- **Custo da CTE em árvores grandes** → indexada por `folders (unit_id,
  parent_id)` e `files (unit_id, folder_id)`, uma única consulta, limitada às
  raízes da página. Se medir mal em produção, o caminho é cache por unidade —
  fora deste change.
- **Número "menor" que o do vizinho** com mais acesso → é a regra pedida;
  manual explica que a conta é pessoal.
- **Documento compartilhado comigo dentro de subpasta podada não entra** → por
  decisão (D1); ele continua em **Compartilhados comigo**. Manual menciona.
- **Divergência futura entre listagem e contagem** → fragmentos compartilhados e
  a igualdade recursiva (D3) falha na divergência.

## Migration Plan

Sem migration nem mudança de infraestrutura. Deploy normal da API; a SPA atual
já consome o campo. Rollback: reverter o commit da API devolve a contagem
direta, sem efeito sobre dados.
