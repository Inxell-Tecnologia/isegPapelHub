# Spec — download-pasta (delta)

O requisito vigente proíbe ocultar a ação de baixar pasta **em função do tamanho
provável do conteúdo**, exigindo que pedidos excessivos sejam recusados com
mensagem acionável "em vez de a ação desaparecer da interface sem explicação".

Surge agora um segundo motivo legítimo de recusa, de outro eixo: o pacote é
montado **no cliente** e materializado inteiro em memória antes de ser entregue,
o que é frágil num dispositivo móvel — e o comportamento de salvamento de
arquivos gerados no navegador é irregular nessas plataformas. Ocultar o botão ali
não violaria a letra do requisito (que nomeia o tamanho do conteúdo), mas violaria
exatamente o que sua última oração protege.

Este delta generaliza a **forma** da recusa para cobrir os dois motivos, mantendo
intactas a proibição de ocultar a ação e a exigência de mensagem acionável, e
alinhando-a ao princípio geral da capability `web-responsividade`. Ver design.md
D5.

## MODIFIED Requirements

### Requirement: Pedido acima do limite configurado é recusado com orientação

O sistema SHALL impor limites configuráveis ao pedido — número máximo de arquivos
e soma máxima de bytes — e SHALL recusar pedidos que os excedam, com erro
**específico** que identifique **qual** dos limites foi atingido, informe o valor
encontrado e o valor permitido, e oriente a baixar subpastas separadamente. A
verificação SHALL ocorrer **antes** de emitir qualquer URL assinada e **antes** de
registrar qualquer auditoria. Os limites SHALL ser configuração de ambiente, e NÃO
SHALL ser valores fixos no código.

A ação de baixar pasta SHALL ser oferecida uniformemente em **toda** pasta,
incluindo a raiz da unidade, e NÃO SHALL ser ocultada em função do tamanho provável
do conteúdo — pedidos que excedam os limites SHALL ser recusados com a mensagem
acionável acima, em vez de a ação desaparecer da interface sem explicação.

A mesma forma de recusa SHALL valer quando o **dispositivo em uso** não comportar
a montagem do pacote no cliente: a ação SHALL permanecer visível e SHALL ser
recusada no acionamento, com mensagem que informe a indisponibilidade naquele
dispositivo e oriente a alternativa. A ação NÃO SHALL ser ocultada nem
desabilitada em função da classe do dispositivo, e a recusa por dispositivo SHALL
ser distinguível tanto da recusa por limite quanto da recusa por permissão
insuficiente. Nenhuma URL assinada SHALL ser emitida e nenhum evento de auditoria
SHALL ser registrado num pedido recusado por esse motivo.

Referência: design.md D5, D9 do change `download-pasta-zip`; design.md D5 do
change `responsividade-mobile-tablet`; requisito "Capacidade ausente no
dispositivo é recusada com explicação" da capability `web-responsividade`.

#### Scenario: A ação é oferecida também na raiz da unidade
- **WHEN** uma pessoa visualiza a raiz da unidade
- **THEN** a ação de baixar a pasta é oferecida, ainda que o conteúdo possa exceder
  os limites

#### Scenario: Pedido excedente é recusado antes de assinar e auditar
- **WHEN** uma pessoa solicita o download de uma pasta que excede um dos limites
  configurados
- **THEN** a operação é recusada, nenhuma URL assinada é emitida e nenhum evento
  de auditoria é registrado

#### Scenario: A recusa identifica o limite e orienta a alternativa
- **WHEN** um pedido é recusado por exceder um limite
- **THEN** a mensagem identifica qual dos limites foi atingido, com o valor
  encontrado e o permitido, e orienta a baixar subpastas separadamente

#### Scenario: Recusa por contagem é distinguível de recusa por tamanho
- **WHEN** um pedido é recusado por exceder a contagem de arquivos, e outro por
  exceder a soma de bytes
- **THEN** cada recusa identifica o seu próprio limite, sem que as duas produzam a
  mesma mensagem

#### Scenario: A ação permanece oferecida em dispositivo que não a comporta
- **WHEN** uma pessoa visualiza uma pasta num dispositivo onde a montagem do
  pacote no cliente não é viável
- **THEN** a ação de baixar a pasta continua visível na interface, em vez de
  desaparecer sem explicação

#### Scenario: Recusa por dispositivo não assina nem audita
- **WHEN** essa pessoa aciona a ação de baixar a pasta
- **THEN** a operação é recusada com mensagem que informa a indisponibilidade
  naquele dispositivo e orienta a alternativa, sem que nenhuma URL assinada seja
  emitida nem nenhum evento de auditoria seja registrado

#### Scenario: Recusa por dispositivo é distinguível das demais recusas
- **WHEN** uma pessoa é recusada por dispositivo, outra por exceder um limite e
  outra por permissão insuficiente
- **THEN** as três mensagens são distinguíveis entre si, sem que uma situação seja
  apresentada com o texto de outra
