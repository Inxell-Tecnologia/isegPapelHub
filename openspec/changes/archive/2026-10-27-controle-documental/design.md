# Design

## Context

Ver `proposal.md` — Why, e o Épico 10 do PRD para os critérios de aceite. O
estado de partida relevante:

- `files` tem `status` com três valores (`pending`, `active`, `over_quota`) que
  descrevem o **ciclo do upload**, não a vigência do documento. Os dois
  conceitos não podem compartilhar coluna.
- Nenhuma tabela do sistema tem `updated_at`. `audit_events` registra sete
  ações com autor, alvo e instante, sob RLS.
- `lib/access.ts` concentra a resolução de acesso numa regra única — dono OU
  administrador da unidade do recurso OU concessão vigente do verbo —, sem
  herança e fail-closed. Nunca teve exceção.
- A vigência de concessão já é avaliada **no SQL** (`expires_at IS NULL OR
  expires_at > now()`), pelo relógio do Postgres, de propósito: uma concessão
  expirada deixa de valer na requisição seguinte, sem depender de job.

## Goals / Non-Goals

**Goals:**
- Que a situação de um documento seja verdade no instante da consulta, sem
  janela em que a tela mostre "Vigente" para algo já vencido.
- Acrescentar o domínio sem criar tabela nova — e portanto sem criar superfície
  nova de isolamento entre unidades.
- Que a regra do obsoleto seja estritamente restritiva, auditável como tal.

**Non-Goals:**
- Workflow de aprovação. "Em revisão" é estado declarado, não etapa de processo
  com aprovador, prazo ou transição controlada.
- Histórico de versões. A revisão é um contador; o PRD mantém fora de escopo a
  consulta a versões anteriores.
- Migrar o acervo existente. Tudo que já está lá nasce "Sem controle de
  revisão", por desenho.

## Decisions

### D1 — Colunas em `files`, não tabela nova

Os dados de controle entram como colunas nuláveis em `files`, e o tipo da pasta
como coluna em `folders`.

*Alternativa considerada:* tabela `document_metadata` com relação 1:1. Rejeitada
por dois motivos convergentes. O primeiro é de segurança: tabela nova com dado
de unidade **exige** `unit_id` e policy RLS própria — mais uma superfície de
isolamento para manter correta, em troca de nada. O segundo é de consulta: todo
`SELECT` da listagem passaria a carregar um `JOIN`, e a situação (D2) precisa
ser derivada no mesmo `SELECT`.

`ADD COLUMN` nulável sem default não reescreve a tabela, então a migração é
barata mesmo com acervo grande — mesmo raciocínio já registrado na migração de
cota individual.

### D2 — A situação é derivada no `SELECT`, nunca gravada

A situação não é coluna. É uma expressão avaliada a cada consulta, sobre o
estado declarado e a data de próxima revisão, usando o relógio do banco:

```
obsoleto declarado                      → Obsoleto
em revisão declarado                    → Em revisão
sem data de próxima revisão             → Sem controle de revisão
data no passado                         → Revisão vencida
data dentro de 60 dias                  → A vencer
caso contrário                          → Vigente
```

*Alternativa considerada:* coluna `situacao` mantida por rotina diária.
Rejeitada porque cria uma janela de mentira — entre a virada da data e a
execução do job, a tela afirmaria "Vigente" sobre documento vencido. É
exatamente o defeito que o repositório já evitou na vigência de concessões, e
pela mesma razão: o relógio que decide é o do Postgres, não o do processo Node
nem o do dispositivo.

Consequência deliberada: não existe evento "o documento venceu". Nada precisa
observar essa transição, porque ela não é um evento — é uma leitura.

### D3 — Estado declarado **e** derivação, não um campo só

O material do cliente usa a mesma cor âmbar para duas coisas diferentes: uma
tela mostra `● Em revisão` e outra mostra `● Vence em 45 dias`. Uma é declarada
por uma pessoa ("estou reescrevendo este procedimento"); a outra é consequência
aritmética de uma data.

Por isso há um campo de **estado declarado** (vigente, em revisão, obsoleto) e,
por cima dele, a derivação por data. Um campo só não conseguiria representar
"documento em revisão cuja data ainda está longe" sem perder uma das duas
informações.

### D4 — Os oito tipos são enum no contrato, não tabela de taxonomia

Os tipos e suas cores vêm do guia visual do cliente e são constantes do
produto, como `UserRole` e `Permission`. Entram como enum em
`packages/shared`.

*Alternativa considerada:* tabela `document_types` administrável por unidade.
Rejeitada por ser capacidade que ninguém pediu, que exigiria tela de
administração, e que tornaria a cor um dado editável — quando ela é, hoje,
decisão de identidade visual com contraste já verificado.

