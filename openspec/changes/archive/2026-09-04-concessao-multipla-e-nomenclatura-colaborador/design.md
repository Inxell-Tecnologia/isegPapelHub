# Design — concessao-multipla-e-nomenclatura-colaborador

## Context

Ver proposal.md — Why. O que condiciona o desenho é o estado atual dos dois
pontos tocados:

**Concessão.** `grants` já é modelada como **uma linha por (unidade, sujeito,
tipo de recurso, recurso, verbo)**, com índice único sobre essa quíntupla —
`ON CONFLICT (unit_id, subject_user_id, resource_type, resource_id, permission)
DO UPDATE` (change `expiracao-permissoes`, D3). Conceder a N colaboradores já é,
no banco, exatamente o que conceder N vezes a um: **não há esquema novo, não há
migração**. `POST /grants` roda inteiro dentro de `withTenantTransaction` — logo
a atomicidade de N×M concessões é a atomicidade que a transação já dá, de graça.
O que muda é a forma do pedido e a superfície de validação.

Três invariantes herdados e não renegociados nesta change:

1. **Fail-closed sem vazar existência.** A rota devolve `404` indistinguível
   para recurso e para sujeito inexistente ou de outra unidade (design.md D5 de
   `permissoes-granulares`: "sem vazar existência"). Com N sujeitos, isso vira
   uma exigência mais forte, não mais fraca — ver D3.
2. **RLS por `unit_id`, `SET LOCAL` por transação.** Nenhuma consulta nova sai
   de `withTenantTransaction`; a `unit_id` gravada continua vindo do **recurso**,
   nunca do contexto do chamador.
3. **Notificação é efeito colateral.** Emitida após o commit, fora da transação,
   falha registrada e descartada (`expiracao-permissoes` D8), idempotente por
   `(recipientUserId, kind, sourceRef)`.

**Nomenclatura.** "Servidor" no sentido de pessoa **não existe** no código —
todas as ~35 ocorrências de "servidor" em `apps/web/src` são o backend, em
comentário. O termo real a trocar é "Pessoa"/"Pessoas", presente em ~20 literais
de interface e em 13 páginas do manual. O papel `collaborator` já se chama
"Colaborador" na UI (`ROLE_LABEL`), e essa colisão é aceita por decisão do
cliente (ver D7).

## Goals / Non-Goals

**Goals:**

- Uma requisição, uma transação, um resultado observável para "libere estes
  verbos para estas pessoas".
- Não afrouxar o fail-closed ao multiplicar destinatários: N sujeitos não podem
  virar um oráculo de existência de contas.
- Trocar o vocabulário sem tocar em rota, contrato, esquema ou identificador —
  a troca é de apresentação e tem que ser reversível por texto.

**Non-Goals:**

- Recuperar-se parcialmente de um destinatário inválido (D3 decide o contrário,
  de propósito).
- Auditar a concessão: `grants` nunca gerou evento em `audit_events` e esta
  change não abre esse assunto.
- Compatibilidade retroativa do corpo de `POST /grants` (D1).

## Decisions

### D1 — `subjectUserIds: string[]` substitui `subjectUserId`, sem período de convivência

`CreateGrantRequest.subjectUserId: string` vira `subjectUserIds: string[]`, com
1..N elementos. **Breaking, e assumido como tal**: os únicos consumidores são
`apps/web/src/permissoes/queries.ts` e os testes, todos neste repositório, e a
API não é publicada a terceiro algum.

*Alternativa considerada — aceitar os dois campos* (`subjectUserId` opcional,
`subjectUserIds` opcional, ao menos um presente): rejeitada. Dobraria os caminhos
de validação numa rota cuja qualidade depende justamente de a validação ser
única e fechada, e deixaria dois formatos vivos indefinidamente por um ganho
(compatibilidade) que ninguém consome.

