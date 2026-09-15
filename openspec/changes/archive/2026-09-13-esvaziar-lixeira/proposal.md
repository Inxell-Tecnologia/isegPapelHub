# Proposal — esvaziar-lixeira

## Why

A cota é contada durante a retenção — por decisão explícita, registrada no spec
`lixeira`:

> Enquanto um arquivo está na lixeira, seus bytes SHALL continuar contando contra
> a cota de 10 GB do dono (…) a cota SHALL ser devolvida somente quando o expurgo
> remover o objeto. A exclusão NÃO SHALL, por si só, reduzir
> `storage_used_bytes`.

A regra está certa: os bytes de fato ainda ocupam o armazenamento. O problema é
que **não existe forma de o dono acelerar essa devolução**. A rota `/trash` tem
apenas `GET`; o único caminho que devolve cota é o job `purge-trash`, às 03:00,
para itens com mais de 30 dias. Quem precisa de espaço **hoje** não tem ação
alguma disponível — só esperar até um mês.

Isso deixa a única recusa legítima de envio sem saída acionável. O change
`envio-multiplas-pastas-com-prechecagem` passa a informar com precisão que *"2,1
GB estão retidos na lixeira e retornam em até 30 dias"* — honesto, e ainda assim
um beco sem saída para quem precisa enviar agora. Pior: o manual hoje aconselha
exatamente a ação que não funciona (*"libere espaço excluindo arquivos"*),
porque excluir **envia para a lixeira**, onde a cota continua presa.

Esta fatia dá a saída: esvaziar a própria lixeira sob demanda, devolvendo a cota
na hora.

## What Changes

- **Expurgo imediato dos próprios arquivos na lixeira** — `POST /trash/purge`
  remove permanentemente os **arquivos do próprio solicitante** que estão na
  lixeira, independentemente do tempo de retenção decorrido, devolvendo a cota
  correspondente. A operação é **irreversível** e não restaura nada.
- **Somente arquivos, nunca pastas.** Pasta não ocupa bytes, e portanto não
  devolve cota alguma — o propósito inteiro da ação é recuperar espaço. Manter as
  pastas na lixeira até o job evita, de quebra, o emaranhado de apagar uma pasta
  minha que ainda abriga na lixeira o arquivo de outra pessoa. Ver D1.
- **Escopo estritamente próprio.** A rota expurga apenas arquivos de que o
  solicitante é dono. Administrador de unidade e administrador global **não**
  ganham expurgo da lixeira alheia: a ação existe para a pessoa gerir a própria
  cota, e cota é pessoal. Ver D2.
- **Reuso da mecânica de expurgo já provada.** A sequência do job — bytes
  primeiro (inclusive o `pending_object_path` órfão), depois cota, auditoria,
  grants e a linha por último — é extraída para uma função compartilhada,
  consumida pelo job e pela rota. Nenhuma regra de expurgo é reescrita. Ver D3.
- **Confirmação explícita na SPA**, informando quantos arquivos serão apagados,
  quanto espaço retorna e que a ação não tem volta.

Fora de escopo (registrado em design.md):

- **Expurgo seletivo de itens da lixeira.** Apagar permanentemente um arquivo
  específico é fatia própria; aqui a ação é "esvaziar", de uma vez.
- **Expurgo de pastas sob demanda.** Ver D1 — não devolve cota e traz
  ordenação e propriedade cruzada para dentro de uma ação interativa.
- **Expurgo da lixeira de terceiro por administrador.** Ver D2.
- **Evento de auditoria do expurgo.** `audit_events.file_id` é `NOT NULL` e a
  linha do arquivo é apagada na mesma operação; o job já convive com isso desde
  `epico-6-lixeira-retencao`. A dívida é conhecida e não é esta fatia que a paga.

## Capabilities

### Modified Capabilities

- `lixeira`: o expurgo permanente, hoje exclusivamente automático por decurso de
  prazo, passa a ter também a forma imediata e sob demanda, restrita aos
  arquivos do próprio solicitante.

## Impact

- **Banco:** **nenhuma migração.** Nenhuma coluna, tabela ou policy RLS nova.
- **API (`apps/api/src`):** `routes/trash.ts` — `POST /trash/purge`;
  `jobs/purge-trash.ts` — passa a consumir a função de expurgo extraída;
  `lib/purge-file.ts` (novo) — a sequência de expurgo de um arquivo.
- **Shared (`packages/shared/src`):** DTO da resposta do expurgo (quantidade
  apagada, bytes devolvidos, falhas). Exige
  `npm run build --workspace packages/shared`.
- **Web (`apps/web/src/lixeira`):** ação "Esvaziar lixeira" com confirmação
  explícita e invalidação da listagem e da consulta de cota.
- **Rotas e prefixos:** **nenhum prefixo de topo novo.** `/trash` já está em
  `API_PREFIXES`, em `vite.config.ts` e em `locals.tf`; a invariante das três
  pontas segue intacta e `web-serving.test.ts` continua válido sem alteração.
- **Infraestrutura:** nenhuma. O job e o scheduler permanecem exatamente como
  estão — o expurgo automático não é substituído, apenas ganha um irmão manual.
- **Relação com as outras fatias:** **independente**. Não é pré-requisito de
  `corrige-defeitos-envio-lote` nem de `envio-multiplas-pastas-com-prechecagem`,
  e nenhuma das duas depende dela. O que ela faz é converter a recusa detalhada
  daquela fatia, de informação em ação.
- **Invariantes preservados, sem exceção:** bytes continuam sem passar pela API;
  a remoção segue bytes-antes-da-linha, para nunca deixar linha viva apontando
  bytes removidos; `withTenantTransaction` e a RLS por `unit_id` inalterados; o
  bypass de `global_admin` **não** é usado — a rota opera sob o contexto de
  unidade do próprio solicitante, diferentemente do job, que varre cross-unit com
  contexto de sistema.
- **Documentação:** `docs/manual/docs/colaborador/` — a página da lixeira ganha a
  ação e o aviso de irreversibilidade; a página de envio passa a poder apontar
  uma saída real ao informar cota atingida. `docs/prd_final.md` ganha a US
  correspondente no Épico 6.
- **Testes:** expurgo devolvendo exatamente os bytes dos arquivos apagados;
  arquivo de outra pessoa na mesma unidade **não** apagado; arquivo de outra
  unidade inalcançável; pastas na lixeira **não** afetadas; tolerância a falha
  por item preservada; e o job continuando a funcionar idêntico após a extração
  da função compartilhada.