### D5 — Unicidade do código por índice parcial

`UNIQUE (unit_id, document_code)` restrito aos documentos não excluídos e com
código informado. Sendo índice, a garantia é do banco, não da aplicação: duas
requisições simultâneas com o mesmo código não conseguem ambas gravar.

Isso traz um caso de borda que precisou ser normatizado: um documento vai para
a lixeira, seu código é reusado, e depois alguém restaura o documento original.
O índice recusa a restauração. A alternativa — liberar o duplicado — quebraria
a própria unicidade; a outra — bloquear o reuso enquanto houver documento na
lixeira — tornaria um código irrecuperável por até 30 dias sem que ninguém
entenda por quê. Recusar a restauração com erro específico é o único desfecho
que não mente sobre o estado do sistema.

### D6 — O obsoleto é a primeira exceção de `access.ts`, e é restritiva

A regra do obsoleto **subtrai** alcance: quem não é administrador da unidade
deixa de ver o que antes veria. Ela nunca concede. Essa direção importa — uma
exceção que só restringe não pode, por construção, abrir furo de isolamento, e
mantém o caráter fail-closed da função.

Ela é aplicada nos três caminhos que alcançam um documento: listagem de pasta,
busca e acesso direto por identificador. O acesso direto recusa de forma
indistinguível de recurso inexistente, seguindo o que o repositório já faz —
não distinguir "não existe" de "não é seu".

*Alternativa considerada:* tratar o obsoleto como filtro na camada de rota, sem
tocar `access.ts`. Rejeitada porque um caminho novo esqueceria o filtro; três
rotas replicando a mesma condição é precisamente como furos nascem.

### D7 — "Unitário" é a contagem da operação, não uma tela separada

A exigência de dados de controle liga quando a operação de envio carrega
exatamente um arquivo, e desliga quando carrega vários ou uma pasta.

*Alternativa considerada:* dois comandos distintos na interface — "Enviar
documento" com formulário e "Enviar arquivos" sem. Rejeitada porque o
explorador tem uma única área de arrastar e soltar, e a pessoa não escolhe um
comando antes de arrastar: ela solta o que tem na mão. Ligar pela contagem
mantém um caminho só.

