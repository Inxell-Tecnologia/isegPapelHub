# Design

## Context

Ver proposal.md — Why. O que molda o desenho é o estado do código, conferido em
2026-11-04:

- `users.job_title` e `users.work_area` existem desde `0003_people_fields.sql`,
  trafegam em `CreatePersonRequest`/`UpdatePersonRequest`/`PersonResponse` e são
  editados em `PessoaFormModal.tsx` ("Função/cargo" e "Área de trabalho"). Os
  dois são **texto livre sem validação**.
- `AuthenticatedIdentity` (`packages/shared/src/auth.ts`) carrega só `id`,
  `unitId`, `role`, `fullName`, `unitName`. `fullName`/`unitName` entraram pela
  change `shell-e-inicio` (design.md D3) resolvidos na **releitura por
  requisição** de `attachTenantContext` — nunca do token. Esse é o invariante em
  que função e setor têm de entrar.
- A linha abaixo da saudação é `apps/web/src/inicio/InicioPage.tsx:69`
  (`ROLE_LABEL[identity.role] · unitName`) e o cartão do rodapé é
  `shell/CartaoDoUsuario.tsx` (`papel · unidade`). `ROLE_LABEL`
  (`shell/role-label.ts`) é **origem única** por exigência de
  `nomenclatura-interface`, depois de já ter estado triplicado uma vez.
- Tabela com dado de unidade exige coluna `unit_id` **e** policy RLS
  (`CLAUDE.md`); `0002_enable_rls.sql` usa `FORCE ROW LEVEL SECURITY` porque o
  papel da aplicação é dono das tabelas.
- O prefixo de rota de topo vive em três pontas que precisam ficar em
  sincronia: `apps/api/src/lib/api-prefixes.ts`, `apps/web/vite.config.ts` e
  `infra/terraform/locals.tf` (cobertura em `__tests__/web-serving.test.ts`).

## Goals / Non-Goals

**Goals:**

- Setor como entidade por unidade, com o isolamento imposto **pelo banco** e não
  só pela aplicação — é dado tenant novo, e é aí que a regra do projeto morde.
- Função e setor chegando à interface pela **mesma** releitura por requisição
  que já governa nome e unidade, sem rota nova e sem round-trip extra.
- Uma única origem para a regra "função, e papel quando não houver função", para
  que o cartão do rodapé e a tela inicial não divirjam.
- Lista de setores mantida pela administração desde o primeiro dia — lista
  fechada sem manutenção é regressão diante do texto livre que ela substitui.

**Non-Goals:**

- Nenhum papel novo, nenhuma relação gestor↔equipe (D3 do plano segue aberta
  pelo conflito de nomenclatura — ver Open Questions).
- Nenhum consumo do setor como critério: público por setor (C1) e relatório por
  setor (C4) só leem este dado depois.
- Nada de acento-insensibilidade nem fusão automática de grafias (ver D3).
- "Minha conta" segue exibindo o papel de acesso (proposal.md — Fora de escopo).

## Decisions

### D1 — Vínculo pessoa→setor sob chave estrangeira **composta**

`sectors (id, unit_id, name, created_at)` com `UNIQUE (unit_id, id)`, e em
`users`:

```sql
ALTER TABLE users
  ADD COLUMN sector_id uuid,
  ADD CONSTRAINT users_sector_same_unit_fk
    FOREIGN KEY (unit_id, sector_id) REFERENCES sectors (unit_id, id);
```

A FK composta faz o **banco** recusar pessoa apontando para setor de outra
unidade. `sector_id` nulo não é checado (`MATCH SIMPLE`), que é exatamente o
comportamento desejado: "sem setor" é estado válido.

*Alternativa descartada:* FK simples `sector_id → sectors(id)` + checagem na
rota. Funciona enquanto toda escrita passar pela rota, e é a classe de defesa
que o projeto deliberadamente não aceita sozinha para dado de unidade — a RLS
existe pela mesma razão. Custo da composta: uma constraint de unicidade
redundante em `sectors`; ganho: o furo deixa de depender de disciplina.

