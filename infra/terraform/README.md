# infra/terraform — fundação de produção (GCP)

IaC da mudança `bootstrap-infrastructure` (ver
`openspec/changes/archive/2026-07-16-bootstrap-infrastructure/design.md` para
o porquê de cada decisão). Provisiona os trilhos de produção — nenhuma feature
do PRD.

Recursos provisionados: Cloud Run (API), Cloud SQL (Postgres), Cloud Storage
(bucket privado de arquivos + bucket público do SPA com CDN), Secret
Manager, Artifact Registry, Pub/Sub (reconciliação de cota) e Cloud
Scheduler → Cloud Run Job (expurgo diário da lixeira, 03:00).

**Aplicado** contra o projeto real `gdoc-502613` (ambiente de
desenvolvimento com `gcloud`/Terraform configurados) — 53 recursos criados,
0 destruídos. Escrito e revisado originalmente num ambiente sandbox sem
projeto GCP nem credenciais, onde só `terraform validate`/`fmt` rodavam;
`plan`/`apply` aconteceram depois, num ambiente com acesso real ao projeto
(ver `openspec/changes/archive/2026-07-16-bootstrap-infrastructure/tasks.md`, seção 8, para os
três ajustes que só a API real revelou). A API ainda sobe com a imagem
placeholder pública até o CI/CD publicar a imagem real — ver "Uso" abaixo.

## Pré-requisitos

- Um projeto GCP existente, com billing habilitado.
- `gcloud` autenticado (`gcloud auth application-default login`) com
  permissão de Editor/Owner (ou papéis equivalentes) no projeto.
- Terraform >= 1.7.

## Bootstrap (uma vez por projeto)

O estado remoto precisa de um bucket que já exista antes do `terraform init`
— o Terraform não pode criar o bucket em que vai guardar o próprio estado.

```bash
PROJECT_ID="gdoc-prod-123456"   # ajustar
gcloud config set project "$PROJECT_ID"

# A localização do bucket de state é INDEPENDENTE de var.region (o state são
# KBs, custo irrelevante) e não é gerenciada por este Terraform. O bucket de
# state do projeto de produção permanece em `southamerica-east1` por decisão
# (design.md D5 do change migra-infra-us-central1): movê-lo exigiria recriar
# bucket + copiar objetos + editar backend.hcl + `init -migrate-state` durante
# a operação mais destrutiva do projeto, sem retorno. Só os recursos regionais
# do app é que migraram para `us-central1`.
gsutil mb -l southamerica-east1 "gs://${PROJECT_ID}-terraform-state"
gsutil versioning set on "gs://${PROJECT_ID}-terraform-state"
```

Depois, copie os exemplos e preencha:

```bash
cp backend.hcl.example backend.hcl        # aponta para o bucket acima
cp terraform.tfvars.example terraform.tfvars
# editar os dois com os valores reais do projeto
```

## Uso

