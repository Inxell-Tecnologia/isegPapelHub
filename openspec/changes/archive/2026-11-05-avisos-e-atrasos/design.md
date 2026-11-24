# Design

## Context

A situação da leitura (pendente, atrasada, concluída, encerrada) é apurada na
consulta pelo relógio do Postgres (C1, D3), e nada a grava. O público é
critério, e quem entra depois recebe a pendência na primeira consulta às
próprias leituras (C1, D2). O canal de notificação é in-app, atrás do
`NotificationPort`, idempotente por `(destinatário, tipo, evento de origem)`.
A C0 marca quem acompanha as leituras e com que alcance
(`users.reading_oversight`: `sector`, `unit`, `all_units`). Já há uma rotina
diária de avisos (`notify-expiring-grants`, 03:30).

## Goals / Non-Goals

**Goals**

- Avisar a pessoa da leitura nova, e o leitor e o gestor do atraso, sem
  repetir aviso.
- Fazer a pendência de quem entra depois nascer sem depender de a pessoa abrir
  a aplicação.

**Non-Goals**

- Relatório e acompanhamento (C4); lembretes recorrentes; e-mail.

## Decisions

### D1 — Três assuntos novos, cada um com o seu evento de origem

| Tipo | Destinatário | Evento de origem (`sourceRef`) |
| :-- | :-- | :-- |
| `reading_assigned` | a pessoa do público | `reading-assigned:<atribuição>` |
| `reading_overdue` | o leitor | `reading-overdue:<atribuição>:<prazo>` |
| `reading_overdue_team` | cada gestor | `reading-overdue-team:<marcação>:<prazo>` |

A idempotência é a do canal: reexecutar a rotina, no mesmo dia ou em outro, não
reavisa. O **prazo** no evento de origem é a "competência" do aviso: o atraso
é avisado **uma vez** por leitura e prazo, não a cada dia — lembrete diário
transformaria o sino em ruído, o mesmo argumento do aviso de corte de
concessão (`expiracao-permissoes`, D6). A situação Atrasada continua visível
nas abas e no cartão (C2) enquanto durar.

Migração `0025` amplia o `CHECK` de `notifications.kind`, como a `0019` fez.

### D2 — Nova pendência: avisada onde nasce, e a rotina é a rede de segurança

A atribuição nasce em três lugares, e os três avisam:

1. na **marcação** (`POST /reading/campaigns`), para todo o público daquele
   momento — depois da transação, e a falha ao avisar não desfaz a marcação
   (mesmo padrão do aviso de pendência de cadastro);
2. na **consulta às próprias leituras** (`GET /reading/mine`), para quem
   entrou depois e foi alcançado ali;
3. na **rotina diária**, que reconcilia o público de todas as marcações em
   curso (D4) e avisa as atribuições abertas que ainda não têm aviso — o que
   cobre também uma falha de emissão nos dois primeiros.

Só atribuição **aberta** é avisada: concluída ou encerrada não é novidade.

### D3 — Gestor do leitor: alcance da C0, dentro da unidade

Gestor de um leitor é a pessoa **ativa**, **da unidade do leitor**, diferente
dele, com `reading_oversight` igual a `unit` ou `all_units`, ou igual a
`sector` e o mesmo setor do leitor. Pode haver mais de um.

O alcance `all_units` (Governança, D5 do plano) cobre a **própria** unidade
inteira, mas **não** recebe atraso de outras unidades: um aviso com nomes de
pessoas de outra unidade é exatamente o alcance nominal entre unidades que a
D5 do cliente concede só para o relatório da C4, com teste de isolamento
próprio. Fica para lá.

O aviso ao gestor é **agregado** por (gestor, marcação, prazo): "3 pessoas da
sua equipe estão com a leitura de PRT-NSP-001 atrasada", com os nomes e
setores (até 20 nomes; a contagem é sempre a total). Um aviso por pessoa
atrasada encheria o sino do gestor de uma unidade inteira no dia seguinte a
um prazo. Quem entrou depois tem prazo próprio e cai num aviso próprio.

A marcação da C0 continua **não** concedendo acesso a conteúdo: o aviso leva
nome e setor, nunca o documento — o gestor que quiser abri-lo continua sujeito
a `hasAccess`.

### D4 — Rotina `notify-readings`, 03:45

`jobs/notify-readings.ts`, mesmo molde de `notify-expiring-grants`: contexto
de sistema (`global_admin`) para a varredura entre unidades, e cada aviso com a
**unidade real** da atribuição. Ordem:

1. **reconciliar** o público de todas as marcações em curso (revisão vigente,
   não obsoleta, não excluída) — quem casa com o critério e ainda não tem
   atribuição recebe uma, com prazo de 15 dias a partir do dia (3.3); é a
   mesma expressão de `reconcileForUser`, sem o recorte de pessoa;
2. **nova pendência** para as atribuições abertas sem aviso;
3. **atraso** ao leitor e
4. **atraso** aos gestores.

Cada passo seleciona só o que ainda não tem aviso (`NOT EXISTS` sobre
`notifications`), para a rotina não refazer centenas de emissões já feitas a
cada noite; a garantia contra duplicata continua sendo a do canal. Falha num
aviso é contada e não interrompe os demais. A rotina **não grava situação**:
"Atrasada" continua apurada na consulta, e uma rotina que não rodou atrasa só
o aviso, nunca a situação.

Horário 03:45, depois do expurgo (03:00) e dos avisos de concessão (03:30),
para não concorrer por conexões. Script `npm run notify:readings`; par
`google_cloud_run_v2_job` + `google_cloud_scheduler_job` no Terraform, com a
variável `notify_readings_schedule`.

### D5 — Sino e cartão Avisos

O sino apresenta os três assuntos; os dois do leitor oferecem "Abrir leituras"
(`/leituras`). O do gestor não tem destino ainda — a aba de acompanhamento é
da C4 — e diz por escrito quem está atrasado.

O cartão **Avisos** do Início, reservado desde a A3, passa a listar os avisos
de leitura obrigatória da pessoa (os três tipos), os mais recentes primeiro,
até 3, com a data; sem nenhum, diz que não há. A fronteira da SPA aceita os
tipos novos na mesma união discriminada — o payload do gestor vem primeiro na
união, por ser o mais específico.

## Risks / Trade-offs

- **Marcação para uma unidade inteira** emite um aviso por pessoa, cada um na
  sua transação, antes de responder. Unidades hospitalares têm centenas de
  pessoas; aceito. A rotina cobre o que falhar.
- **Aviso ao gestor congela a lista** no momento da emissão: quem confirma
  depois continua no texto. A situação atual está nas abas (C2) e estará no
  acompanhamento (C4).
- **Primeira execução** depois do deploy avisa todos os atrasos já existentes,
  uma vez. Aceito: são atrasos reais, e ninguém foi avisado deles.

## Migration Plan

Migração aditiva (`0025`). Deploy da API e da SPA juntos; `terraform apply`
cria o job e o agendador. A SPA anterior não conhece os tipos novos e
recusaria a lista do sino — por isso os dois sobem juntos.

## Open Questions

- Se o cliente quiser lembrete recorrente de atraso (semanal, por exemplo), o
  evento de origem passa a incluir a semana — sem mudar o canal.
