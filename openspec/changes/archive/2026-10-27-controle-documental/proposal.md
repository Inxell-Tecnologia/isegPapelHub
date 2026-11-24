# Proposal

## Why

O cliente pediu que a listagem de documentos mostre, por item, o tipo, o
código, a revisão, o responsável, a data da próxima revisão e a situação —
"Vigente", "Vence em 45 dias", "Revisão vencida". Nada disso existe no sistema:
a tabela `files` guarda nome, tipo de conteúdo, tamanho, dono, pasta e as
marcas de lixeira, e o único `status` que possui descreve o **upload**
(`pending`/`active`/`over_quota`), não a vigência do documento.

Entregar a aparência pedida sem esses campos produziria as telas de referência
com as colunas vazias. Esta change implementa o domínio por trás delas: o
PapelHub deixa de ser um repositório de arquivos e passa a ser um repositório de
**documentos controlados**.

Implementa o Épico 10 do PRD (US 10.1 a 10.7), acrescentado ao
`docs/prd_final.md` para esta fatia — não havia, até aqui, nenhuma história de
usuário sobre revisão, vigência ou obsolescência.

## What Changes

- **Documento ganha dados de controle**: tipo (entre os oito previstos, cada um
  com sigla e cor), código único por unidade, revisão, setor responsável e data
  de próxima revisão. Todos opcionais no dado, exigidos conforme o fluxo.
- **Situação apurada na consulta, nunca por rotina**: Vigente, A vencer (dentro
  de 60 dias), Em revisão, Revisão vencida, Obsoleto ou Sem controle de
  revisão. Derivada no banco, pelo relógio do servidor — mesmo princípio já
  adotado para a vigência de concessões, que não depende de job nenhum.
- **Nasce o estado "Sem controle de revisão"**, que o guia do cliente não
  prevê. Ele é consequência direta da decisão de dispensar metadados no lote: o
  acervo já existente e tudo que entrar por lote cai nele. Sem esse estado,
  ou se mentiria a situação, ou se exigiria um preenchimento retroativo
  impossível.
- **Metadados exigidos no envio de um documento, dispensados no lote e no envio
  de pasta.** O que entra sem eles pode recebê-los depois, por edição.
- **Substituir o arquivo avança a revisão**, preservando código, tipo e
  responsável. **Não** cria histórico: a versão anterior segue indisponível,
  como o PRD já fixa.
- **Documento obsoleto sai de circulação** para quem não é gestão da unidade —
  por navegação, por busca e por link direto.
- **A busca passa a alcançar o código** do documento, além do nome.
- **BREAKING** (contrato de leitura): `FileSummaryResponse` ganha os campos de
  controle. Consumidores que hoje tratam o objeto como fechado precisam
  acompanhar.

### Fora de escopo

- **Busca pelo conteúdo interno dos arquivos.** O cliente pediu busca "pelo
  conteúdo do arquivo" na mesma linha em que pediu o campo de busca no topo.
  São trabalhos de ordem diferente: extrair texto de PDF e de documentos de
  escritório exige um consumidor que baixe o objeto no servidor — e os bytes,
  por desenho, nunca passam pela API. Fica como épico próprio.
- **Leitura obrigatória com registro de ciência, favoritos, notificações novas
  e tour guiado**: fora por decisão do cliente, já refletida no PRD.
- **Histórico de versões navegável**: permanece fora de escopo no PRD. A
  revisão é um número que avança, não um acervo de versões.
- **Fluxo de aprovação ou workflow de revisão** (quem aprova, quando publica):
  não foi pedido. "Em revisão" é um estado declarado, não uma etapa de processo.

## Capabilities

### New Capabilities
- `controle-documental`: os dados de controle de um documento (tipo, código,
  revisão, responsável, próxima revisão), a apuração da sua situação no momento
  da consulta e as regras de circulação que decorrem dela — incluindo a
  retirada do documento obsoleto do alcance de quem não é gestão.

### Modified Capabilities
- `gestao-arquivos`: o requisito "Substituir arquivo por nova versão" passa a
  avançar a revisão do documento, preservando os demais dados de controle. A
  ausência de histórico de versões permanece inalterada.
- `busca`: acrescenta o código do documento como critério de busca, ao lado do
  nome, sem alterar os filtros já combináveis.
- `web-navegacao`: acrescenta a apresentação dos dados de controle na listagem
  do explorador e o caminho para preenchê-los ou corrigi-los depois.
- `web-upload`: acrescenta a exigência dos dados de controle no envio de um
  documento, e a sua dispensa explícita no envio em lote e de pasta.

## Impact

**Banco de dados** — migration nova, aditiva:
- Colunas em `files`: tipo, código, revisão, responsável, data de próxima
  revisão e estado declarado do ciclo de vida. Todas nulas, sem reescrita de
  tabela e sem backfill.
- Coluna de tipo em `folders`, para a cor e o ícone da pasta.
- Índice único parcial do código por unidade, restrito aos não excluídos.
- **Nenhuma tabela nova**, portanto nenhuma policy RLS nova: os campos moram em
  tabelas que já têm `unit_id` e policy. O isolamento entre unidades não é
  tocado.

**Backend (`apps/api`)**:
- Rota nova para editar os dados de controle de um documento, sujeita à mesma
  resolução de acesso já existente — sem verbo novo.
- `lib/access.ts` ganha a primeira exceção da sua história: o documento
  obsoleto some para quem não é gestão da unidade. A regra é **restritiva**,
  nunca permissiva — não abre acesso que antes não existia, e continua
  fail-closed.
- A situação é calculada em SQL, no `SELECT`, não no processo Node.

**Contrato compartilhado (`packages/shared`)**: enum dos oito tipos, enum das
situações, campos novos em `FileSummaryResponse` e DTO da edição.

**Frontend (`apps/web`)**: colunas novas no explorador, etiqueta de tipo,
indicador de situação, formulário de dados de controle no envio unitário e na
edição.

**Documentação**: o manual ganha a explicação do controle documental — o que
cada situação significa e quando os dados são exigidos.
