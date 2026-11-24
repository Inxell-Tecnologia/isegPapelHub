# Tasks

## 1. API — contagem na subárvore alcançável

- [x] 1.1 Em `apps/api/src/routes/folders.ts::listContents`, trocar a consulta agregada direta pela CTE recursiva de design.md D2: raízes = ids das subpastas recém-listadas; passo recursivo só por subpastas que passam em `visibleResourceClause(FOLDER)` (poda com descendência, D1); contagem final com `visibleResourceClause(FILE) AND nonObsoleteClause AND visibleRegistrationClause` `UNION` sobre `(raiz, pasta)` garantindo término e contagem única (sem teto de profundidade — ajuste registrado em D2). Mesmos fragmentos e mesmo placeholder do dono; nenhuma regra de acesso nova. Verificação: `npm run build --workspace apps/api` sem erros.
- [x] 1.2 Atualizar o comentário do bloco de contagem em `listContents` (rastro: change `contagem-de-documentos-na-subarvore`, design.md D1/D2; US 11.1 cenário 3) e o JSDoc de `documentCount` em `packages/shared/src/folders.ts` ("documentos que o solicitante pode abrir na pasta e nas subpastas alcançáveis"), sem mudar tipo nem opcionalidade. Verificação: `npm run build --workspace packages/shared` e `git diff` sem mudança de tipo.

## 2. Testes de não vazamento

- [x] 2.1 Em `apps/api/src/__tests__/contagem-documentos-pastas.test.ts`, inverter o caso "pasta só com subpastas tem contagem zero" para afirmar a soma (dono, admin da unidade e viewer com `view` na subpasta). Verificação: o caso passa.
- [x] 2.2 Trocar a igualdade direta pela **igualdade recursiva** de design.md D3 (`documentCount(X) === files(X) + Σ documentCount(S)`), percorrendo a árvore via `GET /folders/:id/contents`, para dono, admin da unidade, colaborador com concessões parciais, quem enviou o pendente e admin global. Verificação: o caso passa.
- [x] 2.3 Casos novos da tabela de design.md D3: subpasta sem `view` (com `view` em documentos dentro) fora da soma; sub-subpasta com `view` abaixo de subpasta podada fora da soma; subpasta na lixeira fora da soma inclusive para admin da unidade; concessão de `view` sobre subpasta expirada tira o ramo na requisição seguinte; obsoleto e pendente dentro de subpasta seguem a listagem; admin global sem soma de outra unidade. Verificação: `npm run test --workspace apps/api -- src/__tests__/contagem-documentos-pastas.test.ts` verde.
- [x] 2.4 Caso de ciclo: montar com `withSystemBypass` duas pastas que se apontam como mãe e solicitar o conteúdo de uma delas; a requisição termina (a guarda da trilha responde com erro tratado, comportamento existente), sem laço. Verificação: caso passa sem estourar o timeout do vitest.
- [x] 2.5 Rodar a suíte de segurança inteira da API (`rls-isolation`, `isolamento-unidade`, `permission`, `expiracao-permissoes-acesso`, `folders`, `download-pasta` se existir) e a da web (`tela-inicial.test.tsx`). Verificação: `npm run test --workspace apps/api` e `npm run test --workspace apps/web -- src/__tests__/tela-inicial.test.tsx` verdes.

## 3. Documentação

- [x] 3.1 `docs/manual/docs/a-tela.md` (Pastas da unidade): a contagem passa a somar os documentos das subpastas a que a pessoa tem acesso; subpasta sem acesso fica de fora, com tudo o que há abaixo dela; a conta é pessoal. Remover a frase sobre "pasta que só tem subpastas aparece como Nenhum documento". Verificação: leitura do trecho fiel ao comportamento entregue.
- [x] 3.2 `docs/plano_demanda_cliente_3.md` (Fatia C): marcar a pendência da contagem direta como resolvida pelo cliente (soma da subárvore com poda), apontando para este change. Verificação: `git diff` do plano.

## 4. Fechamento

- [x] 4.1 `npm run lint`, `npm run build` e `npm run format:check` na raiz. Verificação: os três sem erro.

## Infraestrutura e paridade dev

Nenhuma tarefa: sem migration, sem rota/prefixo novo, sem recurso de nuvem e sem mudança no hook de SessionStart.

## Workflow follow-up

- `/opsx:verify` e `/opsx:archive` (sincroniza `navegacao` e `tela-inicial` em `openspec/specs/`).
