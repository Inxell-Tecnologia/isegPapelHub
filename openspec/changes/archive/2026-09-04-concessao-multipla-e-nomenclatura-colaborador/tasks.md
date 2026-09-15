# Tasks — concessao-multipla-e-nomenclatura-colaborador

> Ordem obrigatória: `packages/shared` (seção 1) é consumido **compilado** de
> `dist/` — recompilar antes de mexer em API e SPA, senão o `tsc` da API/web
> continua enxergando o contrato antigo. A validação de entrada (seção 2, tarefas
> 2.1–2.4) precisa estar completa **antes** do upsert múltiplo (2.5): publicar o
> produto colaboradores × verbos sem a recusa integral de D3 abriria, ainda que
> por um commit, o oráculo de existência de contas que a change existe para
> evitar. As seções 5 e 6 (nomenclatura) são independentes das 1–4 e podem ser
> feitas em paralelo, mas o manual (seção 6) só fecha depois da tela (seção 5) —
> o manual descreve a interface efetivamente entregue.
>
> Sem migração de banco, sem tabela nova, sem policy RLS nova, sem mudança em
> `infra/terraform` e sem mudança no `.claude/hooks/session-start.sh` — o
> esquema de `grants` já é uma linha por (colaborador, recurso, verbo).

## 1. Contrato compartilhado (`packages/shared`)

- [x] 1.1 Em `src/permissions.ts`, trocar `CreateGrantRequest.subjectUserId:
  string` por `subjectUserIds: string[]` (design.md D1). Verificar rodando
  `npm run build --workspace packages/shared` e confirmando que o `tsc` da raiz
  passa a acusar os chamadores desatualizados em `apps/api` e `apps/web` — a lista
  de erros é o inventário do que as seções 2 e 4 precisam tocar.
- [x] 1.2 Adicionar o tipo do corpo de recusa por teto,
  `{ error: 'grant_subjects_limit_exceeded'; found: number; allowed: number }`,
  no molde exato de `DownloadManifestLimitExceeded` em `src/folders.ts`
  (design.md D4). Verificar que a SPA consegue importá-lo (`npm run build
  --workspace packages/shared` e o import compilando na seção 4).

## 2. Rota de concessão (`apps/api/src/routes/grants.ts`)

- [x] 2.1 Acrescentar `grants: { maxSubjects }` a `apps/api/src/config.ts`
  (`GRANTS_MAX_SUBJECTS`, padrão `50`), no formato de `config.downloadManifest`.
  Verificar com um caso em `grants.test.ts` que lê o valor de configuração em vez
  de fixar `50` no teste.
- [x] 2.2 Validação de **forma** do corpo (`400`): `subjectUserIds` presente,
  array não vazio de strings; `resourceType`/`resourceId`/`permissions`/`expiresAt`
  como hoje. Verificar com casos de `400` para array ausente, vazio e com elemento
  não-string.
- [x] 2.3 **Dedup** dos `subjectUserIds` preservando a ordem de chegada, antes de
  qualquer consulta (design.md D2/D3). Verificar com um caso que envia o mesmo id
  duas vezes e espera sucesso com uma única linha por verbo.
- [x] 2.4 **Teto** sobre o conjunto deduplicado: `413` com
  `{ error: 'grant_subjects_limit_exceeded', found, allowed }` e **nenhuma**
  concessão efetivada. Verificar com um caso que excede o teto e depois confirma,
  por `GET /grants`, que o recurso continua sem concessões.
- [x] 2.5 **Existência dos sujeitos em consulta única** dentro da transação
  (`SELECT id FROM users WHERE id = ANY($1)`), comparando cardinalidade com o
  conjunto deduplicado; divergência ⇒ `404 not found` **integral**, sem indicar
  qual id (design.md D3). Verificar com um caso de N sujeitos válidos + 1
  inexistente que espera `404` e, em seguida, `GET /grants` vazio; e com um caso
  em que o id extra é de **outra unidade**, esperando a **mesma** resposta,
  indistinguível da anterior.
- [x] 2.6 Substituir o laço de upsert por verbo pelo `INSERT ... SELECT` com
  `unnest(sujeitos) CROSS JOIN unnest(verbos)` e o mesmo `ON CONFLICT
  (unit_id, subject_user_id, resource_type, resource_id, permission) DO UPDATE`
  de hoje (design.md D2). Verificar que os casos já existentes de reconcessão
  (prazo prevalece, sem prazo torna permanente, sem duplicar, `granted_by`
  atualizado) continuam passando sem alteração.
