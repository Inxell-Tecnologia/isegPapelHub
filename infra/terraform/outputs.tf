output "api_url" {
  description = "URL pública do Cloud Run da API."
  value       = google_cloud_run_v2_service.api.uri
}

output "api_service_account_email" {
  description = "Service account de runtime da API — usar para IAM adicional se necessário."
  value       = google_service_account.api.email
}

output "files_bucket_name" {
  description = "Bucket privado de arquivos (STORAGE_BUCKET)."
  value       = google_storage_bucket.files.name
}

output "frontend_bucket_name" {
  description = "Bucket público do SPA (destino do build do frontend)."
  value       = google_storage_bucket.frontend.name
}

output "frontend_ip_address" {
  description = "IP do balanceador de carga do frontend (só existe se frontend_domain foi definido). Apontar o DNS do domínio para este IP."
  value       = local.create_frontend_lb ? google_compute_global_address.frontend[0].address : null
}

output "cloud_sql_connection_name" {
  description = "Connection name do Cloud SQL (project:region:instance) — usado pelo Cloud Run e por ferramentas de administração (ex.: Cloud SQL Auth Proxy local)."
  value       = google_sql_database_instance.main.connection_name
}

output "artifact_registry_repository" {
  description = "Repositório Docker para as imagens da API (usado pelo CI/CD, tasks.md seção 7)."
  value       = google_artifact_registry_repository.api.name
}

output "pubsub_topic" {
  description = "Tópico de notificação de finalização de objeto do bucket de arquivos."
  value       = google_pubsub_topic.storage_finalize.name
}

output "trash_purge_job_name" {
  description = "Nome do Cloud Run Job de expurgo da lixeira (Épico 6)."
  value       = google_cloud_run_v2_job.trash_purge.name
}

output "migrate_job_name" {
  description = "Nome do Cloud Run Job de migração de banco — valor para a variável de repositório GCP_MIGRATE_JOB do GitHub Actions (ver .github/workflows/deploy.yml)."
  value       = google_cloud_run_v2_job.migrate.name
}

output "bootstrap_job_name" {
  description = "Nome do Cloud Run Job de bootstrap do administrador global — valor para a variável de repositório GCP_BOOTSTRAP_JOB do GitHub Actions (ver .github/workflows/deploy.yml)."
  value       = google_cloud_run_v2_job.bootstrap.name
}

output "notify_expiring_grants_job_name" {
  description = "Nome do Cloud Run Job de aviso de permissões a vencer — valor para a variável de repositório GCP_NOTIFY_GRANTS_JOB do GitHub Actions (ver .github/workflows/deploy.yml)."
  value       = google_cloud_run_v2_job.notify_expiring_grants.name
}

output "github_actions_workload_identity_provider" {
  description = "Valor para o secret/var GCP_WORKLOAD_IDENTITY_PROVIDER do GitHub Actions (ver .github/workflows/deploy.yml)."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_actions_deployer_service_account" {
  description = "Valor para o secret/var GCP_DEPLOYER_SERVICE_ACCOUNT do GitHub Actions (ver .github/workflows/deploy.yml)."
  value       = google_service_account.deployer.email
}
