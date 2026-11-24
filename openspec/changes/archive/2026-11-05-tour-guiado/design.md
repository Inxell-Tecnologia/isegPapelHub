# Design

## Context

A tela Início ganhou a composição da demanda na A3 e o menu ganhou os grupos
NAVEGAÇÃO e AJUDA na A2. O tour aponta para essas áreas. O design system (Ant
Design 5) tem um componente `Tour` com passos ancorados a elementos, máscara e
navegação por teclado.

## Goals / Non-Goals

**Goals**

- Tour curto pela tela Início, acionável pelo menu e pela saudação.
- Só apontar o que a pessoa vê.
- Lembrar, por pessoa, que o tour foi feito.

**Non-Goals**

- Tours por tela (explorador, busca, administração).
- Início automático no primeiro acesso.
- Conteúdo por papel além do que já decorre de "só o que se vê".

## Decisions

### D1 — Componente `Tour` do design system, sem dependência nova

O `Tour` do Ant Design cobre ancoragem, máscara, foco, teclado e rótulos em
pt-BR pelo `ConfigProvider` já configurado. Bibliotecas dedicadas (Shepherd,
react-joyride) acrescentariam dependência e um segundo vocabulário visual.

### D2 — Alvos por `data-tour`, passos montados na hora de começar

Cada área recebe `data-tour="<chave>"`. A lista de passos é fixa no código, mas
o tour é montado com `document.querySelector` **no momento de começar**, e
passo sem elemento presente é **omitido**. É assim que "só percorre o que a
pessoa vê" vale sem regra de papel duplicada no tour: na forma estreita o
menu lateral não existe (o passo do menu aponta para o botão que o abre), o
cartão do usuário sai, e sem manual o passo da ajuda some. Nenhum passo
aponta para o vazio.

### D3 — Pedido no endereço, `/?tour=1`

Os dois acionadores conduzem a `/?tour=1`. A tela Início atende o pedido depois
que o conteúdo principal está montado, retira o parâmetro **substituindo** a
entrada de histórico e abre o tour — o mesmo ciclo do pedido de envio
(`cartoes-de-atalho-acionaveis`) e do pedido de nova pasta
(`conteudo-da-tela-inicio`). Recarregar não reabre. Vale também para o item do
menu acionado de outra tela: ele navega até o Início, onde estão os alvos.

### D4 — Memória por pessoa no servidor

`users.tour_completed_at timestamptz NULL`. `POST /auth/tour-completed` grava
`now()` na **primeira** vez (`COALESCE`), sob `attachTenantContext`, só para a
própria conta — sem corpo, sem identificador na URL. Idempotente, 204.

A identidade carrega `tourCompleted: boolean`, pela mesma releitura por
requisição que já traz nome, função e setor — nenhum round-trip a mais. Por
pessoa e não por navegador: `localStorage` lembraria o computador, e nos
hospitais o computador é compartilhado entre turnos.

Fica sob `/auth` porque é estado da própria conta, como `/auth/password` e
`/auth/profile`: nenhum prefixo de topo novo.

### D5 — Concluir **ou fechar** marca como feito

Fechar no meio também grava. O que a memória decide é só se o convite volta a
aparecer, e insistir com quem fechou o tour é o incômodo que o convite existe
para evitar. Refazer continua a um clique no menu.

### D6 — Convite some depois de feito; item do menu fica

O convite "Primeira vez aqui? Faça o tour de 2 minutos" é para quem não fez.
Depois, some da saudação. O item **Tour guiado** do grupo AJUDA fica sempre —
é o caminho para refazer.

### D7 — AJUDA reúne acesso externo e interno

O requisito de navegação definia o acesso auxiliar como o que "leva a recurso
externo à aplicação". O tour é auxiliar (não é tela, não é destino) mas é
interno: não anuncia saída no nome acessível e, como o manual, não participa da
indicação de tela corrente. No painel sobreposto, acioná-lo navega e **fecha**
o painel, porque há navegação interna (até o Início).

## Risks / Trade-offs

- **Tour preso ao Início.** Se a tela Início mudar, um passo pode perder o alvo
  — e é omitido em silêncio. Mitigação: o teste conta os passos montados na
  forma larga.
- **Texto dos passos** é da equipe, a confirmar na homologação.

## Migration Plan

Migração aditiva (`0022`), coluna anulável — ninguém começa com o tour feito.
Deploy comum.

## Open Questions

- Texto final dos passos, na homologação.
