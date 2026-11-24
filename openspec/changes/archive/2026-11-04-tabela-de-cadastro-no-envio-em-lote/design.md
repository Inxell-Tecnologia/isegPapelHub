# Design

## Context

Ver `proposal.md` — Why. O que molda o desenho é o que já está em pé:

**O servidor está pronto e não muda.** `POST /files/upload-urls` já lê
`documentControl` por item, valida pelo enum compartilhado, distingue dado
**ausente** (aceita, nasce pendente) de dado **inválido** (recusa só o item),
devolve `awaitingRegistration` por item, e checa a unicidade do código tanto
contra o acervo da unidade (`findCodeOwner`, com a RLS filtrando por baixo)
quanto **dentro do próprio lote** (`codesInBatch`), tratando como retomada o
código preso a um envio `pending` de quem pede. O conjunto exigido é função do
tipo (`requiredFieldsForType`): cinco campos para documento controlado, nenhum
para Arquivo geral, que ao contrário **recusa** código, revisão e próxima
revisão.

**O fluxo da SPA tem fases, e a tabela precisa caber numa delas.** `UploadArea`
hoje é: seleção (três gatilhos) → `analisando` (percorre a seleção sem ler
bytes, cedendo o controle ao navegador em blocos) → consulta de
`GET /files/quota` → `veredito` (cabe / não cabe) → `enviando` (fatias com URLs
pedidas pouco antes de cada uma, fila de transferências simultâneas, progresso
macro em bytes) → `concluido` ou `pausado`. Para seleção de **um** arquivo que
não vem de pasta, o veredito já apresenta um formulário de dados de controle; é
o único lugar onde a SPA hoje envia `documentControl`.

**Três obrigações de `web-upload` restringem a tabela antes de ela existir:**
nenhuma requisição antes do veredito de espaço; nenhum indicador por arquivo
para o conjunto inteiro, de modo que milhares de arquivos não degradem a
interface; e nenhum limite próprio de quantidade por envio — a única recusa por
tamanho é a que o espaço disponível justifica. A demanda, do outro lado, pede
**uma linha por arquivo**. As duas coisas convivem, mas só com decisão explícita
(D2).

**Um descasamento vivo.** `DocumentControlFormItems` exige quatro campos e não o
responsável, que a B1 tornou obrigatório; e oferece Arquivo geral no seletor de
tipo enquanto continua exigindo os três campos que esse tipo recusa. Hoje o
envio unitário de um Arquivo geral é impossível pela interface.

## Goals / Non-Goals

**Goals:**

- Fechar a janela aberta pela B1: envio em lote volta a publicar o que está
  completo, em vez de nascer inteiro Pendente de cadastro.
- Entregar o cadastro por arquivo no **momento do envio**, com o custo de
  preenchimento proporcional ao lote (uma linha editável, mas um gesto só para
  o que é comum a todas).
- Manter o fluxo de envio grande intacto: a tabela não pode reintroduzir
  degradação de interface para milhares de arquivos nem antecipar requisição
  alguma.
- Fazer a SPA concordar com o servidor em **quais** campos são exigidos e
  **quando**, derivando isso do contrato compartilhado em vez de reescrever a
  regra no cliente.

**Non-Goals:**

- Mudança de backend. Se o desenho exigir uma, é sinal de que a fronteira está
  errada: a regra é toda de `controle-documental` e já está implementada.
- Antecipar no cliente a unicidade do código contra o **acervo** (D7).
- Repensar o layout do envio para a forma estreita. `web-responsividade` já
  classifica envio como tela que fica *utilizável*, não *otimizada*, e obriga a
  tabela larga a rolar dentro do próprio contêiner. É o que basta.
- Qualquer coisa de leitura obrigatória, inclusive a trava que recusa marcar
  Arquivo geral (fatia C1).

## Decisions

### D1 — A tabela é a confirmação do envio, e vem depois do veredito de espaço

A fase `veredito` ganha a tabela no lugar do painel "Confirmar envio" quando a
seleção não é a publicação de um documento só. A ordem não é detalhe de
implementação: **preencher primeiro e descobrir depois que não cabe** é o pior
desfecho possível — joga fora trabalho manual, que é incomparavelmente mais caro
que o tempo de uma análise de seleção.

A tabela já carrega o que o painel atual informava (quantidade de arquivos e
volume), então ela não é uma etapa a mais: é a mesma etapa, com cadastro. A
confirmação continua existindo e continua sendo explícita, porque um envio pode
durar dezenas de minutos.

Quando a seleção **não** cabe, o painel de espaço continua sendo o que aparece,
com as suas saídas atuais. A saída "enviar só o que cabe" abre a tabela com
**apenas o subconjunto que cabe** — cadastrar linha que não será enviada é
trabalho perdido por construção.

