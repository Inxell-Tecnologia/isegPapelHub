# Proposal

## Why

O cliente da implantação (Instituto SETES) entregou um guia visual próprio e um
documento de ajustes com 18 itens, pedindo que o PapelHub passe a vestir a
identidade da instituição. A camada de apresentação atual não tem identidade
nenhuma: `apps/web/src/app/theme.ts` carrega três tokens genéricos
(`colorPrimary: '#1d4ed8'`, raio 8, pilha de fontes do sistema), e a tela de
login é um cartão centrado sobre fundo chapado. O resultado é um produto que
não se parece com a organização que o usa.

Esta change implementa **apenas a camada visual** dos 18 itens — paleta,
tipografia, iconografia, tela de login e piso de acessibilidade. Ela é a única
fatia do pedido que não depende de domínio novo nem de decisão de produto
pendente, e por isso é entregável sozinha, com risco baixo e efeito imediato.

Não decorre de uma US do PRD (`docs/prd_final.md`): é pedido direto do cliente
sobre apresentação, exatamente como a capability `identidade-visual` já declara
no seu Purpose. Seguimos esse precedente em vez de inventar uma US.

## What Changes

- **Paleta da marca vira sistema de tokens.** `theme.ts` deixa de ser três
  tokens globais e passa a módulo com tokens de componente (`Layout`, `Menu`,
  `Button`, `Card`, `Input`): navegação lateral em degradê azul-marinho
  (`#012442` → `#0B5382`), item ativo em verde (`#0EC782`), botão principal em
  verde ação (`#067A52`), links em azul (`#025484`), texto (`#0F1D26`), texto de
  apoio (`#52626E`), superfície (`#F3F7F9`) e borda (`#DCE6EC`). Cantos de 10px
  em botões e campos, 14px em cartões.
- **O verde da logo não é o verde dos botões.** `#0EC782` tem contraste
  insuficiente com texto branco; o botão principal usa `#067A52` (5,4:1). A
  ressalva é do próprio guia do cliente e vira requisito, não convenção oral.
- **Tipografia própria**: Lexend em títulos, Source Sans 3 em texto, piso de
  13px. **Auto-hospedadas** (`@fontsource`), não servidas pelo CDN do Google: a
  API serve a SPA na mesma origem, sem CDN separado, e um terceiro no caminho
  crítico de carregamento seria dependência externa em runtime numa aplicação
  que hoje não tem nenhuma.
- **Biblioteca de ícones única**: Lucide substitui `@ant-design/icons` em toda a
  SPA, com traço de 1,8px e o mapeamento já definido no guia do cliente.
  Conviver com duas bibliotecas produziria inconsistência visível de traço.
- **Tela de login redesenhada** em dois campos: painel escuro à esquerda com a
  logomarca, a proposta de valor e três benefícios; cartão de acesso à direita.
  Em tela estreita os campos empilham, preservando os comportamentos já
  normatizados (sem rolagem horizontal, cartão alcançável com teclado virtual,
  nenhuma faixa de outra cor na rolagem elástica).
- **Aviso de contato do suporte na tela de login**, configurável por implantação
  — quarto valor da lista nominal de `GET /auth/public-config`.
- **Estados vazios que orientam**: pasta sem conteúdo apresenta mensagem e a
  ação de envio, em vez da tabela vazia herdada do design system.
- **Piso de acessibilidade verificável**: contraste mínimo de 4,5:1, foco
  visível ao teclado, área de clique de 44px e texto a partir de 13px.
- **Rótulo do papel `unit_admin` passa a "Gestor"**, por decisão do cliente.
  "Colaborador" e "Administrador global" permanecem inalterados.

### Fora de escopo

Registrado aqui porque cada exclusão foi uma decisão explícita do cliente, não
um esquecimento:

