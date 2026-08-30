# Cloud Run Job de migração de banco (change deploy-migrations-e-docs-only,
# design.md D1): aplica as migrações pendentes (apps/api/src/db/migrate.ts,
# compilado para dist/db/migrate.js) antes de trocar o tráfego para a revisão
# nova no pipeline de deploy (.github/workflows/deploy.yml). Reusa a mesma
# imagem, service account e integração Cloud SQL da API — nenhum caminho de
# rede novo. Diferente do Job de bootstrap, **sem** as env `BOOTSTRAP_ADMIN_*`
# (só aplica migrações, não cria administrador).
resource "google_cloud_run_v2_job" "migrate" {
  project  = var.project_id
  name     = "${local.name_prefix}-migrate"
  location = var.region
  labels   = local.labels
  # Job stateless recriado a cada deploy (nenhum dado próprio) — diferente do
  # Cloud SQL, que mantém `deletion_protection = true` de propósito.
  deletion_protection = false

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
        args    = ["apps/api/dist/db/migrate.js"]

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
        env {
          name  = "SECRETS_DRIVER"
          value = "env"
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
      }
      max_retries = 1
    }
  }

  lifecycle {
    # Mesmo racional do Cloud Run Service e dos demais Jobs: passo único,
    # logo após provisionar — o CI/CD (deploy.yml) é quem atualiza a imagem a
    # cada deploy via `gcloud run jobs update --image` (design.md D2).
    ignore_changes = [template[0].template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_version.database_url,
  ]
}
