# Cloud Scheduler -> Cloud Run Job (ver design.md, visão de arquitetura:
# expurgo diário da lixeira às 03:00). Épico 6 (lixeira, `epico-6-lixeira-retencao`):
# o job roda a mesma imagem da API com o entrypoint de expurgo
# (`apps/api/src/jobs/purge-trash.ts`, compilado para `dist/jobs/purge-trash.js`
# — ver design.md D7 dessa mudança), a topologia Scheduler -> Job e a IAM já
# existentes da fundação não mudam.
resource "google_service_account" "trash_purge_job" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-trash-purge"
  display_name = "Trash purge job runtime (${var.environment})"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "trash_purge_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.trash_purge_job.email}"
}

resource "google_secret_manager_secret_iam_member" "trash_purge_database_url" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.trash_purge_job.email}"
}

# `deleteObject` (design.md D8 da mesma mudança) só remove bytes — o mesmo
# papel de objectAdmin já concedido à API (`api_storage_admin` em
# cloud_run.tf) cobre o expurgo; nenhuma URL é assinada pelo job, então não
# precisa do `serviceAccountTokenCreator` que a API tem para `signBlob`.
resource "google_storage_bucket_iam_member" "trash_purge_storage_admin" {
  bucket = google_storage_bucket.files.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.trash_purge_job.email}"
}

resource "google_cloud_run_v2_job" "trash_purge" {
  project  = var.project_id
  name     = "${local.name_prefix}-trash-purge"
  location = var.region
  labels   = local.labels
  # Job stateless recriado a cada deploy (nenhum dado próprio) — diferente do
  # Cloud SQL, que mantém `deletion_protection = true` de propósito.
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.trash_purge_job.email

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }

      containers {
        image   = var.api_image
        command = ["node"]
        args    = ["dist/jobs/purge-trash.js"]

        resources {
          limits = {
            cpu = "1"
            # Piso do Cloud Run gen2 com CPU sempre alocada (unthrottled) é
            # 512Mi; abaixo disso a API rejeita a criação do Job.
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
        # modelo do serviço da API em cloud_run.tf). O job não emite/verifica
        # sessão, mas mantemos o driver "env" coerente em todo o prod.
        env {
          name  = "SECRETS_DRIVER"
          value = "env"
        }
        env {
          name  = "TRASH_RETENTION_DAYS"
          value = tostring(var.trash_retention_days)
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
    # Mesmo racional do Cloud Run Service (cloud_run.tf): a imagem publicada
    # pelo CI/CD não deve ser revertida por um `terraform apply` seguinte.
    ignore_changes = [template[0].template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_iam_member.trash_purge_database_url,
  ]
}

resource "google_service_account" "scheduler_invoker" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-scheduler"
  display_name = "Cloud Scheduler -> Cloud Run Job invoker (${var.environment})"

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.trash_purge.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}

resource "google_cloud_scheduler_job" "trash_purge" {
  project   = var.project_id
  region    = var.region
  name      = "${local.name_prefix}-trash-purge"
  schedule  = var.trash_purge_schedule
  time_zone = var.scheduler_time_zone

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.trash_purge.name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler_invoker.email
    }
  }

  retry_config {
    retry_count = 1
  }

  depends_on = [
    google_project_service.required,
    google_cloud_run_v2_job_iam_member.scheduler_invoker,
  ]
}

# Cloud Scheduler -> Cloud Run Job da rotina de avisos de expiração de
# permissão (change `expiracao-permissoes`, US 4.3, design.md D7). Job
# separado do expurgo — domínios e falhas independentes — e horário
# deliberadamente deslocado das 03:00 para não concorrer por conexões de
# banco. Nunca toca storage (só lê/grava metadados), então não recebe papel
# algum sobre o bucket, diferente do `trash_purge_job`.
resource "google_service_account" "notify_expiring_grants_job" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-notify-grants"
  display_name = "Grant expiration notice job runtime (${var.environment})"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "notify_expiring_grants_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.notify_expiring_grants_job.email}"
}

resource "google_secret_manager_secret_iam_member" "notify_expiring_grants_database_url" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.notify_expiring_grants_job.email}"
}

resource "google_cloud_run_v2_job" "notify_expiring_grants" {
  project  = var.project_id
  name     = "${local.name_prefix}-notify-grants"
  location = var.region
  labels   = local.labels
  # Job stateless recriado a cada deploy (nenhum dado próprio) — diferente do
  # Cloud SQL, que mantém `deletion_protection = true` de propósito.
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.notify_expiring_grants_job.email

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }

      containers {
        image   = var.api_image
        command = ["node"]
        args    = ["dist/jobs/notify-expiring-grants.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi" # mesmo piso do trash_purge (Cloud Run gen2 unthrottled)
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
        # config.ts exige STORAGE_BUCKET/GCP_PROJECT_ID mesmo aqui, ainda que
        # este job nunca chame o StoragePort — createPorts() monta os quatro
        # seams incondicionalmente (design.md, Ports & Adapters).
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
          name  = "GRANT_EXPIRING_NOTICE_WINDOW_DAYS"
          value = tostring(var.grant_expiring_notice_window_days)
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
    ignore_changes = [template[0].template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_iam_member.notify_expiring_grants_database_url,
  ]
}

resource "google_cloud_run_v2_job_iam_member" "notify_expiring_grants_scheduler_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.notify_expiring_grants.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_invoker.email}"
}

resource "google_cloud_scheduler_job" "notify_expiring_grants" {
  project   = var.project_id
  region    = var.region
  name      = "${local.name_prefix}-notify-grants"
  schedule  = var.notify_expiring_grants_schedule
  time_zone = var.scheduler_time_zone

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.notify_expiring_grants.name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler_invoker.email
    }
  }

  retry_config {
    retry_count = 1
  }

  depends_on = [
    google_project_service.required,
    google_cloud_run_v2_job_iam_member.notify_expiring_grants_scheduler_invoker,
  ]
}