```bash
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Depois do primeiro `apply`, a API sobe com uma imagem placeholder pública
(`us-docker.pkg.dev/cloudrun/container/hello`) — o Cloud Run existe, mas
ainda não roda o código do GDoc. O CI/CD (`.github/workflows/deploy.yml`)
publica a imagem real no Artifact Registry criado aqui e faz o deploy; o
lifecycle `ignore_changes` no `cloud_run.tf` garante que um `terraform apply`
seguinte não reverta esse deploy.

## CI/CD (GitHub Actions)

> ⚠️ Em repositório novo (ex.: transferido/importado para uma organização),
> o GitHub Actions costuma vir **desabilitado por padrão** — os workflows
> ficam listados como `active`, mas nenhum evento (`push`/`pull_request`)
> dispara execução alguma, sem nenhum erro visível. Confira **Settings →
> Actions → General → "Actions permissions"** no repositório e, se a
> organização também restringir, nas configurações de Actions da própria
> organização.

Depois do `apply`, configure as variáveis do repositório GitHub (Settings →
Secrets and variables → Actions → _Variables_ — não são segredos: acesso é
controlado pela condição do WIF + IAM, não por elas serem secretas) com os
outputs deste Terraform:

| Variável do repositório          | Valor (`terraform output ...`)                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | `var.project_id` (o mesmo de `terraform.tfvars`)                                                                                                      |
| `GCP_REGION`                     | `var.region`                                                                                                                                          |
| `GCP_ARTIFACT_REPOSITORY`        | `artifact_registry_repository`                                                                                                                        |
| `GCP_CLOUD_RUN_SERVICE`          | nome do serviço (`google_cloud_run_v2_service.api.name`, também visível prefixado em `api_url`)                                                       |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `github_actions_workload_identity_provider`                                                                                                           |
| `GCP_DEPLOYER_SERVICE_ACCOUNT`   | `github_actions_deployer_service_account`                                                                                                             |
| `GCP_MIGRATE_JOB`                | `migrate_job_name` — nome do Cloud Run Job de migração (change `deploy-migrations-e-docs-only`), executado pelo pipeline antes do `gcloud run deploy` |

Sem chave de service account em lugar nenhum — `cicd.tf` provisiona um
Workload Identity Pool que só aceita tokens OIDC do repositório configurado
em `github_repository` (`CarlosSalesNaturalTec/GDoc` por padrão).

Os bindings de IAM do deployer (`cicd.tf`) são **por recurso** (privilégio
mínimo): `roles/artifactregistry.writer` no repositório de imagens,
`roles/run.developer` **no serviço da API** e `roles/iam.serviceAccountUser` na
service account de runtime da API. Como o pipeline também atualiza e executa o
**Job de migração** (`${local.name_prefix}-migrate`) e um Job é um recurso
distinto do serviço, o deployer recebe `roles/run.developer` **também no Job de
migração** (`deployer_run_developer_migrate_job`) — sem isso o passo "Update
migration job image" do deploy falha com `PERMISSION_DENIED` em `run.jobs.get` e
tanto a migração quanto o `deploy` são pulados. O act-as não precisa de binding
novo: o Job reusa a mesma service account de runtime da API, já coberta pelo
`serviceAccountUser` acima.

## Bootstrap do administrador global

Depois do `apply` (que cria o Job `${local.name_prefix}-bootstrap` e o secret
container `${local.name_prefix}-bootstrap-admin-password`) e de o CI/CD ter
publicado a imagem real da API, inicialize o primeiro `global_admin` — **não**
existe outro caminho seguro para criar essa conta em produção; o seed de
desenvolvimento (`npm run seed`) se recusa a rodar quando `NODE_ENV=production`
(ver `openspec/changes/archive/2026-07-22-bootstrap-admin-producao/design.md`).

```bash
PROJECT_ID="gdoc-prod-123456"   # ajustar
ENVIRONMENT="prod"
NAME_PREFIX="gdoc-${ENVIRONMENT}"

# 1. Cria a versão do secret com a senha real do administrador (só o
#    container é gerenciado pelo Terraform — a senha nunca fica no state).
echo -n "SUA-SENHA-FORTE-AQUI" | gcloud secrets versions add \
  "${NAME_PREFIX}-bootstrap-admin-password" --data-file=- --project="$PROJECT_ID"

# 2. Confirma/ajusta o e-mail (variável bootstrap_admin_email em
#    terraform.tfvars) e reaplica se tiver mudado.
terraform apply

# 3. Executa o Job uma vez — aplica migrações pendentes e cria só o
#    administrador global (idempotente: reexecutar depois é no-op).
gcloud run jobs execute "${NAME_PREFIX}-bootstrap" \
  --project="$PROJECT_ID" --region="$REGION" --wait
```

> ⚠️ **No Windows/PowerShell, NÃO use o `echo -n` acima.** `echo` é alias de
> `Write-Output` e `-n` casa com `-NoEnumerate` — não suprime a quebra de
> linha. Pior: ao encanar (`|`) para um executável nativo, o PowerShell anexa
> `\r\r\n`. O secret fica com a senha + 3 bytes invisíveis, o bootstrap grava
> o hash desse valor sujo e **todo login legítimo vira 401**, sem nenhum erro
> que aponte a causa. Grave byte-exato via arquivo:
>
> ```powershell
> $pw = "$env:TEMP\pw.bin"
> [System.IO.File]::WriteAllText($pw, "SUA-SENHA-FORTE-AQUI", (New-Object System.Text.UTF8Encoding($false)))
> gcloud secrets versions add "$NAME_PREFIX-bootstrap-admin-password" --data-file="$pw" --project="$PROJECT_ID"
> Remove-Item $pw
> ```
>
> Conferir sempre o que ficou gravado (deve ser exatamente o nº de caracteres
> da senha, sem `0D`/`0A` no fim):
>
> ```powershell
> cmd /c "gcloud secrets versions access latest --secret=$NAME_PREFIX-bootstrap-admin-password --project=$PROJECT_ID > `"$env:TEMP\s.bin`""
> [System.IO.File]::ReadAllBytes("$env:TEMP\s.bin").Length
> ```
>
> **Se o admin já foi criado com a senha suja**, corrigir o secret não basta: o
> `bootstrapAdmin()` é no-op quando já existe um `global_admin`
> (`apps/api/src/db/bootstrap.ts`), então ele não reescreve o hash. É preciso
> remover o admin (`DELETE FROM users WHERE role='global_admin'`, dentro de uma
> transação com `SELECT set_config('app.user_role','global_admin',true)` para
> passar pela RLS) e reexecutar o Job.