*Alternativa considerada — manter a rota singular e deixar a SPA emitir N
chamadas*: rejeitada. Perde a atomicidade (uma falha no meio deixa metade da
turma com acesso e metade sem, sem sinal para o administrador), multiplica por N
o custo de rede e de transação, e transfere para o cliente uma responsabilidade
que a regra de acesso mantém no servidor.

### D2 — Produto colaboradores × verbos num único `INSERT ... SELECT` sobre `unnest`

Dentro da transação já existente, o upsert passa de laço sobre verbos para uma
única instrução:

```
INSERT INTO grants (unit_id, subject_user_id, resource_type, resource_id, permission, granted_by, expires_at)
SELECT $1, s.subject, $2, $3, p.permission, $4, $5
  FROM unnest($6::uuid[]) AS s(subject)
 CROSS JOIN unnest($7::text[]) AS p(permission)
ON CONFLICT (...) DO UPDATE SET expires_at = EXCLUDED.expires_at, granted_by = EXCLUDED.granted_by, created_at = now()
RETURNING *, <coluna de vigência>
```

Uma ida ao banco em vez de N×M, e a semântica de reconcessão (D3 de
`expiracao-permissoes`: o prazo informado prevalece; sem prazo, torna permanente)
fica **literalmente** a mesma cláusula — não é reescrita, é reusada.

`CROSS JOIN` sobre `unnest` exige que os ids cheguem **deduplicados**: o mesmo
sujeito duas vezes no array produziria duas linhas conflitantes no mesmo comando,
o que o Postgres recusa (`ON CONFLICT DO UPDATE command cannot affect row a
second time`). A dedup é feita na validação de entrada (D3), antes de qualquer
consulta — o que também torna o teto de D4 um teto de destinatários **distintos**.

*Alternativa considerada — laço aninhado em JavaScript*: mais próximo do código
atual e mais fácil de ler, mas N×M round-trips numa transação aberta; com o teto
de D4 isso chega a 250 idas ao banco para uma operação que o Postgres resolve em
uma. A dedup seria necessária de qualquer forma, pelo teto.

### D3 — Validação em duas fases: forma, depois existência — e recusa **integral**

Ordem obrigatória, toda ela antes de qualquer escrita:

1. **Forma** (`400`): `subjectUserIds` presente, array, não vazio, todos strings;
   `resourceType` do enum; `resourceId` presente; `permissions` array não vazio
   de verbos do enum; `expiresAt` ausente/nulo ou data **futura** válida.
2. **Dedup** dos `subjectUserIds`, preservando a ordem de chegada.
3. **Teto** (`413`, D4), aplicado sobre o conjunto já deduplicado.
4. **Existência**, dentro da transação: o recurso, por `SELECT unit_id FROM
   <tabela do recurso> WHERE id = $1`; os sujeitos, por **uma** consulta
   `SELECT id FROM users WHERE id = ANY($1)`, comparando a **cardinalidade** do
   resultado com a do conjunto deduplicado.

Se a cardinalidade não bate, a requisição é recusada **inteira** com `404 not
found` — sem efetivar nenhuma concessão e **sem dizer qual** id falhou. Essa é a
decisão de segurança central desta change: recusa parcial (conceder aos válidos e
relatar os inválidos) transformaria a rota num oráculo de existência de contas —
o administrador de uma unidade poderia sondar UUIDs e distinguir "não existe" de
"é de outra unidade" pela composição da resposta, exatamente o que o `404`
indistinguível de hoje impede. A RLS já esconde o usuário de outra unidade da
consulta, então "de outra unidade" e "inexistente" chegam aqui idênticos, e assim
permanecem na resposta.

*Alternativa considerada — sucesso parcial com relatório de falhas*: rejeitada
pelo motivo acima, e porque o caso real (o administrador escolhe nomes numa lista
que o próprio servidor lhe deu) torna o id inválido uma anomalia, não um fluxo.

### D4 — Teto de destinatários no molde do manifesto de download

