# PapelHub

Repositório documental corporativo com governança de acesso — permissões
granulares, isolamento por unidade, auditoria e lixeira com retenção. Ver
`docs/prd_final.md` para o produto completo.

O nome exibido (`PapelHub`) e a identificação do cliente na tela de
login/shell (`APP_CLIENT_NAME`, ver `.env.example`) são configuráveis por
implantação — ver `openspec/specs/identidade-visual/` (capability entregue
pela change arquivada em
`openspec/changes/archive/2026-08-05-rebranding-doc7-setes/` e atualizada
pela change `rebranding-papelhub`).
Identificadores internos de código e infraestrutura (`@gdoc/*`,
`gdoc_dev`/`gdoc_ci`, `name_prefix = "gdoc"` no Terraform) permanecem
inalterados por decisão — trocar `name_prefix` faria o Terraform destruir e
recriar bucket, Cloud SQL e tópico Pub/Sub (design.md D5 dessa change).

Este README cobre a **fundação de infraestrutura** (mudança
`bootstrap-infrastructure`, arquivada em `openspec/changes/archive/`) —
monorepo, seams de aplicação, ambiente de desenvolvimento e a prova de que os
trilhos funcionam.
As features do PRD são entregues por épico/fatia como changes OpenSpec já
arquivados em `openspec/changes/archive/` (backend dos épicos 1–9 e as fatias
da SPA web); ver `openspec/specs/` para o comportamento consolidado.

## Estrutura

```
apps/api/            # backend Node/TS — único guardião de permissão
apps/web/            # SPA React (Vite + Ant Design) — reflete o que a API autoriza
packages/shared/     # tipos/contratos compartilhados
infra/terraform/      # IaC de produção (GCP)
.github/workflows/    # CI (lint/build/test) e deploy (build+push+Cloud Run)
scripts/              # utilitários de dev (ex.: gerar chave dummy de assinatura)
.claude/hooks/         # SessionStart hook: provisiona o ambiente de dev
```

`packages/shared` é consumido compilado (`dist/`), não pela fonte TS
diretamente — um `postinstall` na raiz builda automaticamente logo após
`npm install`/`npm ci`. Se editar `packages/shared/src`, rode
`npm run build --workspace packages/shared` (ou reinstale) para que a
mudança apareça para quem consome (`apps/api`, testes, Docker).

## Ambiente de desenvolvimento (Claude Code web/sandbox)

O `SessionStart` hook (`.claude/hooks/session-start.sh`) provisiona, de forma
idempotente, o equivalente dev dos recursos de produção:

- **Postgres local** (`pg_ctlcluster`) ↔ Cloud SQL em prod
- **fake-gcs-server** ↔ Cloud Storage em prod (mesmo protocolo JSON do GCS)
- Chave de assinatura dummy (`.dev/fake-gcs-signer-key.json`, gerada localmente,
  nunca usada em produção)

Ele roda automaticamente ao abrir uma sessão. Para rodar manualmente:

```bash
CLAUDE_CODE_REMOTE=true ./.claude/hooks/session-start.sh
```

Depois, para subir a API:

```bash
make dev-api
# ou: npm run dev --workspace apps/api
```

E, opcionalmente, a SPA (Vite, proxy para a API na mesma origem — ver
`apps/web/vite.config.ts`):

```bash
npm run dev:web
# ou: npm run dev --workspace apps/web
```

## Testes e lint

```bash
npm run lint
npm run build
npm run test
```

## Prova de fundação ponta a ponta (manual)

Com a API rodando em `:8080`, o fluxo abaixo exercita GCS (via emulador) e
Postgres (RLS + auditoria) de ponta a ponta. A identidade vem de uma **sessão
em cookie `HttpOnly`** (`POST /auth/login`) — o `curl` guarda o cookie num
_cookie jar_ (`-c`/`-b cookies.txt`) e o reenvia nas chamadas seguintes. Use
as credenciais de um usuário existente; o seed de dev cria alguns (ver
`apps/api/src/db/seed.ts`), incluindo o admin global de bootstrap
(`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`, padrões em
`apps/api/src/config.ts`).

