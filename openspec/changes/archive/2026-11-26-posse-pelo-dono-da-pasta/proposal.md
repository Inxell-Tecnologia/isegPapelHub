# Proposal

## Why

Um colaborador com permissão de **envio** (`upload`) sobre a pasta de outra pessoa
consegue enviar arquivos para ela, mas recebe "Permissão insuficiente para executar
esta ação." ao tentar criar uma subpasta: `POST /folders` exige que quem cria seja
**dono** da pasta-pai, e nenhum grant libera isso (nem ser admin da unidade). Além
disso, o que ele envia fica com **ele** como dono, e o dono da pasta — sem herança
(US 4.x) — **não enxerga** os arquivos depositados na própria pasta, a menos que seja
admin da unidade. O cliente decidiu: quem é dono da pasta é dono de tudo o que nasce
dentro dela, inclusive para efeito de cota, e quem criou continua com acesso e fica
registrado como autor. Referência: PRD US 2.1 (cenário 2: "os itens que criei ou que
me foram liberados"), US 3.1/3.2 (envio), US 8.1 (cota).

## What Changes

- **Criar subpasta** dentro da pasta P passa a ser autorizado por: dono de P, admin da
  unidade de P **ou grant `upload` vigente sobre P** (hoje: só dono). O 403 continua
  fail-closed para pasta inexistente/de outra unidade/sem permissão.
- **BREAKING (regra de posse):** todo item (pasta ou arquivo) criado dentro de uma
  pasta P passa a ter como **dono o dono imediato de P** — inclusive no envio
  individual, no envio em lote e no envio de árvore de pastas por arrastar (cada nível
  herda o dono da pasta em que nasce). Na raiz da unidade, o dono continua sendo quem
  cria. Itens existentes **não** são migrados de dono.
- **Autoria registrada:** pastas ganham `created_by` e arquivos ganham `uploaded_by`
  (quem realmente criou/enviou), preenchidos para os dados existentes com o dono atual.
  O envio de arquivo concluído passa a gerar um evento de auditoria `upload` atribuído
  a quem enviou. Toda regra que hoje usa "dono" no sentido de **quem enviou** passa a
  usar a autoria — em especial a visibilidade do arquivo **pendente de cadastro**
  (US 10.9) e a retomada de envio `pending` presa a um código de documento.
- **Concessões automáticas ao autor:** quando autor ≠ dono, o autor recebe, sobre o
  item criado, os verbos `view`, `download`, `rename` e — se for pasta — `upload`.
  **Nunca `delete`.** Sem prazo de expiração. São concessões comuns: aparecem na
  gestão de permissões, marcadas como automáticas por autoria, e podem ser revogadas
  pela administração (quem já gerencia concessões); não geram aviso ao autor.
- **Cota do dono:** a verificação de cota na emissão de URL (avulsa, lote e
  substituição de versão) passa a usar a cota efetiva e a reserva **do futuro dono**
  do arquivo — a mesma pessoa a quem a reconciliação já atribui o consumo. A recusa
  por falta de espaço do dono é distinguível da recusa por espaço próprio e **não
  revela valores** da cota alheia.
- **SPA:** a verificação de viabilidade antes do envio continua usando o espaço do
  próprio solicitante quando o destino é dele; quando o destino pertence a outra
  pessoa, a SPA não faz pré-checagem numérica (não há como consultar cota alheia) e
  trata a recusa do servidor com mensagem própria ("o espaço do responsável por esta
  pasta não comporta o envio"). A resposta de conteúdo da pasta informa se o
  solicitante é o dono dela.
- **Manual** (`docs/manual/`): criar pasta e enviar em pasta de outra pessoa, quem
  fica dono, de quem é a cota, o que o autor continua podendo fazer.

Fora de escopo (mudança futura, se necessário):
- Migrar a posse de itens já criados em pastas de terceiros.
- Permitir ao dono (não-admin) revogar as concessões automáticas — a gestão de
  concessões segue restrita à administração (`permissoes-granulares`).
- Exibir "Enviado por" na listagem do explorador (a autoria fica visível na
  auditoria do arquivo).
- Exigir `upload` sobre pastas intermediárias **já existentes** reaproveitadas pelo
  envio de árvore (hoje só a pasta-âncora é checada) — ver design.md.
- Herança de permissão por ancestral: continua **não** existindo.

## Capabilities

### New Capabilities
- `posse-e-autoria`: regra de quem é dono de um item recém-criado (dono imediato da
  pasta em que nasce), registro de autoria (quem criou/enviou) e concessões
  automáticas ao autor quando ele não é o dono.

### Modified Capabilities
- `navegacao`: "Pastas aninhadas por unidade" — criar subpasta passa a ser permitido
  também a admin da unidade e a quem tem `upload` vigente na pasta-pai; o dono da nova
  pasta é o dono da pasta-pai.
- `envio-pasta`: a hierarquia recriada no envio de pasta segue a regra de posse
  (cada nível com o dono da pasta em que nasce).
- `envio-lote`: "Reserva de cota consciente do lote" — o limite e a reserva aplicados
  são os do futuro dono de cada item.
- `cota-individual`: nova regra de quem paga o envio para pasta de outra pessoa e de
  recusa sem revelar a cota alheia.
- `controle-documental`: no arquivo pendente de cadastro (US 10.9), "quem o enviou"
  passa a ser o autor do envio, que pode não ser o dono (requisito novo, que
  complementa "Arquivo pendente de cadastro não circula até ser completado").
- `permissoes-granulares`: concessões automáticas por autoria convivem com as
  manuais (identificáveis, revogáveis pela administração, sem `delete`).
- `auditoria`: evento de envio concluído, atribuído a quem enviou.
- `busca`: o filtro de autor passa a considerar quem enviou o arquivo, não o dono.
- `web-upload`: viabilidade e recusa por espaço quando o destino é de outra pessoa.

## Impact

- **API:** `routes/folders.ts` (`POST /folders`, resposta de conteúdo com indicação
  de posse), `routes/files.ts` (`upload-url`, `upload-urls`, `replace-url`, retomada
  de `pending`), `lib/folder-tree.ts` (`findOrCreateChild`/`ensureFolderPath`),
  `lib/access.ts`/`lib/document-control.ts` (cláusula do pendente de cadastro),
  `lib/storage-reconcile.ts` (evento `upload`), rota de grants (marca de concessão
  automática na listagem).
- **Banco:** migration `0028` — `folders.created_by`, `files.uploaded_by` (backfill =
  `owner_id`), `grants.origin` (`manual`/`autoria`), ação `upload` no `CHECK` de
  `audit_events`. Sem tabela nova; RLS existente cobre as colunas novas.
- **Shared:** `AuditAction.UPLOAD`, campo de posse na resposta de conteúdo, código de
  erro de cota do dono, origem da concessão no DTO de grants.
- **Web:** `upload/` (pré-checagem e mensagem de recusa), `auditoria/` (rótulo do
  evento `upload`), `permissoes/` (marca "automática").
- **Testes de segurança:** `permission.test.ts`, `isolamento-unidade.test.ts` e
  testes de cota/pendente ganham casos novos; nenhum invariante de isolamento muda.
- **Docs:** `docs/manual/docs/colaborador/navegar-e-criar.md`, `enviar.md`, e a
  página de permissões do administrador.
- **Infra:** nenhuma mudança de Terraform ou de jobs.
