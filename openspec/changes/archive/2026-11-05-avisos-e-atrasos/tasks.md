# Tasks

## 1. Banco e contrato

- [x] 1.1 Migração `0025_notification_kinds_reading.sql` (amplia o `CHECK`).
- [x] 1.2 `NotificationKind` e payloads de leitura em `packages/shared`.

## 2. API

- [x] 2.1 `lib/reading.ts`: reconciliação devolve as atribuições criadas;
  versão para todas as marcações em curso (D4).
- [x] 2.2 `lib/reading-notices.ts`: emissão de nova pendência, atraso ao
  leitor e atraso agregado ao gestor (D1–D3).
- [x] 2.3 `routes/reading.ts`: avisa na marcação e na reconciliação de
  `GET /reading/mine` (D2).
- [x] 2.4 `jobs/notify-readings.ts` + script `notify:readings` (D4).
- [x] 2.5 Testes: cada cenário de `leitura-obrigatoria` e `notificacoes`,
  inclusive isolamento por unidade e idempotência.

## 3. Web

- [x] 3.1 `lib/schemas.ts`: tipos e payloads novos na união.
- [x] 3.2 Sino: textos dos três avisos; "Abrir leituras" nos do leitor (D5).
- [x] 3.3 Cartão Avisos do Início com os avisos de leitura (D5).
- [x] 3.4 Testes dos cenários de `notificacoes` e `tela-inicial`.

## 4. Infra, documentação e fechamento

- [x] 4.1 Terraform: job + agendador `notify-readings` (03:45) e variável.
- [x] 4.2 Manual: avisos de leitura (sino, cartão Avisos).
- [x] 4.3 PRD: US 12.5.
- [x] 4.4 Plano: C3 entregue, lacunas.
- [x] 4.5 `lint`, `build`, `test`, `format:check`; conferir no navegador.
