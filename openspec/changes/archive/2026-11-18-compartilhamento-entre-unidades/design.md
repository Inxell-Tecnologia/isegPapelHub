# Design

## Context

O isolamento por unidade tem duas camadas (CLAUDE.md, "Isolamento por
unidade"):

1. RLS por `unit_id` em toda tabela de unidade, com `FORCE ROW LEVEL
   SECURITY`. O próprio papel dono das tabelas fica sujeito à policy, e a
   única saída é o ramo `app.user_role = 'global_admin'`.
2. `lib/access.ts::hasAccess`: dono, admin da unidade do recurso ou grant
   vigente. Não há herança, a regra é fail-closed e o bypass do
   `global_admin` fica travado para conteúdo.

O caso da Raíra cai entre as duas camadas. `POST /grants` roda no contexto
da Ana (`global_admin`): a RLS de `users` mostra a Raíra, e a de `folders`
mostra a pasta. A linha nasce com `unit_id = SEDE`. Quando a Raíra pede a
pasta, a transação dela roda com `app.current_unit = Norte`, e a RLS esconde
a pasta e a concessão. O resultado é 403, como manda o PRD vigente (RF 6). A
concessão nunca teve efeito.

O pedido agora é uma exceção controlada. As decisões de produto estão em
proposal.md: o destinatário é pessoa ou unidade; concede o global ou o admin
da origem; a SEDE fica numa das pontas; a pasta inclui a subárvore; o acesso
é só `view`/`download`.

Restrição técnica que molda o desenho: **não existe hoje função `SECURITY
DEFINER` nem papel `BYPASSRLS`**. As migrações rodam com o papel da
aplicação, que não é superusuário: na CI é o `gdoc_ci`, criado assim de
propósito. Com `FORCE`, uma função `SECURITY DEFINER` desse papel continua
sujeita à RLS. Uma policy de `folders` que percorresse `folders` para achar
um ancestral compartilhado esbarraria em "infinite recursion detected in
policy".

## Goals / Non-Goals

**Goals**

- Fazer funcionar, de ponta a ponta, o caso real: Governança (SEDE) → Raíra
  (Norte), e Governança (SEDE) → Unidade Norte inteira.
- Atender ao sentido inverso: unidade → SEDE.
- Manter a RLS como fronteira entre unidades: uma pessoa só lê linhas de
  outra unidade numa transação aberta **depois** de o banco confirmar um
  compartilhamento vigente vindo dela.
- Não afrouxar nenhuma regra existente: `hasAccess`, os fragmentos de
  alcance, a trava do bypass e os testes de isolamento ficam intocados.
- Trocar a concessão comum sem efeito por uma recusa explícita.

**Non-Goals**

- Busca, recentes, tela inicial, favoritos, painel, `.zip` de pasta,
  notificações e leitura obrigatória entre unidades (proposal, "Fora de
  escopo").
- Escrita entre unidades.

## Decisions

### D1: Tabela própria `cross_unit_grants`, separada de `grants`

**Alternativas.**

- **(a)** Estender `grants` com `subject_unit_id` e `subject_user_id`
  anulável.
- **(b)** Criar uma tabela própria.

**Escolhida: (b).** `grants` tem invariantes que o código inteiro assume:
`subject_user_id` não nulo, sem herança, unidade única, os cinco verbos.
Esses invariantes aparecem em `hasAccess`, `resourceScopeClause`,
`listReceivedCandidates`, no job de avisos e no modal. O compartilhamento
entre unidades difere nos quatro pontos. Misturar os dois exigiria um
`WHERE` defensivo em cada consulta antiga, e uma consulta esquecida viraria
furo. Com tabela separada, nenhuma consulta existente muda de significado.

```sql
CREATE TABLE cross_unit_grants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id          uuid NOT NULL REFERENCES units (id),  -- origem = unidade do recurso
  resource_type    text NOT NULL CHECK (resource_type IN ('folder', 'file')),
  resource_id      uuid NOT NULL,
  subject_unit_id  uuid NOT NULL REFERENCES units (id),  -- destino
  subject_user_id  uuid REFERENCES users (id),           -- NULL = unidade inteira
  permission       text NOT NULL CHECK (permission IN ('view', 'download')),
  granted_by       uuid NOT NULL REFERENCES users (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  CHECK (subject_unit_id <> unit_id)
);
-- Idempotência de reconcessão, como em grants (NULLS NOT DISTINCT: PG 15+).
CREATE UNIQUE INDEX cross_unit_grants_uidx ON cross_unit_grants
  (unit_id, resource_type, resource_id, subject_unit_id, subject_user_id, permission)
  NULLS NOT DISTINCT;
CREATE INDEX cross_unit_grants_subject_idx ON cross_unit_grants (subject_unit_id, subject_user_id);
```

A **unidade de destino é gravada mesmo na concessão por pessoa**. É ela que
permite à RLS do destino enxergar a linha sem consultar `users`. Também é
ela que adormece a concessão se a pessoa mudar de unidade: a resolução exige
`subject_unit_id = ctx.unitId`, e o contexto vem relido do banco a cada
requisição.

`NULLS NOT DISTINCT` está disponível em todos os ambientes: Cloud SQL
`POSTGRES_16` (`infra/terraform/cloud_sql.tf`), `postgres:16` na CI e
Postgres 16 no sandbox.

### D2: RLS de `cross_unit_grants` e o novo `app.current_user_id`

```sql
-- origem gere (FOR ALL): lê, cria, revoga
CREATE POLICY origin_manage ON cross_unit_grants
  USING (unit_id = current_unit OR role = 'global_admin')
  WITH CHECK (unit_id = current_unit OR role = 'global_admin');
-- destino só lê (FOR SELECT): nunca revoga nem altera
CREATE POLICY destination_read ON cross_unit_grants FOR SELECT
  USING (subject_unit_id = current_unit
         AND (subject_user_id IS NULL OR subject_user_id = current_user_id));
```

São duas policies, e não uma: numa policy única `FOR ALL`, o `USING` do
ramo de destino valeria também para `DELETE`, e o destino poderia revogar o
que recebeu.

A notação está abreviada: as expressões reais seguem o molde de
`0002_enable_rls.sql`, com `NULLIF(current_setting(...), '')::uuid`.

- **A origem gere** (`USING` e `WITH CHECK` por `unit_id`).
- **O destino só lê o que lhe diz respeito**: o que foi dado à unidade dele
  e o que foi dado a ele em pessoa. A concessão individual feita a um
  colega não chega à transação de outra pessoa da mesma unidade.
- A transação de visita é **somente leitura por imposição do banco**:
  policies `AS RESTRICTIVE` recusam INSERT/UPDATE/DELETE com
  `app.user_role = 'shared_visitor'` em toda tabela de unidade, exceto
  `audit_events` (a única escrita da visita). A visita lê
  `cross_unit_grants` da origem pela `origin_manage`, mas nunca a altera.
- Para isso `withTenantTransaction` passa a publicar
  `set_config('app.current_user_id', ctx.userId, true)`, com `SET LOCAL`,
  ao lado de `current_unit` e `user_role`. Sem a configuração, a
  comparação dá `NULL` e o ramo pessoal nega (fail-closed).

### D3: Transação de visita na unidade de origem

Para ler a pasta da SEDE, a transação da Raíra precisa ver linhas da SEDE.

**Alternativas.**

- **(a)** Afrouxar as policies de `folders`/`files`/`audit_events` com um
  `EXISTS` sobre `cross_unit_grants`. Para pasta isso funciona, mas a
  subárvore (D5) exige percorrer `folders` dentro da policy de `folders`,
  o que dá recursão. Também não há `SECURITY DEFINER` capaz de sair da RLS
  (Context).
- **(b)** Materializar, por gatilho, o alcance de cada compartilhamento
  sobre cada item. Isso exige manter a materialização em criar, mover,
  excluir e restaurar, e cada operação esquecida vira furo ou recusa
  indevida.
- **(c)** Abrir uma **transação de visita**: um contexto RLS na unidade de
  origem, aberto só depois de provar o compartilhamento.

**Escolhida: (c).** Novo método no seam:

```ts
// ports/database-port.ts
withSharedVisitTransaction<T>(visit: SharedVisit, fn: (client) => Promise<T>): Promise<T>;
// SharedVisit = { userId, originUnitId }
// SET LOCAL app.current_unit = originUnitId,
//           app.user_role    = 'shared_visitor',
//           app.current_user_id = userId
```

- `'shared_visitor'` **não é** `'global_admin'`, então nenhuma policy dá
  bypass. Dentro da visita a RLS confina a transação **à unidade de
  origem**: nada de terceira unidade, nem da própria unidade da pessoa.
- Dentro da unidade de origem, a fronteira passa a ser a aplicação. Isso
  **não é novidade**: dentro de uma unidade a RLS nunca impôs dono ou
  grant, quem impõe é `hasAccess`. A visita reproduz o modelo de sempre
  (RLS por unidade e alcance fino na aplicação), com a unidade de origem
  no lugar da própria.
- A transação de visita **só é aberta por `lib/cross-unit-share.ts`**, e
  **sempre** começa por reconfirmar, dentro dela, o compartilhamento
  vigente vindo da origem para `(userId, unidade da pessoa)`. A linha tem
  `unit_id = origem`, então é visível na visita. Como verificação e uso
  ficam na mesma transação, não há janela entre "vale" e "usou". Um teste
  de arquitetura (grep no código) falha se outro módulo chamar
  `withSharedVisitTransaction`.
- Na visita, `hasAccess` **nunca** é chamada: a visita não é dona, não é
  admin e não tem grant. A resolução da visita é própria (D4).
- A unidade de origem candidata vem da transação **própria** da pessoa,
  que lê os compartilhamentos vigentes endereçados a ela. Ela não vem da
  requisição: o solicitante não informa unidade em lugar nenhum, e isso
  preserva o requisito "alcance não é forjável".

### D4: Resolução: segundo caminho, só depois de `hasAccess` negar

```
resolveSharedAccess(ports, ctx, resourceType, resourceId, permission)
  1. transação própria (ctx): candidatos =
       SELECT DISTINCT unit_id FROM cross_unit_grants
        WHERE subject_unit_id = ctx.unitId
          AND (subject_user_id IS NULL OR subject_user_id = ctx.userId)
          AND permission = $permission
          AND (expires_at IS NULL OR expires_at > now())
     (no máximo uma origem para quem não é da SEDE; várias para a SEDE)
  2. para cada origem: withSharedVisitTransaction({userId, origem}):
       a. recurso existe na origem, deleted_at IS NULL, não obsoleto,
          não pendente de cadastro                → senão, próxima origem
       b. a SEDE está numa das pontas e a origem está ativa
          (units.is_headquarters / status lidos aqui)
       c. existe compartilhamento vigente do verbo cujo recurso-raiz é o
          próprio item ou uma pasta ancestral (D5), para a pessoa ou a
          unidade dela
       d. se (a..c), executa o callback da rota DENTRO desta transação
          (assinar URL, auditar, listar) e devolve o resultado
  3. nenhuma origem serviu → negado (mesmo 403/404 de antes)
```

As rotas de conteúdo seguem a ordem **`hasAccess` primeiro** e só depois a
visita. Quem já tinha acesso pelo caminho comum não abre transação extra, e
o caminho comum não muda de comportamento. A negação final é **a mesma
resposta** que a rota dava antes (403 sem preview em view/download, 403 em
contents). Não se distingue "não existe", "é de outra unidade" e "existe,
mas fora do compartilhamento".

As subtrações (lixeira, obsoleto, pendente de cadastro) são avaliadas
**antes** da concessão, pelo mesmo princípio de `hasAccess`: subtração vence
concessão.

O passo 2.b exige que a policy de `units` deixe a linha da SEDE legível
por qualquer contexto. A migração acrescenta `OR is_headquarters` ao
`USING` de `units`, e o `WITH CHECK` não muda. Saber qual unidade é a SEDE
e o nome dela não é conteúdo. Na visita a linha da origem já é visível
(`id = current_unit`); na transação própria, a da própria unidade também.

### D5: A pasta compartilhada inclui a subárvore, dinamicamente

A cobertura é avaliada **na consulta**, nunca materializada. Para um
arquivo, sobe-se `folder_id` e depois os `parent_id` com `WITH RECURSIVE`
sobre `folders`. Isso roda dentro da visita, onde as pastas da origem são
visíveis. O item fica coberto se o próprio item, ou qualquer ancestral, for
`resource_id` de um compartilhamento vigente do verbo. Consequências:

- O que entra depois na pasta passa a ser visível sem nenhuma ação.
- Mover um item para fora da pasta compartilhada retira o acesso na
  requisição seguinte.
- Excluir para a lixeira retira o acesso, e restaurar devolve.

A exceção à regra "sem herança" (US 4.1, cenário 2) fica **confinada a
`cross_unit_grants`**. Nenhum código de `grants` muda. O modal avisa
explicitamente, ao compartilhar pasta com outra unidade, que "todo o
conteúdo atual e futuro desta pasta será visível para o destino". É o
inverso do aviso de ausência de herança da concessão comum, e serve para o
administrador não publicar por engano o que guardar depois ali dentro.

A profundidade da árvore é limitada na prática (pastas aninhadas de um
acervo documental). O CTE usa os índices existentes em `folders (id)` e
`files (id)`, e não há varredura da unidade.

### D6: Navegação em visita: somente leitura, trilha a partir da raiz compartilhada

`GET /folders/:id/contents`, no caminho de visita:

- Exige `view` coberto sobre a pasta.
- Lista **todos** os filhos diretos da pasta, já que todos estão cobertos
  pela subárvore, menos os da lixeira, os obsoletos e os pendentes de
  cadastro.
- `breadcrumb`: só as pastas da cadeia que também estão cobertas, ou seja,
  da raiz compartilhada mais alta até a corrente. Os ancestrais acima da
  raiz não são nomeados, na mesma linha de `compartilhados-comigo` D7.
- `canUpload: false`, favoritos vazios e três campos novos:
  `readOnly: true`, `sharedFrom: { unitId, unitName }` e `canDownload`
  (veredito do verbo `download` sobre a pasta corrente, para a SPA não
  inferir permissão).
- A contagem de documentos da subárvore (requisito de `navegacao`) é
  calculada na visita com o mesmo filtro de subtração.

A SPA esconde, nesse modo, envio, nova pasta, renomear, mover, excluir,
permissões e favorito. O servidor recusaria de todo modo: essas rotas nunca
tentam o caminho de visita.

Rotas que **ganham** o caminho de visita: `POST /files/:id/view-url`,
`POST /files/:id/download-url` e `GET /folders/:id/contents`. Também o
detalhe de arquivo que o `PreviewModal` consulta, se existir rota própria;
a tarefa 3.4 levanta isso. Nenhuma outra.

### D7: Quem concede, o quê e para quem: validação de `POST /grants/cross-unit`

Corpo: `{ resourceType, resourceId, permissions: ('view'|'download')[],
subjectUnitId, subjectUserIds?: string[], expiresAt? }`.
`subjectUserIds` ausente ou vazio significa a unidade inteira.

1. Papel `unit_admin` ou `global_admin`. Senão, **403**.
2. Recurso vivo com `unit_id = ctx.unitId`, comparado explicitamente
   (trava do bypass): o administrador só compartilha o que alcança como
   admin. Se não houver, **404** sem distinguir, como `POST /grants`.
3. `subjectUnitId <> ctx.unitId` e unidade ativa. A origem ou o destino é
   a SEDE. Senão, **422 `cross_unit_destination_not_allowed`**.
4. Verbos só `view`/`download`, e prazo futuro (mesma validação de
   `POST /grants`). Senão, **400**.
5. Pessoas: todas ativas e todas da `subjectUnitId`. A verificação é feita
   numa leitura no contexto da unidade de destino, com o mesmo
   `withSharedVisitTransaction` usado de forma restrita (só `SELECT id FROM
   users WHERE id = ANY($1) AND status = 'active'`), comparando a
   cardinalidade como `POST /grants` (D3 daquele change: tudo ou nada, sem
   apontar qual falhou). Senão, **404**.
6. Teto de destinatários: reaproveita `config.grants.maxSubjects`.
   Acima dele, **413**.
7. `INSERT ... SELECT unnest × unnest ON CONFLICT DO UPDATE` com prazo e
   autor, mesma semântica de reconcessão de `POST /grants`.

> O uso da visita para validar destinatários (passo 5) e para listar
> destinatários (D8) é exceção ao "só `lib/cross-unit-share.ts` abre
> visita". Por isso essas duas funções moram **no mesmo módulo**, que
> continua sendo o único a chamar o método.

`GET /grants/cross-unit?resourceType&resourceId`: só admin da origem
(`unit_id = ctx.unitId`). Lista vigentes e vencidos, este marcados como
`expired`, com o nome da unidade de destino e da pessoa. Os nomes vêm de
uma leitura de visita na unidade de destino, só `full_name`.

`DELETE /grants/cross-unit/:id`: só admin da origem. Na recusa, 404.

### D8: Escolha de destino e de destinatários sem abrir diretório de outra unidade

- `GET /grants/cross-unit/destinations`: se a unidade do contexto é a
  SEDE, devolve as demais unidades **ativas** (id, nome); senão, devolve
  só a SEDE, ou lista vazia se não houver SEDE marcada. A SEDE enxerga as
  outras unidades por um contexto de sistema que projeta só `id, name`,
  pelo mesmo padrão `SYSTEM_CTX` dos jobs. Nome de unidade é metadado, não
  conteúdo, e o `global_admin` já os vê em `GET /units`.
- `GET /grants/cross-unit/recipients?unitId=`: só para um `unitId` que
  conste em `destinations`. Devolve as pessoas **ativas** da unidade com
  `id`, `fullName`, `jobTitle` e `sectorName`. Não traz e-mail, telefone
  nem observação. É a exposição mínima para escolher alguém pelo nome.
  Exige papel admin.

### D9: Auditoria na origem, com retrato de quem acessou

O evento é gravado **dentro da visita**: `unit_id = origem`, e o `WITH
CHECK` passa porque `current_unit = origem`. Ele aparece para o dono e o
admin da origem, como qualquer acesso ao arquivo. Já a consulta
`routes/audit.ts` faz `JOIN users`, e a RLS de `users` esconde a pessoa
visitante. **Esse evento sumiria da auditoria**. Correção:

- `audit_events` ganha `actor_name text` e `actor_unit_name text`, ambos
  anuláveis, preenchidos **só** em evento de visita. Os valores vêm da
  transação própria da pessoa (passo 1 de D4), onde a linha dela e a da
  unidade dela são visíveis.
- `routes/audit.ts` passa para `LEFT JOIN users` e
  `COALESCE(u.full_name, ae.actor_name)`. A resposta ganha
  `actor.unitName`, preenchido quando o evento veio de outra unidade.
  E-mail de pessoa de outra unidade não é exposto (`null`).

### D10: Correção da causa e destino das concessões sem efeito existentes

- `POST /grants` passa a carregar `unit_id` dos destinatários e a recusar
  com **422 `{ error: 'cross_unit_subject' }`** quando algum deles for de
  unidade diferente da do recurso. Para o `unit_admin` isso já resultava em
  404, porque a RLS escondia a pessoa. O código novo afeta, na prática, o
  `global_admin`, que é o caso da Ana. A SPA traduz o erro para "Esta
  pessoa é de outra unidade. Use 'Compartilhar com outra unidade'."
- Na migração 0026, a parte de dados roda com `SET LOCAL app.user_role =
  'global_admin'`, padrão de `0020_sectors.sql`:
  - concessões em `grants` com sujeito de outra unidade e verbo
    `view`/`download` são copiadas para `cross_unit_grants` por pessoa,
    com o mesmo prazo, autor e data, `subject_unit_id` = unidade atual da
    pessoa e `ON CONFLICT DO NOTHING`;
  - **todas** as concessões com sujeito de outra unidade são removidas de
    `grants`. Nunca tiveram efeito, e a tela as mostrava como se tivessem.
  - A cópia **não** valida a regra da SEDE, que ainda não está marcada no
    momento da migração. A regra é avaliada **na resolução** (D4, 2.b), não
    só na criação. As concessões copiadas ficam inertes até a SEDE ser
    marcada e passam a valer sozinhas se uma das pontas for ela. É o que
    devolve à Raíra o acesso que a Ana quis dar, sem retrabalho.

### D11: Marcação da SEDE

- `units.is_headquarters boolean NOT NULL DEFAULT false`, com índice único
  parcial `WHERE is_headquarters`: no máximo uma.
- `PATCH /units/:id` aceita `{ isHeadquarters: boolean }`, só para
  `global_admin` (já é o único que gere unidades). Marcar outra unidade
  enquanto existe uma SEDE resulta em **409 `headquarters_already_set`**.
  A troca é deliberada em dois passos (desmarcar e marcar), porque ela
  muda o alcance de todos os compartilhamentos.
- Desmarcar a SEDE, ou desativar uma unidade, **adormece** os
  compartilhamentos afetados, porque a regra é avaliada na resolução.
  Nada é apagado, e remarcar devolve o acesso.
- A SEDE não pode ser desativada enquanto estiver marcada (**409**), na
  mesma linha da proteção da unidade de bootstrap.

### D12: Compartilhados comigo

`GET /grants/received` ganha uma segunda origem de candidatos: os
compartilhamentos de `cross_unit_grants` endereçados à pessoa ou à unidade
dela, agrupados por recurso como os de `grants`. Para cada origem, uma
visita confirma o recurso (D4, passos a–c) e lê o detalhe, na mesma forma
de `readSharedFolders`/`readSharedFiles`. Para arquivo, isso inclui o
resumo de controle documental. O item ganha
`originUnit: { id, name } | null`, que fica `null` nos itens da própria
unidade. A SPA mostra a etiqueta "da unidade {nome}". Acionar a pasta abre
o explorador em `/pastas/:id`, que cai no caminho de visita (D6). Acionar o
arquivo abre o `PreviewModal` pelo `view-url` com visita.

Só a **raiz** compartilhada vira item. O conteúdo da subárvore é alcançado
navegando, e a lista não é inundada com cada arquivo da Governança.

### D13: Capability nova e deltas

`compartilhamento-entre-unidades` concentra o comportamento de servidor.
As capabilities existentes recebem só o recorte que lhes cabe (proposal,
"Capabilities"). Os testes de isolamento existentes não mudam. O arquivo
novo `compartilhamento-entre-unidades.test.ts` cobre a exceção, inclusive
os casos negativos: terceira unidade, fora da subárvore, verbo de escrita,
vencido, revogado, SEDE desmarcada, pessoa que mudou de unidade, obsoleto,
pendente e lixeira.

## Risks / Trade-offs

- **[Superfície nova de leitura cruzada]** A visita é o primeiro contexto
  em que uma pessoa lê linhas de outra unidade. *Mitigação:* o método só é
  chamado por um módulo, e um teste de arquitetura garante isso. A visita
  reconfirma o compartilhamento dentro da própria transação, a RLS confina
  à origem, e a lista negativa de testes de D13 cobre o resto.
- **[Publicação involuntária pela subárvore]** Tudo o que for guardado
  depois na pasta compartilhada fica visível ao destino. *Mitigação:*
  aviso explícito no modal e etiqueta na lista de compartilhamentos do
  recurso. O manual orienta usar pastas dedicadas ao compartilhamento.
- **[Custo por requisição negada]** Toda negação de `hasAccess` em
  view-url, download-url e contents passa a fazer uma consulta extra
  (candidatos), mais uma visita por origem candidata. *Mitigação:* para
  quem não é da SEDE há no máximo uma origem, e a consulta de candidatos
  usa índice por `(subject_unit_id, subject_user_id)`. Se não houver
  candidato, a visita nem é aberta.
- **[Diretório mínimo de outra unidade]** `recipients` expõe nome, cargo e
  setor das pessoas ativas da unidade de destino a administradores. Isso é
  aceito como necessário para a concessão por pessoa (decisão 1 da
  proposal) e é restrito a destinos permitidos.
- **[Retrato na auditoria]** `actor_name` congela o nome no momento do
  acesso. Um rename posterior não reflete. Isso é coerente com o propósito
  de registro.
- **[Remoção de linhas na migração]** As concessões sem efeito com verbos
  de escrita são removidas. *Mitigação:* elas nunca concederam nada. A
  tarefa 1.3 mede o volume em produção antes do deploy e registra os ids
  removidos no log da migração.

## Migration Plan

1. Deploy da migração 0026. É aditiva, exceto pela limpeza de `grants`
   (D10). Código antigo convive: ele ignora a tabela nova e as colunas
   novas.
2. Deploy da API e da SPA.
3. O Administrador Global marca a SEDE em Unidades. As concessões
   copiadas (o caso da Raíra) passam a valer nesse momento.
4. **Rollback:** reverter o código desliga o caminho de visita, e a
   tabela nova fica inerte. As linhas removidas de `grants` não voltam, mas
   também não tinham efeito.

## Open Questions

- O retrato `actor_unit_name` deve aparecer também na exportação da
  auditoria, se ela existir em algum relatório? Assume-se que sim, onde
  houver coluna de pessoa.
- Pedidos futuros de busca e de "recentes" sobre conteúdo compartilhado
  reaproveitam a visita, mas com custo maior (varredura). Cada um fica para
  um change próprio, com a medição em mãos.
