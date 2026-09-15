# Proposal — envio-multiplas-pastas-com-prechecagem

## Why

Enviar pasta hoje é **uma pasta por vez**, e a pessoa só descobre se o envio era
viável **depois** de tentar — item a item, pelo erro `quota exceeded` que a API
devolve no meio do lote. Com pastas de até 1.000 arquivos e o hábito de enviar
duas ou três de uma vez, isso significa começar uma transferência de dezenas de
minutos sem saber se ela cabe.

Três lacunas se somam.

**1. Não dá para selecionar mais de uma pasta.** O botão "Enviar pasta" usa
`webkitdirectory`, e **nenhum navegador** permite escolher duas pastas no mesmo
diálogo — não é limitação do produto. A `File System Access API`
(`showDirectoryPicker()`) também é uma pasta por vez, e não existe em Firefox nem
Safari. A única interação que seleciona várias pastas de uma vez é **arrastar e
soltar**, que a SPA não oferece.

**2. Quem envia não tem como saber quanto espaço lhe resta.** Levantado no
código:

| Onde a cota aparece | Quem vê | O que mostra |
| --------------------- | --------- | -------------- |
| `GET /dashboard` | só `unit_admin`/`global_admin` | `quotaUsedPct` **da unidade inteira** |
| `GET /auth/profile` | todos | nome, e-mail, unidade, papel — **sem cota** |
| `POST /files/upload-urls` | todos | `quota exceeded` **depois** de tentar |

O colaborador — a persona que envia — não tem **nenhuma** tela que informe seu
espaço disponível. O spec `web-upload` hoje determina, com razão, que "A SPA NÃO
SHALL inferir a cota localmente". Perguntar ao servidor não é inferir; mas o
endpoint para perguntar não existe.

**3. O conselho que o produto dá ao atingir a cota não funciona.** O manual, em
`docs/manual/docs/colaborador/enviar.md`, afirma:

> Ao atingir o limite, novos envios são bloqueados com um aviso. Para voltar a
> enviar, **libere espaço excluindo arquivos**.

Mas `storage_used_bytes` só é decrementado pelo job `purge-trash`, 03:00, **após
30 dias** de retenção — e a rota `/trash` tem apenas `GET`, sem exclusão
definitiva. Excluir um arquivo **não libera espaço algum** no momento em que a
pessoa precisa. Seguir o conselho do manual leva a excluir, tentar de novo e
falhar de forma idêntica.

A postura desta mudança é a inversão dessas três: **decidir antes de começar, e
dizer com precisão**. Antes de transferir um byte, a SPA conta os arquivos, soma
os tamanhos, pergunta ao servidor quanto espaço há, e responde ao usuário se o
pedido dele cabe — detalhando **onde o espaço está preso** quando não cabe.

## What Changes

- **Arrastar e soltar pastas e arquivos.** Área de soltar no explorador
  aceitando **várias pastas e arquivos soltos numa única interação**. Os botões
  "Enviar arquivos" e "Enviar pasta" **permanecem**: arrastar não é acessível por
  teclado e não existe em toque. O `rc-upload`, já instalado, percorre a árvore
  por `webkitGetAsEntry()` e preenche `webkitRelativePath` a partir do
  `fullPath`, de modo que `deriveRelativePath` funciona **sem alteração** e N
  pastas soltas chegam como uma seleção única. Ver D1.
- **Consulta de espaço disponível** — `GET /files/quota`, devolvendo cota,
  usado, **retido na lixeira**, reservado por envios pendentes e disponível. É
  dado do **próprio** solicitante, sob `attachTenantContext`; não é rota de
  painel e não agrega unidade. Ver D2.
- **Pré-checagem antes de qualquer transferência.** A seleção é analisada
  localmente (contagem e soma de `File.size`, sem ler bytes), confrontada com o
  espaço disponível, e só então o envio começa. Ver D3.
- **Recusa detalhada, com o espaço decomposto.** Quando não cabe, a SPA informa o
  tamanho da seleção, o disponível, o quanto falta, e **onde o espaço está**:
  ativos, retido na lixeira com o prazo de devolução, e reservado por pendentes.
  A recusa SHALL dizer explicitamente que excluir arquivos **não** libera espaço
  de imediato. Nenhum arquivo é transferido. Ver D4.
- **Confirmação antes de começar, quando cabe.** Resumo com pastas, quantidade,
  volume e estimativa de duração — começar quarenta minutos de transferência sem
  confirmar é hostil.
- **Envio fatiado.** O lote é dividido em fatias de `UPLOAD_SLICE_MAX_ITEMS`
  (200) e `UPLOAD_SLICE_MAX_BYTES` (500 MB), cada uma pedindo suas URLs
  **imediatamente antes** de transferir. Isso mantém o corpo da requisição
  pequeno, dá a cada URL o prazo cheio, e **remove o teto de itens da vista do
  usuário** — o teto por requisição do change `corrige-defeitos-envio-lote`
  continua valendo e nunca mais é atingido por uso normal. Ver D5.
- **Progresso macro por bytes.** Uma barra para o envio inteiro, medida em
  **bytes** e não em contagem de arquivos — com 180 KB de docx ao lado de 2,6 MB
  de PDF escaneado, uma barra por contagem anda aos trancos e mente sobre o tempo
  restante. Contagem de arquivos, arquivo corrente e falhas viram texto
  secundário; as falhas colapsam num contador com detalhe sob demanda, o que
  também resolve o custo de renderizar milhares de linhas. Ver D6.