- **Logomarca do Instituto SETES** (item 2 do documento do cliente — versão
  branca no menu e marca d'água a 6%). O cliente decidiu **manter a logomarca
  PapelHub como está**. O ativo do Instituto não existe no repositório em
  formato algum, e a arte atual (`apps/web/public/logo-papelhub.jpg`, 301×502) é
  uma fotografia de letreiro — não tem fundo chapado e não é derivável para
  transparência. `BrandMark.tsx` fica **intocado**.
- **"Manter conectado" e "Esqueci minha senha"**, presentes no desenho do
  cliente: não têm backend. O TTL de sessão é valor único de configuração (não
  há sessão longa) e a redefinição de senha só existe por via administrativa
  (`POST /users/:id/password`), sem auto-atendimento. Renderizar controle inerte
  contraria o princípio de fidelidade do `CLAUDE.md`; o aviso de contato do
  suporte cobre o papel do "esqueci minha senha". O "mostrar senha" do desenho
  **já é entregue** pelo `Input.Password` do design system.
- **Saudação personalizada, busca no topo, atalhos da tela inicial, cartões de
  "Minhas Pastas", árvore lateral e Recentes** (itens 3, 4, 5, 7, 9 e parte do
  8): change seguinte, `shell-e-inicio`.
- **Tipo e sigla por documento, revisão, situação e metadados no envio** (itens
  6, 10, 12): change `controle-documental`, que implementa o Épico 10 do PRD.
- **Favoritos, leitura obrigatória com ciência, notificações novas e tour
  guiado** (itens 8-parcial, 11, 13, 14): fora de todas as changes desta rodada.
- **Versão para celular** (item 18): já entregue pela change arquivada
  `responsividade-mobile-tablet`. Aqui apenas se revalida que a pele nova não
  regride o modo estreito.

## Capabilities

### New Capabilities
- `sistema-de-design`: origem única dos tokens de apresentação da SPA — paleta,
  tipografia, raio, biblioteca de ícones — e o piso de acessibilidade
  verificável que esses tokens têm de sustentar (contraste, foco, área de
  clique, tamanho mínimo de texto). Distinta de `identidade-visual`, que trata
  do que varia **por implantação** (nome, logomarca, identificação do cliente):
  os tokens são constantes do produto, versionados com o código.

### Modified Capabilities
- `identidade-visual`: o requisito "Tela de login apresenta campo visual
  derivado da logomarca" passa a admitir a composição em dois campos e deixa de
  amarrar a logomarca ao cartão claro — ela passa a residir no painel escuro, que
  continua sendo a moldura escura exigida. A cor de marca deixa de ser
  **derivada por amostragem da arte** e passa a vir da paleta da identidade. O
  requisito "Configuração de identidade visual disponível sem autenticação" tem
  sua lista nominal ampliada de três para quatro valores, com o contato do
  suporte — a própria spec exige que acrescentar um valor seja modificação
  explícita, nunca extensão natural do contrato.
- `nomenclatura-interface`: o requisito "Rótulo do papel de acesso preservado"
  passa a fixar **"Gestor"** para `unit_admin`, mantendo "Colaborador" e
  "Administrador global".
- `web-navegacao`: acrescenta requisito de estado vazio orientado no explorador —
  pasta sem conteúdo apresenta mensagem e ação, não tabela vazia.

## Impact

**Frontend (`apps/web`)** — o grosso da mudança:
- `src/app/theme.ts` (reescrito como módulo de tokens), `src/auth/LoginPage.tsx`
  (recomposta), `src/navegacao/ExplorerPage.tsx` (estado vazio),
  `src/shell/AppShell.tsx` (degradê, item ativo, rótulo "Gestor", ícones).
- Troca de `@ant-design/icons` por `lucide-react` **em todos os arquivos que
  importam ícones** — mecânica, porém ampla.
- Dependências novas: `lucide-react`, `@fontsource/lexend`,
  `@fontsource/source-sans-3`. Remoção de `@ant-design/icons`.

**Contrato compartilhado (`packages/shared`)**: `PublicConfigResponse` ganha o
quarto campo. Exige recompilar `packages/shared` para os consumidores
enxergarem (`dist/`, não a fonte TS).

**Backend (`apps/api`)**: duas alterações, ambas aditivas.
`GET /auth/public-config` passa a devolver o contato do suporte, lido de
variável de ambiente como os demais valores públicos — nunca pelo
`SecretsPort`. E `GET /folders/:id/contents` passa a devolver `canUpload`, o
veredito do verbo `upload` sobre a pasta corrente, resolvido pela mesma
`hasAccess` que a rota de envio usa (design.md D10): sem ele o requisito de
estado vazio — "a ação oferecida respeita a permissão já resolvida pelo
servidor" — seria inconciliável com a proibição de `web-navegacao` de inferir
permissão no cliente. Nenhuma regra de permissão, RLS, auditoria ou byte é
alterada; nenhuma rota nova e nenhum prefixo de API novo, logo as três listas
de prefixo (`api-prefixes.ts`, `vite.config.ts`, `locals.tf`) permanecem
inalteradas.

**Infraestrutura**: nova variável de ambiente da implantação no Cloud Run
(`infra/terraform`), ao lado de `APP_CLIENT_NAME`.

**Testes**: `__tests__/login.test.tsx` tem dois casos presos ao layout antigo
("aplica a cor de marca como fundo", "o cartão de acesso é fluido com teto") que
acompanham a recomposição. `__tests__/shell-identidade-visual.test.tsx` cobre
`BrandMark` e identificação do cliente — como a logomarca não muda, deve
permanecer verde e serve de rede de proteção. Casos novos cobrem contraste
calculado, rótulo "Gestor", estado vazio e o quarto campo da configuração
pública.

**Documentação**: a tela de login muda, então a página correspondente de
`docs/manual/` é atualizada **no mesmo commit**, com fidelidade ao que é
efetivamente entregue — sem documentar "manter conectado" nem "esqueci minha
senha".