`config.grants.maxSubjects` (env `GRANTS_MAX_SUBJECTS`, padrão **50**), no mesmo
formato de `config.downloadManifest`. Exceder devolve **`413`** com
`{ error: 'grant_subjects_limit_exceeded', found, allowed }` — mesmo status,
mesma forma de corpo e mesmo tipo em `packages/shared` que
`download_manifest_limit_exceeded`, para a SPA distinguir a recusa por
`ApiError.details` (que já carrega o corpo inteiro, por decisão de
`download-pasta-zip` D5) em vez de por texto de mensagem.

Por que um teto existe: o custo por destinatário é pequeno mas não nulo (uma
linha, e uma notificação de rede quando há prazo), e sem teto uma requisição com
milhares de ids mantém a transação aberta e dispara milhares de notificações. 50
é o tamanho de uma equipe grande — folgado para o caso real, longe do abuso.

### D5 — Notificação: um aviso por destinatário, falhas isoladas

Após o commit, laço sobre os destinatários, **cada um em seu próprio
`try/catch`**: falha ao avisar um não pode impedir os outros nem a resposta de
sucesso. A fórmula do `sourceRef` — `grant:{resourceType}:{resourceId}:{expiresAt}`
— **não muda**: a idempotência do `NotificationPort` já é por
`(recipientUserId, kind, sourceRef)`, ou seja, já é por destinatário. Repetir a
concessão para uma turma parcialmente nova avisa exatamente os novos.

*Alternativa considerada — um único aviso "coletivo"*: não existe destinatário
coletivo no modelo (`notifications.recipient_user_id` é uma pessoa), e a
notificação é justamente o que informa **àquele** colaborador que ele ganhou
acesso com prazo.

### D6 — SPA: seletor múltiplo e prévia por colaborador selecionado

`Select` com `mode="multiple"`, `showSearch` e `optionFilterProp="label"` — a
mesma fonte de opções (`useAuthorOptions` → `GET /users`) e o mesmo tratamento de
falha de carga já existentes. `maxTagCount="responsive"` para que uma seleção
grande não empurre o diálogo além da largura em telas estreitas (capability
`web-responsividade`).

A prévia "prazo atual" muda de uma linha para um bloco **por colaborador
selecionado que já tenha concessão** no recurso — os selecionados sem concessão
prévia não geram linha, para a prévia não virar ruído numa seleção de dezenas.
O propósito original (D3 de `expiracao-permissoes`: quem concede precisa ver o
que já existe antes de decidir deixar o prazo em branco, que torna permanente)
se preserva e passa a valer para cada destinatário.

O aviso de teto excedido é reconhecido por `details.error ===
'grant_subjects_limit_exceeded'` e orienta a reduzir a seleção; qualquer outra
recusa mantém a mensagem neutra de hoje, que não distingue `403` de `404` (Risks
do change `web-permissoes`).

### D7 — "Colaborador" para a entidade **e** para o papel, sem desambiguar

Decisão do cliente, tomada com o conflito na mesa: a entidade passa a ser
"Colaborador" e o papel `collaborator` **continua** rotulado "Colaborador". A
tela de gestão fica com "Novo colaborador" e uma coluna "Papel" cujo primeiro
valor é "Colaborador".

*Alternativas apresentadas e recusadas pelo cliente*: rotular o papel como
"Colaborador comum"/"Padrão", ou como "Sem privilégios administrativos". Ambas
removeriam a ambiguidade ao custo de introduzir um termo que o cliente não usa.
Registro aqui para que a colisão seja lida como escolha e não como descuido; a
desambiguação segue disponível como mudança futura de uma linha em `ROLE_LABEL`.

### D8 — A troca é de literais, e nada mais

Nenhum arquivo, pasta, componente, rota, capability, tabela ou campo é renomeado
(proposal.md, fora de escopo). Consequência prática: `apps/web/src/pessoas/` segue
`pessoas/`, `PessoasPage` segue `PessoasPage`, `/admin/pessoas` segue respondendo,
e as specs `web-pessoas`/`gestao-pessoas` seguem com esses nomes. O acoplamento
entre nome de código e texto de tela é assumido — é o preço de manter links,
histórico de specs e diff sob controle, e é a razão de a nova capability
`nomenclatura-interface` declarar explicitamente essa fronteira, em vez de
deixá-la implícita.

