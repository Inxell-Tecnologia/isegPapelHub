# Proposal — rebranding-papelhub

## Why

O cliente renomeou o produto de **Doc7** para **PapelHub** e, desta vez,
definiu também uma logomarca oficial (`docs/images/logo_papel_hub.jpg`) —
algo que o rebrand anterior (`GDoc` → `Doc7`, arquivado em
`openspec/changes/archive/2026-08-05-rebranding-doc7-setes/`) explicitamente
deixou fora de escopo ("Logo/ícone, paleta e tipografia — a marca visual
continua o `FolderOutlined`... Só o texto muda").

É a mesma capability (`identidade-visual`) se repetindo em dois eixos:

1. **Nome exibido, de novo.** Mesmo padrão do rebrand anterior: substituição
   de texto nos seis pontos onde `Doc7` está hardcoded na camada de
   apresentação, mais a cauda de testes que ancoram o nome.
2. **Logomarca, pela primeira vez.** O produto passa a ter uma imagem oficial
   além de texto. A arte fornecida (`301×502`, JPEG, fundo opaco em gradiente
   escuro, sem transparência) não pode ser recortada neste ambiente — não há
   ferramenta de remoção de fundo disponível (sem ImageMagick, PIL/Pillow ou
   `sharp` instalados). A decisão de design (ver design.md D1) é usar a
   imagem como está, sempre contida numa moldura escura própria, nunca solta
   sobre fundo claro.

## What Changes

- **Nome da aplicação `Doc7` → `PapelHub`** em toda a camada de apresentação
  — mesmos seis pontos do rebrand anterior: `apps/web/index.html` (`<title>`),
  `apps/web/src/auth/LoginPage.tsx` (heading), `apps/web/src/shell/AppShell.tsx`
  (marca do sider), `apps/web/src/app/HomePage.tsx`, `apps/web/src/auth/
  session-context.tsx` (fallback), `apps/api/src/routes/auth.ts`
  (`GET /auth/public-config`) e o log de boot em `apps/api/src/server.ts`. A
  composição em runtime do título do documento (`PapelHub - SETES`) e o
  endpoint público de identidade visual **não mudam de mecanismo** — só o
  literal `appName`.
- **Abreviação do sider colapsado** `D7` → `PH`.
- **Logomarca oficial adicionada** — novo asset estático servido pela SPA
  (mesmo padrão de `apps/web/public/favicon.svg`), sempre dentro de uma
  moldura/card escuro (padrão visual único reaproveitado nos três lugares
  abaixo, ver design.md D2):
  - **Tela de login**: substitui o avatar-ícone decorativo (`FolderOutlined`
    em círculo azul, hoje `aria-hidden`) pela logomarca emoldurada. O
    `<h3>PapelHub</h3>` continua existindo como elemento separado — é ele que
    carrega o nome acessível do heading, preservando a US 1.2 e o padrão já
    estabelecido pelo rebrand anterior (design.md D6 da change arquivada).
  - **Shell expandido**: a marca de texto `PapelHub` é substituída pela
    logomarca emoldurada (há espaço horizontal suficiente).
  - **Shell colapsado**: **sem mudança de mecanismo** — continua abreviação
    em texto (`PH`), não a logomarca. A arte é um recorte retrato com muito
    espaço negativo; não sobrevive a ~32px sem um recorte dedicado, que este
    ambiente não tem como produzir com qualidade.
  - **Favicon** (`apps/web/public/favicon.svg`) — passa a refletir a mesma
    arte/moldura. Hoje ainda carrega `aria-label="GDoc"`, resquício nunca
    corrigido nem no rebrand anterior.
- **Manual do usuário (MkDocs)** — `docs/manual/mkdocs.yml` ganha `logo:` no
  tema Material apontando para o mesmo asset; toda a prosa `Doc7` → `PapelHub`
  nas páginas do manual (`index.md`, `a-tela.md`, `primeiro-acesso.md`,
  `referencia/limites.md`, `site_name`/`site_description`). Overlap
  reconhecido e aprovado com a change em andamento `manual-usuario-mkdocs`
  (29/35 tasks, artifacts completos, ainda não arquivada) — ver design.md D5
  para o sequenciamento.
- **Testes** que ancoram o nome literal (`login.test.tsx`, `role-guard.test.tsx`,
  `require-auth.test.tsx`, `unidades.test.tsx`, `painel.test.tsx`,
  `download-pasta.test.tsx`, `shell-identidade-visual.test.tsx`,
  `auth.test.ts`) passam a ancorar `PapelHub`.

Fora de escopo (registrado em design.md):

- **Renomear identificadores internos** (`gdoc`, `@gdoc/*`, `gdoc_dev`/
  `gdoc_ci`, `name_prefix` do Terraform) — decisão já registrada em
  `CLAUDE.md` e reafirmada aqui: continuam como estão.
- **Recorte/transparência da logomarca** — sem ferramenta disponível no
  ambiente; a arte é usada como fornecida, dentro de moldura.
- **Paleta e tipografia** do restante da aplicação — inalteradas.
- **Marca por unidade** — a identificação do cliente (`APP_CLIENT_NAME`,
  ex.: `SETES`) continua por implantação, mecanismo intocado por esta change.

## Capabilities

### Modified Capabilities

- `identidade-visual`: o requisito de nome exibido passa de `Doc7` para
  `PapelHub` (mesmo mecanismo, novo literal); a capability ganha escopo novo
  — a logomarca oficial como elemento visual da tela de login, do shell
  autenticado e do favicon, com a decisão de "moldura escura contida" como
  padrão de apresentação da imagem.

## Impact

- **Web (`apps/web/src`):** `index.html`, `LoginPage.tsx`, `AppShell.tsx`,
  `HomePage.tsx`, `session-context.tsx` — troca de literal. Novo asset de
  imagem em `apps/web/public/` (nome de arquivo e formato definidos em
  design.md) consumido por `LoginPage.tsx`, `AppShell.tsx` e
  `apps/web/public/favicon.svg` (ou favicon derivado equivalente).
- **API (`apps/api/src`):** `routes/auth.ts` (`appName` no
  `GET /auth/public-config`), `server.ts` (log de boot) — troca de literal,
  sem mudança de contrato.
- **Testes:** atualização de âncora de nome nos oito arquivos listados acima;
  nenhum caso novo de comportamento (o mecanismo de composição de título e o
  contrato do endpoint público não mudam).
- **Docs:** `README.md`, `CLAUDE.md` (linha sobre nome exibido do produto),
  `docs/frontend_roadmap.md`, `openspec/specs/identidade-visual/spec.md`,
  `docs/manual/**` (prosa + `logo:` no `mkdocs.yml`).
- **Sem migração de banco, sem mudança de infraestrutura Terraform, sem
  mudança na paridade do sandbox.**
