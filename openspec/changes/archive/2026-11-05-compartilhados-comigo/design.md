# Design

## Context

Ver `proposal.md` — Why. O que molda a implementação é o que já existe:

- **`grants` basta.** `0007_grants.sql` dá `unit_id` (com policy RLS e `FORCE ROW
  LEVEL SECURITY`), `subject_user_id`, `resource_type`, `resource_id`,
  `permission`, `granted_by`, `created_at`, índice
  `(subject_user_id, resource_type, permission)`; `0013` acrescenta `expires_at`
  e o seu índice parcial. Nada a migrar.
- **A concessão é por verbo.** `view` e `download` sobre o mesmo arquivo são duas
  linhas, garantidas distintas pelo índice único
  `(unit_id, subject_user_id, resource_type, resource_id, permission)`.
- **Há fragmentos SQL de alcance prontos em `lib/access.ts`** —
  `resourceScopeClause` e `visibleResourceClause` — e **eles não servem a esta
  tela**. Ver Decisão D1: é a descoberta que mais afeta o desenho.
- **As regras restritivas já são fragmentos compostáveis**
  (`lib/document-control.ts`: cláusula do obsoleto e cláusula do pendente de
  cadastro), desenhadas para se somarem ao alcance sem o ampliar.
- **A SPA já tem a forma de lista plana**: `BuscaPage` lista arquivos em
  profundidade arbitrária e os abre no `PreviewModal`, sem navegar a árvore.

## Goals / Non-Goals

**Goals:**

- Uma consulta, uma resposta, um item por recurso — a tela não compõe domínio.
- Reusar os fragmentos de regra restritiva em vez de reescrevê-los: o quarto
  caminho do pendente e o quarto do obsoleto nascem da mesma cláusula que os
  outros três, não de uma cópia.
- Fixar a forma da **listagem plana de recursos em profundidade arbitrária** —
  localização, acionamento, perda de alcance — para a A4 consumir.

**Non-Goals:**

- Paginação e filtros. A lista é delimitada pelo que a administração concedeu a
  uma pessoa; acrescentá-los depois é aditivo (ver Riscos).
- Qualquer escrita. Nenhuma rota de mutação, nenhum estado por pessoa.
- Corrigir a trilha de navegação do explorador (ver D7, lacuna conhecida).

## Decisions

### D1 — A lista parte da **concessão**, não do alcance

`resourceScopeClause` (`lib/access.ts:218`) devolve, para quem é administrador da
unidade da listagem, **`TRUE`** (ou `unit_id = '<ctx.unitId>'` para o
`global_admin`): o alcance do admin é a unidade inteira, e é correto que seja,
porque é o que a listagem de pasta precisa. Reusá-lo aqui apresentaria **todo o
acervo da unidade** ao `unit_admin` sob o título "Compartilhados comigo" — uma
afirmação falsa sobre a origem do acesso, e uma lista inútil justamente para quem
mais a consultaria.

A base da consulta é, portanto, `grants` filtrada por `subject_user_id = $me` e
vigência, com `files`/`folders` entrando por junção. O papel de quem consulta
**não** amplia a lista; amplia apenas o que as regras restritivas lhe permitem
ver dentro dela (um `unit_admin` enxerga o pendente e o obsoleto que lhe foram
concedidos, um `collaborator` não).

*Alternativa descartada:* reusar `visibleResourceClause` e filtrar os
não-concedidos depois, na SPA ou num segundo passo. Esconderia um furo de alcance
atrás de um filtro de apresentação — exatamente o padrão que o `CLAUDE.md`
proíbe, já que a SPA nunca é linha de defesa. A direção correta é a inversa: a
concessão **seleciona** e `hasAccess` apenas **confirma** (ver D2), de modo que
nenhum caminho desta rota consegue conceder alcance.

### D2 — As regras restritivas entram por `hasAccess`, item a item

Não por cláusula SQL reescrita. `GET /files/recent` já resolveu este problema e
o registrou como decisão (`shell-e-inicio`, design.md D2): *"nenhuma segunda
expressão da regra de acesso"* — um `JOIN` com `grants` montado na rota seria
mais rápido e criaria uma segunda expressão, e **duas expressões divergem, com
vazamento como sintoma em vez de erro**.

`hasAccess` já encerra, num só lugar, tudo o que esta lista precisa compor:
`deleted_at IS NULL`, a subtração do obsoleto, a subtração do pendente de
cadastro (preservando o remetente) e a trava do bypass do `global_admin` por
`isAdminOfUnit(ctx, resource.unit_id)`.

