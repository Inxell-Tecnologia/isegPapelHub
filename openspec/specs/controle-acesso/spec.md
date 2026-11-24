# controle-acesso Specification

## Purpose

Define os requisitos verificáveis da imposição de permissão no servidor a
cada ação sobre um arquivo ou pasta, na fatia do Épico 4 / **US 4.2** do PRD
(`docs/prd_final.md`), completando também a **US 2.1, cenário 2** (Épico 2).
Esta capability trata da checagem em tempo de requisição sobre o motor
`grants` definido pela capability `permissoes-granulares`. Os cenários
Given/When/Then das US são vinculantes. A regra de resolução é **dono OU
grant do verbo exigido**, sem herança, fail-closed (ver design.md D2/D3 do
change `epico-4-permissoes-granulares`).

## Requirements

### Requirement: Acesso a conteúdo exige posse ou permissão do verbo correspondente

Toda ação sobre um arquivo ou pasta SHALL ser autorizada no servidor a cada
requisição pela regra **dono do recurso OU admin da unidade do recurso OU
detentor de grant vigente do verbo exigido** pela ação, independentemente da
interface ou de o link ter sido obtido diretamente. Os verbos exigidos SHALL ser:
`view` para emitir URL de visualização e para abrir/listar uma pasta; `download`
para emitir URL de download; `rename` para renomear ou substituir um arquivo;
`upload` para enviar para dentro de uma pasta de outra pessoa; `delete` para
excluir (enviar à lixeira) e para restaurar um arquivo ou pasta. Enviar para a
raiz da unidade ou para pasta própria NÃO SHALL exigir grant.

Um grant SHALL ser considerado **vigente** quando não possui prazo de expiração
ou quando o prazo ainda não foi atingido. Um grant **vencido** NÃO SHALL conceder
acesso em nenhum verbo e por nenhuma via, resolvendo exatamente como se não
existisse — sem distinguir, na resposta, "nunca teve permissão" de "teve
permissão e ela venceu". O corte SHALL valer a partir do instante do vencimento,
NÃO SHALL depender da execução de nenhuma rotina agendada, e SHALL ser avaliado
contra um relógio único do sistema, de modo a ser consistente entre instâncias da
aplicação. Os ramos de **posse** e de **admin da unidade do recurso** NÃO SHALL
ter prazo — apenas concessões expiram.

O ramo **admin da unidade do recurso** SHALL conceder acesso quando o
solicitante é `unit_admin` ou `global_admin` **e** a `unit_id` do recurso é
igual à `unit_id` do contexto autenticado — nesse caso o admin acessa o recurso
em qualquer verbo de conteúdo, sem necessidade de posse ou grant (US 5.1). O
papel de administrador NÃO SHALL, por si só e fora da sua unidade, conceder
acesso a conteúdo: em particular, o bypass de RLS do `global_admin` NÃO SHALL
liberar bytes nem itens de outra unidade (a comparação de `unit_id` é imposta na
aplicação, ainda que a RLS deixe a linha visível). Para o `collaborator`, a
regra permanece **dono OU grant vigente**. A resolução SHALL ser fail-closed
(recurso inexistente ou escondido pela RLS ⇒ negado, sem distinguir os casos).

A autorização do verbo `view` SHALL ser condição necessária para a
visualização, mas NÃO SHALL, por si só, garantir a emissão de URL de
visualização: quando o formato do arquivo não é pré-visualizável, deter `view`
resulta na resposta de indisponibilidade definida pela capability
`visualizacao` (sem URL e sem auditoria `view`), não em uma URL `inline`. A
emissão de URL de visualização com auditoria `view` SHALL ocorrer apenas quando
o formato é pré-visualizável. O verbo `download` permanece inalterado: quando
autorizado, SHALL sempre emitir a URL de download e auditar `download`.

