# Tasks

## 1. Memória por pessoa (banco, API, contrato)

- [x] 1.1 Migração `0022_tour_completed.sql`: `users.tour_completed_at
  timestamptz NULL` (design.md D4).
- [x] 1.2 `tourCompleted` em `AuthenticatedIdentity`; lido na releitura de
  `attachTenantContext`, no login e em `GET /auth/me`. Recompilar o shared.
- [x] 1.3 `POST /auth/tour-completed` sob `attachTenantContext`: grava `now()`
  na primeira vez, só na própria conta, 204 idempotente.
- [x] 1.4 Testes: grava e reflete em `/auth/me`; idempotente (preserva a
  primeira data); só a própria conta; 401 sem sessão.

## 2. Tour (web)

- [x] 2.1 Módulo `tour/`: passos fixos por `data-tour`, montados na hora de
  começar e omitindo alvo ausente (design.md D2); componente com o `Tour` do
  design system (D1).
- [x] 2.2 Pedido no endereço `/?tour=1`, atendido uma vez pela tela Início
  (D3); ao concluir ou fechar, `POST /auth/tour-completed` e atualização da
  identidade (D4, D5).
- [x] 2.3 `data-tour` nos alvos: menu (ou botão que o abre), busca, envio,
  sino, atalhos, pastas, recentes, coluna direita, ajuda.
- [x] 2.4 Item **Tour guiado** no grupo AJUDA, sem anúncio de saída, fechando o
  painel sobreposto (D7); convite na saudação só para quem não fez (D6).
- [x] 2.5 Testes: passos montados na forma larga; passo ausente omitido (sem
  manual); convite some depois de feito; item do menu de outra tela abre o
  tour no Início; pedido não se repete; fechar grava.

## 3. Documentação e fechamento

- [x] 3.1 Manual: `a-tela.md` (menu, convite) e `primeiro-acesso.md`.
- [x] 3.2 PRD: retirar o tour de Fora de Escopo e acrescentar a US 11.3.
- [x] 3.3 Plano: A6 entregue, desvios e lacunas.
- [x] 3.4 `lint`, `build`, `test`, `format:check`; conferir no navegador em
  1440 e 375 px.