**Uma chamada por recurso, não por verbo.** As regras restritivas são
propriedade do **recurso**, não do verbo. Passando um verbo que a pessoa
comprovadamente tem — o candidato veio de uma concessão vigente dele —,
`hasAccess` reduz-se exatamente à composição restritiva: o ramo da concessão
já é verdadeiro por construção, então o que resta avaliar é só a subtração.
Chamar por (recurso × verbo) multiplicaria consultas para reavaliar sempre a
mesma condição.

*Alternativa descartada:* reusar `nonObsoleteClause` e `visibleRegistrationClause`
como fragmentos na consulta nova. É reúso, não cópia, e seria defensável — mas
ainda assim é uma **segunda montagem** da composição, e a rota nova seria o
quinto lugar onde a ordem de composição precisa estar certa. `hasAccess` é o
primeiro.

### D3 — Rota `GET /grants/received`, sob o prefixo que já existe

`/grants` já está nas três listas de prefixo (`lib/api-prefixes.ts`,
`apps/web/vite.config.ts`, `infra/terraform/locals.tf`), então o invariante 7 do
plano não é tocado. O caminho é **em inglês**, como todos os demais do
repositório (`/files/recent`, `/files/search`, `/trash/purge`): a convenção é
pt_BR na prosa e na interface, inglês nos identificadores — e um caminho em
português seria o único. A rota passa por `attachTenantContext` como as demais, e
é a primeira de `/grants` aberta a `collaborator` — daí a modificação de
requisito em `permissoes-granulares`, que agora distingue **administrar as
concessões de um recurso** de **ler as próprias**.

*Alternativas descartadas:* `/compartilhados` como prefixo de topo — custo nas
três listas e no url-map do Terraform, sem ganho; `/files/shared` — mentiria
sobre o conteúdo, que inclui pastas.

### D3b — A consulta de candidatos compara `unit_id` explicitamente

A RLS de `grants` já trava as linhas à unidade para todo papel **exceto**
`global_admin`, cujo bypass é incondicional. A consulta de candidatos compara
`unit_id = $ctx.unitId` do mesmo modo que `listCandidates` em `recent.ts`, para
que a lista não dependa de `hasAccess` como única guarda cross-unit. Duas
guardas, de propósito — o mesmo arranjo que `recent.ts` documenta.

### D4 — Duas leituras de detalhe, não um `UNION ALL`

Depois do filtro, os sobreviventes são lidos em duas consultas — uma de pastas,
uma de arquivos. Não em `UNION ALL`, por duas razões concretas: `fileSummaryColumns`
projeta colunas **sem qualificação** (é o fragmento das consultas de uma só
tabela), e as duas pernas têm formas diferentes, de modo que a união exigiria
`NULL` tipado para cada coluna ausente do outro lado. A perna de arquivo reusa
`fileSummaryColumns` + `toFileSummaryResponse` — os mesmos da listagem de pasta,
da busca e dos recentes —, e com isso a linha de arquivo nasce com tipo, código
e situação, e serve **diretamente** ao `PreviewModal`, cuja propriedade é
`FileSummaryResponse`.

### D5 — A agregação por recurso acontece onde a lista de candidatos já vive

As concessões vigentes são lidas, agrupadas por recurso e ordenadas no servidor,
em JavaScript, sobre a lista que o laço de `hasAccess` já percorre — mesma forma
de `recent.ts`, que filtra em JS e reordena pela ordem dos candidatos, não pela
que a segunda leitura devolveu. O que **não** pode acontecer é a agregação na
SPA: a fronteira Zod existe para validar forma, não para derivar comportamento.

**Os verbos vão com o seu próprio prazo.** A resposta leva, por item, o par
(verbo, vencimento), não um vencimento do item. Conceder vários verbos numa só
operação dá a todos o mesmo prazo, mas `permissoes-granulares` permite
reconceder um subconjunto com prazo diferente — e aí um "vencimento do item"
teria de escolher entre mentir (o mais próximo, como se tudo vencesse junto) ou
omitir. O par é lossless e a tela apresenta o prazo junto do verbo a que ele
pertence.

### D6 — Vigência e ordenação no relógio do Postgres

`expires_at IS NULL OR expires_at > now()` dentro do SQL, como em
`resourceScopeClause`. Nunca `Date.now()` do processo Node — invariante 4 do
plano, e é o que faz a concessão vencida sair da lista na requisição seguinte sem
depender de rotina.

### D7 — A localização é a pasta que contém o item, não a cadeia

