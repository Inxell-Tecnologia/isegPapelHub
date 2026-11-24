# Proposal

## Why

A C1 (`leitura-obrigatoria`) entregou marcar e dar ciência, mas o leitor ainda
não tem **onde ver** o que precisa ler: a API `GET /reading/mine` existe e
nenhuma tela a apresenta, de modo que a pessoa só chega ao documento pelos
Recentes ou pelo endereço. A demanda do cliente nº 2 pede, na etapa 2 do fluxo
(3.2) e na tabela de telas (3.5), o **contador no menu**, o **cartão na coluna
direita do Início**, o destino **Leitura obrigatória** com as abas
**Pendentes** e **Concluídas**, e o **ícone na linha do arquivo** em
Documentos. É a fatia **C2** do plano em `docs/plano_demanda_cliente_2.md`;
C1, A2 e A3 estão entregues, e nada a trava.

## What Changes

- **Menu**: item **Leitura obrigatória** no grupo NAVEGAÇÃO, entre
  Compartilhados comigo e Lixeira (ordem da tabela 1.1), para qualquer papel,
  com **contador** das leituras abertas (pendentes e atrasadas) quando houver.
- **Destino `/leituras`**: abas **Pendentes** (pendentes e atrasadas, a
  atrasada sinalizada) e **Concluídas** (com data e hora da ciência). Cada
  pendente tem **"Ler e confirmar ciência"**, que abre o documento no
  visualizador — onde a ciência já é confirmada desde a C1.
- **Início**: o cartão reservado "Leitura obrigatória" passa a listar as
  pendências, com documento, prazo e o botão "Ler e confirmar ciência", e o
  link para a lista completa; sem pendências, diz que não há nenhuma. O
  cartão "Avisos" continua reservado (C3).
- **Documentos**: ícone de leitura obrigatória ao lado do nome do arquivo cuja
  **revisão vigente** está marcada. O veredito vem do servidor, numa coluna
  nova do resumo de arquivo (`requiredReading`), apurada na mesma consulta da
  listagem.

### Fora desta fatia

- Aba **Acompanhamento** (C4); avisos no sino e aviso de atraso (C3); marcar
  na etapa final do envio.
- O aviso "pedir nova ciência?" **no momento de substituir** o arquivo, que a
  C1 deixou para cá: a SPA ainda **não tem** tela de substituição de arquivo
  (só a API, `POST /files/:id/replace-url`), então não há onde apresentá-lo.
  O pedido continua acontecendo ao reabrir a marcação, com o público anterior
  preenchido (US 12.2, cenário 4).

## Capabilities

### New Capabilities

_(nenhuma)_

### Modified Capabilities

- `leitura-obrigatoria` — o resumo de arquivo informa se a revisão vigente é
  de leitura obrigatória; o leitor tem a lista das próprias leituras.
- `tela-inicial` — o cartão "Leitura obrigatória" deixa de ser reservado.
- `web-shell-e-auth` — item de menu com contador.
- `web-navegacao` — ícone na linha do arquivo.

## Impact

- **API**: `lib/document-control.ts` (coluna `required_reading` em
  `fileSummaryColumns`); sem rota nova, sem migração, sem prefixo novo.
- **Shared**: `FileSummaryResponse.requiredReading?`.
- **Web**: `leitura/LeiturasPage.tsx` e `leitura/CartaoDeLeituras.tsx` (novos),
  `leitura/queries.ts` (contagem das abertas), `AppShell.tsx` (item e
  contador), `router.tsx` (rota `/leituras`), `InicioPage.tsx` (cartão),
  `ExplorerPage.tsx` (ícone), `lib/schemas.ts`.
- **Documentação**: manual (página de leitura obrigatória e tela inicial); PRD
  (US 12.4); plano (C2 entregue).
