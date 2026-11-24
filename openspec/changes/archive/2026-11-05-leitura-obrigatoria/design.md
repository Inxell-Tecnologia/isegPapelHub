# Design

## Context

O acesso a conteúdo é **dono OU administrador da unidade OU concessão vigente
do verbo**, sem herança (`lib/access.ts`). A tela de colaboradores ganhou o
gestor de acompanhamento (C0) e o setor é entidade por unidade (A1). A
situação do documento é derivada no `SELECT` pelo relógio do banco
(`fileSummaryColumns`). Nada disso conhece leitura obrigatória.

## Goals / Non-Goals

**Goals**

- Marcar, com público e prazo, e dar ciência, com os registros de 3.4.
- Aplicar as regras de 3.3 sem rotina: tudo apurado na consulta.
- Que o público consiga ler o documento, sem abrir mais nada.

**Non-Goals**

- Superfícies (C2), avisos (C3), relatório (C4), marcação no envio.

## Decisions

### D1 — Duas tabelas: campanha por revisão, atribuição por pessoa

`reading_campaigns(file_id, document_revision, document_code, document_title,
audience jsonb, due_date date, message, created_by, created_at)` com
`UNIQUE (file_id, document_revision)` — **uma marcação por revisão**.
`reading_assignments(campaign_id, user_id, due_date, assigned_at,
acknowledged_at, acknowledged_sector_name)` com `UNIQUE (campaign_id,
user_id)`. Ambas com `unit_id` + RLS. Código, título e revisão ficam
**copiados** na campanha: o registro de 3.4 descreve o documento como estava ao
ser marcado, e renomear ou substituir o arquivo depois não pode reescrever o
histórico.

### D2 — Público é critério; pendência é materializada quando a pessoa é alcançada

O público é guardado como **critério** (`{ wholeUnit, sectorIds, roles,
userIds }`, combinados por "ou"), avaliado sobre as pessoas **ativas** da
unidade do documento. Na marcação, as atribuições do público daquele momento
são criadas com o prazo da marcação. Quem passa a casar com o critério depois
(admissão, troca de setor) recebe a atribuição **na primeira vez que consulta
as próprias leituras**, com prazo de **15 dias a partir dali** — a regra de 3.3
sem rotina. A C3 vai reconciliar o público inteiro diariamente para avisar
antes da consulta; esta fatia deixa a função pronta para isso.

"Unidades" no público significa **a unidade do documento**: o isolamento por
unidade continua (D1 do cliente). Pessoa desativada não casa com o critério e
não recebe atribuição; a que for desativada depois sai do cálculo da C4.

### D3 — Situação derivada na consulta

| Situação | Condição |
| :-- | :-- |
| Concluída | `acknowledged_at` preenchido |
| Encerrada | arquivo excluído, obsoleto, ou revisão atual ≠ revisão da campanha |
| Atrasada | aberta e `current_date > due_date` |
| Pendente | aberta e dentro do prazo |

Pelo relógio do Postgres, em SQL, como a situação do documento. Substituir o
arquivo (nova revisão) ou declará-lo obsoleto **encerra** as pendências sem
escrita nenhuma e sem rotina — a pendência "some" na requisição seguinte. A
ciência antiga continua "Concluída" no histórico.

### D4 — Quem marca: quem pode editar os dados de controle

A demanda diz "publicador com permissão de envio". O verbo que governa o
**documento** — editar os dados de controle, o mesmo de renomear e substituir —
é `rename`, e o explorador já o recebe resolvido (`canEditControl`). Marcar
exige `hasAccess(file, rename)`: dono, administrador da unidade ou concessão de
alterar. Permissão de **envio numa pasta** não basta: ela é sobre a pasta, e
marcar é decidir sobre um documento que pode ser de outra pessoa.

### D5 — Elegível: controlado e em vigor

Situação derivada `current` ou `due_soon` ("Vigente" e "a vencer" — a revisão
está em vigor). Recusados com motivo próprio (`not_eligible`): Arquivo geral e
sem controle, pendente de cadastro, em revisão, vencido, obsoleto.

