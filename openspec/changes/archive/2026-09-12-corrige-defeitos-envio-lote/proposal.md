# Proposal — corrige-defeitos-envio-lote

## Why

O envio em lote (`envio-lote`, `envio-pasta`, `web-upload`) entregou o contrato
certo — URL assinada por item, veredito independente, hierarquia recriada — mas
carrega quatro defeitos que só aparecem em **escala real de pasta**. Com pastas
de até 1.000 arquivos, que é o uso corrente, três deles disparam sempre e o
quarto arruína a recuperação.

Nenhum é hipotético. Foram medidos contra o `express@4.22.2` instalado e contra
o código em `apps/web/src/upload/UploadArea.tsx`.

**Defeito 1 — uma pasta de 1.000 arquivos não sobe, e a mensagem mente.**
`app.ts` monta `express.json()` sem `limit`, o que vale 100 KB de corpo. Um
`POST /files/upload-urls` com 1.000 itens pesa, medido:

| Cenário (1.000 arquivos) | Corpo | Hoje |
| -------------------------- | ------- | ------ |
| Nomes curtos (`a.pdf`), sem subpasta | 78,2 KB | passa |
| Nomes reais, sem subpasta | 109,3 KB | **recusado** |
| Nomes reais + subpastas | 153,3 KB | **recusado** |
| Fotos de vistoria (`IMG_20240001.HEIC`) | 125,1 KB | **recusado** |

O `body-parser` levanta `entity.too.large` com `status: 413`, mas o
`errorHandler` de `app.ts` responde **500** para qualquer erro. A SPA cai no
ramo genérico de `handleDestinationError` e exibe *"Não foi possível solicitar o
envio. Tente novamente."* — um convite a repetir uma operação que falhará
sempre, de forma idêntica, sem nunca revelar o motivo.

**Defeito 2 — o "Repetir" reusa URL expirada, e falha para sempre.**
`UploadArea.tsx` guarda `uploadUrl` mas descarta o `expiresAt` que a API já
devolve. No `retryItem`, a presença de `uploadUrl` manda direto para o `runPut`
— então um item que falhou **porque a URL venceu** é retentado com a mesma URL
vencida, indefinidamente. O caminho de renovação existe, mas só atende itens que
o servidor recusou de saída.

**Defeito 3 — nenhuma fila: N transferências disparam de uma vez.** O laço
final do `startBatch` chama `runPut` para todos os itens aceitos, sem teto. O
GCS fala **HTTP/2**, que multiplexa: não há o limite implícito de ~6 conexões
por host do HTTP/1.1. Mil PUTs viram mil streams simultâneos dividindo a mesma
banda — todos rastejam juntos, nenhum conclui cedo, e uma queda no meio deixa
mil arquivos pela metade em vez de seiscentos concluídos e quatrocentos
pendentes.

**Defeito 4 — a URL de envio herda o prazo do download.** `getUploadUrl` assina
com `config.signedUrlDownloadTtlSeconds` (1800 s). O comentário no próprio
`gcs-storage-port.ts` registra a escolha como conveniência. Envio e download não
têm relação: 1.000 arquivos de escritório somam ~1,07 GB, que a 5 Mbps levam
**31 minutos** — dentro da mesma ordem de grandeza do prazo, e além dele em
conexões piores ou acervos mais pesados. Combinado com o defeito 3, a cauda da
fila chega com a URL morta; combinado com o defeito 2, ela nunca se recupera.

Esta mudança conserta os quatro. Ela **não** acrescenta recurso de usuário: o
fatiamento, a pré-checagem de cota, o arrastar-e-soltar e a barra macro são a
fatia seguinte (`envio-multiplas-pastas-com-prechecagem`), que assume estes
consertos como base.

## What Changes

- **Erro de cliente deixa de virar 500.** O `errorHandler` de `app.ts` passa a
  propagar o status de erros de requisição malformada — corpo grande demais
  (413) e JSON inválido (400) — com um código estável, mantendo **500 opaco**
  para todo o resto. A superfície é deliberadamente fechada: só erros
  reconhecidos do parser de corpo, nunca `err.status` arbitrário, e nunca a
  mensagem interna. Ver D1.
- **Teto de corpo explícito e folgado.** `express.json({ limit })` passa a ler
  `config.requestBodyMaxBytes` (padrão 1 MB), no molde dos demais tetos
  configuráveis do `config.ts`. Deixar o teto de rota refém do padrão de uma
  biblioteca é o acoplamento que produziu o defeito 1.
- **Teto de itens por requisição, com erro próprio.** `POST /files/upload-urls`
  passa a recusar requisições acima de `config.uploadBatch.maxItems` (padrão
  500) com `400 upload_batch_limit_exceeded`, exatamente no molde de
  `move_batch_limit_exceeded` e `download_manifest_limit_exceeded`. O padrão é
  compartilhado pela `packages/shared` (`UPLOAD_BATCH_MAX_ITEMS_DEFAULT`) para a
  SPA recusar **antes** da requisição, sem endpoint de leitura novo — o mesmo
  padrão de `MOVE_BATCH_MAX_ITEMS_DEFAULT`. Ver D2.
