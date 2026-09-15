# Design — corrige-defeitos-envio-lote

## Contexto

Quatro defeitos independentes, com uma causa comum: o envio em lote foi
desenhado e testado em lotes pequenos, e nenhuma das quatro decisões implícitas
foi escrita como decisão. O change `epico-3-envio-lote-e-pasta` registrou
honestamente a lacuna em "Open Questions":

> Tamanho máximo do lote (nº de itens por requisição) — proposta: limite de
> sanidade configurável, sem bloquear o design; decidir na implementação.

Nunca foi decidido. As outras três (prazo da URL de envio, concorrência de
transferência, vigência no retry) nem chegaram a ser perguntadas.

Medições que sustentam os números abaixo, feitas contra o `express@4.22.2`
instalado e um perfil misto de documentos de escritório (PDF digital 30%, docx
20%, PDF escaneado 15%, xlsx 15%, jpg de câmera 12%, jpg digitalizado 8% —
média ponderada de **1,1 MB** por arquivo):

| Medida | Valor |
| -------- | ------- |
| Item de `upload-urls` em JSON, pior caso (nome real + subpasta) | 153 bytes |
| 1.000 itens, nomes reais + subpastas | 153,3 KB |
| Teto de corpo do `express.json()` sem `limit` | 100 KB (102.400 bytes) |
| Maior lote que passa hoje, nomes reais + subpastas | **652 itens** |
| Maior lote que passa hoje, nomes curtos sem subpasta | 1.279 itens |
| 1.000 arquivos do perfil misto | 1,07 GB |
| 1,07 GB a 5 Mbps | 31 min |
| Prazo da URL de envio hoje | 30 min |

## Decisões

### D1 — Erro de requisição do cliente deixa de virar 500, com superfície fechada

O `errorHandler` de `app.ts` responde `500 { error: 'internal_error' }` para
qualquer exceção. É a postura certa por padrão — não vazar mensagem interna nem
stack — mas engole a informação **que o cliente precisa** para se corrigir.

A correção **não** é propagar `err.status` genericamente. Isso alargaria a
superfície para qualquer biblioteca que decore um erro com `status`, e um dia
exporia uma mensagem interna num 4xx. A correção é reconhecer **apenas** os
erros do parser de corpo, pelo `err.type` que o `body-parser` define:

| `err.type` | Resposta |
| ------------ | ---------- |
| `entity.too.large` | `413 { error: 'request_body_too_large' }` |
| `entity.parse.failed` | `400 { error: 'invalid_json' }` |
| qualquer outro | `500 { error: 'internal_error' }`, como hoje |

O código é nosso, estável e sem conteúdo interno; a mensagem do erro original
**não** é repassada. O `console.error(err)` permanece para os dois casos — um
cliente batendo no teto é sinal operacional, não ruído.

A regra mora numa **função pura exportada**, `mapErrorResponse(err)`, e o
`errorHandler` só a chama e escreve a resposta. A separação existe por
testabilidade: o handler vive dentro de `createApp` e é registrado por último,
de modo que só é alcançável através de uma rota já montada — e a garantia que
esta decisão mais preza é uma **negativa** (`err.status` arbitrário não passa,
`type` desconhecido não passa, a mensagem original nunca sai), que exige
exercitar entradas que nenhuma rota real produz. Com a função pura, essas
negativas são casos de teste diretos, sem `res` de mentira e sem inventar uma
rota que lance o erro desejado.

**Alternativa descartada:** tratar o 413 só na rota de envio, com um middleware
próprio antes do `express.json`. Resolveria o sintoma no caminho conhecido e
deixaria todas as outras rotas mentindo do mesmo jeito. O defeito é do handler,
e é lá que se conserta.

### D2 — Teto de itens por requisição, compartilhado com a SPA

`config.uploadBatch.maxItems`, padrão **500**, recusando com
`400 upload_batch_limit_exceeded` **antes** de abrir a transação — nenhuma linha
`pending`, nenhuma pasta criada, nenhuma URL assinada.

Por que 500, e não o maior valor que caberia no corpo: o teto de itens e o teto
de bytes do corpo são guardas de coisas diferentes, e amarrar um ao outro
reproduz o acoplamento que causou o defeito 1. 500 itens no pior caso medido
dão ~76 KB, confortáveis dentro de 1 MB, e mantêm a transação do
`upload-urls` — que faz `ensureFolderPath` + `INSERT` **sequenciais** por item —
num tamanho que não segura locks por tempo desproporcional.

O padrão vai para `packages/shared` como `UPLOAD_BATCH_MAX_ITEMS_DEFAULT`, no
molde exato de `MOVE_BATCH_MAX_ITEMS_DEFAULT`, para a SPA recusar antes da
requisição sem precisar de endpoint de leitura novo. O servidor **continua
validando**: o compartilhamento é conveniência de UX, nunca a guarda.

Nota de transição: 500 é **menor** que os 652–1.279 que hoje passam por acidente
em alguns formatos de nome. Isso é deliberado — um teto honesto e uniforme,
recusado com mensagem clara, é melhor que um teto invisível que depende do
comprimento dos nomes de arquivo do usuário. E ele deixa de ser visível na fatia
seguinte, quando o envio passa a ser fatiado abaixo dele.

### D3 — Prazo próprio da URL assinada de envio

