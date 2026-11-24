# busca Specification

## Purpose

Define os requisitos verificáveis de busca transversal de arquivos (atravessando
pastas) por nome, combinável com filtros de tipo de arquivo, autor e intervalo
de data, no Épico 9 / **US 9.1** do PRD (`docs/prd_final.md`). A busca
reaproveita integralmente a resolução de visibilidade já consolidada (dono OU
grant `view` OU administrador da unidade) como fronteira, sem afrouxá-la, e
preserva o isolamento por unidade (RLS) também para esta via, fechando também a
**US 5.1 cenário 2** ("nunca vejo arquivos de outra unidade, mesmo por busca").

## Requirements

### Requirement: Busca de arquivos por nome com filtros combináveis

O sistema SHALL expor uma consulta de busca transversal de **arquivos**
(atravessando pastas) por nome, combinável com filtros de tipo de arquivo,
autor e intervalo de data. A busca por nome SHALL fazer correspondência
**parcial** e insensível a caixa sobre o nome do arquivo. Cada filtro presente
SHALL restringir o resultado em **conjunção** (AND) com os demais e com o
alcance de permissão do solicitante. Os resultados SHALL vir ordenados do mais
recente para o mais antigo (`created_at` desc). Cobre **US 9.1**
(`docs/prd_final.md`).

O filtro de **tipo** SHALL usar uma categoria funcional derivada do
`content_type` do arquivo — imagens, vídeos, áudios, PDFs, documentos de
escritório (Word/Excel/PowerPoint) e demais — com o mapeamento categoria↔tipo
definido numa fonte única compartilhada entre servidor e cliente.

Entrada malformada (data inválida, categoria de tipo desconhecida ou
identificador de autor inválido) SHALL ser recusada com erro de validação, sem
executar a busca.

Uma requisição **sem nenhum filtro** SHALL continuar sendo válida e SHALL
retornar todos os arquivos visíveis ao solicitante — a decisão de **quando**
consultar é da interface, não do endpoint. A partir da change
`busca-acionamento-explicito`, a SPA deixa de emitir essa requisição sem
critérios (a tela de busca só consulta após acionamento explícito do usuário,
ver spec `web-busca`), mas o contrato do endpoint permanece inalterado.

#### Scenario: Busca com filtros combinados (US 9.1 cenário 1)
- **WHEN** o solicitante busca por um nome e aplica filtros de data, tipo e/ou
  autor
- **THEN** o sistema retorna apenas os arquivos que atendem a **todos** os
  critérios informados e para os quais ele tem permissão de ver, ordenados do
  mais recente para o mais antigo

#### Scenario: Busca por nome parcial
- **WHEN** o solicitante informa parte do nome de um arquivo
- **THEN** o sistema retorna os arquivos visíveis cujo nome contém o trecho
  informado, sem diferenciar maiúsculas de minúsculas

#### Scenario: Filtro por tipo derivado do content_type
- **WHEN** o solicitante filtra por uma categoria de tipo (por exemplo,
  imagens ou documentos de escritório)
- **THEN** o sistema retorna apenas os arquivos visíveis cujo `content_type`
  pertence àquela categoria

#### Scenario: Busca sem nenhum filtro retorna tudo o que é visível
- **WHEN** o solicitante executa a busca sem informar nenhum filtro
- **THEN** o sistema retorna todos os arquivos que ele tem permissão de ver, sem
  restrição adicional

#### Scenario: Entrada de filtro inválida
- **WHEN** o solicitante informa um filtro malformado (data inválida, categoria
  de tipo inexistente ou autor inválido)
- **THEN** o sistema recusa a requisição com erro de validação e não executa a
  busca

### Requirement: Busca restrita ao alcance de permissão do solicitante

A busca SHALL aplicar **sempre** a mesma resolução de visibilidade da navegação
(dono do arquivo OU grant `view` OU administrador da unidade do arquivo) como
fronteira, independentemente dos filtros informados. Os filtros do usuário SHALL
ser apenas restrições adicionais sobre esse alcance e NÃO SHALL, em nenhuma
hipótese, ampliá-lo. Arquivos na lixeira (`deleted_at` preenchido) NÃO SHALL
aparecer na busca.

#### Scenario: Colaborador não encontra arquivo de terceiro sem permissão
- **WHEN** um colaborador busca por um nome que corresponde a um arquivo que não
  é seu e para o qual não recebeu grant `view`
- **THEN** o arquivo não aparece no resultado

#### Scenario: Colaborador encontra arquivo liberado a ele
- **WHEN** um colaborador busca por um arquivo do qual não é dono mas sobre o
  qual possui grant `view`
- **THEN** o arquivo aparece no resultado se atender aos demais filtros

#### Scenario: Administrador encontra arquivos da sua unidade
- **WHEN** um administrador de unidade busca por arquivos da sua unidade dos
  quais não é dono
- **THEN** os arquivos da unidade que atendem aos critérios aparecem no resultado

#### Scenario: Item na lixeira não aparece na busca
- **WHEN** o solicitante busca por um nome que corresponde a um arquivo que está
  na lixeira
- **THEN** o arquivo excluído não aparece no resultado

### Requirement: Isolamento por unidade na busca

A busca NÃO SHALL, em nenhuma hipótese, retornar arquivos pertencentes a uma
unidade diferente da do solicitante — nem por correspondência de nome, nem por
qualquer combinação de filtros. O bypass de RLS do `global_admin` NÃO SHALL
transformar a busca num alcance sobre arquivos de outras unidades. Fecha a
**US 5.1 cenário 2** ("nunca vejo arquivos de outra unidade, mesmo por busca")
também para esta via.

#### Scenario: Busca não atravessa unidade (US 5.1 cenário 2)
- **WHEN** um solicitante de uma unidade busca por um nome que também existe num
  arquivo de outra unidade
- **THEN** apenas os arquivos da sua própria unidade que ele pode ver aparecem,
  e nenhum arquivo de outra unidade é retornado

### Requirement: Busca alcança o código do documento

O sistema SHALL encontrar documentos pelo seu código, além do nome do arquivo,
num mesmo termo de busca. O código SHALL ser comparado sem distinção entre
maiúsculas e minúsculas. O alcance por código SHALL respeitar integralmente as
restrições já normatizadas da busca — permissão do solicitante e isolamento por
unidade —, sem abrir exceção a nenhuma delas. Referência: PRD US 10.2.

#### Scenario: Termo de busca encontra o documento pelo código
- **WHEN** uma pessoa informa na busca o código de um documento a que tem acesso
- **THEN** o documento correspondente é retornado

#### Scenario: Busca por código respeita a permissão
- **WHEN** uma pessoa informa na busca o código de um documento da sua unidade
  sobre o qual não tem permissão
- **THEN** o documento não é retornado, e a resposta não revela que ele existe

#### Scenario: Busca por código não atravessa unidades
- **WHEN** uma pessoa informa na busca um código que existe apenas em outra
  unidade
- **THEN** nenhum documento é retornado, qualquer que seja o papel do
  solicitante
