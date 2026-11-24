# Proposal

## Why

Na 3ª rodada de ajustes (`docs/demanda_cliente_3.md`, item 7; fatia **C** de
`docs/plano_demanda_cliente_3.md`) o cliente pede que os cartões de **Pastas da
unidade**, na tela Início, tragam **ícone colorido e o número de documentos**,
como na imagem de referência
`docs/images/demanda_3/PapelHub_tela_inicial_numerado_ajustes.webp` ("Geral —
12 documentos", "Governança — 38 documentos"). Hoje o cartão mostra só um ícone
azul e o nome.

As fatias A e B (arquivadas em 2026-11-10 e 2026-11-11) já entregaram os demais
itens; esta é a última da demanda e a **única com backend**: `FolderResponse`
não traz contagem, e a SPA não pode calculá-la — não enxerga o que não lhe foi
liberado e não decide permissão.

O ponto sensível é de segurança, não de apresentação: uma contagem **não
filtrada pelo acesso de quem consulta** revelaria a existência de documentos sem
permissão (o "12" diria que há doze arquivos lá dentro mesmo a quem só pode ver
dois). A contagem precisa obedecer à mesma regra da listagem — dono, admin da
unidade do recurso ou concessão vigente de `view`, sem herança, fail-closed —
para nunca dizer mais do que a pessoa veria ao abrir a pasta. PRD: US 11.1,
cenário 3 (acesso rápido às pastas), sob a regra de acesso de US 4.1/4.2
(concessões, sem vazamento por link), US 4.3 (expiração), US 5.1 (escopo da
unidade) e US 10.7/10.9 (obsoleto e pendente de cadastro fora de circulação).

## What Changes

**API (`navegacao`)**

- As rotas de conteúdo (`GET /folders/root/contents` e
  `GET /folders/:id/contents`) passam a informar, **em cada subpasta listada**,
  `documentCount`: quantos documentos **diretamente** dentro dela o solicitante
  veria ao abrir aquela pasta — exatamente o mesmo recorte da listagem (fora da
  lixeira, acesso por dono/admin da unidade/concessão vigente de `view`,
  obsoleto só para admin da unidade, pendente de cadastro só para quem enviou ou
  administra). Sem herança: concessão sobre a pasta não faz contar os arquivos
  dela.
- Uma única consulta agregada por requisição (`GROUP BY folder_id`), na mesma
  transação tenant da listagem, restrita aos ids que a listagem acabou de
  liberar. Vigência pelo relógio do Postgres.

**Web (`tela-inicial`)**

- Cartão de pasta em **Pastas da unidade** com o **ícone em quadrado tingido**
  (mesma linguagem dos atalhos, tom estável por pasta) e, abaixo do nome, a
  contagem: "Nenhum documento", "1 documento", "N documentos". O nome acessível
  do cartão continua sendo o nome da pasta; a contagem o descreve.

**Fora de escopo**

- Contagem na **subárvore** (documentos de subpastas): ver design.md D2.
- Contagem no **explorador** (`/pastas`): o dado chega na resposta, mas a
  tabela do explorador não muda nesta fatia.
- Item 13 (acompanhamento por unidade): Fase 2.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `navegacao`: requisito novo — a resposta de conteúdo informa, por subpasta
  listada, a contagem de documentos diretos filtrada pelo acesso do solicitante.
- `tela-inicial`: o cartão de pasta apresenta ícone tingido e o número de
  documentos.

## Impact

- **Shared**: `packages/shared/src/folders.ts` — `FolderListItemResponse`
  (`FolderResponse` + `documentCount`) nos `folders` de `FolderContentsResponse`.
- **API**: `apps/api/src/routes/folders.ts` (`listContents` + contagem
  agregada); reaproveita `visibleResourceClause`, `nonObsoleteClause` e
  `visibleRegistrationClause`, sem regra nova de acesso.
- **Testes API**: casos novos em `folders.test.ts` e, junto dos de isolamento,
  em `isolamento-unidade.test.ts`/`expiracao-permissoes-acesso.test.ts`.
- **Web**: `apps/web/src/inicio/InicioPage.tsx` (cartão de pasta), função pura
  de texto da contagem, tom estável por pasta a partir de `tonsDeAtalho`;
  `tela-inicial.test.tsx`.
- **Manual**: `docs/manual/docs/a-tela.md` (Pastas da unidade).
- **Plano**: `docs/plano_demanda_cliente_3.md` (fatia C → entregue).
- **Banco e infraestrutura**: nenhuma migration (o índice
  `files (unit_id, folder_id)` já existe), nenhuma rota/prefixo novo, nenhum
  recurso de nuvem.
