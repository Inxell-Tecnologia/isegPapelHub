# Proposal

## Why

A leitura obrigatória já marca, dá ciência (C1) e mostra as pendências no menu,
no Início e nas abas (C2), mas **ninguém é avisado**: a pessoa só descobre a
leitura nova se abrir a aplicação e olhar, e o prazo vencido não chega a quem
acompanha a equipe. A demanda do cliente nº 2 pede, na etapa 2 do fluxo (3.2,
item 1), **notificação no sino** ao surgir a pendência e, na etapa 4 (itens 1 e
2), que passado o prazo **o leitor e o gestor dele recebam aviso de atraso**;
a 3.3 pede que **quem entra depois no público** receba a pendência — hoje isso
só acontece quando a própria pessoa consulta as leituras. É a fatia **C3** do
plano em `docs/plano_demanda_cliente_2.md`; C0 e C1 estão entregues.

## What Changes

- **Aviso de nova pendência** no sino, para cada pessoa do público: no ato da
  marcação, e para quem entra depois no público (na consulta às próprias
  leituras ou pela rotina diária, o que vier primeiro). Um aviso por leitura.
- **Aviso de atraso** ao leitor, **uma vez** por leitura e prazo, quando o
  prazo passa sem ciência — a leitura continua aberta, como Atrasada.
- **Aviso de atraso ao gestor**: a quem tem a marcação de acompanhamento (C0)
  cobrindo o **setor** ou a **unidade** do leitor — pode ser mais de uma
  pessoa. Um aviso por gestor, documento e prazo, com a quantidade e os nomes
  de quem está atrasado na equipe dele.
- **Rotina diária** `notify-readings` (03:45): reconcilia o público de todas as
  marcações em curso (quem entrou depois recebe a pendência com 15 dias), e
  emite os avisos que faltam. Script `npm run notify:readings` e par
  job + agendador no Terraform.
- **Sino** apresenta os três avisos novos; os do leitor levam à tela de
  Leitura obrigatória.
- **Início**: o cartão **Avisos** deixa de ser reservado e lista os avisos de
  leitura obrigatória mais recentes da pessoa.

### Fora desta fatia

- Acompanhamento e relatório (C4). O gestor recebe o aviso, mas a tela
  nominal de acompanhamento é da C4.
- O alcance "todas as unidades" (Governança) **não** recebe atraso de outras
  unidades: aviso nominal entre unidades é a exceção estreita da D5, que
  pertence ao relatório da C4. Na própria unidade, ele cobre a unidade
  inteira.
- Lembrete recorrente de atraso (a cada N dias) e aviso por e-mail.

## Capabilities

### New Capabilities

_(nenhuma)_

### Modified Capabilities

- `leitura-obrigatoria` — avisos de pendência e de atraso; reconciliação
  diária do público.
- `notificacoes` — três assuntos novos no canal.
- `tela-inicial` — o cartão "Avisos" deixa de ser reservado.
- `platform-infrastructure` — job e agendador novos.

## Impact

- **Banco**: migração `0025_notification_kinds_reading.sql` (amplia o `CHECK`
  de `notifications.kind`). Nenhuma tabela nova.
- **API**: `lib/reading-notices.ts` (novo: consultas e emissão),
  `lib/reading.ts` (reconciliação devolve o que criou; versão para todas as
  unidades), `routes/reading.ts` (avisa na marcação e na reconciliação),
  `jobs/notify-readings.ts` (novo), script `notify:readings`.
- **Shared**: `NotificationKind` e payloads de leitura.
- **Web**: `NotificationCenter.tsx`, `lib/schemas.ts`, cartão de Avisos do
  Início.
- **Infra**: `scheduler.tf` (job + agendador), `variables.tf` (horário).
- **Documentação**: manual (leitura obrigatória, tela inicial, avisos); PRD (US
  12.5); plano (C3 entregue).
