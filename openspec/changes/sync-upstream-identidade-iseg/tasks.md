# Tasks

> Duas frentes: **sincronização** (Terraform/CI, seções 1–3) e
> **identidade ISEG** (apresentação, seções 4–7). As tarefas de infraestrutura
> (Terraform/GCP/GitHub) estão separadas das de paridade de dev; não há
> mudança no SessionStart hook nem no sandbox — `fake-gcs-server` e Postgres
> local seguem iguais, só rodam as migrations novas do upstream.

## 1. Merge do upstream (design.md D1, D9)

- [ ] 1.1 `git remote add upstream https://github.com/CarlosSalesNaturalTec/GDoc`
      (se ausente), `git fetch upstream main` e `git merge --no-ff upstream/main`
      na branch de trabalho. Verificar: exatamente os 5 conflitos previstos
      (`infra/terraform/{README.md,cicd.tf,cloud_run.tf,outputs.tf,scheduler.tf}`).
- [ ] 1.2 Resolver `cicd.tf`, `outputs.tf`, `cloud_run.tf`, `scheduler.tf` com a
      versão do upstream. Verificar:
      `git diff upstream/main -- infra/terraform/{cicd,outputs,cloud_run,scheduler}.tf`
      vazio e `grep -rn '<<<<<<<\|>>>>>>>' infra .github` sem resultado.
- [ ] 1.3 Resolver `infra/terraform/README.md`: tabela do upstream
      (`GCP_DEPLOY_UPDATED_JOBS`) + o aviso "Actions desabilitado em repositório
      novo" do fork. Verificar: o diff contra `upstream/main` contém só o aviso.
- [ ] 1.4 Conflito silencioso do `deploy.yml`: remover os passos "Update
      bootstrap / trash purge / notify expiring grants job image". Verificar:
      `git diff upstream/main -- .github/workflows/deploy.yml` vazio e
      `grep -n "GCP_BOOTSTRAP_JOB\|GCP_TRASH_PURGE_JOB\|GCP_NOTIFY_GRANTS_JOB" .github`
      sem resultado.
- [ ] 1.5 Revisar os demais arquivos que o fork alterou e mesclaram limpos
      (`bootstrap_job.tf`, `migrate_job.tf`, `pubsub.tf`, `secret_manager.tf`,
      `apps/api/Dockerfile`, `apps/api/scripts/copy-migrations.mjs`) contra o
      upstream: nenhuma concessão, `depends_on` ou `lifecycle` duplicado.
      Verificar: `terraform -chdir=infra/terraform validate` (com
      `terraform init -backend=false`) passa e `terraform fmt -check` passa.
- [ ] 1.6 `npm ci`, `npm run migrate --workspace apps/api` e
      `npm run seed --workspace apps/api` no Postgres local; depois `npm run lint`,
      `npm run build`, `npm run test`, `npm run format:check` todos verdes.
- [ ] 1.7 Commitar o merge (mensagem pt_BR descrevendo a resolução de cada
      conflito) **antes** de qualquer troca de identidade.

## 2. Estado do Terraform da implantação ISEG (design.md D2) — infraestrutura

- [ ] 2.1 Criar `infra/terraform/moved_fork_iseg.tf` com `moved` de
      `deployer_run_developer_{bootstrap,trash_purge,notify_expiring_grants}_job`
      para `deployer_run_developer_jobs["bootstrap"|"trash_purge"|"notify_grants"]`
      e de `deployer_act_as_{trash_purge,notify_expiring_grants}_job` para
      `deployer_act_as_job_runtime["gdoc-prod-trash-purge"|"gdoc-prod-notify-grants"]`,
      com comentário explicando que é só do fork e removível após o primeiro
      apply. Verificar: `terraform validate` passa.
- [x] 2.2 (Operador, com acesso ao state) Confirmar as chaves com
      `terraform state list | grep deployer_`. **Conferido em 2026-11-24** no
      state `gs://isegpapelhub-terraform-state/bootstrap-infrastructure`
      (checkout em `c58882b`): os 5 endereços de origem existem
      (`deployer_run_developer_{bootstrap,trash_purge,notify_expiring_grants}_job`,
      `deployer_act_as_{trash_purge,notify_expiring_grants}_job`); `account_id`
      = `gdoc-prod-trash-purge` e `gdoc-prod-notify-grants`, confirmados também
      por `gcloud iam service-accounts list`. Os demais recursos `deployer_*` do
      state (`deployer_run_developer`, `deployer_run_developer_migrate_job`,
      `deployer_act_as_api`) têm o mesmo nome no upstream e não precisam de
      `moved`.
- [ ] 2.3 (Operador, depois do merge) `terraform plan` com o código mesclado:
      0 destroy, os 5 recursos aparecem como "has moved to"; só adições para o
      que vem do upstream (Job/scheduler `notify-readings` e suas concessões).
      Registrar o resultado nesta tarefa.

## 3. CI/CD e GitHub — infraestrutura

- [ ] 3.1 (Operador) Criar a variável de repositório `GCP_DEPLOY_UPDATED_JOBS`
      com `terraform output -raw deploy_updated_job_names` **antes** do merge em
      `main`. Verificar: Settings → Variables lista a variável não vazia.
- [ ] 3.2 `var.github_repository` default → `Inxell-Tecnologia/isegPapelHub`.
      Verificar: `terraform plan` não altera o WIF (o tfvars real já define o
      valor) ou, se alterar, a condição passa a apontar para este repositório.
- [ ] 3.3 (Operador) Confirmar GitHub Pages do fork com Source: GitHub Actions.
      Verificar: `https://inxell-tecnologia.github.io/isegPapelHub/` responde
      200 depois do workflow `docs.yml`.

