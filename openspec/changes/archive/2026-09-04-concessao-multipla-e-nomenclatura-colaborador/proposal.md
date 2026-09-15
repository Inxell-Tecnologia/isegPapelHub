# Proposal — concessao-multipla-e-nomenclatura-colaborador

## Why

Dois pedidos diretos do cliente sobre a mesma superfície — a administração de
pessoas e de permissões — que hoje custam trabalho repetitivo e confundem o
vocabulário do produto:

1. **Conceder permissão é uma pessoa por vez.** O diálogo "Permissões" de um
   arquivo ou pasta tem um seletor de **uma** pessoa; liberar o mesmo conjunto
   de verbos para dez pessoas exige repetir o formulário dez vezes — dez
   submissões, dez chances de marcar o verbo errado, dez prazos digitados à
   mão. A US 4.1 do PRD (`docs/prd_final.md`) já fala em conceder "para uma
   pessoa **ou grupo**"; a interface entregue ficou no caso singular.
2. **O produto chama a mesma coisa de três nomes.** A interface diz "Pessoa"
   (menu "Pessoas", coluna da auditoria, rótulo do seletor de permissões,
   cartão do painel), o cliente diz "Servidor" na operação, e o papel do
   sistema já se chama "Colaborador". O cliente definiu **Colaborador** como o
   termo único.

## What Changes

### 1. Concessão simultânea a vários colaboradores

- **BREAKING** — `POST /grants` passa a receber **`subjectUserIds: string[]`**
  (1..N) no lugar de `subjectUserId: string`. Contrato interno, consumido
  apenas pela SPA e pelos testes; não há cliente externo.
- A rota concede o **produto cartesiano** dos colaboradores informados pelos
  verbos marcados, numa **única transação**: ou todas as concessões entram, ou
  nenhuma entra. A idempotência atual (`ON CONFLICT ... DO UPDATE`, que faz o
  prazo informado prevalecer) e a ausência de herança **não mudam** — cada
  concessão continua sendo uma linha por (colaborador, recurso, verbo).
- **Fail-closed preservado e reforçado:** se **qualquer** id informado não
  existir ou for de outra unidade, a requisição inteira é recusada com `404`,
  sem indicar qual — recusa parcial vazaria existência de conta por
  observação, exatamente o que a regra atual evita.
- **Teto explícito** de colaboradores por requisição, no molde do teto já
  existente do manifesto de download, com código de erro próprio para a SPA
  distinguir o aviso.
- **Aviso de concessão com prazo é emitido por colaborador** — um aviso para
  cada destinatário, fora da transação, com a idempotência por
  `(destinatário, tipo, sourceRef)` já existente. Falha ao avisar **um**
  colaborador não afeta os demais nem a concessão.
- **SPA:** o seletor de pessoa vira seletor **múltiplo** de colaboradores, com
  busca por nome; a prévia de "prazo atual" passa a listar, por colaborador
  selecionado que já tenha concessão naquele recurso, o que ele já tem — para
  que a decisão de deixar o prazo em branco continue informada. A listagem de
  concessões vigentes e a revogação por verbo **não mudam**.

### 2. Nomenclatura única: "Colaborador"

- Todo texto **visível ao usuário** que hoje diz "Pessoa"/"Pessoas" passa a
  dizer "Colaborador"/"Colaboradores": menu lateral, página de gestão,
  diálogos de cadastro/edição, confirmações de ativar/desativar e redefinir
  senha, coluna "Pessoa" da auditoria, rótulos do diálogo de permissões,
  cartão "Total de pessoas" do painel, avisos de unidade com pessoas
  vinculadas, e as páginas correspondentes do manual MkDocs
  (`docs/manual/docs/**`, incluindo o rótulo de navegação).
- **Concordância de gênero** acompanha a troca: os rótulos de status
  "Ativa"/"Inativa" (que concordavam com "pessoa") passam a "Ativo"/"Inativo".
- O **papel `collaborator` continua rotulado "Colaborador"** (decisão do
  cliente). A coexistência é aceita: a coluna "Papel" da listagem distingue
  Colaborador / Administrador da unidade / Administrador global.
- "Servidor" **não aparece** hoje na interface como termo de pessoa — as
  ocorrências no código são todas "servidor" no sentido técnico (backend), em
  comentários. Nenhuma é alterada.