### D2 — `work_area` é **removida**, não mantida em paralelo

A migração cria os setores a partir dela, aponta cada pessoa e então
`DROP COLUMN work_area`.

*Alternativa descartada:* manter a coluna inerte (o padrão aditivo que
`0018_awaiting_registration.sql` defende). Ali a coluna nova era aditiva e
reverter o código a deixava inofensiva. Aqui é o oposto: a coluna **antiga**
seria um segundo lugar onde o mesmo conceito mora, sem escritor e sem leitor —
e a próxima pessoa a mexer em `routes/users.ts` a reencontra em
`PERSON_COLUMNS`. O cliente afirmou que são o mesmo conceito (resposta 6 (a)),
e duas fontes para um dado é precisamente o que torna o critério de público
inútil.

Nenhum dado se perde: a grafia original de cada valor vira o **nome** de um
setor, e o vínculo substitui a cópia por pessoa. O caminho de volta está em
Migration Plan.

### D3 — Unicidade por unidade sem caixa, **sem** acento-insensibilidade

```sql
CREATE UNIQUE INDEX sectors_unit_name_key ON sectors (unit_id, lower(btrim(name)));
```

Impede "CME" e "cme " de coexistirem na mesma unidade, sem extensão nova.

**Deliberadamente não** normaliza acento. "Governança" e "governanca" seriam
fundidas por `unaccent`, mas "Governança" e "Gov." não — e é esse o par que o
acervo real tem. Fusão correta exige julgamento humano: a lista oficial de cada
unidade (pergunta 7, ainda não respondida) aplicada por **renomeação** pela
administração. Fundir por heurística dentro da migração é decidir em nome do
cliente, com o dado original já descartado.

### D4 — O backfill da migration roda sob contexto de bypass explícito

A primeira linha de `0020_sectors.sql` é

```sql
SET LOCAL app.user_role = 'global_admin';
```

`FORCE ROW LEVEL SECURITY` vale **para o dono da tabela**, e o dono é o papel da
aplicação (`gdoc_dev`/`gdoc_ci`, não-superuser de propósito). Sem
`app.current_unit`/`app.user_role` definidos, `current_setting(..., true)`
devolve `NULL`, a policy `unit_isolation` não é satisfeita e um `INSERT`/`UPDATE`
na migração atinge **zero linhas, sem erro**. `db/migrate.ts` envolve cada
arquivo em `BEGIN`/`COMMIT`, então `SET LOCAL` tem exatamente o alcance da
migration — é o mesmo mecanismo de bypass que `attachTenantContext` já usa, não
um caminho especial.

> Precedente a conferir, não a corrigir: `0012_password_changed_at.sql` faz
> `UPDATE users SET password_changed_at = created_at` sem esse contexto, e muito
> provavelmente não atualizou linha alguma — o `DEFAULT now()` da própria coluna
> cobriu o caso, e por isso nada quebrou. Vale medir durante a implementação
> (tasks), **sem** editar aquela migration já aplicada.

Uma tarefa de teste cobre o backfill com dado pré-existente: é o único jeito de
a tabela provar que o bypass funcionou, já que a falha é silenciosa.

> **Terceira ocorrência da mesma armadilha, encontrada durante a implementação.**
> As duas contagens de guarda de `db/seed.ts` rodavam na conexão nua: num banco
> já semeado devolviam **zero**, o seed concluía "não há admin, o banco está
> vazio" e morria em `units_name_uidx` ao recriar 'Unidade A'. Ou seja,
> `npm run seed` só funcionava na primeira vez — contrariando a idempotência
> que o hook de SessionStart promete. Corrigido nesta change (as guardas passam
> a rodar sob o mesmo bypass das escritas), porque esta fatia acrescenta linhas
> ao seed e dependia dessa promessa para a homologação. Fica o padrão: sob
> FORCE RLS, consulta sem contexto não erra — **mente**.

### D5 — A identidade carrega o **nome** do setor, não o seu identificador

