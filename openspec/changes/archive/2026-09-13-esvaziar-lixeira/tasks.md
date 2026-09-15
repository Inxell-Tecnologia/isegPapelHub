> **Independente das demais fatias de envio.** Não é pré-requisito de
> `corrige-defeitos-envio-lote` nem de `envio-multiplas-pastas-com-prechecagem`,
> e nenhuma delas depende desta. O que ela acrescenta é a saída acionável para a
> recusa detalhada por falta de espaço.

## 1. Extração da sequência de expurgo (`apps/api/src/lib`)

- [x] 1.1 Extrair de `jobs/purge-trash.ts` para `lib/purge-file.ts` a sequência
  de expurgo de um arquivo — bytes do objeto e do `pending_object_path`, cota,
  auditoria, grants, linha por último, nessa ordem (design.md D3).
- [x] 1.2 Fazer `purgeExpiredFiles` consumir a função extraída, mantendo a
  seleção por `deleted_at` vencido e o contexto de sistema onde estão — a
  seleção **não** vai para a função compartilhada.
- [x] 1.3 Verificar que os testes existentes do job `purge-trash` passam sem
  alteração alguma após a extração.

## 2. Contratos compartilhados (`packages/shared`)

- [x] 2.1 Definir o DTO da resposta do expurgo (`purgedFiles`,
  `reclaimedBytes`, `failedFiles`).
- [x] 2.2 Recompilar (`npm run build --workspace packages/shared`).

## 3. Rota de expurgo sob demanda (`apps/api/src/routes/trash.ts`)

- [x] 3.1 Implementar `POST /trash/purge` sob `attachTenantContext`,
  selecionando arquivos com `deleted_at IS NOT NULL` e `owner_id = ctx.userId`,
  **sem** filtro de prazo (design.md D2).
- [x] 3.2 Aplicar a função de `lib/purge-file.ts` a cada arquivo selecionado,
  com tolerância a falha por item, acumulando apagados, bytes devolvidos e falhas.
- [x] 3.3 Verificar com teste que a cota do solicitante é reduzida exatamente
  pela soma dos `size_bytes` dos arquivos efetivamente apagados.
- [x] 3.4 Verificar com teste que arquivos de **outra pessoa da mesma unidade**
  na lixeira não são apagados e seguem restauráveis.
- [x] 3.5 Verificar com teste que arquivos de **outra unidade** são
  inalcançáveis, e que um administrador global recebe o expurgo da própria
  lixeira, não a de terceiro (design.md D2 — o bypass de `global_admin` não é
  usado aqui).
- [x] 3.6 Verificar com teste que **pastas** na lixeira do solicitante permanecem
  intactas após o expurgo (design.md D1).
- [x] 3.7 Verificar com teste que a falha ao remover os bytes de um arquivo não
  impede o expurgo dos demais e que o arquivo que falhou continua na lixeira.
- [x] 3.8 Verificar com teste que os grants e a auditoria dos arquivos apagados
  são removidos junto, como no job.

## 4. Ação na SPA (`apps/web/src/lixeira`)

- [x] 4.1 Acrescentar a ação "Esvaziar lixeira" na página da lixeira, visível
  quando houver arquivos próprios na lixeira.
- [x] 4.2 Implementar a confirmação quantificada: quantos arquivos serão
  apagados, quanto espaço retorna, e o aviso de que a ação não tem volta
  (design.md D4) — verificar com teste que nada é enviado antes de confirmar.
- [x] 4.3 Invalidar, após o expurgo, a listagem da lixeira e a consulta de cota,
  para que o espaço recuperado apareça de imediato.
- [x] 4.4 Apresentar o resultado, incluindo a quantidade que falhou quando houver.

## 5. Documentação

- [x] 5.1 Atualizar a página da lixeira no manual do colaborador com a ação, o
  alcance (só arquivos próprios, pastas não) e a irreversibilidade.
- [x] 5.2 Ajustar a página de envio do manual para apontar esvaziar a lixeira
  como caminho real de liberação de espaço — mantendo correta a afirmação de que
  **excluir** um arquivo, por si só, não devolve cota.
- [x] 5.3 Acrescentar ao `docs/prd_final.md` a US correspondente no Épico 6, com
  os cenários Dado/Quando/Então que esta spec referencia.

## 6. Fechamento

- [x] 6.1 Rodar `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` na raiz, com tudo verde.
- [x] 6.2 Verificar que `web-serving.test.ts` continua passando sem alteração —
  `/trash` já está nas três pontas, nenhum prefixo novo foi introduzido.