## 4. Identificação do cliente

- [ ] 4.1 `.env.example`: `APP_CLIENT_NAME=ISEG`; `variables.tf`:
      `app_client_name` default `"ISEG"`; `terraform.tfvars.example`: exemplo
      `app_client_name = "ISEG"`. Verificar:
      `grep -rn "SETES" .env.example infra/terraform` sem resultado.
- [ ] 4.2 `CANONICAL_MANUAL_URL` (`apps/api/src/config.ts`) e `site_url`
      (`docs/manual/mkdocs.yml`) → `https://inxell-tecnologia.github.io/isegPapelHub/`
      no mesmo commit, com os fixtures da web que repetem o endereço. Verificar:
      `npm run test --workspace apps/api -- src/__tests__/config-manual-url.test.ts`
      passa e `grep -rn "carlossalesnaturaltec.github.io" apps docs/manual` vazio.
- [ ] 4.3 Fixtures de teste com `clientName: 'SETES'` passam a `'ISEG'` (só
      coerência; nenhuma asserção depende do valor). Verificar:
      `grep -rn "'SETES'" apps/*/src` vazio e testes verdes.

## 5. Ativos da marca (design.md D3, D4)

- [ ] 5.1 Versionar as artes do cliente em `docs/images/iseg/`
      (`iseg-original-simbolo.jpg` 1080×1080, `iseg-original-horizontal.jpg`
      1280×560) e o script `derivar_marca.py` (desmistura com tinta local,
      negativa por saturação). Verificar: `python3 -I derivar_marca.py` roda sem
      dependência além de Pillow (e NumPy, se usado, registrado no cabeçalho).
- [ ] 5.2 Gerar e copiar para `apps/web/public/` `iseg-logo-negativa.png`
      (~144 px de altura), `iseg-simbolo-negativo.png` e `iseg-simbolo-cor.png`
      (400 px) e `favicon.png` (64×64). Verificar: `file` reporta RGBA; prancha de
      inspeção (scratchpad) sobre o degradê escuro e a superfície clara, sem
      franja branca e com o degradê preservado.
- [ ] 5.3 Remover `isetes-logo-branca.png`, `isetes-logo-cor.png`,
      `isetes-simbolo.png` de `apps/web/public/` e
      `docs/manual/docs/assets/isetes-simbolo.png`. Verificar:
      `grep -rnE "isetes-(logo|simbolo)" apps/web/src docs/manual` vazio (nomes
      de change em comentários permanecem como rastro).

## 6. Paleta e marca no shell/login (design.md D5–D8)

- [ ] 6.1 Valores de `paleta` em `theme.ts` conforme D5, sem renomear tokens;
      cabeçalho registra que os nomes são papéis herdados (D6) e cada token traz
      as razões reapuradas.
- [ ] 6.2 `contraste.test.ts`: tabela reapurada, incluindo destaque × topo e
      × base do degradê (≥ 3:1) e o teto demonstrativo da marca d'água da
      navegação. Verificar: `npm run test --workspace apps/web -- src/__tests__/contraste.test.ts`.
- [ ] 6.3 `ATIVOS_DA_MARCA` (`BrandMark.tsx`): logo negativa com nome
      "ISEG — Instituto de Soluções Estratégicas em Gestão", símbolo negativo,
      `simboloSobreClaro` com o símbolo colorido.
- [ ] 6.4 `MarcaDaguaDaAreaPrincipal` usa `simboloSobreClaro`; constantes
      `COR_MAIS_CLARA_DO_SIMBOLO`/`COR_MAIS_ESCURA_DO_SIMBOLO` medidas nos
      ativos gerados (D7); comentários sem ISETES.
- [ ] 6.5 `MarcaDoProduto`: largura da logo validada contra o orçamento de
      altura da navegação a 768 px (D8); comentários sem ISETES.
- [ ] 6.6 `login.test.tsx` e `shell-identidade-visual.test.tsx` apontam para os
      novos ativos e o novo nome acessível. Verificar:
      `grep -rni "instituto setes\|isetes" apps/web/src --include=*.tsx --include=*.ts`
      só encontra nomes de change em comentários.

## 7. Manual

- [ ] 7.1 `mkdocs.yml`: logo = símbolo negativo, favicon = símbolo colorido,
      paleta `custom` com `stylesheets/marca.css` nas cores da D5.
- [ ] 7.2 `a-tela.md`, `primeiro-acesso.md` (e `index.md`, se citar endereço de
      outra implantação): logo, símbolo, cores e exemplo de identificação do
      ISEG. Verificar: `grep -rni "setes\|isetes" docs/manual/docs` vazio e
      `mkdocs build --strict` passa.

## 8. Verificação final

- [ ] 8.1 `npm run lint`, `npm run build`, `npm run test`, `npm run format:check`.
- [ ] 8.2 Subir API + SPA e capturar login (1366 e 375 px) e shell expandido e
      colapsado para inspeção visual (scratchpad); conferir favicon e marcas
      d'água.
- [ ] 8.3 Simular o próximo sync: `git merge-tree --write-tree HEAD upstream/main`
      sem conflitos (o upstream já é ancestral).

## Workflow follow-up

- Abrir PR da branch para `main` e integrar com **merge commit** (nunca squash);
  só depois das tarefas 3.1 e 3.3.
- Após o deploy: `terraform apply` (tarefa 2.3), remover as variáveis
  `GCP_BOOTSTRAP_JOB`, `GCP_TRASH_PURGE_JOB`, `GCP_NOTIFY_GRANTS_JOB`.
- Ao arquivar: atualizar o _Purpose_ de `identidade-visual`, que cita o
  Instituto SETES/SETES como logomarca e exemplo de identificação.
