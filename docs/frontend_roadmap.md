# Roadmap do Frontend (`apps/web`) — PapelHub

Documento auxiliar para **implementação em partes**. Cataloga todas as fatias
necessárias para levar a SPA do PapelHub de zero a paridade com o backend (Épicos
1–9, já completos). Cada fatia é uma **change OpenSpec** própria, referencia as
histórias do PRD (`docs/prd_final.md`) já implementadas no back e depende do
shell da fatia 1.

> **Como usar:** implemente uma fatia por vez, na ordem de dependência abaixo.
> Antes de cada fatia, releia a US correspondente no PRD (critérios de aceitação
> são vinculantes) e crie a change com `/opsx:propose`. A fatia 1
> (`web-shell-e-auth`) já tem proposta criada.

## Decisões de fundação (valem para todas as fatias)

- **Design system: Ant Design v5** (não Tailwind cru). Tema/tokens via
  `ConfigProvider` (`locale` pt-BR, cor primária/raio/tipografia); wrapper
  `<App>` para `message`/`notification`/`Modal`. O AntD cobre **UI**.
- **Estado de servidor: TanStack Query** (cache, invalidação, mutations) sobre um
  `apiClient` (`fetch`, `credentials: 'include'`). **Zod** valida a fronteira,
  espelhando `@gdoc/shared` (fonte única de DTOs).
- **Mesma origem para a sessão**: o cookie é `HttpOnly`/`SameSite=Strict` e a API
  não tem CORS ⇒ SPA e API partilham origem. **Dev**: proxy do Vite. **Prod**:
  `path_matcher` no url-map → Cloud Run NEG. O cliente **nunca** lê/persiste o
  token. `401` central → limpa sessão e vai a `/login`.
- **Roteamento: React Router** com rota-guarda por autenticação e por papel
  (`collaborator` / `unit_admin` / `global_admin`).
- **Transferência de bytes**: sempre via **URL assinada** — a SPA pede a URL à API
  (após checagem de permissão) e transfere direto ao GCS. Upload é **PUT
  simples** (não resumável).
- **Testes**: Vitest + Testing Library por fatia; cada cenário de spec é um teste.
- **Paridade dev**: a SPA roda sob demanda (`npm run dev:web`); o SessionStart
  hook não sobe a app.

## Fatias

### Fatia 1 — Shell + Autenticação  ✅ entregue
- **Capability**: `web-shell-e-auth`
- **PRD**: US 1.2 (login/sessão), NFR de Usabilidade (shell premium)
- **Endpoints**: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- **Entrega**: projeto Vite/React/TS + AntD, `apiClient`+Query+Zod, roteador com
  guarda, contexto de sessão, página de login, shell (`Layout`/`Menu`/header com
  identidade+logout), e a decisão de mesma origem (proxy dev + url-map prod).
- **AntD**: `ConfigProvider`, `<App>`, `Layout`, `Menu`, `Form`, `Result`, `Spin`
- **Depende de**: — (base de todas)

### Fatia 2 — Navegação e explorador de arquivos/pastas  ✅ entregue
- **Capability**: `web-navegacao`
- **PRD**: Épico 2 (US 2.x), Épico 4 (visibilidade), RF #5
- **Endpoints**: `GET /folders/root/contents`, `GET /folders/:id/contents`,
  `POST /folders`, `DELETE /folders/:id`, `PATCH /files/:id`,
  `DELETE /files/:id`
- **Entrega**: explorador estilo file-manager com **breadcrumb**, listagem
  unificada (arquivos+subpastas), criar/excluir pasta, renomear/excluir
  arquivo com confirmação e aviso de permissão insuficiente em 403,
  deep-link bloqueado a pasta sem acesso (US 4.2)
- **AntD**: `Breadcrumb`, `Table`, `Modal`, `Popconfirm`, `Result`, `message`
- **Lacuna conhecida**: **renomear pasta** não está disponível — o backend
  não expõe `PATCH /folders/:id` (só `POST`/`GET contents`/`DELETE`/
  `restore`). Fica para uma change de backend futura que adicione o endpoint
  (dono-ou-grant `rename` + auditoria); o frontend ganha a ação correspondente
  quando ele existir.
- **Depende de**: Fatia 1

### Fatia 3 — Visualização e download  ✅ entregue
- **Capability**: `web-visualizacao`
- **PRD**: US 9.2 (cenários 1 e 2), Épico 2, RF #10/#16
- **Endpoints**: `POST /files/:id/view-url` (retorna `ViewUrlResponse`
  discriminado), `POST /files/:id/download-url`
