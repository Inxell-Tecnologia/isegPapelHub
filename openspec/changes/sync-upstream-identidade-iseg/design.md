# Design — sync-upstream-identidade-iseg

## Context

Ver proposal.md — Why. Dois trabalhos numa mesma fatia porque são
inseparáveis na prática: o merge do upstream é o que **traz** a identidade do
ISETES, e publicar o merge sem a troca de identidade deixaria a produção do
ISEG com a marca de outra organização.

Estado do fork no momento da proposta: `main` em `d76e093`, último sync com o
upstream em `5cba811`. Divergência própria do fork (fora de merges): 7 commits,
todos de Terraform/CI (`c7974c3`, `d98ae04`, `cbc3c7c`, `76d6497`, `2d83598`,
`c58882b`, `325b71e`). Nenhum commit próprio do fork toca `apps/` nem
`docs/manual/` — a parte de apresentação mescla limpa, e é exatamente por isso
que a marca ISETES entraria sem aviso.

Restrições herdadas, não renegociadas: identidade do cliente é configuração
(`APP_CLIENT_NAME`), nunca literal em componente; tokens de apresentação têm
origem única; todo par de cor normatizado é apurado por cálculo
(`contraste.test.ts`); a logo nunca aparece sobre fundo claro; integrações por
merge commit, nunca squash; `name_prefix = "gdoc"` não muda.

## Goals / Non-Goals

**Goals:**

- `main` do fork contém `upstream/main` como ancestral, de modo que o próximo
  "Sync fork" do GitHub só conflite onde o upstream tocar a divergência
  deliberada desta change.
- Próximo `terraform apply` na implantação ISEG sem destruição de recurso nem
  recriação de concessão IAM existente.
- Nenhum ativo, cor, nome acessível ou exemplo do ISETES/SETES na interface
  nem no manual do ISEG.
- Ativos derivados das artes fornecidas, de forma reproduzível.

**Non-Goals:**

- Reescrever o histórico do fork ou descartar seus commits (o merge preserva
  ambos os lados).
- Mudar composição de telas, opacidades das marcas d'água ou orçamento de
  altura da navegação.
- Reapurar tons categóricos.

## Decisions

### D1 — Conflitos de Terraform/CI resolvidos a favor do upstream

Para cada um dos cinco arquivos em conflito, fica a versão do upstream:

| Arquivo | Lado do fork (HEAD) | Lado do upstream | Resolução |
| --- | --- | --- | --- |
| `cicd.tf` | 3 `job_iam_member` + 2 `act_as` nominais | `deployer_run_developer_jobs` e `deployer_act_as_job_runtime` com `for_each` sobre `local.deploy_updated_jobs` | upstream |
| `outputs.tf` | `bootstrap_job_name`, `notify_expiring_grants_job_name` | `deploy_updated_job_names` | upstream (`trash_purge_job_name` permanece, o upstream o mantém) |
| `cloud_run.tf`, `scheduler.tf` | linhas vazias | comentário explicando o `depends_on` sobre o secret | upstream |
| `README.md` | tabela com 3 variáveis por Job | tabela com `GCP_DEPLOY_UPDATED_JOBS` | upstream + aviso "Actions desabilitado em repositório novo" do fork (`76d6497`), que o upstream não tem |

Razão: a versão do upstream é a generalização das mesmas correções — mesmo
papel (`run.developer`) e mesmo escopo por recurso — e já inclui o Job
`notify-readings`, que o fork não conhece. Manter a do fork obrigaria a
replicar à mão cada Job futuro e manteria conflito em todo sync.

**`deploy.yml` (conflito silencioso):** o git mescla sem marcador porque os
trechos não se sobrepõem, mas o resultado tem os passos "Update bootstrap /
trash purge / notify expiring grants job image" do fork **antes** do deploy,
com `github.event.workflow_run.head_sha` (quebra em `workflow_dispatch`, que o
upstream introduziu, e ignora `TARGET_SHA`), **e** o laço do upstream depois
do deploy. Os três passos do fork são removidos; o arquivo deve ficar idêntico
ao do upstream (`git diff upstream/main -- .github/workflows/deploy.yml`
vazio). Idem para os demais arquivos de Terraform que o fork tocou e mesclaram
limpos (`bootstrap_job.tf`, `migrate_job.tf`, `pubsub.tf`,
`secret_manager.tf`, `Dockerfile`, `copy-migrations.mjs`): conferir que o
resultado não duplica concessão/`depends_on` que o upstream já trouxe.

