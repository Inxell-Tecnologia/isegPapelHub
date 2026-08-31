# Identidade do CI/CD (tasks.md seção 7) — GitHub Actions autentica no GCP
# via Workload Identity Federation, sem chave de service account exportada
# (mesma postura de "sem chave" das Decisões 4/signBlob). Só o repositório
# em `var.github_repository` pode assumir a service account de deploy.

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "${local.name_prefix}-github"
  display_name              = "GitHub Actions (${var.environment})"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # Só tokens emitidos para o repositório configurado passam — sem isso,
  # qualquer repositório do GitHub poderia tentar assumir a SA de deploy.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-deployer"
  display_name = "CI/CD deploy (${var.environment}) — GitHub Actions"

  depends_on = [google_project_service.required]
}

resource "google_service_account_iam_member" "deployer_wif_binding" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# Publicar imagens no repositório criado em artifact_registry.tf.
resource "google_artifact_registry_repository_iam_member" "deployer_ar_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.api.location
  repository = google_artifact_registry_repository.api.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

# Publicar uma nova revisão no Cloud Run existente.
resource "google_cloud_run_v2_service_iam_member" "deployer_run_developer" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# Deploy de uma revisão precisa poder "agir como" a service account de
# runtime da API que a revisão vai usar (ver cloud_run.tf). O Job de migração
# (migrate_job.tf) reusa esta MESMA service account de runtime, então o
# "act-as" necessário para atualizar/executar o Job também já está coberto aqui
# — nenhum serviceAccountUser adicional é preciso (change cicd-iam-job-migracao,
# design.md D2).
resource "google_service_account_iam_member" "deployer_act_as_api" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# Atualizar a imagem e executar o Job de migração no pipeline (change
# cicd-iam-job-migracao). O passo "Update migration job image" do deploy
# (.github/workflows/deploy.yml) faz `gcloud run jobs update`/`execute` no Job
# `${name_prefix}-migrate` (migrate_job.tf) — um recurso DISTINTO do serviço da
# API, que o binding `deployer_run_developer` acima (escopado ao recurso do
# serviço) não alcança. Sem este binding o deploy falha em `run.jobs.get` com
# PERMISSION_DENIED, o passo de migração e o `deploy` são pulados e a revisão
# nova nunca sobe. `roles/run.developer` cobre get/update/run do Job e das
# execuções — mesmo papel mínimo já concedido ao serviço (design.md D1).
resource "google_cloud_run_v2_job_iam_member" "deployer_run_developer_migrate_job" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.migrate.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# Mesmo racional do binding acima, para os outros três Jobs que o `deploy.yml`
# também mantém com a imagem publicada (change corrige-imagem-jobs-cicd):
# sem `run.developer` por Job, `gcloud run jobs update --image` falha em
# `run.jobs.get`/`run.jobs.update` com PERMISSION_DENIED e o Job em questão
# fica preso na imagem placeholder do primeiro `terraform apply` para sempre
# — é exatamente o que aconteceu com o Job de bootstrap antes desta mudança
# (ninguém nunca atualizava sua imagem, então `gcloud run jobs execute`
# tentava rodar `node .../bootstrap.js` dentro da imagem de exemplo do Cloud
# Run, que nem tem Node, e falhava com "Application failed to start" sem
# nenhum log da aplicação).
resource "google_cloud_run_v2_job_iam_member" "deployer_run_developer_bootstrap_job" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.bootstrap.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# trash_purge e notify_expiring_grants (diferente do bootstrap/migrate) rodam
# sob suas PRÓPRIAS service accounts (scheduler.tf), não a da API — por isso,
# diferente do binding de migração, aqui também precisa de `serviceAccountUser`
# na SA de runtime de cada Job para o "act-as" da atualização de imagem.
resource "google_cloud_run_v2_job_iam_member" "deployer_run_developer_trash_purge_job" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.trash_purge.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "deployer_act_as_trash_purge_job" {
  service_account_id = google_service_account.trash_purge_job.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "deployer_run_developer_notify_expiring_grants_job" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.notify_expiring_grants.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "deployer_act_as_notify_expiring_grants_job" {
  service_account_id = google_service_account.notify_expiring_grants_job.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}
