# Proposal

## Why

Nesta aplicação, permissão granular é a única via pela qual uma pessoa alcança
documento que não é seu: a resolução de acesso é **dono OU administrador da
unidade OU concessão vigente do verbo exigido**, *sem herança*
(`apps/api/src/lib/access.ts`). A concessão é, portanto, o compartilhamento — e
hoje **não existe nenhuma superfície em que a pessoa veja o que foi
compartilhado com ela**.

A assimetria é completa: o administrador lista as concessões **de um recurso**
(`permissoes-granulares`, "Gestão de concessões restrita à administração"), mas
quem **recebeu** a concessão não tem como listá-la. Sem herança, o recurso
concedido pode estar em qualquer profundidade de uma árvore cujas pastas
intermediárias a pessoa não abre — então ele não aparece na navegação, e
descobri-lo depende de alguém ter mandado o endereço. Uma concessão com prazo
(US 4.3) agrava isso: a pessoa não tem onde ver que um acesso vence amanhã.

O cliente pediu o destino de menu **"Compartilhados comigo"** na tabela 1.1 de
`docs/demanda_cliente_2.md` — é a fatia **A5** do plano em
`docs/plano_demanda_cliente_2.md`. A fatia **A2** entregou a estrutura dos
grupos do menu e deixou este item **de fora de propósito**, porque `tela-inicial`
normatiza que "atalho apresentado conduz a uma ação executável": o item entra
junto com o seu destino, e é isso que esta change faz.

**Correção ao plano:** a seção A5 classifica esta fatia como *"reentrada de
escopo"*, por analogia com Favoritos (A4) e Tour guiado (A6). Não é. A lista de
Fora de Escopo do PRD exclui *"compartilhamento de arquivos entre unidades
diferentes"* e *"notificações fora do contexto de expiração de permissão (ex.:
aviso a cada novo compartilhamento recebido)"* — **nenhuma das duas é a listagem
do que já foi compartilhado comigo**. Esta é US nova, não volta de escopo
excluído; e nenhuma das duas exclusões é reaberta aqui.

## What Changes

- **Destino novo "Compartilhados comigo"**, no grupo NAVEGAÇÃO do menu, para
  **qualquer papel autenticado** — não é item de administração. Lista as
  **pastas e arquivos** sobre os quais a pessoa tem concessão vigente, em uma
  tabela só, com o que pode fazer em cada um e o prazo quando houver.
- **Rota de leitura auto-escopada**, sob o prefixo `/grants` que já existe. É a
  primeira rota de concessões aberta a `collaborator`, e por isso o requisito
  de alcance de `permissoes-granulares` passa a **distinguir administrar as
  concessões de um recurso de ler as próprias concessões recebidas**. A
  distinção não afrouxa nada: a pessoa só alcança linhas em que ela própria é a
  destinatária, e a RLS por `unit_id` continua sendo a garantia final.
- **Um item por recurso, não por verbo.** A tabela `grants` é por verbo — `view`
  e `download` sobre o mesmo arquivo são duas linhas. A tela apresenta **um**
  item com o conjunto de verbos, porque o que a pessoa procura é o documento,
  não a linha de concessão.
- **Só concessões vigentes**, apuradas pelo relógio do Postgres na consulta.
  Concessão expirada **não** aparece: "expirar não é revogar" vale para o
  registro administrativo, que preserva a trilha; esta tela responde "a que eu
  tenho acesso agora", e acesso vencido não é acesso.
- **A listagem não amplia alcance.** Compõe-se com todas as regras restritivas
  já vigentes — documento obsoleto, arquivo pendente de cadastro, item na
  lixeira, isolamento por unidade — e perder o acesso remove o item na consulta
  seguinte, sem erro.
- **Recurso de que a própria pessoa é dona não entra.** Dono já alcança por
  navegação, e concessão sobre o próprio recurso é redundante na resolução de
  acesso; apresentá-la como "compartilhado comigo" seria falso.
- **Nenhuma migração.** `grants` já tem `subject_user_id`, `expires_at`, índice
  por `(subject_user_id, resource_type, permission)` e policy RLS por `unit_id`.
  Nenhuma tabela, nenhuma coluna, nenhum prefixo de rota de topo novo — logo
  nenhuma das três listas de prefixo (`lib/api-prefixes.ts`,
  `apps/web/vite.config.ts`, `infra/terraform/locals.tf`) é tocada.

**Fora de escopo, de propósito:**

- **Conceder ou revogar a partir desta tela.** É leitura. Conceder segue
  exclusivo da administração, pela tela de permissões que já existe.