_Alternativa descartada:_ `git merge -X theirs`. Resolveria os cinco
conflitos, mas não o `deploy.yml` (sem conflito textual) e descartaria o
aviso do README às cegas.

### D2 — Blocos `moved` para a implantação já provisionada

A implantação ISEG aplicou o Terraform do fork, então o state tem os
endereços nominais. Sem orientação, o próximo `plan` mostra destroy+create de
cinco concessões IAM — inofensivo em regime, mas abre uma janela em que o
deploy perde permissão e polui a revisão do plan. Um arquivo só do fork,
`infra/terraform/moved_fork_iseg.tf`, declara:

```hcl
moved {
  from = google_cloud_run_v2_job_iam_member.deployer_run_developer_bootstrap_job
  to   = google_cloud_run_v2_job_iam_member.deployer_run_developer_jobs["bootstrap"]
}
# … trash_purge, notify_grants (chaves de local.deploy_updated_jobs)
moved {
  from = google_service_account_iam_member.deployer_act_as_trash_purge_job
  to   = google_service_account_iam_member.deployer_act_as_job_runtime["gdoc-prod-trash-purge"]
}
# … notify-grants: ["gdoc-prod-notify-grants"]
```

As chaves de `deployer_act_as_job_runtime` são `account_id`
(`${name_prefix}-…`), literais em `moved` — por isso dependem de
`name_prefix = "gdoc-prod"` e devem ser confirmadas contra o state
(`terraform state list`) antes do apply. Arquivo separado = zero conflito com
o upstream; pode ser apagado depois do primeiro apply bem-sucedido.

_Alternativa descartada:_ aceitar o destroy/create. Funciona, mas o plan
deixa de ser "só adições" e o operador não distingue o esperado do perigoso.

### D3 — Ativos por desmistura sobre o branco com tinta local

O D1 da Forte Saúde assume **três tintas chapadas**. A marca ISEG é um
**degradê** contínuo turquesa → oliva → laranja, então não há conjunto finito
de tintas. Generalização:

1. Amplia a arte 4× (bicúbico) — mantém o procedimento da Forte Saúde.
2. **Núcleo opaco:** pixels cuja distância ao branco passa de um limiar são
   considerados tinta pura; a cor deles é a tinta local.
3. **Campo de tinta:** cada pixel não opaco herda a tinta do pixel do núcleo
   mais próximo (transformada de distância / vizinho mais próximo).
4. **Opacidade:** `a = Σ(255 − c) / Σ(255 − tinta_local)`, recortada em
   [0, 1]; saída = tinta local pura com opacidade `a`.

Resultado igual ao da Forte Saúde nas áreas chapadas (sigla e frase em cinza)
e correto nas bordas do degradê, sem franja branca.

