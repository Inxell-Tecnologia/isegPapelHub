# Tasks

## 1. API e contrato

- [x] 1.1 `FileSummaryResponse.requiredReading?` em `packages/shared`.
- [x] 1.2 `fileSummaryColumns`: coluna `required_reading` (revisão atual
  marcada, não obsoleto) e projeção em `toFileSummaryResponse` (design.md D4).
- [x] 1.3 Testes: listagem com revisão marcada, revisão nova sem marcação e
  obsoleto (admin).

## 2. Web

- [x] 2.1 `lib/schemas.ts`: `requiredReading` opcional com `.catch(undefined)`.
- [x] 2.2 `leitura/queries.ts`: leituras abertas e contagem derivadas de
  `useMyReadings` (design.md D1, D2).
- [x] 2.3 Destino `/leituras` (`LeiturasPage`) com abas Pendentes e
  Concluídas; "Ler e confirmar ciência" abre o `PreviewModal` (D3, D5).
- [x] 2.4 Item Leitura obrigatória no menu, entre Compartilhados e Lixeira,
  com contador e nome acessível com a contagem (D6).
- [x] 2.5 Cartão "Leitura obrigatória" do Início com as pendências, prazo,
  botão e "Ver todas"; "Avisos" continua reservado.
- [x] 2.6 Ícone na linha do arquivo do explorador por `requiredReading` (D4).
- [x] 2.7 Testes dos cenários de `tela-inicial`, `web-shell-e-auth`,
  `web-navegacao` e `leitura-obrigatoria`.

## 3. Documentação e fechamento

- [x] 3.1 Manual: página de leitura obrigatória (abas, cartão, ícone) e tela
  inicial.
- [x] 3.2 PRD: US 12.4.
- [x] 3.3 Plano: C2 entregue, lacunas.
- [x] 3.4 `lint`, `build`, `test`, `format:check`; conferir no navegador.
