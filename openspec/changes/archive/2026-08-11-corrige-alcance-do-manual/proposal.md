# Proposal — corrige-alcance-do-manual

## Why

A change arquivada `acesso-ao-manual-no-shell` entregou o acesso ao manual no
rodapé do shell, com testes verdes na API e na web — e **o item não aparece em
nenhuma tela, em nenhum ambiente**. Não é regressão nem bug de implementação: o
código faz exatamente o que as specs mandam. O defeito está na regra.

A capability `documentacao-usuario` carrega hoje dois requisitos em tensão. Um
exige acesso "**permanente e visível** em toda tela do shell autenticado". O
outro manda **omitir inteiramente** o acesso quando o endereço não estiver
configurado. Nada, em lugar nenhum, garante que o endereço esteja configurado —
e o valor padrão em cada elo da cadeia é vazio:

- `infra/terraform/variables.tf`: `app_manual_url` tem `default = ""`;
- `terraform.tfvars.example`: a linha vem **comentada**;
- `apps/api/src/config.ts`: `optional('APP_MANUAL_URL', '')`;
- o `.env` do sandbox não recebe chaves novas do `.env.example` depois de criado.

O resultado é que o segundo requisito engole o primeiro em 100% das implantações
reais. A funcionalidade existe, está testada, está documentada no manual — e é
inalcançável.

O default vazio veio de `APP_CLIENT_NAME` por analogia (design.md D4 da change
anterior). **A analogia é falsa.** Para a identificação do cliente, vazio é um
estado de produto legítimo: existem implantações que genuinamente não exibem
cliente algum. Para o manual, vazio significa "a funcionalidade que motivou a
change está desligada" — o manual sempre existe, é publicado pelo próprio
repositório, e seu endereço é determinístico (`site_url` em
`docs/manual/mkdocs.yml`). Mesmo mecanismo, significado oposto.

## What Changes

- **O endereço canônico do manual passa a ser o padrão**, em vez de "nenhum
  endereço". Sem configuração explícita, o acesso aponta para o site publicado
  por este repositório. `APP_MANUAL_URL` sobrevive integralmente como **override
  por implantação** — o modelo de configuração em runtime da change anterior
  (design.md D2: mesma imagem servindo implantações distintas) é preservado, e
  só o significado da ausência muda.

- **Configuração declarada vazia passa a valer como não declarada.** Hoje
  `cloud_run.tf` define `APP_MANUAL_URL` incondicionalmente com
  `value = var.app_manual_url`, e `optional()` só cai no default quando a
  variável é `undefined` — então uma string vazia vinda do Terraform **anularia
  qualquer default definido em `config.ts`**, e corrigir só a aplicação não teria
  efeito nenhum em produção. A resolução do endereço passa a tratar os dois casos
  como o mesmo (design.md D2), o que fecha a brecha para **qualquer** produtor de
  valor vazio — Terraform, `.env`, console do Cloud Run — e não apenas para o
  atual.

- **"Implantação sem acesso ao manual" deixa de ser um estado suportado.**
  Preencher `APP_MANUAL_URL` passa a **trocar o destino**, nunca a ligar ou
  desligar o item — não há valor de configuração que suprima o acesso. Essa era
  justamente a flexibilidade especulativa que apagou a funcionalidade: um estado
  que ninguém pediu, alcançado por omissão, e que engoliu o requisito de
  alcançabilidade. Alternativa (supressão por valor sentinela deliberado)
  avaliada e recusada em design.md.

  A omissão no **render** permanece intocada: a SPA continua não desenhando o
  item quando `manualUrl` chega vazia, porque essa é a degradação segura de
  `GET /auth/public-config` falhando (design.md D4 da change anterior, segunda
  metade) — código da SPA não muda.

- **O sandbox passa a reconciliar chaves novas do `.env.example` no `.env`
  existente.** Hoje `.claude/hooks/session-start.sh` copia o exemplo apenas
  quando `.env` não existe (`if [ ! -f .env ]`), então toda variável acrescentada
  depois é invisível para qualquer sandbox cujo `.env` seja anterior a ela.
  Isso não é um detalhe deste caso: é o motor que reproduz esta classe de falha
  em **toda** configuração futura. Chaves ausentes passam a ser acrescentadas
  com o valor do exemplo; valores já preenchidos NÃO são tocados.

