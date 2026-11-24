# Tasks

> Duas frentes: **sincronização** (Terraform/CI, seções 1–3) e
> **identidade ISEG** (apresentação, seções 4–7). As tarefas de infraestrutura
> (Terraform/GCP/GitHub) estão separadas das de paridade de dev; não há
> mudança no SessionStart hook nem no sandbox — `fake-gcs-server` e Postgres
> local seguem iguais, só rodam as migrations novas do upstream.

## 1. Merge do upstream (design.md D1, D9)

- [x] 1.1 `git remote add upstream https://github.com/CarlosSalesNaturalTec/GDoc`
      (se ausente), `git fetch upstream main` e `git merge --no-ff upstream/main`
      na branch de trabalho. Verificar: exatamente os 5 conflitos previstos
      (`infra/terraform/{README.md,cicd.tf,cloud_run.tf,outputs.tf,scheduler.tf}`).
- [x] 1.2 Resolver `cicd.tf`, `outputs.tf`, `cloud_run.tf`, `scheduler.tf` com a
      versão do upstream. Verificar:
      `git diff upstream/main -- infra/terraform/{cicd,outputs,cloud_run,scheduler}.tf`
      vazio e `grep -rn '<<<<<<<\|>>>>>>>' infra .github` sem resultado.
- [x] 1.3 Resolver `infra/terraform/README.md`: tabela do upstream
      (`GCP_DEPLOY_UPDATED_JOBS`) + o aviso "Actions desabilitado em repositório
      novo" do fork. Verificar: o diff contra `upstream/main` contém só o aviso.
      (O parágrafo do fork sobre os recursos IAM por Job, obsoleto depois do
      merge, foi descartado.)
- [x] 1.4 Conflito silencioso do `deploy.yml`: remover os passos "Update
      bootstrap / trash purge / notify expiring grants job image". Verificar:
      `git diff upstream/main -- .github/workflows/deploy.yml` vazio e
      `grep -n "GCP_BOOTSTRAP_JOB\|GCP_TRASH_PURGE_JOB\|GCP_NOTIFY_GRANTS_JOB" .github`
      sem resultado.
- [x] 1.5 Revisar os demais arquivos que o fork alterou e mesclaram limpos
      (`bootstrap_job.tf`, `migrate_job.tf`, `pubsub.tf`, `secret_manager.tf`,
      `apps/api/Dockerfile`, `apps/api/scripts/copy-migrations.mjs`) contra o
      upstream: nenhuma concessão, `depends_on` ou `lifecycle` duplicado.
      **Achado:** `deletion_protection` ficava declarado duas vezes em
      `bootstrap_job.tf` e `migrate_job.tf` (segundo conflito silencioso, HCL
      inválido) — fica a declaração do upstream. Permanecem do fork a versão
      placeholder do secret de bootstrap e o `depends_on` da conta do Pub/Sub
      (estão no state de produção, sem equivalente no upstream); `Dockerfile` e
      `copy-migrations.mjs` voltam ao texto do upstream. Verificado:
      `terraform fmt -check` passa. `terraform validate` não roda neste
      ambiente (registry do Terraform bloqueado pela rede) — fica coberto pelo
      `plan` da tarefa 2.3.
- [x] 1.6 `npm ci`, `npm run migrate --workspace apps/api` e
      `npm run seed --workspace apps/api` no Postgres local (27 migrations);
      `npm run lint`, `npm run build`, `npm run test` (616 API, 538 web) e
      `npm run format:check` verdes.
- [x] 1.7 Commitar o merge (mensagem pt_BR descrevendo a resolução de cada
      conflito) **antes** de qualquer troca de identidade (`7d6d0fc`).

## 2. Estado do Terraform da implantação ISEG (design.md D2) — infraestrutura

