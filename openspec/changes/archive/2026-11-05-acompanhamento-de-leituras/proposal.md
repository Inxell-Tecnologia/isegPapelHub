# Proposal

## Why

A leitura obrigatória já é marcada, confirmada, apresentada ao leitor (C2) e
avisada (C3), mas **ninguém consegue acompanhar quem leu**: o publicador não
sabe quanto do público já confirmou, o gestor recebe o aviso de atraso e não
tem onde ver a equipe, e a Governança não tem o relatório que a demanda pede.
A demanda do cliente nº 2, seção 3.5, pede a aba **Acompanhamento** — por
documento, o total do público, confirmados, pendentes, atrasados e % de
adesão; a lista nominal com nome, unidade, setor, data e hora; filtros por
unidade, setor e situação; exportação em Excel e PDF — com três recortes:
*"a Governança vê todos os documentos; o publicador vê os que marcou; o gestor
vê só a própria equipe"*. É a fatia **C4**, a última do plano em
`docs/plano_demanda_cliente_2.md`. C0 e C1 estão entregues; a D5 foi
respondida (exceção estreita para a Governança) e a D6 decidida no próprio
plano (exportação montada no navegador).

## What Changes

- **Aba Acompanhamento** em Leitura obrigatória, para quem tem algo a
  acompanhar: quem marcou documentos, gestores do setor ou da unidade e quem tem
  o acompanhamento de todas as unidades. Por marcação: unidade, documento,
  revisão, prazo, situação (em curso ou encerrada), total do público,
  confirmados, pendentes, atrasados, encerradas e **% de adesão**.
- **Relatório da marcação**: lista nominal (nome, unidade, setor, situação,
  prazo, data e hora da ciência), com filtros por unidade, setor e situação, e
  **exportação em Excel e PDF** do que está filtrado, montada no navegador.
- **Três recortes de alcance**, todos no servidor:
  - **publicador** — as marcações que ele criou, com o público inteiro;
  - **gestor** — as marcações da **própria unidade**, com as pessoas do seu
    alcance (o setor, ou a unidade inteira);
  - **todas as unidades** (Governança) — as marcações de **todas** as unidades,
    com o público inteiro. É a **exceção estreita** da D5: alcança só as
    tabelas de leitura obrigatória e nome, unidade e setor das pessoas —
    nunca bytes, URL assinada, listagem de pastas ou auditoria.
- **Pessoa desativada sai do cálculo e da lista** (3.3).
- O aviso de **atraso da equipe** (C3) passa a levar ao relatório da marcação.

### Fora desta fatia

- A Governança **abrir e baixar** documentos de outras unidades (resposta 7b,
  D7) e a área de Documentos Institucionais (D7).
- Aviso de atraso ao gestor de todas as unidades sobre **outras** unidades
  (C3, D3): continua restrito à unidade dele.
- Administrador da unidade como acompanhante "por ser administrador": a
  demanda nomeia só publicador, gestor e Governança.

## Capabilities

### New Capabilities

_(nenhuma)_

### Modified Capabilities

- `leitura-obrigatoria` — acompanhamento, recortes de alcance e relatório
  exportável.
- `controle-acesso` — a exceção nominal da Governança, e o que ela **não**
  abre.
- `notificacoes` — o aviso ao gestor leva ao relatório.

## Impact

- **API**: `lib/reading-oversight.ts` (novo: recortes e agregados),
  `routes/reading.ts` (`GET /reading/oversight`,
  `GET /reading/oversight/campaigns/:id`). Sem migração; sem prefixo novo.
- **Shared**: DTOs do acompanhamento.
- **Web**: aba e relatório em `leitura/`, exportação em
  `leitura/exportar-relatorio.ts`; dependências novas `write-excel-file`,
  `jspdf` e `jspdf-autotable`, carregadas sob demanda.
- **Documentação**: manual (acompanhamento); PRD (US 12.6); plano (C4 entregue
  — demanda nº 2 concluída no código).
