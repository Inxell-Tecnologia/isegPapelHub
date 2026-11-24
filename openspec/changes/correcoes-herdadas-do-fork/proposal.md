# Proposal

## Why

O fork por cliente `Inxell-Tecnologia/PapelHub_ForteSaude` foi o primeiro a
provisionar um projeto GCP vazio a partir deste repositório. Nesse
provisionamento apareceram defeitos que **também existem aqui**, e o fork os
corrigiu dentro de changes próprios do cliente (`implantacao-fortesaude`,
`deploy-atualiza-jobs-agendados`):

- **Os três Jobs agendados apontam para um módulo que não existe na imagem.**
  O Dockerfile usa `WORKDIR /app` e copia o build para `/app/apps/api/dist`,
  mas `scheduler.tf` executa `node dist/jobs/<job>.js`. O expurgo da lixeira
  (03:00), os avisos de permissão (03:30) e os de leitura obrigatória (03:45)
  falham com "Cannot find module" toda noite, sem nenhum erro visível ao
  usuário.
- **A assinatura push do Pub/Sub é apagada após 31 dias sem upload** (padrão
  do GCP quando não há `expiration_policy`). Sem ela, o evento de finalize é
  descartado e todo upload novo fica preso em `pending`, também sem erro
  visível.
- **Criar um Cloud Run Job concorre com a concessão de acesso ao secret** da
  sua própria service account (`Permission denied on secret`). Com o default
  `deletion_protection = true` do provider 6.x, o `create` que falha deixa um
  impasse: o recurso fica `tainted` e o `destroy` é recusado.
- **O deploy não tem disparo manual.** Se o evento `workflow_run` se perde (no
  fork, workflows desabilitados no momento do push), a implantação fica presa
  sem saída.
- **As caixas de aviso do manual (`!!! note`, `!!! warning`) aparecem como
  texto literal**, porque a extensão `admonition` do MkDocs nunca foi
  habilitada. São 34 caixas em 13 páginas.

Além disso, o fork produziu um **runbook de implantação em fases**, com as
armadilhas encontradas. Hoje esse conhecimento só existe com os valores do
Forte Saúde. O próximo cliente forka *este* repositório, então o procedimento
precisa estar aqui, em versão neutra.

## What Changes

Integração seletiva do fork. Vêm só as correções e funcionalidades genéricas;
a identidade visual e os valores da implantação do cliente ficam no fork.

- **Jobs agendados:** `args` com o caminho relativo ao `WORKDIR` da imagem
  (`apps/api/dist/jobs/...`), `deletion_protection = false` em todos os Cloud
  Run Jobs (migração, bootstrap e os três agendados) e `depends_on` explícito
  na concessão `secretAccessor` da service account de cada um.
- **Serviço da API:** `depends_on` explícito nas concessões de secret da
  service account. `deletion_protection` permanece no default `true`, por
  decisão.
- **Pub/Sub:** `expiration_policy { ttl = "" }` na assinatura de finalize.
- **Deploy:** gatilho `workflow_dispatch` que ignora o gate "sem efeito em
  produção", e `TARGET_SHA` como fonte única do commit implantado.
- **Manual:** `markdown_extensions: [admonition]` no `mkdocs.yml`.
- **Runbook:** novo `docs/runbook-implantacao.md`, versão genérica (com
  placeholders) do runbook do fork: seis fases, procedimento de atualização de
  uma implantação no ar, armadilhas, erros de ambiente, "Não mexer" e "Próximo
  cliente".
- **Trazidos do fork pelo histórico, sem redecisão** (changes já arquivados lá,
  sem nada do cliente):
  - `edicao-email-pessoa`: troca de e-mail na edição de pessoa, registro
    administrativo e migration `0027_admin_events.sql`;
  - `deploy-atualiza-jobs-agendados`: cada deploy alinha a imagem dos Jobs à
    do serviço; a lista de Jobs tem origem única em `locals.tf`.

**Fora de escopo (permanece no fork):** logos, imagens, favicon, paleta
(`theme.ts`, `marca.css`, palette `custom` do mkdocs), textos "Forte Saúde" no
manual, `APP_CLIENT_NAME`, `CANONICAL_MANUAL_URL`/`site_url`, URL do Cloud Run
no `index.md`, `tfvars`/`backend.hcl`, a spec `implantacao-por-cliente` e,
sobretudo, a mudança dos defaults de `app_name`/`db_name`/`db_user` para
`papelhub*`. Aqui essa mudança destruiria e recriaria bucket, Cloud SQL e
Pub/Sub.

## Capabilities

### New Capabilities

- `procedimento-implantacao`: procedimento versionado, sem valores de cliente,
  que leva um projeto de nuvem vazio até o primeiro acesso do administrador
  global, e que orienta a atualização de uma implantação no ar.

### Modified Capabilities

- `platform-infrastructure`: os Jobs agendados executam o módulo presente na
  imagem; a criação de recursos de runtime fica ordenada após a concessão de
  secret, e os Jobs não ficam travados por proteção de exclusão; a assinatura
  de finalize não expira; a implantação pode ser disparada manualmente.
- `documentacao-usuario`: as caixas de aviso do manual são renderizadas como
  destaque, nunca como texto literal.

As specs de `gestao-pessoas`, `web-pessoas`, `auditoria-administrativa` e os três
requisitos de `platform-infrastructure` sobre jobs no deploy chegam já
sincronizados pelos commits de arquivamento do fork. Não há delta deles aqui.

## Impact

- **Terraform** (`scheduler.tf`, `migrate_job.tf`, `bootstrap_job.tf`,
  `cloud_run.tf`, `pubsub.tf`, `cicd.tf`, `locals.tf`, `outputs.tf`,
  `README.md`): o `apply` esperado só faz atualização no lugar e adições
  (`expiration_policy`, `deletion_protection`, IAM do pipeline sobre os Jobs).
  Nenhum `destroy`/`replace`. Se a assinatura já tiver expirado em produção, o
  plan mostra `will be created`.
- **GitHub Actions:** `deploy.yml` passa a exigir a variável de repositório
  `GCP_DEPLOY_UPDATED_JOBS`. Sem ela, o deploy falha de propósito.
- **Banco:** migration `0027_admin_events.sql` (tabela nova com `unit_id` e
  RLS).
- **API/Web/shared:** `routes/users.ts`, `PessoaFormModal.tsx`,
  `shared/src/people.ts` e testes.
- **Docs:** `mkdocs.yml`, `administrador/pessoas.md`, novo
  `docs/runbook-implantacao.md` e uma linha no `CLAUDE.md` (checklist de Job
  novo).
