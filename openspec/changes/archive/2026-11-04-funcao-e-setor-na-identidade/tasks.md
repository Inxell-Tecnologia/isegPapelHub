# Tasks

Ordem por dependência: contrato compartilhado → banco (tabela, isolamento,
backfill) → identidade na API → rotas de setor → cadastro de pessoa → SPA
(origem única da função, superfícies, formulário, manutenção da lista) →
paridade de dev → documentação → integração. Cada grupo entrega os **seus**
testes e a **sua** documentação.

**Há tarefa de infraestrutura:** `/sectors` é prefixo de rota de topo novo, logo
`API_PREFIXES`, `apps/web/vite.config.ts` e `infra/terraform/locals.tf` mudam
juntos (design.md D8). Nenhum job, scheduler, bucket ou segredo entra — nada
mais em `infra/terraform/`.

**Não há tarefa no hook de SessionStart:** ele já migra e semeia de forma
idempotente, e a migration nova é aplicada por ele sem alteração.

**Não há papel novo nem relação gestor↔equipe** — D3 do plano segue aberta
(design.md, Open Questions).

## 1. Contrato compartilhado (`packages/shared`)

- [x] 1.1 Acrescentar `jobTitle: string` e `sectorName: string` a `AuthenticatedIdentity`, documentando que ambos são vazios quando ausentes e que saem da releitura por requisição (design.md D5), e verificar `npm run build --workspace packages/shared` sem erro
- [x] 1.2 Criar `packages/shared/src/sectors.ts` com `SectorResponse` (`id`, `unitId`, `name`, `createdAt`, `peopleCount`), `CreateSectorRequest`, `UpdateSectorRequest` e os códigos de recusa literais `sector_name_in_use` e `sector_has_people`, exportá-los no índice do pacote, e verificar que cada campo `error` é tipo literal, não `string`
- [x] 1.3 Em `people.ts`, remover `workArea` de `CreatePersonRequest`/`UpdatePersonRequest`/`PersonResponse`, acrescentar `sectorId?: string | null` nas requisições (ausente = preserva, `null` = remove, id = vincula) e `sectorId: string | null` + `sectorName: string | null` na resposta, com o comentário explicando os três estados no molde de `storageQuotaBytes`, e verificar que `npm run build` na raiz aponta **todos** os consumidores de `workArea` que precisam mudar

## 2. Banco: tabela, isolamento e backfill (`apps/api/src/db`)

- [x] 2.1 Criar `0020_sectors.sql` com `SET LOCAL app.user_role = 'global_admin'`, `CREATE TABLE sectors` (`unit_id` + `UNIQUE (unit_id, id)`), índice único `(unit_id, lower(btrim(name)))`, `ENABLE`/`FORCE ROW LEVEL SECURITY` e policy `unit_isolation` no formato de `0002_enable_rls.sql`, comentando por que o bypass é necessário (design.md D4), e verificar `npm run migrate --workspace apps/api` aplicando sem erro
- [x] 2.2 Na mesma migration, acrescentar `users.sector_id` com a FK **composta** `(unit_id, sector_id) → sectors (unit_id, id)` (design.md D1), o backfill a partir de `work_area` (um setor por `(unit_id, lower(btrim(work_area)))`, preservando a grafia), o `UPDATE users SET sector_id`, o `DROP COLUMN work_area` e os `COMMENT ON`, e verificar por `\d users` que a coluna antiga saiu e a constraint entrou
- [x] 2.3 Teste de backfill em `apps/api/src/__tests__`: popular `work_area` com grafias repetidas e divergentes **antes** de migrar, aplicar a migration e conferir pessoa a pessoa que cada uma aponta para um setor da sua unidade com a grafia original, que pessoa sem área fica sem setor, e que grafias divergentes nasceram como setores distintos (spec `setores`, "A área de trabalho já cadastrada vira setor sem perda") — é este teste que prova que o bypass de D4 funcionou, já que a falha é silenciosa
- [x] 2.4 Casos novos em `rls-isolation.test.ts`: setor de outra unidade não é visto sob o contexto de tenant, e `UPDATE users SET sector_id` com setor de outra unidade é recusado **pelo banco** (FK composta), e verificar que rodam contra o papel não-superuser
- [x] 2.5 Medir se `0012_password_changed_at.sql` realmente atualizou linha alguma (design.md D4, nota) e registrar o achado em comentário no teste — **sem** editar aquela migration já aplicada

