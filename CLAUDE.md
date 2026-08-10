# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma e convenções

- **Toda saída do modelo (respostas, mensagens de commit, PRs, specs) é sempre em pt_BR.**
- Integrações (merge de PR) usam **merge commit — nunca squash.**
- Node **22** (`.nvmrc`); npm workspaces. `postinstall` na raiz compila `packages/shared` automaticamente.
- **Nome exibido do produto é `PapelHub`** (e `APP_CLIENT_NAME` por implantação); os identificadores internos permanecem `gdoc` (`@gdoc/*`, `gdoc_dev`/`gdoc_ci`, `name_prefix = "gdoc"` no Terraform) **por decisão** — renomear o `name_prefix` faria o Terraform destruir e recriar bucket, Cloud SQL e tópico Pub/Sub. Não "padronize" esses nomes.

## Manual do usuário: `docs/manual/`

A documentação voltada ao usuário final (colaborador, administrador de unidade,
administrador global) mora em `docs/manual/` — um site MkDocs (tema Material,
`docs/manual/docs/*.md`, navegação por perfil), publicado automaticamente no GitHub
Pages por `.github/workflows/docs.yml` quando um push na `main` toca
`docs/manual/**`. **Não existe mais** `docs/manual_do_usuario.md` — não recrie esse
arquivo. Continua valendo o padrão de atualizar a documentação **dentro do commit da
feature**: uma mudança visível na tela ajusta a página correspondente do manual, com
fidelidade à interface efetivamente entregue (capacidade só de backend, sem tela que
a acione, não é documentada como recurso do usuário). Ver
`openspec/specs/documentacao-usuario/` para os requisitos.

## Documento mestre: `docs/prd_final.md`

O PRD é a fonte da verdade do produto — define personas, escopo do MVP, épicos e os **critérios de aceite (Dado/Quando/Então) de cada história de usuário (US x.y)**. Todo change OpenSpec implementa um recorte do PRD, e as specs **referenciam a US** em vez de reescrever critérios. Ao planejar ou implementar qualquer feature de domínio, **leia a US relevante no PRD primeiro** — os cenários de erro e casos de borda ali são vinculantes, não sugestões. O código já contém comentários que citam a US e a decisão de design correspondente (ex.: `US 1.2, cenário 3; design.md Decisão D1`); mantenha esse rastro ao alterar.

## Fluxo de trabalho OpenSpec

