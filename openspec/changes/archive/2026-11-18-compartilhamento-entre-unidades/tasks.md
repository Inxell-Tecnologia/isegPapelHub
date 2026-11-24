# Tasks

## 0. PRD

- [x] 0.1 Atualizar `docs/prd_final.md` conforme proposal.md, em "What
  Changes / PRD":
  - §3: mover o compartilhamento entre unidades de "Fora de Escopo" para
    "Dentro do Escopo", na forma somente leitura e envolvendo a SEDE;
  - nova US 5.2 com os 8 cenários;
  - ressalva no RF 6 e novo RF 28;
  - ressalva no NFR "Privacidade entre unidades";
  - ajustar a persona Administrador de Unidade ("não enxerga o conteúdo das
    demais unidades, salvo o compartilhado com a sua").

  Verificação: os cenários citados nas specs deste change existem no PRD.

## 1. Banco

- [x] 1.1 `apps/api/src/db/migrations/0026_cross_unit_grants.sql`:
  - `units.is_headquarters` com índice único parcial;
  - `OR is_headquarters` no `USING` da policy de `units` (o `WITH CHECK`
    não muda);
  - tabela `cross_unit_grants` com índices, `CHECK` e policy de D2,
    incluindo `ENABLE`/`FORCE ROW LEVEL SECURITY`;
  - colunas `audit_events.actor_name` e `actor_unit_name`, ambas
    anuláveis.

  Comentários com rastro (`change compartilhamento-entre-unidades,
  design.md D1/D2/D9/D11`).
- [x] 1.2 Na mesma migração, a parte de dados de D10, sob `SET LOCAL
  app.user_role = 'global_admin'`, como em `0020_sectors.sql`: copiar para
  `cross_unit_grants` as concessões de `view`/`download` cujo sujeito é de
  outra unidade, e depois remover de `grants` todas as concessões com
  sujeito de outra unidade. Registrar com `RAISE NOTICE` a contagem de
  copiadas e removidas.
- [ ] 1.3 Antes do deploy, rodar em produção (só leitura) a consulta que
  conta as concessões sem efeito por verbo, e anexar o resultado ao PR.
  Verificação: os números batem com o `NOTICE` da migração no deploy.
  **Pendente de operação**: o sandbox não tem acesso ao banco de produção. A
  consulta está na descrição do PR.
- [x] 1.4 Casos de RLS para `cross_unit_grants` (ficaram em
  `compartilhamento-entre-unidades.test.ts`, junto da transação de visita,
  para não alterar `rls-isolation.test.ts`):
  - a origem lê e escreve;
  - o destino lê só a concessão da unidade e a própria;
  - terceira unidade não lê nada;
  - sem `app.current_user_id`, o ramo pessoal nega.

  Verificação: a suíte roda com o papel não-superuser.

## 2. Seam de banco

- [x] 2.1 `pg-database-port.ts::withTenantTransaction` passa a publicar
  `app.current_user_id` (`SET LOCAL`, via `set_config(..., true)`).
- [x] 2.2 `DatabasePort.withSharedVisitTransaction({ userId, originUnitId },
  fn)` com `current_unit = origem`, `user_role = 'shared_visitor'` e
  `current_user` (design.md D3). Implementar também no adapter de testes,
  se houver.
- [x] 2.3 Teste de arquitetura: falha se algum arquivo de `apps/api/src`,
  fora de `lib/cross-unit-share.ts` e do port/adapter, referenciar
  `withSharedVisitTransaction`.

## 3. Resolução e rotas de conteúdo

- [x] 3.1 `packages/shared`: incluir os DTOs abaixo e recompilar o
  `shared`.
  - `CrossUnitGrantResponse`;
  - `CreateCrossUnitGrantRequest`;
  - `CrossUnitDestinationResponse`;
  - `CrossUnitRecipientResponse`;
  - `UnitResponse.isHeadquarters`;
  - `SharedWithMeItemResponse.originUnit`;
  - `readOnly` e `sharedFrom` no conteúdo de pasta;
  - `actor.unitName` na auditoria;
  - códigos de erro `cross_unit_subject`,
    `cross_unit_destination_not_allowed` e `headquarters_already_set`.
- [x] 3.2 `apps/api/src/lib/cross-unit-share.ts`:
  - `listShareOrigins(client, ctx, permission)`;
  - `withSharedResource(ports, ctx, type, id, permission, fn)`, com os
    passos de D4 (a–d): subtrações, regra da SEDE, origem ativa e cobertura
    por subárvore via `WITH RECURSIVE` (D5);
  - `listVisitContents(...)` e `buildVisitBreadcrumb(...)` (D6).

  Rastro em comentário. `lib/access.ts` ganha só um parágrafo de comentário
  apontando para o segundo caminho, sem mudança de código.
- [x] 3.3 `POST /files/:id/view-url` e `/download-url`: se `hasAccess` negar,
  tentar `withSharedResource`. A emissão da URL e a auditoria acontecem
  dentro da visita, com `actor_name` e `actor_unit_name` lidos na
  transação própria (D9). A negação final é idêntica à de hoje.
- [x] 3.4 `GET /folders/:id/contents`: caminho de visita (D6), com
  `readOnly: true`, `sharedFrom`, `canUpload: false`, favoritos vazios e
  contagem da subárvore com subtração. Levantar se o `PreviewModal` usa
  outra rota de detalhe de arquivo e, se usar, incluí-la no caminho de
  visita.
- [x] 3.5 Confirmar, com teste, que as rotas de escrita (upload, replace,
  rename, move, delete, restore, grants, favorites, document-control) e as
  de busca, recentes e manifesto **não** alcançam conteúdo compartilhado.
  Elas devem responder exatamente como hoje para um item de outra unidade.

## 4. Rotas de gestão

- [x] 4.1 `POST /grants`: recusar com 422 `cross_unit_subject` quando algum
  sujeito tiver `unit_id` diferente do recurso (D10). Atualizar os testes
  de `permission.test.ts` que assumiam outro comportamento, se houver.
- [x] 4.2 `POST /grants/cross-unit`, `GET /grants/cross-unit`,
  `DELETE /grants/cross-unit/:id`, `GET /grants/cross-unit/destinations` e
  `GET /grants/cross-unit/recipients`, conforme D7/D8. Registrá-las
  **antes** de `/grants/:id` no router, para não haver conflito de padrão.
- [x] 4.3 `GET /grants/received`: segunda origem de candidatos e
  `originUnit` (D12).
- [x] 4.4 `PATCH /units/:id`: aceitar `isHeadquarters`, com 409 para segunda
  SEDE e 409 para desativar a SEDE marcada. `GET /units` devolve
  `isHeadquarters` (D11).
- [x] 4.5 `routes/audit.ts`: usar `LEFT JOIN users`, `COALESCE` com
  `actor_name` e devolver `actor.unitName` e e-mail nulo para quem é de
  outra unidade (D9).

## 5. Testes de servidor

- [x] 5.1 `apps/api/src/__tests__/compartilhamento-entre-unidades.test.ts`.
  Cenários positivos:
  - caso real: Governança (SEDE) → Raíra e Governança (SEDE) → Unidade
    Norte inteira, inclusive pessoa cadastrada depois;
  - inverso: Norte → SEDE;
  - subárvore: arquivo profundo, item novo e item movido para fora.

  Cenários negativos:
  - terceira unidade;
  - Norte → Sul;
  - verbo de escrita;
  - `download` sem concessão;
  - vencido;
  - revogado;
  - SEDE desmarcada e depois remarcada;
  - pessoa transferida;
  - obsoleto, pendente e lixeira;
  - concessão individual de colega;
  - `global_admin` compartilhando item de outra unidade;
  - destino tentando revogar.

  Auditoria: o evento aparece para o dono da origem, com nome e unidade.
- [x] 5.2 `isolamento-unidade.test.ts`, `permission.test.ts`,
  `expiracao-permissoes-acesso.test.ts` e `web-serving.test.ts` seguem
  verdes **sem edição de asserção**. A única exceção esperada é a 4.1, se
  algum teste gravava concessão entre unidades.
- [x] 5.3 Testes de migração: base com concessão sem efeito de `view` e de
  `delete`. Depois da 0026, a de `view` vira compartilhamento por pessoa e
  as duas saem de `grants`.

## 6. SPA

- [x] 6.1 `unidades/`: etiqueta "SEDE", ação marcar e desmarcar com
  confirmação, e desativar indisponível na SEDE (spec `web-unidades`).
- [x] 6.2 `permissoes/PermissoesModal.tsx`: seção "Compartilhar com outra
  unidade", com destino, unidade inteira ou pessoas, verbos, prazo, lista,
  revogação, aviso de subárvore e estado sem SEDE. A seleção de pessoas da
  concessão comum fica restrita à unidade do recurso, e a mensagem de
  `cross_unit_subject` é traduzida (spec `web-permissoes`).
- [x] 6.3 `compartilhados/`: etiqueta "da unidade {nome}" quando
  `originUnit` vier preenchido.
- [x] 6.4 `navegacao/ExplorerPage.tsx`: modo somente leitura com
  `readOnly`/`sharedFrom`, ações de escrita ocultas, faixa "Compartilhada
  pela unidade {nome}" e orientador de vazio próprio (spec
  `web-navegacao`).
