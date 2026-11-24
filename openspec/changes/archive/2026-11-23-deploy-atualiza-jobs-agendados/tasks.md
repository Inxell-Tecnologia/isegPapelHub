# Tasks

> Mudança de **CI/CD e IAM**. Nenhuma rota, migration, tela ou spec de produto
> muda. A implantação tem ordem obrigatória (seção 5): permissões e variável
> antes do merge do workflow (design.md D4).

## 1. Terraform — origem única da lista

- [x] 1.1 `locals.tf`: mapa `deploy_updated_jobs` com `bootstrap`, `trash_purge`,
      `notify_grants` e `notify_readings`, cada um com o recurso do Job e a
      service account de runtime (design.md D1). Comentário explicando por que o
      Job de migração fica de fora.
- [x] 1.2 `cicd.tf`: `google_cloud_run_v2_job_iam_member.deployer_run_developer_jobs`
      (`for_each` no mapa, `roles/run.developer`).
- [x] 1.3 `cicd.tf`: `google_service_account_iam_member.deployer_act_as_job_runtime`
      (`for_each` nas service accounts **distintas** do mapa, excluída a da API,
      que já tem `deployer_act_as_api`; `roles/iam.serviceAccountUser`) — design.md
      D2.
- [x] 1.4 `outputs.tf`: `deploy_updated_job_names`, nomes separados por espaço,
      em ordem estável.
- [x] 1.5 `terraform fmt -check` no diretório. Verificar: sem diferenças.

## 2. Pipeline

- [x] 2.1 `deploy.yml`: passo "Update scheduled and bootstrap job images" **depois**
      de "Deploy to Cloud Run", percorrendo `vars.GCP_DEPLOY_UPDATED_JOBS` com
      `gcloud run jobs update --image "${IMAGE}:${TARGET_SHA}"`, `set -euo
      pipefail` e o nome do Job em cada linha de log (design.md D3). Sem
      `execute`.
- [x] 2.2 Mesmo passo: variável vazia ou ausente → `exit 1` com a mensagem de
      design.md D4.
- [x] 2.3 Verificar o YAML (parse) e, se disponível, `actionlint`.

## 3. Documentação

- [x] 3.1 Runbook, Fase 2: `GCP_DEPLOY_UPDATED_JOBS` na tabela de variáveis, com a
      origem (output `deploy_updated_job_names`).
- [x] 3.2 Runbook, Fase 4 passo 6 e "Atualização de uma implantação no ar" passo
      4: o alinhamento passa a ser automático; o laço `gcloud` fica como
      recuperação (deploy vermelho no passo novo, ou Job criado por `apply`
      depois do último deploy).
- [x] 3.3 Runbook, Armadilha 10: incluir no checklist de Job novo "acrescentar
      ao mapa `deploy_updated_jobs` e atualizar `GCP_DEPLOY_UPDATED_JOBS`".
- [x] 3.4 `infra/terraform/README.md`: linha da variável nova na tabela de
      variáveis do GitHub.

## 4. Verificação local

- [x] 4.1 `npm run format:check` (o workflow e o Terraform não são formatados
      pelo Prettier, mas o Markdown fora de `docs/` e `openspec/` é).
- [x] 4.2 `openspec validate deploy-atualiza-jobs-agendados --strict`.

## 5. Implantação em produção (Cloud Shell + GitHub, nesta ordem)

> **Arquivado em 23/11/2026 com esta seção aberta, por decisão.** O código e a
> documentação (seções 1–4) estão prontos; estas tarefas são operação em
> produção, fora do alcance do ambiente de desenvolvimento, e seguem como
> checklist do PR. Até concluí-las, o passo novo do deploy falha (variável
> vazia) **depois** de o serviço ser implantado — inócuo, mas vermelho.
>
> **Concluída em produção em 23/11/2026, após o archive.** Evidências:
> `terraform plan` com 7 criações (4 `deployer_run_developer_jobs`, 3
> `deployer_act_as_job_runtime`), 0 destruições e só as alterações cosméticas
> conhecidas; output `deploy_updated_job_names` = `papelhub-prod-bootstrap
> papelhub-prod-notify-grants papelhub-prod-notify-readings
> papelhub-prod-trash-purge`, copiado para `GCP_DEPLOY_UPDATED_JOBS`; merge do
> PR #4 (`836db27`) com o passo novo verde; serviço e os cinco Jobs na mesma
> imagem `:836db27…`; última execução do `trash-purge` às `06:00:02Z` (o
> agendamento das 03:00), nenhuma no horário do deploy.

- [x] 5.1 Com a branch do PR em checkout no Cloud Shell: `terraform plan`.
      Esperado: **só criações** — 4 `deployer_run_developer_jobs` e 3
      `deployer_act_as_job_runtime` — mais o output novo, e as alterações
      cosméticas conhecidas (`client = "gcloud"`). Nenhum `destroy`/`replace`.
- [x] 5.2 `terraform apply` e `terraform output -raw deploy_updated_job_names`.
- [x] 5.3 GitHub → Settings → Variables: criar `GCP_DEPLOY_UPDATED_JOBS` com o
      valor do output.
- [x] 5.4 Merge do PR (merge commit). Conferir no Actions o passo novo verde,
      com os quatro Jobs listados.
- [x] 5.5 Conferir que os cinco Jobs e o serviço apontam para a mesma imagem
      (`gcloud run jobs describe … --format="value(spec.template.spec.template.spec.containers[0].image)"`
      para cada um, e o mesmo para o serviço).
- [x] 5.6 Conferir que nenhum Job foi executado pelo deploy:
      `gcloud run jobs executions list --job=papelhub-prod-trash-purge --limit=1`
      não mostra execução no horário do deploy.
