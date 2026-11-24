# Tasks

> Fatia com backend, mas **sem** migration, rota nova, prefixo de topo,
> variável de ambiente ou recurso de nuvem: não há tarefa de Terraform, de
> `API_PREFIXES`/proxy nem de SessionStart hook. O índice
> `files (unit_id, folder_id)` já existe (migration 0004).

## 1. Contrato compartilhado

- [x] 1.1 Em `packages/shared/src/folders.ts`, criar `FolderListItemResponse`
      (`FolderResponse` + `documentCount?: number` — opcional no contrato,
      ver design.md D3) e trocar o tipo
      de `FolderContentsResponse.folders` para ele; `FolderResponse` não muda
      (design.md D3). Recompilar `packages/shared`. Verificar:
      `npm run build` passa em todos os workspaces.

## 2. API — contagem filtrada pelo acesso

- [x] 2.1 Em `apps/api/src/routes/folders.ts::listContents`, depois das
      subpastas, uma consulta `SELECT folder_id, count(*)::int … GROUP BY
      folder_id` com **os mesmos** `visibleResourceClause(FILE)`,
      `nonObsoleteClause` e `visibleRegistrationClause` e o mesmo placeholder
      do dono, restrita por `folder_id = ANY($k)` aos ids recém-listados; não
      roda com lista vazia; pasta ausente do resultado → `0` (design.md D1).
      Comentário citando US 11.1 cenário 3 e design.md D1/D2.
- [x] 2.2 `toFolderListItemResponse` (ou `toFolderResponse` + contagem) nas
      duas rotas de conteúdo; trilha e pasta corrente continuam
      `FolderResponse`. Verificar: `contagem-documentos-pastas.test.ts` afirma `documentCount`
      presente em cada subpasta da raiz e de `/folders/:id/contents`.

## 3. Testes de não vazamento (design.md D4)

> Todos os casos ficaram em `apps/api/src/__tests__/contagem-documentos-pastas.test.ts`
> (um arquivo próprio, irmão dos de isolamento), em vez de espalhados por
> `folders.test.ts`, `isolamento-unidade.test.ts` e
> `expiracao-permissoes-acesso.test.ts`: o cenário (pasta com arquivos
> comuns, expirado, na lixeira, obsoleto e pendente) é um só e serve aos
> cinco perfis.

- [x] 3.1 Igualdade `documentCount(X) ===
      GET /folders/X/contents → files.length` para dono, admin da unidade e
      colaborador com concessões parciais; pasta só com subpastas → `0`.
- [x] 3.2 Sem herança e por item: `view` só na pasta → `0`; `view` em 1 de 3
      arquivos → `1`. Arquivo na lixeira não conta (inclusive para admin).
- [x] 3.3 Obsoleto e pendente de cadastro: admin conta os dois; quem enviou o
      pendente o conta; terceiro com `view` não conta nenhum.
- [x] 3.4 Concessão de `view` no
      arquivo com `expires_at` no passado → `0` na requisição seguinte, sem job.
- [x] 3.5 `global_admin` conta só a própria
      unidade (arquivo de outra unidade nunca soma) e pasta de outra unidade
      não aparece. Verificar: `npm run test --workspace apps/api` verde contra o
      Postgres com papel não-superuser.

## 4. Web — cartão de pasta

- [x] 4.1 Função pura `textoDaContagemDeDocumentos(n)` ("Nenhum documento",
      "1 documento", "N documentos" com milhar `pt-BR`) e `tomDaPasta(id)`
      (estável por id sobre `tonsDeAtalho`), com teste unitário (design.md D5).
- [x] 4.2 `InicioPage.tsx`: cartão com ícone em quadrado tingido 40×40 à
      esquerda, nome em negrito `azulLink`, contagem em secundário embaixo;
      `aria-label` = nome da pasta e `aria-describedby` → contagem; ícone
      `aria-hidden`.
- [x] 4.3 `tela-inicial.test.tsx`: ajudante `pasta()` com `documentCount`;
      afirmar "12 documentos", "1 documento", "Nenhum documento", nome
      acessível do link = nome da pasta e descrição com a contagem; o cartão
      continua abrindo a pasta. Verificar: `npm run test --workspace apps/web`.
- [x] 4.4 Conferir na app (Playwright, 1366×768, dados de dev: Geral 12, Governança 38, Setores 0) o cartão com contagem e
      ícone colorido; a igualdade com a pasta aberta fica provada nos testes de API (3.1).

## 5. Documentação e fechamento

- [x] 5.1 `docs/manual/docs/a-tela.md` (Pastas da unidade): o cartão mostra
      quantos documentos você encontra ao abrir a pasta — só os que você pode
      ver, sem contar subpastas.
- [x] 5.2 `docs/plano_demanda_cliente_3.md`: fatia C → `entregue` com o change
      arquivado; registrar a pendência de validar com o cliente a contagem
      direta × subárvore (design.md D2).
- [x] 5.3 `npm run lint`, `npm run build`, `npm run test` e
      `npm run format:check` verdes.
