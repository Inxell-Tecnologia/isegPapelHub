# Proposal — sync-upstream-identidade-iseg

## Why

O **Sync fork** deste repositório com o upstream
(`CarlosSalesNaturalTec/GDoc`) falha com conflito. O fork está **132 commits**
(30 PRs) atrás do upstream, e os dois lados corrigiram os mesmos problemas de
Terraform de forma independente: o fork ISEG escreveu, em agosto, correções
pontuais (`c58882b` — um recurso IAM por Job, um passo de `gcloud run jobs
update` por Job no `deploy.yml`, e `outputs` por Job), e o upstream absorveu
depois as correções equivalentes do fork Forte Saúde de forma **generalizada**
(changes `deploy-atualiza-jobs-agendados` e `correcoes-herdadas-do-fork`: um
mapa `local.deploy_updated_jobs`, recursos com `for_each`, uma variável única
`GCP_DEPLOY_UPDATED_JOBS`). Um merge de teste (`git merge upstream/main`)
reporta conflito em cinco arquivos — `infra/terraform/{README.md, cicd.tf,
cloud_run.tf, outputs.tf, scheduler.tf}` — e produz um sexto conflito
**silencioso** em `.github/workflows/deploy.yml`, que mescla sem marcador mas
fica com os três passos antigos por Job (ainda usando
`github.event.workflow_run.head_sha`, que o upstream trocou por `TARGET_SHA`)
**e** o laço novo do upstream.

Resolvido o conflito, o merge traz junto a identidade visual do **Instituto
SETES** (changes `identidade-visual-isetes`, `identidade-isetes-e-menu-compacto`,
`marca-dagua-e-inicio-rodada-3`): ativos `apps/web/public/isetes-*.png`, a
`paleta` marinho + verde em `theme.ts`, o `alt` "Instituto SETES", a logo e o
favicon do manual. Isso é ativo e token **versionados**, não configuração —
por isso mescla sem conflito e, sem esta mudança, o ISEG passaria a abrir o
sistema com a logo e as cores de outra organização, com a CI verde. O mesmo
aconteceu no fork Forte Saúde e foi resolvido pela change
`identidade-visual-fortesaude` daquele repositório, que é o modelo desta.

O cliente forneceu duas artes (JPG, fundo branco, sem transparência): o
**símbolo** (1080×1080 — anel e cruz em degradê turquesa → laranja com a sigla
"ISEG" em cinza) e a **logo horizontal** (1280×560 — símbolo, filete e
"Instituto de Soluções Estratégicas em Gestão"), e pediu a troca do nome do
cliente, das imagens e da paleta.

## What Changes

### Sincronização com o upstream (resolução do conflito)

- Merge de `upstream/main` (merge commit — nunca squash) com os conflitos de
  Terraform resolvidos **a favor da forma generalizada do upstream**, que
  cobre tudo o que as correções do fork cobriam e mais o Job
  `notify-readings` (design.md D1).
- `deploy.yml`: removidos os três passos por Job herdados do fork; fica só o
  laço `GCP_DEPLOY_UPDATED_JOBS` do upstream (design.md D1).
- Novo `infra/terraform/moved_fork_iseg.tf` com blocos `moved` dos recursos
  IAM por Job do fork para as instâncias `for_each` do upstream, para que o
  próximo `terraform apply` na implantação ISEG **não** destrua e recrie
  concessões (design.md D2).
- `infra/terraform/README.md`: tabela de variáveis do upstream
  (`GCP_DEPLOY_UPDATED_JOBS`) mais o aviso de "Actions desabilitado em
  repositório novo", que só o fork tinha.

### Identificação do cliente

- `.env.example`: `APP_CLIENT_NAME=ISEG` (hoje `SETES`); `app_client_name`
  default `"ISEG"` em `variables.tf` e no `terraform.tfvars.example` (fork por
  cliente: o default versionado é o desta implantação). **Nenhum componente
  React** recebe o nome como literal — a spec `identidade-visual` proíbe.
- `var.github_repository` default → `Inxell-Tecnologia/isegPapelHub`.
- `CANONICAL_MANUAL_URL` e `mkdocs.yml::site_url` →
  `https://inxell-tecnologia.github.io/isegPapelHub/`, no mesmo commit
  (vigiados por `config-manual-url.test.ts`), com os fixtures da web.
- Manual: exemplos de identificação e descrições da logo/símbolo passam do
  ISETES/SETES para o ISEG.

### Ativos da marca, derivados das artes fornecidas