Um recurso que esteja na lixeira (excluído, ainda não expurgado) SHALL resolver
como **inexistente** para todos os verbos de conteúdo vivos (`view`, `download`,
`rename`, `upload`) — negado com 403 fail-closed, sem vazar a existência —, de
modo que a exclusão o retire imediatamente de toda via de acesso viva; apenas as
operações de lixeira (listar a lixeira e restaurar) SHALL alcançá-lo.
Referência: PRD US 4.1, US 4.3, US 5.1, US 6.1, US 9.2, RF #10, RF #12, RF #16,
NFR de confidencialidade; revisão do D6 do change
`epico-4-permissoes-granulares`; design.md D2/D3 do change
`epico-6-lixeira-retencao`; design.md D4 do change `epico-9-preview-cenario-2`;
design.md D1 do change `expiracao-permissoes`.

#### Scenario: Não-dono da mesma unidade sem permissão é bloqueado
- **WHEN** um `collaborator` solicita a URL de visualização ou de download de um
  arquivo da sua unidade que não lhe pertence e sobre o qual não tem o verbo
  correspondente
- **THEN** o acesso é negado com 403, nenhuma URL assinada é emitida e nenhum
  registro de auditoria é gravado

#### Scenario: Detentor do verbo acessa e é auditado
- **WHEN** uma pessoa com grant `download` solicita a URL de download, ou uma
  pessoa com grant `view` solicita a URL de visualização de um arquivo de
  **formato pré-visualizável**
- **THEN** a URL assinada de TTL curto é emitida e o acesso é registrado na auditoria
  com a ação correspondente

#### Scenario: Grant vencido não concede acesso
- **WHEN** uma pessoa cujo grant sobre um arquivo já atingiu o prazo de expiração
  solicita a URL correspondente
- **THEN** o acesso é negado com 403, nenhuma URL é emitida e nenhuma auditoria é
  gravada, exatamente como se a concessão não existisse

#### Scenario: Corte independe da execução da rotina de avisos
- **WHEN** o prazo de uma concessão é atingido e a rotina diária de avisos ainda
  não executou
- **THEN** o acesso correspondente já está encerrado

#### Scenario: Grant com prazo ainda não atingido concede normalmente
- **WHEN** uma pessoa com grant cujo prazo de expiração ainda não chegou solicita
  a URL correspondente
- **THEN** o acesso é concedido e auditado normalmente

#### Scenario: Vencimento não afeta posse nem alcance de administração
- **WHEN** o dono de um arquivo, ou o admin da unidade do arquivo, acessa o
  recurso
- **THEN** o acesso é concedido independentemente de qualquer prazo, porque posse
  e administração da unidade não expiram

#### Scenario: Detentor de view sobre formato não pré-visualizável não gera URL nem auditoria
- **WHEN** uma pessoa com grant `view` (ou posse, ou alcance de admin da unidade)
  solicita a URL de visualização de um arquivo cujo formato não é
  pré-visualizável (ex.: documento Office nesta fase)
- **THEN** nenhuma URL de visualização é emitida e nenhuma auditoria `view` é
  gravada; a resposta segue o comportamento de indisponibilidade da capability
  `visualizacao` (informa indisponível e oferece download conforme a permissão
  `download`)

#### Scenario: Renomear/substituir exige o verbo rename
- **WHEN** um `collaborator` sem posse e sem grant `rename` tenta renomear ou
  substituir um arquivo
- **THEN** a ação é bloqueada com 403; e, com grant `rename`, a ação é permitida

#### Scenario: Enviar para pasta de outra pessoa exige o verbo upload
- **WHEN** um `collaborator` tenta enviar um arquivo para dentro de uma pasta que
  não lhe pertence, sem grant `upload` sobre essa pasta
- **THEN** o envio é bloqueado; e, com grant `upload` sobre a pasta, o envio é
  permitido

#### Scenario: Excluir exige o verbo delete
- **WHEN** um `collaborator` sem posse e sem grant `delete` tenta excluir um
  arquivo ou pasta
- **THEN** a ação é bloqueada com 403; e, com posse, grant `delete` ou alcance de
  admin da unidade, a exclusão é permitida

#### Scenario: Recurso na lixeira resolve como inexistente para verbos vivos
- **WHEN** uma pessoa aciona visualização, download, renomear ou listar sobre um
  arquivo ou pasta que está na lixeira, mesmo com posse ou grant sobre ele
- **THEN** o acesso é negado com 403 fail-closed, sem URL nem conteúdo, e a
  resposta não revela que o recurso existe na lixeira

