# Tasks

## 1. Banco e contrato

- [x] 1.1 Migração `0024_reading.sql`: `reading_campaigns` e
  `reading_assignments` com `unit_id`, RLS `FORCE`, únicos por revisão e por
  pessoa (design.md D1).
- [x] 1.2 DTOs em `packages/shared/src/reading.ts`.

## 2. API

- [x] 2.1 `lib/reading.ts`: critério de público em SQL (D2), situação derivada
  (D3), materialização na marcação e para quem entra depois.
- [x] 2.2 `lib/access.ts`: ramo `view` do destinatário (D6).
- [x] 2.3 `routes/reading.ts`: estado do arquivo, opções de público (D8),
  prévia, marcação (D4, D5), minhas leituras, ciência (D7); prefixo
  `/reading` nas três listas (D10).
- [x] 2.4 Testes: cada cenário de `leitura-obrigatoria` e `controle-acesso`,
  inclusive isolamento por unidade e `web-serving`.

## 3. Web

- [x] 3.1 Modal de marcação com público, prazo, mensagem, prévia e público
  anterior pré-preenchido (D9); ação na linha do explorador por
  `canEditControl`.
- [x] 3.2 Rodapé do visualizador com Confirmar ciência, habilitado na carga,
  e a declaração nominal.
- [x] 3.3 Testes dos cenários de `web-navegacao` e `web-visualizacao`.

## 4. Documentação e fechamento

- [x] 4.1 Manual: página nova de leitura obrigatória.
- [x] 4.2 PRD: US 12.2 e 12.3.
- [x] 4.3 Plano: C1 entregue, lacunas.
- [x] 4.4 `lint`, `build`, `test`, `format:check`; conferir no navegador.
