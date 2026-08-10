# Design — corrige-alcance-do-manual

## Contexto

Ver proposal.md — Why. O que importa aqui é a forma exata da cadeia que apaga o
item, porque ela tem **quatro** elos e corrigir um só não produz efeito visível:

```
variables.tf  app_manual_url = ""                    (elo 1)
      │  tfvars: linha comentada no .example         (elo 2)
      ▼
cloud_run.tf  env APP_MANUAL_URL = ""   ← sempre definida, incondicional
      ▼
config.ts  optional('APP_MANUAL_URL', '')            (elo 3)
      │    ⚠ `??` só cai no default se for `undefined`;
      │      string vazia NÃO é undefined
      ▼
/auth/public-config → { manualUrl: "" }
      ▼
AppShell  manualUrl ? item : undefined  →  nada renderizado

sandbox:  session-start.sh  `if [ ! -f .env ]`       (elo 4)
          → .env anterior à change nunca recebe a chave nova
```

O elo 3 é o que decide o desenho. Como `cloud_run.tf` define a variável
**incondicionalmente**, em produção `process.env.APP_MANUAL_URL` é `''`, não
`undefined` — então um default não-vazio colocado em `config.ts` seria
silenciosamente anulado pelo Terraform, e a correção não teria efeito nenhum
onde mais importa.

Restrições que moldam as opções:

- `docs/*` está no allowlist "sem efeito em produção" de
  `.github/workflows/deploy.yml` — um merge que só toca documentação pula
  build/push/deploy, de propósito (design.md D1 da change anterior). Qualquer
  desenho que faça a aplicação **depender em runtime** de um arquivo sob `docs/`
  quebra essa otimização ou entrega um valor desatualizado.
- A imagem da API não empacota `docs/`.
- `packages/shared` é consumido compilado de `dist/`.

## Goals / Non-Goals

**Goals:**

- O acesso ao manual passa a existir por padrão em toda implantação, sem
  depender de ninguém lembrar de preencher uma variável.
- A correção chega a produção pelo pipeline normal de deploy, sem exigir
  intervenção manual de infraestrutura.
- O modelo de configuração em runtime da change anterior (mesma imagem, várias
  implantações — D2) permanece intacto.
- A classe de falha "chave nova no `.env.example` invisível no sandbox" deixa de
  se repetir a cada variável futura.

**Non-Goals:**

- Não se estabelece uma política geral sobre defaults de configuração no
  repositório (fora de escopo na proposal — exige levantamento próprio).
- Não se altera a forma da resposta de `/auth/public-config` nem o contrato
  `PublicConfigResponse`.
- Não se toca no código da SPA.

## Decisões

### D1. O endereço canônico é constante da aplicação, travada por teste contra o `mkdocs.yml`

**Decisão:** o endereço canônico vive como constante em `apps/api/src/config.ts`,
com o valor de `site_url` de `docs/manual/mkdocs.yml`. Um teste lê o
`mkdocs.yml` do repositório e falha se os dois divergirem.

**Por que não derivar do `mkdocs.yml` em runtime:** a imagem da API não carrega
`docs/`. Seria preciso empacotá-lo só para ler uma linha de YAML.

**Por que não derivar em tempo de build** (gerar a constante a partir do YAML no
build da imagem): resolveria a duplicação, mas colide com o allowlist do
`deploy.yml`. Uma alteração de `site_url` toca apenas `docs/**`, é classificada
como "sem efeito em produção", e o deploy é pulado — a aplicação continuaria
servindo o endereço antigo, sem nenhum sinal.

**Por que o teste resolve isso:** com a asserção de igualdade na CI, uma
alteração de `site_url` **reprova o build** até que a constante seja atualizada
no mesmo commit. Aí o commit passa a tocar `apps/api/**`, deixa de ser docs-only,
e o deploy acontece. A duplicação existe, mas é uma duplicação **vigiada**, e o
mecanismo de vigilância também conserta a interação com o allowlist. É mais
barato e mais honesto do que uma derivação que falha em silêncio.

### D2. String vazia é tratada como ausência de escolha, na aplicação

**Decisão:** a resolução do endereço trata `undefined` e `''` como o **mesmo**
caso — ausência de escolha — e devolve o endereço canônico nos dois. Vale tanto
para a variável de ambiente quanto para o override de teste em `createApp`.

