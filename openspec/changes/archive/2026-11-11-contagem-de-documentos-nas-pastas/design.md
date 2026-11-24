# Design

## Context

Motivação em `proposal.md`; requisitos nos deltas de `specs/`. Estado atual que
molda a solução:

- `apps/api/src/routes/folders.ts::listContents(client, ctx, folderId)` é a
  função comum às duas rotas de conteúdo (`/folders/root/contents` e
  `/folders/:id/contents`). Ela roda dentro de `withTenantTransaction` e faz
  duas consultas: subpastas com `visibleResourceClause(FOLDER)` e arquivos com
  `visibleResourceClause(FILE) AND nonObsoleteClause AND
  visibleRegistrationClause`. Para admin da unidade os fragmentos viram `TRUE`
  (ou `unit_id = '<unidade>'` para `global_admin`, que tem bypass de RLS) e o
  placeholder do dono sai dos parâmetros.
- `visibleResourceClause` = `deleted_at IS NULL` + dono OU concessão vigente de
  `view` (`expires_at IS NULL OR expires_at > now()`), **sem herança**: a
  concessão sobre uma pasta não libera os arquivos dela.
- `FolderResponse` (`packages/shared/src/folders.ts`) não tem contagem;
  `FolderContentsResponse.folders` é `FolderResponse[]`.
- `InicioPage.tsx` usa `useFolderContents(null)` e desenha cada pasta como
  `Link` > `Card` com `IconePasta` azul e o nome. O nome acessível do link é o
  texto do cartão (o nome da pasta). `tela-inicial.test.tsx` monta respostas de
  `GET /folders/root/contents` com um ajudante `pasta(id, nome)`.
- `tonsDeAtalho` (`apps/web/src/app/theme.ts`): quatro pares ícone/fundo
  (verde, azul, roxo, laranja) com contraste travado em `contraste.test.ts`.
- Índice `files_unit_id_folder_id_idx ON files (unit_id, folder_id)` já existe
  (migration 0004).

## Goals / Non-Goals

**Goals:**

- Mostrar no cartão de pasta do Início um número que **nunca** diga mais do que
  a pessoa veria ao abrir a pasta — mesma regra, mesmo recorte, mesmo relógio.
- Não criar regra de acesso nova: compor os fragmentos que já existem.
- Custo constante por requisição (uma consulta agregada), sem migration.

**Non-Goals:**

- Contar documentos de subpastas (D2).
- Exibir a contagem no explorador.
- Contar subpastas.

## Decisions

### D1 — Contagem na resposta de conteúdo, pelo mesmo recorte da listagem

`listContents` ganha uma terceira consulta, depois de obter as subpastas:

```sql
SELECT folder_id, count(*)::int AS n
FROM files
WHERE <visibleResourceClause(FILE)> AND <nonObsoleteClause>
  AND <visibleRegistrationClause>
  AND folder_id = ANY($k)          -- ids das subpastas recém-listadas
GROUP BY folder_id
```

com os **mesmos fragmentos e o mesmo placeholder do dono** que a consulta de
arquivos já usa. Por construção, `documentCount` da subpasta X é igual a
`files.length` de `GET /folders/X/contents` para o mesmo solicitante no mesmo
instante — é essa igualdade que os testes afirmam (D4).

Os ids vêm **só** da lista que `visibleResourceClause(FOLDER)` acabou de
liberar: não há contagem para pasta que a pessoa não pode abrir, porque a pasta
nem aparece. Pasta sem nenhum arquivo visível não volta do `GROUP BY` e recebe
`0` no mapeamento. Se a lista de subpastas vier vazia, a consulta não roda.

Vale para as duas rotas porque `listContents` é comum; o custo é uma consulta
indexada a mais por requisição. Alternativa descartada: só na raiz, com um
parâmetro — duplicaria o contrato da resposta por rota sem ganho real.

**Admin global.** O ramo admin de `resourceScopeClause` já devolve
`unit_id = '<ctx.unitId>'` para `global_admin`: a contagem nunca soma arquivos
de outra unidade, mesmo com o bypass de RLS (trava do bypass — agregado de
conteúdo não é agregado do painel).

### D2 — Só filhos diretos, não a subárvore

O número é "o que você encontra ao abrir esta pasta". Alternativa considerada:
somar a subárvore (o mockup, com "Governança — 38 documentos", pode sugerir
isso). Descartada nesta fatia porque:

- a resolução é **por item, sem herança** — a soma exigiria percorrer a
  subárvore descendo só pelas pastas que a pessoa pode abrir, como
  `traverseFolderSubtree` faz para o manifesto de download (N consultas por
  pasta de primeiro nível, ou uma CTE recursiva com o recorte de acesso em cada
  nível), custo desproporcional para um rótulo;
- um arquivo visível dentro de subpasta **não** visível entraria ou não na
  soma? Contá-lo diz que há conteúdo num lugar que a pessoa não pode abrir;
  não contá-lo faz o número variar de forma difícil de explicar;
