> **Pré-requisito:** este change assume `corrige-defeitos-envio-lote` aplicado —
> a fila de concorrência, o prazo próprio da URL de envio, a renovação no retry e
> o teto de corpo/itens são a base sobre a qual o fatiamento funciona.

## 1. Contratos compartilhados (`packages/shared`)

- [x] 1.1 Definir o DTO da resposta de cota (`quotaBytes`, `usedBytes`,
  `trashedBytes`, `pendingBytes`, `availableBytes`), documentando no tipo que
  `trashedBytes` é decomposição de `usedBytes` e **não** é subtraído do
  disponível (design.md D2).
- [x] 1.2 Definir `UPLOAD_SLICE_MAX_ITEMS_DEFAULT = 200` e
  `UPLOAD_SLICE_MAX_BYTES_DEFAULT = 500 MB`, com comentário registrando que são
  tetos **do cliente** — a API não observa "o envio" (design.md D5).
- [x] 1.3 Recompilar (`npm run build --workspace packages/shared`).

## 2. Consulta de cota (`apps/api/src/routes/files.ts`)

- [x] 2.1 Implementar `GET /files/quota` sob `attachTenantContext`, derivando a
  identidade **somente** de `ctx.userId` e sem aceitar parâmetro de pessoa
  (design.md D2) — verificar com teste que não há forma de consultar terceiro.
- [x] 2.2 Calcular `trashedBytes` a partir dos arquivos do solicitante na
  lixeira, dentro de `withTenantTransaction`, e verificar com teste que ele
  **não** é descontado de `availableBytes` (um arquivo na lixeira segue em
  `storage_used_bytes` até o `purge-trash`).
- [x] 2.3 Calcular `pendingBytes` com a mesma soma de `pending`/`replacing` já
  usada na reserva do lote, e descontá-lo de `availableBytes`.
- [x] 2.4 Verificar com teste que a rota **não** usa o bypass de `global_admin`:
  um admin global recebe a própria cota, não a de outra pessoa nem agregado de
  unidade.
- [x] 2.5 Verificar com teste de `web-serving.test.ts` que `GET /files/quota`
  responde como API e não cai no fallback de `index.html` — o prefixo `/files` já
  está em `API_PREFIXES`, nenhuma das três pontas muda.

## 3. Área de soltar (`apps/web/src/upload`)

- [x] 3.1 Montar a área de soltar com travessia de diretório ativa, aceitando
  várias pastas e arquivos soltos na mesma interação (design.md D1) — verificar
  com teste que N pastas soltas chegam como uma seleção única.
- [x] 3.2 Verificar com teste que `deriveRelativePath` permanece **inalterado** e
  produz o caminho correto para arquivos vindos do `drop`, que chegam com
  `webkitRelativePath` preenchido a partir do `fullPath`.
- [x] 3.3 Manter os dois botões de envio funcionando em paralelo à área de
  soltar, e aplicar à área a mesma regra de indisponibilidade por dispositivo já
  usada no envio de pasta (`useNarrowMode`, `web-responsividade`) — verificar com
  teste que em modo estreito o envio de arquivos avulsos segue íntegro.

## 4. Análise da seleção e pré-checagem

- [x] 4.1 Implementar a apuração local de quantidade e soma de tamanhos por
  `File.size`, sem leitura de conteúdo (design.md D3).
- [x] 4.2 Exibir o estado "analisando seleção" com cancelamento durante a
  travessia — verificar com teste que nenhuma requisição é emitida nessa fase.
- [x] 4.3 Consultar `GET /files/quota` **após** a apuração e antes do veredito,
  para que o retrato seja o mais recente possível.
- [x] 4.4 Verificar com teste que uma seleção inviável não emite pedido de URLs e
  não transfere byte algum.

## 5. Veredito ao usuário

- [x] 5.1 Implementar o painel de recusa com volume pedido, disponível, faltante
  e a decomposição entre ativos, retido na lixeira e pendentes (design.md D4).
