# Runbook de implantação — PapelHub

Procedimento para levar um **projeto GCP vazio** até o primeiro acesso do
administrador global, e para **atualizar uma implantação que já está no ar**.
É genérico: cada implantação (cada fork por cliente — ver "Próximo cliente" no
fim) preenche a tabela abaixo e segue as fases. Nenhum comando cita recurso de
uma implantação específica; todos usam as variáveis de shell definidas na Fase 0.

Este documento é **procedimento**. As _decisões_ de infraestrutura — por que
Cloud SQL com IP público, por que a assinatura de URL sem chave exportada, por
que o PITR está desligado — ficam em
[`infra/terraform/README.md`](../infra/terraform/README.md), e cada passo aqui
remete ao arquivo que o sustenta, para que o comando possa ser conferido contra
a fonte em vez da prosa.

Origem: consolidado a partir do primeiro provisionamento real de um fork por
cliente (change `correcoes-herdadas-do-fork`). As armadilhas abaixo foram todas
vividas, não hipotéticas.

## Valores desta implantação

Preencha antes de começar. Os marcadores `<...>` deste documento referem-se a
esta tabela.

| O quê                         | Marcador                    | De onde vem                                                        |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------ |
| Projeto GCP                   | `<project_id>`              | criado no console, com billing                                     |
| Nº do projeto                 | `<nº-projeto>`              | console → Painel do projeto                                        |
| Região                        | `<region>`                  | `var.region` (padrão `us-central1`)                                |
| Prefixo de recursos           | `<name_prefix>`             | `${app_name}-${environment}` ([`locals.tf`](../infra/terraform/locals.tf)); padrão `gdoc-prod` |
| Identificação do cliente      | `<identificação do cliente>`| `var.app_client_name` — texto exibido sob **PapelHub** no login    |
| Repositório                   | `<owner>/<repo>`            | `var.github_repository` — único autorizado a implantar             |
| Administrador global inicial  | `<admin_email>`             | `var.bootstrap_admin_email`                                        |
| Manual do usuário             | `<url_do_manual>`           | GitHub Pages do repositório; `CANONICAL_MANUAL_URL` e `site_url`   |
| URL da API (forma hash)       | `<url_api_hash>`            | nasce na Fase 1 — `https://<name_prefix>-api-<hash>-<sufixo-região>.a.run.app` |
| URL da API (forma nº projeto) | `<url_api_numero>`          | nasce na Fase 1 — `https://<name_prefix>-api-<nº-projeto>.<region>.run.app` |

As **duas** formas de URL são a mesma Cloud Run. Ambas precisam constar em
`cors_allowed_origins` na Fase 5 — ver Armadilha 1.

Recursos derivados do prefixo: serviço `<name_prefix>-api`; Jobs
`<name_prefix>-migrate`, `<name_prefix>-bootstrap`, `<name_prefix>-trash-purge`,
`<name_prefix>-notify-grants`, `<name_prefix>-notify-readings`; instância
`<name_prefix>-pg`; bucket de arquivos `<project_id>-<name_prefix>-files`;
secrets `<name_prefix>-database-url`, `<name_prefix>-auth-session-secret`,
`<name_prefix>-bootstrap-admin-password`; repositório de imagens
`<name_prefix>-api`.

## Por que seis fases, e não uma lista de comandos

Três dependências são **circulares** — um passo precisa de um valor que só passa
a existir num passo posterior ao que você gostaria de executar. A fronteira entre
fases é exatamente o instante em que um desses valores nasce:

```
FASE 0  bucket de state          ← o Terraform não cria o bucket do próprio state
   │
FASE 1  terraform apply #1       ← nasce a URL do Cloud Run (imagem placeholder)
   │
FASE 2  8 variáveis no GitHub    ← dependem dos outputs da Fase 1
   │
FASE 3  push na main → CI → Deploy  ← nasce a imagem REAL; o schema é migrado
   │
FASE 4  secret da senha + Job de bootstrap  ← o Job precisa da imagem da Fase 3
   │
FASE 5  terraform apply #2       ← CORS e audience do Pub/Sub, com a URL da Fase 1
   │
FASE 6  primeiro login e validação funcional
```

Pular a ordem não produz erro claro: produz um serviço rodando a imagem de
exemplo do Cloud Run, ou um upload que falha com mensagem que não menciona
bucket, ou todo push do Pub/Sub virando 401. Ver **Armadilhas** no fim.

---

## Fase 0 — antes do Terraform

**Nasce aqui:** o bucket onde o Terraform guarda o próprio estado.

1. **Billing habilitado** no projeto (console GCP → Faturamento → vincular
   conta). Sem isso o `apply` falha ao habilitar as APIs de
   [`apis.tf`](../infra/terraform/apis.tf).

2. Autenticar e selecionar o projeto:

   ```bash
   gcloud auth application-default login     # NÃO é necessário no Cloud Shell
   export PROJECT_ID="<project_id>"
   export REGION="<region>"
   export NAME_PREFIX="<name_prefix>"
   gcloud config set project "$PROJECT_ID"
   ```

   Todos os comandos deste documento usam essas três variáveis. Numa sessão
   nova do terminal, exporte-as de novo antes de continuar.

   No Cloud Shell as credenciais de aplicação (ADC) já vêm servidas pelo
   ambiente e o provider do Google funciona direto — a documentação do Google é
   explícita quanto a isso. O `login` acima é para máquina local, onde o
   provider não encontra ADC e o `plan` falha pedindo credenciais.

3. **Pré-habilitar as APIs de base.** O `apis.tf` habilita as APIs que a
   aplicação usa, mas o Terraform só consegue habilitar qualquer coisa se as
   APIs de gerenciamento já estiverem ativas — mais uma circularidade. Ative-as
   com `gcloud` antes do primeiro `apply`:

   ```bash
   gcloud services enable \
     serviceusage.googleapis.com \
     cloudresourcemanager.googleapis.com \
     iam.googleapis.com \
     iamcredentials.googleapis.com \
     --project="$PROJECT_ID"
   ```

   > **API recém-habilitada demora a propagar.** Se o primeiro `apply` falhar
   > com `API [...] not enabled` ou `has not been used in project [...] before`,
   > espere um ou dois minutos e rode `terraform apply` de novo: o Terraform é
   > idempotente e retoma de onde parou. Uma retentativa no primeiro `apply` de
   > um projeto novo é esperada, não sintoma de erro de configuração.