- [x] 2.7 Confirmar que a `unit_id` gravada continua vindo do **recurso** e que
  nenhuma consulta nova saiu de `withTenantTransaction`. Verificar rodando
  `npm run test --workspace apps/api -- src/__tests__/rls-isolation.test.ts` e
  `src/__tests__/isolamento-unidade.test.ts` sem alteração nesses arquivos.

## 3. Notificação de concessão com prazo

- [x] 3.1 Trocar a emissão única por um laço sobre os destinatários **após o
  commit**, cada emissão em seu próprio `try/catch`, mantendo a fórmula de
  `sourceRef` intacta (design.md D5). Verificar com um caso em que a emissão falha
  para um destinatário e os demais recebem, com a concessão efetivada para todos e
  `201` na resposta.
- [x] 3.2 Verificar a idempotência por destinatário: repetir a mesma concessão
  (mesmo recurso, mesmo vencimento) incluindo um destinatário já avisado e um
  novo, esperando **nenhum** aviso duplicado para o primeiro e um aviso para o
  segundo (`npm run test --workspace apps/api -- src/__tests__/notifications.test.ts`).
- [x] 3.3 Confirmar que concessão **sem** prazo continua não emitindo aviso algum,
  com qualquer número de destinatários.

## 4. Diálogo de permissões (`apps/web/src/permissoes/`)

- [x] 4.1 `queries.ts`: ajustar o tipo do corpo de `useCreateGrant` ao novo
  `CreateGrantRequest`. Verificar que `npm run build --workspace apps/web` compila.
- [x] 4.2 `PermissoesModal.tsx`: trocar o `Select` de pessoa por `mode="multiple"`
  com `showSearch`, `optionFilterProp="label"` e `maxTagCount="responsive"`
  (design.md D6); a regra de obrigatoriedade passa a exigir **ao menos um**
  colaborador. Verificar com um caso que tenta submeter sem colaborador e espera
  bloqueio sem chamada a `POST /grants`.
- [x] 4.3 Enviar **uma única** `POST /grants` com todos os colaboradores e verbos.
  Verificar com um caso que seleciona dois colaboradores e dois verbos e assere
  exatamente **uma** chamada, com os quatro pares refletidos na lista de vigentes.
- [x] 4.4 Prévia de prazo vigente por colaborador selecionado que já tenha
  concessão no recurso, omitindo os sem concessão prévia (design.md D6). Verificar
  com um caso de dois selecionados, um com concessão e outro sem, esperando uma
  única linha de prévia.
- [x] 4.5 Aviso próprio para `413` com `details.error ===
  'grant_subjects_limit_exceeded'`, orientando a reduzir a seleção; demais recusas
  mantêm a mensagem neutra atual. Verificar com um caso que mocka o `413` e assere
  o texto específico, e outro que mocka `403` e assere a mensagem neutra.
- [x] 4.6 Confirmar que a lista de concessões vigentes e a revogação por verbo
  seguem inalteradas (agrupamento por colaborador, `DELETE /grants/:id` por linha).
  Verificar rodando `npm run test --workspace apps/web -- src/__tests__/permissoes.test.tsx`.

## 5. Nomenclatura na interface (`apps/web/src`)

- [x] 5.1 `shell/AppShell.tsx`: item de menu "Pessoas" → "Colaboradores" (a rota
  `/admin/pessoas` **não** muda, design.md D8). Verificar em
  `role-guard.test.tsx`/`shell-*.test.tsx` que o menu ancora o novo rótulo e a
  navegação continua levando a `/admin/pessoas`.
- [x] 5.2 `pessoas/PessoasPage.tsx`: título da página, botão "Nova pessoa" →
  "Novo colaborador", confirmações de ativar/desativar e de redefinir senha, e o
  título de erro de carga. Trocar `STATUS_LABEL` de "Ativa"/"Inativa" para
  "Ativo"/"Inativo" (concordância, spec `nomenclatura-interface`).
- [x] 5.3 `pessoas/PessoaFormModal.tsx`: título "Editar/Nova pessoa" → "Editar/Novo
  colaborador". **Não** alterar `ROLE_LABEL` — o papel continua "Colaborador"
  (design.md D7).