`config.signedUrlUploadTtlSeconds` (`SIGNED_URL_UPLOAD_TTL_SECONDS`, padrão
**3600**), consumido por `getUploadUrl` nos dois adapters. `view` (300 s) e
`download` (1800 s) ficam intactos.

O CLAUDE.md já exige "TTL curto diferenciado por operação"; hoje o envio não tem
o seu — ele pega emprestado o do download, e o comentário em
`gcs-storage-port.ts` registra isso como conveniência, não como decisão.

Postura de segurança da ampliação para 1 h: a URL de envio é menos sensível que
a de download, não mais. Ela autoriza **escrita de um único `object_path` que
ainda não existe**, com `Content-Type` fixado na assinatura, sob um prefixo
`/{unit_id}/{owner_id}/{uuid}` já reservado por uma linha `pending` do próprio
autor. Um vazamento permite gravar bytes naquele objeto — que a reconciliação do
finalize contabilizaria na cota de quem pediu — e **não** permite ler nada, nem
alcançar outro objeto, nem outra unidade. A URL de download, que expõe conteúdo,
continua em 30 min.

**Alternativa descartada:** manter 1800 s e resolver a expiração só com fila e
fatiamento. Reduz a pressão mas não a elimina, e mantém no código um acoplamento
que ninguém decidiu.

### D4 — Fila de concorrência fixa no cliente

`UPLOAD_CONCURRENCY = 4`, no módulo de envio da SPA. O `startBatch` deixa de
disparar `runPut` num laço sobre todos os aceitos e passa a alimentar uma fila
que mantém no máximo 4 transferências vivas, iniciando a próxima quando uma
termina — com ou sem sucesso.

A premissa de que "o navegador já limita a ~6 por host" é **falsa** aqui: ela
vale para HTTP/1.1, e o GCS fala HTTP/2, que multiplexa streams sobre poucas
conexões. Sem fila, mil PUTs são mil streams concorrentes dividindo a mesma
banda: nenhum conclui cedo, todas as barras rastejam juntas, e o custo de uma
interrupção é máximo — mil arquivos pela metade em vez de N concluídos e o resto
intocado.

4 e não 6: a fila serve para **fazer arquivo virar arquivo concluído**, não para
saturar o link. Quatro transferências dão paralelismo suficiente para cobrir
latência de handshake e a variação de tamanho entre um docx de 180 KB e um PDF
escaneado de 2,6 MB, mantendo a taxa de conclusão alta e o custo de interrupção
baixo. É configurável, e a fatia seguinte, que introduz o fatiamento, herda a
mesma fila atravessando as fatias sem reiniciar.

### D5 — Vigência avaliada no retry, com margem

`UploadItem` passa a guardar o `expiresAt` que `BatchUploadItemSuccess` **já
devolve** e que hoje é descartado. O `retryItem` passa a decidir assim:

```
  tem uploadUrl?
       │
       ├─ não ──▶ pede URL nova  (comportamento atual, inalterado)
       │
       └─ sim ──▶ expiresAt − agora > margem ?
                       │
                       ├─ sim ──▶ reusa a URL   (comportamento atual)
                       │
                       └─ não ──▶ pede URL nova  ◀── o conserto
```

A margem existe porque o item pode ficar na fila antes do PUT começar, e uma URL
que vence no meio da transferência falha igual a uma vencida antes dela. Margem
de 60 s, com o relógio do cliente — e é aqui que cabe a única ressalva honesta:
o relógio do navegador pode estar errado. Por isso a margem **não** é a única
defesa: um PUT que falhe é retentável, e uma segunda falha com a URL julgada
vigente pede renovação assim mesmo. O relógio do cliente decide uma otimização
(evitar uma requisição inútil), nunca a correção.

Não se avalia vigência **fora** do retry: o caminho normal do `startBatch` usa a
URL recém-emitida, e a fila de D4 mantém a distância entre emissão e uso
pequena.

## Riscos

- **O teto de 500 reduz o que hoje passa por acidente.** Mitigado por ser
  configurável, por vir com erro nomeado em vez de 500 mudo, e por ser
  temporário como limite visível — a fatia seguinte fatia abaixo dele. Uma pasta
  de 1.000 arquivos, que hoje falha sem explicação, passa a falhar **com**
  explicação; o envio de fato só passa a funcionar na fatia seguinte. É uma
  troca deliberada de "quebrado e mudo" por "recusado e claro".
- **Propagar status no `errorHandler` é mudança cross-cutting.** Mitigado pela
  superfície fechada de D1: dois `err.type` conhecidos, códigos próprios, nunca
  a mensagem original, 500 opaco para todo o resto.
- **Relógio do cliente errado.** Tratado em D5: a vigência é otimização, não
  correção.

**Rollback:** nenhuma migração, nenhum dado tocado. Reverter é o redeploy da
imagem anterior; as variáveis novas voltam a não ser lidas e os padrões antigos
(100 KB de corpo, 1800 s de prazo) retornam sem intervenção.

## Open Questions

- **Padrão de `UPLOAD_CONCURRENCY` sob rede corporativa real.** 4 é escolha
  fundamentada, não medida em campo. Fica como variável para ajuste sem deploy
  de código, e a fatia seguinte — que envia acervos maiores — é a que dará o
  dado.
