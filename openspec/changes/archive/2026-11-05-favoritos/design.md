# Design

## Context

O change `compartilhados-comigo` (A5) entregou a primeira **listagem plana** de
recursos em profundidade arbitrária e fixou a forma dela: localização = pasta
que contém o item, arquivo abre na visualização, pasta abre no explorador,
ações só dos verbos que vieram, perda de alcance remove sem erro. A lista
partia da **concessão**; aqui parte de uma **marca pessoal**, que não existe em
tabela nenhuma.

Favoritos é reentrada de escopo: o PRD o exclui na lista de Fora de Escopo, e a
demanda nº 2 (tabela 1.1) o traz de volta.

## Goals / Non-Goals

**Goals**

- Marcar/desmarcar arquivo e pasta; listar os favoritos vigentes.
- Mesma forma da lista de compartilhados, sem segunda implementação da regra de
  acesso.
- Favorito nunca amplia alcance.

**Non-Goals**

- Favoritos compartilhados, pastas de favoritos, reordenação manual.
- Favoritar a partir da busca, dos recentes ou do visualizador — entram depois,
  se a homologação pedir; o explorador e a própria lista cobrem marcar e
  desmarcar.
- Atalho de favoritos na tela Início.

## Decisions

### D1 — Tabela `favorites`, polimórfica, com `unit_id` + RLS

`(id, unit_id, user_id, resource_type, resource_id, created_at)`, com
`UNIQUE (user_id, resource_type, resource_id)` e policy `unit_isolation` igual à
das demais tabelas. Polimórfica pelo mesmo motivo de `grants`: pasta e arquivo
são os dois recursos que a resolução de acesso conhece (`GrantResourceType`).
Sem chave estrangeira para o recurso — também como `grants` —, e por isso o
expurgo tem de limpar as marcas (D7).

`unit_id` é o da **unidade do recurso**, gravado pelo servidor a partir do
recurso lido, nunca do corpo da requisição. Como a pessoa só alcança recurso
da própria unidade, coincide com a unidade dela; gravar a do recurso é o que
mantém a linha coerente se um dia D7(ii) do plano trouxer leitura de outra
origem.

A RLS isola unidades, não pessoas: a rota filtra `user_id = ctx.userId`
explicitamente em toda leitura e escrita. É o mesmo arranjo de
`notifications`.

### D2 — Marcar exige `view`, e a recusa é a de recurso inexistente

`PUT /favorites/:resourceType/:resourceId` passa o recurso por
`hasAccess(view)`. Sem alcance — inexistente, de outra unidade, na lixeira,
obsoleto para quem não administra, pendente de outra pessoa — responde **404
`not_found`**, sem distinguir os casos (*fail-closed*). Marcar um recurso que
não se vê seria a primeira forma de confirmar que ele existe.

`PUT` é idempotente: marcar o que já é favorito responde 200 com a mesma
marca, sem erro nem linha nova. `DELETE` também: desmarcar o que não é
favorito responde 204. **Desmarcar não exige alcance** — quem perdeu o acesso
pode limpar a própria marca; a operação só toca linhas da própria pessoa e não
revela nada.

### D3 — A lista parte da marca e confirma por `hasAccess`

`GET /favorites` lê as marcas da pessoa (ordem: `created_at` desc) e passa cada
uma por `hasAccess(view)` — **nenhuma segunda expressão da regra de acesso**,
pelo precedente de `GET /files/recent` e de `GET /grants/received`. O que não
passa é **omitido**, não apagado: perda de acesso por concessão vencida é
reversível, e uma leitura que apagasse dados como efeito colateral seria
surpresa. O item volta se o acesso voltar.

Em seguida, para os itens que ficaram, o servidor resolve também
`hasAccess(download)` sobre arquivos, e devolve **os verbos** (`view`,
`download`) — é o que a forma da A5 exige ("ações só dos verbos"), e aqui a
SPA não tem de onde tirá-los: o dono e o administrador alcançam sem concessão.

### D4 — Teto de 200 favoritos por pessoa

A lista custa até duas chamadas a `hasAccess` por marca. `config.favorites.
maxPerUser` (padrão 200) limita a marcação: a 201ª responde **409
`favorites_limit_exceeded`**, com motivo que orienta desmarcar favoritos. O
teto conta **todas** as marcas, inclusive as ocultas por perda de acesso (D3) —
contar só as visíveis exigiria resolver o alcance de todas a cada marcação.
Marcas ocultas que ocupem o teto são caso de borda aceito (Risks).

### D5 — Favoritos da página na própria listagem de pasta

O explorador precisa saber o que já é favorito para oferecer a ação certa
("Favoritar" / "Remover dos favoritos"). Em vez de a SPA cruzar a página com a
lista inteira, a listagem de pasta devolve `favoriteFolderIds` e
`favoriteFileIds`: **uma** consulta a `favorites`, na mesma transação,
restrita a `user_id` do contexto **e** aos ids que a listagem acabou de
liberar — não amplia nada. Uma consulta à parte em vez de `EXISTS` por linha
porque o fragmento de colunas da listagem (`fileSummaryColumns`) é
compartilhado com a busca e os recentes, e mexer nele espalharia o campo por
respostas que não o usam. Os campos são opcionais no contrato: uma API
anterior a esta change não os envia, e ausência é "nada é favorito".

### D6 — Prefixo de topo `/favorites`

O recurso é de pasta **ou** arquivo, então não cabe sob `/files` nem sob
`/folders`; pendurá-lo em `/grants` misturaria marca pessoal com permissão.
Prefixo novo entra nas **três** listas (invariante 7 do plano):
`apps/api/src/lib/api-prefixes.ts`, `apps/web/vite.config.ts` e
`infra/terraform/locals.tf`, com a cobertura de `web-serving.test.ts`.

### D7 — Expurgo remove as marcas

`jobs/purge-trash.ts` já apaga as concessões de cada arquivo e pasta
expurgados; apaga também as marcas, na mesma transação. Exclusão para a
lixeira **não** apaga: restaurar devolve o favorito, pela mesma razão de D3.

### D8 — Forma da lista: a da A5, com uma coluna a menos

Mesmas colunas de compartilhados — tipo do recurso, nome, localização, ações —
menos as de verbos concedidos e prazo, que não existem aqui; a data é "Marcado
em". As ações por item são visualizar e baixar (conforme os verbos devolvidos)
e **Remover dos favoritos**. A tela vazia orienta como marcar.

## Risks / Trade-offs

- **Marcas ocultas contam no teto.** Uma pessoa que perde o acesso a muitos
  favoritos pode atingir 200 sem vê-los. Aceito: caso raro, e a alternativa
  (apagar na leitura) tem custo maior. Revisitar se a homologação mostrar.
- **Custo da lista** — até 2 × 200 `hasAccess`. Mesmo perfil das outras listas
  planas.
- **Prefixo novo** é o tipo de mudança em que uma das três listas fica para
  trás; o teste de `web-serving` cobre a da API, e a tarefa exige conferir as
  outras duas.

## Migration Plan

Migração aditiva (`0021_favorites.sql`). Nenhum dado existente muda. Deploy da
API antes da SPA; o `locals.tf` precisa ir com o mesmo deploy, ou o url-map de
produção mandaria `/favorites` para o `index.html`.

## Open Questions

- Favoritar a partir da busca e do visualizador — fora desta fatia (Non-Goals).
