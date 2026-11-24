# Proposal

## Why

O envio em lote publica documentos sem rastreio. A change `controle-documental`
decidiu, deliberadamente, **dispensar** os dados de controle no lote (design.md
D7/D9 daquela change, US 10.5 cenário 2): quem envia cinquenta arquivos de uma
vez não informa tipo, código, revisão nem prazo, e os cinquenta nascem "Sem
controle de revisão".

O cliente classifica isso como defeito, não como concessão — seção 2 de
`docs/demanda_cliente_2.md`:

> Nenhum documento é publicado sem os dados obrigatórios, seja enviado sozinho
> ou em lote. Cada arquivo tem os seus próprios dados. A solução atual (não
> pedir dados quando são vários arquivos) deixa publicar documentos sem tipo,
> código e revisão.

A exigência por documento é o que dá sentido ao controle documental inteiro: um
acervo em que o caminho mais rápido de entrada é também o que não pede nada
acumula exatamente os documentos sem rastreio que o Épico 10 existe para evitar.

Mas a dispensa não pode simplesmente virar recusa. Dois casos legítimos a
atravessam, e são eles que moldam esta change: o arquivo que **não é documento
da Matriz** (ata, planilha de trabalho, apresentação — nunca terá código nem
revisão) e o lote em que **parte** dos arquivos ainda não tem os dados à mão.

Esta é a fatia **B1** do plano em `docs/plano_demanda_cliente_2.md`, e entrega o
backend e as regras. A tabela de cadastro por arquivo na interface é a fatia
**B2**, separada.

## What Changes

- **BREAKING (contrato de spec e PRD): a dispensa de dados no envio em lote deixa
  de existir.** O requisito "Dados de controle exigidos no envio de um documento"
  de `controle-documental` e o **cenário 2 da US 10.5** do PRD são **alterados**,
  não complementados. As decisões D7 e D9 daquela change — que prenderam a
  exigência à *rota* em vez do item, para que repetir um envio falho não fosse
  tratado como publicar documento novo — ficam **superadas**, e o motivo tem de
  ser registrado: a exigência passa a ser por **item**, e aceitar item
  incompleto como "pendente de cadastro" resolve a repetição sem reabrir a
  brecha.

- **Tipo "Arquivo geral"** (demanda 2.4): nono valor do conjunto fechado, hoje
  com oito. Pede só o título; não tem código, revisão nem situação; declara-se
  deliberadamente fora do controle documental. É **distinto de "dados não
  preenchidos"** — é a afirmação de que aquele arquivo nunca terá código. Não
  poderá ser marcado como leitura obrigatória (trava que a fatia C1 consome).

- **Estado "Pendente de cadastro"** (demanda 2.3): arquivo salvo sem os dados
  obrigatórios fica na pasta, **não aparece para leitores nem na busca**, é
  visível só para quem enviou e para a administração da unidade, carrega
  etiqueta própria, e quem enviou é avisado no sino. Ao completar os dados, o
  arquivo publica normalmente.

- **A exigência passa a valer por item no lote**: `POST /files/upload-urls`
  aceita dados de controle **por arquivo**. Item completo publica; item
  incompleto é salvo como Pendente de cadastro em vez de publicado sem
  rastreio.