*Alternativa descartada:* tabela antes da consulta de espaço, para a pessoa já
ir preenchendo enquanto a cota é consultada. Ganha segundos e arrisca minutos de
digitação.

### D2 — Uma linha por arquivo, nunca mil linhas renderizadas

A demanda pede uma linha por arquivo e `web-upload` proíbe degradar a interface
com milhares de arquivos. A conciliação tem três partes, e nenhuma é opcional:

1. **O modelo tem uma entrada por arquivo**; a renderização é só da janela
   visível. A tabela é virtualizada (o `Table` do Ant Design 5 tem `virtual`,
   que é o caminho de menor divergência com as tabelas já entregues).
2. **O estado por linha vive fora de formulário.** Um `Form` do Ant por linha,
   com cinco `Form.Item`, instanciaria cinco mil formulários para cinco mil
   arquivos. O estado é um registro simples por linha, com validação **pura** —
   uma função que recebe a linha e devolve o que falta — e os controles de
   entrada são ligados a ele diretamente. É o que permite também, de graça, a
   contagem de completas/incompletas sem percorrer componentes.
3. **"Aplicar a todos" é o caminho de massa** (D5). Uma seleção de mil arquivos
   não se cadastra linha a linha, e a demanda sabe disso — é por isso que a
   linha de aplicação existe. A tabela serve para a **exceção**, não para o
   volume.

O que explicitamente **não** se faz: impor um teto de quantidade acima do qual a
tabela não abre. Seria o limite próprio de quantidade por envio que a capability
proíbe, e que o fatiamento existe para tornar inalcançável.

*Alternativa descartada:* abrir a tabela só até N arquivos e, acima disso,
enviar tudo como pendente com um aviso. Transforma o caminho mais rápido de
entrada, de novo, no que não pede nada — exatamente o defeito que a B1 fechou.

### D3 — Título é `file_name`, e a extensão é preservada

Título não é coluna nova (design.md D8 da B1): o campo da tabela 2.2 mapeia para
`file_name`, que é o `fileName` de cada item do lote. Logo **editar Título muda o
nome com que o arquivo é gravado**, e isso é a leitura certa da demanda — "o
Título vem preenchido com o nome do arquivo; editável".

Duas consequências, decididas aqui:

- **A extensão é preservada pela SPA.** O que a pessoa edita é o nome sem
  extensão; a SPA reanexa a original ao montar o item. `contentType` vem do
  `File` do navegador e não é afetado, mas nome e tipo discordantes produzem
  download com extensão errada e pré-visualização incoerente — e nada no
  servidor impede isso, porque a rota de lote só exige `fileName` não vazio.
- **Título vazio é barrado no cliente.** Não existe pendência de cadastro por
  falta de título: `file_name` é `NOT NULL` e sempre vem preenchido. Tirar o
  valor é apagar o único campo que a pendência não cobre.

Não há unicidade de `file_name` por pasta no banco, então dois títulos iguais no
mesmo lote são válidos e a tabela não os barra. Só o **código** é único.

### D4 — A sugestão pelo nome usa as siglas do cliente, não as da interface

`SIGLA-AREA-Nº` é reconhecido no nome do arquivo, e dele saem Tipo e Código
(`PRT-NSP-001_Identificacao.pdf` → Protocolo, `PRT-NSP-001`). O detalhe que
decide: **as siglas da demanda não são as da SPA.** A tabela 2.2 lista `PRT`,
`POP`, `POL/NOR`, `FOR/CHK`, `FLX`, `MAN`, `TC`, `CI`; `DOCUMENT_TYPE_ACRONYM`
usa `POL`, `FRM`, `TCO`, `COM`. Um reconhecedor que só aceitasse as siglas da
interface falharia em `FOR-NSP-001` e `CI-NSP-003`, que são justamente os nomes
que o acervo do cliente traz.

Então o reconhecimento tem **tabela de apelidos** própria, na SPA, mapeando
prefixo de nome de arquivo → `DocumentType`, com as formas do cliente e as da
interface apontando para o mesmo valor. A tabela de apelidos é de apresentação e
fica junto dos rótulos, não no contrato compartilhado: siglas de arquivo são
convenção de quem nomeia, e a API nunca as vê — ela recebe o valor do enum.

O Código sugerido é o prefixo `SIGLA-AREA-Nº` **como está escrito**, sem
normalizar caixa: é identidade do documento, e a unicidade no servidor já é
insensível a caixa (índice por `lower(...)`).

**Sugestão é distinguível de confirmação.** Uma célula sugerida é marcada como
tal na interface. Sem isso, uma sugestão errada atravessa a revisão humana com a
mesma aparência de um valor digitado, e o acervo ganha um código errado com
aparência de deliberado.

