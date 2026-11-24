# Tasks

Ordem por dependência: contrato compartilhado → banco → derivação da situação →
validação → alcance → rotas → notificação → apresentação → integração. Cada
grupo entrega os seus próprios testes e a sua própria documentação.

Não há tarefa de infraestrutura (Terraform/GCP) nem de paridade dev
(SessionStart hook): a migração é aplicada por `npm run migrate`, que o hook já
executa a cada sessão, e nenhum job, scheduler, bucket ou segredo novo entra
nesta change.

## 1. Contrato compartilhado (`packages/shared`)

- [x] 1.1 Acrescentar `GENERAL_FILE: 'general_file'` a `DocumentType` e conferir que `DOCUMENT_TYPES` passa a ter nove valores, com `npm run build --workspace packages/shared` compilando sem erro
- [x] 1.2 Acrescentar a `DocumentStatus` os valores `AWAITING_REGISTRATION: 'awaiting_registration'` e `NOT_APPLICABLE: 'not_applicable'` (design.md D2), documentando no comentário do enum que o primeiro é estado de **cadastro** e não de revisão
- [x] 1.3 Acrescentar `documentControl` opcional por item no DTO de envio em lote e `awaitingRegistration: boolean` ao resumo de arquivo; verificar que `npm run build` na raiz compila `shared → api → web` sem erro de tipo
- [x] 1.4 Acrescentar `REGISTRATION_PENDING: 'registration_pending'` a `NotificationKind` e o payload do aviso (identificador e nome do arquivo), seguindo o formato dos payloads de concessão

## 2. Banco de dados

- [x] 2.1 Criar `0018_awaiting_registration.sql` com `ALTER TABLE files ADD COLUMN awaiting_registration boolean NOT NULL DEFAULT false`, aditiva e sem backfill (design.md D1), e verificar que `npm run migrate --workspace apps/api` aplica em base já migrada e é idempotente numa segunda execução
- [x] 2.2 Confirmar por teste que **nenhuma policy RLS nova** é necessária — a coluna entra sob a policy de `files` de `0002_enable_rls.sql`, que é por linha — e que o acervo existente fica com `false`, verificando numa base com dados de seed que nenhum arquivo anterior aparece como pendente

## 3. Derivação da situação (`lib/document-control.ts`)

- [x] 3.1 Acrescentar a `DOCUMENT_STATUS_SQL` os dois ramos novos **antes** dos existentes, na ordem `awaiting_registration` → `general_file` → ramos atuais (design.md D2), mantendo os ramos atuais palavra por palavra
- [x] 3.2 Garantir que o Arquivo geral não entra em contagem de a vencer, vencido nem sem controle de revisão, e que o pendente também não, com teste que cubra os dois cenários novos do requisito "Situação do documento é apurada no momento da consulta"
- [x] 3.3 Verificar que o teste existente que trava a **ausência de coluna de situação** continua passando — a situação segue derivada, e o que se grava é o fato do envio (design.md D1)

## 4. Validação dos dados de controle (`lib/document-control.ts`)

- [x] 4.1 Acrescentar `responsibleSector` a `REQUIRED_CONTROL_FIELDS`, passando o conjunto de quatro para cinco campos (design.md D5), e verificar que a recusa do envio unitário passa a nomear o campo novo quando ele falta
- [x] 4.2 Tornar o conjunto exigido **função do tipo**: Arquivo geral não exige nenhum dos cinco; `parseDocumentControl` resolve a exigência depois de conhecer `documentType` (design.md D5)
- [x] 4.3 Recusar código, revisão ou data de próxima revisão informados junto com o tipo Arquivo geral, com teste para cada um dos três campos (requisito "Arquivo geral é declarado fora do controle documental")
- [x] 4.4 Acrescentar a distinção entre dado **ausente** (produz pendência) e dado **inválido** (produz recusa), verificando por teste que tipo fora do conjunto, data impossível e revisão negativa recusam o item em vez de marcá-lo pendente

## 5. Alcance do arquivo pendente (`lib/access.ts`, `lib/document-control.ts`)