- **Prazo próprio da URL de envio.** `config.signedUrlUploadTtlSeconds`
  (`SIGNED_URL_UPLOAD_TTL_SECONDS`, padrão 3600), consumido por `getUploadUrl`.
  `view` (300 s) e `download` (1800 s) ficam intactos. Ver D3.
- **Fila de transferência com concorrência fixa.** A SPA passa a transferir no
  máximo `UPLOAD_CONCURRENCY` (4) arquivos ao mesmo tempo, drenando os demais em
  ordem. A fila é do componente, não global. Ver D4.
- **Renovação da URL vencida no "Repetir".** `UploadItem` passa a guardar o
  `expiresAt` que a API já devolve; o `retryItem` reusa a URL apenas enquanto
  ela estiver **vigente com margem**, e pede uma nova quando não estiver. Ver D5.

Fora de escopo (registrado em design.md):

- **Fatiamento do envio, pré-checagem de cota, endpoint de consulta de espaço,
  arrastar-e-soltar, barra de progresso macro.** São a fatia
  `envio-multiplas-pastas-com-prechecagem`. Aqui o teto de itens é uma **recusa
  honesta**; lá ele deixa de ser visível ao usuário porque o envio passa a ser
  fatiado abaixo dele.
- **Envio retomável / em pedaços (resumable).** Continua deferido desde
  `epico-3-envio-lote-e-pasta` — o contrato "uma URL, um PUT" não muda aqui.
- **Expurgo imediato da lixeira.** Fatia própria (`esvaziar-lixeira`).
- **Retomar um envio interrompido após fechar a aba.** Nenhuma das duas fatias
  o cobre; permanece dívida conhecida.

## Capabilities

### New Capabilities

<!-- Nenhuma capability nova: todos os requisitos estendem ou corrigem os já existentes. -->

### Modified Capabilities

- `envio-lote`: a emissão de URLs em lote ganha teto explícito de itens por
  requisição, e a recusa por requisição grande demais ou malformada passa a ser
  distinguível de falha interna do servidor.
- `web-upload`: a transferência passa a ser limitada por fila de concorrência, e
  a nova tentativa passa a renovar a URL assinada quando ela não está mais
  vigente.
- `platform-infrastructure`: a diferenciação de prazo de URL assinada por
  operação — hoje escrita só para visualizar e baixar — passa a cobrir também o
  envio, com prazo próprio.

## Impact

- **Banco:** nenhuma migração. Nenhuma tabela, coluna ou policy RLS é tocada.
- **API (`apps/api/src`):** `app.ts` (limite do `express.json`, `errorHandler`);
  `config.ts` (`requestBodyMaxBytes`, `uploadBatch.maxItems`,
  `signedUrlUploadTtlSeconds`); `routes/files.ts` (teto em
  `POST /files/upload-urls`); `adapters/gcs-storage-port.ts` e o adapter de
  memória (prazo próprio de envio).
- **Shared (`packages/shared/src`):** `UPLOAD_BATCH_MAX_ITEMS_DEFAULT` e o
  código `upload_batch_limit_exceeded`. Exige
  `npm run build --workspace packages/shared`.
- **Web (`apps/web/src/upload`):** `UploadArea.tsx` (fila de concorrência,
  `expiresAt` no item, recusa antecipada pelo teto compartilhado,
  reconhecimento do novo código de erro).
- **Rotas e prefixos:** nenhum prefixo de topo novo. A invariante das três
  pontas (`api-prefixes.ts`, `vite.config.ts`, `locals.tf`) segue intacta e
  `web-serving.test.ts` continua válido sem alteração.
- **Infraestrutura:** nenhuma. Duas variáveis novas em `.env.example` e, em
  produção, valores de ambiente do Cloud Run — sem Terraform novo, sem job, sem
  tópico.
- **Invariantes preservados, sem exceção:** bytes continuam sem passar pela API;
  bucket privado com URL assinada de TTL curto por operação; permissão checada
  no servidor antes de qualquer assinatura; `withTenantTransaction` e a RLS por
  `unit_id` inalterados; a reserva de cota consciente do lote segue como está.
- **Documentação:** `docs/manual/docs/referencia/limites.md` ganha a linha do
  teto de itens por envio; `.env.example` ganha as variáveis novas. O PRD não
  muda — nenhuma US nova, estes são defeitos contra as US 3.1/3.2 já escritas.
- **Testes:** recusa de lote acima do teto com o código próprio e **sem** inserir
  linha `pending`; corpo acima do limite respondendo 413 e não 500; JSON inválido
  respondendo 400; erro interno continuando 500 opaco; prazo da URL de envio
  distinto do de download; na web, no máximo N PUTs simultâneos, drenagem da
  fila em ordem, e o "Repetir" pedindo URL nova quando o `expiresAt` já passou.
