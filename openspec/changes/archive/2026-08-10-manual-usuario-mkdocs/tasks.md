# Tasks — manual-usuario-mkdocs

> Ordem sugerida: revisar o **conteúdo** (seção 1) antes de fatiá-lo (seção 2).
> Fatiar primeiro obriga a aplicar as mesmas correções espalhadas por várias
> páginas, multiplicando a chance de esquecer uma.
>
> A ativação do GitHub Pages (3.4) é **pré-requisito do merge**, não da
> implementação: sem ela o job de publicação falha no primeiro run em `main`.

## 1. Revisão de conteúdo (sobre o texto atual, ainda monolítico)

- [x] 1.1 **Substituição de arquivo** (achado A, design.md D8): remover da seção
  5.6 a afirmação de que **Renomear** serve para "enviar uma nova versão no lugar
  do arquivo atual". A `RenameFileModal` tem um único campo (`Nome`) e chama
  `PATCH /files/:id`. Deixar apenas a alteração de nome.
- [x] 1.2 Remover do FAQ a entrada "Substituí um arquivo e preciso da versão
  antiga" — ela pressupõe um recurso que a tela não oferece. **Não** substituir
  por uma promessa futura.
- [x] 1.3 **Concessão de permissão pelo colaborador** (achado B): acrescentar ao
  guia do colaborador que ele **não** concede permissão sobre o próprio arquivo —
  `routes/grants.ts:37` restringe a `unit_admin`/`global_admin` e o botão
  **Permissões** só é renderizado para admin. Acrescentar entrada de FAQ
  correspondente ("Como compartilho um arquivo que enviei?").
- [x] 1.4 **Rótulos de download de pasta** (achado C): distinguir **Baixar esta
  pasta** (barra superior; pasta atual, inclusive a raiz) de **Baixar pasta**
  (linha de cada subpasta). Corrigir também a tabela de tarefas rápidas.
- [x] 1.5 Documentar **Excluir esta pasta** (barra superior), hoje ausente — o
  manual só descreve excluir pela linha do item.
- [x] 1.6 **Aviso prévio de expiração** (achado D): trocar "conforme o vencimento
  se aproxima" pelo valor concreto — **7 dias** de antecedência
  (`grantExpiringNoticeWindowDays`), com a ressalva de ser configurável.
- [x] 1.7 **Limites configuráveis** (achado E): revisar cota (10 GB), retenção
  (30 dias) e tetos do zip (100 arquivos / 50 MB) para que deixem de ser
  afirmados como lei do produto. O detalhamento vai para `referencia/limites.md`
  (2.4).
- [x] 1.8 **Endereço de produção** (achado F): apresentar a URL como endereço
  **desta implantação**, não como endereço do produto.
- [x] 1.9 Conferência final contra a tela: menu lateral e visibilidade por papel,
  painel (4 cartões + 3 gráficos), lixeira (`Data de exclusão` / `Dias
  restantes`), busca (acionamento explícito, ≥1 critério, filtro `Autor` só para
  admin), preview (PDF/imagem/vídeo/áudio/texto sim, Office não), reset de senha
  e matriz de alcance, unidades, ausência de renomear/mover pasta. Todos
  verificados como corretos na exploração — reconferir apenas o que a revisão
  tocar.

## 2. Estrutura MkDocs (`docs/manual/`)

- [x] 2.1 `docs/manual/mkdocs.yml`: `site_name`, `docs_dir: docs`,
  `theme: material` com `language: pt-BR`, `strict: true` (design.md D6) e
  `site_url` do GitHub Pages do repositório. **Não** colocar na raiz — D2.
- [x] 2.2 `docs/manual/requirements.txt` com `mkdocs` e `mkdocs-material` em
  **versões fixadas** (design.md D4), para que o site seja reproduzível a partir
  do commit.
- [x] 2.3 Fatiar o conteúdo revisado nas ~18 páginas de `docs/manual/docs/`,
  conforme a árvore de design.md ("Estrutura resultante"), e declarar a `nav`
  explicitamente no `mkdocs.yml` (design.md D3).
- [x] 2.4 Escrever `referencia/limites.md` (novo): cota, retenção da lixeira,
  tetos do download compactado e antecedência do aviso, todos marcados como
  **padrões da implantação** (design.md D9).
- [x] 2.5 Converter os avisos que hoje são citações `>` em admonitions do Material
  (`!!! note`, `!!! warning`) — em especial os quatro blocos de permissões
  (expirar ≠ revogar, reconceder atualiza prazo, avisos automáticos, sem herança).
- [x] 2.6 Revisar os links internos criados pelo fatiamento: as referências
  cruzadas hoje são numéricas ("seção 5.10") e precisam virar links de página.
- [x] 2.7 Build local: `pip install -r docs/manual/requirements.txt` e
  `mkdocs build -f docs/manual/mkdocs.yml --strict`. Zero aviso.

## 3. Publicação (GitHub Pages)

- [x] 3.1 `.github/workflows/docs.yml`: job de **build** (checkout, setup-python,
  instalar `requirements.txt`, `mkdocs build --strict`, `upload-pages-artifact`) e
  job de **deploy** (`deploy-pages`), este último apenas em push na `main`.