- **Entrega**: nome do arquivo clicável e ação "Visualizar" abrem um `Modal`
  de preview que chama `view-url` uma vez e ramifica pela resposta —
  renderização inline por categoria de MIME (imagem, vídeo, áudio, PDF/texto
  em `<iframe>`) ou mensagem **"pré-visualização indisponível"** + botão de
  download **conforme `download.available`**; ação "Baixar" por navegação numa
  âncora para a URL assinada `attachment`; 403 em qualquer uma das duas
  chamadas exibe aviso de permissão insuficiente, sem expor conteúdo
- **AntD**: `Modal`, `Image`, `<iframe>` (PDF/nativos), `Result`/`Empty`, `Button`
- **Depende de**: Fatia 2

### Fatia 4 — Upload (múltiplos arquivos e pasta)  ✅ entregue
- **Capability**: `web-upload`
- **PRD**: Épico 3 (US 3.x), RF #6, cota (RF #13)
- **Endpoints**: `POST /files/upload-urls` (lote/pasta, com `relativePath`,
  **sempre** usado — arquivo único vira lote de 1); reconciliação por
  `storage-events` é out-of-band (server)
- **Entrega**: botões "Enviar arquivos"/"Enviar pasta" na toolbar do
  explorador; **uma** chamada de lote por envio, PUT direto ao GCS por
  `XMLHttpRequest` com **progresso individual** e **falha independente** por
  arquivo; upload de **pasta** preservando hierarquia via `relativePath`
  (`webkitRelativePath`); aviso reativo ao atingir a cota; repetir reenvia só
  o item falho; sucesso invalida a listagem sem polling por `active`
- **AntD**: `Upload` (seleção `multiple`/`directory`), `List`, `Progress`,
  `notification`, `message`
- **Depende de**: Fatia 2

### Fatia 5 — Busca e filtros  ✅ entregue
- **Capability**: `web-busca`
- **PRD**: US 9.1, RF #15
- **Endpoints**: `GET /files/search` (nome + filtros tipo/autor/data); `GET
  /users` (admin-only, popula o filtro de autor)
- **Entrega**: página de busca (`/busca`) com filtros combináveis (nome, tipo,
  data) e **botão de limpar filtros** (volta ao estado inicial permitido);
  tabela de resultados só-arquivos reusando `PreviewModal`/`useDownloadFile`
  da Fatia 3
- **Lacuna conhecida**: filtro de autor restrito a `unit_admin`/`global_admin`
  (Opção A, `GET /users` é admin-only) — colaborador não vê o filtro de autor
  nem a coluna de autor até existir um endpoint de pessoas
  seguro-para-colaborador
- **AntD**: `Input.Search`, `Select` (tipo/autor), `DatePicker.RangePicker`,
  `Button`, `Table`
- **Depende de**: Fatia 2 (reusa a listagem/visualização)

### Fatia 6 — Permissões granulares  ✅ entregue (proposta)
- **Capability**: `web-permissoes`
- **PRD**: US 4.1, RF #7/#8
- **Endpoints**: `POST /grants` (concede um ou mais verbos a uma pessoa sobre
  um recurso, idempotente), `GET /grants?resourceType=&resourceId=` (vigentes
  de **um** recurso), `DELETE /grants/:id` (revoga um verbo) — todos
  admin-only, já arquivados (Épico 4)
- **Entrega**: ação "Permissões" por-linha no explorador (só
  `unit_admin`/`global_admin`), abrindo o `PermissoesModal` do recurso —
  `Select` de pessoa (reusa o hook admin-only da Fatia 5) + `Checkbox.Group`
  de verbos numa única `POST /grants`; lista de vigentes agrupada por pessoa
  com revogação por verbo (`DELETE /grants/:id`); aviso explícito de
  não-herança ao gerir uma pasta
- **Lacunas conhecidas**: **sem prazo de expiração** — o backend não suporta
  (`CreateGrantRequest` não tem `expiresAt`); precisa de change de backend
  futura (coluna `expires_at`, filtro em `access.ts`, aviso via Job) antes de
  existir controle de prazo na SPA. **Sem concessão em lote** — `POST /grants`
  é por **um** `resourceId`; a gestão é por-item nesta fatia, multi-seleção
  fica para uma fatia futura
- **AntD**: `Modal`, `Form`, `Select`, `Checkbox.Group`, `Tag`, `Popconfirm`
- **Depende de**: Fatia 2 (ação no explorador), Fatia 5 (hook de pessoas)

