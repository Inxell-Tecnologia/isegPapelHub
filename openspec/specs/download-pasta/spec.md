# download-pasta Specification

## Purpose

Define os requisitos verificáveis de download de pasta do GDoc — entrega de uma
pasta e sua subárvore como um único pacote compactado, com a hierarquia de
subpastas preservada — na fatia do Épico 3 / **US 3.3** do PRD
(`docs/prd_final.md`), adiada no Épico 3 por dependência do motor de permissão e
explicitamente deixada fora do `epico-4-permissoes-granulares`. Os cenários
Given/When/Then da US são vinculantes; os requisitos abaixo os tornam
verificáveis. A regra de resolução de acesso continua sendo a da capability
`controle-acesso` — esta capability a consome item a item, sem afrouxá-la. Ver
`openspec/changes/download-pasta-zip/design.md` D1–D8.

## Requirements

### Requirement: Download de pasta entrega um único pacote com a hierarquia preservada

O sistema SHALL permitir baixar uma pasta e sua subárvore como **um único arquivo
compactado**. O pacote SHALL preservar a hierarquia de subpastas, posicionando
cada arquivo no caminho relativo que ocupa a partir da pasta solicitada. Subpastas
cujo conteúdo tenha sido integralmente omitido por permissão NÃO SHALL aparecer
como entradas no pacote. Referência: PRD US 3.3, cenário 1; design.md D7.

#### Scenario: Pasta com subpastas produz pacote com a estrutura original
- **WHEN** uma pessoa com permissão solicita o download de uma pasta que contém
  subpastas e arquivos
- **THEN** recebe um único arquivo compactado no qual cada arquivo está no caminho
  relativo correspondente à sua posição na hierarquia original

#### Scenario: Subpasta sem itens permitidos não aparece no pacote
- **WHEN** uma subpasta tem todo o seu conteúdo omitido por falta de permissão
- **THEN** essa subpasta não aparece como entrada no pacote

### Requirement: Conteúdo do pacote é filtrado pela permissão de baixar item a item

O sistema SHALL resolver a permissão de **baixar** para **cada arquivo** da
subárvore individualmente e SHALL incluir no pacote **apenas** os arquivos para os
quais o solicitante tem esse acesso — por posse, por administração da unidade do
recurso, ou por concessão explícita do verbo. Arquivo sem esse acesso SHALL ser
**omitido** do pacote, e a omissão NÃO SHALL fazer a operação inteira falhar. A
resolução NÃO SHALL derivar permissão de nenhum recurso ancestral. Referência:
PRD US 3.3, cenário 2; PRD US 4.1, cenário 2; design.md D2, D3.

#### Scenario: Conteúdo parcialmente permitido gera pacote parcial
- **WHEN** uma pessoa solicita o download de uma pasta em que tem permissão de
  baixar sobre parte dos arquivos
- **THEN** o pacote contém exatamente os arquivos permitidos, e os demais são
  omitidos sem que a operação falhe

#### Scenario: Permissão apenas sobre a pasta não libera o conteúdo interno
- **WHEN** uma pessoa que possui concessão apenas sobre a pasta, sem concessão
  sobre os arquivos internos, solicita o download da pasta
- **THEN** nenhum arquivo interno é incluído, porque a permissão não é herdada do
  recurso ancestral

#### Scenario: Administrador da unidade obtém o conteúdo da própria unidade
- **WHEN** um administrador da unidade solicita o download de uma pasta da sua
  unidade
- **THEN** o pacote contém os arquivos da subárvore no alcance da sua unidade, sem
  exigir concessão explícita

### Requirement: Abrir a pasta é pré-condição do download da pasta

O sistema SHALL exigir do solicitante o acesso de **visualizar** sobre a pasta
solicitada e, sem esse acesso, SHALL negar a operação com `403` fail-closed, sem
distinguir "pasta inexistente" de "pasta sem permissão" e sem revelar qualquer
informação sobre o conteúdo. Subpastas sobre as quais o solicitante não tenha
acesso de visualizar SHALL ser omitidas junto com toda a sua descendência.
Referência: design.md D2; capability `controle-acesso`.

#### Scenario: Pasta sem permissão de visualizar é negada sem vazar existência
- **WHEN** uma pessoa solicita o download de uma pasta sobre a qual não tem acesso
  de visualizar
- **THEN** a operação é negada e a resposta não permite distinguir se a pasta
  existe

#### Scenario: Subpasta não visível é omitida com sua descendência
- **WHEN** a subárvore contém uma subpasta que o solicitante não pode visualizar
- **THEN** essa subpasta e todos os itens abaixo dela são omitidos do pacote

### Requirement: Recorte parcial é informado explicitamente ao solicitante