`AuthenticatedIdentity` ganha `jobTitle: string` e `sectorName: string` (vazio
quando ausente, como `fullName`), resolvidos no `LEFT JOIN` acrescentado à
consulta que `attachTenantContext` já faz — duas colunas, nenhum round-trip
novo. `IdentityDisplay` acompanha, porque é lá que vive o dado de apresentação,
separado de `TenantContext` (que é contexto de isolamento e não é lugar de dado
de tela).

Sem `sectorId` na identidade: ele não tem consumidor hoje. Quando C1 precisar do
setor como critério, quem decide é o servidor, a partir do contexto — não um id
que a SPA devolve. Contrato mínimo agora é mais fácil de ampliar do que de
encolher.

### D6 — A recaída função→papel tem **uma** origem

`shell/identidade.ts` ganha `funcaoExibida(identity): string`, que devolve
`jobTitle` quando não vazio e `ROLE_LABEL[role]` quando vazio. Cartão do rodapé
e tela inicial consomem essa função.

É exigência de spec, não preferência: `nomenclatura-interface` proíbe divergência
de rótulo de papel entre telas porque o mapa já esteve triplicado. Duas recaídas
implementadas em paralelo são o mesmo defeito com outro nome.

### D7 — Composição das linhas: setor entra na tela inicial, não no cartão de 264 px

- **Tela inicial:** `função · setor · unidade`, omitindo o setor quando ausente.
- **Cartão do rodapé:** `função · unidade`, com o setor **no texto íntegro**
  (`title`/`aria-label`), que já existe ali.

A largura de 264 px foi medida na change `menu-lateral-e-barra-superior`: a
segunda linha do cartão já trunca com dois termos ao lado do avatar. Um terceiro
termo não acrescenta informação — acrescenta elipse. A demanda pede o setor na
**linha abaixo da saudação** (seção 1.3), e é lá que ele fica visível.

### D8 — `/sectors` como prefixo de topo, com a unidade vinda do **contexto**

`GET /sectors` lista os setores da unidade do contexto; `?unitId=` é honrado
**apenas** para `global_admin`. `POST /sectors`, `PATCH /sectors/:id` e
`DELETE /sectors/:id` seguem o alcance de `setores`.

*Alternativa descartada:* `/units/:unitId/sectors`, que expressaria a posse no
endereço e não exigiria tocar as três pontas de prefixo. Perde no que importa: a
unidade passaria a vir do **cliente**, convidando a forjá-la, quando o idioma de
tenancy do projeto é derivá-la do contexto relido por requisição. Acrescentar um
prefixo é operação conhecida e coberta por `web-serving.test.ts`; afrouxar a
origem da unidade não é.

### D9 — A manutenção da lista mora na página de pessoas, sem item de menu novo

Painel lateral (`Drawer`) acionado da página `/admin/pessoas`, que já é
restrita a `unit_admin`/`global_admin` pela guarda de rota. `unit_admin` opera a
própria unidade sem seletor; `global_admin` escolhe a unidade.

*Alternativas descartadas:* (a) tela própria com item de navegação — o menu
acabou de ser redesenhado na A2 e já tem quatro itens esperando fatia; um item
de topo para uma lista administrativa pouco visitada é ruído; (b) dentro da
gestão de unidades — ela é exclusiva de `global_admin`, e a resposta 2 (b) do
cliente coloca a pessoa de referência de cada unidade como administradora dela,
que é justamente quem precisa manter os setores da sua.

Setor classifica **pessoas**, então a manutenção perto da listagem de pessoas é
onde quem cadastra já está.

### D10 — "Sem setor" continua válido, e a lista nasce do acervo

A lista oficial (pergunta 7) não chegou. Tornar o setor obrigatório agora
travaria todo cadastro novo até ela chegar. A lista inicial é a do acervo
(resposta 6 (a): *"podem aproveitar o que já está cadastrado"*), e renomear +
remover cobre a padronização quando a lista de Ana chegar — sem migration nova.

## Risks / Trade-offs

