# Segredos injetados no Cloud Run como variáveis de ambiente nativas do
# Secret Manager (ver design.md: "Segredos e configuração" — SecretsPort
# abstrai a origem, mas em prod a variável de ambiente já chega resolvida).

resource "random_password" "auth_session_secret" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = "${local.name_prefix}-database-url"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  # Conexão via socket Unix do Cloud SQL, montado pela integração nativa do
  # Cloud Run (ver cloud_run.tf) — mesma lib `pg`, sem código condicional por
  # ambiente além da própria connection string.
  secret_data = "postgres://${google_sql_user.app.name}:${random_password.db_user.result}@/${google_sql_database.app.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
}

resource "google_secret_manager_secret" "auth_session_secret" {
  project   = var.project_id
  secret_id = "${local.name_prefix}-auth-session-secret"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "auth_session_secret" {
  secret      = google_secret_manager_secret.auth_session_secret.id
  secret_data = random_password.auth_session_secret.result
}

# Senha do administrador global de bootstrap (change bootstrap-admin-producao,
# design.md D7). Só o CONTAINER do secret é criado aqui — sem versão gerenciada
# pelo Terraform, para que a senha real nunca fique no state nem no código. O
# operador cria a versão manualmente antes de rodar o Job (ver bootstrap_job.tf
# e README.md).
resource "google_secret_manager_secret" "bootstrap_admin_password" {
  project   = var.project_id
  secret_id = "${local.name_prefix}-bootstrap-admin-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

# Reusa a service account da API (design.md D6) — já tem cloudsql.client e
# acesso ao secret database_url; só precisa ganhar acesso a este novo secret.
resource "google_secret_manager_secret_iam_member" "api_bootstrap_admin_password" {
  secret_id = google_secret_manager_secret.bootstrap_admin_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

# O Cloud Run valida o secret_key_ref na CRIAÇÃO do Job de bootstrap (não só
# na execução) — sem nenhuma versão, `terraform apply` falha com "Secret ...
# was not found" antes mesmo do operador chegar ao passo 1 do README (criar a
# versão com a senha real). Esta versão placeholder só existe para satisfazer
# essa validação; `ignore_changes` garante que o Terraform nunca a
# sobrescreva depois que o operador rodar `gcloud secrets versions add` com a
# senha real (vira a versão seguinte, e passa a ser a "latest" lida pelo
# Job) — a senha real segue nunca tocando o state, como já era a intenção.
resource "random_password" "bootstrap_admin_password_placeholder" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret_version" "bootstrap_admin_password_placeholder" {
  secret      = google_secret_manager_secret.bootstrap_admin_password.id
  secret_data = random_password.bootstrap_admin_password_placeholder.result

  lifecycle {
    ignore_changes = [secret_data]
  }
}
