# Proposal — acesso-ao-manual-no-shell

## Why

O manual do usuário existe, é publicado automaticamente como site MkDocs no
GitHub Pages (change arquivada `manual-usuario-mkdocs`) e é normatizado pela
capability `documentacao-usuario` — que cobre fonte única, fidelidade à
interface, organização por perfil, publicação automatizada e integridade de
links. **Nenhum desses requisitos diz como o usuário chega até ele.**

Na prática, os dois mundos não se tocam: a aplicação não tem uma única
referência ao manual, em nenhuma tela. Quem usa o sistema só encontra a
documentação se souber, por fora, que ela existe e onde está. Um manual que
o usuário não alcança falha no propósito da capability que o produz,
independentemente da qualidade do conteúdo.

Esta change fecha essa lacuna pelo caminho mais barato que preserva o que já
funciona: um item fixo no rodapé da navegação lateral, apontando para o site
já publicado, com o endereço vindo de configuração da implantação.

## What Changes

- **Item "Manual do usuário" no rodapé do Sider** (`apps/web/src/shell/
  AppShell.tsx`), visualmente separado da lista de destinos internos por ser
  de outra natureza — abre o site publicado em nova aba, em vez de navegar
  dentro da SPA. Implementado como um segundo `<Menu>` de item único e
  `selectable={false}`, não como elemento solto, para herdar do Ant Design o
  alinhamento ícone+rótulo, o estado de hover e o **tooltip no estado
  colapsado** (design.md D6).
- **Endereço do manual por configuração de implantação** — nova variável
  `APP_MANUAL_URL`, servida em runtime pelo `GET /auth/public-config`
  existente. Sem endpoint novo e sem prefixo de topo novo (design.md D2/D3).
- **Contrato `PublicConfigResponse` ampliado** de `{ appName, clientName }`
  para `{ appName, clientName, manualUrl }` — em `packages/shared`, no Zod da
  SPA (`apps/web/src/lib/schemas.ts`) e na asserção de contrato de
  `apps/api/src/__tests__/auth.test.ts`, que hoje trava a resposta em
  exatamente duas chaves.
- **Validação do endereço no arranque** — `APP_MANUAL_URL` preenchida com
  valor que não seja `http`/`https` derruba o arranque da API, em vez de
  virar `href` renderizado na tela (design.md D5).
- **Ausência limpa quando não configurado** — sem `APP_MANUAL_URL`, o item
  simplesmente não existe; nenhum link morto, nenhum item desabilitado. Vale
  também para a degradação já existente da SPA quando `/auth/public-config`
  falha (design.md D4).
- **Manual atualizado no mesmo commit** — `docs/manual/docs/a-tela.md` passa a
  descrever o item, conforme a regra de fidelidade da capability
  `documentacao-usuario` e o `CLAUDE.md`.

Fora de escopo (registrado em design.md):

- **Embutir o site do manual na imagem da API** e servi-lo em `/manual` —
  avaliado e recusado (design.md D1). Custaria estágio Python no Dockerfile,
  um quarto prefixo semântico nas listas de sombreamento e, decisivamente, a
  remoção de `docs/*` do allowlist "sem efeito em produção" do
  `.github/workflows/deploy.yml` — hoje uma correção de texto do manual pula
  build/push/deploy de propósito.
- **Link para o manual na tela de login** — decisão de produto registrada em
  design.md D7: o acesso é oferecido somente no shell autenticado.
- **Restringir a leitura do manual a quem tem conta** — o site é público no
  GitHub Pages de um repositório público e permanece assim. Esta change torna
  o **acesso a partir da aplicação** exclusivo do shell autenticado; não
  transforma o conteúdo em recurso protegido (design.md D7).
- **Ajuda contextual por tela** (link da tela corrente para a página
  correspondente do manual) — exigiria um mapa rota→página mantido à mão, uma
  segunda fonte de navegação que o `strict` do MkDocs não valida. Mudança
  futura.

## Capabilities

### Added Capabilities

Nenhuma.

### Modified Capabilities

- `documentacao-usuario`: ganha requisito de **alcançabilidade** — o manual
  passa a ter obrigação de ser acessível a partir da aplicação autenticada,
  com endereço por implantação e ausência limpa quando não configurado. A
  capability deixa de tratar só de produção e publicação do manual e passa a
  cobrir também sua chegada a quem o usa.
- `identidade-visual`: o requisito "Configuração de identidade visual
  disponível sem autenticação" trava hoje a resposta do endpoint em
  **exclusivamente** nome da aplicação e identificação do cliente. Passa a uma
  **allowlist nominal** de valores públicos de apresentação (nome da
  aplicação, identificação do cliente, endereço do manual), preservando
  integralmente o veto original a ambiente, versão, limites e recursos de
  infraestrutura (design.md D3).
- `web-shell-e-auth`: o requisito "Shell de layout com identidade e navegação"
  passa a distinguir **destinos internos** (navegação por papel) de **acesso
  auxiliar** (recurso externo, sempre disponível a qualquer papel), com o
  segundo em área própria do rodapé.

## Impact

- **Shared (`packages/shared/src/auth.ts`):** `PublicConfigResponse` ganha
  `manualUrl: string`. Exige recompilar (`npm run build --workspace
  packages/shared`) para api e web enxergarem.
- **API (`apps/api/src`):** `config.ts` (`appManualUrl` + validação de
  esquema), `routes/auth.ts` (campo novo na resposta), ponto de arranque para
  a falha rápida.
- **Web (`apps/web/src`):** `shell/AppShell.tsx` (rodapé do Sider),
  `lib/schemas.ts` (Zod), `auth/session-context.tsx`
  (`DEFAULT_PUBLIC_CONFIG`).
- **Testes:** `apps/api/src/__tests__/auth.test.ts` (contrato de chaves da
  resposta — alteração deliberada, não incidental) + casos novos para
  validação de esquema no arranque; teste novo na web para presença, ausência,
  `href`, `target`/`rel` e nome acessível do item.
- **Configuração:** `.env.example` ganha `APP_MANUAL_URL`. Em produção o valor
  entra como variável de ambiente do Cloud Run — **dado público, não passa
  pelo `SecretsPort`**, mesmo tratamento de `APP_CLIENT_NAME`.
- **Docs:** `docs/manual/docs/a-tela.md`.
- **Sem migração de banco. Sem mudança de Terraform** — nenhum prefixo de rota
  novo, as três listas (`api-prefixes.ts`, `vite.config.ts`, `locals.tf`)
  permanecem intocadas. **Sem mudança na paridade do sandbox.**