Depois de logar com essa conta na URL de produção, cadastre as pessoas reais
pela tela **Pessoas** e, se este projeto já teve um `npm run seed` rodado
antes desta mudança existir, exclua/desative pela mesma tela as eventuais
contas de demonstração (`colaborador.a@gdoc.dev`, `admin.a@gdoc.dev`,
`colaborador.b@gdoc.dev`) — a trava de produção no seed impede que elas sejam
recriadas, mas não remove o que já foi criado antes dela existir.

## Decisões que valem conhecer antes de mexer

- **Região ativa `us-central1` na fase de testes, por custo (change
  `migra-infra-us-central1`).** Todos os recursos regionais (Cloud Run, Cloud
  SQL, buckets, Artifact Registry, Scheduler/Jobs, NEG) nascem de `var.region`
  — fonte única, sem região literal em nenhum `.tf`. A região saiu de
  `southamerica-east1` para `us-central1` (~20-35% mais barato) porque a app
  está em fase de testes, sem dados reais. **Trade-off:** usuários no Brasil ↔
  Iowa somam ~140-180 ms de RTT em toda requisição e no tráfego direto de bytes
  com o bucket. **Gatilho de retorno:** reavaliar/voltar para uma região
  próxima dos usuários ANTES de operar com carga real sensível a latência —
  fazê-lo com dados reais é um change de migração de verdade (export/import do
  Postgres + rsync do bucket + janela), pois recursos regionais do GCP têm
  região imutável (destruir e recriar). A anotação canônica fica adjacente à
  `var.region` em `variables.tf`, onde qualquer troca futura vai esbarrar nela;
  mesmo padrão do PITR abaixo. **O bucket de state permanece em
  `southamerica-east1`** por decisão (D5 do change; ver seção "Bootstrap").
  Trocar a região reconcilia três pontas derivadas da URL do Cloud Run (CORS do
  bucket de arquivos, audience OIDC do push do Pub/Sub e a variável `GCP_REGION`
  do CI/CD) e reexecuta o bootstrap do administrador global — ver
  `openspec/changes/archive/*-migra-infra-us-central1/`.
- **Cloud SQL com IP público, sem `authorized_networks`.** A API se conecta
  via integração nativa do Cloud Run (Cloud SQL Auth Proxy gerenciado,
  autenticado por IAM) — nenhuma rota de rede é liberada para ninguém. Evita
  o custo/complexidade de um conector Serverless VPC Access ou private
  service access só para o MVP. Ver `cloud_sql.tf`.
- **Assinatura de URL sem chave exportada.** Em prod, a service account do
  Cloud Run assina URLs v4 via IAM Credentials API (`signBlob`), não com uma
  chave de arquivo (que só existe em dev, gerada localmente pelo
  SessionStart hook). Por isso `STORAGE_SIGNER_KEY_PATH` não é setada no
  Cloud Run — ver `cloud_run.tf` (`google_service_account_iam_member.api_self_sign`)
  e `apps/api/src/adapters/gcs-storage-port.ts`.
- **Frontend sem domínio ainda.** `apps/web` já existe (change
  `web-shell-e-auth`), mas o bucket+CDN seguem sem tráfego real: o balanceador
  de carga e o certificado gerenciado só são criados quando `frontend_domain`
  é definido (o Google exige um domínio real para emitir o certificado). Ver
  `variables.tf`/`frontend.tf`.
- **Mesma origem SPA+API é pré-requisito de deploy do frontend.** O cookie de
  sessão é `HttpOnly`/`SameSite=Strict` e a API não tem CORS (ver
  `apps/api/src/lib/session-cookie.ts`), então a SPA só funciona em produção
  se o `path_matcher` do `google_compute_url_map.frontend` (`frontend.tf`)
  estiver ativo: ele roteia os prefixos de `local.api_proxy_prefixes`
  (`locals.tf`) para o serverless NEG da Cloud Run
  (`google_compute_backend_service.api`) e tudo o mais para o bucket+CDN da
  SPA. Essa lista de prefixos espelha `apps/web/vite.config.ts`
  (`API_PROXY_PREFIXES`, usado pelo proxy do servidor de dev) — mantenha as
  duas em sincronia ao adicionar uma rota nova. Design completo em
  `openspec/changes/archive/2026-07-20-web-shell-e-auth/design.md` (decisões D1/D2).
