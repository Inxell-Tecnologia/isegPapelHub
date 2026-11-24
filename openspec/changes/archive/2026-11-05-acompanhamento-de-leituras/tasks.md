# Tasks

## 1. Contrato e API

- [x] 1.1 DTOs do acompanhamento em `packages/shared/src/reading.ts`.
- [x] 1.2 `lib/reading-oversight.ts`: recorte único (D1), números (D2), ramo
  de todas as unidades com contexto de sistema e colunas enumeradas (D3).
- [x] 1.3 Rotas `GET /reading/oversight` e
  `GET /reading/oversight/campaigns/:id` (D4).
- [x] 1.4 Testes: três recortes, união, desativado, perda da marcação, 404
  fora do recorte, e isolamento da Governança (view-url, download-url,
  auditoria, estado do arquivo).

## 2. Web

- [x] 2.1 Consultas e schemas do acompanhamento.
- [x] 2.2 Aba Acompanhamento (só com `available`), lista de marcações com os
  números e o recorte; aba e marcação no endereço (D7).
- [x] 2.3 Relatório nominal com filtros (D5) e exportação Excel/PDF carregada
  sob demanda (D6).
- [x] 2.4 Aviso ao gestor leva ao relatório (D7).
- [x] 2.5 Testes dos cenários de `leitura-obrigatoria` e `notificacoes`.

## 3. Documentação e fechamento

- [x] 3.1 Manual: acompanhamento e relatório.
- [x] 3.2 PRD: US 12.6.
- [x] 3.3 Plano: C4 entregue; demanda nº 2 concluída no código.
- [x] 3.4 `lint`, `build`, `test`, `format:check`; conferir no navegador.
