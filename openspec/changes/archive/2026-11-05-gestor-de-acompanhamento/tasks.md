# Tasks

## 1. Banco e contrato

- [x] 1.1 Migração `0023_reading_oversight.sql`: `reading_oversight` com `CHECK`
  de valores, `reading_oversight_set_by`/`_set_at`, `CHECK` de setor (D1, D2,
  D5).
- [x] 1.2 `ReadingOversight` e o campo em `PersonResponse`,
  `CreatePersonRequest`, `UpdatePersonRequest` e `AuthenticatedIdentity`.

## 2. API

- [x] 2.1 `POST /users` e `PATCH /users/:id`: validar valor, `all_units` só por
  `global_admin` (D3), trava de auto-edição (D4), registrar quem e quando (D5),
  traduzir o `CHECK` de setor em 409 (D2).
- [x] 2.2 Identidade: `readingOversight` na releitura, no login e em
  `/auth/me` (D6).
- [x] 2.3 Testes: cada cenário de `gestao-pessoas`, inclusive "não concede
  acesso" por `hasAccess` e retirada valendo na requisição seguinte (D7).

## 3. Web

- [x] 3.1 Rótulos de origem única (D8); campo no `PessoaFormModal` com a opção
  de todas as unidades só para `global_admin`; mensagem da recusa por setor.
- [x] 3.2 Coluna na listagem.
- [x] 3.3 Testes dos cenários de `web-pessoas`.

## 4. Documentação e fechamento

- [x] 4.1 Manual `administrador/pessoas.md`.
- [x] 4.2 PRD: Épico 12 com a US 12.1.
- [x] 4.3 Plano: C0 entregue.
- [x] 4.4 `lint`, `build`, `test`, `format:check`; conferir no navegador.