- o número direto é verificável pela própria pessoa: abre a pasta e confere.

Consequência aceita: pasta de primeiro nível que só contém subpastas mostra
"Nenhum documento". Se o cliente pedir a soma, é um change próprio, com a regra
do item invisível decidida antes. Registrado como pendência em
`docs/plano_demanda_cliente_3.md`.

### D3 — DTO: `FolderListItemResponse`

```ts
export interface FolderListItemResponse extends FolderResponse {
  /** Documentos diretos que o solicitante veria ao abrir a pasta. */
  documentCount?: number;
}
```

`FolderContentsResponse.folders: FolderListItemResponse[]`. `FolderResponse`
continua sem o campo — ele é usado na trilha (`breadcrumb`), na pasta corrente,
na criação, no renomear, no mover e na restauração, onde contagem não tem
sentido e custaria consulta.

A API desta versão **sempre** envia o campo, mas ele é **opcional no
contrato**, no mesmo molde de `favoriteFolderIds` e dos `.catch(...)` de
`apps/web/src/lib/schemas.ts`: uma API anterior à SPA não o envia, e a
listagem não pode cair por um campo acessório. Na SPA, ausência (ou valor
inválido) é "contagem desconhecida" e o cartão **omite a linha** — nunca a
apresenta como zero, o que seria afirmar algo que o servidor não disse.

### D4 — Prova de não vazamento

Testes de API, junto dos de isolamento, afirmando a igualdade
`documentCount(X) === GET /folders/X/contents → files.length` e os cortes:

| Cenário | Esperado |
| :-- | :-- |
| Pasta com 3 arquivos do dono da pasta, consulta por pessoa com `view` só na pasta | pasta listada com `0` (sem herança) |
| Mesma pasta, pessoa com `view` em 1 dos 3 arquivos | `1` |
| Concessão de `view` no arquivo expirada (`expires_at` no passado) | `0`, na requisição seguinte, sem job |
| Arquivo na lixeira | não conta, nem para admin da unidade |
| Arquivo obsoleto | conta para admin da unidade, não para colaborador com `view` |
| Pendente de cadastro | conta para quem enviou e para admin, não para terceiro com `view` |
| `global_admin` consultando a raiz da própria unidade, com pastas e arquivos em outra unidade | contagem só da própria unidade; pasta de outra unidade não listada |
| Admin da unidade | todos os vivos da pasta |

### D5 — Cartão de pasta: ícone tingido com tom estável e contagem

- Ícone `IconePasta` num quadrado de 40×40 com `tom.fundo`/`tom.icone`, a
  mesma linguagem dos atalhos (`CartaoDeAtalho`), à esquerda do texto — como no
  mockup; o cartão de pasta é baixo (nome + contagem), então o ícone ao lado não
  quebra linha.
- **Tom estável por pasta**: `tomDaPasta(id)` = soma dos códigos de caractere do
  id módulo 4 sobre `['azul', 'verde', 'roxo', 'laranja']`. Por id e não por
  posição, para a cor da pasta não mudar quando outra pasta é criada ou
  renomeada (a lista é ordenada por nome). A cor é decorativa: o ícone é
  `aria-hidden` e a informação está no texto. Os pares já passam no piso de 3:1
  de elemento gráfico (`contraste.test.ts`), nada novo a apurar.
- Nome em `azulLink`, negrito; contagem embaixo em `textoApoio`, pelo
  `Typography.Text type="secondary"` já usado nos atalhos (contraste já
  apurado).
- Texto: função pura `textoDaContagemDeDocumentos(n)` →
  `0` "Nenhum documento", `1` "1 documento", `n` "`n` documentos" (com
  separador de milhar `pt-BR`).
- Acessibilidade: o link mantém **o nome da pasta como nome acessível**
  (`aria-label` = nome) e a contagem entra como descrição
  (`aria-describedby` apontando para o texto da contagem). Assim a navegação por
  links continua listando "Geral", "Governança", e o leitor de tela anuncia o
  número em seguida. A área de 44 px e o foco visível já vêm do cartão.

## Risks / Trade-offs

- **Número "baixo" frente à expectativa do cliente** (D2): uma pasta de setor
  com tudo em subpastas mostra "Nenhum documento". → Registrado no plano como
  pendência a validar com o cliente; a mudança para subárvore é isolada em
  `listContents` + uma decisão de regra.
- **Consulta a mais em toda navegação do explorador** (D1). → Indexada por
  `(unit_id, folder_id)` e limitada aos ids da página; sem N+1.
- **Divergência futura entre listagem e contagem** se alguém mudar uma das
  consultas e não a outra. → Os fragmentos são os mesmos, montados no mesmo
  ponto, e o teste de igualdade (D4) falha na divergência.

## Migration Plan

Sem migration nem mudança de infraestrutura. Deploy normal da API e da SPA; a
SPA antiga ignora o campo novo, e a nova só lê `documentCount` da resposta de
conteúdo.
