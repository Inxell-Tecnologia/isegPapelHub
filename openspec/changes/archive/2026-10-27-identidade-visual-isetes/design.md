# Design

## Context

Ver `proposal.md` — Why. O estado de partida relevante para o desenho:

- `apps/web/src/app/theme.ts` entrega três tokens globais ao `ConfigProvider` do
  design system. Não há folha de estilo da aplicação: tudo é token ou estilo
  embutido em componente.
- `apps/web/src/auth/LoginPage.tsx` pinta `document.documentElement` com
  `LOGIN_BACKGROUND_COLOR` enquanto a rota está montada, e restaura ao sair.
  Isso existe por um motivo específico, já normatizado: a rolagem elástica do
  iOS revela a cor do **elemento raiz**, não a do container do login.
- O rótulo do papel está **triplicado** em três mapas `ROLE_LABEL` independentes
  (`shell/AppShell.tsx`, `conta/MinhaContaPage.tsx`, `pessoas/PessoaFormModal.tsx`).
- `GET /auth/public-config` tem allowlist nominal de três campos, com a própria
  spec exigindo modificação explícita para admitir um quarto.
- A SPA é servida pela própria API na mesma origem, sem CDN de frontend ativo.

A restrição mais forte do repositório não é tocada aqui: esta change não emite
URL assinada, não cria tabela, não abre contexto de unidade e não altera
nenhuma rota de conteúdo. O único contrato alterado é a configuração pública de
apresentação, que por definição é anônima e não tenant-scoped.

## Goals / Non-Goals

**Goals:**
- Uma origem única de tokens, de onde toda tela derive cor, tipo e raio.
- Conformidade de contraste **apurada por cálculo e travada por teste**, não
  conferida a olho.
- Recompor a tela de login sem perder nenhum dos comportamentos de borda já
  normatizados (rolagem elástica, barra de endereço retrátil, teclado virtual,
  375px sem rolagem horizontal).

**Non-Goals:**
- Tema escuro. A paleta do cliente define um único esquema claro.
- Reescrever componentes do design system. Trocamos tokens e composição, não a
  biblioteca de componentes.
- Qualquer alteração em `BrandMark.tsx` (decisão do cliente de manter a
  logomarca atual).

## Decisions

### D1 — Tokens no `ConfigProvider`, não em CSS avulso

Mantemos o caminho já escolhido pelo repositório: o tema é um objeto
`ThemeConfig`, agora com `token` **e** `components` (`Layout`, `Menu`, `Button`,
`Card`, `Input`), em vez de três tokens globais.

*Alternativa considerada:* variáveis CSS numa folha de estilo própria, ou
Tailwind. Rejeitada porque a aplicação inteira é composta com componentes do
design system — tokens fora dele seriam uma segunda fonte de verdade, e o
requisito "Tokens de apresentação têm origem única" passa a proibir exatamente
isso. Uma folha avulsa também ressuscitaria o problema que o repositório evitou
até aqui: estilo que não acompanha o componente quando a biblioteca muda.

### D2 — O verde da marca é superfície, não fundo de texto branco

O guia do cliente já adverte que `#0EC782` é claro demais para texto branco e
manda usar `#067A52` nos botões. Verificamos por cálculo e confirmamos:

| par | razão | piso | veredito |
|---|---:|---:|---|
| branco sobre `#067A52` (ação principal) | 5,37:1 | 4,5:1 | passa |
| branco sobre `#0EC782` | **2,21:1** | 4,5:1 | **reprova** |
| `#0F1D26` sobre `#0EC782` | 7,77:1 | 4,5:1 | passa |
| branco sobre `#012442` (topo do degradê) | 15,76:1 | 4,5:1 | passa |
| branco sobre `#0B5382` (base do degradê) | 8,16:1 | 4,5:1 | passa |
| `#0F1D26` sobre `#F3F7F9` | 15,92:1 | 4,5:1 | passa |
| `#52626E` sobre `#F3F7F9` | 5,85:1 | 4,5:1 | passa |
| `#025484` sobre branco (link) | 8,06:1 | 4,5:1 | passa |
| branco sobre `#012442` (login, nível AAA) | 15,76:1 | 7:1 | passa |

**O material do cliente se contradiz num ponto**: a tela de referência desenha o
item de navegação ativo como pílula `#0EC782` com rótulo **branco** — 2,21:1,
que reprova no piso que o próprio documento dele pede no item 17.