- [x] 6.5 `auditoria/`: mostrar a unidade da pessoa quando
  `actor.unitName` vier preenchido.
- [x] 6.6 Testes de componente em `apps/web/src/__tests__/` para 6.1–6.5.

## 7. Documentação

- [x] 7.1 Atualizar as páginas do manual:
  - `docs/manual/docs/administrador/unidades.md`: marcar a SEDE e o efeito
    de desmarcar;
  - `administrador/permissoes.md`: compartilhar com outra unidade (quem
    pode, sentidos permitidos, somente leitura, subárvore, aviso, prazo,
    revogação) e a nova mensagem da concessão comum;
  - `administrador/auditoria.md`: acesso de pessoa de outra unidade;
  - `colaborador/compartilhados-comigo.md`: itens de outra unidade e
    navegação somente leitura;
  - `referencia/faq.md`: "Concedi acesso a alguém de outra unidade e não
    funciona".

  Fidelidade à interface entregue.

## 8. Fechamento

- [x] 8.1 `npm run lint`, `npm run build`, `npm run format:check` e
  `npm run test`. Verificação: tudo verde, com a API testada contra o
  Postgres com papel não-superuser.
- [x] 8.2 Validação manual no sandbox com seed: marcar a SEDE, compartilhar
  uma pasta com a Unidade Norte, entrar como colaborador da Norte, abrir
  por "Compartilhados comigo", visualizar um arquivo interno e conferir a
  auditoria como admin da SEDE.

## Infraestrutura (Terraform/GCP)

- Nenhuma tarefa: não há recurso de nuvem novo, job novo nem prefixo de
  topo novo. As rotas novas ficam sob `/grants`, então `API_PREFIXES`,
  `API_PROXY_PREFIXES` e `api_proxy_prefixes` não mudam. A migração roda
  pelo fluxo de deploy existente.

## Paridade dev (SessionStart hook/sandbox)

- [x] 9.1 O seed (`npm run seed --workspace apps/api`) marca a unidade-sede
  do seed como SEDE e cria um compartilhamento de exemplo, de forma
  idempotente, para que o fluxo de 8.2 seja reproduzível. O hook não muda:
  ele já migra e semeia.