#### Scenario: Admin da unidade acessa conteúdo da unidade sem grant
- **WHEN** um `unit_admin` (ou um `global_admin` cuja unidade é a do recurso)
  solicita a URL de visualização/download, renomeia ou substitui um arquivo da
  sua unidade que não criou nem lhe foi concedido
- **THEN** o acesso é concedido pelo ramo admin-da-unidade e auditado quando for
  visualização de formato pré-visualizável ou download

#### Scenario: global_admin não acessa conteúdo de outra unidade
- **WHEN** um `global_admin` solicita a URL de visualização/download de um
  arquivo pertencente a uma unidade diferente da do seu contexto, sem posse nem
  grant
- **THEN** o acesso é negado com 403, sem URL e sem auditoria, mesmo que o bypass
  de RLS torne a linha do arquivo visível ao papel

### Requirement: Bloqueio de acesso por link direto sem exposição de conteúdo

O acesso direto pela rota de um arquivo sem permissão SHALL ser bloqueado sem expor
nenhum conteúdo nem pré-visualização do arquivo, e sem distinguir "arquivo
inexistente" de "arquivo existente sem permissão" (não vazar existência). Como a URL
assinada só é emitida **após** a checagem de permissão no servidor e o bucket é
100% privado, um link direto ao objeto nunca SHALL contornar a verificação.
Referência: PRD US 4.2, cenário 1.

#### Scenario: Link direto a arquivo sem permissão
- **WHEN** uma pessoa aciona a rota de um arquivo para o qual não tem permissão,
  ainda que conheça seu identificador
- **THEN** recebe 403, nenhuma URL nem pré-visualização é retornada, e a resposta não
  revela se o arquivo existe

### Requirement: Listagem de pasta restrita a itens próprios ou liberados

A listagem do conteúdo de uma pasta (e da raiz da unidade) SHALL retornar, para
um `collaborator`, apenas os itens que a pessoa **criou** OU sobre os quais
possui grant `view` **vigente** — arquivos e subpastas —, nunca itens de
terceiros sem liberação e nunca itens liberados por concessão já vencida. Para um
**admin da unidade** (solicitante `unit_admin` ou `global_admin` cuja `unit_id` é
a da listagem), a listagem SHALL retornar **todos** os itens da unidade, sem
exigir posse ou grant. Para o `global_admin`, a listagem SHALL ser restringida à
sua unidade na própria consulta (não confiar no bypass de RLS para evitar trazer
itens de outra unidade). Abrir uma pasta SHALL exigir posse, grant `view` vigente
**ou** ser admin da unidade da pasta. Como não há herança, abrir uma pasta
liberada por grant SHALL mostrar apenas os filhos igualmente próprios ou
liberados (o alcance amplo de unidade vale só para o admin).

O filtro de vigência SHALL ser aplicado de forma **uniforme em todas as vias de
alcance por concessão** — listagem de pasta, busca e listagem da lixeira —, de
modo que um grant vencido não faça um item continuar aparecendo em nenhuma
delas, mesmo que a abertura do item já esteja negada.

Toda listagem viva SHALL excluir os itens que estão na lixeira (excluídos, ainda
não expurgados) — nenhum item excluído SHALL aparecer na navegação, nem para o
`collaborator` nem para o admin da unidade; itens na lixeira só aparecem na
listagem própria da lixeira. Referência: PRD US 2.1, cenário 2; US 4.1, cenário
2; US 4.3; US 5.1; US 6.1; design.md D2 do change `epico-6-lixeira-retencao`;
design.md D1 do change `expiracao-permissoes`.

#### Scenario: Listagem mostra criados e liberados, oculta o resto (collaborator)
- **WHEN** um `collaborator` abre uma pasta que contém itens próprios, itens
  liberados a ele e itens de terceiros sem liberação
- **THEN** vê apenas os itens que criou e os que lhe foram liberados, e os itens sem
  permissão não aparecem

#### Scenario: Item liberado por grant vencido some da listagem
- **WHEN** um `collaborator` abre uma pasta onde havia um item visível apenas por
  um grant `view` cujo prazo já foi atingido
- **THEN** o item não aparece na listagem

