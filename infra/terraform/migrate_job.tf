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
        # Mesmo envelope de conexões da API (cloud_run.tf): sem teto, o `pg`
        # assume 10 por processo e um Job concorrendo com o serviço estoura
        # o `max_connections` do Cloud SQL. Um Job é sequencial — 2 basta.
        env {
          name  = "DATABASE_POOL_MAX"
          value = tostring(var.api_db_pool_max)
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

  # O provider google 6.x introduziu `deletion_protection` com default `true`
  # em Cloud Run v2, e é uma trava DO TERRAFORM (não existe campo equivalente
  # na API do Cloud Run). Nos Jobs ela só atrapalha: Job não guarda dado algum
  # e destruir/recriar é gratuito. Pior, ela cria um impasse quando um `create`
  # falha na espera de prontidão: o recurso fica `tainted`, o apply seguinte
  # planeja SUBSTITUIR, e o destroy é recusado — `cannot destroy job without
  # setting deletion_protection=false`. Como o provider lê a flag do STATE, não
  # da configuração, mudar isto aqui não desfaz um impasse já instalado (aí é
  # `terraform untaint` ou `state rm`); serve para não haver o próximo.
  # Deliberadamente NÃO replicado no Cloud Run Service da API (cloud_run.tf),
  # onde o default `true` é rede de segurança desejável: o serviço é o endpoint
  # de produção, e destruí-lo é indisponibilidade, não recriação barata.
  # Change correcoes-herdadas-do-fork; runbook, Armadilha 7.
  deletion_protection = false

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
