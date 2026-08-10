# Proposal — manual-usuario-mkdocs

## Why

O manual do usuário existe como um **monólito de ~460 linhas** em
`docs/manual_do_usuario.md`. Ele **não** está desatualizado por omissão de
funcionalidade: o padrão do repositório é atualizá-lo dentro do próprio commit da
feature, e foi o que aconteceu nas três últimas changes (`rebranding-doc7-setes`,
`download-pasta-zip`, `expiracao-permissoes` — esta última removeu corretamente a
seção 10 quando seu último item foi entregue).

O que ele acumulou foram **divergências de detalhe com a tela entregue**, e uma
delas é um erro factual que induz o usuário a procurar um botão inexistente:

- A seção 5.6 afirma que **Renomear** serve para "mudar o nome **ou enviar uma
  nova versão no lugar do arquivo atual**", e o FAQ tem uma entrada inteira sobre
  a versão anterior não ser guardada. Na SPA, `RenameFileModal.tsx` tem um
  **único campo (`Nome`)** e chama `PATCH /files/:id`. A rota de substituição
  existe na API — `POST /files/:id/replace-url` (`routes/files.ts:401`) — e
  **nenhuma linha de `apps/web/src` a consome**. É capacidade de backend sem
  superfície, documentada como se fosse recurso de tela.
- O guia do colaborador **nunca informa que ele não concede permissão sobre o
  próprio arquivo**. `routes/grants.ts:37` restringe conceder/listar/revogar a
  `unit_admin`/`global_admin`, e o botão **Permissões** é renderizado sob
  `{isAdmin && …}`. Para quem acabou de enviar um arquivo e quer compartilhá-lo,
  essa é a primeira dúvida, e nem o guia nem o FAQ a respondem.
- Existem **dois** botões de download de pasta, com rótulos distintos — **Baixar
  esta pasta** (barra superior, pasta atual, inclusive a raiz) e **Baixar pasta**
  (linha de cada subpasta). O manual cita apenas o segundo. **Excluir esta
  pasta** (barra superior) não é documentado.
- O aviso prévio de expiração é descrito como "conforme o vencimento se
  aproxima". O valor é concreto: `grantExpiringNoticeWindowDays`, default **7
  dias**.
- Cota de 10 GB, retenção de 30 dias e os tetos de 100 arquivos / 50 MB são
  apresentados como lei do produto. São **defaults de variável de ambiente**
  (`STORAGE_QUOTA_BYTES_PER_USER`, `TRASH_RETENTION_DAYS`,
  `DOWNLOAD_MANIFEST_MAX_*`), configuráveis por implantação.
- O topo crava a URL do Cloud Run de uma implantação específica, logo depois de a
  change `rebranding-doc7-setes` ter tornado a identificação do cliente
  configurável justamente para o produto servir a mais de uma.

Há ainda um problema de **entrega**: o manual só existe como arquivo markdown no
repositório. O público dele — colaborador e administrador de unidade — não é
público de GitHub, e não existe endereço que se possa passar a alguém.

## What Changes

- **Revisão de conteúdo** do manual, corrigindo os seis pontos acima. A
  substituição de arquivo deixa de ser anunciada como recurso de tela.
- **Reorganização em site MkDocs** (tema Material, `lang: pt-BR`) em
  `docs/manual/`, com o conteúdo fatiado por assunto e navegação por perfil
  (colaborador, administrador de unidade, administrador global) em vez de uma
  página única de rolagem infinita.
- **Nova página de referência `limites.md`**, reunindo cota, retenção da lixeira
  e tetos do download compactado, explicitamente como **padrões da implantação**.
- **Publicação automatizada no GitHub Pages** por workflow próprio
  (`.github/workflows/docs.yml`): push na `main` que toque `docs/manual/**`
  builda e publica; pull request builda **sem** publicar, para que link quebrado
  reprove antes do merge (`strict: true`).
