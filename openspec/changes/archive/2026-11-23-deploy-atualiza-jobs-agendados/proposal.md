# Proposal — deploy-atualiza-jobs-agendados

## Why

O pipeline de deploy atualiza a imagem de **um** Cloud Run Job só, o de migração.
Os outros quatro Jobs que rodam a imagem da aplicação — `trash-purge` (03:00),
`notify-grants` (03:30), `notify-readings` (03:45) e `bootstrap` — ficam na
imagem com que foram criados, até alguém rodar `gcloud run jobs update` à mão.
Ou seja: **divergem do serviço por padrão**, a cada deploy.

O custo já apareceu duas vezes:

- na Fase 4 da implantação da Forte Saúde, o Job de bootstrap ainda rodava a
  imagem placeholder e falhou com exit code 1 (commit `ffbcbec`);
- na atualização de produção de 23/11/2026, o Job novo `notify-readings` nasceu
  com o placeholder, e os três agendados tiveram de ser alinhados à mão (runbook,
  "Atualização de uma implantação no ar", passo 4).

O modo de falha é silencioso: Job agendado roda de madrugada, ninguém olha, e o
sintoma (lixeira que não expurga, aviso que não chega) aparece dias depois.
Também há o risco oposto: um Job numa imagem **antiga** contra um schema já
migrado. Era a tarefa 10.11 do change `implantacao-fortesaude`, transferida
para cá no arquivamento.

## What Changes

- **Pipeline (`.github/workflows/deploy.yml`):** depois do `gcloud run deploy`, um
  passo novo atualiza a imagem de cada Job da lista para o mesmo
  `${IMAGE}:${TARGET_SHA}` do serviço. **Só atualiza, não executa**: os agendados
  rodam no horário deles, e o `trash-purge` apaga dados definitivamente. Falha
  nesse passo deixa o workflow vermelho, mas o serviço já implantado fica como
  está.
- **Lista de Jobs com origem única no Terraform:** um mapa em `locals` declara
  cada Job que acompanha a imagem e a service account com que ele roda. O mesmo
  mapa gera as permissões e um output, `deploy_updated_job_names`, que vira a
  variável de repositório `GCP_DEPLOY_UPDATED_JOBS`.
- **Permissões da identidade do pipeline, por recurso** (`cicd.tf`):
  `roles/run.developer` em cada Job da lista e `roles/iam.serviceAccountUser` em
  cada service account de runtime que ainda não tenha. Atualizar um Job exige
  agir como a conta com que ele roda — a mesma exigência já atendida para o Job
  de migração.
- **Variável ausente falha alto:** se `GCP_DEPLOY_UPDATED_JOBS` estiver vazia, o
  passo falha com mensagem que nomeia a variável e o output de onde copiá-la. Uma
  lista vazia silenciosa recriaria exatamente o defeito que esta mudança resolve.
- **Documentação:** runbook (Fase 2, Fase 4 passo 6, "Atualização de uma
  implantação no ar", Armadilha 10) e `infra/terraform/README.md` passam a
  descrever o passo automático. O laço manual fica como recuperação.

Fora de escopo:

- Executar Jobs pelo pipeline (além do de migração, que já executa).
- Descobrir os Jobs por listagem no projeto (`gcloud run jobs list`): exigiria
  permissão de leitura no projeto inteiro para a identidade do pipeline (design.md
  D1).
- Ambiente de staging ou mudança no gate "sem efeito em produção".

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `platform-infrastructure`: novo requisito — os Jobs que reusam a imagem da
  aplicação acompanham a imagem implantada a cada deploy, sem serem executados,
  e a identidade do pipeline tem permissão por recurso para isso.

## Impact

- **CI/CD:** `.github/workflows/deploy.yml` (um passo novo, depois do deploy).
- **Terraform (`infra/terraform`):** `locals.tf` (mapa dos Jobs), `cicd.tf`
  (IAM `for_each`), `outputs.tf` (output novo). **Só adições** de IAM; nenhum
  recurso existente muda.
- **Configuração fora do repositório:** variável de repositório
  `GCP_DEPLOY_UPDATED_JOBS` no GitHub, preenchida a partir do output antes do
  merge.
- **Docs:** `docs/runbook-implantacao.md`, `infra/terraform/README.md`.
- **Aplicação, banco, specs de produto:** nada. Nenhuma rota, migration ou tela.
- **Ordem de implantação importa:** `terraform apply` (permissões) → variável no
  GitHub → merge. Invertida, o primeiro deploy fica vermelho no passo novo, com o
  serviço já implantado (design.md D4).
