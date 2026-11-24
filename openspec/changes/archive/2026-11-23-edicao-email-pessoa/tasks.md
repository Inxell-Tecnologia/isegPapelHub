# Tasks

> Sem tarefas de infraestrutura (Terraform/GCP): nenhuma rota de topo, job ou
> recurso novo. A migration roda pelo job de migração já existente. Paridade dev:
> o hook de SessionStart já aplica migrations (`npm run migrate`), sem alteração.

## 1. Registro administrativo no banco

- [x] 1.1 Criar `apps/api/src/db/migrations/0027_admin_events.sql` com a tabela `admin_events` (design.md D3), índices `(unit_id)` e `(target_user_id, created_at DESC)`, `ENABLE`+`FORCE ROW LEVEL SECURITY` e **apenas** as policies `FOR SELECT` e `FOR INSERT` com o predicado de isolamento padrão (D4); verificar com `npm run migrate --workspace apps/api` aplicando sem erro e reaplicando como no-op
- [x] 1.2 Cobrir a tabela em `apps/api/src/__tests__/admin-events-rls.test.ts`: contexto de `unit_admin` da unidade A não lê nem insere evento da unidade B; `UPDATE` e `DELETE` pelo papel da app afetam 0 linhas mesmo em contexto `global_admin`; verificar com `npm run test --workspace apps/api -- src/__tests__/admin-events-rls.test.ts` passando contra o papel não-superuser

## 2. Contrato compartilhado

- [x] 2.1 Adicionar `email?: string` a `UpdatePersonRequest` em `packages/shared/src/people.ts`, com comentário de alcance (= edição, não senha) e de efeito no login; verificar com `npm run build --workspace packages/shared` sem erro

## 3. API — troca de e-mail em `PATCH /users/:id`

- [x] 3.1 Em `apps/api/src/routes/users.ts`, validar `email` presente (`string`, `trim() !== ''`, senão `400 invalid request body`) e incluí-lo no `setField` (design.md D1); verificar por teste em `edicao-email-pessoa.test.ts`: e-mail vazio/só espaços → 400 e nada alterado
- [x] 3.2 Mapear `23505` com `constraint === 'users_email_key'` no `catch` em volta da transação para `409 { error: 'email already in use' }` (D2), com recusa total; verificar por teste: troca para e-mail de outra pessoa → 409 e os demais campos enviados não mudam; reenviar o próprio e-mail → 200
- [x] 3.3 Testes de alcance da troca de e-mail em `apps/api/src/__tests__/edicao-email-pessoa.test.ts`: `unit_admin` → `collaborator` da unidade (200); `unit_admin` → `unit_admin`/`global_admin` da unidade e pessoa de outra unidade (403, e-mail intacto); `global_admin` → `collaborator`, `unit_admin`, outro `global_admin` de outra unidade e a si mesmo (200); verificar com `npm run test --workspace apps/api -- src/__tests__/edicao-email-pessoa.test.ts`
- [x] 3.4 Teste de login após a troca em `edicao-email-pessoa.test.ts`: novo e-mail + senha antiga autentica; e-mail antigo recusa com a mesma resposta de credencial inválida; uma sessão aberta antes da troca continua respondendo 200 em rota autenticada; verificar no mesmo arquivo
- [x] 3.5 Atualizar o comentário de `canEditTarget` e da rota citando o change `edicao-email-pessoa` (D1: e-mail segue a edição, não a senha); verificar por revisão do diff

## 4. API — registro da edição de pessoa

