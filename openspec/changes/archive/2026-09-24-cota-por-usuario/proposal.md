# Proposal

## Why

Hoje a cota de armazenamento é **um único número por implantação**
(`config.storageQuotaBytesPerUser`, de `STORAGE_QUOTA_BYTES_PER_USER`, padrão
10 GiB), aplicado igualmente a todas as pessoas de todas as unidades. Não existe
coluna de cota em `users` — só `storage_used_bytes`. A consequência prática é
que **a única alavanca para liberar espaço a uma pessoa é liberar para todas**.

O caso que motiva a mudança é concreto e está parado em produção: um colaborador
precisa enviar cerca de 200 GB (~152 mil arquivos, média de 1,38 MB). Elevar a
cota global a 300 GB atenderia essa pessoa, mas abriria 300 GB para todo mundo —
e, pior, seria irreversível na prática: recuar o valor global depois congela
qualquer pessoa que tenha passado dos 10 GB no meio-tempo (sem envio, sem
substituição, e sem devolução de cota por 30 dias de retenção da lixeira). A
plataforma precisa da exceção **nominal**, não do afrouxamento coletivo.

## What Changes

- **Cota individual opcional por pessoa.** Nova coluna
  `users.storage_quota_bytes bigint NULL`. `NULL` significa "segue o padrão da
  plataforma" e continua resolvendo para `config.storageQuotaBytesPerUser`; um
  valor preenchido é uma **exceção nominal** que vale só para aquela pessoa.
- **Concessão restrita a `global_admin`.** O campo entra em
  `PATCH /users/:id`, mas sob guarda mais estreita que o resto da rota: um
  `unit_admin` continua editando dados e status das pessoas da sua unidade e
  **NÃO** pode alterar cota. Cota é alavanca de custo de infraestrutura, e
  concentrá-la no `global_admin` mantém a decisão de gasto num único lugar.
- **Consumo visível para quem concede.** `storage_used_bytes` passa a constar da
  resposta de pessoa, para que a administração decida a cota vendo o consumo
  atual em vez de às cegas. Rebaixar a cota abaixo do uso atual **continua
  permitido** — é uma forma legítima de congelar uma conta —, mas deixa de ser
  acidental.
- **Cota efetiva nos seis pontos que hoje leem a global.** Consulta de cota,
  envio avulso, envio em lote/pasta, substituição pelo delta, reconciliação do
  finalize e capacidade agregada do painel passam a usar a cota da pessoa. A
  capacidade do painel deixa de ser `cota × nº de pessoas` e passa a ser a soma
  das cotas efetivas.