A consequência precisa ser dita no aceite: arrastar um arquivo pede quatro
campos; arrastar dois não pede nada. É o que o cliente decidiu, e o caminho de
edição posterior (requisito "Dados de controle podem ser preenchidos ou
corrigidos depois") existe para que o lote não vire dívida permanente.

### D8 — Revisão é inteiro, apresentada formatada

Guardada como inteiro e apresentada como `Rev. 02`. Guardar o texto `"Rev. 02"`
impediria incrementar sem interpretar string, e abriria espaço para `"Rev 2"`,
`"rev.02"` e afins no mesmo acervo.

A substituição só avança a revisão de documento que **já tem** revisão
registrada. Substituir um arquivo qualquer não inaugura numeração — caso
contrário, todo o acervo em lote ganharia `Rev. 01` na primeira troca, sugerindo
um controle que nunca existiu.

### D9 — A contagem da operação vira **duas rotas**, não um parâmetro

D7 liga a exigência pela contagem da operação. Na implementação isso se
traduziu em duas rotas já existentes, cada uma com um papel: `POST
/files/upload-url` é a **publicação de um documento** e exige os dados de
controle; `POST /files/upload-urls` é o **lote e a pasta**, e os dispensa. A
SPA escolhe a rota pela operação: um arquivo solto → a primeira; vários
arquivos, ou qualquer arquivo vindo de pasta → a segunda.

*Alternativa considerada:* exigir os dados na rota de lote quando ela
recebesse exatamente um item. Rejeitada porque o lote **precisa** pedir URL
para um item só — é assim que ele repete um envio que falhou, item a item. Com
a exigência presa à contagem de itens da requisição, repetir um item de um
lote de cinquenta passaria a pedir quatro campos que aquele lote nunca teve, e
o relato de falha independente (já entregue, e que esta change não pode
quebrar) cairia junto. "Operação" é o que a pessoa fez, não o número de itens
de uma requisição HTTP — e a fronteira entre as duas intenções é a rota.

Consequência registrada: uma pasta com um único arquivo dentro **não** pede os
dados, porque continua sendo uma pasta. O que distingue os dois casos no
cliente é a hierarquia que o item carrega (`relativePath`).

### D10 — Publicar o mesmo código com envio pendente é **retomada**, não duplicata

O índice único de D5 alcança toda linha não excluída, inclusive a `pending` de
um envio que ainda não terminou. Sem tratamento, um documento cuja
transferência falhasse deixaria o próprio código preso até o expurgo da
lixeira, e a pessoa seria recusada ao tentar publicá-lo de novo — por um
documento que é o dela, e que não existe.

Por isso a rota de publicação reconhece o caso: código ocupado por envio
`pending` **do próprio solicitante** faz a linha ser reaproveitada com o objeto
novo, em vez de recusar. Para qualquer outro ocupante — documento ativo, ou
pendente de outra pessoa — a recusa é a de D5, nomeada. É também o que permite
ao cliente renovar a URL assinada de um documento sem inventar uma rota de
renovação.

### D11 — O veredito de edição vem do servidor, no próprio resumo

A spec `web-navegacao` exige que a ação de editar os dados de controle seja
oferecida **apenas** a quem o servidor autorizaria, e a mesma capability
proíbe a SPA de inferir permissão no cliente. As duas regras só são
conciliáveis se o servidor disser — quem tem concessão sobre documento de
outra pessoa não é derivável do DTO.

`FileSummaryResponse` ganha então `canEditControl`, no molde exato de
`FolderContentsResponse.canUpload`: é resolvido pelo mesmo fragmento de
alcance que a consulta de listagem já monta (agora para o verbo `rename`),
sai de graça na mesma linha, e aparece **só** nas respostas que listam
documentos — uma operação sobre um documento só não é usada para decidir o que
oferecer. Não é linha de defesa: o 403 da rota de edição continua sendo a
autorização real.

## Risks / Trade-offs

- **Primeira exceção em `access.ts`, função que é o coração da autorização** →
  a exceção é restritiva e aplicada num ponto só; os testes de isolamento
  existentes (`permission.test.ts`, `isolamento-unidade.test.ts`,
  `rls-isolation.test.ts`) são estendidos com o caso do obsoleto antes de a
  regra entrar.
- **`FileSummaryResponse` ganha campos e é consumido em várias telas** → os
  campos são opcionais na leitura; nenhuma tela existente precisa mudar para
  continuar funcionando.
- **A derivação da situação entra em todo `SELECT` de listagem** → é expressão
  sobre colunas da própria linha, sem subconsulta nem `JOIN`; o custo é
  desprezível frente ao filtro de permissão que já roda.
- **Restauração da lixeira pode ser recusada por código em uso**, desfecho novo
  numa operação que hoje só falha por permissão → a recusa tem erro próprio e
  mensagem que diz qual documento ocupa o código, para a pessoa resolver.
- **Exigir quatro campos no envio de um arquivo pode empurrar as pessoas para o
  envio em lote** só para escapar do formulário, esvaziando o controle →
  acompanhar a proporção de documentos "Sem controle de revisão" depois da
  entrega; se crescer, a decisão D7 é o ponto a revisitar, não a exigência.
- **Nenhuma notificação avisa que um documento venceu** (as notificações novas
  ficaram fora de escopo por decisão do cliente) → quem precisa saber descobre
  consultando; a situação está correta em toda listagem desde o primeiro
  instante.

## Migration Plan

1. Migração numerada, aditiva: colunas nuláveis em `files` e `folders`, índice
   único parcial do código. Sem backfill — o acervo nasce "Sem controle de
   revisão", que é o estado correto para ele.
2. `packages/shared` recompilado com os enums e os campos novos.
3. API implantada: leitura dos campos, derivação da situação, exigência no
   envio unitário, rota de edição, regra do obsoleto.
4. SPA implantada: colunas, etiquetas, formulário.

**Observações da implementação:**

- A regra do obsoleto é aplicada também na travessia que monta o **manifesto de
  download de pasta** (`lib/folder-tree.ts`), além dos três caminhos nomeados
  no D6: é o quarto lugar por onde bytes de um documento alcançam alguém, e a
  regra ali subtrai exatamente como nos demais.
- A coluna `folders.folder_type` é criada pela migração (tasks.md 1.1), mas
  nenhum requisito desta change a escreve ou apresenta — nenhuma tela a
  aciona, e por isso ela **não** é documentada como recurso do usuário. Fica
  disponível para a fatia que trouxer cor e ícone de pasta.

**Rollback:** reverter a aplicação. As colunas podem permanecer no banco sem
efeito — são nuláveis e nenhuma leitura anterior as consulta. Derrubar o índice
único é o único passo a desfazer caso se queira voltar o esquema por completo.

## Open Questions

- Se a organização quiser, no futuro, que o código siga um formato fixo
  (por exemplo `TIPO-SETOR-NNN`), isso entra como validação adicional sem
  alterar nenhum requisito desta change: hoje o código é texto livre, único por
  unidade.