- [x] 3.2 Gatilhos (design.md D7): `push` em `main` com
  `paths: ['docs/manual/**', '.github/workflows/docs.yml']` e `pull_request` nos
  mesmos caminhos. O job de deploy **não** roda em pull request (D6).
- [x] 3.3 Permissões mínimas (`contents: read`, `pages: write`,
  `id-token: write`) e `concurrency: { group: pages, cancel-in-progress: false }`
  (design.md D5).
- [ ] 3.4 **Passo manual, uma vez:** habilitar GitHub Pages em Settings → Pages
  com origem **GitHub Actions** (hoje `has_pages: false`). Sem isso o
  `deploy-pages` falha. Fazer **antes** do merge.
  > Não realizável a partir desta sessão (requer acesso às configurações do
  > repositório no GitHub). **Pendente do usuário/administrador do repositório
  > antes do merge desta change.**
- [x] 3.5 Conferir que `mkdocs gh-deploy` **não** é usado e que nenhuma branch
  `gh-pages` é criada (design.md D5).
- [x] 3.6 `.github/workflows/deploy.yml` (design.md D10): ampliar o allowlist do
  passo `Classify merge` para acolher `.github/workflows/*` e `.gitignore`, e
  renomear o gate de "docs-only" para **merge sem efeito em produção** — nome do
  job, mensagens de log e a variável de saída. **Não** ampliar para `.github/**`
  nem para qualquer caminho de `apps/`, `packages/`, `infra/` ou configuração de
  build. Preservar intactos os dois ramos fail-safe (sem pai único, diff vazio).

## 4. Remoção do monólito e ajustes de repositório

- [x] 4.1 Remover `docs/manual_do_usuario.md` (design.md D1). **Sem** stub — não
  há referência viva ao caminho.
- [x] 4.2 **Não tocar** em `openspec/changes/archive/`, onde estão as 11
  ocorrências restantes do caminho antigo. É histórico imutável.
- [x] 4.3 `docs/manual/.gitignore` com `site/` — a saída do build é
  `docs/manual/site/`, e o arquivo dentro de `docs/manual/` já casa com o
  allowlist. **Não** tocar no `.gitignore` da raiz (design.md D10, Peça 1).
- [x] 4.4 `CLAUDE.md`: registrar que a documentação do usuário mora em
  `docs/manual/` (site MkDocs publicado no Pages), como é organizada e que
  continua sendo atualizada dentro do commit da feature — senão a próxima change
  procura um arquivo que não existe mais.
- [x] 4.5 `README.md`: como buildar e servir a documentação localmente
  (`mkdocs serve -f docs/manual/mkdocs.yml`) e o endereço do site publicado.

## 5. Verificação

- [x] 5.1 `npm run lint && npm run build && npm run test` na raiz — deve passar
  inalterado (nenhum código foi tocado).
  > Confirmado: lint, build e os dois workspaces de teste passam (web: 18
  > arquivos/108 testes; api: 27 arquivos/237 testes, após provisionar Postgres
  > local via `session-start.sh` + `.env`, que não vinha provisionado nesta
  > sessão).
- [x] 5.2 `npm run format:check` — confirmar que `docs/manual/**` fica fora do
  escopo do Prettier pelo `.prettierignore` existente (design.md D2), sem precisar
  de nova entrada.
- [ ] 5.3 Abrir o pull request e confirmar que o job de build da documentação roda
  e **não** publica.
  > Pendente: requer PR aberto no GitHub. Não solicitado nesta sessão.
- [x] 5.4 Verificar o gate: introduzir temporariamente um link interno quebrado,
  confirmar que o build falha, e desfazer.
  > Verificado localmente com `mkdocs build -f docs/manual/mkdocs.yml --strict`:
  > link quebrado aborta com exit code 1; revertido, build volta a passar (exit
  > code 0) — mesmo comando que o workflow `docs.yml` executa em CI.
- [ ] 5.5 Após o merge, confirmar a publicação e navegar o site — sumário, busca
  em português e as páginas de todos os perfis.
  > Pendente: requer merge na `main` e Pages habilitado (task 3.4).
- [ ] 5.6 Confirmar que o merge seguinte, tocando **apenas** `docs/manual/**`,
  publica a documentação **sem** disparar o deploy da aplicação (design.md D7).
  > Pendente: requer um merge subsequente já em produção.
- [ ] 5.7 **No merge desta change**, acompanhar o `deploy.yml` e confirmar que ele
  classificou como *sem efeito em produção* e pulou build/migração/deploy — é a
  auto-aplicação descrita em design.md D10. Se ainda assim implantar, registrar o
  fato: o custo é um deploy sem mudança de código, e todo merge de documentação
  seguinte já sai limpo. **Não** tentar contornar com force-push ou reescrita de
  histórico.
  > Pendente: requer o merge real desta change em `main`.
- [ ] 5.8 Confirmar, na direção oposta, que um merge com qualquer arquivo de
  `apps/`/`packages/`/`infra/` continua implantando normalmente — o fail-safe não
  pode ter sido afrouxado pela tarefa 3.6.
  > Pendente: requer um merge real subsequente para observar o `deploy.yml` em
  > execução; a lógica do allowlist em si foi revisada na task 3.6 e preserva os
  > dois ramos fail-safe (sem pai único, diff vazio) intactos.