- **O merge da documentação passa a não implantar a aplicação.** O gate do
  `deploy.yml` deixa de se chamar "docs-only" e passa a expressar o que sempre
  quis dizer — *merge sem efeito em produção* —, acolhendo as definições de
  workflow e o `.gitignore`, que não entram na imagem do container nem alteram
  schema. Em paralelo, a regra de ignore do build do MkDocs vai para um
  `docs/manual/.gitignore`, dentro do allowlist, em vez do `.gitignore` da raiz.
- **Remoção de `docs/manual_do_usuario.md`**, que deixa de existir — o site passa
  a ser a fonte única. Nenhuma referência viva ao caminho antigo existe no
  repositório (as 11 ocorrências estão todas em `openspec/changes/archive/`,
  histórico imutável que descreve o estado do manual à época e **não** é
  reescrito).
- **`CLAUDE.md`** passa a apontar onde a documentação do usuário mora, para que a
  próxima change não tente atualizar um arquivo que não existe mais.
- **`.gitignore`** ganha `site/` (saída do build do MkDocs).

## Impact

- **Sem mudança de comportamento da aplicação.** Nenhum arquivo de `apps/`,
  `packages/` ou `infra/` é tocado.
- **Mudança no pipeline de entrega**, restrita ao critério do gate: o allowlist
  passa a cobrir também `.github/workflows/*` e `.gitignore`, de modo que este
  merge — e qualquer outro cuja única consequência seja publicar documentação —
  não dispare build, migração e deploy. O fail-safe permanece: qualquer arquivo
  de `apps/`, `packages/`, `infra/` ou de configuração de build continua fora do
  allowlist, e diff indeterminado continua implantando. Delta em
  `specs/platform-infrastructure/`.
- **`.gitignore` da raiz deixa de ser tocado**: a saída do MkDocs é
  `docs/manual/site/`, então a regra de ignore mora em `docs/manual/.gitignore`,
  já dentro do allowlist.
- **Passo manual de ativação, uma vez:** GitHub Pages ainda não está habilitado
  no repositório (`has_pages: false`). É preciso definir, em Settings → Pages, a
  origem **GitHub Actions**. Sem isso o job de publicação falha. Pages não é
  gerenciado pelo Terraform deste projeto (que cuida do GCP), então o passo fica
  registrado em `tasks.md` e no README.
- **O site é público**, porque o repositório é público. O manual não contém
  segredo — descreve telas e regras já visíveis a quem tem conta —, mas a URL de
  produção passa a estar num site indexável, e não apenas num arquivo do repo.
  Ver design.md D9.

## Out of Scope

- **Expor a substituição de arquivo na SPA.** A rota `POST /files/:id/replace-url`
  permanece implementada, testada e sem consumidor. Esta change apenas para de
  documentá-la como recurso de tela; fechar a lacuna é decisão de produto e vira
  change própria. O achado fica registrado aqui para não se perder — a partir
  desta revisão, o manual deixa de ser o último ponteiro para ela fora do código.
- **Renomear e mover pastas**, que continuam inexistentes (não há
  `PATCH /folders/:id` nem rota de movimentação) e seguem documentados como
  indisponíveis.
- **Domínio próprio** para o site. Publica-se no domínio padrão do GitHub Pages.
- **Versionamento da documentação** (`mike`) e tradução para outros idiomas.

## Capabilities

### New Capabilities

- `documentacao-usuario`: o manual do usuário como artefato publicado — fidelidade
  à interface efetivamente entregue, fonte única, organização navegável por perfil
  e publicação automatizada com verificação de integridade dos links. Referencia o
  PRD (`docs/prd_final.md`) como fonte das regras descritas.

### Modified Capabilities

- `platform-infrastructure`: o gate que decide se um merge implanta passa a
  expressar *ausência de efeito em produção* em vez de *documentação*, acolhendo
  definições de workflow e o arquivo de exclusões do controle de versão. Sem
  alteração nas demais garantias do pipeline (migrar antes de trocar o tráfego,
  idempotência, permissões, fail-safe).
