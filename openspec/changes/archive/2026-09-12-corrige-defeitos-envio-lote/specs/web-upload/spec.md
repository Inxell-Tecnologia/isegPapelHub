## ADDED Requirements

### Requirement: Transferências simultâneas limitadas por fila

A SPA SHALL manter, a qualquer instante, no máximo um número configurado de
transferências de arquivo em andamento, enfileirando os demais itens aceitos e
iniciando o próximo assim que uma transferência termina — **por sucesso ou por
falha**, indiferentemente. A SPA NÃO SHALL disparar a transferência de todos os
itens aceitos de uma vez.

A fila SHALL preservar a independência já exigida por item: o progresso, o
desfecho e a nova tentativa de cada arquivo continuam próprios, e um item que
falha NÃO SHALL travar o avanço da fila. Um item ainda enfileirado SHALL ser
distinguível de um item em transferência, para que a pessoa não leia "parado"
como "falhou".

A limitação SHALL existir independentemente do comportamento do navegador ou do
protocolo de transporte: o multiplexamento de HTTP/2 usado pelo armazenamento
não impõe teto de requisições concorrentes, de modo que sem a fila todas as
transferências disputariam a mesma banda e nenhuma concluiria cedo.
Referência: PRD US 3.1; design.md D4 do change `corrige-defeitos-envio-lote`.

#### Scenario: Apenas o número configurado de arquivos transfere ao mesmo tempo
- **WHEN** o usuário inicia o envio de uma quantidade de arquivos muito maior que
  o teto de transferências simultâneas
- **THEN** no máximo o número configurado de arquivos está em transferência a
  qualquer momento, e os demais aguardam a vez

#### Scenario: Item que falha não trava a fila
- **WHEN** um dos arquivos em transferência falha
- **THEN** a vaga liberada é imediatamente ocupada pelo próximo item da fila, e
  o arquivo que falhou é sinalizado sem impedir o avanço dos demais

### Requirement: Recusa antecipada de seleção acima do teto de itens por requisição

A SPA SHALL recusar, **antes** de emitir a requisição de URLs de envio, uma
seleção cuja quantidade de arquivos exceda o teto de itens por requisição, e
SHALL informar o teto na mensagem. A recusa SHALL usar o padrão do teto
compartilhado pelo pacote comum, sem consultar nenhum endpoint de leitura novo.

A SPA SHALL igualmente reconhecer o código de erro próprio do teto quando ele
vier do servidor, e SHALL apresentá-lo como recusa por quantidade — nunca como
falha genérica que convide a repetir a mesma operação. Referência: design.md D2
do change `corrige-defeitos-envio-lote`.

#### Scenario: Seleção acima do teto é recusada sem requisição
- **WHEN** o usuário seleciona mais arquivos que o teto de itens por requisição
- **THEN** a SPA informa a recusa e o teto, e nenhuma requisição de URLs de envio
  é emitida

#### Scenario: Recusa vinda do servidor é apresentada como recusa por quantidade
- **WHEN** o servidor recusa a requisição com o código de erro próprio do teto
- **THEN** a SPA informa que a quantidade excedeu o limite, em vez de sugerir
  nova tentativa da mesma operação

## MODIFIED Requirements

### Requirement: Falha independente com nova tentativa apenas do item afetado

O envio de cada arquivo SHALL falhar de forma **isolada**: uma falha — seja
por o servidor recusar o item (`ok: false`, ex.: cota) seja por o PUT ao GCS não
concluir — NÃO SHALL impedir os demais arquivos do mesmo lote de concluir. Os
arquivos que concluíram SHALL permanecer enviados. Um arquivo que falhou SHALL
ser **sinalizado** e SHALL oferecer **nova tentativa que reenvia apenas aquele
item**, sem reprocessar os que já concluíram.

A nova tentativa SHALL reusar a URL assinada já obtida **somente enquanto ela
estiver vigente com margem**, e SHALL solicitar uma URL nova quando o prazo de
validade já tiver passado ou estiver a ponto de passar. Uma nova tentativa NÃO
SHALL repetir indefinidamente um envio com uma URL expirada. A avaliação de
vigência pelo relógio do cliente SHALL ser tratada como otimização — evitar uma
requisição inútil —, nunca como a garantia de correção: uma nova tentativa que
falhe novamente SHALL solicitar URL nova ainda que a URL anterior tivesse sido
julgada vigente.

Referência: PRD US 3.1 (cenário 2), RF #6; design.md D3/D4 do change
`web-upload` e D5 do change `corrige-defeitos-envio-lote`.

#### Scenario: Falha parcial preserva os concluídos
- **WHEN** um dos arquivos falha durante o envio enquanto os demais concluem
- **THEN** os que concluíram permanecem enviados e o que falhou é sinalizado

#### Scenario: Repetir reenvia só o item que falhou
- **WHEN** o usuário aciona a nova tentativa de um arquivo que falhou
- **THEN** a SPA reenvia apenas aquele arquivo, sem reprocessar os que já
  concluíram

#### Scenario: Repetir renova a URL assinada vencida
- **WHEN** o usuário aciona a nova tentativa de um arquivo cuja URL assinada já
  passou do prazo de validade
- **THEN** a SPA solicita uma URL nova para aquele arquivo antes de transferir,
  em vez de reusar a URL vencida

#### Scenario: Segunda falha renova a URL mesmo se julgada vigente
- **WHEN** uma nova tentativa que reusou a URL tida como vigente falha outra vez
- **THEN** a tentativa seguinte solicita uma URL nova, sem depender do relógio do
  cliente para decidir