- [x] 5.2 Incluir na recusa a declaração explícita de que excluir arquivos **não**
  libera espaço de imediato, com o prazo de retorno do espaço da lixeira —
  verificar com teste a presença da mensagem.
- [x] 5.3 Implementar "enviar só o que cabe", identificando com clareza o que
  ficou de fora (ver Open Question do design sobre o critério do subconjunto).
- [x] 5.4 Implementar a confirmação prévia quando a seleção cabe, com quantidade
  e volume — verificar com teste que nada é transferido antes da confirmação.

## 6. Envio fatiado

- [x] 6.1 Implementar a divisão em fatias por `UPLOAD_SLICE_MAX_ITEMS` **e**
  `UPLOAD_SLICE_MAX_BYTES`, fechando a fatia pelo que for atingido primeiro
  (design.md D5) — verificar com teste o caso em que o limite de bytes fecha a
  fatia antes do de itens.
- [x] 6.2 Pedir as URLs de cada fatia imediatamente antes de transferi-la, nunca
  todas no início — verificar com teste a ordem das requisições.
- [x] 6.3 Fazer a fila de concorrência (de `corrige-defeitos-envio-lote`)
  atravessar as fatias sem reiniciar — verificar com teste que a transição entre
  fatias não deixa a fila ociosa.
- [x] 6.4 Remover da SPA a recusa por quantidade introduzida em
  `corrige-defeitos-envio-lote` (tarefa 8.1 daquele change): com fatiamento o teto
  por requisição deixa de ser alcançável por uso normal e não deve mais ser
  apresentado ao usuário (design.md D5). O reconhecimento do código de erro vindo
  do servidor **permanece**, como rede de segurança.

## 7. Progresso macro

- [x] 7.1 Substituir a lista por item por um progresso único do conjunto, medido
  em bytes transferidos sobre bytes totais (design.md D6) — `put-object.ts`
  permanece inalterado; muda o consumidor do `onProgress`.
- [x] 7.2 Exibir como informação complementar a contagem de concluídos, o arquivo
  corrente e o contador de falhas.
- [x] 7.3 Implementar a listagem das falhas sob demanda, preservando a nova
  tentativa por item.
- [x] 7.4 Verificar com teste que o progresso avança proporcional aos bytes num
  conjunto de arquivos de tamanhos muito diferentes, e não em saltos por arquivo.

## 8. Estouro de cota durante o envio

- [x] 8.1 Pausar o envio quando uma fatia for recusada por cota, sem prosseguir
  para as fatias seguintes (design.md D7).
- [x] 8.2 Reconsultar `GET /files/quota` e reapresentar o painel detalhado, com a
  quantidade de arquivos que ficou por enviar.
- [x] 8.3 Sinalizar o envio como incompleto — verificar com teste que os arquivos
  já transferidos permanecem enviados.

## 9. Documentação

- [x] 9.1 Reescrever `docs/manual/docs/colaborador/enviar.md`: remover a
  orientação incorreta de "libere espaço excluindo arquivos", descrever o
  arrastar-e-soltar de várias pastas, a verificação prévia e o progresso do
  conjunto, com fidelidade à tela entregue.
- [x] 9.2 Ajustar `docs/manual/docs/referencia/limites.md`: o teto de arquivos por
  requisição deixa de ser observável pelo usuário (o envio é fatiado abaixo dele)
  e a cota passa a ser o único limite que o usuário encontra na tela.
- [x] 9.3 Acrescentar a `docs/manual/docs/referencia/limites.md`, na seção de
  recursos indisponíveis em celular e tablet, a área de arrastar e soltar.
- [x] 9.4 Acrescentar ao `docs/prd_final.md` a US de envio de várias pastas com
  verificação prévia de viabilidade, com os cenários Dado/Quando/Então
  correspondentes — as specs desta fatia a referenciam.

## 10. Fechamento

- [x] 10.1 Rodar `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` na raiz, com tudo verde.
- [x] 10.2 Verificar que os testes de isolamento e segurança
  (`rls-isolation`, `isolamento-unidade`, `permission`, `web-serving`) seguem
  passando sem alteração.