- [x] 5.1 Criar `visibleRegistrationClause(ctx, ownerIdParam)` no molde de `nonObsoleteClause`: `TRUE` para administrador da unidade, `(awaiting_registration IS NOT TRUE OR owner_id = <param>)` nos demais casos, com o comentário explicando por que a relaxação por dono não amplia alcance (design.md D3)
- [x] 5.2 Recusar em `hasAccess` o arquivo pendente para quem não é remetente nem administrador da unidade, no mesmo ponto em que o obsoleto já recusa — antes dos ramos de concessão, indistinguível de recurso inexistente
- [x] 5.3 Aplicar a cláusula nos três caminhos de consulta, ao lado de `nonObsoleteClause`: listagem (`routes/folders.ts`), busca (`routes/search.ts`) e manifesto de download de pasta (`lib/folder-tree.ts`)
- [x] 5.4 Criar `apps/api/src/__tests__/pendente-de-cadastro-acesso.test.ts` cobrindo os quatro caminhos para colaborador, remetente e administrador da unidade, mais o não-atravessamento de unidade e o caso do remetente que perde a permissão — todos os cenários do requisito "Arquivo pendente de cadastro não circula até ser completado"
- [x] 5.5 Verificar que os testes de isolamento existentes (`rls-isolation`, `isolamento-unidade`, `permission`) continuam passando sem alteração, confirmando que a cláusula só subtrai

## 6. Envio em lote por item (`routes/files.ts`)

- [x] 6.1 Ler e validar `documentControl` **por item** em `POST /files/upload-urls`, gravando os dados do item na linha correspondente (design.md D6), com teste de que os dados de um item não alcançam outro
- [x] 6.2 Marcar `awaiting_registration = true` no item cujos dados exigidos estão incompletos, e `false` no completo e no Arquivo geral, com teste do lote misto (completos publicam, incompletos ficam pendentes)
- [x] 6.3 Devolver, por item, a indicação de nascer publicado ou pendente, conforme o requisito alterado de `envio-lote`, com teste de que o resultado permite saber quais ficaram pendentes sem consultá-los um a um
- [x] 6.4 Recusar só o item com dado inválido, preservando a falha independente que `envio-lote` já garante, com teste de lote em que um item é recusado e os demais recebem URL
- [x] 6.5 Verificar que repetir um item que falhou é aceito e nunca barrado por falta de dados (cenário "Repetir item que falhou não é barrado por falta de dados"), que era o motivo de D9
- [x] 6.6 Atualizar os testes de lote existentes que hoje afirmam a dispensa dos dados — a mudança de expectativa é o objeto desta change, e cada caso alterado deve passar a afirmar a pendência em lugar da publicação sem dados
- [x] 6.7 Verificar que o teto de itens por requisição e a reserva de cota consciente do lote (`envio-lote`) seguem inalterados, inclusive que item não publicado não vaza reserva de cota

## 7. Publicação ao completar o cadastro (`routes/files.ts`)

- [x] 7.1 Fazer `PATCH /files/:id/document-control` avaliar a **linha resultante** e limpar `awaiting_registration` na mesma transação quando os cinco campos estiverem completos, ou o tipo for Arquivo geral (design.md D10)
- [x] 7.2 Testar que preenchimento parcial grava e mantém a pendência, e que completar considerando o que já estava gravado publica sem reinformar — os três cenários novos do requisito "Dados de controle podem ser preenchidos ou corrigidos depois"
- [x] 7.3 Testar que a permissão exigida continua sendo a de substituir (verbo `rename`), inclusive para declarar Arquivo geral, e que a revisão não avança por completar o cadastro

## 8. Aviso a quem enviou (`routes/files.ts`, `ports/notification-port`)

- [x] 8.1 Emitir a notificação `registration_pending` ao remetente quando o item nasce pendente, com `sourceRef` = identificador do arquivo (design.md D7), usando o `NotificationPort` existente sem adapter novo
- [x] 8.2 Testar a idempotência por arquivo (repetir a emissão de URL ou a transferência não duplica o aviso), um aviso por arquivo pendente num lote, nenhum aviso para item completo ou Arquivo geral, e que a falha ao avisar não impede o envio — os cenários do requisito novo de `notificacoes`
- [x] 8.3 Testar que o aviso não atravessa unidade, no molde dos testes de isolamento de notificação já existentes