- **Notificar a pessoa a cada compartilhamento recebido.** Está nominalmente na
  lista de Fora de Escopo do PRD, e esta change não a reabre. O aviso prévio de
  **expiração** continua sendo o que `notificacoes` já emite (US 4.3).
- **Mostrar quem compartilhou.** `grants.granted_by` existe, mas conceder é ato
  da administração: a informação útil a quem recebeu é *o que* e *até quando*,
  não *qual administrador executou*. Acrescentar o nome depois é barato;
  retirá-lo, não.
- **Cartão de atalho na tela inicial.** A demanda pede o item **de menu**. A
  tela inicial é a fatia A3, travada por D1.
- **Favoritos (A4).** Fatia própria, e exige tabela nova. Esta change fixa a
  forma da **listagem plana de recursos em profundidade arbitrária** — o que
  mostrar como localização, o que o clique faz, o que acontece quando o alcance
  cai — e a A4 passa a consumir essa forma em vez de inventar uma segunda.
- **Herança de concessão em pasta.** Continua não existindo (US 4.1 cenário 2).
  Uma pasta compartilhada aparece na lista; o conteúdo dela só aparece quando
  tiver concessão própria, exatamente como na navegação.

## Capabilities

### New Capabilities

- `compartilhados-comigo`: o acervo que a pessoa alcança **por concessão
  recebida** — quais concessões compõem a lista (vigência, exclusão do que é
  seu, agregação por recurso), que alcance a lista tem (regra restritiva e
  *fail-closed*, sem ampliar nada), como a localização do item é apresentada sem
  expor a cadeia de pastas que a pessoa não alcança, e o que o acionamento de
  cada item faz. Capability única cobrindo servidor e apresentação, pelo
  precedente de `tela-inicial`, que declara no mesmo lugar a lista de recentes e
  a regra de alcance dela.

### Modified Capabilities

- `permissoes-granulares`: o requisito "Gestão de concessões restrita à
  administração" passa a dizer que a restrição a `unit_admin`/`global_admin`
  vale para os endpoints que **administram** as concessões de um recurso —
  conceder, listar as de um recurso, revogar —, e que **ler as próprias
  concessões recebidas** é operação auto-escopada, disponível a qualquer papel
  autenticado, sem alcance sobre concessão de terceiro.
- `web-shell-e-auth`: o conjunto de destinos internos da navegação deixa de ser
  "tela inicial, documentos, recentes e lixeira" e passa a incluir
  **compartilhados comigo**, oferecido a qualquer papel.

## Impact

**Banco** — **nenhuma migração.** A consulta usa as colunas e o índice de
`0007_grants.sql` e a coluna `expires_at` de
`0013_grant_expiration_and_notifications.sql`.

**Contratos (`packages/shared`)** — DTO da resposta da listagem: tipo do recurso,
identificador, nome, nome da pasta que o contém, conjunto de verbos, vencimento
quando houver, e os dados de controle do documento já existentes para a linha de
arquivo.

**API** — `routes/grants.ts` ganha a rota auto-escopada; a consulta reúne
`grants`, `files` e `folders` com a vigência avaliada no SQL e a composição das
regras restritivas (obsoleto, pendente de cadastro, lixeira) pela mesma via que
a listagem de pasta já usa. Sem prefixo novo: `/grants` já está nas três listas.

**SPA** — `compartilhados/` (novo: página e consulta), `shell/AppShell.tsx` (o
item entra no grupo NAVEGAÇÃO, e o comentário que registra a lacuna da A5 sai),
`app/router.tsx` (rota `/compartilhados`), `lib/schemas.ts` (fronteira Zod).
O arquivo abre no `PreviewModal` que a busca já usa; a pasta navega para
`/pastas/:id`.

**Testes** — a listagem é regra de alcance, então entra no mesmo nível dos
testes de isolamento: concessão expirada, recurso na lixeira, documento
obsoleto, arquivo pendente de cadastro, recurso de outra unidade (inclusive para
`global_admin`), recurso próprio e agregação de verbos.

**Manual do usuário** — `docs/manual/` ganha a página do destino, no perfil do
colaborador; a página do menu lateral passa a listar o item.

**PRD** — **US 4.4 nova, no Épico 4** (Controle de Acesso e Permissões
Granulares), não no Épico 11 como a seção A5 do plano supõe: o que a fatia
entrega é a contrapartida da concessão granular, não orientação da tela inicial.
Os cenários cobrem a listagem, a exclusão do expirado, o que a lista não revela
e a perda de acesso.

**Plano** — `docs/plano_demanda_cliente_2.md`: linha A5 da tabela de status, a
correção da classificação de "reentrada de escopo" e o registro de que a forma
da listagem plana ficou fixada aqui, para consumo da A4.
