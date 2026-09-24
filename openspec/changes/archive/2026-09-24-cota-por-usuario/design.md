# Design

## Context

Ver `proposal.md` — Why para a motivação. O que importa aqui é o estado atual do
código:

- `config.storageQuotaBytesPerUser` é lido de `STORAGE_QUOTA_BYTES_PER_USER` e
  consultado **a cada requisição** em seis lugares: `GET /files/quota`, envio
  avulso, envio em lote/pasta, substituição pelo delta,
  `lib/storage-reconcile.ts` (finalize) e a capacidade agregada do painel.
- `users` tem `storage_used_bytes` (contador de consumo) e **nenhuma** coluna de
  cota. A tabela já tem `unit_id` e policy RLS.
- Quatro dos seis pontos já executam `SELECT storage_used_bytes FROM users WHERE
  id = $1` dentro da transação tenant-scoped; a reconciliação faz o mesmo por
  `file.owner_id`. Só o painel agrega.
- `PATCH /users/:id` já é o ponto de edição administrativa de pessoa: exige
  administração (`isAdmin`), roda em `withTenantTransaction` (RLS filtra as
  linhas visíveis antes do `WHERE id`) e chama `canActOnTarget` para impedir que
  um `unit_admin` alcance um `unit_admin`/`global_admin` da própria unidade.

Nada disso muda de forma; o que muda é a **origem do número** da cota.

## Goals / Non-Goals

**Goals:**

- Uma cota efetiva por pessoa, resolvida num único lugar do código, usada por
  todos os seis pontos sem duplicar a regra.
- Exceção nominal legível no dado: dá para listar todas as exceções vigentes com
  um `WHERE`.
- Nenhuma mudança de comportamento para quem não tem exceção.
- Nenhum alcance novo entre unidades.

**Non-Goals:**

- Cota por unidade ou por pasta — a cota continua sendo **pessoal**, como em
  US 8.1.
- Teto máximo para a exceção, expiração da exceção, ou fluxo de solicitação /
  aprovação. O `global_admin` concede e pronto.
- Reagir à mudança de cota sobre dados já existentes: elevar a cota não
  reclassifica arquivos marcados `over_quota`, e rebaixá-la não apaga nada.

## Decisions

### D1 — Coluna nullable em `users`, não tabela de exceções nem coluna `NOT NULL`

`users.storage_quota_bytes bigint NULL`, onde `NULL` significa literalmente
"segue o padrão da plataforma".

Alternativas descartadas:

- **`NOT NULL DEFAULT 10 GiB` com backfill.** Transformaria
  `STORAGE_QUOTA_BYTES_PER_USER` em decoração: mudar o padrão da plataforma
  passaria a exigir `UPDATE` em massa, e a variável de ambiente — que é o
  mecanismo de configuração por implantação do projeto inteiro — perderia
  efeito. Também apagaria a distinção entre "essa pessoa foi excepcionada em
  10 GB" e "essa pessoa nunca foi tocada".
- **Tabela `storage_quota_overrides` separada.** Um JOIN a mais em cinco
  caminhos quentes para modelar um atributo 1:1 de pessoa. Só valeria a pena se
  a exceção tivesse vigência, autor e histórico — que é justamente o que ficou
  fora de escopo. Se um dia entrar, a coluna vira `NULL` e a tabela assume, sem
  perda.

Sem backfill na migration: `NULL` já é o estado correto de todas as linhas
existentes. `ADD COLUMN` nullable sem default é instantâneo no Postgres, sem
reescrita de tabela — relevante porque a migration roda em produção antes da
troca de tráfego.

### D2 — Resolução da cota efetiva: em JS para a pessoa, em SQL para o agregado

A regra é uma só (`exceção quando houver, padrão da plataforma quando não`),
mas tem duas formas de avaliação conforme o ponto:

```
  pontos por pessoa (5)                    painel (1)
  ─────────────────────                    ──────────
  SELECT storage_used_bytes,               SELECT sum(
         storage_quota_bytes                 coalesce(storage_quota_bytes, $1)
  FROM users WHERE id = $1                 ) FROM users
         │                                        │
         ▼                                     $1 = padrão
  cotaEfetiva(row)  ──── mesma função ────────────┘
  em lib/quota.ts
```

