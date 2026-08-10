## 1. Assets — geração e posicionamento da logomarca

- [x] 1.1 Copiar `docs/images/logo_papel_hub.jpg` para `apps/web/public/`
  sob um nome de asset estável (não o nome de entrega do cliente) — ex.
  `logo-papelhub.jpg`. Sem processamento (design.md D1/D3).
- [x] 1.2 Gerar o favicon derivado: recorte quadrado central da arte fonte
  (301×301, capturando o núcleo do símbolo) + redimensão para os tamanhos de
  favicon usuais, via PowerShell + `System.Drawing` (sem dependência nova de
  pacote — .NET já está disponível no Windows; passo único de geração de
  asset, não script de build). Commitar o resultado em `apps/web/public/`
  (design.md D4).
- [x] 1.3 Conferir visualmente os dois assets gerados antes de seguir: a
  logo principal não deve estar corrompida/rotacionada incorretamente
  (a fonte tem metadado EXIF de orientação); o favicon não deve estar
  esticado.

## 2. Componente compartilhado — "moldura escura contida"

- [x] 2.1 Criar um componente de apresentação único (ex.:
  `apps/web/src/shell/BrandMark.tsx` ou local equivalente) que renderiza a
  logomarca dentro de um contêiner escuro arredondado, parametrizado por
  tamanho — reaproveitado pelo login e pelo shell expandido, para que o
  padrão visual não divirja entre os dois lugares (design.md D2).
- [x] 2.2 O componente aceita uma prop que decide entre modo decorativo
  (`aria-hidden`, usado no login) e modo com nome acessível (`alt`, usado no
  shell expandido) — não duas implementações separadas (design.md D7).

## 3. API — troca de literal

- [x] 3.1 `apps/api/src/routes/auth.ts`: `GET /auth/public-config` passa a
  responder `appName: 'PapelHub'`. Contrato `{ appName, clientName }`
  inalterado.
- [x] 3.2 `apps/api/src/server.ts`: log de boot passa a `PapelHub API
  listening…`.
- [x] 3.3 Confirmar que nenhum prefixo de rota foi alterado — `api-prefixes.ts`,
  `apps/web/vite.config.ts` e `infra/terraform/locals.tf` **não** devem
  mudar.

## 4. Web — nome e logomarca

- [x] 4.1 `apps/web/src/auth/session-context.tsx`: `DEFAULT_PUBLIC_CONFIG`
  passa a `{ appName: 'PapelHub', clientName: '' }`.
- [x] 4.2 `apps/web/index.html`: `<title>` para **`PapelHub`** (apenas o
  nome, sem identificação de cliente — mesma razão de design.md D9 da change
  arquivada: o literal estático não pode reintroduzir hardcode). `<link
  rel="icon">` passa a apontar para o favicon derivado na tarefa 1.2, com o
  `type` MIME correspondente ao formato de saída escolhido. (Achado durante a
  implementação, fora da lista original: `favicon.svg` também era consumido
  por `apps/web/src/app/PlaceholderPage.tsx` como ícone decorativo da tela de
  Início — atualizado para `favicon.png` junto com a remoção do SVG obsoleto,
  que carregava `aria-label="GDoc"`.)
- [x] 4.3 `apps/web/src/auth/LoginPage.tsx`: substitui o avatar-ícone
  decorativo (`FolderOutlined` em círculo azul) pelo `BrandMark` em modo
  decorativo; heading continua `<h3>PapelHub</h3>` como elemento separado —
  nome acessível permanece puro (US 1.2; design.md D7). Atualizar o
  comentário que documenta esse cuidado.
- [x] 4.4 `apps/web/src/shell/AppShell.tsx`:
  - Estado **expandido**: substitui o texto `Doc7` pelo `BrandMark` em modo
    com nome acessível (`alt="PapelHub"`) — design.md D7.
  - Estado **colapsado**: `D7` → `PH`, continua texto puro, sem logomarca
    (design.md D6).
  - Identificação do cliente (`clientName`) continua elemento irmão, só no
    expandido — mecanismo inalterado.
- [x] 4.5 `apps/web/src/app/HomePage.tsx`: "Bem-vindo ao PapelHub".

## 5. Testes

