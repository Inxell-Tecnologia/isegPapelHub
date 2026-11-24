# Design — deploy-atualiza-jobs-agendados

## Context

Ver proposal.md (Why). Estado atual que molda a solução:

- `deploy.yml` autentica por Workload Identity Federation como
  `papelhub-prod-deployer` e faz, em ordem: build e push da imagem
  (`:${TARGET_SHA}` e `:latest`), `jobs update` + `jobs execute` do Job de
  migração, `run deploy` do serviço.
- A identidade do pipeline tem permissões **por recurso** (`cicd.tf`):
  `artifactregistry.writer` no repositório, `run.developer` no serviço e no Job de
  migração, `iam.serviceAccountUser` na service account da API. É decisão
  registrada (privilégio mínimo), não acidente.
- Os Jobs que reusam a imagem da aplicação e o que cada um usa como runtime:

  | Job | Recurso Terraform | Service account de runtime |
  | --- | --- | --- |
  | `papelhub-prod-migrate` | `migrate` | `api` (já coberta) |
  | `papelhub-prod-bootstrap` | `bootstrap` | `api` |
  | `papelhub-prod-trash-purge` | `trash_purge` | `trash_purge_job` |
  | `papelhub-prod-notify-grants` | `notify_expiring_grants` | `notify_expiring_grants_job` |
  | `papelhub-prod-notify-readings` | `notify_readings` | `notify_readings_job` |

- Todos declaram `lifecycle.ignore_changes` na imagem: o Terraform não a
  atualiza, nem para frente nem para trás. Só o `gcloud` move a imagem.
- Atualizar um Job (`gcloud run jobs update --image`) exige
  `run.jobs.get`/`run.jobs.update` no Job **e** `iam.serviceAccounts.actAs` na
  service account de runtime dele — a mesma combinação que o requisito "Pipeline
  de build e deploy" já exige para o Job de migração.

## Goals / Non-Goals

**Goals:**

- Ao fim de todo deploy, os cinco Jobs apontam para a mesma imagem do serviço.
- Acrescentar um Job novo é **uma** edição no Terraform que já traz a permissão.
- Falha nesse alinhamento é visível no Actions no mesmo dia, não às 03:00.

**Non-Goals:**

- Executar Jobs agendados no deploy.
- Desfazer o deploy do serviço quando a atualização de um Job falha.
- Remover o `ignore_changes` e passar a imagem pelo Terraform.

## Decisions

### D1 — A lista de Jobs é declarada no Terraform e entregue por variável de repositório

Um mapa em `locals.tf` declara cada Job que acompanha a imagem e sua service
account de runtime:

```hcl
deploy_updated_jobs = {
  bootstrap       = { job = google_cloud_run_v2_job.bootstrap,              sa = google_service_account.api }
  trash_purge     = { job = google_cloud_run_v2_job.trash_purge,            sa = google_service_account.trash_purge_job }
  notify_grants   = { job = google_cloud_run_v2_job.notify_expiring_grants, sa = google_service_account.notify_expiring_grants_job }
  notify_readings = { job = google_cloud_run_v2_job.notify_readings,        sa = google_service_account.notify_readings_job }
}
```

Dele saem as permissões (D2) e o output `deploy_updated_job_names` (nomes
separados por espaço), copiado para a variável de repositório
`GCP_DEPLOY_UPDATED_JOBS`, no mesmo padrão de `GCP_MIGRATE_JOB`.

O Job de migração **não** entra no mapa: o pipeline já o atualiza e executa
antes do deploy, e ele tem a sua própria concessão, normatizada à parte.

_Alternativa descartada:_ descobrir os Jobs em tempo de deploy com
`gcloud run jobs list --filter=labels.app=papelhub`. Pegaria Jobs novos sem
configuração alguma, mas `run.jobs.list` só se concede no **projeto**: a
identidade do pipeline passaria a enxergar todos os Jobs do projeto. Contraria o
privilégio mínimo por recurso que `cicd.tf` mantém de propósito.

