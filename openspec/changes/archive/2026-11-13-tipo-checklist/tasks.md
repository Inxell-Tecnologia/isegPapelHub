# Tasks

## 1. Contrato

- [x] 1.1 Em `packages/shared/src/document-control.ts`, acrescentar `CHECKLIST: 'checklist'` logo após `FORM` e ajustar o comentário do conjunto fechado (dez tipos; rastro: change `tipo-checklist`, design.md D1). Verificação: `npm run build --workspace packages/shared` sem erros.

## 2. Web

- [x] 2.1 `apps/web/src/shell/document-control-labels.ts`: rótulo de `form` passa a "Formulário"; `checklist` → "Checklist" / `CHK`. Verificação: `tsc` da web exige a entrada nova nos dois `Record`.
- [x] 2.2 `apps/web/src/app/theme.ts`: tom `checklist` de design.md D3. Verificação: `contraste.test.ts` verde (percorre todos os tipos e exige um tom por tipo).
- [x] 2.3 `apps/web/src/upload/cadastro-em-lote.ts`: `CHK` → `CHECKLIST`; `FOR` e `FRM` seguem `FORM` (design.md D4), com o comentário atualizado. Verificação: caso novo em `cadastro-em-lote.test.ts` (CHK → Checklist, FOR → Formulário).

## 3. API

- [x] 3.1 Caso em `apps/api/src/__tests__/controle-documental.test.ts`: publicar com `documentType: 'checklist'` e dados completos é aceito e devolvido como `checklist`, com situação apurada. Verificação: o caso passa.

## 4. Documentação

- [x] 4.1 `docs/prd_final.md`, US 10.1 cenário 1: a lista de tipos traz Formulário e Checklist separados.
- [x] 4.2 `docs/manual/docs/colaborador/controle-documental.md`: dez tipos, `FOR` Formulário e `CHK` Checklist; nota de que formulários antigos que eram checklists se reclassificam pela edição (design.md D2).
- [x] 4.3 `docs/plano_demanda_cliente_3.md`: registrar a decisão do cliente e apontar para este change.

## 5. Fechamento

- [x] 5.1 `npm run lint`, `npm run build`, `npm run format:check` e os testes afetados (`contraste`, `cadastro-em-lote`, `controle-documental` na web e na API). Verificação: todos verdes.

## Infraestrutura e paridade dev

Nenhuma tarefa: sem migration (não há CHECK em `document_type`), sem rota nova, sem recurso de nuvem.
