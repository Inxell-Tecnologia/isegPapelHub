# Tasks

Ordem por dependência: constantes do contrato compartilhado → API lendo-as de lá
→ reconhecedor e validação puros → tabela → formulário unitário → mensagens de
recusa → documentação → integração. Cada grupo entrega os seus próprios testes e
a sua própria documentação.

**Não há tarefa de infraestrutura** (Terraform/GCP): nenhum job, scheduler,
bucket, segredo ou prefixo de rota de topo entra nesta change — logo nada em
`infra/terraform/`, nem em `API_PREFIXES`/`vite.config.ts`/`locals.tf`.
**Não há tarefa de paridade dev** (SessionStart hook): nenhuma migração e nenhum
serviço novo; o ambiente que o hook já provisiona basta.

**Não há tarefa de backend de comportamento.** O grupo 2 move constantes e o
grupo 9 cobre com teste comportamento que a B1 já implementou e não
especificou — nenhuma regra de servidor muda.

## 1. Constantes de exigência no contrato compartilhado (`packages/shared`)

- [x] 1.1 Mover `REQUIRED_CONTROL_FIELDS`, `FIELDS_REJECTED_FOR_GENERAL_FILE` e `requiredFieldsForType` de `apps/api/src/lib/document-control.ts` para `packages/shared/src/document-control.ts`, preservando valores e comentários (design.md D9), e verificar `npm run build --workspace packages/shared` sem erro
- [x] 1.2 Tipar as duas recusas que faltam — `DocumentCodeConflictResponse` (`error: 'document_code_conflict'`, por item do lote) e `GeneralFileRejectsControlFieldsResponse` (`error: 'general_file_rejects_control_fields'`, com `rejected`) — no molde de `DocumentCodeInUseResponse`, e verificar que o campo `error` de cada uma é literal, não `string`
- [x] 1.3 Corrigir o comentário de `UploadUrlRequest` que ainda afirma que os dados de controle são "dispensados no envio em lote" — falso desde a B1 —, e verificar por leitura que nenhum outro comentário de `storage.ts`/`document-control.ts` repete a afirmação

## 2. API passa a ler as constantes do contrato (`apps/api`)

- [x] 2.1 Reapontar `lib/document-control.ts` para as constantes de `@gdoc/shared`, sem reexportar cópia local, e verificar `npm run build` na raiz compilando `shared → api → web`
- [x] 2.2 Rodar `npm run test --workspace apps/api -- src/__tests__/controle-documental.test.ts` e os casos de `parseDocumentControl` (dado ausente × inválido, exigência por tipo, recusa do Arquivo geral) e confirmar que **nenhuma expectativa muda** — a movimentação é de constante, não de regra (design.md, Risks)

## 3. Reconhecedor de nome e validação de linha, puros (`apps/web`)

- [x] 3.1 Criar o reconhecedor de `SIGLA-AREA-Nº` com tabela de apelidos de sigla incluindo as formas do cliente (`POL/NOR`, `FOR/CHK`, `TC`, `CI`) **e** as da interface (`POL`, `FRM`, `TCO`, `COM`) apontando para o mesmo `DocumentType` (design.md D4), com teste unitário cobrindo `PRT-NSP-001_Identificacao.pdf`, `FOR-NSP-002.xlsx`, `CI-NSP-003.pdf` e um nome fora do padrão (sem sugestão)
- [x] 3.2 Verificar por teste que o código sugerido preserva a caixa como escrita no nome do arquivo e exclui o sufixo após o número (`PRT-NSP-001_Identificacao.pdf` → `PRT-NSP-001`)
- [x] 3.3 Criar a função pura que recebe uma linha de cadastro e devolve os campos que faltam, derivando o conjunto de `requiredFieldsForType` do contrato (design.md D9), com teste para documento controlado completo, documento faltando só o responsável, Arquivo geral só com título (completo) e linha sem título (incompleta por título)
- [x] 3.4 Criar a detecção de código repetido **dentro** da seleção, insensível a caixa e a espaços nas pontas (design.md D7), com teste que devolve **todas** as linhas em conflito e não apenas a segunda