- **Tabela nova sem policy RLS é furo de isolamento, não detalhe** → policy no
  mesmo formato de `0002_enable_rls.sql` **na mesma migration**, mais caso em
  `rls-isolation.test.ts` provando que setor de outra unidade não é visto nem
  vinculável. A FK composta é a segunda camada.
- **Backfill que falha em silêncio** (D4) → teste que popula `work_area` antes
  de migrar e confere pessoa a pessoa. Sem teste, uma migração que não fez nada
  passa como se tivesse feito.
- **`DROP COLUMN` com imagem antiga da API** → reverter só a imagem deixaria
  `routes/users.ts` consultando `work_area` inexistente (erro 500 na gestão de
  pessoas). Migration e imagem sobem juntas; o caminho de volta está no
  Migration Plan e é completo, porque a grafia original ficou nos nomes dos
  setores.
- **Grafias divergentes nascem como setores distintos** (D3) → aceito, e é a
  escolha certa: o relatório e o público por setor só existem na Fase 2, de modo
  que há tempo de padronizar por renomeação antes de o dado ser usado como
  critério. O risco oposto — fundir por heurística — é perda silenciosa.
- **Função é texto livre e agora aparece com destaque** → uma função digitada
  como "Gestor" em uma conta `collaborator` passa a ser lida como se fosse
  papel. É consequência direta da resposta 1 (a), não defeito do desenho: o
  cliente foi avisado de que função não altera permissão. A spec de
  `nomenclatura-interface` registra que função não é rótulo de papel.
- **Pessoa não muda de unidade hoje** → se algum dia mudar, `sector_id` tem de
  ser zerado no mesmo passo, ou a FK composta recusa o `UPDATE`. A recusa é o
  comportamento seguro; fica anotado para quem implementar a mudança de unidade.

## Migration Plan

1. `0020_sectors.sql`, em uma transação (o runner garante):
   `SET LOCAL app.user_role = 'global_admin'` → `CREATE TABLE sectors` (com
   `unit_id`, `UNIQUE (unit_id, id)`, índice único por `(unit_id, lower(btrim(name)))`)
   → `ENABLE`/`FORCE ROW LEVEL SECURITY` + policy `unit_isolation` no formato de
   `0002` → `users.sector_id` + FK composta → `INSERT` de um setor por
   `(unit_id, lower(btrim(work_area)))` distinto, preservando a grafia de uma
   das ocorrências → `UPDATE users SET sector_id = ...` casando pelo mesmo
   critério → `DROP COLUMN work_area` → `COMMENT ON` em `sectors` e
   `users.sector_id` registrando que setor é critério de público da Fase 2.
2. `npm run migrate` em dev, `npm run seed` ajustado para semear setores
   plausíveis (o seed é idempotente e é o que dá dado à homologação).
3. Deploy: imagem da API e migration no mesmo passo — o contrato de
   `PersonResponse` muda nas duas pontas.
4. **Rollback completo, se necessário:** recriar `work_area text` e repovoar com
   `UPDATE users u SET work_area = s.name FROM sectors s WHERE s.id = u.sector_id`,
   então derrubar a FK, `users.sector_id` e `sectors`. Nada é irrecuperável
   porque os nomes dos setores são as grafias originais.

## Open Questions

- **Lista oficial de setores por unidade (pergunta 7).** O cliente vai enviá-la
  com Ana, "do jeito que deve aparecer na tela". Não muda spec, desenho nem
  tarefas: entra por renomeação e cadastro na superfície que esta fatia entrega.
- **Colisão de nome em "Gestor" (D3 do plano).** As respostas 3 (b) e 4 (b)
  definem o alcance (setor para coordenador/gerente, unidade para o diretor) e
  que é papel distinto de quem administra — mas "Gestor" já é o rótulo de
  `unit_admin`. Um dos dois tem de ser renomeado antes de C1/C3 existirem. Não
  afeta esta fatia, que não cria papel algum.
- **Quem administra cada unidade (resposta 2 (b)).** Os nomes vieram ocultados
  (`[NOME – UNIDADE]`). É operação de cadastro, a executar quando o cliente
  informar — nada a implementar.