- [x] 5.4 `pessoas/SenhaGeradaModal.tsx`: "repasse à pessoa" → "repasse ao
  colaborador".
- [x] 5.5 `auditoria/AuditoriaModal.tsx`: cabeçalho de coluna "Pessoa" →
  "Colaborador".
- [x] 5.6 `painel/PainelPage.tsx`: "Total de pessoas" → "Total de colaboradores".
- [x] 5.7 `unidades/UnidadesPage.tsx`: avisos de "pessoas vinculadas" →
  "colaboradores vinculados", nos dois pontos (mensagem de erro e descrição da
  confirmação).
- [x] 5.8 `permissoes/PermissoesModal.tsx`: rótulo/placeholder do seletor,
  mensagem de obrigatoriedade, aviso de falha ao carregar a lista, texto da prévia
  e descrição da confirmação de revogar — todos para "colaborador(es)".
- [x] 5.9 Atualizar as âncoras de texto nos testes afetados (`pessoas.test.tsx`,
  `permissoes.test.tsx`, `auditoria.test.tsx`, `painel.test.tsx`,
  `unidades.test.tsx`, `role-guard.test.tsx` e o que a suíte apontar) e acrescentar,
  em cada tela tocada, a asserção de **ausência** de "Pessoa"/"Pessoas"/"Servidor"
  no documento renderizado (design.md D9). Verificar com
  `npm run test --workspace apps/web`.
- [x] 5.10 Passo de conferência (não é gate de CI, design.md D9): rodar
  `grep -rniE "pessoa|servidor" apps/web/src --include=*.tsx --include=*.ts` e
  confirmar, uma a uma, que as ocorrências restantes são **comentário, nome de
  identificador ou caminho de rota** — nenhuma é literal de tela.

## 6. Manual do usuário (`docs/manual/`)

- [x] 6.1 `mkdocs.yml`: rótulo de navegação "Pessoas" → "Colaboradores",
  **mantendo** o caminho `administrador/pessoas.md` (design.md D8, preservação de
  endereço publicado).
- [x] 6.2 `docs/administrador/pessoas.md`: título e prosa para "Colaborador(es)",
  incluindo o texto do papel, que continua "Colaborador".
- [x] 6.3 `docs/administrador/permissoes.md`: prosa para "colaborador(es)" **e**
  documentação do que a seção 4 entregou — seleção de vários colaboradores numa
  só concessão, com o aviso de que exceder o teto recusa a operação inteira.
- [x] 6.4 Demais páginas com ocorrências: `index.md`, `a-tela.md`,
  `administrador/painel.md`, `administrador/unidades.md`, `colaborador/enviar.md`,
  `colaborador/buscar.md`, `colaborador/auditoria.md`,
  `colaborador/renomear-e-excluir.md`, `referencia/limites.md`,
  `referencia/tarefas-rapidas.md`, `referencia/faq.md`.
- [x] 6.5 Verificar: `grep -rniE "pessoa|servidor" docs/manual/docs` sem ocorrência
  designando a pessoa usuária, e a verificação de integridade de links do manual
  passando (nenhum caminho de arquivo foi renomeado, então nenhum link deve quebrar).

## 7. Verificação integrada

- [x] 7.1 `npm run lint && npm run build && npm run test` na raiz, tudo verde.
- [x] 7.2 `npm run format` e confirmar que `format:check` passa, **sem** formatar
  `openspec/`, `docs/` ou `.claude/` (fora do escopo do Prettier por decisão).
- [x] 7.3 Subir a app em dev (`npm run dev:api` + `npm run dev:web`), autenticar
  como `unit_admin` e conceder, numa operação, dois verbos a três colaboradores
  sobre um arquivo — confirmando na aba de rede **uma** requisição e, no diálogo,
  as nove linhas de concessão resultantes agrupadas por colaborador.
- [x] 7.4 No mesmo ambiente, conceder com prazo a três colaboradores e confirmar
  que **cada um** recebe o aviso na central de notificações (entrar com cada
  conta, ou consultar `notifications` no Postgres local).
- [x] 7.5 `openspec validate --changes concessao-multipla-e-nomenclatura-colaborador
  --strict` verde e conferência final de que nenhum arquivo, pasta, rota ou
  capability foi renomeado (design.md D8) — `git status` não deve conter renomeação.
