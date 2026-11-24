# Proposal

## Why

Pedido real do cliente: a pasta **Governança** é da unidade **SEDE**, mas
as demais unidades precisam vê-la. A Administradora Global (Ana Morais)
concedeu `view` sobre a pasta a uma pessoa de outra unidade (Raíra
Damasceno), e a Raíra não consegue abri-la.

O sistema aceitou a concessão sem efeito. `POST /grants` valida a pessoa
destinatária sob o bypass de RLS do `global_admin`, que enxerga gente de
todas as unidades, e grava a linha com o `unit_id` do recurso (SEDE). Já a
Raíra trabalha no contexto da própria unidade: a RLS esconde dela tanto a
linha de `grants` quanto a pasta. Pior, a tela de permissões mostra a Raíra
como alguém com acesso. Isso é coerente com o PRD vigente, que põe
"Compartilhamento de arquivos entre unidades diferentes" **fora de escopo**
(§3) e exige "isolamento total de conteúdo entre unidades" (RF 6, NFR de
privacidade). A falha é que o isolamento não avisou que recusava a
concessão.

A mudança de regra pedida é uma **exceção controlada** ao isolamento:

- a SEDE compartilha pastas e documentos com as demais unidades;
- no sentido inverso, uma unidade compartilha pastas e documentos com a
  SEDE.

Decisões confirmadas com o solicitante antes deste change:

1. **Destinatário:** uma pessoa de outra unidade **ou** uma unidade
   inteira. A unidade inteira inclui quem for cadastrado nela depois.
2. **Quem concede:** o Administrador Global **e** o Administrador da
   unidade de origem. Cada um compartilha conteúdo da própria unidade.
3. **Sentido:** toda concessão tem a **SEDE** numa das pontas.
   Unidade↔unidade continua isolada. A SEDE passa a ser uma marcação
   explícita de unidade.
4. **Pasta inclui a subárvore:** compartilhar uma pasta com outra unidade
   vale para todo o conteúdo dela, inclusive o que entrar depois. É uma
   exceção explícita, e restrita a este mecanismo, à regra "sem herança"
   da US 4.1. A concessão comum dentro da unidade não muda.
5. **Só leitura:** somente `view` e `download`. Enviar, renomear e excluir
   na outra unidade ficam fora.

## What Changes

**PRD (`docs/prd_final.md`)**: é a fonte da verdade, então muda primeiro.

- §3 Escopo: sai de "Fora de Escopo" o item "Compartilhamento de arquivos
  entre unidades diferentes". Entra em "Dentro do Escopo" o
  "Compartilhamento somente leitura entre a SEDE e as demais unidades".
- Nova **US 5.2**, no Épico 5, com o texto abaixo.
- RF 6 passa a ressalvar o compartilhamento entre unidades vigente. Entra o
  RF 28. O NFR "Privacidade entre unidades" ganha a ressalva "salvo
  compartilhamento explícito, somente leitura, envolvendo a SEDE".

