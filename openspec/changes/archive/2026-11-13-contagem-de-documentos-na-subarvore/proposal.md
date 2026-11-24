# Proposal

## Why

O change `contagem-de-documentos-nas-pastas` (arquivado em 2026-11-11, fatia
**C** de `docs/plano_demanda_cliente_3.md`) entregou o número de documentos no
cartão de **Pastas da unidade** contando só os documentos **diretos** de cada
pasta, e deixou registrada uma pendência a validar com o cliente (design.md D2
daquele change): o mockup ("Governança — 38 documentos") sugeria a soma da
subárvore, e uma pasta de setor que só tem subpastas aparece hoje como
"Nenhum documento".

O cliente respondeu: prefere a **soma de tudo o que está dentro da pasta,
incluindo as subpastas**, mas a conta deve incluir **só os documentos que a
pessoa pode abrir** — se ela não tem acesso a uma subpasta, os documentos dela
ficam fora da conta. Isso fecha a regra do "item invisível" que travava a
soma.

A exigência de segurança continua a mesma: o número nunca pode revelar a
existência de conteúdo sem permissão. PRD: US 11.1, cenário 3 (acesso rápido às
pastas), sob a regra de acesso de US 4.1/4.2 (concessões sem herança), US 4.3
(expiração), US 5.1 (escopo da unidade) e US 10.7/10.9 (obsoleto e pendente de
cadastro fora de circulação).

## What Changes

**API (`navegacao`)**

- `documentCount`, em cada subpasta listada por `GET /folders/root/contents` e
  `GET /folders/:id/contents`, passa a ser a soma dos documentos da **pasta e
  de toda a sua subárvore alcançável** pelo solicitante:
  - a descida só atravessa subpastas que ele pode abrir (vivas, e dono, admin
    da unidade ou concessão vigente de `view` sobre a **própria subpasta**);
    subpasta sem acesso é podada **com toda a sua descendência** — mesma poda
    do download de pasta (`download-pasta`);
  - em cada pasta alcançada, conta-se exatamente o recorte da listagem de
    documentos (fora da lixeira; dono, admin da unidade ou concessão vigente de
    `view` sobre o próprio documento, sem herança; obsoleto só para admin da
    unidade; pendente de cadastro só para quem enviou ou administra).
- Continua sendo **uma única consulta** agregada por requisição (CTE recursiva
  com o recorte de acesso em cada nível), na mesma transação tenant, vigência
  pelo relógio do Postgres, restrita à própria unidade inclusive para o admin
  global.
- **BREAKING (semântica, não forma):** o campo e o tipo não mudam; o valor
  passa de "documentos diretos" a "documentos na subárvore alcançável".

**Web (`tela-inicial`)**

- Nenhuma mudança de código: o cartão já mostra o número tal como o servidor
  informa. Muda o requisito (o número é "documentos que a pessoa pode abrir
  dentro da pasta, incluindo subpastas") e o texto do manual.

**Fora de escopo**

- Exibir a contagem no explorador (`/pastas`) — segue fora, como no change
  anterior.
- Contar subpastas.
- Contar documento alcançável por outro caminho (ex.: compartilhado
  diretamente comigo dentro de uma subpasta que não posso abrir): fica fora da
  soma; continua acessível por **Compartilhados comigo**.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `navegacao`: o requisito de contagem por subpasta ("documentos diretos") é
  **substituído** — removido e adicionado com nome novo — pela soma da subárvore
  alcançável, com poda das subpastas sem acesso. Substituição em vez de
  MODIFIED porque o cenário antigo "Subpastas não entram na contagem" nomeia
  justamente a regra que o cliente reverteu.
- `tela-inicial`: o cartão de pasta apresenta o número de documentos que a
  pessoa pode abrir **dentro da pasta, incluindo as subpastas**.

## Impact

- **API**: `apps/api/src/routes/folders.ts` (`listContents`, consulta de
  contagem vira CTE recursiva); reaproveita `visibleResourceClause`,
  `nonObsoleteClause` e `visibleRegistrationClause`, sem regra nova de acesso.
- **Shared**: só o comentário de `documentCount` em
  `packages/shared/src/folders.ts`; contrato inalterado.
- **Testes API**: `apps/api/src/__tests__/contagem-documentos-pastas.test.ts`
  — o caso "só filhos diretos" é invertido, e entram poda de subpasta sem
  acesso (com descendência), subpasta na lixeira, ciclo/profundidade e a nova
  igualdade recursiva.
- **Web**: nenhuma mudança de código; `tela-inicial.test.tsx` inalterado.
- **Manual**: `docs/manual/docs/a-tela.md` (Pastas da unidade).
- **Plano**: `docs/plano_demanda_cliente_3.md` (pendência da fatia C resolvida).
- **Banco e infraestrutura**: nenhuma migration (índices `folders (unit_id, parent_id)`
  e `files (unit_id, folder_id)` cobrem a CTE), nenhuma
  rota/prefixo novo, nenhum recurso de nuvem.
