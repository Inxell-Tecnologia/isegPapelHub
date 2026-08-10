# Design — manual-usuario-mkdocs

## Contexto

Change de documentação: nenhum arquivo de `apps/`, `packages/` ou `infra/` é
tocado, e nenhuma regra de negócio muda. As decisões abaixo são sobre **onde a
prosa vive**, **como ela é publicada** e **o que ela tem o direito de afirmar**.

O ponto que decide o trabalho não é o MkDocs — é quantas fontes da mesma prosa
vão existir. O padrão consolidado do repositório é atualizar o manual **dentro do
commit da feature** (foi o que ocorreu nas três últimas changes). Qualquer
desenho que crie duas cópias da mesma prosa diverge na primeira change que tocar
só uma delas.

## Decisões

### D1 — O site MkDocs é a fonte única; o monólito é removido

`docs/manual_do_usuario.md` deixa de existir. A prosa passa a viver fatiada em
`docs/manual/docs/`.

Alternativas descartadas:

- **Monólito continua a fonte, MkDocs o serve como página única.** Zero
  duplicação, mas descarta o motivo de existir do MkDocs — navegação e busca por
  assunto. Sobra um site de uma página só.
- **Monólito continua a fonte, um script o fatia para o MkDocs.** Preserva fonte
  única e entrega navegação, ao custo de um gerador e de um gate de CI para
  detectar divergência. É mais peça móvel do que esta documentação justifica.
- **Manter os dois arquivos, sincronizados à mão.** Diverge no primeiro commit
  apressado. Descartado sem hesitação.

**Sem stub de redirecionamento** no caminho antigo: não existe referência viva a
ele no repositório. As 11 ocorrências de `manual_do_usuario` estão todas em
`openspec/changes/archive/`, que é histórico imutável — aquelas propostas
descrevem o estado do manual à época de cada entrega, e reescrevê-las apagaria o
rastro de como cada fatia foi especificada.

### D2 — `mkdocs.yml` vive em `docs/manual/`, não na raiz

Duas razões concretas:

1. **`.prettierignore` já isenta `docs/` inteiro** (prosa autoral fica fora de
   propósito). Um `mkdocs.yml` na raiz seria formatado pelo Prettier e entraria no
   `format:check` da CI, criando atrito de formatação num arquivo de configuração
   de documentação. Dentro de `docs/manual/`, nasce isento.
2. A raiz do monorepo já carrega configuração de três workspaces. Um projeto de
   documentação autocontido não precisa somar ruído lá.

### D3 — Layout `docs/manual/docs/`, o convencional do MkDocs

O MkDocs resolve `docs_dir` relativo ao `mkdocs.yml`. Duas formas funcionam:

| Forma | Resultado |
|---|---|
| `docs/manual/mkdocs.yml` + `docs_dir: docs` | páginas em `docs/manual/docs/` — convencional |
| `docs/manual/mkdocs.yml` + `docs_dir: .` | páginas em `docs/manual/`, porém o MkDocs **avisa** que o arquivo de configuração está dentro do `docs_dir` |

Escolhida a primeira. O caminho `docs/manual/docs/` é redundante à leitura, mas é
o layout que qualquer pessoa que conheça MkDocs espera, e evita o aviso de build
— que importa porque D6 trata aviso como falha.

### D4 — Tema Material, com dependências fixadas

`mkdocs-material` entrega busca com stemming em português, navegação por seções,
modo escuro e blocos de destaque (`!!! note`) — os avisos do manual atual, hoje
citações `>`, viram admonitions. O tema padrão do MkDocs não tem navegação
lateral por seção nem busca à altura.

O repositório é Node; isto introduz **Python** como dependência de
desenvolvimento. Contida em `docs/manual/requirements.txt` com **versões
fixadas** — o build da documentação não pode quebrar por atualização silenciosa
de tema, e o site publicado deve ser reproduzível a partir do commit.

### D5 — Publicação por GitHub Actions + `actions/deploy-pages`

Não `mkdocs gh-deploy`, que empurra o site buildado para uma branch `gh-pages`.
Manter HTML gerado versionado numa branch órfã polui o repositório e faz o
histórico crescer com artefato de build. O caminho por artefato
(`upload-pages-artifact` → `deploy-pages`) publica sem commitar nada, autentica
por OIDC (`id-token: write`) e não exige token de longa duração.