- [x] 4.1 Na transação de `PATCH /users/:id`, ler a linha atual com `SELECT … FOR UPDATE` após as validações e antes do `UPDATE`; após o `UPDATE … RETURNING`, montar `changes` só com campos enviados cujo valor mudou, nos nomes do contrato da API (D5); gravar `admin_events` (`action = 'person_updated'`, `unit_id` da pessoa editada, `actor_user_id = ctx.userId`) somente se `changes` não for vazio; verificar com `npm run build --workspace apps/api`
- [x] 4.2 Criar `apps/api/src/__tests__/auditoria-administrativa.test.ts` cobrindo: troca de e-mail registra `{ email: { from, to } }`; papel+status na mesma requisição geram um evento com os dois; formulário reenviando papel/status vigentes com nome novo registra só o nome; edição sem mudança efetiva não grava; cota concedida/removida e setor removido aparecem com `null` representável; `global_admin` da unidade A editando pessoa da B grava com `unit_id` = B; edições recusadas (403 de alcance, 409 de e-mail, 409 de setor, trava de auto-edição) não gravam; nenhuma chave de senha em `changes`; verificar com `npm run test --workspace apps/api -- src/__tests__/auditoria-administrativa.test.ts`
- [x] 4.3 Teste de atomicidade: forçar falha no `INSERT` de `admin_events` (trigger `BEFORE INSERT` criado e removido pelo próprio teste) e verificar que nenhum campo da pessoa mudou; verificar no mesmo arquivo de teste
- [x] 4.4 Garantir que a auditoria de arquivo não muda: rodar `npm run test --workspace apps/api -- src/__tests__/audit.test.ts` verde, sem alteração no arquivo

## 5. SPA — e-mail editável

- [x] 5.1 Em `apps/web/src/pessoas/PessoaFormModal.tsx`, habilitar o campo e-mail na edição com a validação `type: 'email'` obrigatória nos dois modos, e enviar `email` no `PATCH` só quando diferir de `target.email` (design.md D6); verificar por teste em `apps/web/src/__tests__/pessoas.test.tsx`: e-mail alterado vai no corpo do `PATCH`; inalterado não vai; formato inválido não dispara `PATCH`
- [x] 5.2 Discriminar o 409 da edição pela mensagem: `email already in use` → erro no campo e modal aberto; `invalid_sector` e `reading_oversight_requires_sector` mantêm o tratamento atual; verificar por teste: 409 de e-mail mostra "E-mail já está em uso" no campo com os demais valores preservados; 409 de setor não mostra a mensagem de e-mail
- [x] 5.3 Exibir aviso (via `Form.useWatch`) quando o e-mail digitado difere do atual: a pessoa passará a entrar com o novo e-mail e deve ser avisada pelo administrador; verificar por teste: aviso aparece ao alterar e some ao restaurar o valor original
- [x] 5.4 Rodar `npm run test --workspace apps/web -- src/__tests__/pessoas.test.tsx`, `npm run lint` e `npm run format:check` verdes

## 6. Manual do usuário

- [x] 6.1 Em `docs/manual/docs/administrador/pessoas.md`, substituir "O **e-mail** não pode ser alterado na edição" pela orientação de troca: quem pode trocar (administrador da unidade: colaboradores; administrador global: qualquer pessoa), efeito imediato no login com a mesma senha, e que o sistema não avisa a pessoa; sem mencionar o registro administrativo (sem tela nesta fatia); verificar com `mkdocs build --strict` em `docs/manual/` (ou o comando de build do `docs.yml`) sem aviso
- [x] 6.2 Conferir `docs/manual/docs/referencia/faq.md` e `tarefas-rapidas.md` por menções à imutabilidade do e-mail e ajustá-las; verificar com `grep -rn -i "e-mail" docs/manual/docs` sem afirmações contraditórias

## 7. Integração

- [x] 7.1 Rodar `npm run build`, `npm run test` e `npm run lint` na raiz, todos verdes
- [x] 7.2 Validar o change com `openspec validate edicao-email-pessoa --strict`

## Workflow follow-up

- Após merge (merge commit, nunca squash), arquivar com `/opsx:archive`, sincronizando `gestao-pessoas`, `web-pessoas` e criando `openspec/specs/auditoria-administrativa/`.
- Change futuro sugerido: tela de consulta do registro administrativo e cobertura de `POST /users` e `POST /users/:id/password`.
- Change futuro sugerido: normalização de caixa/espaços do e-mail (login e unicidade).