> **US 5.2:** Como Administrador (Global, ou da unidade dona do conteúdo),
> eu quero compartilhar pastas e documentos entre a SEDE e as demais
> unidades, para que material institucional circule sem quebrar o
> isolamento do restante do acervo.
>
> * *Cenário 1: SEDE compartilha pasta com uma unidade:*
>   **Dado** que a pasta Governança é da SEDE, **Quando** a compartilho
>   com a Unidade Norte para visualizar, **Então** qualquer pessoa da
>   Unidade Norte, inclusive quem for cadastrado depois, abre a pasta e
>   tudo o que há dentro dela, inclusive o que entrar depois, sem poder
>   enviar, renomear ou excluir.
> * *Cenário 2: Compartilhamento com uma pessoa:*
>   **Dado** que compartilhei a pasta Governança com uma pessoa de outra
>   unidade, **Quando** ela abre "Compartilhados comigo", **Então** a pasta
>   aparece, identificada como vinda da SEDE, e abre normalmente.
> * *Cenário 3: Unidade compartilha com a SEDE:*
>   **Dado** que sou administrador de uma unidade, **Quando** compartilho
>   um documento dela com a SEDE, **Então** a SEDE passa a alcançá-lo, e eu
>   não consigo compartilhá-lo com nenhuma outra unidade.
> * *Cenário 4: Fora do compartilhamento nada muda:*
>   **Dado** um compartilhamento vigente, **Quando** uma pessoa da unidade
>   de destino navega, busca ou usa link direto para qualquer item fora do
>   que foi compartilhado, **Então** é recusada como se o item não
>   existisse.
> * *Cenário 5: Regras restritivas continuam valendo:*
>   **Dado** que um documento dentro da pasta compartilhada está obsoleto,
>   pendente de cadastro ou na lixeira, **Quando** alguém da unidade de
>   destino tenta alcançá-lo, **Então** é recusado como se o documento não
>   existisse.
> * *Cenário 6: Prazo e revogação:*
>   **Dado** que o compartilhamento tem prazo ou foi revogado, **Quando** o
>   prazo vence ou a revogação acontece, **Então** o acesso termina na
>   requisição seguinte.
> * *Cenário 7: Auditoria na origem:*
>   **Dado** que uma pessoa de outra unidade visualizou ou baixou um
>   arquivo compartilhado, **Quando** o dono ou o administrador da unidade
>   de origem consulta a auditoria do arquivo, **Então** o acesso aparece
>   com o nome da pessoa e a unidade dela.
> * *Cenário 8: Concessão comum não atravessa unidades:*
>   **Dado** que tento conceder uma permissão comum a uma pessoa de outra
>   unidade, **Quando** confirmo, **Então** sou recusado e orientado a usar
>   o compartilhamento entre unidades, em vez de ver uma concessão sem
>   efeito.

**Banco**

- `units.is_headquarters`, com no máximo uma unidade marcada (índice único
  parcial). A policy de `units` passa a deixar a linha da SEDE legível por
  todas as unidades.
- Nova tabela `cross_unit_grants`, com `unit_id` de origem, unidade de
  destino, pessoa de destino opcional, verbo (`view`/`download`), prazo
  opcional e autor. RLS própria: a origem gere, e o destino lê só o que lhe
  diz respeito.
- `withTenantTransaction` passa a publicar também `app.current_user_id`, que a
  policy nova usa.
- `audit_events` ganha um retrato do nome de quem acessou e da unidade dele
  (`actor_name`, `actor_unit_name`), preenchido só em acesso entre
  unidades.
- Migração de dados: as concessões comuns sem efeito (pessoa de outra
  unidade) com `view`/`download` viram `cross_unit_grants` por pessoa. As
  demais são removidas de `grants`. Ver design.md D10.

**API**

- `POST /grants` passa a recusar com **422 `cross_unit_subject`** quando a
  pessoa é de unidade diferente da do recurso. Isso corrige a raiz do caso
  da Raíra.
- Novas rotas sob o prefixo já existente `/grants`, sem prefixo de topo
  novo: `POST/GET /grants/cross-unit`, `DELETE /grants/cross-unit/:id`,
  `GET /grants/cross-unit/destinations` e
  `GET /grants/cross-unit/recipients`.
- Nova resolução `lib/cross-unit-share.ts`. Ela é o **segundo caminho** de
  acesso, tentado só quando `hasAccess` nega, e abre uma **transação de
  visita** na unidade de origem (design.md D3).
- `POST /files/:id/view-url`, `POST /files/:id/download-url` e
  `GET /folders/:id/contents` aceitam o caminho de visita. A listagem em
  visita é somente leitura, e a trilha começa na raiz do compartilhamento.
- `GET /grants/received` inclui os itens recebidos de outra unidade, com o
  nome da unidade de origem.
- `PATCH /units/:id` aceita marcar e desmarcar a SEDE (só
  `global_admin`).
- A auditoria do arquivo passa a usar `LEFT JOIN users` e o retrato do
  nome, para que o acesso entre unidades não suma da consulta.

**Web**