4. **Criar o bucket de state.** O Terraform não pode criar o bucket em que vai
   guardar o próprio estado — é a primeira circularidade, e por isso este passo
   é manual:

   ```bash
   gsutil mb -l "$REGION" "gs://${PROJECT_ID}-terraform-state"
   gsutil versioning set on "gs://${PROJECT_ID}-terraform-state"
   ```

   O versionamento não é opcional: é o que permite recuperar um state corrompido
   por `apply` interrompido.

5. **Clonar o repositório.** Os passos seguintes editam arquivos dentro dele,
   então ele precisa estar em disco antes.

   **Onde rodar:** o **Cloud Shell** é o lugar natural — já vem com `git`,
   `gcloud`, `gsutil` e `terraform` instalados e já autenticado na sua conta
   Google. Alternativa: máquina local com `gcloud` e Terraform instalados.

   **Qual ref clonar — atenção:** a configuração desta implantação (defaults de
   `variables.tf`, os dois `.example` — ver "Próximo cliente") costuma viver
   numa **branch de trabalho** até a **Fase 3** integrá-la na `main`. Se você
   clonar `main` antes disso, vai encontrar os valores do repositório de origem.
   Clone a branch:

   ```bash
   cd ~
   git clone -b <branch-de-trabalho> https://github.com/<owner>/<repo>.git
   cd <repo>
   ```

   Depois da Fase 3, `main` já carrega tudo e o `-b` deixa de ser necessário.

   > ⚠️ **Não integre na `main` agora para "simplificar".** O merge dispara o
   > `Deploy`, que depende das variáveis de repositório criadas só na
   > **Fase 2** — sem elas o workflow falha no `gcloud` com valores vazios. O
   > merge é o primeiro passo da Fase 3, depois da Fase 2, de propósito.

   **Repositório privado:** o `git clone` por HTTPS vai pedir credenciais. Use
   seu usuário do GitHub e um **personal access token** com escopo de leitura do
   repositório como senha (a senha da conta não funciona mais). Se preferir SSH,
   cadastre a chave pública do Cloud Shell (`~/.ssh/id_*.pub`, ou gere uma com
   `ssh-keygen -t ed25519`) em GitHub → Settings → SSH and GPG keys e use
   `git clone -b <branch> git@github.com:<owner>/<repo>.git`.

   **Não rode `npm install`.** O caminho de provisionamento usa apenas
   `infra/terraform/`; o monorepo é compilado dentro da imagem de container, no
   CI (ver [`apps/api/Dockerfile`](../apps/api/Dockerfile)). Instalar as
   dependências aqui só gasta tempo e os 5 GB do Cloud Shell.

   **Conferir a versão do Terraform** — `versions.tf` exige `>= 1.7.0`:

   ```bash
   terraform version
   ```

   O Terraform que vem no Cloud Shell costuma ficar atrás da versão corrente.
   Se vier abaixo de 1.7, instale uma mais nova no seu diretório home — o
   `init` da Fase 1 falha com `Unsupported Terraform Core version` antes de
   tocar em qualquer recurso, então errar aqui é barato:

   ```bash
   TF_VER=1.9.8
   cd ~ && curl -fsSL -o tf.zip \
     "https://releases.hashicorp.com/terraform/${TF_VER}/terraform_${TF_VER}_linux_amd64.zip"
   mkdir -p ~/bin && unzip -o tf.zip -d ~/bin && rm tf.zip
   export PATH="$HOME/bin:$PATH"     # persista no ~/.bashrc se quiser
   terraform version
   cd ~/<repo>
   ```

