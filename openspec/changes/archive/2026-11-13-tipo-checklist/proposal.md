# Proposal

## Why

No retorno sobre a demanda nº 3 (`docs/demanda_cliente_3.md`, item 11), o
cliente corrigiu a sigla do formulário — na Matriz de Documentos dele é **FOR**,
não FRM (já corrigida no commit `fix(web): sigla do formulário passa de FRM
para FOR`) — e informou que o **checklist tem sigla própria, CHK**. Hoje
formulário e checklist são um tipo só ("Formulário/Checklist", sigla única), de
modo que um checklist aparece na listagem como `FOR`, diferente do que a Matriz
do cliente escreve. Perguntado, o cliente pediu o **tipo CHK para checklist**.

PRD: US 10.1 (tipo exibido como sigla e cor; conjunto fechado de tipos). A US é
ajustada para listar Formulário e Checklist como tipos distintos; os critérios
não mudam.

## What Changes

**Contrato (`packages/shared`)**

- `DocumentType` ganha o valor `checklist`, ao lado de `form`. O conjunto
  fechado passa de nove para **dez** tipos. A API aceita o novo valor sem
  mudança de código (valida contra `DOCUMENT_TYPES`); o checklist exige os
  mesmos dados de controle de qualquer tipo da Matriz.

**Web**

- `form` passa a se chamar **Formulário** (sigla `FOR`); `checklist` é
  **Checklist** (sigla `CHK`), com tom próprio na etiqueta, de contraste
  apurado como os demais.
- Cadastro em lote: nome de arquivo `CHK-…` passa a sugerir **Checklist**
  (antes sugeria Formulário); `FOR-…` e `FRM-…` seguem sugerindo Formulário.

**Banco**

- Nenhuma migration: não há CHECK sobre `document_type` (migration 0016); a
  validação vive na API.
- **Sem reclassificação automática** do acervo: documentos já gravados como
  `form` continuam Formulário (ver design.md D2).

**Fora de escopo**

- Reclassificar em massa checklists já cadastrados como formulário.
- Filtro por tipo na busca (não existe hoje).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `controle-documental`: o conjunto fechado de tipos inclui Checklist, distinto
  de Formulário.
- `web-upload`: a sugestão pelo nome do arquivo distingue `CHK` (Checklist) de
  `FOR`/`FRM` (Formulário).

## Impact

- **Shared**: `packages/shared/src/document-control.ts`.
- **Web**: `apps/web/src/shell/document-control-labels.ts`,
  `apps/web/src/app/theme.ts` (`tonsDeTipoDocumental`),
  `apps/web/src/upload/cadastro-em-lote.ts`.
- **Testes**: `apps/api/src/__tests__/controle-documental.test.ts` (aceita
  `checklist`), `apps/web/src/__tests__/cadastro-em-lote.test.ts`;
  `contraste.test.ts` já percorre todos os tipos.
- **Docs**: `docs/prd_final.md` (US 10.1, lista de tipos),
  `docs/manual/docs/colaborador/controle-documental.md`,
  `docs/plano_demanda_cliente_3.md`.
- **API, banco, infraestrutura**: nenhuma mudança de código, migration ou
  recurso.
