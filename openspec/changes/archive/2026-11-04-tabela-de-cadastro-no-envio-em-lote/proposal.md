# Proposal

## Why

A change `arquivo-geral-e-pendente-de-cadastro` (fatia **B1**) ligou a exigência
dos dados de controle **por item** no servidor, mas a SPA ainda não os envia:
`UploadArea` monta cada item do lote com `fileName`, `contentType`,
`declaredSizeBytes` e `relativePath`, e nada mais. A consequência é que **todo
envio em lote nasce Pendente de cadastro** — fora de circulação, visível só a
quem enviou e à administração da unidade. Foi degradação aceita deliberadamente
no aceite da B1, com a condição explícita de que esta fatia a emende logo em
seguida (`docs/plano_demanda_cliente_2.md`, fatia B2: "a janela se fecha com a
B2").

É também o que a seção 2.1 da demanda pede como fluxo, e não só como regra:

> O sistema abre uma tabela de cadastro com uma linha por arquivo. […] No topo
> da tabela, a linha "Aplicar a todos" preenche de uma vez Tipo, Revisão,
> Responsável e Próxima revisão. […] O botão "Publicar completos" publica só as
> linhas completas.

Sem a tabela, cadastrar cinquenta arquivos significa enviá-los, receber
cinquenta avisos no sino e abrir cinquenta vezes a ação "Dados de controle" —
caminho que existe e funciona, mas que ninguém percorre. A exigência por
documento só produz acervo rastreável se a interface oferecer o cadastro **no
momento do envio**.

Há ainda um descasamento vivo a corrigir aqui: a B1 levou o conjunto exigido de
quatro para cinco campos (entrou o **responsável**), e isso vale também para o
envio **unitário** — mas o formulário da SPA continua exigindo quatro. Hoje
quem envia um documento sem preencher o setor responsável recebe a recusa do
servidor em vez da validação local, e quem escolhe o tipo **Arquivo geral** não
consegue publicar de jeito algum: o formulário segue exigindo código, revisão e
data, que são exatamente os três campos que o servidor **recusa** para esse
tipo.

## What Changes

- **Tabela de cadastro por arquivo** (demanda 2.1, 2.2): selecionar ou arrastar
  vários arquivos — ou uma pasta — passa a abrir uma tabela com **uma linha por
  arquivo**, com as seis colunas da tabela 2.2 (Tipo, Código, Título, Revisão,
  Responsável, Próxima revisão). A tabela é a própria confirmação do envio:
  substitui o painel "Confirmar envio" atual para seleções de mais de um
  arquivo, e vem **depois** do veredito de espaço, nunca antes.

- **Título pré-preenchido com o nome do arquivo, editável.** Título não é campo
  novo: mapeia para `file_name` (design.md D8 da B1). Editá-lo na tabela muda o
  nome com que o arquivo é gravado, e a extensão é preservada pela SPA para que
  pré-visualização e download continuem funcionando.

- **Sugestão de Tipo e Código pelo nome do arquivo** quando ele segue
  `SIGLA-AREA-Nº` (ex.: `PRT-NSP-001_Identificacao.pdf` → Tipo Protocolo,
  Código `PRT-NSP-001`). Sugestão é ponto de partida, nunca decisão: toda célula
  sugerida permanece editável e é visivelmente distinguível de um valor
  confirmado pela pessoa.

- **Linha "Aplicar a todos"** preenchendo Tipo, Revisão, Responsável e Próxima
  revisão de uma vez, por ação explícita. Código **nunca** entra nela — é
  individual por definição. Depois de aplicar, cada linha continua editável.

- **Indicador de completa/incompleta por linha** e botão de publicação que
  declara o desfecho dos dois grupos: as linhas completas publicam, as
  incompletas são enviadas e ficam **Pendentes de cadastro**. O botão não
  descarta as incompletas — "Publicar completos" nomeia o que acontece com as
  completas, e a interface diz, antes de confirmar, quantos arquivos ficarão
  pendentes.

- **Pré-checagem de código duplicado dentro do próprio lote**, antes de enviar
  — a lacuna que a B1 deixou nomeada. Duas linhas do mesmo lote com o mesmo
  código são barradas na tabela, com as duas linhas apontadas, em vez de uma
  delas voltar recusada pelo servidor depois da confirmação.

- **Arquivo geral na tabela e no envio unitário**: escolher o tipo Arquivo geral
  numa linha dispensa e **esvazia** Código, Revisão e Próxima revisão (que o
  servidor recusa para esse tipo), mantendo Responsável permitido, e a linha
  conta como completa.

- **Correção do envio unitário**: o formulário passa a exigir os **cinco**
  campos, incluindo o responsável, e a exigir em função do tipo — Arquivo geral
  pede só o título. Com isso o formulário volta a concordar com o servidor.

- **Recusas hoje mudas ganham texto**: `document_code_conflict` (conflito de
  código por item do lote) e `general_file_rejects_control_fields` (campo
  informado junto com Arquivo geral) caem hoje no genérico "Não foi possível
  concluir a ação. Tente novamente." — convite a repetir uma operação que
  falharia igual. Passam a ser avisos próprios, e os dois tipos de resposta
  entram no contrato compartilhado.

- **O requisito do conflito de código por item do lote é escrito na spec.** O
  comportamento existe desde a B1 — o servidor recusa só o item, tanto por
  colisão com o acervo quanto por colisão entre dois itens do mesmo lote, e
  trata como **retomada** o código preso a um envio `pending` de quem pede —
  mas `envio-lote` não o declara. Fica verificável aqui, porque é o requisito
  que a pré-checagem do cliente espelha.

### Fora de escopo

- **Backend novo.** Nenhuma rota, coluna, migração, job ou prefixo de rota de
  topo. O servidor já aceita dados por item, valida, marca pendência, recusa
  dado inválido e checa a unicidade do código — inclusive dentro do lote. Esta
  fatia consome esse contrato; a única mudança em `envio-lote` é **declarar**
  comportamento já implementado.
- **Pré-checagem do código contra o acervo** antes de enviar. A guarda continua
  sendo o servidor, que recusa o item antes de qualquer byte transferir. Uma
  consulta nova de "este código existe?" seria um retrato do instante,
  igualmente sujeito a corrida, ao custo de uma rota de leitura por linha da
  tabela. O que esta fatia antecipa é só o que é conhecimento **local**: a
  colisão entre dois itens do mesmo lote.
- **Alteração dos tetos do envio em lote.** Teto de itens por requisição,
  fatiamento e reserva de cota consciente do lote ficam como estão. A tabela não
  pede URL nenhuma antes da confirmação, logo não altera o momento nem o volume
  de nenhuma reserva.
- **Leitura obrigatória** (bloco C do plano) e as fatias do bloco A.

## Capabilities

### New Capabilities

Nenhuma. A tabela de cadastro é a forma que o envio de vários arquivos assume na
SPA, e `web-upload` já é a fronteira que governa esse envio inteiro — da seleção
e do veredito de espaço ao fatiamento, ao progresso e à nova tentativa por item.
Uma capability nova de "cadastro no envio" partiria em dois lugares o mesmo
fluxo, e a regra de quando os dados são exigidos já vive em
`controle-documental`.

### Modified Capabilities

- `web-upload`: o requisito "Envio de um documento pede os dados de controle
  antes de publicar" entra sob **REMOVED**, com Reason e Migration, e não sob
  MODIFIED — o cenário "Envio de vários arquivos não apresenta o formulário"
  **nomeia** a dispensa que esta fatia extingue, e mantê-lo produziria nome de
  cenário em contradição com o corpo do requisito. É o mesmo tratamento que a B1
  deu ao caso equivalente em `controle-documental`. Em seu lugar entram o
  requisito do envio unitário com o conjunto exigido **em função do tipo** (cinco
  campos para documento controlado, só o título para Arquivo geral) e os
  requisitos da tabela de cadastro por arquivo, da sugestão pelo nome do
  arquivo, de "Aplicar a todos", da pré-checagem de código dentro do lote, da
  publicação que declara o desfecho das linhas incompletas e do Arquivo geral
  por linha.
- `envio-lote`: requisito novo declarando a recusa **por item** do código em
  conflito — com o acervo da unidade ou com outro item do mesmo lote — e a
  retomada do código preso a um envio pendente de quem pede. Comportamento já
  implementado na B1 e até agora não especificado.

> `controle-documental` **não** é modificada: quais dados são exigidos, para
> quais tipos, o que é dado inválido e o que é pendência de cadastro são as suas
> regras, e nenhuma delas muda. A tabela é interface sobre regra vigente.

## Impact

**Backend (`apps/api`)**: nenhuma mudança de código. Só testes: os casos de
conflito de código por item do lote e de retomada passam a existir como
cobertura do requisito novo de `envio-lote`.

**Contrato compartilhado (`packages/shared`)**: tipagem das duas respostas de
recusa que faltam (`document_code_conflict` por item do lote e
`general_file_rejects_control_fields`), no molde de
`DocumentCodeInUseResponse`. O comentário de `UploadUrlRequest` que ainda diz
que os dados de controle são "dispensados no envio em lote" fica falso desde a
B1 e é corrigido.

**Frontend (`apps/web`)**: o peso da fatia. `upload/UploadArea.tsx` ganha a fase
de cadastro entre o veredito e o envio; a tabela em si entra como componente
próprio, com o estado por linha mantido fora de um `Form` por arquivo — uma
seleção de milhares de arquivos não pode instanciar milhares de formulários, e
`web-upload` já proíbe degradar a interface nesse tamanho. `toBatchItem` passa a
carregar `documentControl` e o `fileName` editado. `DocumentControlFormItems`
passa a exigir os cinco campos e a reagir ao tipo Arquivo geral;
`document-control-errors.ts` ganha as duas recusas que faltam. A tabela rola
dentro do próprio contêiner na forma estreita, como `web-responsividade` já
obriga — envio não é tela de consulta, e o nível exigido ali é *utilizável*.

**Testes (`apps/web`)**: o teste que hoje afirma "envio de vários arquivos não
apresenta o formulário" muda de expectativa, como mudaram os casos de lote na
B1. Casos novos para a sugestão pelo nome, "Aplicar a todos", linha incompleta
que vira pendente, colisão de código intra-lote barrada antes de enviar, Arquivo
geral numa linha, e a tabela não renderizando uma linha por arquivo para uma
seleção grande.

**PRD (`docs/prd_final.md`)**: US 10.5 cenário 2 continua valendo palavra por
palavra — ele já descreve o desfecho dos dois grupos. Entra uma US no Épico 3
para o cadastro no momento do envio em lote (tabela, sugestão, "Aplicar a
todos"), que é fluxo de usuário e não só regra de servidor.

**Documentação (`docs/manual/`)**: `colaborador/enviar.md` descreve hoje a regra
dos cinco campos sem a tela que a cumpre ("o que vier completo é publicado") —
fidelidade que a B1 manteve de propósito. Passa a descrever a tabela, a sugestão
pelo nome, "Aplicar a todos" e o desfecho das linhas incompletas. Cabe também
dizer que arquivo Pendente de cadastro **ocupa cota**, porque é consequência
visível de publicar parcialmente.

**Infraestrutura**: nada. Nenhum job, scheduler, segredo, bucket ou prefixo de
rota novo — logo nada em `infra/terraform/`, nem nas três listas de
`API_PREFIXES`.
