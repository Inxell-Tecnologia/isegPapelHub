# Design

## Context

O fork `Inxell-Tecnologia/PapelHub_ForteSaude` parte de `052b045` (a `main`
daqui) e está 37 commits à frente. Este repositório não tem commits novos desde
então, logo não há conflito de conteúdo. O trabalho é **separar** o que é
genérico do que é do cliente. O ponto delicado é que a maior parte das
correções genéricas foi feita dentro do change `implantacao-fortesaude`, em
commits que também tocam valores do cliente.

```
commits do fork                         destino aqui
───────────────────────────────────     ─────────────────────────────
f0bb052 feeda5e fc07ae6   (e-mail)  ──▶ cherry-pick integral
a344073 b354c75 3a44deb   (jobs/deploy)─▶ cherry-pick integral
0029fe2                   (jobs/deploy)─▶ cherry-pick; resolver runbook/README
c79ca57 7eb15e6 ffbcbec 8691741
b99690d 01bb007 8e3a0fb   (misturados)─▶ porte à mão, trecho a trecho
72de96b 0cf88a8 2faad66 …  (cliente)  ──▶ não vem
```

## Goals / Non-Goals

**Goals:**

- Trazer todas as correções de infraestrutura que valem para qualquer
  implantação, com os comentários reescritos para fazer sentido aqui (sem
  "o fork aplicou…", "commit ffbcbec", "Forte Saúde").
- Preservar a autoria e o rastro OpenSpec dos dois changes genéricos do fork
  (`edicao-email-pessoa`, `deploy-atualiza-jobs-agendados`).
- Deixar o próximo sync fork ← upstream sem conflito nos trechos portados.

**Non-Goals:**

- Trazer a identidade visual ou qualquer valor de implantação do cliente.
- Trazer a capability `implantacao-por-cliente`: ela normatiza que os defaults
  versionados são os *do cliente*, o que vale para um fork, não para a fonte.
- Executar operações em produção (apply, variáveis do GitHub, backfill). Elas
  ficam como checklist do PR.

## Decisions

### D1 — Cherry-pick onde o commit é limpo; porte manual onde é misturado

Fazer merge de `fork/main` e reverter a identidade foi descartado: o histórico
ficaria com "aplica e desfaz a marca", e o `variables.tf` com
`app_name = "papelhub"` passaria pela `main`, com risco de alguém aplicar o
estado intermediário. Também foi descartado reescrever tudo à mão, porque
perderia a autoria dos changes limpos.

A divisão adotada:

- **Cherry-pick (`-x`)** dos commits dos changes `edicao-email-pessoa` e
  `deploy-atualiza-jobs-agendados`. O `-x` registra o SHA de origem.
- **Porte manual** dos trechos genéricos dos commits misturados, num commit por
  assunto, citando o SHA de origem na mensagem.

No `0029fe2`, o hunk do `docs/runbook-implantacao.md` (arquivo inexistente
aqui) é descartado e reescrito na versão genérica (D4). O do
`infra/terraform/README.md` é ajustado à versão daqui.

### D2 — `deletion_protection = false` só nos Jobs

Mantida a decisão do fork. Job não guarda dado, e destruí-lo e recriá-lo é
gratuito. A proteção só cria impasse quando um `create` falha. O serviço da API
mantém o default `true`, porque ali destruir é indisponibilidade.

### D3 — Pub/Sub: `ttl = ""` em vez de um TTL longo

`ttl = ""` é a forma documentada de "nunca expira". Um TTL longo apenas adiaria
o mesmo incidente silencioso, e um repositório documental pode passar meses sem
upload em alguma implantação.

### D4 — Runbook genérico com placeholders, valores do cliente fora

`docs/runbook-implantacao.md` mantém a estrutura do fork: valores, seis fases,
atualização no ar, armadilhas, erros de ambiente, "Não mexer" e "Próximo
cliente". As mudanças são:

- **Tabela "Valores desta implantação"** vira um modelo com placeholders
  (`<project_id>`, `<name_prefix>`, `<owner>/<repo>`…). Os comandos usam
  `$PROJECT_ID`, `$REGION` e `$NAME_PREFIX`, nunca nomes literais como
  `papelhub-prod-*`.
- **Relatos datados do Forte Saúde** ("entre outubro e novembro de 2026…")
  viram descrição de sintoma, sem perder o diagnóstico.
- **A Armadilha 10** ("recurso novo vindo do upstream sem as travas do fork")
  muda de ângulo, porque aqui as travas passam a existir: vira o **checklist de
  Job novo**. São quatro itens: `deletion_protection`, a aresta de `depends_on`,
  `args` com `apps/api/dist/` e uma linha em `deploy_updated_jobs` mais a
  variável do GitHub. O mesmo checklist entra resumido no `CLAUDE.md`, que hoje
  diz apenas "Job novo = script + par job/scheduler".
- **"Próximo cliente"** passa a descrever o fork a partir daqui: quais
  defaults trocar, sem citar a spec `implantacao-por-cliente`, que fica no
  fork.

O runbook fica em `docs/`, fora do Prettier (`.prettierignore`), e o deploy o
trata como docs-only.

### D5 — `workflow_dispatch` ignora o gate "sem efeito em produção"

O gate existe para poupar build num merge que não muda a imagem. Um disparo
manual é um pedido explícito de implantar, e recusá-lo o tornaria inútil
justamente no caso em que é necessário: reimplantar a `main` corrente.

## Risks / Trade-offs

- **[Variável `GCP_DEPLOY_UPDATED_JOBS` ausente]** → o primeiro deploy após o
  merge falha no último passo. O serviço já estará na revisão nova (o passo
  roda depois do deploy). Mitigação: o checklist do PR exige `terraform apply`
  e a variável preenchida antes do merge.
- **[Assinatura já expirada em produção]** → uploads presos em `pending` desde
  a expiração. Mitigação: o plan mostra `will be created`. Depois do apply,
  rodar o backfill (`backfill-pending-finalize.js` via Job de migração com
  `--args`), conforme a Armadilha 9 do runbook.
- **[Jobs agendados presos numa imagem antiga ou no placeholder]** → mesmo com
  o `args` corrigido, o Job só funciona com uma imagem real. Mitigação: o
  primeiro deploy após o merge os alinha (D1 do change
  `deploy-atualiza-jobs-agendados`). Em seguida, executar cada Job uma vez à
  mão. O expurgo pode ficar de fora se não houver segurança sobre o que está na
  lixeira há mais de 30 dias: depois de dias de falha, a primeira execução
  pode apagar um volume represado.
- **[Divergência fork ↔ upstream nos trechos portados]** → os comentários
  reescritos diferem dos do fork, e o próximo sync pode conflitar nesses
  hunks. Aceito: o conflito é de comentário, fácil de resolver a favor do
  upstream.

## Migration Plan

1. Merge do PR (merge commit) somente depois de:
   - `terraform plan` sem `destroy`/`replace`;
   - `terraform apply`;
   - `GCP_DEPLOY_UPDATED_JOBS` preenchida com
     `terraform output -raw deploy_updated_job_names`.
2. Deploy automático: migra `0027`, implanta o serviço e alinha a imagem dos
   Jobs.
3. Executar `notify-expiring-grants` e `notify-readings` à mão e conferir os
   logs. Decidir conscientemente sobre o primeiro `trash-purge`.
4. Se a assinatura foi recriada, rodar o backfill de `pending`.

Rollback: reverter o merge. As mudanças de Terraform são aditivas, e a
migration `0027` só cria tabela.
