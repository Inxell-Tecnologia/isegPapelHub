# Arquivo SÓ DO FORK ISEG — não existe no upstream, e por isso não conflita
# nos syncs (change sync-upstream-identidade-iseg, design.md D2).
#
# A implantação ISEG foi provisionada com o Terraform do fork, que concedia o
# acesso do deployer aos Jobs com um recurso nominal por Job. O upstream
# generalizou essas concessões com `for_each` sobre `local.deploy_updated_jobs`
# (change deploy-atualiza-jobs-agendados). Sem os blocos abaixo, o primeiro
# `plan` depois do sync mostraria destroy + create das 5 concessões — o mesmo
# binding IAM, mas com uma janela em que o deploy perde a permissão.
#
# As chaves de `deployer_act_as_job_runtime` são o `account_id` das contas de
# runtime dos Jobs (`${local.name_prefix}-…`), literais porque `moved` não
# aceita expressão. Conferidas contra o state de produção em 2026-11-24
# (tasks.md 2.2): `gdoc-prod-trash-purge` e `gdoc-prod-notify-grants`.
#
# Pode ser apagado depois do primeiro `terraform apply` bem-sucedido com o
# código mesclado: a partir daí o state já tem os endereços novos.

moved {
  from = google_cloud_run_v2_job_iam_member.deployer_run_developer_bootstrap_job
  to   = google_cloud_run_v2_job_iam_member.deployer_run_developer_jobs["bootstrap"]
}

moved {
  from = google_cloud_run_v2_job_iam_member.deployer_run_developer_trash_purge_job
  to   = google_cloud_run_v2_job_iam_member.deployer_run_developer_jobs["trash_purge"]
}

moved {
  from = google_cloud_run_v2_job_iam_member.deployer_run_developer_notify_expiring_grants_job
  to   = google_cloud_run_v2_job_iam_member.deployer_run_developer_jobs["notify_grants"]
}

moved {
  from = google_service_account_iam_member.deployer_act_as_trash_purge_job
  to   = google_service_account_iam_member.deployer_act_as_job_runtime["gdoc-prod-trash-purge"]
}

moved {
  from = google_service_account_iam_member.deployer_act_as_notify_expiring_grants_job
  to   = google_service_account_iam_member.deployer_act_as_job_runtime["gdoc-prod-notify-grants"]
}
