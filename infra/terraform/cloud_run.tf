# Cloud Run — a API, único guardião de permissão (ver design.md, visão de
# arquitetura). Publicamente invocável (é a porta de entrada do SPA), mas
# cada rota checa permissão/isolamento por unidade antes de fazer qualquer
# coisa — IAM do Cloud Run não é a linha de defesa aqui, a aplicação é.

resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-api"
  display_name = "GDoc API runtime (${var.environment})"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "api_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_secret_manager_secret_iam_member" "api_database_url" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

resource "google_secret_manager_secret_iam_member" "api_auth_session_secret" {
  secret_id = google_secret_manager_secret.auth_session_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

# Permite que a própria service account assine URLs v4 via IAM Credentials
# API (`signBlob`), sem precisar de uma chave privada exportada em lugar
# nenhum — o `@google-cloud/storage` usa esse caminho automaticamente quando
# não recebe `credentials` explícitas e roda sob ADC do Cloud Run (é por
# isso que `STORAGE_SIGNER_KEY_PATH` NÃO é setada em prod, ver env abaixo).
resource "google_service_account_iam_member" "api_self_sign" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "api_storage_admin" {
  bucket = google_storage_bucket.files.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = "${local.name_prefix}-api"
  location = var.region
  labels   = local.labels
  # Serviço stateless redeployado pelo CI/CD a cada push em main (nenhum dado
  # próprio) — diferente do Cloud SQL, que mantém `deletion_protection = true`
  # de propósito.
  deletion_protection = false

  template {
    service_account = google_service_account.api.email

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.api_image

      resources {
        limits = {
          cpu    = var.api_cpu
          memory = var.api_memory
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
        value = "false" # socket Unix local ao Cloud Run — TLS não se aplica
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
        name  = "SIGNED_URL_VIEW_TTL_SECONDS"
        value = tostring(var.signed_url_view_ttl_seconds)
      }
      env {
        name  = "SIGNED_URL_DOWNLOAD_TTL_SECONDS"
        value = tostring(var.signed_url_download_ttl_seconds)
      }
      env {
        name  = "STORAGE_QUOTA_BYTES_PER_USER"
        value = tostring(var.storage_quota_bytes_per_user)
      }
      env {
        name  = "APP_CLIENT_NAME"
        value = var.app_client_name
      }
      env {
        name  = "APP_MANUAL_URL"
        value = var.app_manual_url
      }
      # O Cloud Run já injeta os segredos (AUTH_SESSION_SECRET, DATABASE_URL)
      # como variáveis de ambiente resolvidas a partir do Secret Manager, via
      # `value_source.secret_key_ref` abaixo (design.md: "valores sensíveis no
      # Secret Manager, injetados no Cloud Run" — já chegam resolvidos). Logo o
      # `SecretsPort` lê a env var já injetada (driver "env"), o mesmo caminho
      # provado pelo DATABASE_URL. O nome lógico usado pelo código
      # (`AUTH_SESSION_SECRET`) casa com a env var, não com o secret_id
      # prefixado (`${name_prefix}-auth-session-secret`) — usar o driver
      # "secret-manager" faria o SDK buscar um segredo com o nome errado e
      # quebraria o login com 500 em `issueSession`.
      env {
        name  = "SECRETS_DRIVER"
        value = "env"
      }
      # Autenticação do push do Pub/Sub no endpoint de finalização
      # (POST /internal/storage-events). Definir `pubsub_push_audience` em
      # terraform.tfvars liga a validação OIDC; a `audience` bate com o `aud`
      # do token (= push_endpoint, já que a subscription não fixa `audience`).
      # Não referenciar `google_cloud_run_v2_service.api.uri` aqui: seria o
      # próprio serviço lendo o próprio atributo → ciclo no Terraform.
      env {
        name  = "PUBSUB_OIDC_VALIDATION"
        value = var.pubsub_push_audience != "" ? "true" : "false"
      }
      env {
        name  = "PUBSUB_PUSH_AUDIENCE"
        value = var.pubsub_push_audience
      }
      env {
        name  = "PUBSUB_PUSH_SA_EMAIL"
        value = google_service_account.pubsub_push.email
      }
      # PUBSUB_STORAGE_EVENTS_TOPIC/SUBSCRIPTION não são passadas aqui: a API
      # não lê nenhuma delas (o endpoint de reconciliação só recebe o POST do
      # push, não precisa saber o nome do tópico/assinatura) — e referenciar
      # a assinatura aqui criaria um ciclo (a assinatura depende da IAM do
      # invoker, que depende deste serviço).

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
        name = "AUTH_SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_session_secret.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    # O CI/CD (tasks.md seção 7) passa a ser dono da imagem publicada depois
    # do primeiro `terraform apply` — não deixar `apply` reverter deploys.
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.auth_session_secret,
    google_secret_manager_secret_iam_member.api_database_url,
    google_secret_manager_secret_iam_member.api_auth_session_secret,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