## 4. Tabela de cadastro (`apps/web/src/upload`)

- [x] 4.1 Acrescentar a fase de cadastro entre `veredito` e `enviando` em `UploadArea`, apresentando a tabela em lugar do painel "Confirmar envio" quando a seleção não é a publicação de um documento só, e verificar por teste que nenhuma chamada a `/files/upload-urls` acontece antes da confirmação
- [x] 4.2 Montar o estado por linha fora de `Form` do Ant, com uma entrada por arquivo e a validação pura do 3.3 (design.md D2), e verificar que a tabela abre para uma seleção acima do teto de itens por requisição sem recusa por quantidade
- [x] 4.3 Renderizar a tabela virtualizada e verificar por teste que uma seleção grande **não** produz uma linha renderizada por arquivo (molde do teste que trava o progresso macro), com a tabela rolando dentro do próprio contêiner na forma estreita (`web-responsividade`)
- [x] 4.4 Pré-preencher Título com o nome do arquivo e aplicar a sugestão do 3.1 às colunas Tipo e Código, marcando a célula sugerida como sugestão, com teste para a distinção entre sugerido e confirmado
- [x] 4.5 Implementar a linha "Aplicar a todos" (Tipo, Revisão, Responsável, Próxima revisão; **sem** Código), por acionamento explícito e sobrescrevendo as linhas já editadas (design.md D5), com teste de que digitar na linha de aplicação sem acioná-la não altera nada e de que a edição posterior de uma linha não afeta as demais
- [x] 4.6 Implementar o indicador de completa/incompleta por linha e a contagem dos dois grupos na confirmação ("N publicam, M ficam pendentes"), com teste de que a contagem precede qualquer transferência (design.md D6)
- [x] 4.7 Barrar a confirmação enquanto houver código repetido na tabela, apontando todas as linhas em conflito, com teste para o par que difere só em caixa (design.md D7)
- [x] 4.8 Fazer o tipo Arquivo geral numa linha esvaziar **e** indisponibilizar Código, Revisão e Próxima revisão, mantendo Responsável, com teste de que nenhum dos três campos vai no corpo da requisição depois da troca de tipo (design.md D8)

## 5. Envio a partir da tabela (`apps/web/src/upload`)

- [x] 5.1 Fazer `toBatchItem` carregar `documentControl` da linha e o `fileName` com o título editado, reanexando a extensão original (design.md D3), com teste que verifica o corpo de `/files/upload-urls` item a item
- [x] 5.2 Verificar por teste que a confirmação envia **todas** as linhas — completas e incompletas — nas mesmas fatias, e que a resposta `awaitingRegistration` por item é refletida no desfecho apresentado (design.md D6)
- [x] 5.3 Barrar título vazio antes do envio, com teste de que a linha sem título não é enviada (design.md D3: não há pendência de cadastro que cubra a falta do nome)
- [x] 5.4 Verificar por teste que fatiamento, teto de itens e consulta de espaço permanecem como estão — a tabela não antecipa requisição nem altera reserva de cota (design.md D11)
- [x] 5.5 Preservar o cadastro da linha recusada pelo servidor por `document_code_conflict`, oferecendo correção só do código e nova tentativa daquele item, com teste de que os demais campos continuam preenchidos

## 6. Formulário do envio unitário (`apps/web/src/navegacao`, `apps/web/src/upload`)

- [x] 6.1 Exigir os **cinco** campos em `DocumentControlFormItems` quando `obrigatorios`, derivando a lista de `requiredFieldsForType` em vez de repetir rótulos, e verificar por teste que o responsável em branco é sinalizado pela tela, não pela recusa do servidor
- [x] 6.2 Fazer o formulário reagir ao tipo Arquivo geral como a tabela (esvaziar e indisponibilizar os três campos, manter Responsável, publicar com só o título), com teste de que o envio unitário de um Arquivo geral conclui pela interface — hoje impossível
- [x] 6.3 Atualizar `upload-documento.test.tsx`: o caso "o formulário exige os quatro campos" passa a cobrir cinco, e o caso "envio de vários arquivos não apresenta o formulário" passa a afirmar que a tabela é apresentada (requisito REMOVED de `web-upload`)