- Artes originais versionadas em `docs/images/iseg/` com o script
  `derivar_marca.py`, que gera os ativos de forma reproduzível (design.md D3).
- Novos ativos em `apps/web/public/`: `iseg-logo-negativa.png`,
  `iseg-simbolo-negativo.png`, `iseg-simbolo-cor.png` e `favicon.png`
  regerado (design.md D4). Removidos `isetes-logo-branca.png`,
  `isetes-logo-cor.png` e `isetes-simbolo.png` (de `public/` e do manual).

### Paleta derivada da logo

- **Valores** da `paleta` em `theme.ts` derivados do turquesa e do laranja da
  logo ISEG (design.md D5); **nomes** dos tokens inalterados (design.md D6).
- Constantes de cor das marcas d'água reapuradas nos novos ativos; opacidades
  inalteradas (design.md D7).

### Marca no shell, no login e no manual

- `ATIVOS_DA_MARCA` aponta para os novos ativos, com nome acessível
  "ISEG — Instituto de Soluções Estratégicas em Gestão" e a variante
  `simboloSobreClaro` (mesma estrutura da Forte Saúde).
- Manual: logo e favicon do site, paleta via `stylesheets/marca.css`.

### Fora de escopo

- **Prefixo de recursos GCP (`app_name = "gdoc"`)**: a implantação ISEG já foi
  provisionada (commits `c7974c3`…`76d6497` registram applies reais); trocar o
  prefixo destruiria bucket, Cloud SQL e Pub/Sub. Diferente da Forte Saúde,
  aqui a janela já fechou.
- Tornar logo e paleta configuração por implantação (eliminaria o conflito de
  identidade a cada sync na origem) — proposta a levar ao upstream, já
  registrada em `identidade-visual-fortesaude` D7.
- Tons categóricos (`tonsDeEstado`, `tonsDeTipoDocumental`, `tonsDeAtalho`):
  cores semânticas, não de marca.
- Mudanças funcionais trazidas pelo upstream (compartilhamento entre unidades,
  tipo checklist, edição de e-mail etc.) entram como estão; não são
  reabertas aqui.

## Capabilities

### New Capabilities

_(nenhuma)_

### Modified Capabilities

- `identidade-visual`: a logomarca oficial deixa de ser a logo branca do
  Instituto SETES e passa a ser a **versão negativa** da logo do ISEG; o
  símbolo ganha versão para fundo claro; os ativos passam a ser derivados das
  artes do cliente por procedimento versionado.
- `sistema-de-design`: os requisitos de paleta deixam de nomear as cores do
  ISETES (degradê azul-marinho, verde da marca, verde de ação) e passam a
  normatizar as funções pela paleta derivada da logo do ISEG.

## Impact

- **Terraform / CI (`infra/terraform`, `.github/workflows/deploy.yml`):**
  resolução do merge, blocos `moved`; operacionalmente, a variável de
  repositório `GCP_DEPLOY_UPDATED_JOBS` precisa ser criada e
  `GCP_BOOTSTRAP_JOB`/`GCP_TRASH_PURGE_JOB`/`GCP_NOTIFY_GRANTS_JOB` deixam de
  ser lidas; o apply cria o Job `notify-readings` e seu scheduler (vindos do
  upstream).
- **Banco:** as migrations novas do upstream rodam no deploy pelo Job de
  migração já existente; nada específico do ISEG.
- **Web (`apps/web`):** `public/`, `app/theme.ts` (valores),
  `shell/BrandMark.tsx`, `shell/MarcaDoProduto.tsx`,
  `shell/MarcaDaguaDaNavegacao.tsx`, `shell/MarcaDaguaDaAreaPrincipal.tsx`,
  comentários de `auth/LoginPage.tsx`/`shell/AppShell.tsx`; testes
  `contraste.test.ts`, `login.test.tsx`, `shell-identidade-visual.test.tsx`,
  fixtures de `clientName` e da URL do manual.
- **API:** só `config.ts` (`CANONICAL_MANUAL_URL`). Nenhuma rota muda.
- **Docs:** `docs/manual/` (mkdocs.yml, assets, `stylesheets/marca.css`,
  `a-tela.md`, `primeiro-acesso.md`, `index.md` se citar outra implantação),
  `docs/images/iseg/`.
- **Próximos syncs:** a divergência deliberada fica em `theme.ts` (valores),
  `BrandMark.tsx` (tabela de ativos), módulos de marca d'água, ativos,
  `config.ts`/`mkdocs.yml` (URL do manual), defaults de `variables.tf` e
  `moved_fork_iseg.tf` (arquivo só do fork, sem conflito).