```bash
# 1. Saúde
curl http://127.0.0.1:8080/health

# 2. Login — grava a sessão em cookies.txt
curl -X POST http://127.0.0.1:8080/auth/login -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.global@gdoc.dev","password":"dev-password-only"}'
# -> { id, unitId, role }

# 3. Pedir URL de upload (checa cota, cria o registro do arquivo)
curl -X POST http://127.0.0.1:8080/files/upload-url -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"fileName":"teste.txt","contentType":"text/plain","declaredSizeBytes":5}'
# -> { uploadUrl, objectPath, expiresAt }

# 4. Enviar os bytes de verdade
curl -X PUT "<uploadUrl>" -H "Content-Type: text/plain" --data-binary "olar"

# 5. Reconciliar cota (em prod: push subscription do Pub/Sub; em dev: manual)
#    Rota interna, sem sessão (não passa pelo attachTenantContext).
curl -X POST http://127.0.0.1:8080/internal/storage-events \
  -H "Content-Type: application/json" \
  -d '{"objectPath":"<objectPath>","sizeBytes":5}'

# 6. Pedir URL de visualização/download (checa permissão via RLS, grava auditoria)
curl -X POST http://127.0.0.1:8080/files/<FILE_ID>/view-url -b cookies.txt
curl -X POST http://127.0.0.1:8080/files/<FILE_ID>/download-url -b cookies.txt
```

Logado como usuário de outra unidade, `view-url`/`download-url` sobre esse
arquivo retornam `403` sem nenhuma URL emitida nem auditoria gravada
(isolamento por RLS, fail-closed).

## Expurgo da lixeira (manual, em dev)

Em prod, o Cloud Scheduler dispara o Cloud Run Job diariamente às 03:00 (ver
`infra/terraform/scheduler.tf`). Em dev, sem Scheduler, o mesmo job roda por
`npm run` — mesmo padrão manual de `internal/storage-events` acima:

```bash
npm run purge:trash --workspace apps/api
```

Apaga permanentemente os itens na lixeira há mais de `TRASH_RETENTION_DAYS`
dias (padrão 30 — `apps/api/src/config.ts`): remove os bytes no storage,
devolve a cota ao dono e apaga as linhas de metadados (arquivos, pastas,
grants órfãos e a auditoria dos arquivos expurgados). Tolerante a falha por
item — reentra no próximo ciclo. Ver `apps/api/src/jobs/purge-trash.ts` e
design.md D6-D10 do change `epico-6-lixeira-retencao`.

**Limitação conhecida do emulador:** o `fake-gcs-server` não aplica validação
de assinatura em leituras (um `GET` direto sem assinatura também retorna
`200`). Isso é uma característica de emuladores de GCS — eles emulam a
superfície da API, não o modelo de autorização do Google. A garantia de
"bucket privado, sem acesso direto" depende da configuração real do bucket em
produção (uniform bucket-level access, sem binding público) e só é
verificável contra o GCS real, após o Terraform ser aplicado.

## Manual do usuário (`docs/manual/`)

O manual do usuário é um site [MkDocs](https://www.mkdocs.org/) (tema Material,
`docs/manual/docs/*.md`), publicado no GitHub Pages em
<https://carlossalesnaturaltec.github.io/gdoc/>. Para buildar e servir localmente
(requer Python 3):

```bash
pip install -r docs/manual/requirements.txt
mkdocs serve -f docs/manual/mkdocs.yml
```

`.github/workflows/docs.yml` builda o site (`--strict`, link quebrado reprova o
build) em todo push/PR que toque `docs/manual/**`, e publica apenas em push na
`main`. **Passo manual, uma vez:** o GitHub Pages precisa estar habilitado em
Settings → Pages com origem **GitHub Actions** — sem isso o job de publicação falha.

## Produção (GCP)

IaC em `infra/terraform/` (ver o README dessa pasta para como aplicar e as
decisões de arquitetura).

## CI/CD

`.github/workflows/ci.yml` roda lint/build/test em todo push/PR (com um
Postgres real como serviço). `.github/workflows/deploy.yml` builda a imagem
da API (`apps/api/Dockerfile`), publica no Artifact Registry e faz deploy no
Cloud Run quando o CI passa em `main` — autenticado por Workload Identity
Federation, sem chave de service account (ver `infra/terraform/cicd.tf` e o
README de `infra/terraform/` para as variáveis do repositório necessárias).