- **O acervo anterior continua intacto.** O cenário 3 da US 10.5 ("acervo
  anterior não é invalidado") permanece palavra por palavra: arquivo enviado
  antes desta change segue "Sem controle de revisão", visível conforme as
  permissões já resolvidas, e **não** vira Pendente de cadastro
  retroativamente. Isso tem consequência de modelagem registrada no design: o
  estado precisa de **marcador explícito**, porque derivá-lo da ausência de
  dados tornaria o acervo antigo indistinguível de um envio incompleto de
  hoje.

### Fora de escopo

- **Tabela de cadastro por arquivo na interface** (demanda 2.1 e 2.2: linha por
  arquivo, "Aplicar a todos", sugestão de tipo e código pelo nome, "Publicar
  completos"): é a fatia **B2**. Esta change entrega o contrato e as regras que
  aquela tabela consome.
- **Leitura obrigatória**: bloco C do plano. Aqui entra só a trava que impede
  marcar "Arquivo geral", como dado do tipo — nenhuma regra de leitura.
- **Unicidade de código dentro do próprio lote**: a unicidade por unidade já é
  requisito vigente de `controle-documental` e continua valendo item a item. A
  checagem **antecipada de colisão entre dois itens do mesmo lote** pertence à
  B2, que é quem conhece o lote antes de enviá-lo.
- **Backfill do acervo**: nenhum. Por decisão, e é o que preserva o cenário 3 da
  US 10.5.

## Capabilities

### New Capabilities

Nenhuma. O estado de cadastro e o tipo de documento são exatamente o que
`controle-documental` já governa — os dados de controle e **as regras de
circulação que decorrem deles**. Uma capability nova para "cadastro de
documento" seria quase-duplicata dessa fronteira e dividiria em dois lugares a
regra de quem alcança o quê.

### Modified Capabilities

- `controle-documental`: o conjunto fechado de tipos ganha "Arquivo geral", com
  a consequência de que a situação **não se aplica** a ele; o requisito dos
  dados exigidos no envio passa a valer **por item**, com a dispensa do lote
  removida; requisito novo para o estado "Pendente de cadastro" e sua
  visibilidade restritiva; e o requisito de preencher os dados depois passa a
  dizer que completá-los **publica** o arquivo pendente.
- `envio-lote`: a emissão de URLs em lote passa a transportar dados de controle
  por item, e a resposta a distinguir o item que nasce publicado do que nasce
  pendente.
- `notificacoes`: requisito novo — quem envia arquivo que fica pendente de
  cadastro é avisado, com a idempotência por evento de origem que a capability
  já normatiza.
- `web-navegacao`: o requisito "Listagem do explorador apresenta os dados de
  controle" passa a apresentar a etiqueta "Pendente de cadastro" e a ausência de
  situação no "Arquivo geral".

> `busca` **não** é modificada, por precedente: a regra do documento obsoleto
> declara a ocultação uma única vez, em `controle-documental`, cobrindo
> "listagem, busca e acesso direto ao identificador". A visibilidade do pendente
> segue a mesma forma — uma regra, quatro caminhos — em vez de espalhar
> cláusulas por capability de consulta.

## Impact

**Banco (`apps/api/src/db/migrations`)**: migração aditiva. Marcador explícito do
estado de cadastro em `files` e o novo valor de tipo. **Nenhuma tabela nova**,
logo **nenhuma policy RLS nova** — os campos entram sob a fronteira de
isolamento que `files` já tem, como foi em `0016_document_control.sql`. Sem
backfill.

**Contrato compartilhado (`packages/shared`)**: `DocumentType` ganha o nono
valor; o DTO de envio em lote ganha os dados de controle por item; o resumo de
arquivo passa a carregar o estado de cadastro.

**Backend (`apps/api`)**: `POST /files/upload-urls` passa a ler e validar
controle por item; `lib/document-control.ts` ganha a derivação da situação
não-aplicável e a validação do "Arquivo geral"; `lib/access.ts` recebe a
**segunda** exceção restritiva da sua história, no molde da primeira (o
obsoleto): subtrai alcance e nunca concede, cobrindo os quatro caminhos por onde
um arquivo alcança alguém — listagem, busca, identificador direto e manifesto de
download de pasta. `PATCH /files/:id/document-control` passa a publicar o
pendente ao completá-lo. Notificação ao remetente pelo `NotificationPort` já
existente, sem adapter novo.

**Frontend (`apps/web`)**: só a apresentação — etiqueta do pendente na listagem
e ausência de situação no Arquivo geral. A ação "Dados de controle" por item já
existe no explorador e é o caminho que limpa o estado pendente.

**Testes**: o isolamento do pendente exige teste próprio, no mesmo nível dos
testes do obsoleto, cobrindo os quatro caminhos e o não-atravessamento de
unidade. Os casos de lote existentes mudam de expectativa — hoje afirmam que o
lote dispensa os dados.

**PRD (`docs/prd_final.md`)**: US 10.5 cenário 2 reescrito; US nova para o
Arquivo geral e para o estado pendente, no Épico 10.

**Sequenciamento (decidido)**: a exigência liga **nesta** fatia. Entre esta
change e a B2, a SPA ainda não envia dados por item, de modo que **todo envio em
lote passa a nascer Pendente de cadastro** — visível a quem enviou e à
administração, invisível aos leitores. Não é beco sem saída: a ação "Dados de
controle" por item já existe no explorador e publica o arquivo. É degradação
real de fluxo enquanto durar, aceita deliberadamente porque a Regra da seção 2
da demanda é explícita, e **a B2 deve ser emendada imediatamente após**. A
alternativa considerada e descartada — adiar a exigência para a B2, entregando
aqui só tipo, estado e visibilidade — manteria o fluxo intacto ao custo de
deixar a brecha aberta por mais uma fatia.

**Documentação (`docs/manual/`)**: o manual ganha o Arquivo geral e o estado
Pendente de cadastro, com fidelidade ao que esta fatia efetivamente entrega — a
tabela de cadastro só é documentada quando a B2 a entregar.
