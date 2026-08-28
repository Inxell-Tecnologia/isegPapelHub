# Reconciliação de cota pós-upload (ver design.md, Decisão 1): o GCS publica
# a finalização do objeto no Pub/Sub, que entrega via push para o endpoint
# interno da API (`POST /internal/storage-events`).

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_pubsub_topic" "storage_finalize" {
  project = var.project_id
  name    = "${local.name_prefix}-storage-finalize"
  labels  = local.labels

  depends_on = [google_project_service.required]
}

# Identidade de serviço gerenciada do GCS. O e-mail segue uma convenção
# previsível, mas a conta só é provisionada de fato na primeira leitura desta
# data source — daí ela (não uma string construída à mão) ser a dependência
# real do IAM binding abaixo.
data "google_storage_project_service_account" "gcs" {
  project = var.project_id
}

resource "google_pubsub_topic_iam_member" "gcs_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.storage_finalize.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs.email_address}"
}

resource "google_storage_notification" "finalize" {
  bucket         = google_storage_bucket.files.name
  topic          = google_pubsub_topic.storage_finalize.id
  payload_format = "JSON_API_V1"
  event_types    = ["OBJECT_FINALIZE"]

  depends_on = [google_pubsub_topic_iam_member.gcs_publisher]
}

# Identidade dedicada só para autenticar a entrega push do Pub/Sub perante o
# Cloud Run (IAM de privilégio mínimo — não é a mesma conta que a API usa).
resource "google_service_account" "pubsub_push" {
  project      = var.project_id
  account_id   = "${local.name_prefix}-pubsub-push"
  display_name = "Push subscription -> API (storage finalize)"

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_push.email}"
}

resource "google_pubsub_subscription" "storage_finalize" {
  project = var.project_id
  name    = "${local.name_prefix}-storage-finalize-push"
  topic   = google_pubsub_topic.storage_finalize.id

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.api.uri}/internal/storage-events"

    oidc_token {
      service_account_email = google_service_account.pubsub_push.email
    }
  }

  ack_deadline_seconds = 30
  retry_policy {
    minimum_backoff = "5s"
    maximum_backoff = "60s"
  }

  labels = local.labels

  depends_on = [google_cloud_run_v2_service_iam_member.pubsub_invoker]
}