Os cinco pontos por pessoa **já** leem a linha de `users` na transação; a coluna
entra na query existente e a resolução é uma função pura sobre o valor lido —
zero round-trip adicional. O painel precisa do `COALESCE` no SQL porque agrega,
e recebe o padrão **como parâmetro vindo do `config`**, nunca como `DEFAULT` da
coluna: o padrão mora na configuração da aplicação, e duplicá-lo no schema
criaria duas fontes da verdade que divergem no primeiro `terraform apply`.

A função vive em `apps/api/src/lib/` e é a única a conhecer a regra, no mesmo
espírito de `lib/access.ts` ser a única a conhecer a regra de acesso. Nenhuma
rota repete `COALESCE` ou `?? config...` por conta própria.

### D3 — Campo no `PATCH /users/:id` existente, com guarda própria de `global_admin`

Não uma rota dedicada. A rota atual já carrega tudo o que a concessão precisa —
sessão, contexto de tenant, RLS, `canActOnTarget` — e uma rota nova duplicaria
essa superfície de guarda só para carregar um inteiro.

A guarda extra é explícita e **fail-closed**: se o corpo trouxer o campo de cota
e o papel não for `global_admin`, a requisição inteira é recusada com `403`,
**sem aplicar os demais campos**. Ignorar o campo em silêncio e salvar o resto
seria mentir para quem chamou — o `unit_admin` veria sucesso e acreditaria ter
concedido a exceção.

Um `unit_admin` que não menciona o campo continua editando pessoas da sua
unidade exatamente como hoje.

### D4 — Nenhum alcance novo entre unidades

A concessão herda o alcance que `PATCH /users/:id` já tem: RLS filtra as linhas
visíveis, e `global_admin` gerencia pessoas de qualquer unidade porque
`gestao-pessoas` já exige isso. Este change **não abre porta nova** — em
particular, não toca em nenhuma rota de conteúdo (bytes, listagem, auditoria),
onde a trava documentada no `CLAUDE.md` continua valendo: o bypass de RLS do
admin global vale só para agregados.

A cota de outra pessoa continua **não sendo consultável** por ela: `GET
/files/quota` deriva a identidade da sessão e não aceita parâmetro de pessoa.
A cota alheia só aparece onde a gestão de pessoas já aparece.

### D5 — Rebaixar a cota abaixo do uso atual é permitido

Sem bloqueio no servidor. Congelar uma conta de propósito é uso legítimo, e um
bloqueio exigiria um parâmetro de força que ninguém pediu.

O risco de fazê-lo **sem querer** é mitigado na borda, não na regra: o consumo
atual (`storage_used_bytes`) passa a constar da representação de pessoa e é
exibido ao lado do campo. A administração vê "usa 180 GB" enquanto digita
"50 GB".

Consequência aceita e documentada: a pessoa nesse estado não envia, não
substitui (nem por arquivo menor — a checagem é
`uso − antigo + novo > cota`), e só volta a caber excluindo **e** esvaziando a
lixeira, porque a retenção segura os bytes por 30 dias.

### D6 — Sem auditoria da concessão, por ora

`audit_events` tem `file_id uuid NOT NULL REFERENCES files (id)` e `action`
restrito a verbos de arquivo: é um log **de arquivo**, não de administração. Uma
mudança de cota não cabe ali sem alargar a tabela, o que contaminaria a
auditoria de arquivos — a capacidade que o produto vende — com eventos de outra
natureza.

Há precedente forte: `PATCH /users/:id` hoje não audita **nada**, nem troca de
papel nem desativação de conta, que são ações tão privilegiadas quanto esta.
Auditar cota isoladamente criaria uma inconsistência pior que a ausência.

Fica registrado como dívida: o log administrativo (`admin_events` ou
equivalente) é um change próprio, que cobre cota, papel e status de uma vez.

### D7 — Bytes na API, GB na tela

O campo trafega em **bytes**, como todo o domínio de armazenamento do sistema
(`size_bytes`, `storage_used_bytes`, `quotaBytes` da consulta de espaço). A
conversão para GB acontece na SPA, na borda, junto do restante da formatação.
Aceitar GB na API criaria um segundo sistema de unidades no mesmo contrato.

### D8 — `null` explícito remove a exceção

O corpo do `PATCH` distingue três intenções, e a distinção é significativa:

| Corpo | Significado |
| --- | --- |
| campo ausente | não mexe na cota |
| `null` | remove a exceção — volta ao padrão da plataforma |
| inteiro ≥ 0 | define a exceção nominal |

