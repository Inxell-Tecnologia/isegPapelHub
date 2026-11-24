# Tasks

## 1. Contagem de documentos novos (API)

- [x] 1.1 Acrescentar `newWindowDays` (padrão 7) a `config.recentDocuments` e o
  DTO `NewDocumentsCountResponse` (`days`, `count`, `capped`) em
  `packages/shared/src/recent.ts`; recompilar o shared.
- [x] 1.2 Implementar `GET /files/recent/new-count` em `routes/recent.ts`:
  candidatos da unidade do contexto (comparação explícita de `unit_id`), ativos,
  fora da lixeira, publicados na janela pelo relógio do Postgres, até
  `candidateLimit + 1`; cada um por `hasAccess(view)` (design.md D1–D3).
- [x] 1.3 Testes em `recentes.test.ts`: conta só o permitido; não atravessa
  unidades (inclusive `global_admin`); publicado antes da janela e alterado
  depois não conta; obsoleto não conta para colaborador; `capped` quando o teto
  é excedido; 401 sem sessão.

## 2. Tela Início (web)

- [x] 2.1 Saudação por horário com primeiro nome em `shell/identidade.ts`, com
  o instante por parâmetro (design.md D9).
- [x] 2.2 Consulta `useNewDocumentsCount` e o fragmento da linha abaixo da
  saudação ("N documento(s) novo(s) nos últimos 7 dias", "mais de N",
  omitido em carregamento e falha).
- [x] 2.3 Quatro atalhos (design.md D4): `inicio/atalhos.ts` com Enviar
  documento, Nova pasta, Buscar documento e Manual do usuário (condicionado a
  `manualUrl`), cartões soltos com ícone colorido; nome acessível do manual
  extraído do `AppShell` para módulo compartilhado.
- [x] 2.4 Pedido de nova pasta (design.md D5): módulo do parâmetro em
  `navegacao/`, atendimento no `ExplorerPage` só na raiz, uma vez.
- [x] 2.5 Busca sem termo foca o campo (design.md D6).
- [x] 2.6 "Pastas da unidade" com "Ver todas as pastas"; "Documentos recentes"
  com as colunas da demanda, 5 linhas na tela Início e "Ver histórico
  completo"; título do destino Recentes (design.md D7).
- [x] 2.7 Coluna direita com os dois cartões e o layout com `flex-wrap`
  (design.md D8).
- [x] 2.8 Testes em `tela-inicial.test.tsx`, `explorer.test.tsx` e
  `busca.test.tsx` cobrindo os cenários dos deltas.

## 3. Documentação e fechamento

- [x] 3.1 Atualizar `docs/manual/docs/a-tela.md` e
  `docs/manual/docs/referencia/tarefas-rapidas.md`.
- [x] 3.2 Atualizar US 11.1 e 11.2 em `docs/prd_final.md`.
- [x] 3.3 Atualizar a A3 no plano (status, desvios, lacunas).
- [x] 3.4 `npm run lint`, `npm run build`, `npm run test`,
  `npm run format:check`; conferir a tela no navegador em 1440 e 375 px.