#### Scenario: Busca não retorna item liberado por grant vencido
- **WHEN** um `collaborator` busca por um arquivo que só lhe era alcançável por
  um grant já vencido
- **THEN** o arquivo não aparece nos resultados

#### Scenario: Lixeira não lista raiz alcançada por grant vencido
- **WHEN** um `collaborator` abre a lixeira e havia uma raiz de exclusão
  alcançável apenas por grant `delete` já vencido
- **THEN** essa raiz não aparece na listagem da lixeira

#### Scenario: Abrir pasta sem posse nem view é negado (collaborator)
- **WHEN** um `collaborator` tenta abrir/listar uma pasta que não lhe pertence e
  sobre a qual não tem grant `view`
- **THEN** o acesso é negado com 403, sem revelar o conteúdo nem a existência da pasta

#### Scenario: Admin da unidade lista todos os itens da unidade
- **WHEN** um `unit_admin` abre uma pasta da sua unidade que contém itens de
  vários donos, sem grant sobre eles
- **THEN** vê todos os itens da pasta pertencentes à sua unidade

#### Scenario: Listagem do global_admin não vaza itens de outra unidade
- **WHEN** um `global_admin` lista o conteúdo de uma pasta da sua unidade
- **THEN** vê apenas itens da sua unidade, sem que o bypass de RLS traga itens de
  outras unidades para a listagem

#### Scenario: Itens na lixeira não aparecem na listagem viva
- **WHEN** uma pessoa lista o conteúdo de uma pasta onde havia um item que foi
  excluído
- **THEN** o item excluído não aparece na listagem, mesmo para o admin da unidade

### Requirement: Destinatário de leitura obrigatória visualiza a revisão marcada

A pessoa que integra o público de uma leitura obrigatória SHALL poder
**visualizar** o documento enquanto a revisão vigente for a revisão marcada,
mesmo sem ser dona, administradora ou ter concessão. Essa liberação NÃO SHALL
alcançar baixar, alterar ou excluir; NÃO SHALL fazer o documento aparecer na
listagem de pasta nem na busca; NÃO SHALL vencer as regras restritivas
existentes (documento obsoleto, pendente de cadastro, lixeira); e NÃO SHALL
atravessar unidades. Substituído o documento por nova revisão sem nova
marcação, a liberação SHALL deixar de valer. Referência: PRD US 12.3; design.md
D6 do change `leitura-obrigatoria`.

#### Scenario: Destinatário visualiza documento alheio
- **WHEN** um colaborador do público de uma leitura obrigatória pede a
  visualização do documento, sem outra permissão sobre ele
- **THEN** a visualização é concedida

#### Scenario: A leitura obrigatória não libera baixar
- **WHEN** o mesmo colaborador pede o download do documento
- **THEN** o download é recusado

#### Scenario: Nova revisão sem marcação retira a liberação
- **WHEN** o documento é substituído e a revisão nova não é marcada
- **THEN** o colaborador deixa de visualizá-lo

#### Scenario: Liberação não aparece na navegação
- **WHEN** o colaborador lista a pasta do documento ou busca pelo nome dele
- **THEN** o documento não aparece por causa da leitura obrigatória

### Requirement: Acompanhamento de todas as unidades não abre conteúdo de outra unidade

A pessoa com acompanhamento de leituras de **todas as unidades** SHALL alcançar,
das outras unidades, somente a situação nominal de leitura obrigatória — nome,
unidade e setor das pessoas, documento, revisão, prazo, situação e data da
ciência. Ela NÃO SHALL, por esse alcance, visualizar, baixar, listar ou
auditar arquivo de outra unidade, nem obter o estado de leitura de um arquivo
dela, e essas recusas SHALL ser indistinguíveis das de recurso inexistente.
Referência: PRD US 12.6; `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`,
respostas 7(a) e 8.

#### Scenario: Governança vê quem leu, mas não abre o documento
- **WHEN** a pessoa com acompanhamento de todas as unidades consulta o relatório
  de uma marcação de outra unidade e depois pede a visualização, o download, a
  auditoria ou o estado de leitura do arquivo marcado
- **THEN** vê o relatório nominal, e os quatro pedidos são recusados como se o
  arquivo não existisse