_Alternativa descartada:_ nomes fixos no `deploy.yml`. Duplicaria o
`name_prefix` em dois lugares e um Job novo exigiria editar o workflow e a
permissão separadamente — que é o esquecimento que a Armadilha 10 descreve.

### D2 — Permissão por recurso, derivada do mesmo mapa

Em `cicd.tf`:

- `google_cloud_run_v2_job_iam_member.deployer_run_developer_jobs` com
  `for_each = local.deploy_updated_jobs`: `roles/run.developer` em cada Job.
- `google_service_account_iam_member.deployer_act_as_job_runtime` com
  `for_each` sobre as service accounts **distintas** do mapa, **excluída a da
  API**, que já tem `deployer_act_as_api`. Deduplicar evita dois recursos
  Terraform gerenciando o mesmo binding.

`run.developer` cobre update e também execute. A identidade **poderia**
executar os Jobs; o workflow não executa (D3). Não existe papel predefinido de
"atualizar sem executar", e um papel customizado seria mais um artefato para
manter por uma diferença que o próprio workflow já garante.

### D3 — O passo roda depois do deploy do serviço, e só atualiza

Ordem no `deploy.yml`: migração → deploy do serviço → **atualizar Jobs**.

- **Depois das migrações:** um Job nunca recebe código que espera um schema
  ainda não aplicado.
- **Depois do deploy, não antes:** uma falha de permissão num Job não deve
  impedir que o serviço receba a correção que motivou o deploy. O serviço é o
  que os usuários veem; o Job atrasado é exatamente o estado de hoje, com a
  diferença de que agora o Actions fica vermelho.
- **Sem `--execute-now` nem `jobs execute`:** o `trash-purge` apaga objetos
  definitivamente; os de aviso mandam notificações. Disparo fora de hora é
  efeito colateral do deploy, não alinhamento de imagem.

O passo percorre a lista com `set -euo pipefail` e para no primeiro erro,
nomeando o Job. A mesma imagem `${IMAGE}:${TARGET_SHA}` do serviço — nunca
`:latest`, que poderia ser de outro run concorrente.

### D4 — Variável ausente falha alto, e a ordem de implantação é documentada

Se `GCP_DEPLOY_UPDATED_JOBS` estiver vazia, o passo falha com:

```
GCP_DEPLOY_UPDATED_JOBS vazia: preencha a variável de repositório com o output
`terraform output -raw deploy_updated_job_names`.
```

Lista vazia que "passa" seria o defeito de hoje com outra cara.

Consequência: integrar o `deploy.yml` antes de configurar a variável deixa o
primeiro deploy vermelho **depois** de o serviço ter sido implantado — inócuo,
mas ruidoso. Por isso a ordem nas tarefas é: `terraform apply` → variável no
GitHub → merge. Se invertida, a correção é preencher a variável e usar o
disparo manual do workflow.

## Risks / Trade-offs

- **[Variável desatualizada]** Job novo declarado no Terraform, mas a variável
  não foi atualizada → o Job fica fora do alinhamento, sem erro. Mitigação: a
  Armadilha 10 do runbook (revisão de Job novo) passa a incluir "atualizar
  `GCP_DEPLOY_UPDATED_JOBS` com o output". Fica como verificação humana; o
  pipeline não tem como saber de um Job que não lhe foi informado sem a
  permissão de listagem recusada em D1.
- **[Tempo de deploy]** quatro `jobs update` sequenciais acrescentam algo como
  30–60 s ao workflow. Aceitável; não está no caminho do tráfego.
- **[`run.developer` permite executar]** ver D2. O risco é um workflow futuro
  passar a executar Jobs sem revisão; o requisito da spec ("NÃO SHALL executar")
  é o guarda.
- **[Validação só em produção]** o sandbox não alcança o GCP nem o registro de
  providers: `terraform validate`/`plan` e o run real do workflow só acontecem
  no Cloud Shell e no Actions. As tarefas trazem o `plan` esperado para conferir.