O sistema SHALL informar, junto ao resultado da solicitação, **quantos arquivos
existem** na subárvore e **quantos foram liberados** ao solicitante, de modo que a
interface possa comunicar que o pacote é um recorte parcial. Quando **nenhum**
arquivo estiver liberado, o sistema SHALL comunicar essa condição de forma
explícita e NÃO SHALL entregar um arquivo compactado vazio. Referência: PRD US
3.3, cenário 2; design.md D3.

#### Scenario: Pacote parcial informa a proporção liberada
- **WHEN** o conteúdo liberado é menor que o conteúdo total da subárvore
- **THEN** o solicitante é informado de quantos itens foram incluídos em relação
  ao total existente

#### Scenario: Nenhum item liberado não produz arquivo
- **WHEN** o solicitante não tem permissão de baixar sobre nenhum arquivo da
  subárvore
- **THEN** é informado explicitamente de que não há itens disponíveis para ele e
  nenhum arquivo compactado é gerado

### Requirement: Bytes do download de pasta não trafegam pela API

O sistema SHALL entregar o conteúdo por **URLs assinadas de TTL curto** emitidas
após a checagem de permissão, com o cliente obtendo os bytes **diretamente do
storage**. A API NÃO SHALL ler, compactar, retransmitir ou intermediar os bytes
dos arquivos. As URLs emitidas SHALL usar o mesmo TTL já praticado para a ação de
baixar, e NÃO SHALL receber TTL estendido em função do volume do pedido.
Referência: CLAUDE.md ("Tráfego de bytes"); design.md D1, D6.

#### Scenario: Conteúdo é obtido direto do storage
- **WHEN** uma pessoa solicita o download de uma pasta com itens permitidos
- **THEN** recebe URLs assinadas de TTL curto e obtém os bytes diretamente do
  storage, sem que a API transporte conteúdo

#### Scenario: TTL não é alongado para pedidos volumosos
- **WHEN** o pedido abrange muitos arquivos
- **THEN** as URLs assinadas continuam com o mesmo TTL da ação de baixar

### Requirement: Cada arquivo incluído gera um evento de auditoria de download

O sistema SHALL registrar um evento de auditoria da ação **baixar** para **cada
arquivo** incluído no pacote, no momento da emissão da URL assinada — o mesmo
momento em que o download unitário já registra. Arquivos omitidos por falta de
permissão NÃO SHALL gerar evento. Um pedido recusado NÃO SHALL gerar nenhum
evento. Referência: PRD RF #9/#11; design.md D4, D5.

#### Scenario: Pacote com N arquivos permitidos gera N eventos
- **WHEN** uma pessoa obtém um pacote contendo N arquivos permitidos
- **THEN** são registrados N eventos de auditoria da ação baixar, um por arquivo

#### Scenario: Arquivo omitido não é auditado
- **WHEN** um arquivo é omitido do pacote por falta de permissão
- **THEN** nenhum evento de auditoria é registrado para esse arquivo

#### Scenario: Auditoria por arquivo permanece consultável individualmente
- **WHEN** um administrador consulta a auditoria de um arquivo que foi baixado
  como parte de um pacote de pasta
- **THEN** encontra o evento de baixar correspondente, com quem e quando

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

### Requirement: Itens na lixeira nunca integram o pacote

O sistema NÃO SHALL incluir no pacote nenhum arquivo ou subpasta que esteja na
lixeira, para **nenhum** papel, inclusive o administrador da unidade. A travessia
da subárvore SHALL aplicar o mesmo filtro de item vivo usado nas demais vias de
conteúdo. Referência: capability `lixeira`, requisito "Item na lixeira não é
acessível por nenhuma via viva"; design.md D8.

#### Scenario: Arquivo excluído não entra no pacote
- **WHEN** uma pasta contém arquivos que foram enviados à lixeira
- **THEN** esses arquivos não aparecem no pacote

#### Scenario: Administrador da unidade também não obtém itens da lixeira
- **WHEN** um administrador da unidade solicita o download de uma pasta com itens
  na lixeira
- **THEN** os itens na lixeira permanecem fora do pacote

### Requirement: Download de pasta respeita o isolamento entre unidades

O sistema NÃO SHALL incluir no pacote nenhum item pertencente a outra unidade, e
NÃO SHALL permitir que uma pessoa solicite o download de pasta de unidade diversa
da sua — inclusive o administrador global, que NÃO SHALL obter conteúdo de unidade
diferente da do seu contexto autenticado. Referência: PRD US 5.1; CLAUDE.md
(trava do bypass de `global_admin` para rotas de conteúdo).

#### Scenario: Pasta de outra unidade é negada
- **WHEN** uma pessoa solicita o download de uma pasta de outra unidade
- **THEN** a operação é negada sem revelar a existência da pasta

#### Scenario: Administrador global não obtém conteúdo de outra unidade
- **WHEN** um administrador global solicita o download de uma pasta pertencente a
  unidade diferente da do seu contexto
- **THEN** a operação é negada, pois o bypass de administração global não alcança
  rotas de conteúdo