6. **Preencher os arquivos locais** (ambos gitignored):

   ```bash
   cd infra/terraform
   cp backend.hcl.example backend.hcl
   cp terraform.tfvars.example terraform.tfvars
   ```

   Conferir em `terraform.tfvars`: `project_id`, `region` e
   `bootstrap_admin_email`. Conferir em `backend.hcl`: o `bucket` é o criado no
   passo 4. A identificação do cliente, o prefixo de recursos e o repositório
   autorizado **não precisam estar aqui** quando o fork já os fixou como
   _default_ em [`variables.tf`](../infra/terraform/variables.tf) (ver "Próximo
   cliente"); caso contrário, defina-os aqui. Em qualquer dos dois, confira que
   `app_name` é o pretendido **antes** do primeiro `apply` — ver "Não mexer →
   `name_prefix`".

   > ⚠️ **Estes dois arquivos existem SÓ neste clone.** São gitignored, não vão
   > para o GitHub e não estão no state. A **Fase 5 edita o `terraform.tfvars`
   > de novo** (CORS e audience do Pub/Sub), então este clone precisa sobreviver
   > entre a Fase 1 e a Fase 5.
   >
   > No Cloud Shell, o home de 5 GB persiste entre sessões, mas é **apagado após
   > 120 dias sem uso**, e o **modo efêmero** descarta tudo ao fim da sessão —
   > não use modo efêmero para esta implantação. Se precisar interromper por
   > muito tempo, guarde os valores (**menos a senha do administrador**) onde
   > você recupere depois.
   >
   > **Perder o clone não é perder a implantação:** o state fica no bucket GCS
   > do passo 3. Basta clonar de novo, recriar os dois arquivos a partir dos
   > `.example`, rodar `terraform init -backend-config=backend.hcl` e o
   > Terraform reencontra tudo. O `.terraform/` com os plugins dos provedores
   > também é recriado pelo `init`.

7. **Habilitar os workflows e o GitHub Pages — antes de qualquer push na
   `main`.** Se o repositório foi **forkado**, o GitHub chega com os workflows
   desabilitados: abra a aba **Actions** e, se aparecer "Workflows aren't being
   run on this forked repository", clique em **"I understand my workflows, go
   ahead and enable them"**. Fazer isto depois de já ter empurrado na `main`
   **não** recupera o evento perdido — ver Armadilha 4.

   Em seguida, **GitHub Pages**: Settings → Pages → **Source: GitHub Actions** (não "Deploy
   from a branch"). Sem isso o `deploy-pages@v4` de
   [`docs.yml`](../.github/workflows/docs.yml) falha e o manual não publica.

---

## Fase 1 — primeiro `terraform apply`

**Nasce aqui:** todos os recursos, e com eles a **URL do serviço Cloud Run** —
valor de que as Fases 2 e 5 dependem.

```bash
cd infra/terraform
terraform init -backend-config=backend.hcl
```

### 1a. Gravar a senha do administrador ANTES do apply completo

Este passo **não é opcional nem adiável**, e a ordem não é preferência:

O Job `<name_prefix>-bootstrap` recebe a senha por
`secret_key_ref` com `version = "latest"`
([`bootstrap_job.tf`](../infra/terraform/bootstrap_job.tf)), e **o Cloud Run
resolve `latest` no momento em que cria o Job**. O Terraform cria apenas o
_container_ do secret — a versão com a senha real é gravada pelo operador, de
propósito, para que a senha nunca entre no state. Logo, num projeto novo, o
`apply` completo **sempre** falha assim enquanto não houver versão:

```
Error: Error waiting to create Job: ... Error code 9, message:
spec.template.spec.containers[0].env[5].value_from.secret_key_ref.name:
Secret projects/<nº>/secrets/<name_prefix>-bootstrap-admin-password/versions/latest
was not found
```

Para romper a circularidade sem deixar a senha no state, crie **só o container
do secret** com um apply direcionado, grave a versão, e só então aplique tudo:

```bash
terraform apply -target=google_secret_manager_secret.bootstrap_admin_password
```

```bash
echo -n "SUA-SENHA-FORTE-AQUI" | gcloud secrets versions add \
  "${NAME_PREFIX}-bootstrap-admin-password" --data-file=- --project="$PROJECT_ID"
```

> ⚠️ **No Windows/PowerShell, NÃO use o `echo -n` acima.** `echo` é alias de
> `Write-Output` e `-n` casa com `-NoEnumerate` — não suprime a quebra de
> linha. Pior: ao encanar (`|`) para um executável nativo, o PowerShell anexa
> `\r\r\n`. O secret fica com a senha + 3 bytes invisíveis, o bootstrap grava
> o hash desse valor sujo e **todo login legítimo vira 401**, sem nenhum erro
> que aponte a causa. Grave byte-exato via arquivo:
>
> ```powershell
> # defina antes: $PROJECT_ID = "<project_id>"; $NAME_PREFIX = "<name_prefix>"
> $pw = "$env:TEMP\pw.bin"
> [System.IO.File]::WriteAllText($pw, "SUA-SENHA-FORTE-AQUI", (New-Object System.Text.UTF8Encoding($false)))
> gcloud secrets versions add "$NAME_PREFIX-bootstrap-admin-password" --data-file="$pw" --project=$PROJECT_ID
> Remove-Item $pw
> ```

**Conferir o que ficou gravado** — deve ser exatamente o número de caracteres da
senha, sem `0D`/`0A` no fim:

```bash
gcloud secrets versions access latest \
  --secret="${NAME_PREFIX}-bootstrap-admin-password" --project="$PROJECT_ID" | wc -c
```

```powershell
cmd /c "gcloud secrets versions access latest --secret=$NAME_PREFIX-bootstrap-admin-password --project=$PROJECT_ID > `"$env:TEMP\s.bin`""
[System.IO.File]::ReadAllBytes("$env:TEMP\s.bin").Length
```

### 1b. Apply completo

```bash
terraform plan
```

No `plan`, conferir duas coisas antes de aplicar:

- **Nada a destruir.** O projeto está vazio; qualquer `destroy` no plano
  significa que o backend aponta para um state de outro ambiente.
- **Os nomes saem com `<name_prefix>`.** Se saírem com outro prefixo, o
  `terraform.tfvars` local está sobrepondo `app_name` (ou o default não é o
  pretendido). É a última chance barata de corrigir: depois do `apply` o
  prefixo é imutável.

```bash
terraform apply
```

A API sobe com a imagem placeholder pública
(`us-docker.pkg.dev/cloudrun/container/hello`) — **esperado**: o serviço existe,
o código do PapelHub ainda não. Ver
[`cloud_run.tf`](../infra/terraform/cloud_run.tf), cujo
`lifecycle.ignore_changes` em `containers[0].image` entrega a propriedade da
imagem ao CI/CD a partir da Fase 3.

Guardar os outputs:

```bash
terraform output
```

**Registrar as DUAS formas de URL do serviço** (console → Cloud Run → serviço
`<name_prefix>-api`, ou o output `api_url` mais a forma com número de projeto)
na tabela do topo:

```
<url_api_hash>     https://<name_prefix>-api-<hash>-<sufixo-região>.a.run.app
<url_api_numero>   https://<name_prefix>-api-<nº-projeto>.<region>.run.app
```

Ambas são necessárias na Fase 5. Ver **Armadilha 1**.

---

## Fase 2 — variáveis de repositório no GitHub

**Nasce aqui:** a autorização do pipeline para falar com o projeto GCP.

GitHub → Settings → Secrets and variables → Actions → aba **Variables**
(_não_ Secrets: o controle de acesso é a condição do Workload Identity
Federation + IAM, não o sigilo destes valores — ver
[`cicd.tf`](../infra/terraform/cicd.tf)).

| Variável                         | Valor                                              |
| -------------------------------- | -------------------------------------------------- |
| `GCP_PROJECT_ID`                 | `<project_id>`                                     |
| `GCP_REGION`                     | `<region>`                                         |
| `GCP_ARTIFACT_REPOSITORY`        | output `artifact_registry_repository`               |
| `GCP_CLOUD_RUN_SERVICE`          | `<name_prefix>-api`                                |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | output `github_actions_workload_identity_provider` |
| `GCP_DEPLOYER_SERVICE_ACCOUNT`   | output `github_actions_deployer_service_account`   |
| `GCP_MIGRATE_JOB`               | output `migrate_job_name` (`<name_prefix>-migrate`) |
| `GCP_DEPLOY_UPDATED_JOBS`       | output `deploy_updated_job_names` (nomes separados por espaço) |

Sem chave de service account em lugar nenhum: o pool só aceita tokens OIDC do
repositório em `var.github_repository`. Se esse valor não for
`<owner>/<repo>`, o passo `auth` do deploy falha na troca
de token do STS **sem nomear o repositório esperado** — erro opaco cuja causa
é esta.

---

## Fase 3 — publicar a imagem real

**Nasce aqui:** a imagem do PapelHub no Artifact Registry, e o schema do banco
migrado.

1. Integrar a branch de trabalho na `main` — **merge commit, nunca squash**
   (convenção do repositório; o gate desta fase depende de `SHA^1` existir).

   É a branch que você clonou na Fase 0, passo 5. O merge só acontece **agora**,
   depois da Fase 2: é ele que dispara o `Deploy`, e o `Deploy` precisa das
   variáveis de repositório. Integrar antes produz um workflow vermelho por
   variáveis vazias.

   Depois do merge, atualize o clone antes de seguir para as Fases 4 e 5, para
   que o `terraform.tfvars` da Fase 5 seja editado sobre o código integrado:

   ```bash
   cd ~/<repo>
   git checkout main && git pull origin main
   ```

   Os arquivos `infra/terraform/backend.hcl` e `terraform.tfvars` são gitignored
   e **sobrevivem à troca de branch** — não precisam ser recriados.

2. Acompanhar Actions: `CI` → ao concluir com sucesso, dispara `Deploy`
   ([`deploy.yml`](../.github/workflows/deploy.yml)). O pipeline, nesta ordem:

   1. builda e empurra a imagem (`:<sha>` e `:latest`);
   2. `gcloud run jobs update <name_prefix>-migrate --image …`;
   3. `gcloud run jobs execute <name_prefix>-migrate --wait` — **migra o schema
      antes** de trocar o tráfego, para que a revisão nova nunca suba contra um
      banco desatualizado. Falha aqui aborta o workflow antes do deploy, e o
      tráfego permanece na revisão anterior;
   4. `gcloud run deploy <name_prefix>-api --image …`;
   5. `gcloud run jobs update --image …` em cada Job de
      `GCP_DEPLOY_UPDATED_JOBS` (bootstrap e agendados) — só atualiza, nunca
      executa.

3. **Se o `Deploy` aparecer como pulado** ("Detect merge with no effect on
   production"), o merge tocou apenas o _allowlist_ do gate. Ver
   **Armadilha 3** — a saída é Actions → **Deploy** → _Run workflow_ na `main`.

4. Confirmar que o `Docs` publicou o manual em `<url_do_manual>`. Num
   repositório recém-criado o site só existe depois do primeiro push que toca
   `docs/manual/**` — ver **Armadilha 5**.

---

## Fase 4 — administrador global inicial

**Nasce aqui:** a única conta capaz de criar as demais.

Não existe outro caminho seguro: o seed de desenvolvimento
(`npm run seed`) **se recusa** a rodar com `NODE_ENV=production`, e a aplicação
não tem auto-registro. O Job
[`<name_prefix>-bootstrap`](../infra/terraform/bootstrap_job.tf) roda
`apps/api/dist/db/bootstrap.js`, aplica migrações pendentes e cria **somente** o
`global_admin` — idempotente, _fail-closed_ sem as credenciais.

1. **A senha já foi gravada na Fase 1a** — era pré-requisito do `apply`. Se
   você chegou aqui sem ter feito isso, o `apply` da Fase 1 não teria concluído:
   volte à Fase 1a.

   Confirme que a versão existe antes de executar o Job:

   ```bash
   gcloud secrets versions list "${NAME_PREFIX}-bootstrap-admin-password" \
     --project="$PROJECT_ID"
   ```

2. **Se a senha gravada estava suja** (bytes invisíveis — ver o alerta da Fase
   1a), corrigir o secret agora **não basta**: `bootstrapAdmin()` é no-op quando
   já existe um `global_admin` (`apps/api/src/db/bootstrap.ts`), então ele **não
   reescreve o hash**. É preciso remover o admin e reexecutar o Job — e o
   `DELETE` tem de rodar dentro de uma transação com o bypass de RLS, senão a
   linha fica invisível:

   ```sql
   BEGIN;
   SELECT set_config('app.user_role','global_admin',true);
   DELETE FROM users WHERE role='global_admin';
   COMMIT;
   ```

   Isso só se aplica depois de uma execução que criou o admin — na primeira
   passagem, pule.

3. **Conferir a imagem do Job antes de executar.** O Job nasceu na Fase 1 com
   a imagem **placeholder** (`cloudrun/container/hello`). O deploy da Fase 3
   já o alinha à imagem real (passo 5 do pipeline); se esse passo ficou
   vermelho, ou se os Jobs foram criados depois do deploy, alinhe à mão.
   Executá-lo com o placeholder falha com
   `The container exited with an error` e `exit code: 1` — o container
   placeholder não tem Node nem o arquivo:

   ```bash
   IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${NAME_PREFIX}-api/api"

   gcloud run jobs update "${NAME_PREFIX}-bootstrap" --image "${IMAGE}:latest" \
     --project="$PROJECT_ID" --region="$REGION"
   ```

   Conferir antes e depois, se quiser ver a troca:

   ```bash
   gcloud run jobs describe "${NAME_PREFIX}-bootstrap" \
     --project="$PROJECT_ID" --region="$REGION" \
     --format='value(template.template.containers[0].image)'
   ```

4. **Executar o Job uma vez:**

   ```bash
   gcloud run jobs execute "${NAME_PREFIX}-bootstrap" \
     --project="$PROJECT_ID" --region="$REGION" --wait
   ```

5. **Conferir nos logs** que o administrador foi **criado**, e não que o Job foi
   no-op por já existir um `global_admin`.

6. **Atualizar também a imagem dos Jobs agendados.** Mesma situação: nasceram com
   o placeholder. Desde o change `deploy-atualiza-jobs-agendados`, **todo deploy
   faz isto sozinho** (passo "Update scheduled and bootstrap job images" do
   `deploy.yml`, com a lista de `GCP_DEPLOY_UPDATED_JOBS`); o laço abaixo é para
   quando os Jobs são criados **depois** do deploy, ou para recuperar um deploy
   que ficou vermelho nesse passo. Sem isto, o expurgo da lixeira (03:00), os
   avisos de expiração (03:30) e os de leitura obrigatória (03:45) falham
   silenciosamente todas as noites — são agendados, ninguém olha, e só se
   percebe quando a lixeira não expurga.

   ```bash
   for J in trash-purge notify-grants notify-readings; do
     J="${NAME_PREFIX}-${J}"
     gcloud run jobs update "$J" --image "${IMAGE}:latest" \
       --project="$PROJECT_ID" --region="$REGION"
   done
   ```

   > **`terraform apply` NÃO resolve isto.** Os Jobs declaram
   > `lifecycle.ignore_changes` no campo da imagem, para que um `apply` de rotina
   > não reverta o que o CI/CD publicou. O efeito colateral é que mudar
   > `var.api_image` também não os atualiza: o atributo é ignorado nos dois
   > sentidos. O caminho é o `deploy.yml` ou `gcloud run jobs update --image`.

> O e-mail `<admin_email>` é **identificador de acesso, não endereço de
> entrega**. O `NotificationPort` tem hoje só a implementação in-app
> (`in-app-notification-port.ts`): não existe canal de e-mail, logo não há DNS,
> SPF, DKIM nem entregabilidade a configurar, e nenhum fluxo do produto manda
> mensagem para esse endereço.

---

## Fase 5 — segundo `terraform apply`

**Nasce aqui:** o CORS do bucket e a validação OIDC do push do Pub/Sub — os dois
dependem da URL criada na Fase 1 e da imagem publicada na Fase 3.

1. Em `terraform.tfvars`, preencher `cors_allowed_origins` com **as duas** formas
   de URL registradas na Fase 1 (mais `http://localhost:5173` para dev):

   ```hcl
   cors_allowed_origins = [
     "http://localhost:5173",
     "<url_api_hash>",
     "<url_api_numero>",
   ]
   ```

2. Preencher `pubsub_push_audience`:

   ```hcl
   pubsub_push_audience = "<url_api_hash>/internal/storage-events"
   ```

   **Só agora**, porque a imagem com o validador OIDC já está publicada (Fase 3).
   Ver **Armadilha 2**.

3. Aplicar:

   ```bash
   terraform apply
   ```

4. **Conferir que a imagem real sobreviveu.** O `lifecycle.ignore_changes` em
   [`cloud_run.tf`](../infra/terraform/cloud_run.tf) existe para isso — o
   `apply` **não** deve reverter o serviço para a imagem placeholder. Se
   reverteu, não aplique de novo: investigue o `ignore_changes`.

> **Hotfix de CORS sem esperar um `apply`:**
> `gcloud storage buckets update "gs://${PROJECT_ID}-${NAME_PREFIX}-files" --cors-file=cors.json`.
> O `terraform apply` seguinte reconcilia e volta a ser a fonte da verdade —
> sem ele, o próximo `apply` reverteria o CORS para o default de dev.

---

## Fase 6 — validação funcional

1. **Abrir a URL do Cloud Run.** A tela de login deve mostrar a logomarca, o
   título **PapelHub** e, abaixo dele, `<identificação do cliente>`.

   Conferir a **acentuação**. O valor atravessa `terraform.tfvars` → env var do
   Cloud Run → JSON de `/auth/public-config` → React, tudo UTF-8; funciona, mas
   é a string que um terminal mal configurado corrompe. Se estiver errada,
   corrigir sem rebuild — o valor é resolvido em runtime:

   ```bash
   gcloud run services update "${NAME_PREFIX}-api" \
     --project="$PROJECT_ID" --region="$REGION" \
     --set-env-vars 'APP_CLIENT_NAME=<identificação do cliente>'
   ```

   (E reconciliar `terraform.tfvars`/`variables.tf` depois, para o próximo
   `apply` não reverter.)

2. **Preencher o endereço desta implantação no manual.** Com a URL confirmada,
   substituir o endereço em `docs/manual/docs/index.md` pelo `<url_api_hash>` e
   integrar. Esse commit toca só `docs/` — corretamente classificado como sem
   efeito em produção, e o `Docs` republica o site.

3. **Entrar com `<admin_email>`.** Conferir:

   - shell expandido mostra `<identificação do cliente>` sob a marca (colapsado
     não mostra, por desenho — não há largura para o subtítulo sem truncar);
   - aba do navegador mostra `PapelHub - <identificação do cliente>`;
   - o rodapé leva ao manual em `<url_do_manual>`.

4. **Enviar um arquivo de teste.** Este passo valida três coisas de uma vez: o
   CORS da Fase 5, a emissão de URL assinada, e a reconciliação de cota pelo
   push do Pub/Sub. Conferir que o espaço usado na tela de envio reflete o
   arquivo — se o arquivo subiu mas a cota não mudou, o problema está no push do
   Pub/Sub (Armadilha 2), não no upload.

5. **Cadastrar as pessoas reais** pela tela **Pessoas**. Confirmar que não
   existem contas de demonstração (`colaborador.a@…`, `admin.a@…`): a trava de
   produção no seed impede que sejam criadas, mas conferir é barato.

---

## Atualização de uma implantação no ar

As seis fases acima provisionam um projeto vazio. Esta seção é para **depois**:
integrar na `main` uma mudança que altera o Terraform de uma implantação que já
atende usuários — tipicamente um sync de um fork com este repositório, trazendo
migrations novas, variáveis de ambiente novas no serviço ou um Job agendado
novo.

Ordem — cada passo depende do anterior:

1. **Revisar o Terraform que chega** antes de qualquer coisa. Todo Job novo
   precisa cumprir o checklist da Armadilha 10. **`terraform plan`** em
   `infra/terraform`. O esperado é **só adição** e atualização no lugar.
   **Qualquer `destroy` ou `must be replaced` em bucket, Cloud SQL ou tópico
   Pub/Sub é motivo para parar** — com o `name_prefix` congelado, nada desta
   classe de mudança deveria recriar recurso com dado. Uma assinatura Pub/Sub
   como `will be created` é a Armadilha 9, não um erro do sync.
2. **`terraform apply`** — antes do merge quando a mudança traz permissões que o
   pipeline vai usar (ex.: IAM do deployer sobre um Job novo). Uma variável
   nova no serviço gera uma revisão com a imagem corrente (a imagem é
   `ignore_changes`; o `apply` não a reverte).
3. **Atualizar `GCP_DEPLOY_UPDATED_JOBS`** no GitHub se a lista de Jobs mudou:
   `terraform output -raw deploy_updated_job_names`.
4. **Merge na `main`** (merge commit). O `deploy.yml` publica a imagem, executa
   o Job de migração com as migrations novas, implanta a revisão nova do serviço
   e alinha a imagem dos Jobs. Conferir no Actions que o run terminou verde — e,
   nos logs do Job de migração, que as migrations novas foram **aplicadas**, não
   puladas.
5. **Executar cada Job novo (ou cujo entrypoint mudou) uma vez à mão** e
   conferir nos logs que terminou sem erro — é o único jeito de saber antes da
   madrugada que o entrypoint e a imagem estão certos:

   ```bash
   gcloud run jobs execute "${NAME_PREFIX}-notify-readings" \
     --project="$PROJECT_ID" --region="$REGION" --wait
   ```

   > ⚠️ **Cuidado com o `trash-purge`.** Ele apaga definitivamente o que está na
   > lixeira há mais de 30 dias. Se ele vinha falhando há tempos, a primeira
   > execução que funcionar expurga de uma vez todo o volume represado. Confira
   > a lixeira antes de executá-lo à mão — ou deixe-o rodar no horário, ciente
   > disso.

6. **Validação:** abrir a URL de produção, conferir login e shell, e o manual
   publicado (se o push tocou `docs/manual/**`, o `docs.yml` republica).

## Armadilhas

Todas falham **em silêncio** ou com sintoma que não aponta a causa. São a razão
de este documento existir.

### 1. As duas formas de URL do Cloud Run no CORS

Sem domínio customizado (`frontend_domain` vazio — o caso padrão), o
Cloud Run expõe o mesmo serviço em **duas** URLs:
`-<hash>-<região>.a.run.app` e `-<nº-projeto>.<região>.run.app`. O `Origin`
enviado pelo browser é aquele por onde a SPA foi aberta.

- **Sintoma:** o upload falha com "Falha no envio." e um erro de CORS no console
  do browser — **só** quando a SPA é aberta pela forma ausente da lista. Pela
  outra, funciona. Nada na mensagem menciona bucket, Terraform ou CORS do GCS.
- **Evita:** as duas URLs em `cors_allowed_origins` (Fase 5.1). Ver
  [`storage.tf`](../infra/terraform/storage.tf).

### 2. Imagem antes da validação OIDC do Pub/Sub

`POST /internal/storage-events` recebe o push do Pub/Sub. O IAM do Cloud Run não
protege esse endpoint (o serviço é público, porque serve a SPA), então a
**aplicação** valida o JWT OIDC. Ligar `pubsub_push_audience` antes de a imagem
com esse validador estar publicada inverte a ordem.

- **Sintoma:** todo push legítimo vira 401. Uploads funcionam, mas a cota nunca
  reconcilia — o usuário vê espaço usado que não cresce.
- **Evita:** Fase 3 antes da Fase 5, sempre. Ver
  [`storage-events.ts`](../apps/api/src/routes/storage-events.ts) e
  [`pubsub.tf`](../infra/terraform/pubsub.tf).

### 3. O gate "sem efeito em produção" do `deploy.yml`

O workflow classifica o diff do merge e **pula build, migração e deploy** quando
_todo_ arquivo casa com o allowlist: `*.md`, `docs/*`, `openspec/*`,
`LICENSE`, `.github/workflows/*`, `.gitignore`.

- **Sintoma:** o Actions mostra sucesso, mas o Cloud Run continua rodando a
  imagem placeholder `hello`. Nenhum erro em nenhum lugar.
- **Saída:** `deploy.yml` tem **`workflow_dispatch`**. Actions → Deploy → _Run workflow_ na `main` implanta
  o commit corrente, e o gate **não se aplica** a disparo manual — pedir a
  implantação de propósito é o oposto de um merge sem efeito. Também dá para
  re-rodar a execução pela UI, ou levar à `main` uma alteração fora do allowlist.
- **Quando morde:** uma mudança de implantação puramente documental. A
  configuração de um fork por cliente passa pelo gate por tocar `.env.example`,
  `apps/api/src/config.ts` e `infra/terraform/*.tf` — nenhum deles no allowlist.

### 4. Fork recém-criado tem os workflows DESABILITADOS

O GitHub desabilita os workflows de um repositório que **já continha arquivos de
workflow quando foi forkado**. A aba Actions mostra "Workflows aren't being run
on this forked repository" e um botão **"I understand my workflows, go ahead and
enable them"**.

- **Sintoma:** o push na `main` acontece, o git aceita, e **nada roda** — sem
  erro, sem execução vermelha, sem notificação. A aba Actions fica vazia, e a
  contagem de execuções é zero em todos os workflows, inclusive historicamente.
- **O evento perdido não volta.** Habilitar os workflows **não reexecuta** o push
  que já ocorreu. Sem disparo manual, a implantação ficaria presa na imagem
  placeholder do Cloud Run indefinidamente — é o motivo do `workflow_dispatch`
  no `deploy.yml`.
- **Evita:** habilitar na Fase 0, passo 7, **antes** de qualquer push na `main`.
- **Se já aconteceu:** habilite e então Actions → **Deploy** → _Run workflow_ na
  `main`.

### 5. O manual não publica num repositório recém-criado

`docs.yml` dispara em push na `main` que toque `docs/manual/**` ou o próprio
workflow. Num fork novo, enquanto ninguém tocar o manual, o site **nunca é
construído** e o link do rodapé do shell dá 404.

- **Sintoma:** o link "Manual do usuário" do rodapé abre um 404 do GitHub
  Pages; a aba Actions não mostra nenhuma execução de `Docs`.
- **Evita:** o primeiro push já toca `docs/manual/**`; e GitHub Pages precisa
  estar em **Source: GitHub Actions** (Fase 0, passo 7).
- **Se já aconteceu:** qualquer commit na `main` que toque `docs/manual/**`
  (até um comentário HTML no `index.md`) publica o site.

### 6. `version = "latest"` é resolvido na criação do recurso, não na execução

Dois erros distintos do primeiro `apply` de um projeto novo têm a mesma raiz: o Cloud Run valida o `secret_key_ref` **ao criar** o Job ou a revisão —
confere que a versão existe e que a service account tem
`roles/secretmanager.secretAccessor` —, não na primeira execução.

- **Versão inexistente (determinístico).** O secret da senha do administrador
  tem só o _container_ gerenciado pelo Terraform, por desenho. Em projeto novo o
  `apply` completo **sempre** falha com `Secret
  .../bootstrap-admin-password/versions/latest was not found` enquanto a versão
  não for gravada. Resolvido pela ordem da Fase 1a (apply direcionado → gravar
  a senha → apply completo). **Não é corrida: nenhuma retentativa resolve.**
- **Concessão ainda não visível (corrida).** `Error code 9 ... Permission denied
  on secret ... must be granted the 'Secret Manager Secret Accessor' role`
  acontece quando um Job tem service account própria, criada na mesma camada
  do grafo, e seu `depends_on` lista a *versão* do secret mas não a
  *concessão*. O resultado é não determinístico: um Job passa e outro falha, na
  mesma execução. **Prevenido** — `scheduler.tf` e `cloud_run.tf` declaram a
  aresta de IAM (change `correcoes-herdadas-do-fork`); todo Job novo precisa
  dela (Armadilha 10). Num projeto já afetado, um `terraform apply` seguinte
  conclui, porque a concessão já existe — a menos que o Job tenha ficado
  `tainted` (Armadilha 7).

### 7. `create` que falha na espera deixa o recurso `tainted` — e o impasse do `deletion_protection`

Quando um `create` de Cloud Run Job é **aceito** pela API e depois falha na
espera de prontidão (`Error waiting to create Job: Error waiting for Creating
Job`), o Terraform grava o id e marca o recurso como **tainted**. O apply
seguinte então planeja **substituir** — destruir e recriar — mesmo que a
configuração não tenha mudado.

E aí bate a segunda trava: o provider google 6.x introduziu
`deletion_protection` com default `true` em Cloud Run v2, então o destroy é
recusado:

```
Error: cannot destroy job without setting deletion_protection=false
and running `terraform apply`
```

- **Sintoma:** um `apply` que ninguém pediu aparece querendo destruir Jobs
  (`Plan: ... 2 to destroy`), e falha no destroy. Repetir o `apply` não sai do
  lugar — é laço, não transitório.
- **Por que a flag na configuração não resolve sozinha:** o provider lê
  `deletion_protection` do **state**, não do arquivo. Um recurso que entrou em
  state com `true` continua protegido até que um apply **de atualização** grave
  `false` — e, para um recurso `tainted`, o Terraform não planeja atualização,
  planeja substituição. Os Jobs deste repositório já declaram
  `deletion_protection = false`, o que impede o **próximo** impasse; não desfaz
  um já instalado.
- **Saída, para um impasse já instalado.** Remova os Jobs quebrados por fora e
  do state, e deixe o Terraform recriá-los limpos. O `deletion_protection` do
  provider **não** bloqueia o `gcloud` — é trava do Terraform, não da API:

  ```bash
  # exemplo com dois Jobs; troque pelos que o plan quer substituir
  gcloud run jobs delete "${NAME_PREFIX}-bootstrap"     --region="$REGION" --quiet
  gcloud run jobs delete "${NAME_PREFIX}-notify-grants" --region="$REGION" --quiet

  terraform state rm google_cloud_run_v2_job.bootstrap
  terraform state rm google_cloud_run_v2_job.notify_expiring_grants

  terraform apply
  ```

  Antes disso, **confirme que a versão do secret da senha existe** (Fase 1a) —
  sem ela o Job de bootstrap volta a falhar na criação e o ciclo recomeça.

  Alternativa menos invasiva, quando os Jobs em GCP estão íntegros e só o state
  está sujo: `terraform untaint <endereço>` nos dois e depois `apply`, que então
  planeja atualização em vez de substituição. Prefira a remoção quando a criação
  falhou de fato — um Job criado com spec inválida pode ficar numa condição que
  o `refresh` não denuncia.

- **O Cloud Run Service da API continua com `deletion_protection = true`** (o
  default), de propósito: Job não guarda dado e recriá-lo é gratuito, mas o
  serviço é o endpoint de produção e destruí-lo é indisponibilidade. A assimetria
  é deliberada — ver o comentário em `bootstrap_job.tf`.

### 8. Sucesso falso do Job de bootstrap como "aplicar migrações"

A imagem do Job de bootstrap é **pinada** (`lifecycle.ignore_changes = [image]`)
e só avança quando o passo de alinhamento do deploy conclui. Usá-lo para
desbloquear uma migração pendente pode rodar uma imagem anterior à migração,
cujo `dist/db/migrations` não contém o `.sql` novo: `runMigrations()` **conclui
com sucesso sem aplicar nada**, e o registro em `schema_migrations` nunca é
criado.

- **Sintoma:** o Job termina verde, os logs dizem que as migrações foram
  aplicadas, e a aplicação continua falhando por tabela ou coluna inexistente.
- **Diagnóstico:** `SELECT * FROM schema_migrations ORDER BY 1 DESC LIMIT 3` —
  a migration nova não está lá.
- **Evita:** desbloqueio manual de migração usa o Job **de migração**:
  `gcloud run jobs update "${NAME_PREFIX}-migrate" --image <IMAGE>:<SHA>` seguido de
  `execute --wait`.

### 9. Assinatura do Pub/Sub expira após 31 dias sem upload

Sem `expiration_policy`, o GCP **apaga** a assinatura de push após 31 dias sem
atividade. Num repositório documental, um mês sem upload (recesso, implantação
recém-aberta) é plausível. O primeiro sinal costuma ser um `terraform plan`
mostrando `google_pubsub_subscription.storage_finalize will be created` sem que
ninguém a tenha removido.

- **Sintoma:** uploads concluem no navegador, mas os arquivos ficam em
  `pending` — não aparecem como ativos e não entram na cota. Nenhum erro: o
  tópico continua recebendo o evento do bucket e o descarta, por não ter
  assinatura.
- **Diagnóstico:** `gcloud pubsub subscriptions describe
  "${NAME_PREFIX}-storage-finalize-push"` → `NOT_FOUND`.
- **Correção permanente:** `expiration_policy { ttl = "" }` em
  [`pubsub.tf`](../infra/terraform/pubsub.tf) (já presente; uma implantação
  anterior a ela recria a assinatura no próximo `apply`).
- **Recuperar os uploads do intervalo**, depois de recriar a assinatura —
  reaproveitando o Job de migração, que roda como a conta da API (banco +
  bucket) e só troca o script nesta execução:

  ```bash
  gcloud run jobs execute "${NAME_PREFIX}-migrate" --region="$REGION" --wait \
    --args=apps/api/dist/jobs/backfill-pending-finalize.js
  ```

  O script é idempotente (só percorre `pending`/`replacing`) e imprime
  `Backfill concluído: N reconciliado(s), M sem objeto no storage, F falha(s)`.

### 10. Job novo sem os requisitos dos demais (checklist)

Um `resource "google_cloud_run_v2_job"` novo que reusa a imagem da aplicação
**não falha no review** se esquecer qualquer um dos itens abaixo — falha no
primeiro `apply` ou, pior, toda madrugada, em silêncio.

- [ ] **`args` com `apps/api/dist/jobs/<job>.js`** — caminho relativo ao
  `WORKDIR /app` da imagem ([`Dockerfile`](../apps/api/Dockerfile)). `dist/...`
  não existe: "Cannot find module" toda noite.
- [ ] **`deletion_protection = false`** — sem isso, um `create` que falha vira o
  impasse da Armadilha 7.
- [ ] **`depends_on` na concessão `secretAccessor`** da própria service account
  (`google_secret_manager_secret_iam_member`) — sem isso, a corrida da
  Armadilha 6.
- [ ] **Uma linha no mapa `deploy_updated_jobs`**
  ([`locals.tf`](../infra/terraform/locals.tf)), que já dá ao pipeline a
  permissão sobre o Job e sua service account; depois do `apply`, **atualizar
  `GCP_DEPLOY_UPDATED_JOBS`** no GitHub com
  `terraform output -raw deploy_updated_job_names`. Sem isso o deploy não o
  alinha, e não há erro que denuncie.
- [ ] **Script em `apps/api/package.json`** e par Job + Scheduler no Terraform
  (convenção do `CLAUDE.md`).

**Se o apply já falhou:** saída da Armadilha 7 — `gcloud run jobs delete`,
`terraform state rm` e novo `apply` com o código corrigido. Depois, executar o
Job uma vez à mão (ver "Atualização de uma implantação no ar", passo 5).

## Erros de ambiente (não são de configuração)

Estes **não** vêm do Terraform deste repositório. Não edite `.tf` para resolvê-los.

### IPv6 no Cloud Shell — `cannot assign requested address`

```
Error: Error when reading or editing GCS service account not found:
Get "https://storage.googleapis.com/storage/v1/projects/<projeto>/serviceAccount...":
dial tcp [2607:f8b0:400c:c15::cf]:443: connect: cannot assign requested address
```

O endereço entre colchetes é **IPv6**. O Cloud Shell não oferece IPv6 utilizável,
mas o DNS devolve registro AAAA para `*.googleapis.com` e o provider (binário Go)
tenta o IPv6 — a conexão falha ao não encontrar endereço de origem. É [bug
conhecido do provider](https://github.com/hashicorp/terraform-provider-google/issues/6782),
visto justamente em Cloud Shell.

Pode cair em qualquer recurso ou `data source`; o `data
google_storage_project_service_account` de [`pubsub.tf`](../infra/terraform/pubsub.tf)
é só onde costuma aparecer primeiro, porque é lido cedo. **A mensagem cita o
recurso, mas o problema não está nele.**

1. **Primeiro, repita o comando.** O dial é intermitente, e um `plan`/`apply` é
   retomável — o que falhou aqui foi uma **leitura**, nada foi escrito.

2. **Se persistir, fixe IPv4** para os hosts que o módulo usa. O `/etc/hosts` do
   Cloud Shell é do container efêmero, então isto se desfaz sozinho no fim da
   sessão:

   ```bash
   for h in storage.googleapis.com run.googleapis.com sqladmin.googleapis.com \
            secretmanager.googleapis.com pubsub.googleapis.com iam.googleapis.com \
            cloudresourcemanager.googleapis.com compute.googleapis.com \
            artifactregistry.googleapis.com cloudscheduler.googleapis.com \
            serviceusage.googleapis.com iamcredentials.googleapis.com \
            sts.googleapis.com; do
     ip=$(getent ahostsv4 "$h" | awk '{print $1; exit}')
     [ -n "$ip" ] && echo "$ip $h"
   done | sudo tee -a /etc/hosts
   ```

   Google rotaciona esses IPs, então **não** versione o resultado nem o reuse
   numa sessão futura: gere na hora, use, descarte.

3. **Último recurso:** rode o Terraform de uma máquina com IPv4 funcional. O
   state é remoto (bucket GCS), então trocar de máquina não perde nada — basta
   clonar, recriar `backend.hcl` e `terraform.tfvars`, e `terraform init`.

## Não mexer

### Envelope de capacidade

O limite real é o `max_connections` do Cloud SQL, não o Cloud Run. Os valores
abaixo são um conjunto calculado, cicatriz de um incidente de `429 Rate
exceeded.` na tela de login:

| Ponta                       | Variável / origem                       | Valor              |
| --------------------------- | --------------------------------------- | ------------------ |
| Instâncias da API           | `api_max_instances`                     | 8                  |
| Conexões por instância      | `api_db_pool_max` → `DATABASE_POOL_MAX` | 2                  |
| Conexões da API (pior caso) | produto das duas acima                  | 16                 |
| Teto do banco               | `max_connections` do `db_tier`          | 25 (`db-f1-micro`) |
| Folga                       | os 4 Jobs + acesso manual               | 9                  |

**Subir `api_max_instances` sem subir `db_tier` reabre exatamente o mesmo 429**,
por um caminho pior (erro no banco em vez de fila). Num projeto novo a tentação é
"folgar" o teto de instâncias porque parece barato — não é: é o banco que paga.
Recalcule o conjunto inteiro ou não mexa em nenhum valor.

Completam o conserto, em `cloud_run.tf`: `max_instance_request_concurrency` (20,
contra o padrão 80 — 512Mi com argon2id a 19 MiB por login não serve 80
simultâneas), `timeout` (120s) e `startup_cpu_boost`.

### Escala a zero

`api_min_instances = 0` permanece por decisão de custo. O preço é o arranque a
frio: a primeira visita após um período ocioso pode receber `429` do Google Front
End. Mitigado por `startup_cpu_boost` e pelo retry de GET em 429/503 da SPA
(`apps/web/src/lib/api-client.ts`). O **login é POST e não é retentado** — ali a
tela orienta a tentar de novo. Subir para `1` elimina o caso, ao custo da
instância ociosa.

### `name_prefix`

`<name_prefix>` é **imutável a partir da Fase 1**. Alterá-lo depois faz o
Terraform destruir e recriar bucket de arquivos, instância Cloud SQL e tópicos
Pub/Sub — perda de dados, não renomeação. A janela de escolha fecha no primeiro
`apply`.

---

## Próximo cliente

Cada cliente é um **fork** deste repositório. No fork, trocar nesta ordem —
os valores do cliente viram _default_ versionado, para que provisionar sem
configuração local preserve a identidade do cliente:

1. `infra/terraform/variables.tf` — `app_client_name`, `github_repository`
   e, **só antes do primeiro `apply`**, `app_name`, `db_name`, `db_user` (ver
   "Não mexer → `name_prefix`"). Num projeto já provisionado, não toque nesses
   três.
2. `apps/api/src/config.ts` (`CANONICAL_MANUAL_URL`) **e**
   `docs/manual/mkdocs.yml` (`site_url`) no **mesmo commit** — um teste lê os
   dois e reprova se divergirem.
3. `.env.example` (`APP_CLIENT_NAME`, `APP_MANUAL_URL`).
4. `docs/manual/docs/index.md` (endereço) e `a-tela.md` (exemplo de
   identificação).
5. Os `.example` de `infra/terraform/` e a tabela de valores no topo deste
   runbook, no fork.
6. Identidade visual (logo, símbolos, favicon, paleta), se o cliente tiver a
   sua — ver `openspec/specs/identidade-visual/` e
   `openspec/specs/sistema-de-design/`.

**Ao sincronizar o fork com este repositório**, siga "Atualização de uma
implantação no ar". **Correção genérica descoberta no fork** (não ligada à
identidade do cliente) deve voltar para cá, para que o próximo fork já nasça
com ela.