*Alternativa descartada:* inferir o tipo também do conteúdo ou do `contentType`.
Chuta a partir de evidência fraca em um campo que define classificação
documental.

### D5 — "Aplicar a todos" é ação explícita, sobrescreve, e não inclui Código

Quatro campos (Tipo, Revisão, Responsável, Próxima revisão), exatamente os que a
demanda nomeia. Código fica fora porque é individual por definição, e o que
"aplicar a todos" faria com ele é produzir uma colisão em cada linha.

**É um botão, não reatividade.** Aplicar enquanto a pessoa digita faria o
preenchimento de uma linha alterar silenciosamente outras.

**Aplicar sobrescreve** o valor desses quatro campos em todas as linhas,
inclusive nas já editadas. O preço é poder perder uma edição anterior; o ganho é
previsibilidade — "aplica no que ainda está vazio" produz resultado que depende
da ordem em que a pessoa trabalhou, e que ela não consegue antecipar olhando a
tela. A demanda confirma a leitura: "cada linha pode ser alterada **depois**".

### D6 — Publicar é uma operação só; o rótulo não pode mentir sobre as incompletas

"Publicar completos" **não** descarta as linhas incompletas: a demanda manda
salvá-las como Pendente de cadastro (2.1, item 8). Todas as linhas vão no mesmo
envio, nas mesmas fatias, e o servidor decide por item quem publica e quem nasce
pendente — é precisamente o que `awaitingRegistration` responde por item.

