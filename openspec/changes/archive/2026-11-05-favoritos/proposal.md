# Proposal

## Why

A tabela 1.1 de `docs/demanda_cliente_2.md` pede o item de menu **Favoritos**
no grupo NAVEGAÇÃO, entre Recentes e Compartilhados comigo. É a fatia **A4** do
plano em `docs/plano_demanda_cliente_2.md`; a A2 deixou o item **de fora de
propósito**, porque `tela-inicial` normatiza que "atalho apresentado conduz a
uma ação executável" — o item entra junto com o seu destino.

Diferente da A5, aqui **é reentrada de escopo**: a lista de Fora de Escopo do
PRD exclui literalmente *"Marcação de documentos como favoritos e lista pessoal
de favoritos"*, e o change `shell-e-inicio` a deixou fora "por decisão do
cliente". A demanda nº 2 é a decisão nova do mesmo cliente, e o PRD passa a
registrar a volta.

O problema que a lista resolve é o mesmo que motivou a A5: sem herança de
permissão, o documento que a pessoa consulta toda semana pode estar a quatro
pastas de profundidade, e hoje o único atalho para ele é o endereço guardado no
navegador.

## What Changes

- **Marcar e desmarcar** arquivo ou pasta como favorito, no explorador (ação do
  item) e na própria lista. Só se marca o que se **alcança**: o servidor exige
  `view` sobre o recurso, e a recusa é indistinguível de recurso inexistente.
- **Destino novo "Favoritos"** no grupo NAVEGAÇÃO, para **qualquer papel**,
  entre Recentes e Compartilhados comigo, como pede a demanda.
- **A lista consome a forma fixada pela A5** (`compartilhados-comigo`):
  localização = pasta que contém o item (nunca a cadeia), arquivo abre na
  visualização, pasta abre no explorador, ações **só dos verbos que a pessoa
  tem** — resolvidos pelo servidor — e perda de alcance remove o item sem
  erro. Uma segunda forma para a mesma tela é o que faria as duas divergirem.
- **Favorito não é permissão.** A marca não concede nada: o item aparece só
  enquanto a resolução de acesso o liberar, e compõe-se com todas as regras
  restritivas vigentes (obsoleto, pendente de cadastro, lixeira, isolamento por
  unidade). Perder o acesso **oculta** o item, sem apagar a marca: se o acesso
  voltar, o favorito volta.
- **Tabela nova `favorites`** com `unit_id` + RLS (regra dura do projeto), única
  por pessoa e recurso. Ordenação do favoritado mais recente para o mais antigo.
- **Teto por pessoa** (padrão 200), para a lista ter custo limitado: a
  resolução de acesso é item a item. Acima dele, marcar é recusado com motivo
  próprio.
- **Expurgo da lixeira remove as marcas** do recurso expurgado, na mesma
  sequência que já remove as concessões — sem linha órfã.
- **Prefixo de topo novo `/favorites`**, nas **três** listas que precisam ficar
  em sincronia (`api-prefixes.ts`, `vite.config.ts`, `locals.tf`).

## Capabilities

### New Capabilities

- `favoritos` — marcar, desmarcar e listar favoritos; alcance e forma da lista.

### Modified Capabilities

- `web-shell-e-auth` — o destino Favoritos entra no conjunto de destinos
  internos, para qualquer papel.
- `web-navegacao` — o explorador oferece marcar e desmarcar favorito em cada
  item e indica o que já é favorito.
- `lixeira` — o expurgo remove as marcas de favorito do recurso expurgado.

## Impact

- **Banco**: migração `0021_favorites.sql` (tabela, índice único, RLS).
- **API**: rota `routes/favorites.ts` (`GET`, `PUT`, `DELETE`), ids favoritos na
  listagem de pasta, expurgo em `jobs/purge-trash.ts` e `lib/purge-file.ts`, `config.favorites`,
  prefixo em `lib/api-prefixes.ts`.
- **Shared**: DTOs da lista e da marcação; ids favoritos na listagem de pasta.
- **Web**: `favoritos/` (página e consultas), item de menu no `AppShell`, ação no
  `ExplorerPage`, proxy em `vite.config.ts`.
- **Infra**: `infra/terraform/locals.tf` (`api_proxy_prefixes`).
- **Documentação**: página nova do manual (`colaborador/favoritos.md`) e menu em
  `a-tela.md`; PRD — sai da lista de Fora de Escopo e entra a **US 2.5**; plano.