Resolvemos preservando a forma e trocando a cor do texto: pílula verde da marca
com rótulo e ícone em `#0F1D26` (7,77:1). O destaque visual é idêntico ao do
desenho; só o texto deixa de ser branco.

*Alternativa considerada:* pintar o item ativo com o verde de ação `#067A52` e
manter o rótulo branco (5,37:1). Rejeitada porque sobre a navegação azul-marinho
o verde escuro quase desaparece — perde-se justamente a função de destaque. É
uma diferença visível em relação ao desenho do cliente e deve ser comunicada a
ele no aceite.

### D3 — Duas bordas: decorativa e de controle

O guia define uma única borda, `#DCE6EC`. Ela mede **1,27:1** sobre branco e
**1,18:1** sobre o fundo da aplicação. Isso é adequado para um separador
decorativo, mas fica abaixo do piso de **3:1** que o contorno de um campo de
formulário precisa ter para identificar o controle.

Adotamos dois tokens:
- **borda decorativa** `#DCE6EC` — divisórias, contorno de cartão, separadores
  de tabela. Não carrega informação; não precisa de contraste.
- **borda de controle** `#788A97` — contorno de campo, caixa de seleção e
  qualquer limite que identifique um controle. Mede **3,57:1** sobre branco e
  **3,31:1** sobre o fundo da aplicação, com folga nos dois.

*Alternativa considerada:* manter borda única clara e confiar no rótulo
persistente e no preenchimento do campo para identificá-lo. Rejeitada por
depender de uma interpretação permissiva do critério, justamente num item que o
cliente listou como requisito.

### D4 — A raiz continua com uma cor só; o split são painéis sobrepostos

A composição em dois campos **não** muda quem pinta o elemento raiz. A raiz
segue recebendo a cor da marca (`#012442` no lugar do `#063c7c` atual) enquanto
a rota de login está montada, e os dois campos são painéis desenhados por cima.

Isso preserva integralmente o requisito "Fundo da tela de login cobre a área
visível integralmente": a rolagem elástica revela azul-marinho, como hoje; a
barra de endereço retrátil não expõe faixa de outra cor; nada no comportamento
de borda muda. O ganho de contraste é incidental — o azul novo mede 15,76:1
contra branco, acima dos 10,8:1 do atual, e continua folgado no nível AAA que a
spec exige.

*Alternativa considerada:* pintar a raiz com a superfície clara do lado
direito. Rejeitada: a rolagem elástica passaria a revelar claro por baixo do
painel escuro, que é exatamente a "faixa de outra cor" que o requisito proíbe.

### D5 — Fontes auto-hospedadas, não pelo CDN do Google

As famílias entram como dependências npm (`@fontsource/*`), servidas pela mesma
origem da aplicação, em `woff2`, subconjunto latino e apenas os pesos usados.

*Alternativa considerada:* `<link>` para `fonts.googleapis.com`, como o guia
sugere. Rejeitada por três razões convergentes: a aplicação hoje não tem
**nenhuma** dependência de terceiro em runtime; a SPA é servida pela própria API
na mesma origem, então um domínio externo no caminho crítico é regressão de
disponibilidade; e qualquer política de segurança de conteúdo futura teria de
abrir exceção para um terceiro. O requisito "Tipografia da marca não depende de
terceiro em tempo de execução" fixa essa escolha como comportamento, não como
preferência.

### D6 — Lucide substitui a biblioteca atual de uma vez

A troca é feita em todos os arquivos que importam ícones, e
`@ant-design/icons` sai do `package.json` na mesma change.

*Alternativa considerada:* adotar Lucide só nas telas novas e deixar as demais
como estão. Rejeitada porque o traço das duas bibliotecas difere visivelmente, e
a convivência apareceria lado a lado na mesma tela — a navegação e a tabela do
explorador, por exemplo. O requisito "Iconografia provém de biblioteca única"
proíbe a coexistência justamente para não deixar essa dívida aberta.

A troca é ampla mas mecânica, e os testes existentes buscam por texto e nome
acessível, não por ícone — então servem de rede durante a substituição. A
exceção foi um teste que localizava o sino da central de notificações pela
**classe do ícone**; ele passou a localizá-lo pelo nome acessível, que é
contrato — e o botão, que não tinha nome acessível algum, ganhou um.