Permissões mínimas no job: `contents: read`, `pages: write`, `id-token: write`.
Grupo de concorrência `pages`, sem `cancel-in-progress` — cancelar uma publicação
em andamento pode deixar o site num estado intermediário.

### D6 — `strict: true`: link quebrado reprova o build

Fatiar um documento de 460 linhas em ~18 páginas multiplica os links internos, e
link interno quebrado é exatamente o defeito que passa despercebido em revisão de
prosa. Com `strict: true` o MkDocs promove aviso a erro, e o build falha.

Para que isso seja um gate de verdade, o workflow builda também em **pull
request**, sem publicar. Merge com link quebrado passa a ser impossível; o job de
publicação só roda em `main`.

### D7 — Gatilho por `paths`, e a interação com o gate docs-only do deploy

O workflow de documentação dispara em push na `main` restrito a
`docs/manual/**` e ao próprio `.github/workflows/docs.yml`, mais `pull_request`
nos mesmos caminhos. Documentação não republica o site a cada commit de código.

Na direção inversa, o `deploy.yml` classifica merges docs-only pelo allowlist
`*.md|docs/*|openspec/*|LICENSE` e pula build/migração/deploy. O padrão `docs/*`
é casado por `case` de shell contra a string do caminho, onde `*` cobre `/` —
portanto `docs/manual/docs/index.md` **é** docs-only. Editar a documentação não
implanta a aplicação.

O merge **desta** change seria a exceção — `.github/workflows/docs.yml` e
`.gitignore` ficam fora do allowlist —, e o requisito é que ele publique **apenas
a documentação**, sem deploy da aplicação. Ver D10.

### D10 — O merge da documentação não implanta a aplicação

Requisito: um merge cuja única consequência é publicar documentação NÃO dispara
build, migração e deploy no Cloud Run. Duas peças, de custos muito diferentes.

**Peça 1 — tirar `.gitignore` da equação (grátis).** O MkDocs resolve a saída
relativa ao `mkdocs.yml`, então o build gera `docs/manual/site/`. A regra de
ignore não precisa ir para o `.gitignore` da raiz: um `docs/manual/.gitignore`
com `site/` cobre exatamente o mesmo caso e **casa com o allowlist** (`docs/*`).
Um arquivo a menos fora do gate, sem contrapartida.

Isso reduz a pegada desta change fora do allowlist a **um único arquivo**:
`.github/workflows/docs.yml`.

**Peça 2 — o gate reflete o que realmente afeta produção.** O allowlist atual
enumera documentação, mas a pergunta que ele responde de fato é *"este merge
muda o que roda em produção?"*. Arquivo de workflow do GitHub Actions e
`.gitignore` **não** mudam: não entram na imagem do container, não alteram schema
e não afetam a revisão do Cloud Run. Passam a constar do allowlist, que é
renomeado de "docs-only" para **"merge sem efeito em produção"** — o nome que
sempre descreveu a intenção.

Alternativas descartadas:

- **Aceitar um deploy à toa neste merge.** Era o desenho anterior. Custo real
  baixo (mesma imagem, migrações idempotentes), mas contraria o requisito.
- **Adiar `docs.yml` para um PR separado.** Não elimina o deploy, só o move.
- **Allowlist de `.github/**` inteiro.** Amplo demais sem necessidade: a lista
  passa a nomear `.github/workflows/*` e `.gitignore`, e nada além.

**Ressalva de verificação (tasks 3.6/5.7).** Para que a nova regra classifique o
**próprio** merge que a introduz, o `deploy.yml` alterado precisa já estar em
vigor quando o gate roda. O gatilho é `workflow_run`, cuja definição de workflow
o GitHub toma da branch padrão — que, no instante em que o CI da `main`
termina, já contém o merge. A expectativa, portanto, é de auto-aplicação, e por
isso `.github/workflows/deploy.yml` também entra no allowlist. Não tratar isso
como certo: se na prática o deploy disparar assim mesmo, o efeito é **um** deploy
sem mudança de código, e todo merge de documentação seguinte já sai limpo de
qualquer forma — inclusive sem a Peça 2, porque um merge que toca apenas
`docs/manual/**` sempre foi docs-only.