## 9. Apresentação (`apps/web`)

- [x] 9.1 Acrescentar ao mapa de rótulo de estado as entradas dos dois valores novos: etiqueta "Pendente de cadastro" com tom de atenção, e **ausência de etiqueta** para `not_applicable` (design.md D2)
- [x] 9.2 Garantir tratamento neutro para situação desconhecida, de modo que valor sem entrada no mapa não quebre a listagem, com teste do cenário correspondente
- [x] 9.3 Apresentar o Arquivo geral sem situação e com código, revisão e próxima revisão como ausência explícita, e oferecer o tipo no formulário de dados de controle já existente, ocultando os campos que ele não aceita
- [x] 9.4 Testar na listagem os cenários novos de `web-navegacao`: pendente identificado para remetente e administrador, Arquivo geral sem situação, e situação desconhecida sem quebra

## 10. Documentação

- [x] 10.1 Acrescentar ao PRD (`docs/prd_final.md`) a US 10.8 (Arquivo geral) e a US 10.9 (Pendente de cadastro) no Épico 10, e **reescrever o cenário 2 da US 10.5** para a exigência por item, mantendo o cenário 3 palavra por palavra e acrescentando o responsável ao cenário 1
- [x] 10.2 Atualizar `docs/manual/` com o Arquivo geral e o estado Pendente de cadastro, com fidelidade ao que esta fatia entrega — sem documentar a tabela de cadastro, que é a fatia B2 — e verificar que o MkDocs constrói sem aviso de link quebrado
- [x] 10.3 Marcar a fatia B1 como entregue na tabela de status de `docs/plano_demanda_cliente_2.md`, com o nome do change, e registrar ali a janela de degradação até a B2 (passo 6 do protocolo do próprio plano)

## 11. Verificação integrada

- [x] 11.1 Rodar `npm run lint`, `npm run build`, `npm run test` e `npm run format:check` na raiz, todos verdes, e registrar a contagem de testes antes e depois
- [ ] 11.2 Percorrer o fluxo no navegador com a app de pé: enviar lote misto (itens com e sem dados), confirmar que os incompletos aparecem como pendentes só para o remetente e para o administrador, completar um deles pela ação "Dados de controle" e ver o arquivo passar a circular

  > **Não executada neste sandbox, e por isso deixada aberta.** O
  > `fake-gcs-server` (equivalente dev do Cloud Storage) **não está instalado**
  > nesta sessão — o passo 4 do `SessionStart` hook não completou, que é também
  > por que o `.env` faltava. Sem ele não há destino para o PUT da URL assinada,
  > e o envio em lote não pode ser exercitado ponta a ponta. O que o percurso
  > verificaria está coberto por outro meio: a apresentação por
  > `controle-documental.test.tsx` (jsdom, 4 casos novos), o comportamento da
  > API por `lote-com-cadastro.test.ts` e `pendente-de-cadastro-acesso.test.ts`
  > contra o Postgres real sob papel não-superuser, e o contraste dos tons novos
  > por `contraste.test.ts`. **Fazer o percurso antes do aceite**, em ambiente
  > com storage de dev disponível.
- [x] 11.3 Conferir no banco, com papel de app não-superuser (como na CI), que um colaborador de outra unidade não alcança o pendente por nenhuma das quatro consultas — superuser ignoraria RLS e mascararia defeito de isolamento
- [x] 11.4 Rodar `openspec validate arquivo-geral-e-pendente-de-cadastro --strict` e `openspec validate --all`, confirmando que nenhum aviso novo aparece nas specs consolidadas

## Workflow follow-up

- Sincronizar as specs delta em `openspec/specs/` e arquivar a change depois de satisfeitas as exigências de revisão do projeto (`/opsx:archive`).
- Verificar o resultado arquivado com `/opsx:verify` antes de abrir o PR.
- Emendar a fatia **B2** (tabela de cadastro por arquivo) imediatamente após esta, para fechar a janela em que todo envio em lote nasce pendente.