- Unidades: marcação "SEDE" na lista e no formulário (só para o
  Administrador Global).
- Modal de permissões: nova seção **"Compartilhar com outra unidade"**,
  para unidade inteira ou pessoas, `view`/`download` e prazo opcional. A
  seção lista e revoga os compartilhamentos do recurso e avisa, para pasta,
  que o conteúdo interno entra junto. A seleção de pessoas da concessão
  comum fica restrita à unidade do recurso.
- Compartilhados comigo: itens de outra unidade com a etiqueta "da
  unidade X".
- Explorador: pasta de outra unidade abre em modo somente leitura, com
  trilha a partir da raiz compartilhada e sem envio, renomeação, exclusão,
  permissões ou favorito.

**Documentação**: o manual ganha atualizações em `administrador/permissoes.md`,
`administrador/unidades.md`, `administrador/auditoria.md` e
`colaborador/compartilhados-comigo.md`.

## Capabilities

### New Capabilities

- `compartilhamento-entre-unidades`: modelo, regras de concessão,
  resolução de acesso por subárvore, transação de visita, vigência,
  revogação e auditoria do compartilhamento somente leitura envolvendo a
  SEDE.

### Modified Capabilities

- `isolamento-unidade`: o colaborador nunca enxerga outra unidade, salvo
  compartilhamento entre unidades vigente.
- `permissoes-granulares`: a concessão comum fica restrita a pessoas da
  unidade do recurso (422 `cross_unit_subject`).
- `gestao-unidades`: marcação da unidade SEDE.
- `compartilhados-comigo`: itens recebidos de outra unidade.
- `auditoria`: acesso entre unidades registrado na origem, com nome e
  unidade de quem acessou.
- `web-permissoes`: seção de compartilhamento entre unidades no modal.
- `web-unidades`: marcação SEDE na tela de unidades.
- `web-navegacao`: navegação somente leitura em pasta de outra unidade.

## Impact

- `apps/api/src/db/migrations/0026_cross_unit_grants.sql` (nova).
- `apps/api/src/adapters/pg-database-port.ts` e
  `apps/api/src/ports/database-port.ts` (`app.current_user_id`,
  `withSharedVisitTransaction`).
- `apps/api/src/lib/cross-unit-share.ts` (nova) e
  `apps/api/src/lib/access.ts` (comentário de rastro, sem ramo novo).
- `apps/api/src/routes/grants.ts`, `files.ts`, `folders.ts`, `units.ts` e
  `audit.ts`.
- `packages/shared`: DTOs `CrossUnitGrant*`, campo `isHeadquarters` em
  unidade, `originUnit` em compartilhado comigo e `readOnly`/`sharedFrom`
  no conteúdo de pasta.
- `apps/web/src/permissoes/`, `unidades/`, `compartilhados/` e
  `navegacao/`.
- Testes novos, entre eles `compartilhamento-entre-unidades.test.ts`. Os
  testes de isolamento existentes seguem verdes, sem afrouxamento.
- PRD e manual.
- Infra: nenhum recurso de nuvem novo e nenhum prefixo de topo novo. As
  listas `API_PREFIXES`, `API_PROXY_PREFIXES` e `api_proxy_prefixes` não
  mudam.

## Fora de escopo

- Compartilhamento entre duas unidades que não sejam a SEDE.
- Verbos de escrita entre unidades (enviar, renomear/substituir, excluir).
- Conteúdo compartilhado entre unidades em **busca**, **recentes**, **tela
  inicial**, **favoritos**, **painel** e **download de pasta (.zip)**. Ele
  é alcançado por "Compartilhados comigo" e pela navegação a partir dali.
  Cada um desses pode vir num change próprio.
- Avisos (notificações) de novo compartilhamento entre unidades e de
  vencimento do prazo dele. O job `notify-expiring-grants` continua só
  sobre `grants`.
- Leitura obrigatória com público em outra unidade.
- Administrador Global compartilhando conteúdo de unidade diferente da
  própria. A trava do bypass continua: cada administrador compartilha o que
  já alcança como administrador.