O requisito alcança os ícones que a **aplicação** coloca na tela. Os glifos
internos do design system — seta do seletor, "×" de fechar, marca da caixa de
seleção — continuam sendo dele: são parte dos seus componentes, não uma
segunda biblioteca escolhida por nós, e substituí-los exigiria trocar a
biblioteca de componentes, que a seção **Non-Goals** exclui. O que sai do
`package.json` é a dependência **direta**; a transitiva do design system
permanece, por construção.

### D7 — Um único `ROLE_LABEL`

Os três mapas independentes passam a um só. Sem isso, "Gestor" entraria no shell
e as outras duas telas continuariam dizendo "Administrador da unidade" — a
triplicação é a causa provável de uma divergência futura, não só um incômodo
agora. O requisito "Rótulo do papel é idêntico em toda a interface" existe para
travar isso.

### D8 — Contato do suporte: variável de ambiente, nunca `SecretsPort`

O contato entra como quarto valor da configuração pública, lido de variável de
ambiente ao lado de `APP_CLIENT_NAME`, e é devolvido vazio quando ausente —
mesma forma dos outros três. É texto livre, para a implantação escolher entre
e-mail, ramal ou ambos.

Ele **não** transita pelo `SecretsPort`: aparece numa tela pré-autenticação, logo
é público por natureza, e a spec já exige que todo valor dessa lista o seja.

### D9 — O requisito do campo visual do login é substituído, não remendado

O requisito "Tela de login apresenta campo visual derivado da logomarca" entra
no delta como **REMOVED**, e um requisito novo — "Tela de login apresenta campo
de marca com cor da paleta" — entra como ADDED preservando todas as suas
garantias.

A alternativa era MODIFIED. Ela foi descartada por uma razão concreta: um bloco
MODIFIED precisa carregar os cenários existentes, e dois deles nomeiam no
próprio título aquilo que deixa de valer — "Fundo da tela de login **deriva da
logomarca**" e "Logomarca permanece contida em moldura escura **sobre o cartão
claro**". Mantê-los produziria cenários cujo título contradiz o próprio corpo;
renomeá-los dentro de um MODIFIED é recusado pela validação, que trata a
omissão de um cenário existente como perda de garantia.

A substituição explícita deixa o rastro onde ele pertence: o bloco REMOVED
declara por que o requisito antigo não descreve mais o sistema, e o campo de
migração enumera as três garantias preservadas — fundo de marca em vez do neutro
do design system, logomarca sempre contida em campo escuro, e contraste apurado
por cálculo no nível AAA. Nenhuma se perde; o que muda é de onde a cor vem e
qual campo hospeda a logomarca.

### D10 — O veredito de envio da pasta vem do servidor, não de inferência no cliente

O requisito de estado vazio exige que a ação oferecida respeite "a permissão
**já resolvida pelo servidor**". A capability `web-navegacao` já normatizava o
outro lado da moeda: "**como os DTOs de listagem não informam os verbos
concedidos, a SPA NÃO SHALL inferir permissão no cliente**". Com o contrato de
`GET /folders/:id/contents` como estava, os dois requisitos eram
inconciliáveis — não havia veredito no DTO, e derivá-lo seria exatamente a
inferência proibida.

`FolderContentsResponse` passa a carregar `canUpload`, resolvido na rota pela
**mesma** `hasAccess(..., Permission.UPLOAD)` que a rota de envio usa, na mesma
transação tenant. Na raiz da unidade é sempre `true`: a raiz não é recurso
concedível e enviar para ela é livre (design.md D9 de `download-pasta-zip`,
US 3.3).

*Alternativa considerada:* derivar no cliente a partir do que o DTO já traz —
`folder === null` para a raiz, `ownerId === identity.id` para o dono, papel
para o admin. Rejeitada por duas razões, e a segunda é dirimente: a capability
`web-navegacao` proíbe a inferência; e quem tem a concessão `upload` sobre
pasta de outra pessoa **não** é derivável desses campos — ficaria sem a ação
que o servidor lhe autoriza, violando o primeiro cenário do requisito.