Zero é aceito e significa "nenhum envio novo", coerente com D5. Valores
negativos e não inteiros são recusados na validação.

### D9 — A restauração do padrão a 10 GiB entra neste change

O padrão de 10 GB é **premissa** desta feature: a proposta inteira existe para
evitar o afrouxamento coletivo. Deixar 322122547200 armado em
`infra/terraform/variables.tf` e em `config.ts` enquanto se entrega a exceção
nominal seria contraditório, e o próximo `terraform apply` — feito por qualquer
motivo, por qualquer pessoa — elevaria todos a 300 GB sem que ninguém tivesse
decidido isso.

Por isso a restauração é parte do mesmo commit, e não um PR separado "de
limpeza" que pode não acontecer. Junto vem `docs/custos-gcp/`, cujo README
determina revisão ao alterar a cota.

## Risks / Trade-offs

- **Exceção concedida é eterna e silenciosa** (sem auditoria por D6, sem
  expiração por Non-Goals) → o dado é autodescritivo: `SELECT email FROM users
  WHERE storage_quota_bytes IS NOT NULL` lista todas as exceções a qualquer
  momento. Diferente de um grant, que expira sozinho, a cota exige revisão
  humana — registrado como dívida junto do log administrativo.
- **Rebaixamento acidental congela a pessoa** → consumo exibido ao lado do campo
  (D5); e o estado é reversível a qualquer momento elevando a cota de volta, sem
  perda de dado.
- **Custo de infraestrutura deixa de ter freio uniforme** → é exatamente o
  objetivo, mas concentrar a concessão no `global_admin` (D3) mantém a decisão
  de gasto num único papel, em vez de distribuí-la por unidade.
- **Arquivos marcados `over_quota` não voltam a `active`** quando a cota sobe →
  comportamento pré-existente, não introduzido aqui. Continuam listados,
  visíveis e baixáveis; só ficam fora dos agregados do painel. Correção
  pertence ao change de reconciliação já mapeado em `proposal.md` — Fora de
  escopo.
- **A capacidade do painel muda de significado** → com exceções nominais, a soma
  das cotas efetivas pode ser muito maior que `10 GB × pessoas`, e o percentual
  de uso cai. É a leitura correta, mas quem acompanha o número verá um degrau na
  série no dia da concessão.

## Migration Plan

1. `0015_user_storage_quota.sql` — `ALTER TABLE users ADD COLUMN
   storage_quota_bytes bigint`. Sem default, sem backfill, sem lock relevante.
   O pipeline de deploy já roda o job de migração **antes** de trocar o tráfego,
   então a revisão nova nunca sobe contra schema antigo.
2. Deploy da imagem com a resolução da cota efetiva e o campo no `PATCH`.
3. `terraform apply` para devolver `STORAGE_QUOTA_BYTES_PER_USER` a
   `10737418240` no serviço do Cloud Run — necessário porque o valor efetivo em
   produção vem da variável gravada no serviço, não do default do código, e o
   pipeline de deploy só troca a imagem.
4. O `global_admin` concede a exceção nominal pela tela de pessoas.

**Rollback.** A coluna é nullable e ignorada pela versão anterior do código:
voltar a imagem antiga funciona sem desfazer a migration, e as exceções já
gravadas ficam inertes até a imagem nova voltar. Rollback de dado, se for o
caso, é `UPDATE users SET storage_quota_bytes = NULL`.

**Ordem que importa.** Se a restauração do padrão a 10 GiB (passo 3) acontecesse
**antes** dos passos 1–2 num cenário em que a cota global já estivesse elevada,
qualquer pessoa acima de 10 GB ficaria congelada sem ter como receber exceção.
Na implantação atual isso não ocorre — o serviço nunca chegou a receber os
300 GB —, mas a ordem acima é a única segura caso o estado de produção mude
antes da implantação.

## Open Questions

- **Teto máximo para uma exceção.** Hoje o `global_admin` concede qualquer
  valor. Um limite superior (rejeitar acima de X TB como provável erro de
  digitação) pode entrar depois sem mexer em specs nem em tarefas.
- **Revisão periódica das exceções.** Se a lista crescer, um aviso de "exceção
  concedida há mais de N meses" cabe no `NotificationPort` existente — decisão
  que depende de ver o uso real primeiro.