- [x] 2.1 Criar `infra/terraform/moved_fork_iseg.tf` com `moved` de
      `deployer_run_developer_{bootstrap,trash_purge,notify_expiring_grants}_job`
      para `deployer_run_developer_jobs["bootstrap"|"trash_purge"|"notify_grants"]`
      e de `deployer_act_as_{trash_purge,notify_expiring_grants}_job` para
      `deployer_act_as_job_runtime["gdoc-prod-trash-purge"|"gdoc-prod-notify-grants"]`,
      com comentário explicando que é só do fork e removível após o primeiro
      apply. Verificado: `terraform fmt -check`; as chaves conferem com
      `local.deploy_updated_jobs` e com o state (2.2). `validate` no plan (2.3).
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
- [ ] 2.3 (Operador, depois do merge em `main` e do deploy) No Cloud Shell,
      com o código mesclado: `terraform validate` e `terraform plan` — 0
      destroy, os 5 recursos aparecem como "has moved to"; só adições para o
      que vem do upstream (Job/scheduler `notify-readings`, sua conta e
      concessões). Então `terraform apply`. Registrar o resultado nesta tarefa.

## 3. CI/CD e GitHub — infraestrutura

- [ ] 3.1 (Operador) Variável de repositório `GCP_DEPLOY_UPDATED_JOBS`, em duas
      etapas — o output `deploy_updated_job_names` só existe no state depois do
      apply com o código mesclado, e inclui o Job `notify-readings`, que também
      só passa a existir ali:
      (a) **antes** do merge em `main`: criar com os nomes dos três Jobs que já
      existem, separados por espaço — os valores atuais de `GCP_BOOTSTRAP_JOB`,
      `GCP_TRASH_PURGE_JOB` e `GCP_NOTIFY_GRANTS_JOB`. **Feito em 2026-11-24:**
      `gdoc-prod-bootstrap gdoc-prod-trash-purge gdoc-prod-notify-grants`
      (conferidos com `gcloud run jobs list`);
      (b) **depois** do apply da tarefa 2.3: trocar pelo valor de
      `terraform output -raw deploy_updated_job_names` e remover as três
      variáveis antigas.
      Verificar: o passo "Update scheduled and bootstrap job images" do primeiro
      deploy fica verde.
- [x] 3.2 `var.github_repository` default → `Inxell-Tecnologia/isegPapelHub`
      (e a menção no `infra/terraform/README.md`). Sem efeito se o
      `terraform.tfvars` de produção já define o valor; confirmar no plan da 2.3
      que a condição do WIF não muda ou passa a apontar para este repositório.
- [ ] 3.3 (Operador) Confirmar GitHub Pages do fork com Source: GitHub Actions.
      Verificar: `https://inxell-tecnologia.github.io/isegPapelHub/` responde
      200 depois do workflow `docs.yml`.

## 4. Identificação do cliente

- [x] 4.1 `.env.example`: `APP_CLIENT_NAME=ISEG`; `variables.tf`:
      `app_client_name` default `"ISEG"`; `terraform.tfvars.example`: exemplo
      `app_client_name = "ISEG"`. Verificado:
      `grep -rn "SETES" .env.example infra/terraform` só encontra `ISETES` em
      nomes de change.
- [x] 4.2 `CANONICAL_MANUAL_URL` (`apps/api/src/config.ts`) e `site_url`
      (`docs/manual/mkdocs.yml`) → `https://inxell-tecnologia.github.io/isegPapelHub/`
      no mesmo commit, com os fixtures da web, `.env.example`
      (`APP_MANUAL_URL`), `terraform.tfvars.example` e `README.md`. Verificado:
      `config-manual-url.test.ts` passa e
      `grep -rn "carlossalesnaturaltec.github.io" apps docs/manual` vazio.
- [x] 4.3 Fixtures de teste com `clientName: 'SETES'` passam a `'ISEG'` (só
      coerência; nenhuma asserção depende do valor). Nomes de unidade de
      fixture (`'Sede ISETES'`) ficam: são dado arbitrário, não identificação do
      cliente, e trocá-los só aumentaria o conflito nos próximos syncs.

## 5. Ativos da marca (design.md D3, D4)

- [x] 5.1 Versionar as artes do cliente em `docs/images/iseg/`
      (`iseg-original-simbolo.jpg` 1080×1080, `iseg-original-horizontal.jpg`
      1280×560) e o script `derivar_marca.py` (desmistura com tinta local,
      núcleo por platô, negativa por saturação). Roda com Pillow e NumPy.