- **Os testes passam a exercer o caminho não configurado.** A cobertura atual não
  poderia ter detectado o problema:

  | Teste | Por que não pega |
  |---|---|
  | `shell-manual-do-usuario.test.tsx` | mocka `fetch` com o valor ligado — testa o componente, nunca a configuração |
  | `auth.test.ts` (contrato) | `expect(manualUrl: config.appManualUrl)` é tautológico: passa com `''` |
  | `auth.test.ts` ("vazia arranca normalmente") | **codifica o estado quebrado como esperado** |

  Passa a existir asserção sobre a resolução do endereço **sem** `APP_MANUAL_URL`
  no ambiente, e o teste que hoje afirma "vazia responde vazio" muda de sentido
  junto com a regra. A validação de esquema (design.md D5 da change anterior)
  continua valendo sem alteração.

- **`.env.example` e `terraform.tfvars.example`** passam a refletir que a linha é
  um override opcional, não a chave que liga a funcionalidade.

Fora de escopo:

- **Auditar as demais variáveis de implantação** atrás do mesmo padrão
  (default desligado + teste que injeta o valor ligado). `APP_CLIENT_NAME` tem a
  mesma forma, mas ali o vazio é legítimo e nada deve mudar. Uma regra geral
  sobre defaults de configuração merece change própria, com o levantamento
  completo — não é decidível a partir deste caso isolado.
- **Alterar o significado de `APP_CLIENT_NAME`** — explicitamente preservado.
- **Ajuda contextual por tela** — segue fora, como na change anterior.
- **Restringir o conteúdo do manual a quem tem conta** — segue fora; o site é
  público no Pages e permanece assim.
- **Publicar o manual em endereço próprio ou embuti-lo na imagem da API** —
  recusado na change anterior (design.md D1) pelas mesmas razões, que continuam
  válidas.

## Capabilities

### Added Capabilities

Nenhuma.

### Modified Capabilities

- `documentacao-usuario`: o requisito "Endereço do manual configurado por
  implantação" deixa de tratar a ausência de configuração como ordem de
  omissão e passa a tratá-la como **adoção do endereço canônico**, resolvendo a
  tensão com o requisito de alcançabilidade — que passa a ser satisfeito por
  padrão, e não apenas quando alguém se lembra de preencher uma variável. A
  omissão continua especificada para o caso de falha na obtenção da configuração
  e para a supressão deliberada.

- `platform-infrastructure`: o requisito "Provisionamento idempotente do ambiente
  de desenvolvimento" passa a exigir que o hook **reconcilie** o `.env` com as
  chaves do exemplo, e não apenas que o crie na primeira execução — sem
  sobrescrever valores locais já preenchidos. Idempotência deixa de significar
  "não faz nada se já existe" e passa a significar "converge para o conjunto de
  chaves esperado".

`identidade-visual` e `web-shell-e-auth` **não mudam**: a allowlist nominal do
`/auth/public-config` já contempla o endereço do manual, e a distinção entre
destinos internos e acesso auxiliar no rodapé do Sider permanece exatamente como
está.

## Impact

- **API (`apps/api/src`):** `config.ts` (resolução do endereço) e o ponto de
  arranque que hoje só valida esquema. A validação de `javascript:` e afins
  permanece.
- **Web (`apps/web/src`):** **nenhuma mudança de código.** `AppShell.tsx`,
  `schemas.ts` e `session-context.tsx` já se comportam corretamente para todos
  os valores que passarão a chegar.
- **Shared (`packages/shared`):** **nenhuma mudança.** `PublicConfigResponse`
  segue `{ appName, clientName, manualUrl }`.
- **Terraform (`infra/terraform`):** apenas texto — a `description` de
  `app_manual_url` em `variables.tf` e o comentário de
  `terraform.tfvars.example`, cuja semântica documentada ("vazio = nenhum acesso
  apresentado") deixa de ser verdadeira. `cloud_run.tf` **não muda** e
  **`terraform apply` não é necessário** (design.md D2): a variável continua
  chegando vazia ao contêiner e a aplicação passa a interpretá-la como ausência
  de escolha, de modo que a correção viaja no `gcloud run deploy --image` que o
  `deploy.yml` já executa.
- **Dev (`.claude/hooks/session-start.sh`):** reconciliação de chaves do `.env`.
- **Testes:** `apps/api/src/__tests__/auth.test.ts` (um caso muda de sentido,
  casos novos para a resolução padrão). Testes da web permanecem válidos como
  estão.
- **Configuração:** `.env.example`, `infra/terraform/terraform.tfvars.example`.
- **Docs:** `docs/manual/docs/a-tela.md` só muda se a redação atual condicionar a
  existência do item à configuração — a verificar na implementação.
- **Sem migração de banco. Sem prefixo de rota novo** — as três listas
  (`api-prefixes.ts`, `vite.config.ts`, `locals.tf`) permanecem intocadas.