Fora de escopo (registrado em design.md):

- **Rota `/admin/pessoas`**, nomes de pastas, arquivos e componentes
  (`apps/web/src/pessoas/`, `PessoasPage`, `PessoaFormModal`), nomes de
  capabilities OpenSpec (`web-pessoas`, `gestao-pessoas`) e identificadores
  internos (`users`, `subjectUserIds`, `collaborator`) — permanecem. Links
  salvos continuam válidos e o histórico de specs preserva o rastro.
- **`docs/prd_final.md`** — documento mestre, vocabulário de domínio; não é
  camada de apresentação.
- **Grupos de pessoas** como entidade (a US 4.1 menciona "grupo"): esta change
  entrega a concessão a **vários colaboradores de uma vez**, não um cadastro
  de grupos reutilizável. Continua mudança futura.
- **Seleção múltipla de recursos** (conceder sobre vários arquivos numa
  operação) — o diálogo continua sendo por item do explorador.
- **Filtro "Autor"** da busca e o termo "ator" da auditoria — não são
  "Pessoa"/"Servidor" e não mudam.

## Capabilities

### New Capabilities

- `nomenclatura-interface`: estabelece o termo único para a pessoa usuária na
  camada de apresentação (**Colaborador**), o alcance da regra (texto visível
  na SPA e no manual do usuário) e o que ela explicitamente **não** alcança
  (rotas, identificadores internos, nomes de código e o rótulo do papel
  `collaborator`, que permanece "Colaborador").

### Modified Capabilities

- `permissoes-granulares`: o requisito de concessão passa de **um** sujeito
  por requisição para **um ou mais**, com atomicidade da operação, teto de
  destinatários e recusa integral fail-closed quando qualquer destinatário for
  inválido.
- `web-permissoes`: o requisito de concessão no diálogo passa de "selecionar
  **uma pessoa**" para "selecionar **um ou mais colaboradores**", com a prévia
  de prazo vigente por colaborador selecionado e o aviso de teto excedido.
- `notificacoes`: o requisito de aviso no ato da concessão passa a descrever a
  emissão **por destinatário** numa concessão de vários colaboradores, com
  isolamento de falha entre eles.

## Impact

- **`packages/shared`** — `CreateGrantRequest.subjectUserId` → `subjectUserIds`
  (BREAKING); novo código de erro de teto excedido. Exige
  `npm run build --workspace packages/shared`.
- **`apps/api/src`** — `routes/grants.ts` (validação, upsert em laço sobre o
  produto colaboradores × verbos dentro da transação já existente, verificação
  de existência dos sujeitos em consulta única, laço de notificação); `config`
  ganha o teto de destinatários, no molde de `config.downloadManifest`.
  **Sem migração de banco** — o esquema de `grants` já é uma linha por
  (colaborador, recurso, verbo).
- **`apps/web/src`** — `permissoes/PermissoesModal.tsx` (seletor múltiplo,
  prévia por colaborador, aviso de teto), `permissoes/queries.ts` (tipo do
  corpo), `lib/schemas.ts` se houver esquema do pedido; troca de rótulos em
  `shell/AppShell.tsx`, `pessoas/PessoasPage.tsx`, `pessoas/PessoaFormModal.tsx`,
  `pessoas/SenhaGeradaModal.tsx`, `auditoria/AuditoriaModal.tsx`,
  `painel/PainelPage.tsx`, `unidades/UnidadesPage.tsx`.
- **Testes** — `apps/api/src/__tests__/grants.test.ts` (novos casos: vários
  sujeitos, atomicidade, teto, 404 integral) e
  `apps/web/src/__tests__/permissoes.test.tsx` (seleção múltipla, uma única
  chamada); atualização de âncoras de texto em `pessoas.test.tsx`,
  `auditoria.test.tsx`, `painel.test.tsx`, `unidades.test.tsx`,
  `role-guard.test.tsx` e demais testes que ancoram "Pessoas".
- **Docs** — `docs/manual/docs/**` (prosa e `nav:` do `mkdocs.yml`),
  `docs/frontend_roadmap.md` onde descreve o diálogo de permissões.
- **Sem mudança de infraestrutura Terraform, sem novo prefixo de rota de topo,
  sem impacto no isolamento por unidade ou na RLS.**
