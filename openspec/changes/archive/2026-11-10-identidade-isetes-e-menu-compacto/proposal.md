# Proposal

## Why

Na 3ª rodada de ajustes (`docs/demanda_cliente_3.md`, itens 1 a 4; fatia **A**
de `docs/plano_demanda_cliente_3.md`) o cliente recusa o menu lateral como está:
a logomarca ainda é a imagem antiga do PapelHub, o menu **rola** — e por isso
"Compartilhados comigo", "Leitura obrigatória", "Lixeira" e o grupo AJUDA ficam
cortados ou abaixo da dobra, a ponto de o cliente pedir para "incluí-los",
embora já existam —, falta a marca d'água do símbolo no pé do menu e o cartão do
usuário ocupa altura demais.

O que destrava a fatia agora é a chegada da **dependência externa E1** da
demanda nº 2: a logo branca do Instituto SETES, a versão colorida e o símbolo
isolado, todos com fundo transparente (`docs/images/demanda_3/`). Até aqui o
shell convivia com um ativo retrato e sem transparência (`logo-papelhub.jpg`,
301×502), que exigia moldura escura e consumia ~190 px da coluna — a principal
razão de o menu não caber.

A fatia é de **apresentação**: nenhuma regra de permissão, alcance de dados ou
tráfego de bytes muda.

## What Changes

**Identidade (itens 1 e 3; decisão do cliente: "troca tudo")**

- A logo **branca** do Instituto SETES substitui `logo-papelhub.jpg` no shell
  expandido e na tela de login, com **"PapelHub · Gestão de Documentos"** em
  texto logo abaixo. Com fundo transparente, a **moldura escura própria deixa de
  existir** — a logo branca passa a ser apresentada apenas sobre os fundos
  escuros da marca (degradê da navegação e campo escuro do login).
- No estado **colapsado**, a forma abreviada em texto "PH" dá lugar ao
  **símbolo** do ISETES, com o nome acessível PapelHub.
- O **favicon** passa a derivar do símbolo, enquadrado em quadrado sem
  estiramento.
- **Marca d'água** do símbolo no pé do menu, decorativa, em opacidade limitada
  pelo contraste do texto que passa por cima (≤ 10%, apurado por cálculo).
- Na marca expandida, a linha da **identificação do cliente** (`APP_CLIENT_NAME`)
  deixa de ser repetida: a própria logo já identifica a organização. A
  identificação continua no título do documento e na tela de login.

**Menu sem rolagem (item 2)**

- Critério verificável: numa **área visível de 768 px de altura**, a navegação
  expandida apresenta **todos** os itens do papel, inclusive o de
  `global_admin` com o manual configurado, **sem barra de rolagem**. Abaixo
  disso a rolagem volta só como último recurso, sem jamais deslocar o rodapé.
- O **controle de recolher** sai do pé da coluna e vai para o **topo** da
  navegação, junto da marca (decisão do cliente).
- Itens com 44 px exatos (sem margem entre eles) e rótulos de grupo mais baixos.
  O piso de 44 px de `sistema-de-design` **não é relaxado**.

**Cartão do usuário (item 4)**

- Cartão compacto no rodapé: avatar, nome e função · unidade, com **Sair** como
  botão de ícone ao lado (nome acessível "Sair", 44 px), em vez da linha
  própria de largura inteira.

**Fora de escopo**

- A grafia **"Perfomance"** (item 4) não está no código nem no seed: é o cargo
  cadastrado de uma conta em produção. Corrige-se pela tela Colaboradores, por um
  administrador — registrado no plano, sem mudança de código.
- Itens 5 a 12 (marca d'água da área principal, atalhos, pastas, tour, busca,
  sino, documentos recentes) são as fatias B e C do plano.
- Tornar a logo um ativo **configurável por implantação**: continua versionada
  com o código, como a anterior.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `identidade-visual`: a logomarca oficial passa a ser a logo branca do
  Instituto SETES, sem moldura, apresentada só sobre fundo escuro da marca; o
  estado colapsado passa a exibir o símbolo (antes, só texto); o favicon deriva
  do símbolo, enquadrado sem estiramento; a marca expandida deixa de repetir a
  identificação do cliente; requisito novo da marca d'água no pé da navegação.
- `web-shell-e-auth`: a navegação expandida cabe sem rolagem em 768 px de altura
  visível para qualquer papel; o controle de recolher fica no topo da navegação;
  a ação Sair do rodapé é um controle compacto com nome acessível.

## Impact

- **Web**: `apps/web/src/shell/AppShell.tsx` (gatilho próprio no topo, sem
  `overflowY` como regra), `MarcaDoProduto.tsx`, `BrandMark.tsx`,
  `CartaoDoUsuario.tsx`, componente novo da marca d'água;
  `apps/web/src/auth/LoginPage.tsx`; `apps/web/src/app/theme.ts` (tokens do
  `Menu`: margem de item e rótulo de grupo); `apps/web/index.html` (favicon).
- **Ativos**: `apps/web/public/` ganha a logo branca, a colorida e o símbolo;
  `logo-papelhub.jpg` sai; `favicon.png` é regerado.
- **Testes**: `shell-identidade-visual.test.tsx`, `shell-identidade-e-busca.test.tsx`,
  `login.test.tsx`; medição da altura do menu com Playwright em 1366×768.
- **Manual**: `docs/manual/docs/a-tela.md` e `primeiro-acesso.md` (marca,
  recolher no topo, Sair em ícone); logo do site do manual em
  `docs/manual/mkdocs.yml`.
- **API, banco, infraestrutura**: nenhum impacto.