É o que o spec delta passou a exigir ("as duas formas SHALL produzir o mesmo
resultado, para que nenhuma camada de implantação possa anular o padrão apenas
por declarar a configuração vazia").

**Alternativa avaliada e recusada — tornar a env var condicional no Terraform**
(bloco `dynamic`, definindo `APP_MANUAL_URL` só quando não vazia): funcionaria,
mas conserta **um** produtor de string vazia. Cloud Run editado pelo console,
`.env` local com a chave vazia, um `docker run -e APP_MANUAL_URL=` — todos
voltariam a apagar o item. A defesa no consumidor cobre todos de uma vez.

**Consequência boa e não óbvia:** com D2, `cloud_run.tf` **não precisa mudar** e
**`terraform apply` não é necessário** para a correção surtir efeito. A variável
continua chegando vazia ao contêiner; a aplicação é que passa a interpretá-la
corretamente. A correção viaja no deploy normal da imagem, que é o caminho que
o `deploy.yml` já executa. Mudam apenas a `description` de `variables.tf` e o
comentário do `tfvars.example`, para que a semântica documentada ("vazio =
nenhum acesso apresentado") deixe de estar errada.

### D3. "Implantação sem manual" deixa de ser estado suportado

**Decisão:** nenhum valor de configuração suprime o acesso. `APP_MANUAL_URL`
troca o destino; não liga nem desliga.

**Alternativa avaliada e recusada — supressão por valor sentinela** (algo como
`APP_MANUAL_URL=none`, ou um segundo flag booleano): preserva a capacidade de
uma implantação não oferecer o manual, ao custo de um conceito de configuração a
mais para documentar, testar e explicar. Foi recusada porque **esse estado nunca
foi pedido por ninguém** — nasceu como efeito colateral da analogia com
`APP_CLIENT_NAME` e foi exatamente ele que apagou a funcionalidade. Reintroduzir
o mesmo estado por outro nome preserva a causa do defeito trocando apenas o
gatilho. Se um dia uma implantação real precisar disso, volta como change
própria, com motivação concreta.

**O que isso não muda:** a SPA continua com o ramo `manualUrl ? item : nada`.
Ele deixa de ser alcançável por configuração e passa a existir **só** para a
degradação de `GET /auth/public-config` falhando (`DEFAULT_PUBLIC_CONFIG`,
design.md D4 da change anterior). O teste de web que hoje cobre "item ausente
quando `manualUrl` está vazia" continua válido — muda de significado, de
"não configurado" para "configuração indisponível", e não deve ser removido.

### D4. Reconciliação do `.env` por acréscimo das chaves ausentes

**Decisão:** o hook passa a percorrer as chaves declaradas em `.env.example` e
acrescentar ao `.env` apenas as que faltam, com o valor do exemplo. Não
sobrescreve valor existente, não remove chave que só existe localmente, não
reordena nem reescreve o que já está lá. Linhas comentadas do exemplo não são
chaves e não entram.

**Por que não regenerar o `.env` a partir do exemplo:** destruiria valores
locais ajustados à mão, que é justamente o motivo de o arquivo não ser
versionado.

**Por que não falhar quando faltam chaves,** exigindo ação manual: o sandbox é
efêmero e não interativo; uma falha de arranque do hook trocaria um bug silencioso
por uma sessão inutilizável.

**Por que isso é do escopo desta change** e não de uma change de tooling: é o
quarto elo da mesma cadeia. Sem ele, a correção não é observável em
desenvolvimento — o `.env` do sandbox continuaria sem a chave, e o próximo caso
igual reapareceria sozinho.

### D5. A resolução é testada como função, não pelo singleton de configuração

**Decisão:** a resolução (`undefined | '' | valor → endereço`) é exercida
diretamente com entradas explícitas, e não através do objeto `config`, que lê
`process.env` no carregamento do módulo.

A cobertura anterior falhou precisamente por testar o valor injetado em vez do
valor resolvido: `expect(manualUrl: config.appManualUrl)` é verdadeiro para
qualquer configuração, inclusive a quebrada. Os casos passam a ser: sem
variável no ambiente, variável vazia, variável preenchida, variável inválida
(esquema não http/https — comportamento de D5 da change anterior, inalterado).

## Risks / Trade-offs

- **O endereço canônico aponta para o Pages deste repositório.** Um fork que não
  publique o próprio manual exibirá o manual do upstream. → Mitigação: o
  override por implantação existe e é o mecanismo previsto; e um manual do mesmo
  produto é melhor do que nenhum. O caso "fork que quer nenhum manual" é o
  estado removido em D3, com o caminho de volta descrito lá.

- **Duplicação do endereço** entre `mkdocs.yml` e a constante da aplicação. →
  Mitigação: teste de igualdade na CI (D1), que também força o commit a deixar
  de ser docs-only e a ser efetivamente implantado.

- **Renomear o repositório ou mudar o domínio do Pages** quebra o endereço. → O
  teste de D1 detecta a divergência assim que `site_url` for atualizado; se
  ninguém atualizar `site_url`, o próprio site já estará quebrado e o problema é
  anterior a esta change.

- **A reconciliação do `.env` acrescenta chaves de exemplo com valores de
  exemplo**, que podem não servir ao ambiente local. → Mitigação: só ocorre para
  chaves **ausentes**, cujo estado alternativo é "não existir" — um valor de
  exemplo é estritamente melhor do que nenhum. Valores preenchidos nunca são
  tocados.

## Migration Plan

1. Merge na `main` → CI → `deploy.yml` builda e faz `gcloud run deploy` da nova
   imagem. **Nenhum `terraform apply` é necessário** (D2).
2. Verificação: `curl -s https://<url>/auth/public-config` deve devolver
   `manualUrl` com o endereço canônico, e não `""`.
3. Verificação visual: o item "Manual do usuário" aparece no rodapé do Sider
   para qualquer papel autenticado.
4. **Rollback:** reverter o commit e reimplantar. Não há migração de banco,
   mudança de contrato nem estado persistido — o rollback é integralmente
   coberto pelo redeploy da imagem anterior.
