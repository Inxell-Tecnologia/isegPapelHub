## 1. Contratos compartilhados (`packages/shared`)

- [x] 1.1 Definir `UPLOAD_BATCH_MAX_ITEMS_DEFAULT = 500`, no molde de
  `MOVE_BATCH_MAX_ITEMS_DEFAULT` (`packages/shared/src/folders.ts`) — verificar
  que a constante é exportada e consumível a partir de `dist/`.
- [x] 1.2 Acrescentar o código de erro `upload_batch_limit_exceeded` ao DTO de
  resposta do envio em lote, no molde de `move_batch_limit_exceeded` — verificar
  que o tipo discrimina corretamente contra os erros por item já existentes.
- [x] 1.3 Recompilar (`npm run build --workspace packages/shared`) para que api e
  web enxerguem os símbolos novos.

## 2. Configuração (`apps/api`)

- [x] 2.1 Acrescentar `config.requestBodyMaxBytes` lido de
  `REQUEST_BODY_MAX_BYTES` com padrão de 1 MB — verificar que o padrão vale sem a
  variável definida e que a variável o sobrescreve.
- [x] 2.2 Acrescentar `config.uploadBatch.maxItems` lido de
  `UPLOAD_BATCH_MAX_ITEMS` com padrão `UPLOAD_BATCH_MAX_ITEMS_DEFAULT`, no molde
  de `config.moveBatch` (design.md D2).
- [x] 2.3 Acrescentar `config.signedUrlUploadTtlSeconds` lido de
  `SIGNED_URL_UPLOAD_TTL_SECONDS` com padrão 3600 (design.md D3) — verificar que
  `signedUrlViewTtlSeconds` e `signedUrlDownloadTtlSeconds` seguem inalterados.
- [x] 2.4 Documentar `REQUEST_BODY_MAX_BYTES`, `UPLOAD_BATCH_MAX_ITEMS` e
  `SIGNED_URL_UPLOAD_TTL_SECONDS` em `.env.example`, junto dos TTLs e tetos já
  listados.

## 3. Tratamento de erro da API (`apps/api/src/app.ts`)

- [x] 3.1 Passar `{ limit: config.requestBodyMaxBytes }` ao `express.json()` —
  verificar com teste que um corpo acima do limite é recusado e que um corpo de
  500 itens de envio no pior caso de nome passa.
- [x] 3.2 Reescrever o `errorHandler` para mapear `err.type === 'entity.too.large'`
  → `413 { error: 'request_body_too_large' }` e
  `err.type === 'entity.parse.failed'` → `400 { error: 'invalid_json' }`,
  mantendo `500 { error: 'internal_error' }` para todo o resto (design.md D1) —
  verificar com teste os três caminhos, e que a mensagem do erro original nunca
  aparece na resposta.
- [x] 3.3 Verificar com teste que o handler **não** propaga `err.status` de um
  erro arbitrário decorado com status — só os dois `err.type` reconhecidos
  mudam o status.

## 4. Teto de itens no envio em lote (`apps/api/src/routes/files.ts`)

- [x] 4.1 Recusar em `POST /files/upload-urls` a lista acima de
  `config.uploadBatch.maxItems` com `400 upload_batch_limit_exceeded`, **antes**
  de `withTenantTransaction` — verificar com teste que nenhuma linha `pending` é
  inserida, nenhuma pasta é criada e nenhuma URL é assinada.
- [x] 4.2 Verificar com teste que uma lista com exatamente o teto é aceita e
  processada normalmente (fronteira inclusiva).
- [x] 4.3 Verificar que a recusa por lista vazia, já existente, continua
  respondendo `400 invalid request body` e não foi absorvida pelo teto novo.

## 5. Prazo próprio da URL de envio (`apps/api/src/adapters`)

- [x] 5.1 Fazer `getUploadUrl` do `gcs-storage-port.ts` assinar com
  `config.signedUrlUploadTtlSeconds` em vez de `signedUrlDownloadTtlSeconds`
  (design.md D3) — manter o comentário sobre `action: 'write'` e o fake-gcs, que
  continua válido.
- [x] 5.2 Refletir o mesmo prazo no `in-memory-storage-port` usado pelos testes,
  para que a paridade dev↔prod do seam não se perca.
- [x] 5.3 Verificar com teste que alterar o TTL de download não altera o
  `expiresAt` devolvido pelo envio.

## 6. Fila de transferência (`apps/web/src/upload`)

- [x] 6.1 Extrair do `UploadArea.tsx` a orquestração de transferências para uma
  fila com concorrência máxima `UPLOAD_CONCURRENCY` (4), que inicia o próximo
  item quando uma transferência termina por sucesso **ou** por falha
  (design.md D4).
- [x] 6.2 Introduzir o estado "enfileirado", distinguível de "em transferência"
  na lista de itens — verificar com teste que um item aguardando não é exibido
  como parado nem como falho.
- [x] 6.3 Verificar com teste (mock de XHR) que, com N arquivos aceitos e N maior
  que o teto, nunca há mais que `UPLOAD_CONCURRENCY` PUTs em andamento, e que a
  fila drena por completo.
- [x] 6.4 Verificar com teste que a falha de um item libera a vaga imediatamente
  para o próximo da fila.

## 7. Renovação da URL vencida (`apps/web/src/upload/UploadArea.tsx`)

- [x] 7.1 Guardar `expiresAt` no `UploadItem` a partir do
  `BatchUploadItemSuccess` já devolvido pela API (hoje descartado).
- [x] 7.2 Fazer o `retryItem` pedir URL nova quando `expiresAt` já passou ou está
  dentro da margem de 60 s, e reusar a URL apenas fora disso (design.md D5).
- [x] 7.3 Fazer uma segunda falha do mesmo item pedir URL nova
  independentemente do `expiresAt`, para que o relógio do cliente não seja a
  garantia de correção (design.md D5).
- [x] 7.4 Verificar com teste que repetir um item com `expiresAt` no passado
  dispara uma nova requisição de URLs, e que repetir um item com `expiresAt`
  folgado reusa a URL sem requisição adicional.

## 8. Recusa antecipada na SPA (`apps/web/src/upload`)

- [x] 8.1 Recusar no `startBatch`, antes da requisição, a seleção acima de
  `UPLOAD_BATCH_MAX_ITEMS_DEFAULT`, informando o teto — verificar com teste que
  nenhuma requisição é emitida.
- [x] 8.2 Reconhecer `upload_batch_limit_exceeded` vindo do servidor em
  `handleDestinationError` e apresentá-lo como recusa por quantidade, não como
  "tente novamente" — verificar com teste a mensagem exibida.

## 9. Documentação

- [x] 9.1 Acrescentar a `docs/manual/docs/referencia/limites.md` a linha do teto
  de arquivos por requisição de envio, com a variável `UPLOAD_BATCH_MAX_ITEMS`,
  na tabela de limites vigentes.
- [x] 9.2 Ajustar `docs/manual/docs/colaborador/enviar.md` para mencionar o teto
  por envio com fidelidade à tela entregue — sem descrever fatiamento,
  arrastar-e-soltar ou pré-checagem, que são da fatia seguinte.

## 10. Fechamento

- [x] 10.1 Rodar `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` na raiz, com tudo verde.
- [x] 10.2 Verificar que `__tests__/web-serving.test.ts` continua passando sem
  alteração — nenhum prefixo de rota de topo foi introduzido.