### D6 — Ser do público libera **visualizar**, e só isso

Novo ramo em `hasAccess`, depois de dono e administrador e antes das
concessões: verbo **`view`**, recurso **arquivo**, e existe atribuição da
pessoa numa campanha **do arquivo** para a **revisão atual**. Herda, por estar
depois, as subtrações já existentes (obsoleto, pendente de cadastro) e a
comparação de unidade (a atribuição tem `unit_id`, e a RLS limita à unidade do
contexto). Fica de fora:

- `download`, `rename`, `delete` — ler não é baixar;
- **listagem e busca** — os fragmentos SQL de alcance não mudam; o documento é
  alcançado pela leitura (visualizador), não pela navegação;
- revisão anterior — a nova revisão sem nova marcação **retira** o acesso de
  quem não tinha outro.

Consequência aceita: os **Recentes** e a **contagem de novos** do Início
filtram candidatos por `hasAccess(view)`, então o documento marcado aparece
neles para o leitor. É coerente — ele pode visualizá-lo — e é por onde o
leitor chega ao documento até a C2 trazer o menu de leituras.

É uma ampliação de alcance decidida por quem já controla o documento (D4),
dentro da unidade. Testes de isolamento próprios.

### D7 — Ciência: só a própria, só pendente, irreversível

`POST /reading/assignments/:id/acknowledge`: a atribuição tem de ser **da
pessoa**, estar **aberta** (pendente ou atrasada) e a pessoa tem de alcançar o
documento. Grava `acknowledged_at = now()` e o **nome do setor** naquele
momento. Atribuição alheia, inexistente, de outra unidade → 404 indistinguível.
Concluída ou encerrada → 409 `not_pending`. Nenhuma rota desfaz.

O "só depois que o documento abre" é da interface: o botão habilita quando o
visualizador termina de carregar o documento (evento de carga). Formato sem
pré-visualização não é marcável (D11).

### D8 — Opções de público por arquivo

O publicador pode ser colaborador (dono do documento) e não alcança `GET /users`
nem `GET /sectors`, que são da administração. `GET /reading/files/:id/
audience-options` devolve setores e pessoas **ativas** da unidade do
documento — só a quem pode marcá-lo (D4). Nome e setor, nada mais.

### D9 — Nova revisão: mesmo público, um clique

Ao abrir "Leitura obrigatória" num arquivo cuja revisão anterior teve
marcação e a atual não, o formulário vem **preenchido com o público
anterior** e diz que a revisão mudou. Confirmar cria a campanha da revisão nova
— é o "publicador escolhe se pede nova ciência ao mesmo público". O aviso no
momento da substituição fica para a C2, junto do ícone na linha.

### D11 — Só documento que abre no visualizador

Descoberto na implementação: como o público só ganha **visualizar** (D6), um
documento sem pré-visualização (formato de escritório, por exemplo) não poderia
ser lido por ninguém do público sem outra permissão — nem aberto, nem baixado.
A marcação passa a exigir formato pré-visualizável (`isPreviewable`, a mesma
fonte de `view-url` e da SPA), recusando com `not_previewable`. Com isso o botão
de ciência só depende do evento de carga do visualizador.

### D10 — Prefixo `/reading`

Marcação e ciência não são de `/files` (a lista "minhas leituras" atravessa
arquivos) nem de `/grants`. Prefixo novo nas três listas, com caso em
`web-serving.test.ts`.

## Risks / Trade-offs

- **D6 amplia alcance.** Mitigado por ser só `view`, só revisão atual, só
  unidade, só por decisão de quem controla o documento; e pelos testes.
- **Pendência de quem entra depois** só nasce quando a pessoa consulta (até a
  C3). Aceito para esta fatia; registrado no plano.
- **Público grande**: a marcação insere uma linha por pessoa numa transação.
  Unidades hospitalares têm centenas de pessoas, não dezenas de milhares.

## Migration Plan

Migração aditiva (`0024`). Deploy da API e do `locals.tf` juntos (prefixo
novo).

## Open Questions

- Texto da mensagem padrão e do aviso de nova revisão, na homologação.