O repositório é **spec-driven** (`openspec/config.yaml`). Cada épico/fatia vira um _change_ em `openspec/changes/` (proposal.md, design.md, specs/*/spec.md, tasks.md), é implementado, e depois arquivado em `openspec/changes/archive/` com as specs sincronizadas em `openspec/specs/`. Use os skills `opsx:*` (ou `openspec-*`) para propor, aplicar, verificar e arquivar. As specs arquivadas em `openspec/specs/` são o registro consolidado do comportamento atual — consulte-as para entender uma feature já entregue. Escreva proposals/specs em português, no estilo já existente.

## Comandos

```bash
# raiz (todos os workspaces via --if-present)
npm run lint            # eslint
npm run build           # tsc (shared → api → web)
npm run test            # vitest run em cada workspace
npm run format          # prettier --write .   (format:check é gate da CI)

# subir a app (dev)
npm run dev:api         # tsx watch, :8080   (= make dev-api)
npm run dev:web         # SPA Vite (proxy p/ a API na mesma origem)

# banco / storage (dev)
npm run migrate --workspace apps/api    # aplica migrations SQL numeradas
npm run seed --workspace apps/api       # popula dados de dev (idempotente)
npm run bootstrap --workspace apps/api  # provisiona o primeiro global_admin/unidade
npm run purge:trash --workspace apps/api      # job de expurgo da lixeira
npm run notify:grants --workspace apps/api    # job de aviso de permissões a vencer/vencidas
npm run backfill:pending --workspace apps/api # reconcilia uploads pendentes (finalize do Pub/Sub)

# se editar packages/shared/src, recompile para os consumidores enxergarem:
npm run build --workspace packages/shared

# um único teste (vitest) — mesma forma nos dois apps
npm run test --workspace apps/api -- src/__tests__/permission.test.ts
npm run test --workspace apps/api -- -t "nome do caso"
npm run test --workspace apps/web -- src/__tests__/<arquivo>.test.tsx
```

O `Makefile` é um atalho fino para os mesmos scripts (`dev`, `dev-api`, `dev-web`, `migrate`, `seed`) — `make dev` sobe só a API; a SPA é um segundo processo.

**Prettier:** `format:check` roda na CI, então formatação fora do padrão quebra o build. O escopo está em `.prettierignore`: código e configuração são formatados; a **prosa autoral fica de fora de propósito** — `openspec/` (o registro de specs, e `changes/archive/` é histórico imutável), `docs/` (PRD e derivados) e as skills/commands vendorizados em `.claude/`. Não formate esses diretórios "de passagem".

**Ambiente de dev:** o hook `.claude/hooks/session-start.sh` (SessionStart, só roda com `CLAUDE_CODE_REMOTE=true`) provisiona de forma idempotente o Postgres local (↔ Cloud SQL) e o `fake-gcs-server` (↔ Cloud Storage), migra e faz seed. Ele **não** sobe a app — isso é sob demanda. `.env` local espelha `.env.example`; em prod os valores vêm do Secret Manager.

## Arquitetura

Monorepo com três workspaces:

- **`apps/api`** — backend Express/TypeScript (ESM, `type: module`). É o **único guardião de permissão**: toda ação (visualizar, baixar, enviar, alterar, excluir) é validada no servidor a cada requisição.
- **`apps/web`** — SPA React (Vite, Ant Design, React Router, TanStack Query, Zod). Organizada por feature em pastas de topo em `src/` (`auth/`, `shell/`, `navegacao/`, `upload/`, `busca/`, `visualizacao/`, `pessoas/`, `unidades/`, `permissoes/`, `lixeira/`, `auditoria/`, `painel/`, `notificacoes/`, `conta/`). Nunca é a linha de defesa — só reflete o que a API autoriza.
- **`packages/shared`** — DTOs e enums (`UserRole`, `Permission`, `GrantResourceType`) compartilhados. **Consumido compilado de `dist/`**, não da fonte TS.

### Ports & Adapters (seams) — paridade dev↔prod

O código de negócio depende só das **interfaces** em `apps/api/src/ports/` (`StoragePort`, `DatabasePort`, `SecretsPort`, `AuthPort`, `NotificationPort`). As implementações vivem em `apps/api/src/adapters/`. **`ports/index.ts::createPorts()` é o único ponto que escolhe a implementação ativa** (via `config`), trocando GCS↔fake-gcs, Secret Manager↔env, etc. A paridade dev↔prod é mantida por esses seams — **nunca acople código de negócio direto a SDKs de nuvem**. Postgres é o mesmo em dev e prod.

Dois seams merecem nota por serem pontos de extensão já desenhados: `NotificationPort` tem hoje só a implementação in-app (`in-app-notification-port.ts`) e é **idempotente por `(recipientUserId, kind, sourceRef)`** — quem decide _quem_ e _quando_ avisar é a regra (rota de grants, job de avisos), nunca o adapter; um canal de e-mail entra como segunda implementação, sem tocar a regra. `PreviewConversionPort` é uma interface **reservada e não implementada** (conversão de Office→PDF via LibreOffice headless); PDF/imagem/vídeo/áudio usam preview nativo do browser e não passam por ela.

### Isolamento por unidade (multi-tenant) — o núcleo de segurança

Duas camadas, ambas obrigatórias:

1. **RLS no Postgres por coluna `unit_id`** (migration `0002_enable_rls.sql`) — a linha de defesa real. Toda query tenant-scoped roda dentro de `DatabasePort.withTenantTransaction(ctx, fn)`, que faz `SET LOCAL app.current_unit / app.user_role` **por transação** (nunca `SET` de sessão — seria vazado pelo connection pool). Tabela nova com dado de unidade **exige** coluna `unit_id` e policy RLS.
2. **Resolução de acesso na aplicação** — centralizada em `apps/api/src/lib/access.ts`. Regra única: **dono OU admin da unidade do recurso OU grant vigente do verbo exigido**, **sem herança** (grant numa pasta não libera o conteúdo interno), **fail-closed** (recurso inexistente ou de outra unidade → `false`, sem distinguir os casos). Vigência é avaliada no SQL (`expires_at IS NULL OR expires_at > now()`) pelo **relógio do Postgres**, nunca do processo Node — um grant expirado deixa de valer na requisição seguinte, sem depender de nenhum job.

`attachTenantContext` (middleware) relê `unit_id`/papel/status do banco a **cada** requisição a partir da sessão em cookie `HttpOnly` — nunca confia no token — para que desativar uma conta corte o acesso na hora (US 1.2 cenário 3).

**Trava do bypass de `global_admin`:** o bypass de RLS do admin global vale **só para agregados** (contagens/somas do painel). Rotas de **conteúdo** (bytes, listagem de itens, auditoria) sempre comparam `resource.unit_id === ctx.unitId` explicitamente antes de conceder pelo ramo admin — o admin global **nunca** é olho universal sobre bytes/auditoria de outra unidade. Não reabrir esse furo em rotas novas.

### Tráfego de bytes

Bytes **nunca** passam pela API. Fluxo: a rota checa permissão → emite **URL assinada de TTL curto** do bucket privado → o cliente faz PUT/GET direto no storage. `view-url` (~5 min) e `download-url` (~15–30 min) são **ações distintas, auditadas separadamente**.

O download de pasta não abre exceção a isso: `POST /folders/:id/download-manifest` percorre a subárvore **filtrando item a item pelo verbo `download`** e devolve um manifesto de URLs assinadas (com tetos de `config.downloadManifest`: 100 arquivos / 50 MB, → `download_manifest_limit_exceeded`), auditando um evento `download` por arquivo incluído; o `.zip` é montado **no cliente**, em streaming, por `apps/web/src/navegacao/zip-download.ts` (`client-zip`). Não introduza uma rota que zipe no servidor. Prefixo do objeto: `/{unit_id}/{owner_id}/{uuid}`. Acesso a arquivo por link direto sem permissão → `403` sem preview (é a rota da app que é protegida; o bucket é privado com uniform bucket-level access). Reconciliação de cota (10 GB/pessoa) vem de evento de finalize do GCS (Pub/Sub em prod; `POST /internal/storage-events` manual em dev).

### Rotas e camadas (`apps/api/src`)

`server.ts` → `app.ts` (monta os routers; rotas tenant-scoped passam por `attachTenantContext`) → `routes/*` (HTTP + validação) → `lib/*` (`access.ts`, `folder-tree.ts`, `search-filters.ts`, regras puras) → `ports/*` (seams). `db/migrations/*.sql` são numeradas e aplicadas em ordem por `db/migrate.ts`. Os jobs de `jobs/` rodam como Cloud Run Jobs + Scheduler em prod (`purge-trash` 03:00, retenção 30 dias; `notify-expiring-grants` 03:30 — ver `infra/terraform/scheduler.tf`) e por `npm run` em dev. Job novo = script em `package.json` **e** par job+scheduler no Terraform. Jobs usam um `TenantContext` de sistema com papel `global_admin` para a varredura cross-unit, mas cada escrita/notificação subsequente usa a unidade real do recurso — nunca o placeholder.

### SPA servida pela API (mesma origem) — invariante de prefixos

Em produção a própria API serve os estáticos da SPA e faz **fallback de `index.html`** para rotas de cliente, na **mesma origem** (sem domínio/CDN separado). Para que esse fallback não sombreie rotas de API inexistentes (ex.: `GET /files/rota-inexistente` deve ser `404` da API, nunca `index.html`), a lista `apps/api/src/lib/api-prefixes.ts` (`API_PREFIXES`) delimita o que é API. Ela **precisa ficar em sincronia com outras duas pontas** ao adicionar/remover um prefixo de rota de topo: `apps/web/vite.config.ts` (`API_PROXY_PREFIXES`, proxy de dev) e `infra/terraform/locals.tf` (`api_proxy_prefixes`, url-map). `/internal` (push do Pub/Sub) existe só na lista da API. Cobertura em `__tests__/web-serving.test.ts`.

### Testes

Vitest em ambos os apps. A API testa contra o Postgres real (`__tests__/test-db.ts`) e usa um `in-memory-storage-port` no lugar do GCS. Os testes de segurança/isolamento (`rls-isolation.test.ts`, `isolamento-unidade.test.ts`, `permission.test.ts`, `expiracao-permissoes-acesso.test.ts`, `web-serving.test.ts`) codificam os invariantes acima — trate-os como parte do contrato, não como testes descartáveis. Na CI o Postgres roda com um papel de app **não-superuser** (`gdoc_ci`, criado num passo separado) de propósito: superuser ignora RLS incondicionalmente e mascararia qualquer bug de isolamento. A web testa componentes com Testing Library + jsdom, mockando `fetch`/`XHR`.

### Produção (GCP)

IaC em `infra/terraform/` (Cloud Run para a API, Cloud SQL, Cloud Storage, Scheduler+Jobs, Secret Manager, Pub/Sub, bucket+CDN para a SPA). CI (`.github/workflows/ci.yml`) roda lint/build/test com Postgres de serviço; deploy (`deploy.yml`) builda a imagem da API e faz deploy no Cloud Run via Workload Identity Federation ao passar em `main`.