## 7. Mensagens de recusa (`apps/web/src/navegacao/document-control-errors.ts`)

- [x] 7.1 Traduzir `document_code_conflict` como conflito do código daquele arquivo, distinguível da falha de transferência e da recusa por cota, e verificar por teste que a mensagem não é a genérica "Tente novamente"
- [x] 7.2 Traduzir `general_file_rejects_control_fields` nomeando o campo incompatível a partir de `rejected`, com teste para cada um dos três campos
- [x] 7.3 Reconhecer o conflito de código também em `describeError` do `UploadArea` (hoje qualquer erro de item que não seja cota cai em "Falha no envio."), com teste do item recusado por código no lote

## 8. Documentação do usuário (`docs/manual/`)

- [x] 8.1 Reescrever a seção "Todo envio pede os dados de controle" de `docs/manual/docs/colaborador/enviar.md` para descrever a tabela de cadastro: linha por arquivo, Título vindo do nome, sugestão por `SIGLA-AREA-Nº`, "Aplicar a todos", indicador de completa/incompleta e o desfecho dos dois grupos na publicação — com fidelidade ao que esta fatia entrega
- [x] 8.2 Registrar que arquivo **Pendente de cadastro ocupa cota** como qualquer outro (design.md D11) e que o cadastro digitado na tabela **não é rascunho**: fechar a tela antes de confirmar o perde (design.md, Risks)
- [x] 8.3 Conferir se `referencia/faq.md` e `referencia/tarefas-rapidas.md` mencionam o envio em lote sem a tabela e, se sim, atualizá-los; verificar `mkdocs build --strict` no diretório `docs/manual/` sem aviso de link quebrado

## 9. Cobertura do requisito novo de `envio-lote` (`apps/api/src/__tests__`)

- [x] 9.1 Cobrir a recusa por item do código já existente no acervo da unidade dentro de um lote, verificando que os demais itens recebem URL e que nada de documento de outra unidade é revelado
- [x] 9.2 Cobrir a colisão **entre dois itens do mesmo lote**, inclusive diferindo só em caixa, verificando que o primeiro é aceito, o segundo recusado e o lote não é abortado
- [x] 9.3 Cobrir a **retomada**: item cujo código está preso a um envio `pending` do próprio solicitante é aceito preservando o identificador do arquivo; o mesmo caso com envio pendente de **outra** pessoa é recusado por conflito

## 10. Integração e fecho da fatia

- [x] 10.1 Rodar `npm run lint`, `npm run build`, `npm run test` e `npm run format:check` na raiz, com todos passando
- [x] 10.2 Verificar o fluxo completo contra a app em dev: enviar três arquivos (um com nome no padrão, um sem, um como Arquivo geral), aplicar a todos, deixar uma linha incompleta, publicar, e confirmar na listagem que dois publicaram e um ficou Pendente de cadastro com aviso no sino — fechando a janela aberta pela B1
- [x] 10.3 Acrescentar ao `docs/prd_final.md` a US do Épico 3 para o cadastro no momento do envio em lote (tabela, sugestão, "Aplicar a todos", publicação dos dois grupos), conferindo que a US 10.5 cenário 2 continua válida palavra por palavra
- [x] 10.4 Atualizar a linha da fatia **B2** em `docs/plano_demanda_cliente_2.md` para `entregue`, com o nome do change arquivado, e registrar ali os desvios do previsto e as lacunas conhecidas (cadastro sem rascunho; nenhuma pré-checagem do código contra o acervo) — é o passo que mantém o plano retomável

## Workflow follow-up

- Rodar `/opsx:verify` antes de arquivar.
- Arquivar com `/opsx:archive`, sincronizando `openspec/specs/web-upload/` e `openspec/specs/envio-lote/`.