**Qual arte para qual ativo:** o símbolo vem da arte **vertical**
(1080×1080, degradê suave, fiel à identidade); a logo horizontal vem da arte
**horizontal** (1280×560), que tem saturação diferente (vermelho `#FF0204` e
verde escuro nas bordas do anel). Usar o símbolo da arte vertical dentro da
logo horizontal seria montar uma arte nova — fora do princípio "derivar, não
redesenhar". A diferença de tom entre logo (shell expandido/login) e símbolo
(navegação colapsada/marca d'água) é aceita; se o cliente enviar a logo
horizontal em vetor, basta trocar a entrada.

Artes e script em `docs/images/iseg/`; regerar é
`python3 -I docs/images/iseg/derivar_marca.py <dir-das-artes> <dir-de-saída>`.

### D4 — Versão negativa: o cinza vira branco, o degradê permanece

Sobre os fundos escuros, a sigla "ISEG", o filete e a frase institucional
(tinta cinza `#4F4F4F`, baixa saturação) passam a branco; o anel e a cruz
mantêm o degradê. A classificação por pixel é pela **saturação da tinta
local**: tinta acinzentada (S < limiar) → branco; tinta saturada → preservada.

Ativos:

| Arquivo | Origem | Uso |
| --- | --- | --- |
| `iseg-logo-negativa.png` (altura ~144 px) | horizontal, negativa | logo no login e no shell expandido |
| `iseg-simbolo-negativo.png` (400 px) | vertical, negativa | navegação colapsada, marca d'água da navegação, logo do manual |
| `iseg-simbolo-cor.png` (400 px) | vertical, cores originais | marca d'água da área principal |
| `favicon.png` (64×64) | vertical, cores originais, margem transparente | aba do navegador e favicon do manual |

O símbolo é circular e já quadrado (1:1), então o favicon não precisa de
margem lateral para não distorcer — só a margem de respiro.

### D5 — Paleta derivada da logo, função por função

Cores da arte vertical, medidas: turquesa `#00A9A5` (extremo inferior
esquerdo), laranja `#EC6426`/`#F26522` (extremo superior direito), cinza
`#4F4F4F`. Valores candidatos, com as razões já calculadas (WCAG 2.x); os
definitivos são os que passarem em `contraste.test.ts`:

| Token (nome herdado) | ISETES | ISEG (candidato) | Derivação | Pares apurados |
| --- | --- | --- | --- | --- |
| `marinhoEscuro` | `#012442` | `#06302F` | turquesa escurecido | branco 14,27:1 |
| `marinhoClaro` | `#0B5382` | `#0A4A48` | turquesa escurecido | branco 10,07:1 |
| `verdeMarca` | `#0EC782` | `#F26522` | laranja da logo | texto 5,44:1; branco 3,15:1 (recusado p/ texto); sobre o degradê 4,53:1 (topo) / 3,19:1 (base) |
| `verdeAcao` | `#067A52` | `#00756F` | turquesa escurecido | branco 5,56:1; superfície 5,16:1 |
| `azulLink` | `#025484` | `#006460` | turquesa escurecido | branco 7,02:1 |
| `textoSobreEscuro` | `#CBD5DD` | `#CDEBE9` | tinta clara do turquesa | topo 11,32:1; base 7,98:1 |
| `azulAvatar` | `#9ED8F6` | `#BFE8E6` | tinta clara do turquesa | texto 12,99:1; branco 1,32:1 (recusado) |

Por que o degradê da navegação é **escuro** (`#0A4A48` na base e não o
turquesa `#00706C`): o laranja de destaque é o anel de foco e o item ativo
sobre a navegação, e precisa de ≥ 3:1 contra o fundo em toda a extensão; com
`#00706C` na base ele cai a 1,88:1. Com `#0A4A48` fica em 3,19:1.

Por que a ação é **turquesa** e não laranja escurecido (como na Forte Saúde):
o laranja já é a cor de destaque; a ação em turquesa repete o arranjo de duas
cores do produto (navegação/ação numa família, destaque na outra) e o
turquesa escurecido mantém branco ≥ 4,5:1. Laranja escurecido (`#B5480F`,
5,39:1) fica como alternativa se a verificação da marca d'água da área
principal reprovar o turquesa.

Neutros (`texto`, `textoApoio`, `superficie`, bordas) e `vermelhoIndicador`
não mudam.

### D6 — Os nomes dos tokens não mudam

Mesma decisão de `identidade-visual-fortesaude` D4: `verdeMarca` passa a
guardar um laranja e `marinhoEscuro` um verde-petróleo, mas renomear
espalharia conflito por dezenas de usos a cada sync. O cabeçalho de
`theme.ts` registra que os nomes são papéis herdados e os valores são do ISEG;
as specs usam o nome da função.

### D7 — Marcas d'água: mesmas opacidades, constantes reapuradas

`COR_MAIS_CLARA_DO_SIMBOLO` (navegação) e `COR_MAIS_ESCURA_DO_SIMBOLO` (área
principal) passam a ser **medidas nos ativos gerados** (o mais luminoso do
símbolo negativo — esperado `#FFFFFF`; o pixel opaco mais escuro do símbolo
colorido — esperado o cinza `#4F4F4F` da sigla). Opacidades mantidas (8% e
6%); o teto demonstrativo do teste de contraste da navegação é reapurado para
o novo degradê.

### D8 — Logo no shell expandido mantém 150 px

A arte horizontal recortada tem proporção 2,24:1, próxima dos 2,34:1 da logo
ISETES. A 150 px de largura a altura fica ~67 px (ISETES: 64 px). O ajuste do
orçamento de altura da navegação em 768 px é verificado na captura; se
estourar, reduz-se a largura até caber, nunca a altura de outro elemento.

### D9 — Ordem dos commits

1. Commit de merge `Merge remote-tracking branch 'upstream/main'` com os
   conflitos resolvidos (D1) — CI precisa passar **antes** da troca de
   identidade, para isolar regressões do upstream das desta change.
2. Commit `moved_fork_iseg.tf` (D2).
3. Commit de identificação do cliente (env, tfvars, URL do manual).
4. Commit de identidade visual (ativos, paleta, shell, manual).

A integração em `main` é por PR com **merge commit**.

## Risks / Trade-offs

- **[Variável de repositório ausente]** → o laço do upstream falha (de
  propósito) se `GCP_DEPLOY_UPDATED_JOBS` estiver vazia: o primeiro deploy
  depois do merge fica vermelho **depois** do serviço já atualizado. Mitigação:
  criar a variável a partir de `terraform output -raw deploy_updated_job_names`
  antes do merge em `main` (tarefa operacional explícita).
- **[Migrations do upstream]** → o merge traz 12 migrations novas (15 → 27) que o Job de
  migração aplica no deploy. Mitigação: rodar `npm run migrate` e a suíte da
  API contra o Postgres local antes do merge; backup/PITR do Cloud SQL
  confirmado antes do primeiro deploy.
- **[Chaves dos `moved`]** → se o `name_prefix` real divergir de `gdoc-prod`,
  o `moved` aponta para chave inexistente e o plan erra. Mitigação: conferir
  com `terraform state list` e `terraform plan` (deve mostrar 0 destroy).
- **[`github_repository`/URL do manual]** → se a implantação usa outro
  repositório no `terraform.tfvars`, o default novo não tem efeito (tfvars
  vence) — inofensivo. Se o GitHub Pages do fork não estiver habilitado, o
  link do manual no rodapé quebra. Mitigação: verificar/habilitar Pages
  (Source: GitHub Actions) antes do deploy.
- **[Arte em JPG com saturações diferentes]** → logo e símbolo terão tons
  ligeiramente distintos (D3). Aceito; resolvido com arte vetorial do cliente.
- **[Próximo sync]** → upstream mexendo em `theme.ts`, `BrandMark.tsx`,
  marcas d'água, `config.ts`, `mkdocs.yml` ou defaults de `variables.tf`
  conflitará. Resolução: estrutura do upstream, valores/ativos desta change.

## Migration Plan

1. Antes do merge em `main`: criar `GCP_DEPLOY_UPDATED_JOBS`; conferir
   GitHub Pages; backup do Cloud SQL.
2. Merge do PR (merge commit) → CI → deploy (migrations pelo Job, imagem dos
   Jobs pelo laço).
3. `terraform plan` com o state real: só adições (Job/scheduler
   `notify-readings`, contas e concessões novas) e `moved`; 0 destroy. Então
   `apply`. Depois do primeiro apply bem-sucedido, remover as variáveis
   `GCP_BOOTSTRAP_JOB`, `GCP_TRASH_PURGE_JOB`, `GCP_NOTIFY_GRANTS_JOB`.
4. Rollback: reverter o merge commit em `main` (`git revert -m 1`) e
   reimplantar; migrations do upstream são aditivas, o código antigo convive
   com elas.