Para as **specs existentes** que usam "pessoa" como vocabulário de domínio em
prosa (`web-pessoas`, `gestao-pessoas`, `web-painel`, `web-auditoria`,
`notificacoes`, entre outras): não são reescritas. Elas descrevem comportamento,
não o literal da tela; quem passa a normatizar o literal é
`nomenclatura-interface`. As duas exceções são os deltas desta change, onde o
texto foi tocado porque o **comportamento** mudou junto.

### D9 — Verificação da nomenclatura por teste de tela, não por varredura de repositório

Cada tela tocada ganha, no teste que já a cobre, uma asserção de **ausência** de
"Pessoa"/"Pessoas"/"Servidor" no documento renderizado, além das âncoras positivas
atualizadas. É determinístico e local ao que a spec exige (texto **visível**).

*Alternativa considerada — um teste que varre `apps/web/src` e `docs/manual` por
`/pessoa/i`*: rejeitada como gate. A varredura não distingue literal de tela de
comentário de código nem de palavra legítima, produziria falso positivo a cada
comentário novo, e o custo de mantê-la excede o de uma asserção por tela. A
varredura fica como **passo de conferência** na tasks.md, executada uma vez, não
como gate de CI.

## Risks / Trade-offs

- **Contrato quebrado sem transição** → mitigado por o `packages/shared` ser
  consumido compilado e o `tsc` da raiz (`shared → api → web`) apontar todo
  chamador desatualizado como erro de compilação, não como falha em runtime. Um
  deploy parcial (API nova, SPA velha) recusaria a concessão com `400` — mitigado
  por API e SPA irem no **mesmo artefato** (a API serve os estáticos da SPA, mesma
  origem), logo não existe janela de versões cruzadas.
- **Recusa integral por um id inválido frustra o administrador** ("selecionei 30
  pessoas e não passou nenhuma") → mitigado por o caso ser anômalo: os ids vêm da
  lista que o próprio servidor devolveu. Trade-off assumido em favor de D3, e a
  SPA exibe a recusa sem sugerir efetivação parcial.
- **50 destinatários e prazo ⇒ 50 notificações após o commit** → cada uma isolada
  em `try/catch`, todas fora da transação; a resposta não espera nenhuma delas
  para ser correta, e o `NotificationPort` in-app é uma escrita local. Se um canal
  de e-mail entrar como segunda implementação (seam já desenhado), o laço é o
  ponto onde uma emissão em lote entra, sem tocar a regra.
- **Colisão "Colaborador" entidade × papel** (D7) → mitigada pela coluna "Papel"
  na listagem, que é onde a distinção importa; risco residual aceito pelo cliente.
- **Nomenclatura regride em código novo** → mitigada por D9 nas telas cobertas;
  risco residual em tela nova não coberta, assumido.

## Migration Plan

Sem migração de banco e sem mudança de infraestrutura: o esquema de `grants` já
comporta N destinatários e nenhuma tabela nova é criada (nada a acrescentar em
coluna `unit_id` ou policy RLS). A ordem de implementação é a do monorepo —
`packages/shared` recompilado antes de API e SPA, que dependem de `dist/`.

`GRANTS_MAX_SUBJECTS` é opcional, com padrão no código — mesmo tratamento que
`DOWNLOAD_MANIFEST_MAX_FILES`/`MAX_BYTES` já recebem (definidos em `config.ts`,
ausentes de `.env.example`). Nenhum ambiente, nem o `.env` local nem o Cloud Run,
precisa ser tocado para o deploy funcionar.

Rollback: reverter o commit. Nenhum dado escrito sob o contrato novo fica
inválido sob o antigo — as linhas de `grants` são idênticas às que a rota
singular teria criado uma a uma.