- **Restauração do padrão global em 10 GiB.** O change anterior
  (`Eleva a cota de armazenamento por pessoa para 300 GB`, PR #71) elevou o
  padrão em `config.ts`, `.env.example`, `variables.tf` e no manual para
  322122547200 bytes, preparando um aumento global que foi **cancelado** em
  favor desta abordagem. O número ficou armado: o valor não tem efeito hoje
  (o serviço do Cloud Run ainda carrega a variável antiga), mas o próximo
  `terraform apply` elevaria todas as pessoas a 300 GB sem intenção. Esta
  mudança devolve o padrão a 10 GiB nos quatro pontos, e revisa
  `docs/custos-gcp/` junto (o README de custos exige revisão ao alterar a cota).
- **Manual do usuário.** A cota deixa de ser um número único na tabela de
  limites, e a concessão de exceção entra na documentação do administrador.

Não há mudança de comportamento para quem não receber exceção: com
`storage_quota_bytes = NULL` em todas as linhas existentes, o sistema se comporta
exatamente como hoje.

## Capabilities

### New Capabilities

- `cota-individual`: resolução da **cota efetiva** de uma pessoa (exceção
  nominal quando houver, padrão da plataforma quando não houver), quem pode
  concedê-la, e a garantia de que a exceção não vaza para outras pessoas nem
  atravessa o isolamento por unidade.

### Modified Capabilities

- `gestao-pessoas`: a edição em `PATCH /users/:id` passa a aceitar o campo de
  cota individual **apenas para `global_admin`**, em contraste com os demais
  campos, que seguem no alcance de qualquer administração; e a representação de
  pessoa devolvida pela gestão passa a incluir o volume já utilizado.
- `envio-lote`: a reserva consciente do lote e a consulta do próprio espaço
  deixam de se referir a um limite fixo de 10 GB e passam a se referir à cota
  efetiva de quem pede.
- `painel`: o bloco de espaço deixa de derivar a capacidade de
  `cota × nº de pessoas` e passa a somar as cotas efetivas, para que uma
  exceção nominal não distorça o agregado.
- `lixeira`: a retenção continua contando contra a cota do dono, mas a
  referência ao valor fixo de 10 GB deixa de descrever o comportamento real.
- `web-pessoas`: o formulário de pessoa ganha o campo de cota individual,
  visível e editável somente por `global_admin`, exibido com o consumo atual ao
  lado e com indicação explícita de quando a pessoa segue o padrão da
  plataforma.
- `documentacao-usuario`: a página de limites deixa de anunciar a cota como
  número único do produto, e o manual do administrador ganha a orientação de
  concessão de exceção.

## Impact

**Banco.** Migration `0015`: coluna `storage_quota_bytes bigint NULL` em
`users`. Sem backfill — `NULL` é o estado correto para todas as linhas
existentes. A tabela já tem `unit_id` e policy RLS; nenhuma policy nova é
necessária.

**API.** `apps/api/src/routes/users.ts` (campo novo no `PATCH`, guarda de
`global_admin`, `storage_used_bytes` nas colunas de pessoa),
`apps/api/src/routes/files.ts` (quatro pontos de verificação),
`apps/api/src/lib/storage-reconcile.ts`, `apps/api/src/routes/dashboard.ts`, e
uma função de resolução da cota efetiva em `apps/api/src/lib/` — a regra fica
num lugar só, no espírito de `lib/access.ts`, em vez de um `COALESCE` repetido
por rota. Quatro dos seis pontos já leem `users` na mesma transação, então a
coluna entra na query existente, sem round-trip adicional.

**Contratos compartilhados.** `packages/shared` — DTO de pessoa e de
atualização de pessoa.

**SPA.** `apps/web/src/pessoas/`. As telas de envio e de painel não mudam de
código: já consomem `quotaBytes`/`capacityBytes` do servidor.

**Infraestrutura e documentação.** `infra/terraform/variables.tf`,
`apps/api/src/config.ts`, `.env.example`, `docs/manual/docs/referencia/limites.md`,
`docs/custos-gcp/README.md` e `docs/custos-gcp/modelo.py` — todos voltando o
padrão a 10 GiB. Nenhum recurso novo de infraestrutura: a exceção é dado de
aplicação, não configuração de ambiente.

**PRD.** A US 8.1 fixa "meu limite de 10 GB" como critério de aceite. Este
change **não revoga** esse critério: os 10 GB continuam sendo o padrão que vale
para toda pessoa sem exceção nominal. O que muda é a existência de uma exceção
administrativa acima dele, o que pede um adendo à US 8.1 em `docs/prd_final.md`
registrando a exceção e quem pode concedê-la.

## Fora de escopo

Dois problemas reais, encontrados na investigação que originou este change, que
**não** são resolvidos aqui e merecem change próprio:

- **Linhas `pending`/`replacing` abandonadas nunca são liberadas.** Elas
  reservam cota indefinidamente: `purge-trash` só alcança `deleted_at IS NOT
  NULL` e o backfill de finalize só promove quem já tem objeto no bucket,
  deixando o resto pendente. Como as URLs assinadas são pedidas just-in-time em
  fatias de até 200 itens, cada interrupção de envio órfã algumas centenas de
  MB — é gotejamento, não enxurrada, mas acumula e não tem drenagem.
- **Defeito de contabilidade no expurgo de pendente.** `purge-file.ts` subtrai
  `size_bytes` de `storage_used_bytes` incondicionalmente, mas uma linha
  `pending` nunca teve seus bytes somados (a soma só ocorre no finalize).
  Purgar um pendente abandonado faz o contador da pessoa descer indevidamente,
  podendo ficar negativo. O caminho é alcançável: `DELETE /files/:id` não filtra
  status e `deleteObject` usa `ignoreNotFound: true`.

Também fica fora: auditoria da concessão de cota (decisão registrada em
`design.md`), e teto máximo para a exceção — hoje o `global_admin` concede o
valor que quiser.