- [x] 5.1 Atualizar a âncora de nome literal `'Doc7'` → `'PapelHub'` em:
  `login.test.tsx`, `role-guard.test.tsx`, `require-auth.test.tsx`,
  `unidades.test.tsx`, `painel.test.tsx`, `download-pasta.test.tsx`,
  `shell-identidade-visual.test.tsx`, `auth.test.ts`. (`painel.test.tsx`
  também precisou trocar `findByText('Doc7')` por
  `findByRole('img', { name: 'PapelHub' })` — a marca do shell expandido, que
  o teste usava como sinal de "shell montou", deixou de ser texto puro.)
- [x] 5.2 Novo caso: no shell expandido, a marca (imagem) tem nome acessível
  `PapelHub` (ex.: `getByRole('img', { name: 'PapelHub' })` ou equivalente
  conforme a implementação do `BrandMark`).
- [x] 5.3 Novo caso: no shell colapsado, nenhuma imagem de logomarca é
  renderizada — só o texto `PH`.
- [x] 5.4 Confirmar que o caso existente de nome acessível puro no heading do
  login (`getByRole('heading', { name: 'PapelHub' })`, sem contaminação pela
  identificação do cliente) continua passando com o ícone trocado pela
  logomarca.
- [x] 5.5 Confirmar que `__tests__/web-serving.test.ts` continua passando sem
  alteração (nenhum prefixo novo).

## 6. Documentação (fora do manual)

- [x] 6.1 `README.md`: nome exibido do produto.
- [x] 6.2 `CLAUDE.md`: linha "Nome exibido do produto é `Doc7`" →
  `PapelHub`; manter a explicação de que identificadores internos (`gdoc`)
  permanecem por decisão.