Isto corrige o que a seção **Impact** da proposal previa ("nenhuma rota de
conteúdo é tocada"): a rota de conteúdo é tocada, de forma **aditiva** — um
campo novo na resposta, nenhuma mudança de autorização, nenhuma rota nova,
nenhum prefixo novo. O veredito **não** é linha de defesa: o `403` da rota de
envio continua sendo a autorização real, e `canUpload` serve só para a
interface não oferecer o que o servidor recusaria nem esconder o que ele
permitiria.

### D11 — A ação do estado vazio leva à área de envio, não a uma segunda via de envio

O botão da orientação põe o foco no gatilho da área de envio já presente na
tela, em vez de abrir seu próprio seletor de arquivos. A área de envio carrega
a pré-checagem de espaço, o fatiamento, a fila de transferências e o relato de
falha por item — nada disso se reimplementa num botão, e duas superfícies de
envio na mesma tela deixariam ambíguo qual é a verdadeira.

## Risks / Trade-offs

- **O item ativo divergir do desenho do cliente** (texto escuro em vez de
  branco) → é a única forma de atender ao item 17 do próprio pedido dele.
  Levar a diferença ao aceite, com a medição (2,21:1 contra 7,77:1) em mãos.
- **Trocar `colorPrimary` afeta dezenas de componentes do design system** que
  nunca foram revistos sob a cor nova (tags, links de paginação, estados de
  seleção da tabela, `Popconfirm`) → varredura tela a tela na validação, não só
  nas telas redesenhadas.
- **Substituição ampla de ícones pode trocar um ícone por outro de semântica
  parecida** sem que nenhum teste perceba → a validação inclui conferir o
  mapeamento contra o bloco 07 do guia, item a item.
- **Peso de fonte no pacote** → restringir a `woff2`, subconjunto latino e aos
  pesos 400/600 efetivamente usados; conferir o tamanho do pacote antes e depois.
- **Exibir e-mail de suporte numa página pré-autenticação expõe o endereço a
  coleta automatizada** → o campo é texto livre; a implantação pode preferir
  ramal ou formulário interno. Documentar a escolha no manual, não forçar
  `mailto:`.
- **O piso de 44px de área de acionamento encarece a densidade das tabelas** →
  `controlHeight` **e** `controlHeightSM` recebem 44 (theme.ts): "pequeno"
  neste produto passa a significar densidade tipográfica e espaçamento, nunca
  um alvo de toque menor. As ações por item do explorador ficam mais altas que
  antes; é o custo direto do item 17 do pedido do cliente, e um teste trava os
  dois tokens contra um afrouxamento silencioso.
- **O piso de 44px não alcança alvos em linha dentro de texto** → o nome do
  arquivo na tabela do explorador é um **link de texto** dentro da célula, não
  um controle com forma própria; esticá-lo a 44px descaracterizaria a linha da
  tabela. Fica como exceção deliberada, a mesma que o WCAG reconhece para
  alvos em linha em meio a texto. O que foi corrigido é o que tem forma de
  controle: a caixa de seleção, cujo invólucro clicável passa a 44px de altura
  com a caixa centrada (theme.ts, `ESTILO_GLOBAL`).
- **Os presets de cor de rótulo do design system reprovam no piso novo** → o
  verde mede 3,37:1 e o laranja 3,34:1 sobre os próprios fundos. Os rótulos de
  estado passaram a `RotuloDeEstado`, que recebe um **tom semântico** e tira
  as três cores dos tokens (`tonsDeEstado`), apurados por cálculo. É o caso
  concreto do vazamento que esta seção já previa ao falar de tags.
- **A tela de login carrega dois comportamentos de borda difíceis de testar**
  (rolagem elástica, teclado virtual) que nenhum teste de unidade cobre de fato
  → manter os testes que verificam a pintura da raiz e a fluidez do cartão, que
  são as aproximações já praticadas pelo repositório.

## Migration Plan

Não há migração de dados: nenhuma tabela, coluna ou índice é tocado.

Ordem de implantação:
1. `packages/shared` recompilado com o quarto campo (os consumidores leem de
   `dist/`, não da fonte).
2. API implantada devolvendo o campo novo — vazio enquanto a variável não
   existir, o que é comportamento normatizado e não quebra a SPA antiga.
3. Variável de ambiente provisionada no Cloud Run via Terraform.
4. SPA implantada com a pele nova.

A ordem importa só entre 1 e 2; a SPA tolera o campo ausente por construção.

**Rollback:** reverter a change. Como nada é persistido e o campo novo é
opcional em ambas as pontas, voltar a versão anterior não deixa estado
inconsistente.

## Open Questions

- O valor concreto do contato do suporte do Instituto SETES (e-mail, ramal ou
  ambos) é dado operacional da implantação, não decisão de desenho: pode ser
  definido no provisionamento sem alterar spec, tarefa ou código.