### Fatia 7 — Lixeira e retenção  ✅ entregue
- **Capability**: `web-lixeira`
- **PRD**: Épico 6 (US 6.1), RF #12
- **Endpoints**: `GET /trash`, `POST /files/:id/restore`,
  `POST /folders/:id/restore` (o expurgo é rotina do servidor, já arquivados)
- **Entrega**: tela de lixeira (`/lixeira`, qualquer papel) listando as raízes
  de exclusão no alcance do requisitante — nome, tipo, data de exclusão e `Tag`
  de dias restantes por urgência (≤3 dias vermelho, ≤7 laranja); restaurar por
  linha despachando por tipo, com aviso distinto quando um arquivo volta à raiz
  (`redirectedToRoot`); invalidação cruzada com o explorador; 403 fail-closed;
  estado vazio
- **Lacunas conhecidas**: **sem exclusão permanente pela UI** — o expurgo é só
  a rotina diária de servidor (US 6.1 cenário 2), não há endpoint sob demanda;
  **sem preview/download na lixeira** — itens excluídos não são
  visualizáveis nem baixáveis; **sem coluna "quem excluiu"** —
  `TrashEntryResponse` não carrega `deleted_by`
- **AntD**: `Table`, `Popconfirm`, `Tag` (dias restantes), `message`, `Empty`
- **Depende de**: Fatia 2

### Fatia 8 — Auditoria  ✅ entregue
- **Capability**: `web-auditoria`
- **PRD**: Épico 7 (US 7.x), RF #11
- **Endpoints**: `GET /files/:id/audit` (por dono e por administrador dentro
  do alcance, já arquivado)
- **Entrega**: ação "Auditoria" por-linha de **arquivo** no explorador (dono ou
  administrador — colaborador não vê em arquivo alheio, pasta não tem a ação),
  abrindo um `AuditoriaModal` com a `Table` do registro de acessos (pessoa via
  `name ?? email`, ação como `Tag` "Visualizar"/"Baixar", data/hora), do mais
  recente ao mais antigo; estado vazio ("nenhum acesso registrado") não é erro;
  403 fail-closed exibe aviso neutro
- **Lacunas conhecidas**: **sem filtro/paginação server-side** (data/pessoa/
  ação) — o endpoint devolve só os ≤500 eventos mais recentes
  (`AUDIT_QUERY_LIMIT`), sem query params; o `DatePicker.RangePicker` sugerido
  fica fora até o backend expor filtro; **só `view`/`download`** — não é um
  log de atividade completo (`rename`/`replace`/`delete`/`restore` não
  aparecem); **sem exportação** (CSV/PDF) do registro — não há endpoint;
  **sem auditoria a partir da busca (Fatia 5) ou do `PreviewModal` (Fatia 3)**
  — escopo desta fatia é só o explorador
- **AntD**: `Table`, `Modal`, `Tag`, `Empty`, `Result`, `Spin`
- **Depende de**: Fatia 2 (abre a partir do arquivo)

### Fatia 9 — Gestão de pessoas (admin)  ✅ entregue
- **Capability**: `web-pessoas`
- **PRD**: Épico 1 (US 1.1), RF #1/#2/#3
- **Endpoints**: `GET /users`, `POST /users`, `PATCH /users/:id` (já
  arquivados; sem autocadastro)
- **Entrega**: página `/admin/pessoas` (`unit_admin`/`global_admin`) com a
  `Table` de pessoas (nome ou e-mail quando `fullName` nulo, e-mail, função,
  papel, status); cadastro com senha inicial (`POST /users`) e aviso "e-mail
  já está em uso" em 409, sem fechar o formulário; edição de perfil/papel
  (`PATCH /users/:id`, e-mail somente-leitura, sem campo de senha);
  ativar/desativar via `PATCH status` com `Popconfirm` (sem exclusão
  permanente); seletor de papel espelha as travas do servidor (`unit_admin`
  não vê `global_admin`); guarda de auto-tiro-no-pé (o admin não desativa nem
  rebaixa a si mesmo); 403 fail-closed exibe aviso neutro
- **Lacunas conhecidas**: **sem criação cross-unit pelo `global_admin`** — a
  pessoa é sempre criada na unidade do admin logado; falta `GET /units` para
  um seletor de unidade; **sem redefinição de senha pela UI** —
  `PATCH /users/:id` não aceita `password`; **sem paginação/filtro
  server-side** — `GET /users` devolve tudo, a `Table` pagina no cliente;
  **sem coluna de unidade legível** — sem `GET /units` só haveria o UUID cru;
  **sem exclusão permanente de pessoa** — não há `DELETE /users`, só
  desativação