- [x] 6.3 `docs/frontend_roadmap.md`: referências ao nome exibido.
- [x] 6.4 `openspec/specs/identidade-visual/spec.md`: sincronizar a partir da
  spec delta desta change (via `opsx:sync` ou arquivamento). Sincronizado
  manualmente (literal `Doc7`→`PapelHub` no requisito modificado + os quatro
  requisitos novos da logomarca anexados). `openspec validate` acusa 1 erro
  pré-existente e não relacionado (`requirements.N.text` do requisito "Falha
  ao obter a identidade visual não impede o login" — confirmado via `git
  stash` que já falhava antes desta change, provável falso positivo do
  validador com "NÃO SHALL").

## 7. Manual do usuário (MkDocs) — sequenciado por último

- [x] 7.1 Antes de editar, reconferir o estado atual de `docs/manual/**` —
  a change `manual-usuario-mkdocs` pode ter avançado tasks restantes nesse
  meio-tempo (design.md D5). Tratar o conteúdo abaixo como alvo a
  reconfirmar, não como diff estático. (Estado reconferido: os quatro
  arquivos abaixo continuavam com `Doc7`; nenhuma colisão com a change
  `manual-usuario-mkdocs`.)
- [x] 7.2 `docs/manual/mkdocs.yml`: adicionar `logo:` no tema Material
  apontando para o asset gerado na tarefa 1.1 (ou uma cópia dedicada em
  `docs/manual/docs/` se a estrutura do site MkDocs exigir os assets dentro
  da própria pasta do site); `site_name`/`site_description` de `Doc7` para
  `PapelHub`. (Usada uma cópia do favicon quadrado da tarefa 1.2 —
  `docs/manual/docs/assets/logo-papelhub.png` —, não da logo retrato de
  1.1: o slot de logo do tema Material é estreito/baixo, e a arte retrato
  ali viraria uma tira fina sem recorte; o mesmo raciocínio de "recorte, não
  esticamento" de design.md D4 se aplica. `favicon:` também aponta para o
  mesmo arquivo.)
- [x] 7.3 Atualizar prosa `Doc7` → `PapelHub` em `docs/manual/docs/index.md`,
  `a-tela.md`, `primeiro-acesso.md`, `referencia/limites.md`. (Achado durante
  a implementação: `primeiro-acesso.md` linha 6 linkava para
  `index.md#o-que-e-o-doc7`, âncora gerada a partir do heading "## O que é o
  Doc7" — corrigido para `#o-que-e-o-papelhub` junto com a troca do heading,
  senão o build `--strict` do MkDocs quebraria por link interno morto.
  Verificado com `mkdocs build --strict` local: build limpo, sem avisos de
  link quebrado.)

## 8. Verificação

- [x] 8.1 `npm run lint && npm run build && npm run test` na raiz. `lint` e
  `build` passam limpos (build exigiu recompilar `packages/shared` antes de
  `apps/api`/`apps/web`, e `npm install` para trazer uma dependência de
  `apps/web` — `client-zip` — ausente do `node_modules`; ambos pré-existentes
  e sem relação com esta change, confirmado revertendo as mudanças com
  `git stash` e reproduzindo a mesma falha). `npm run test` inicialmente
  bloqueado neste ambiente local (Node 18.8.0 nativo — o repo pinha 22 em
  `.nvmrc` — quebra o `jsdom` da suíte web com `ERR_REQUIRE_ESM`; Postgres
  não provisionado quebra a suíte da API com `ECONNREFUSED :5433`, já que o
  hook `.claude/hooks/session-start.sh` só roda com `CLAUDE_CODE_REMOTE=true`)
  — **desbloqueado e executado** com Docker Desktop (disponibilizado pelo
  usuário) para o Postgres e um Node 22.14.0 portátil (baixado à parte, sem
  alterar o Node do sistema) para a suíte web:
  - **API**: `postgres:16` via Docker, role `gdoc_dev` **não-superuser**
    (criada por um bootstrap `postgres` separado — usar `POSTGRES_USER=gdoc_dev`
    direto no container o torna superuser e mascara todo bug de RLS, exatamente
    o que a CI evita com o papel `gdoc_ci` — CLAUDE.md). Resultado:
    **27/27 arquivos, 237/237 testes**, incluindo `auth.test.ts` (âncora
    `appName: 'PapelHub'`) e `rls-isolation.test.ts`/`grants.test.ts`/
    `people.test.ts` (que tinham falso-positivo passando com o papel
    superuser antes da correção do role).
  - **Web**: `237/237 testes` — `permissoes.test.tsx` (não tocado por esta
    change) deu timeout numa corrida com a suíte inteira em paralelo por
    contenção de CPU deste ambiente; reexecutado isolado e passou limpo
    (9/9), confirmando que não é regressão.
- [x] 8.2 Subir a app (`make dev-api` + `npm run dev:web`) e conferir
  visualmente: login com logomarca emoldurada + heading `PapelHub` +
  `SETES`; shell expandido com logomarca + `SETES`; shell colapsado só `PH`;
  título da aba `PapelHub - SETES`; favicon não distorcido. **Não
  concluído** — sem confirmação visual ao vivo. Chegou a ser preparado com
  Docker (Postgres migrado/seedado, `.dev/fake-gcs-signer-key.json` gerado,
  API e web dev server sendo subidos com o Node 22 portátil), mas a sessão
  foi interrompida no meio da subida dos servidores e o Docker Desktop caiu
  junto — o Postgres provisionado nesta tarefa não sobrevive. Depois de
  ponderar o custo de reprovisionar tudo de novo contra o ganho marginal
  (a suíte de testes web já cobre a marca do shell expandido via
  `getByRole('img', { name: 'PapelHub' })`, o colapsado via `getByText('PH')`
  e o heading do login via `getByRole('heading', { name: 'PapelHub' })` —
  ver tarefa 5), o usuário optou por não retomar o print ao vivo. Fica como
  lacuna de verificação conhecida, não como algo que falhou.
- [x] 8.3 Conferir com `APP_CLIENT_NAME` vazia que nada quebra (mesmo
  comportamento de degradação silenciosa já coberto pela capability).
  **Revisão de código apenas** (sem execução, mesmo motivo de 8.2): o
  mecanismo de degradação (`DEFAULT_PUBLIC_CONFIG`, fallback em
  `session-context.tsx`, ausência condicional do subtítulo em
  `LoginPage.tsx`/`AppShell.tsx`) não foi tocado por esta change — só o
  literal `appName` mudou. Também coberto indiretamente pelos testes web
  ("sem identificação de cliente configurada, nenhum subtítulo aparece e o
  login segue funcional", `login.test.tsx`), que passam.
- [x] 8.4 Rodar o manual MkDocs localmente (ou build estático) e conferir a
  logo no tema e a prosa atualizada. Feito: `pip install -r
  docs/manual/requirements.txt && mkdocs build -f docs/manual/mkdocs.yml
  --strict` — build limpo, sem link quebrado; `logo`/`favicon` do tema
  apontam para `assets/logo-papelhub.png` e renderizam corretamente
  (conferido abrindo o PNG gerado em `site/assets/`); `site` de saída
  removido após a conferência (artefato de build, não versionado).