O fail-safe permanece intacto onde importa: qualquer arquivo de `apps/`,
`packages/`, `infra/` ou de configuração de build continua fora do allowlist, e
ausência de pai único ou diff vazio continua classificando como não-docs-only.

### D8 — O manual descreve a tela, não a API

Regra que resolve o achado da substituição de arquivo e evita a próxima
ocorrência: **capacidade de backend sem superfície na SPA não é documentada como
recurso ao usuário**. `POST /files/:id/replace-url` existe, está testada e não
tem consumidor em `apps/web/src`; enquanto isso for verdade, o manual não a
menciona. O manual é escrito da perspectiva de quem olha a tela — se não há botão,
não há recurso.

Isso não apaga o achado: ele fica registrado no `proposal.md` (Out of Scope),
porque a partir desta revisão o manual deixa de ser o último ponteiro para essa
rota fora do código.

### D9 — Limites documentados como padrões da implantação

Cota (10 GB), retenção da lixeira (30 dias), tetos do download compactado (100
arquivos / 50 MB) e a janela do aviso prévio (7 dias) são **defaults de variável
de ambiente**, não constantes do produto. Reuni-los numa página `limites.md` com
essa ressalva evita que o manual, ao ser reaproveitado por outra implantação — o
motivo pelo qual `APP_CLIENT_NAME` foi tornado configurável —, afirme números
errados.

Pela mesma razão, a URL de produção sai do topo como se fosse o endereço do
produto e passa a ser apresentada como o endereço **desta** implantação.

## Estrutura resultante

```
docs/manual/
├── mkdocs.yml
├── requirements.txt
└── docs/
    ├── index.md                        o que é o Doc7, endereço, perfis
    ├── primeiro-acesso.md              login, senha inicial, erros, sair
    ├── a-tela.md                       menu lateral, sino, menu do perfil
    ├── colaborador/
    │   ├── navegar-e-criar.md
    │   ├── enviar.md                   lote, pasta, cota
    │   ├── visualizar-e-baixar.md      preview, download, zip de pasta
    │   ├── renomear-e-excluir.md       renomear, excluir, lixeira
    │   ├── buscar.md
    │   ├── auditoria.md
    │   └── minha-conta.md
    ├── administrador/
    │   ├── pessoas.md                  cadastro, ativação, reset de senha
    │   ├── permissoes.md               verbos, prazo, avisos, sem herança
    │   ├── auditoria.md
    │   ├── painel.md
    │   └── unidades.md                 (administrador global)
    └── referencia/
        ├── tarefas-rapidas.md
        ├── limites.md                  novo (D9)
        └── faq.md
```

## Riscos

- **Pages não habilitado.** Hoje `has_pages: false`. O primeiro run de
  `deploy-pages` falha até que Settings → Pages defina a origem **GitHub
  Actions**. Mitigação: passo explícito em `tasks.md`, antes do merge, e registro
  no README. Não é automatizável pelo Terraform deste projeto, que cobre o GCP.
- **Repositório público ⇒ site público.** O manual não contém segredo, mas a URL
  de produção passa de arquivo em repositório para site indexável. Se o
  repositório algum dia se tornar privado, o Pages exigirá GitHub Enterprise
  Cloud e a publicação para de funcionar — o conteúdo continua íntegro no repo,
  então a degradação é apenas de entrega.
- **Perda de `git blame` contínuo.** Fatiar o arquivo quebra a linha de autoria
  por parágrafo. Aceito: o histórico do arquivo original permanece alcançável por
  `git log --follow` até o commit de remoção.
- **Manutenção mais dispersa.** Uma change que hoje edita um arquivo passará a
  editar duas ou três páginas. Mitigação: a nota em `CLAUDE.md` apontando onde a
  documentação mora e como ela é organizada.
- **Divergência silenciosa com a tela.** É o defeito que originou esta change, e
  nenhum gate automatizado o pega — nenhum teste lê a prosa. Mitigação possível
  apenas por disciplina: D8 dá o critério ("descreve a tela"), e a revisão de
  documentação continua sendo parte da change que altera a tela.
