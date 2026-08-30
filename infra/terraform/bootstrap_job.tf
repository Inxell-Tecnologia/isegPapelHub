# Cloud Run Job de bootstrap de produção (change bootstrap-admin-producao,
# design.md D6): cria o primeiro `global_admin` num banco recém-provisionado,
# aplicando antes as migrações pendentes (apps/api/src/db/bootstrap.ts,
# compilado para dist/db/bootstrap.js). Reusa a mesma imagem, service account
# e integração Cloud SQL da API — nenhum caminho de rede novo. Executado sob
# demanda (`gcloud run jobs execute ${local.name_prefix}-bootstrap`), **não**
# agendado pelo Cloud Scheduler.
resource "google_cloud_run_v2_job" "bootstrap" {
  project  = var.project_id
  name     = "${local.name_prefix}-bootstrap"
  location = var.region
  labels   = local.labels

  template {
    template {
      service_account = google_service_account.api.email

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }

      containers {
        image   = var.api_image
        command = ["node"]
        args    = ["apps/api/dist/db/bootstrap.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        env {
          name  = "DATABASE_SSL"
          value = "false" # socket Unix local ao Cloud Run — mesmo racional de cloud_run.tf
        }
        env {
          name  = "STORAGE_DRIVER"
          value = "gcs"
        }
        env {
          name  = "STORAGE_BUCKET"
          value = google_storage_bucket.files.name
        }
        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }
        # Segredos chegam resolvidos como env vars via secret_key_ref (mesmo
        # modelo do serviço da API em cloud_run.tf). O bootstrap lê senha/URL
        # direto do ambiente e não usa o SecretsPort, mas mantemos o driver
        # "env" coerente em todo o prod.
        env {
          name  = "SECRETS_DRIVER"
          value = "env"
        }
        env {
          name  = "BOOTSTRAP_ADMIN_EMAIL"
          value = var.bootstrap_admin_email
        }
        env {
          name  = "BOOTSTRAP_ADMIN_UNIT"
          value = var.bootstrap_admin_unit
        }
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }
        env {
          name = "BOOTSTRAP_ADMIN_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.bootstrap_admin_password.secret_id
              version = "latest"
            }
          }
        }
      }
      max_retries = 1
    }
  }

  lifecycle {
    # Mesmo racional do Cloud Run Service e do Job de expurgo: passo único,
    # logo após provisionar — aponta-se var.api_image para a tag corrente ao
    # aplicar (design.md, Risks/Trade-offs).
    ignore_changes = [template[0].template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.bootstrap_admin_password_placeholder,
    google_secret_manager_secret_iam_member.api_bootstrap_admin_password,
  ]
}
