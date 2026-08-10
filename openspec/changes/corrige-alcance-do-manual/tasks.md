# Tasks — corrige-alcance-do-manual

## 1. API — resolução do endereço

- [ ] 1.1 `apps/api/src/config.ts`: declarar a constante do **endereço canônico**
  do manual com o valor de `site_url` de `docs/manual/mkdocs.yml`
  (`https://carlossalesnaturaltec.github.io/gdoc/`). Comentar que a duplicação é
  deliberada e vigiada pelo teste da tarefa 4.1, e por que não é derivada em
  runtime nem em build (design.md D1: a imagem não carrega `docs/`, e derivar em
  build colidiria com o allowlist docs-only do `deploy.yml`).
- [ ] 1.2 `apps/api/src/config.ts`: trocar `optional('APP_MANUAL_URL', '')` por
  uma resolução que trate `undefined` **e** string vazia como ausência de
  escolha, devolvendo o endereço canônico nos dois casos (design.md D2).
  Preferir um helper nomeado (ex.: `optionalNonEmpty`) a um `||` solto, para que
  a intenção fique legível ao lado dos demais `optional`/`required`.
- [ ] 1.3 `apps/api/src/app.ts`: garantir que o override
  `createApp(ports, { appManualUrl })` passe pela **mesma** resolução — um
  override vazio em teste deve resolver para o canônico, igual à variável de
  ambiente vazia. A validação de esquema (`javascript:` e afins derrubando o
  arranque) permanece exatamente como está, aplicada ao valor **já resolvido**.
- [ ] 1.4 Confirmar que `packages/shared`, `apps/web` e os três arquivos de
  prefixos (`api-prefixes.ts`, `vite.config.ts`, `locals.tf`) **não** precisam de
  alteração — a forma da resposta e as rotas não mudam.

## 2. Terraform — semântica documentada

- [ ] 2.1 `infra/terraform/variables.tf`: corrigir a `description` de
  `app_manual_url`, que hoje afirma "Vazio (padrão) = nenhum acesso ao manual é
  apresentado" — passa a ser override opcional do endereço; vazio significa
  adotar o endereço canônico da aplicação.
- [ ] 2.2 `infra/terraform/terraform.tfvars.example`: mesmo ajuste no comentário,
  mantendo a linha comentada (agora é de fato opcional).
- [ ] 2.3 **Não** alterar `cloud_run.tf` e **não** exigir `terraform apply` — a
  definição incondicional da env var deixa de ser um problema com a tarefa 1.2
  (design.md D2). Registrar isso na verificação, não como mudança.

## 3. Sandbox — reconciliação do `.env`

- [ ] 3.1 `.claude/hooks/session-start.sh`: além de copiar `.env.example` quando
  `.env` não existe, acrescentar ao `.env` existente as chaves declaradas no
  exemplo que estejam ausentes, com o valor do exemplo. Ignorar linhas
  comentadas e linhas em branco do exemplo.
- [ ] 3.2 Garantir as três não-ações exigidas pela spec: não sobrescrever valor
  já definido localmente, não remover chave que só existe no `.env` local, não
  reordenar nem reescrever o conteúdo preexistente (acréscimo ao final).
- [ ] 3.3 Verificar idempotência: rodar o hook duas vezes seguidas não duplica
  chaves nem altera o arquivo na segunda execução.
- [ ] 3.4 Validar no sandbox atual que `APP_MANUAL_URL` chega ao `.env` existente
  — é o caso concreto que originou a change.

## 4. Testes

- [ ] 4.1 Teste novo (API): o endereço canônico da aplicação é **igual** ao
  `site_url` de `docs/manual/mkdocs.yml`, lido do repositório. É o mecanismo que
  impede a duplicação de D1 de divergir em silêncio.
- [ ] 4.2 Testes novos da resolução, exercitada como função com entradas
  explícitas (design.md D5), cobrindo: variável ausente → canônico; variável
  vazia → canônico; variável preenchida → valor configurado; variável inválida
  (esquema não http/https) → falha de arranque nomeando `APP_MANUAL_URL`.
- [ ] 4.3 `apps/api/src/__tests__/auth.test.ts`: o caso hoje chamado
  "`APP_MANUAL_URL` vazia arranca normalmente e responde `manualUrl` vazio"
  **muda de sentido** — passa a afirmar que vazia responde o endereço canônico.
  É alteração deliberada de contrato, não ajuste incidental.
- [ ] 4.4 `apps/api/src/__tests__/auth.test.ts`: a asserção de contrato
  `manualUrl: config.appManualUrl` deixa de ser tautológica — comparar com o
  endereço esperado, não com a própria configuração que a produziu.
- [ ] 4.5 **Não** remover o teste de web "item ausente quando `manualUrl` está
  vazia" (`shell-manual-do-usuario.test.tsx`). Ele continua válido, mas cobre
  agora a degradação de `/auth/public-config` indisponível, não "não
  configurado" (design.md D3) — atualizar o nome do caso e o comentário para
  refletir isso.

## 5. Documentação e fechamento

- [ ] 5.1 `.env.example`: ajustar o comentário de `APP_MANUAL_URL` para override
  opcional (o valor sugerido já é o canônico e pode permanecer).
- [ ] 5.2 `docs/manual/docs/a-tela.md`: verificar a redação atual do item do
  manual; se ela condicionar a existência do acesso à configuração da
  implantação, corrigir — o acesso passa a existir sempre.
- [ ] 5.3 Rodar `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` na raiz. Lembrar que `openspec/` e `docs/` estão fora do
  Prettier de propósito.
- [ ] 5.4 Verificação pós-deploy (design.md — Migration Plan):
  `curl -s https://<url>/auth/public-config` devolve `manualUrl` com o endereço
  canônico em vez de `""`, e o item aparece no rodapé do Sider.