- **Estouro de cota no meio vira exceção tratada.** Com a pré-checagem, uma fatia
  recusada por cota passa a ser raro (outra aba consumiu espaço no intervalo). O
  envio **pausa**, mostra o mesmo painel detalhado, e o que já subiu permanece.
  Ver D7.
- **Manual corrigido.** `enviar.md` deixa de aconselhar "exclua arquivos para
  liberar espaço" e passa a descrever o comportamento real da lixeira e da
  cota, junto do arrastar-e-soltar e da pré-checagem.

Fora de escopo (registrado em design.md):

- **Teto de arquivos por envio visível ao usuário.** Deliberadamente **não**
  existe. O fatiamento dissolve os limites técnicos, e a única recusa legítima é
  a que o espaço disponível justifica. Ver D5.
- **Expurgo imediato da lixeira.** É o que daria à recusa uma saída acionável
  hoje, em vez de "espere até 30 dias". Fica como fatia própria e independente
  (`esvaziar-lixeira`); esta mudança apenas **informa com honestidade** onde o
  espaço está, e oferece "enviar só o que cabe" como saída imediata.
- **Retomar um envio interrompido** após fechar a aba. Os itens ficam `pending` e
  o `backfill:pending` os reconcilia, mas a pessoa reenvia a pasta. Dívida
  conhecida, não paga aqui.
- **Envio retomável / em pedaços (resumable).** Continua deferido desde
  `epico-3-envio-lote-e-pasta`: o contrato "uma URL, um PUT" não muda.
- **Detecção de duplicata no reenvio.** Reenviar a mesma pasta continua criando
  arquivos novos; só as **pastas** são idempotentes (`envio-pasta`).
- **Arrastar e soltar em celular/tablet.** Não existe na plataforma; a área de
  soltar segue a mesma regra de `web-responsividade` que já recusa "Enviar
  pasta".

## Capabilities

### New Capabilities

<!-- Nenhuma capability nova: a consulta de espaço estende `envio-lote`, e a
     experiência estende `web-upload`. -->

### Modified Capabilities

- `envio-lote`: ganha a consulta do espaço disponível do próprio solicitante,
  com a decomposição entre ativo, retido na lixeira e reservado por pendentes.
- `web-upload`: ganha seleção por arrastar-e-soltar de várias pastas, análise e
  pré-checagem antes de transferir, recusa detalhada, envio fatiado e progresso
  macro por bytes.
- `documentacao-usuario`: a página de envio do manual passa a descrever o
  comportamento real da cota e da lixeira, corrigindo orientação hoje incorreta.

## Impact

- **Banco:** **nenhuma migração**. `GET /files/quota` lê `storage_used_bytes` e
  agrega `files` por status; a soma do retido na lixeira vem das linhas em
  lixeira do próprio dono. Nenhuma coluna, tabela ou policy RLS nova.
- **API (`apps/api/src`):** `routes/files.ts` — `GET /files/quota`; `config.ts`
  — nada novo (os tetos de fatia são do cliente, ver D5).
- **Shared (`packages/shared/src`):** DTO da resposta de cota e as constantes de
  fatia. Exige `npm run build --workspace packages/shared`.
- **Web (`apps/web/src/upload`):** área de soltar; análise da seleção;
  pré-checagem; painel de recusa detalhada; orquestração fatiada sobre a fila de
  concorrência introduzida em `corrige-defeitos-envio-lote`; progresso macro.
  `relative-path.ts` e `put-object.ts` ficam **inalterados**.
- **Rotas e prefixos:** **nenhum prefixo de topo novo.** `GET /files/quota` tem
  dois segmentos, sob o prefixo `/files` já registrado. Não há colisão nem
  sequer requisito de ordenação de registro: o `filesRouter` **não expõe
  `GET /files/:id`** — o verbo `GET` não é usado em nenhuma rota de `/files`
  hoje, e `/files/upload-url` e `/files/upload-urls` já convivem nesse formato
  literal de dois segmentos. A invariante das três pontas (`api-prefixes.ts`,
  `vite.config.ts`, `locals.tf`) segue intacta.
- **Infraestrutura:** nenhuma. Sem Terraform, sem job, sem tópico, sem variável
  de ambiente nova.
- **Dependência:** assume `corrige-defeitos-envio-lote` aplicado — a fila de
  concorrência, o prazo próprio da URL de envio e a renovação no retry são a base
  sobre a qual o fatiamento funciona.
- **Invariantes preservados, sem exceção:** bytes continuam sem passar pela API;
  a pré-checagem **não** substitui a guarda do servidor — cada fatia continua
  reservando cota em transação, fail-closed; a cota informada é a do próprio
  solicitante e nunca de terceiro; `withTenantTransaction` e a RLS por `unit_id`
  inalterados; o bypass de `global_admin` **não** é usado — cota é dado de
  pessoa, não agregado de painel.
- **Documentação:** `docs/prd_final.md` ganha a US de envio de várias pastas com
  verificação prévia; `docs/manual/docs/colaborador/enviar.md` corrigido e
  ampliado; `docs/manual/docs/referencia/limites.md` ajustado, já que o teto por
  envio deixa de ser observável pelo usuário.
- **Testes:** `GET /files/quota` devolvendo a decomposição correta, incluindo o
  retido na lixeira; cota de outra pessoa inacessível; pré-checagem que recusa
  não emitindo requisição de URLs nem transferindo; fatiamento respeitando os
  dois tetos; fatia recusada por cota pausando com o que já subiu preservado;
  progresso macro somando bytes e não contagem; e a travessia de múltiplas pastas
  soltas produzindo os `relativePath` corretos.