Daí a obrigação de interface: **a confirmação declara os dois grupos** ("N
publicam, M ficam pendentes de cadastro") antes de começar. Um botão chamado
"Publicar completos" que também envia as incompletas, sem dizer, é rótulo que
mente sobre o efeito — e a pessoa descobriria pelo sino, arquivo por arquivo.

*Alternativa descartada:* enviar só as completas e manter as incompletas na
tabela para outra rodada. Contraria a demanda, e pior: o trabalho já feito nas
linhas incompletas sumiria com o fechamento da tela, porque não existe rascunho
persistido.

### D7 — Pré-checagem de código só onde o conhecimento é local

**Dentro do lote: barra antes de enviar.** Duas linhas com o mesmo código são um
erro inteiramente conhecido no cliente, e barrá-lo na tabela aponta **as duas
linhas**, o que a recusa do servidor não consegue fazer (ela recusa a segunda,
mencionando só ela). A comparação é insensível a caixa e a espaços nas pontas,
igual ao índice único (`lower(...)`) — comparar de outro jeito criaria pares que
a tabela aceita e o servidor recusa.

**Contra o acervo: não.** A guarda continua sendo o servidor, que recusa o item
**antes de qualquer byte transferir** (a URL é pedida antes do PUT). Uma consulta
nova de "este código existe?" seria um retrato do instante, sujeito à mesma
corrida que ela promete evitar, ao custo de uma leitura por linha da tabela. É a
mesma postura que `web-upload` já adota para a cota: a SPA não infere, o servidor
decide.

**Linha recusada volta editável, com o cadastro preservado.** Quando o servidor
responde `document_code_conflict` para um item, aquela linha precisa reaparecer
com tudo o que foi digitado e o código apontado como o problema. Perder o
cadastro da linha junto com a recusa é o desfecho que faz a pessoa desistir da
tabela.

### D8 — Arquivo geral esvazia os campos que recusa, em vez de só desabilitá-los

Escolher Arquivo geral numa linha torna Código, Revisão e Próxima revisão
indisponíveis **e limpa o que estiver neles**. Desabilitar sem limpar deixaria o
valor no estado, e ele seguiria para o servidor, que responde
`general_file_rejects_control_fields` — recusa correta e incompreensível, porque
a pessoa não vê mais o campo que a causou. Responsável permanece disponível:
`FIELDS_REJECTED_FOR_GENERAL_FILE` não o inclui, de propósito.

A linha com Arquivo geral e título conta como **completa**. É a mesma regra do
servidor (`requiredFieldsForType` devolve conjunto vazio), e é o que faz do
Arquivo geral uma declaração em vez de uma pendência.

Vale igual no envio unitário, e lá é correção de defeito: hoje o formulário
exige os três campos que o servidor recusa, deixando o tipo inalcançável.

### D9 — Quais campos são exigidos vem do contrato, não de uma lista na SPA

A SPA precisa saber o conjunto exigido para marcar a linha como completa, e
**não** pode mantê-lo como uma segunda lista escrita à mão: a B1 acabou de
mostrar o custo disso, levando o conjunto de quatro para cinco no servidor
enquanto o formulário seguiu em quatro. `REQUIRED_CONTROL_FIELDS` e a regra "em
função do tipo" vivem hoje em `apps/api/src/lib/document-control.ts`, que a SPA
não importa.

Decisão: **o conjunto exigido e a lista de campos recusados pelo Arquivo geral
sobem para `packages/shared`**, junto do enum `DocumentType` que já é constante
de produto, e a API passa a lê-los de lá. Não é regra nova e não muda
comportamento — é a mesma constante, num lugar onde os dois lados a alcançam.
O veredito de aceitação continua sendo só do servidor; o que o cliente ganha é a
capacidade de dizer "falta o responsável" sem uma ida ao servidor para descobrir.

*Alternativa descartada:* endpoint que descreve os campos exigidos. Rota nova
para transportar uma constante de produto.

### D10 — Nenhum campo exigido recebe valor presumido

Título vem do nome do arquivo (é o mesmo dado, não um palpite) e Tipo/Código
podem vir da sugestão **marcada como sugestão** (D4). Revisão, Responsável e
Próxima revisão ficam **vazios**: pré-preencher "Rev. 00" ou uma data a um ano
publicaria documento com dado inventado, com a aparência de cadastrado — e o
objetivo do Épico 10 é o contrário disso. Quem quer o mesmo valor em todas as
linhas tem "Aplicar a todos", que é um gesto deliberado.

### D11 — A tabela não altera fatiamento, tetos nem reserva de cota

O envio continua sendo fatiado por itens e bytes, com URLs pedidas por fatia, e
a tabela não antecipa requisição nenhuma: até a confirmação, nada sai. A reserva
de cota segue acontecendo só para item que recebeu URL, de modo que não há
reserva vazando de item não publicado — **e arquivo Pendente de cadastro
consome cota como qualquer outro**, porque é arquivo real na pasta. Isso precisa
aparecer no manual, não como regra nova, mas como consequência visível de
publicar parcialmente.

A pausa por falta de espaço no meio do envio continua como está. O cadastro já
feito das fatias não enviadas se perde com a tela — limitação registrada em
Risks, não resolvida aqui.

## Risks / Trade-offs

- **Seleção de milhares de arquivos torna a tabela ingovernável na prática,
  ainda que renderize bem** → "Aplicar a todos" é a resposta de produto (D5), e
  o que sobra é a exceção. A obrigação técnica que fica é a de D2: o teste tem
  de travar que a tabela **não** renderiza uma linha por arquivo para uma
  seleção grande, igual ao teste que trava o progresso macro.

- **Cadastro perdido se a pessoa fechar a tela, ou se o envio pausar por falta
  de espaço no meio** → aceito nesta fatia. Persistir rascunho de cadastro
  exigiria armazenamento (servidor ou navegador) e um ciclo de vida próprio —
  quando expira, quem limpa, o que acontece se o arquivo local mudou. Mitigação
  parcial: a confirmação declara o que será enviado (D6), e o que já foi enviado
  e ficou pendente é completável pela ação "Dados de controle", que a B1
  entregou.

- **Editar Título renomeia o arquivo, e a pessoa pode não perceber** →
  a extensão é preservada (D3) e o campo mostra o nome como ficará. É a leitura
  fiel da demanda; a alternativa (título separado do nome do arquivo) seria
  coluna nova no banco e contradiria a B1.

- **Sugestão errada publicada como se fosse deliberada** → marca visual de
  sugestão (D4) e nenhuma sugestão em campo que não venha do nome do arquivo
  (D10). O risco residual é a pessoa confirmar sem olhar, que é risco de
  qualquer formulário pré-preenchido.

- **Subir as constantes de exigência para `packages/shared` mexe num módulo que
  a API usa em caminho de validação** → é movimentação de constante, sem
  mudança de valor nem de regra; a cobertura existente de
  `parseDocumentControl` (dado ausente × inválido, exigência por tipo, recusa do
  Arquivo geral) é o que prova que nada mudou. `packages/shared` é consumido
  **compilado de `dist/`**, então a ordem é recompilar shared antes de api e web.

- **O teste que hoje afirma "envio de vários arquivos não apresenta o
  formulário" passa a afirmar o contrário** → é a mesma reversão deliberada da
  B1, e o requisito alterado de `web-upload` é onde ela fica registrada. Deixar
  os dois textos conviver é que seria spec contraditória.

## Migration Plan

Nenhuma migração de banco, nenhum backfill, nenhuma mudança de infraestrutura.
A ordem de trabalho é a de compilação: `packages/shared` (D9) → `apps/api`
(passa a ler as constantes de lá, sem mudança de comportamento) → `apps/web`
(tabela, formulário unitário, mensagens de recusa) → manual.

Rollback é reverter o commit: o contrato é aditivo em `packages/shared`, e uma
SPA anterior voltaria a enviar lote sem `documentControl` — que o servidor aceita,
com os itens nascendo Pendentes de cadastro, que é exatamente o estado de hoje.
Nenhum dado gravado por esta fatia fica inconsistente se ela for revertida.