## 3. Identidade na API (`apps/api`)

- [x] 3.1 Acrescentar `jobTitle` e `sectorName` a `IdentityDisplay` e ao `SELECT` de `middleware/tenant-context.ts` (duas colunas e um `LEFT JOIN sectors`, sem round-trip novo), resolvendo ausência para vazio, e verificar que o `SELECT` continua único na requisição
- [x] 3.2 Repassar os dois campos em `routes/auth.ts`, no login (mesma leitura que autenticou) e em `GET /auth/me`, e verificar com teste que login e sessão corrente devolvem **a mesma forma** de identidade
- [x] 3.3 Teste em `apps/api/src/__tests__`: função e setor alterados no cadastro aparecem na consulta seguinte sem novo login; conta sem função e sem setor devolve os dois campos vazios, sem omitir campo (spec `autenticacao`, cenários novos)

## 4. Rotas de setor (`apps/api`)

- [x] 4.1 Criar `routes/sectors.ts` com `GET /sectors` (unidade do contexto; `?unitId=` honrado só para `global_admin`), `POST`, `PATCH /:id` e `DELETE /:id`, alcance por papel conforme spec `setores`, `409 sector_name_in_use` na violação de unicidade e `409 sector_has_people` na remoção com vínculos, montando o router em `app.ts` sob `attachTenantContext`
- [x] 4.2 Acrescentar `/sectors` às **três pontas** — `lib/api-prefixes.ts`, `apps/web/vite.config.ts` (`API_PROXY_PREFIXES`) e `infra/terraform/locals.tf` (`api_proxy_prefixes`) — e verificar `npm run test --workspace apps/api -- src/__tests__/web-serving.test.ts` passando, inclusive o caso de rota inexistente sob o prefixo novo devolvendo 404 da API
- [x] 4.3 Teste `apps/api/src/__tests__/setores.test.ts` cobrindo cada cenário da spec `setores`: unicidade por unidade sem caixa, mesmo nome em unidades diferentes, `collaborator` recusado nas três escritas, `unit_admin` fora da própria unidade recusado fail-closed, renomear preservando vínculos, remoção recusada com pessoas e concluída sem elas

## 5. Cadastro de pessoa (`apps/api`)

- [x] 5.1 Em `routes/users.ts`, trocar `work_area` por `sector_id` em `PERSON_COLUMNS`/`PersonRow`/`toPersonResponse` (resolvendo `sectorName` por `LEFT JOIN`), aceitar `sectorId` na criação e na edição com os três estados (ausente/`null`/id) e recusar fail-closed setor fora da unidade de destino, e verificar `npm run build` na raiz
- [x] 5.2 Teste em `people.test.ts`: cadastro com setor da unidade vincula e devolve o **nome**; setor de outra unidade recusa o cadastro e a edição **inteira**, sem aplicar nenhum outro campo enviado; edição sem o campo preserva o vínculo; edição com `null` remove (spec `gestao-pessoas`)

## 6. SPA: origem única da função e as superfícies de identidade (`apps/web`)

- [x] 6.1 Acrescentar `funcaoExibida(identity)` a `shell/identidade.ts` — `jobTitle` quando não vazio, `ROLE_LABEL[role]` quando vazio (design.md D6) — com teste unitário dos dois ramos
- [x] 6.2 `shell/CartaoDoUsuario.tsx` passa a exibir `funcaoExibida · unidade`, com o setor no texto íntegro (`title`/`aria-label`) e não na linha visível (design.md D7), atualizando o comentário de topo que hoje diz que a função "ainda não chega à identidade"
- [x] 6.3 `inicio/InicioPage.tsx` passa a exibir `funcaoExibida · setor · unidade`, omitindo o setor quando vazio, sem espaço reservado
- [x] 6.4 Testes de componente: pessoa com cargo lê o cargo e **não** o rótulo do papel nas duas superfícies; pessoa sem cargo lê o rótulo do papel com o mesmo texto de `ROLE_LABEL`; pessoa sem setor não produz separador solto na tela inicial — e estender `rotulo-de-papel.test.tsx` para cobrir que a recaída usa a origem única (spec `nomenclatura-interface`)