- **AntD**: `Table`, `Modal`, `Form`, `Select`, `Popconfirm`, `Tag`
- **Depende de**: Fatia 1 (rota de administração, guarda por papel)

### Fatia 10 — Painel gerencial  ✅ entregue
- **Capability**: `web-painel`
- **PRD**: Épico 8 (US 8.2), RF #14
- **Endpoints**: `GET /dashboard` (cartões + séries agregadas)
- **Entrega**: página `/admin/painel` com os quatro cartões de estatística
  (total de arquivos, total de pessoas, espaço utilizado, % da cota) e os três
  gráficos — arquivos por tipo, envios por mês e espaço utilizado versus
  disponível —, respeitando o alcance do administrador; rótulos pt-BR
  (categorias e meses); 403 fail-closed exibe aviso neutro
- **AntD**: `Card`, `Statistic`, `Progress` — gráficos de barras em SVG/HTML
  próprio com `theme.useToken()`, sem `@ant-design/plots` (design.md D1)
- **Depende de**: Fatia 1 (rota de administração)

### Fatia 11 — Download de pasta compactada  ✅ entregue
- **Capability**: `download-pasta` (change `download-pasta-zip`, fatia
  entregue após as 10 originais — US 3.3 estava adiada por dependência do
  motor de permissão, satisfeita pela Fatia 6)
- **PRD**: US 3.3
- **Endpoints**: `POST /folders/:id/download-manifest`,
  `POST /folders/root/download-manifest` (manifesto de URLs assinadas — a API
  nunca compacta; ver design.md D1 do change)
- **Entrega**: ação "Baixar pasta" na linha da pasta e no cabeçalho do
  explorador (`navegacao/`), oferecida em toda pasta inclusive na raiz da
  unidade; compactação **em streaming no cliente** (`client-zip`), sem reter
  todos os arquivos em memória simultaneamente; aviso de recorte parcial
  ("N de M itens disponíveis") quando parte do conteúdo é filtrada por
  permissão; mensagem própria e nenhum arquivo gerado quando nada está
  disponível; progresso agregado e cancelamento; recusa por limite (100
  arquivos / 50 MB) tratada com a orientação específica da API
- **AntD**: `Modal`, `Progress`, `Alert`
- **Depende de**: Fatia 2 (explorador), Fatia 6 (motor de permissão)

## Grafo de dependências

```
Fatia 1 (shell + auth)  ──────────────┬──────────────┬───────────────┐
        │                              │              │               │
        ▼                              ▼              ▼               ▼
     Fatia 2 (navegação)           Fatia 9        Fatia 10        (guarda de
        │                          (pessoas)      (painel)         papel usa
        ├── Fatia 3 (visualização/download)                        a fatia 1)
        ├── Fatia 4 (upload)
        ├── Fatia 5 (busca)
        ├── Fatia 6 (permissões)
        ├── Fatia 7 (lixeira)
        └── Fatia 8 (auditoria)
```

Ordem de execução sugerida: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10**. As
fatias 9 e 10 (administração) dependem só da fatia 1 e podem ser antecipadas se
a prioridade for o valor gerencial; as fatias 3–8 dependem do explorador
(fatia 2).

## Produção sem domínio

Com as 10 fatias entregues, a SPA foi colocada em produção pelo change
`deploy-frontend-gcp`: como ainda não existe domínio registrado, o
certificado gerenciado do load balancer planejado (bucket+CDN, ver
`infra/terraform/frontend.tf`) não pode ser emitido. Decisão interina: o
próprio serviço Cloud Run da API passa a servir o `dist/` da SPA, já que a
URL `*.run.app` é a única URL bruta da GCP com TLS que pode ser a mesma
origem de SPA e API — preservando o cookie de sessão
`HttpOnly`/`Secure`/`SameSite=Strict` sem CORS. O Dockerfile do monorepo
embute o build da web; `deploy.yml` não muda.

Quando o domínio existir (change futura): definir `frontend_domain` no
Terraform, publicar o `dist/` no bucket, aplicar o LB/certificado/IP e
invalidar o CDN a cada deploy — o serving embutido na API fica inofensivo
atrás do `path_matcher`, que passa a mandar só os prefixos de API para a
Cloud Run.
