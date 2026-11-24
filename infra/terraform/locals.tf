locals {
  name_prefix = "${var.app_name}-${var.environment}"

  labels = merge(
    {
      app         = var.app_name
      environment = var.environment
      managed_by  = "terraform"
    },
    var.labels,
  )

  required_apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudscheduler.googleapis.com",
    "pubsub.googleapis.com",
    "storage.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "sts.googleapis.com", # troca de token do Workload Identity Federation (ver cicd.tf)
  ]

  create_frontend_lb = var.frontend_domain != ""

  # Prefixos servidos pela API (apps/api/src/app.ts) — espelha
  # apps/web/vite.config.ts (API_PROXY_PREFIXES) e apps/api/src/lib/
  # api-prefixes.ts (que também tem `/internal`, sem equivalente aqui pois
  # não passa pelo url-map). Mesma origem para SPA + API (design.md D1/D2 do
  # change `web-shell-e-auth`): preserva o cookie de sessão
  # HttpOnly/SameSite=Strict sem CORS. Mantenha as três listas em sincronia
  # ao adicionar uma rota.
  api_proxy_prefixes = [
    "/auth",
    "/files",
    "/folders",
    "/users",
    "/units",
    "/sectors",
    "/grants",
    "/trash",
    "/audit",
    "/dashboard",
    "/search",
    "/notifications",
    "/favorites",
    "/reading",
    "/health",
  ]
}

# Jobs que reusam a imagem da aplicação e devem acompanhá-la a cada deploy
# (change deploy-atualiza-jobs-agendados, design.md D1). Origem ÚNICA: deste
# mapa saem as permissões da identidade do pipeline sobre cada Job e sobre a
# service account com que ele roda (cicd.tf) e o output
# `deploy_updated_job_names`, copiado para a variável de repositório
# GCP_DEPLOY_UPDATED_JOBS que o deploy.yml percorre.
#
# Job novo que reusa a imagem = uma linha aqui + atualizar a variável no GitHub
# (runbook, Armadilha 10). O Job de migração NÃO entra: o pipeline já o
# atualiza e executa antes do deploy, com concessão própria
# (`deployer_run_developer_migrate_job`).
locals {
  deploy_updated_jobs = {
    bootstrap       = { job = google_cloud_run_v2_job.bootstrap, sa = google_service_account.api }
    trash_purge     = { job = google_cloud_run_v2_job.trash_purge, sa = google_service_account.trash_purge_job }
    notify_grants   = { job = google_cloud_run_v2_job.notify_expiring_grants, sa = google_service_account.notify_expiring_grants_job }
    notify_readings = { job = google_cloud_run_v2_job.notify_readings, sa = google_service_account.notify_readings_job }
  }

  # Service accounts de runtime DISTINTAS do mapa, exceto a da API — que já tem
  # `deployer_act_as_api` (dois recursos gerenciando o mesmo binding brigariam).
  # Chave = account_id, conhecido no plan por ser argumento, não atributo
  # computado; o agrupamento `...` tolera duas entradas com a mesma conta.
  deploy_job_runtime_sas = {
    for k, v in local.deploy_updated_jobs :
    v.sa.account_id => v.sa.name...
    if v.sa.account_id != google_service_account.api.account_id
  }
}