- **CORS do bucket de arquivos precisa da origem do SPA em produção.** O upload
  (`put-object.ts`) e a visualização/download fazem `PUT`/`GET` cross-origin
  direto na URL assinada do bucket, com `Content-Type` — o que dispara um
  preflight `OPTIONS`. O bucket só responde `Access-Control-Allow-Origin` se a
  origem do SPA constar em `cors_allowed_origins` (`variables.tf` → `storage.tf`).
  Como em produção a SPA é servida pela própria API no Cloud Run (mesma origem),
  essa origem é a **URL do serviço Cloud Run da API**, definida em
  `terraform.tfvars`. Enquanto não houver domínio custom (`frontend_domain`), o
  Cloud Run expõe **duas** formas de URL (`-hash-<região>.a.run.app` e
  `-<nº-projeto>.<região>.run.app`) e o `Origin` enviado é aquele por onde o SPA
  foi aberto — **ambas** precisam estar na lista, senão o upload falha ("Falha
  no envio." + erro de CORS no console) quando aberto pela forma ausente. O
  default em `variables.tf` traz só `http://localhost:5173` (dev) de propósito,
  para não versionar URL de ambiente. **Hotfix de produção sem esperar o apply:**
  aplique o CORS direto no bucket com
  `gcloud storage buckets update gs://<files_bucket_name> --cors-file=cors.json`
  (o `terraform apply` seguinte reconcilia e volta a ser a fonte da verdade — sem
  ele, o próximo apply reverteria o CORS para o default de dev).
- **Autenticação do endpoint de reconciliação (fechado pelo change
  `corrige-finalize-pubsub-status-pending`).** O `POST /internal/storage-events`
  recebe o push do Pub/Sub autenticado por OIDC, e o Cloud Run exige
  `roles/run.invoker` — **mas** o mesmo Cloud Run também concede
  `allUsers:run.invoker` (a API precisa ser pública para o SPA), então o IAM do
  Cloud Run não restringe esse endpoint: qualquer um poderia chamá-lo. Por isso a
  **aplicação** valida o JWT OIDC do Pub/Sub (assinatura pelas chaves do Google +
  `aud` esperado + e-mail da SA emissora) em `apps/api/src/routes/storage-events.ts`.
  A validação é ligada definindo `pubsub_push_audience` em `terraform.tfvars`
  (= `<api_url>/internal/storage-events`), que injeta `PUBSUB_OIDC_VALIDATION=true`,
  `PUBSUB_PUSH_AUDIENCE` e `PUBSUB_PUSH_SA_EMAIL` no serviço; vazio (dev) mantém a
  validação desligada. **Ordem de deploy:** publicar a imagem da API com o fix
  ANTES de aplicar o Terraform que liga a validação, senão pushes válidos viram
  401 até o código novo subir.
- **`db-f1-micro`** é o tier mais barato disponível — adequado para MVP,
  revisar (`db_tier`) antes de qualquer carga de produção real.
- **PITR do Cloud SQL desligado na fase MVP (change `desativa-pitr-cloud-sql-mvp`).**
  `backup_configuration.enabled = true` (backups diários, `03:00`,
  `retainedBackups = 7`) permanece sempre ligado — é a durabilidade mínima e
  nunca deve ser desligado em produção. Já `point_in_time_recovery_enabled`
  está `false` nesta fase para cortar o custo do arquivamento contínuo de WAL
  no Cloud Storage; o RPO efetivo degrada para ~24h (último backup diário) em
  vez de "qualquer instante". **Gatilho de reativação:** voltar a flag para
  `true` em `cloud_sql.tf` quando o sistema estiver estável e com carga/uso
  real de produção (exigindo RPO curto) — reativar é reversível, mas reinicia
  o Postgres e a janela de PITR recomeça a acumular do zero a partir da
  reativação. Ver `cloud_sql.tf` (comentário adjacente à flag) e
  `openspec/changes/desativa-pitr-cloud-sql-mvp/design.md`.
- **Expurgo da lixeira tem lógica real (Épico 6, `epico-6-lixeira-retencao`).**
  O Cloud Run Job (`scheduler.tf`) deixou de ser um placeholder de exemplo: roda
  a mesma imagem da API (`var.api_image`) com o entrypoint
  `dist/jobs/purge-trash.js`, conectado ao Cloud SQL pela mesma integração
  nativa da API (`google_sql_database_instance.main`) e ao segredo
  `database_url`. `TRASH_RETENTION_DAYS` (padrão 30 — `var.trash_retention_days`)
  controla o corte de retenção; ver `apps/api/src/jobs/purge-trash.ts` e
  design.md D6-D10 do change para a lógica. A topologia Scheduler → Job e a
  IAM do invoker não mudaram.
- **Job de bootstrap do administrador global (change `bootstrap-admin-producao`).**
  `${local.name_prefix}-bootstrap` (`bootstrap_job.tf`) roda a mesma imagem/SA/
  integração Cloud SQL da API, entrypoint `apps/api/dist/db/bootstrap.js`
  (`apps/api/src/db/bootstrap.ts`): aplica migrações pendentes e cria
  **somente** o `global_admin` inicial, fail-closed sem as credenciais do
  secret `bootstrap-admin-password` + `var.bootstrap_admin_email`, idempotente
  em reexecuções. Não é agendado — sempre `gcloud run jobs execute` manual
  (ver seção "Bootstrap do administrador global" acima). Mesmo racional de
  imagem "não avança sozinho" do Job de expurgo, abaixo.
- **A imagem dos demais Jobs não é redeployada automaticamente pelo CI/CD —
  só a do Job de migração.** `.github/workflows/deploy.yml` faz
  `gcloud run deploy` do **serviço** (API) a cada push em `main` e, antes
  disso, `gcloud run jobs update --image` + `execute --wait` no Job de
  migração (abaixo). Os demais Jobs (expurgo, bootstrap) só pegam uma imagem
  nova quando o Terraform for reaplicado (o `lifecycle.ignore_changes` em
  `containers[0].image` evita que um `apply` de rotina reverta uma imagem já
  publicada, mas também significa que eles não avançam sozinhos). Mantê-los
  atualizados hoje exige `terraform apply` manual apontando `var.api_image`
  para a tag desejada, ou estender o CI/CD para também rodar
  `gcloud run jobs deploy` neles — fora de escopo desta mudança.
- **Job de migração de banco (change `deploy-migrations-e-docs-only`).**
  `${local.name_prefix}-migrate` (`migrate_job.tf`) roda a mesma imagem/SA/
  integração Cloud SQL da API, entrypoint `apps/api/dist/db/migrate.js`
  (`apps/api/src/db/migrate.ts`): aplica **só** as migrações pendentes
  (idempotente via `schema_migrations`, no-op se não houver nenhuma) —
  **sem** as env `BOOTSTRAP_ADMIN_*` do Job de bootstrap. Diferente dos
  demais Jobs, o pipeline (`.github/workflows/deploy.yml`) atualiza a imagem
  dele a cada deploy (`gcloud run jobs update --image` seguido de
  `execute --wait`), entre o `docker push` e o `gcloud run deploy` do
  serviço, para que a revisão nova da API nunca suba contra um schema
  desatualizado; falha no `execute --wait` aborta o workflow antes do
  `deploy` (tráfego permanece na revisão anterior). O nome do job precisa
  estar na variável de repositório `GCP_MIGRATE_JOB` (tabela acima).
  **Desbloqueio manual de migração pendente:** use **este** Job, atualizando a
  imagem para uma tag que contenha a migração antes de executar
  (`gcloud run jobs update ${local.name_prefix}-migrate --image <IMAGE>:<SHA>` +
  `execute --wait`). **Não** use o Job de bootstrap para "aplicar migrações": a
  imagem dele é pinada (`lifecycle.ignore_changes = [image]`) e o pipeline não a
  atualiza, então ele pode rodar uma imagem anterior à migração — cujo
  `dist/db/migrations` não contém o `.sql` novo — e `runMigrations()` conclui com
  **sucesso sem aplicar nada** (o registro em `schema_migrations` nunca é criado).
  Foi exatamente esse "sucesso falso" que mascarou um HTTP 500 em produção antes
  do change `cicd-iam-job-migracao`.

## O que falta (fora de escopo desta mudança)

- Ambiente de staging.
- Domínio real do frontend (hoje `frontend_domain` fica vazio por padrão).
- Redeploy automático da imagem do Cloud Run Job de expurgo pelo CI/CD (acima).
