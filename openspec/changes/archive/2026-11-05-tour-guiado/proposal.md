# Proposal

## Why

A demanda nº 2 pede um **tour guiado** em dois pontos: o item **Tour guiado** no
grupo AJUDA do menu (tabela 1.1) e, à direita da saudação da tela Início, o
convite **"Primeira vez aqui? Faça o tour de 2 minutos"** (tabela 1.3). É a
fatia **A6** do plano em `docs/plano_demanda_cliente_2.md`. As duas fatias de
que ela depende estão entregues: a A2 (menu e barra superior) e a A3 (conteúdo
do Início), que deixou o link do tour **de fora de propósito** — atalho sem
destino é regressão em `tela-inicial`.

É **reentrada de escopo**: o PRD exclui literalmente *"Tour guiado de primeiro
acesso"*, e a demanda nº 2 é a decisão nova do mesmo cliente.

## What Changes

- **Tour de ~2 minutos pela tela Início**, em passos que apontam cada área: o
  menu, a busca, o envio de documento, o sino, os atalhos, as pastas da
  unidade, os documentos recentes, a coluna de leitura obrigatória e avisos, e
  a ajuda. Usa o componente de tour do design system — **nenhuma dependência
  nova**.
- **O tour só percorre o que a pessoa vê.** Cada passo é montado a partir do
  elemento presente na tela no momento de começar; passo cujo alvo não existe
  (forma estreita, implantação sem manual) é omitido, nunca apontado para o
  vazio.
- **Dois acionadores**, ambos conduzindo ao mesmo lugar: o item **Tour guiado**
  no grupo AJUDA (de qualquer tela) e o convite à direita da saudação. O
  acionamento é um **pedido no endereço** (`/?tour=1`), no mesmo idioma do
  pedido de envio e do pedido de nova pasta: vale uma vez, e não se repete ao
  recarregar.
- **Memória de "já fiz" por pessoa, no servidor**: coluna
  `users.tour_completed_at`, gravada ao concluir ou fechar o tour, e
  `tourCompleted` na identidade. Por pessoa e não por navegador — nos hospitais
  o computador é compartilhado. Depois de feito, o convite "Primeira vez
  aqui?" deixa de aparecer na saudação; o item do menu continua sempre
  disponível para refazer.
- **O tour não começa sozinho.** A demanda pede um convite, não uma
  interrupção no primeiro acesso.
- **O grupo AJUDA passa a reunir um acesso interno.** Até aqui ele só tinha o
  manual, que sai da aplicação. O tour é uma ação dentro da aplicação: não
  anuncia saída, e também não participa da indicação de tela corrente.

## Capabilities

### New Capabilities

- `tour-guiado` — passos, alcance, acionamento e memória por pessoa.

### Modified Capabilities

- `web-shell-e-auth` — o grupo AJUDA passa a ter o item Tour guiado, acesso
  auxiliar **interno**.
- `tela-inicial` — o convite "Primeira vez aqui?" à direita da saudação.

## Impact

- **Banco**: migração `0022_tour_completed.sql` (coluna em `users`).
- **API**: `POST /auth/tour-completed` (sob `/auth`, prefixo já existente);
  `tourCompleted` na releitura por requisição, no login e em `GET /auth/me`.
- **Shared**: `tourCompleted` em `AuthenticatedIdentity`.
- **Web**: módulo `tour/` (passos, pedido no endereço, componente), marcações
  `data-tour` nos alvos, item no menu, convite na saudação.
- **Documentação**: manual (`a-tela.md`, `primeiro-acesso.md`); PRD — sai de
  Fora de Escopo e entra a **US 11.3**; plano.
- **Sem prefixo de rota novo, sem job.**
