## 1. Assets — geração e posicionamento da logomarca

- [ ] 1.1 Copiar `docs/images/logo_papel_hub.jpg` para `apps/web/public/`
  sob um nome de asset estável (não o nome de entrega do cliente) — ex.
  `logo-papelhub.jpg`. Sem processamento (design.md D1/D3).
- [ ] 1.2 Gerar o favicon derivado: recorte quadrado central da arte fonte
  (301×301, capturando o núcleo do símbolo) + redimensão para os tamanhos de
  favicon usuais, via PowerShell + `System.Drawing` (sem dependência nova de
  pacote — .NET já está disponível no Windows; passo único de geração de
  asset, não script de build). Commitar o resultado em `apps/web/public/`
  (design.md D4).
- [ ] 1.3 Conferir visualmente os dois assets gerados antes de seguir: a
  logo principal não deve estar corrompida/rotacionada incorretamente
  (a fonte tem metadado EXIF de orientação); o favicon não deve estar
  esticado.

## 2. Componente compartilhado — "moldura escura contida"

- [ ] 2.1 Criar um componente de apresentação único (ex.:
  `apps/web/src/shell/BrandMark.tsx` ou local equivalente) que renderiza a
  logomarca dentro de um contêiner escuro arredondado, parametrizado por
  tamanho — reaproveitado pelo login e pelo shell expandido, para que o
  padrão visual não divirja entre os dois lugares (design.md D2).
- [ ] 2.2 O componente aceita uma prop que decide entre modo decorativo
  (`aria-hidden`, usado no login) e modo com nome acessível (`alt`, usado no
  shell expandido) — não duas implementações separadas (design.md D7).

## 3. API — troca de literal

- [ ] 3.1 `apps/api/src/routes/auth.ts`: `GET /auth/public-config` passa a
  responder `appName: 'PapelHub'`. Contrato `{ appName, clientName }`
  inalterado.
- [ ] 3.2 `apps/api/src/server.ts`: log de boot passa a `PapelHub API
  listening…`.
- [ ] 3.3 Confirmar que nenhum prefixo de rota foi alterado — `api-prefixes.ts`,
  `apps/web/vite.config.ts` e `infra/terraform/locals.tf` **não** devem
  mudar.

## 4. Web — nome e logomarca

- [ ] 4.1 `apps/web/src/auth/session-context.tsx`: `DEFAULT_PUBLIC_CONFIG`
  passa a `{ appName: 'PapelHub', clientName: '' }`.
- [ ] 4.2 `apps/web/index.html`: `<title>` para **`PapelHub`** (apenas o
  nome, sem identificação de cliente — mesma razão de design.md D9 da change
  arquivada: o literal estático não pode reintroduzir hardcode). `<link
  rel="icon">` passa a apontar para o favicon derivado na tarefa 1.2, com o
  `type` MIME correspondente ao formato de saída escolhido.
- [ ] 4.3 `apps/web/src/auth/LoginPage.tsx`: substitui o avatar-ícone
  decorativo (`FolderOutlined` em círculo azul) pelo `BrandMark` em modo
  decorativo; heading continua `<h3>PapelHub</h3>` como elemento separado —
  nome acessível permanece puro (US 1.2; design.md D7). Atualizar o
  comentário que documenta esse cuidado.
- [ ] 4.4 `apps/web/src/shell/AppShell.tsx`:
  - Estado **expandido**: substitui o texto `Doc7` pelo `BrandMark` em modo
    com nome acessível (`alt="PapelHub"`) — design.md D7.
  - Estado **colapsado**: `D7` → `PH`, continua texto puro, sem logomarca
    (design.md D6).
  - Identificação do cliente (`clientName`) continua elemento irmão, só no
    expandido — mecanismo inalterado.
- [ ] 4.5 `apps/web/src/app/HomePage.tsx`: "Bem-vindo ao PapelHub".

## 5. Testes

- [ ] 5.1 Atualizar a âncora de nome literal `'Doc7'` → `'PapelHub'` em:
  `login.test.tsx`, `role-guard.test.tsx`, `require-auth.test.tsx`,
  `unidades.test.tsx`, `painel.test.tsx`, `download-pasta.test.tsx`,
  `shell-identidade-visual.test.tsx`, `auth.test.ts`.
- [ ] 5.2 Novo caso: no shell expandido, a marca (imagem) tem nome acessível
  `PapelHub` (ex.: `getByRole('img', { name: 'PapelHub' })` ou equivalente
  conforme a implementação do `BrandMark`).
- [ ] 5.3 Novo caso: no shell colapsado, nenhuma imagem de logomarca é
  renderizada — só o texto `PH`.
- [ ] 5.4 Confirmar que o caso existente de nome acessível puro no heading do
  login (`getByRole('heading', { name: 'PapelHub' })`, sem contaminação pela
  identificação do cliente) continua passando com o ícone trocado pela
  logomarca.
- [ ] 5.5 Confirmar que `__tests__/web-serving.test.ts` continua passando sem
  alteração (nenhum prefixo novo).

## 6. Documentação (fora do manual)

- [ ] 6.1 `README.md`: nome exibido do produto.
- [ ] 6.2 `CLAUDE.md`: linha "Nome exibido do produto é `Doc7`" →
  `PapelHub`; manter a explicação de que identificadores internos (`gdoc`)
  permanecem por decisão.
- [ ] 6.3 `docs/frontend_roadmap.md`: referências ao nome exibido.
- [ ] 6.4 `openspec/specs/identidade-visual/spec.md`: sincronizar a partir da
  spec delta desta change (via `opsx:sync` ou arquivamento).

## 7. Manual do usuário (MkDocs) — sequenciado por último

- [ ] 7.1 Antes de editar, reconferir o estado atual de `docs/manual/**` —
  a change `manual-usuario-mkdocs` pode ter avançado tasks restantes nesse
  meio-tempo (design.md D5). Tratar o conteúdo abaixo como alvo a
  reconfirmar, não como diff estático.
- [ ] 7.2 `docs/manual/mkdocs.yml`: adicionar `logo:` no tema Material
  apontando para o asset gerado na tarefa 1.1 (ou uma cópia dedicada em
  `docs/manual/docs/` se a estrutura do site MkDocs exigir os assets dentro
  da própria pasta do site); `site_name`/`site_description` de `Doc7` para
  `PapelHub`.
- [ ] 7.3 Atualizar prosa `Doc7` → `PapelHub` em `docs/manual/docs/index.md`,
  `a-tela.md`, `primeiro-acesso.md`, `referencia/limites.md`.

## 8. Verificação

- [ ] 8.1 `npm run lint && npm run build && npm run test` na raiz.
- [ ] 8.2 Subir a app (`make dev-api` + `npm run dev:web`) e conferir
  visualmente: login com logomarca emoldurada + heading `PapelHub` +
  `SETES`; shell expandido com logomarca + `SETES`; shell colapsado só `PH`;
  título da aba `PapelHub - SETES`; favicon não distorcido.
- [ ] 8.3 Conferir com `APP_CLIENT_NAME` vazia que nada quebra (mesmo
  comportamento de degradação silenciosa já coberto pela capability).
- [ ] 8.4 Rodar o manual MkDocs localmente (ou build estático) e conferir a
  logo no tema e a prosa atualizada.
