# Tasks

Pré-requisito: remote `fork` apontando para
`https://github.com/Inxell-Tecnologia/papelhub_fortesaude`, com `fork/main`
buscado. Trabalho na branch `claude/serene-clarke-gsadsc`.

## 1. Changes genéricos do fork (cherry-pick com `-x`)

- [x] 1.1 Cherry-pick de `f0bb052`, `feeda5e` e `fc07ae6` (change
  `edicao-email-pessoa`). Verificar: `git diff fork/main --` nos arquivos de
  `apps/`, `packages/shared/src/people.ts`, `docs/manual/docs/administrador/pessoas.md`
  e `openspec/specs/{gestao-pessoas,web-pessoas,auditoria-administrativa}` sem
  diferença; `grep -ri "forte" ` nesses arquivos sem resultado.
- [x] 1.2 Cherry-pick de `a344073`, `0029fe2`, `b354c75` e `3a44deb` (change
  `deploy-atualiza-jobs-agendados`). No `0029fe2`, descartar o hunk de
  `docs/runbook-implantacao.md` (reescrito em 4.x) e ajustar o de
  `infra/terraform/README.md` à versão daqui, sem nomes `papelhub-prod-*`.
  Verificar: `deploy.yml`, `cicd.tf`, `locals.tf` e `outputs.tf` só com
  diferença de comentário em relação a `fork/main`.

## 2. Infraestrutura — porte manual dos trechos genéricos (Terraform/GCP)

- [x] 2.1 `scheduler.tf`: `args` com `apps/api/dist/jobs/<job>.js` nos três Jobs
  agendados (de `ffbcbec` e `8691741`). Verificar: os três caminhos
  correspondem a arquivos em `apps/api/dist/jobs/` após `npm run build`, na
  mesma forma do `CMD` de `apps/api/Dockerfile`.
- [x] 2.2 `deletion_protection = false` em `migrate_job.tf`, `bootstrap_job.tf`
  e nos três Jobs de `scheduler.tf`. O serviço de `cloud_run.tf` fica sem a
  flag (de `7eb15e6` e `b99690d`). Verificar: `grep -c deletion_protection`
  igual a 5, nenhum em `cloud_run.tf`.
- [x] 2.3 `depends_on` na concessão `secretAccessor` da própria service account
  em cada Job agendado e nas duas concessões da API em `cloud_run.tf` (de
  `c79ca57` e `b99690d`). Verificar: `terraform validate`.
- [x] 2.4 `pubsub.tf`: `expiration_policy { ttl = "" }` na assinatura
  `storage_finalize` (de `b99690d`). Verificar: `terraform validate`.
- [x] 2.5 `deploy.yml`: `workflow_dispatch`, `TARGET_SHA` e o bypass do gate
  no disparo manual (de `01bb007`, se o 1.2 ainda não o trouxe). Verificar:
  nenhum `github.event.workflow_run.head_sha` fora da definição de
  `TARGET_SHA`.
- [x] 2.6 Reescrever os comentários portados sem referência a fork, Forte Saúde
  ou SHAs do fork (design.md D1). Verificar:
  `grep -rniE "forte|fork|fortesaude|implantacao-fortesaude" infra/ .github/`
  sem resultado novo.
- [x] 2.7 Conferir que `variables.tf` **não** mudou: `app_name`, `db_name` e
  `db_user` continuam `gdoc`/`gdoc_app`. Verificar:
  `git diff origin/main -- infra/terraform/variables.tf` vazio.
- [x] 2.8 `terraform fmt -check` e `terraform validate` em `infra/terraform`
  (com `-backend=false`).

## 3. Manual do usuário

- [x] 3.1 `docs/manual/mkdocs.yml`: só `markdown_extensions: [admonition]` (de
  `8e3a0fb`), sem palette `custom`, `extra_css`, logo ou `site_url` do fork.
  Verificar: `mkdocs build --strict` em `docs/manual` sem aviso, e
  `grep -rl '!!! ' site/` sem resultado.

## 4. Runbook genérico (`docs/runbook-implantacao.md`)

- [x] 4.1 Criar a partir de `fork/main:docs/runbook-implantacao.md`, com a tabela
  de valores em placeholders e os comandos com `$PROJECT_ID`, `$REGION` e
  `$NAME_PREFIX` (design.md D4). Verificar:
  `grep -niE "forte|fortesaude|inxell|papelhub-prod|495571187094|twj52netwq|admin@papelhub"`
  sem resultado.
- [x] 4.2 Manter a numeração das Armadilhas 1–10, porque o change arquivado
  `deploy-atualiza-jobs-agendados` cita a Armadilha 10. Reescrever a 10 como
  checklist de Job novo e as 7 e 9 sem relato datado do cliente. Verificar:
  cada armadilha tem sintoma, diagnóstico e correção.
- [x] 4.3 Seção "Próximo cliente" descrevendo o fork a partir deste repositório,
  sem link para `openspec/specs/implantacao-por-cliente/`. Verificar: todos os
  links relativos do runbook resolvem para arquivos existentes.
- [x] 4.4 Remeter ao runbook a partir de `infra/terraform/README.md` e acrescentar
  ao `CLAUDE.md` o checklist resumido de Job novo. Verificar: leitura do trecho.

## 5. Verificação de integração

- [x] 5.1 `npm run build` na raiz (shared → api → web).
- [x] 5.2 `npm run migrate --workspace apps/api` aplica a `0027` no Postgres local.
  Verificar: tabela com `unit_id` e policy RLS.
- [x] 5.3 `npm run lint`, `npm run test` e `npm run format:check`, todos verdes.
- [x] 5.4 Auditoria final de identidade:
  `git diff origin/main --stat -- apps/web/public apps/web/src/app/theme.ts apps/web/src/shell docs/manual/docs/assets docs/manual/docs/stylesheets apps/api/src/config.ts .env.example docs/manual/docs/index.md docs/manual/docs/a-tela.md docs/manual/docs/primeiro-acesso.md`
  vazio.
- [x] 5.5 `openspec validate correcoes-herdadas-do-fork --strict`.

## Workflow follow-up

- Checklist operacional do PR, antes do merge: `terraform plan` sem
  `destroy`/`replace` (a assinatura pode aparecer como `will be created`),
  `terraform apply`, e a variável `GCP_DEPLOY_UPDATED_JOBS` com
  `terraform output -raw deploy_updated_job_names`.
- Depois do deploy: executar `notify-expiring-grants` e `notify-readings` à mão;
  decidir conscientemente sobre o primeiro `trash-purge` (design.md, Riscos);
  se a assinatura foi recriada, rodar o backfill de `pending`.
- Arquivar com `/opsx:archive` (sincroniza `platform-infrastructure`,
  `documentacao-usuario` e cria `procedimento-implantacao`).