## 7. SPA: setor no formulário e manutenção da lista (`apps/web`)

- [x] 7.1 Criar `apps/web/src/setores/queries.ts` (`useSectors`, mutações de criar/renomear/remover, invalidando a listagem) e o schema Zod de `SectorResponse` em `lib/schemas.ts`, com `workArea` removido do schema de pessoa e `sectorId`/`sectorName` acrescentados
- [x] 7.2 `PessoaFormModal.tsx`: trocar o `Input` "Área de trabalho" pelo `Select` "Setor" (lista da unidade de destino, opção de deixar sem setor), repondo a lista e descartando a escolha quando o `global_admin` troca a unidade, e verificar em teste que nenhum vínculo cross-unit é enviado
- [x] 7.3 Painel de manutenção de setores acionado de `PessoasPage.tsx` (design.md D9): listar com contagem de pessoas, cadastrar, renomear e remover; `unit_admin` sem seletor de unidade, `global_admin` com seletor; `409 sector_has_people` apresentado como impedimento nomeado, nunca como falha genérica; `403` com o mesmo aviso neutro das demais operações de pessoas
- [x] 7.4 Testes de `pessoas.test.tsx` e um `setores.test.tsx` novo: setor é escolhido de lista e não digitado; setor recém-cadastrado aparece no formulário sem recarregar; remoção com pessoas mostra o impedimento e mantém a lista; a página segue barrada a `collaborator` pela guarda de rota

## 8. Paridade de dev

- [x] 8.1 Ajustar `apps/api/src/db/seed.ts` para semear setores por unidade e vincular as pessoas de dev, mantendo a idempotência, e verificar `npm run seed --workspace apps/api` duas vezes seguidas sem erro nem duplicata
- [x] 8.2 **Desvio, descoberto ao verificar 8.1:** as duas contagens de guarda do seed rodavam na conexão nua, sob FORCE RLS — devolviam zero num banco já semeado e o seed tentava recriar 'Unidade A', morrendo em `units_name_uidx`. `npm run seed` só funcionava na primeira vez, contrariando a idempotência que o hook promete. Guarda passou a rodar sob o mesmo bypass das escritas; verificado com duas execuções seguidas ("Seed skipped" nas duas)

## 9. Documentação

- [x] 9.1 Atualizar as páginas do manual (`docs/manual/docs/`) que descrevem o cadastro de colaborador e a tela inicial: "Área de trabalho" vira "Setor" escolhido de lista, a manutenção da lista é descrita onde ela está, e a linha abaixo da saudação passa a ser descrita como função/cargo — com fidelidade ao que esta fatia entrega, e verificar que a navegação do MkDocs não precisa de arquivo novo
- [x] 9.2 Atualizar `docs/prd_final.md`: US 1.1 cenário 1 (área de trabalho → setor por referência) e US 11.1 cenário 1 (função = cargo do cadastro, com o papel como recaída), preservando o formato Dado/Quando/Então
- [x] 9.3 Atualizar `docs/plano_demanda_cliente_2.md`: linha **A1** da tabela de status de `em andamento` para `entregue`, com o nome do change arquivado — as anotações de **D2**, **D3** e **D4** e o arquivo `docs/respostas_a1_funcao_e_setor.txt` já entraram no commit da proposta, então aqui só a linha da fatia muda

## 10. Integração

- [x] 10.1 `npm run lint`, `npm run build`, `npm run test` e `npm run format:check` na raiz, todos verdes — `format:check` é gate da CI, e `openspec/` e `docs/` ficam fora do Prettier de propósito
- [x] 10.2 Verificar na app em navegador, com dado de seed: conta com cargo preenchido lê o cargo na linha abaixo da saudação e no cartão do rodapé; conta sem cargo lê o rótulo do papel; setor aparece na tela inicial e some quando ausente; o formulário de pessoa oferece a lista; a manutenção de setores cadastra, renomeia e recusa remover setor em uso

## Workflow follow-up

- Rodar `/opsx:verify` e arquivar com `/opsx:archive` depois da revisão, sincronizando as specs em `openspec/specs/` (inclusive a nova capability `setores`).