- [x] 5.2 Gerar e copiar para `apps/web/public/` `iseg-logo-negativa.png`
      (319×144), `iseg-simbolo-negativo.png` e `iseg-simbolo-cor.png`
      (400×400) e `favicon.png` (64×64). Verificado: `file` reporta RGBA;
      prancha de inspeção sobre o degradê escuro e a superfície clara, sem
      franja branca e com o degradê preservado.
- [x] 5.3 Remover `isetes-logo-branca.png`, `isetes-logo-cor.png`,
      `isetes-simbolo.png` de `apps/web/public/` e
      `docs/manual/docs/assets/isetes-simbolo.png`. Verificado:
      `grep -rnE "isetes-(logo|simbolo)" apps/web/src docs/manual` vazio.

## 6. Paleta e marca no shell/login (design.md D5–D8)

- [x] 6.1 Valores de `paleta` em `theme.ts` conforme D5, sem renomear tokens;
      cabeçalho registra que os nomes são papéis herdados (D6) e cada token traz
      as razões reapuradas.
- [x] 6.2 `contraste.test.ts`: tabela reapurada, incluindo destaque × topo e
      × base do degradê (≥ 3:1) e o teto demonstrativo da marca d'água da
      navegação (22%). Verificado: o teste passa.
- [x] 6.3 `ATIVOS_DA_MARCA` (`BrandMark.tsx`): logo negativa com nome
      "ISEG — Instituto de Soluções Estratégicas em Gestão", símbolo negativo,
      `simboloSobreClaro` com o símbolo colorido.
- [x] 6.4 `MarcaDaguaDaAreaPrincipal` usa `simboloSobreClaro`; constantes
      `COR_MAIS_CLARA_DO_SIMBOLO = '#FFFFFF'` e
      `COR_MAIS_ESCURA_DO_SIMBOLO = '#444444'` medidas nos ativos (D7);
      tabelas dos comentários reapuradas.
- [x] 6.5 `MarcaDoProduto`: logo a 142 px de largura, mantendo os 64 px de
      altura do orçamento da navegação (D8); comentários sem ISETES.
- [x] 6.6 `login.test.tsx` e `shell-identidade-visual.test.tsx` apontam para os
      novos ativos e o novo nome acessível (lido de `ATIVOS_DA_MARCA`).
      Verificado: nenhum `Instituto SETES` ou `isetes-(logo|simbolo)` em
      `apps/web/src`.

## 7. Manual

- [x] 7.1 `mkdocs.yml`: logo = símbolo negativo, favicon = símbolo colorido,
      paleta `custom` com `stylesheets/marca.css` nas cores da D5.
- [x] 7.2 `a-tela.md` e `primeiro-acesso.md`: logo, símbolo, cores e exemplo de
      identificação do ISEG; `index.md`: o "endereço desta implantação" passa da
      URL do Cloud Run do GDoc para a do ISEG **divulgada aos usuários**,
      `https://gdoc-prod-api-1033018645624.us-central1.run.app/` (a URL que o
      console do Cloud Run exibe; o `terraform output -raw api_url` devolve a
      outra forma, `gdoc-prod-api-pbr7vkzcga-uc.a.run.app`, que atende o mesmo
      serviço). Verificado:
      `grep -rni "setes\|isetes\|hmwigy67mq" docs/manual/docs` vazio e
      `mkdocs build --strict` passa.

## 8. Verificação final

- [x] 8.1 `npm run lint`, `npm run build`, `npm run test` (616 API, 540 web),
      `npm run format:check`.
- [x] 8.2 API + SPA no ar; capturas do login (1366 e 375 px) e do shell
      expandido e colapsado: logo negativa sobre o verde-petróleo, item ativo
      laranja com rótulo escuro, marcas d'água sutis, menu sem rolagem a 768 px.
- [x] 8.3 Simular o próximo sync: `git merge-tree --write-tree HEAD upstream/main`
      sem conflitos (o upstream já é ancestral).

## Workflow follow-up

- Abrir PR da branch para `main` e integrar com **merge commit** (nunca squash);
  só depois das tarefas 3.1(a) e 3.3.
- Após o deploy: tarefa 2.3 (plan/apply) e 3.1(b).
- Ao arquivar: atualizar o _Purpose_ de `identidade-visual`, que cita o
  Instituto SETES/SETES como logomarca e exemplo de identificação.