A resposta devolve o nome da pasta-mãe, pelo precedente de `GET /files/recent`
(que devolve `folderName`). **Não** devolve trilha: `buildBreadcrumb`
(`routes/folders.ts:71`) sobe os pais **sem checar acesso** em nenhum deles, de
modo que uma trilha completa nomearia pastas que a pessoa não alcança — e, sem
herança, o recurso concedido está frequentemente sob pastas assim.

**Lacuna conhecida, aceita:** o explorador continua exibindo a trilha integral ao
abrir uma pasta concedida em profundidade. É comportamento **pré-existente**,
alcançável hoje por quem digita o endereço, e corrigi-lo é mudança de requisito
em `web-navegacao`/`navegacao` com efeito sobre a navegação de todos — fatia
própria, não passageira desta. Esta change apenas **não amplia** a exposição: a
lista que torna esses recursos fáceis de alcançar não acrescenta nome de
ancestral nenhum.

### D8 — O que é da própria pessoa sai no SQL

`owner_id <> $me` na consulta, não na apresentação. Concessão sobre recurso
próprio é inerte na resolução de acesso (dono vence antes de qualquer grant);
listá-la afirmaria que o acesso vem de compartilhamento.

### D9 — A resposta devolve os verbos, e a SPA oferece só o que veio

Mesmo padrão do botão de envio da barra superior (change
`menu-lateral-e-barra-superior`): a SPA não antecipa veredito, apresenta o que o
servidor autorizou. Uma concessão só de `download` existe — `permissoes-granulares`
permite conceder um único verbo — e um item que oferecesse "visualizar" nesse caso
conduziria a recusa.

### D10 — Nenhuma auditoria na listagem

Auditoria registra acesso a **bytes**. A listagem não serve bytes; o
`view-url`/`download-url` acionado a partir do item continua auditando
separadamente, como em qualquer outro caminho. Invariante 5 do plano.

### D11 — Capability única, cobrindo servidor e apresentação

Precedente de `tela-inicial`, que declara no mesmo lugar a lista de recentes e a
regra de alcance dela, em vez de partir em `recentes` + `web-recentes`. A fatia é
uma consulta e uma tela; partir em duas capabilities faria o requisito de alcance
viver longe do requisito que o produz.

## Risks / Trade-offs

- **Reusar `visibleResourceClause` por engano entrega a unidade inteira ao
  `unit_admin`** → D1 é a decisão explícita contra isso, e o caso entra como
  teste: administrador de unidade com **uma** concessão recebida vê **um** item,
  não o acervo da unidade. É o teste que mais importa desta fatia.
- **Lista sem paginação cresce sem teto** → o tamanho é ditado pela
  administração, que concede nominalmente (com teto de destinatários por
  requisição). Paginação e filtros são aditivos e não mudam nenhum requisito
  desta spec. Se incomodar, entra depois.
- **As regras restritivas chegam por composição, não por leitura local** → quem
  ler a consulta de candidatos não vê o filtro do obsoleto nem o do pendente, e
  pode concluir que faltam. Cada um entra como caso de teste próprio, no nível
  dos testes de isolamento; `--strict` não pega furo de alcance, teste pega.
- **Uma consulta por recurso no laço de `hasAccess`** → é o custo que
  `recent.ts` já aceita pela mesma razão, e aqui o conjunto é delimitado pela
  concessão nominal, não por uma janela de auditoria. Se um dia incomodar, o
  caminho é otimizar `hasAccess` para um lote, uma vez, para todas as rotas —
  não reescrever a composição nesta.
- **A trilha do explorador continua nomeando ancestrais inalcançáveis** → ver
  D7: pré-existente, não ampliado aqui, registrado como fatia futura para não se
  perder.

## Migration Plan

Nenhuma migração de banco, nenhuma mudança de contrato existente, nenhuma
alteração de prefixo de rota. A change é **aditiva**: uma rota de leitura nova,
um destino de menu novo, um requisito de `permissoes-granulares` que passa a
distinguir dois alcances que o código já tratava de formas distintas. Reverter é
retirar a rota e o item de menu; nada do que existe depende do que entra.

## Open Questions

- **Mostrar quem compartilhou.** `grants.granted_by` existe e a resposta poderia
  carregá-lo. A proposta deixa fora porque conceder é ato da administração e a
  informação útil a quem recebeu é *o que* e *até quando*. Acrescentar depois é
  aditivo e não altera spec de alcance — só a homologação com o cliente diz se
  faz falta.
