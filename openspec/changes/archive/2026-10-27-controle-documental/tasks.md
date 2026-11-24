# Tasks

## 1. Esquema e contrato

- [x] 1.1 Criar migration numerada acrescentando a `files` as colunas de tipo, código, revisão, responsável, data de próxima revisão e estado declarado — todas nuláveis — e a coluna de tipo em `folders`, verificando que `npm run migrate --workspace apps/api` aplica sem reescrever tabela
- [x] 1.2 Criar na mesma migration o índice único parcial do código por unidade, restrito aos documentos não excluídos e com código informado, e verificar por teste que duas gravações concorrentes do mesmo código não passam ambas
- [x] 1.3 Declarar em `packages/shared` o enum dos oito tipos de documento, o enum das situações e os campos novos de `FileSummaryResponse`, e verificar que `npm run build --workspace packages/shared` gera o `dist/` consumido pelos demais workspaces

## 2. Situação apurada no servidor

- [x] 2.1 Implementar a derivação da situação no SQL das consultas de arquivo, a partir do estado declarado e da data de próxima revisão, usando o relógio do banco e sem gravar coluna de situação
- [x] 2.2 Cobrir com teste contra o Postgres real os seis desfechos da derivação (Vigente, A vencer com dias restantes, Em revisão, Revisão vencida, Obsoleto, Sem controle de revisão)
- [x] 2.3 Cobrir com teste que um documento consultado após ultrapassar a data já apresenta Revisão vencida **sem** que nenhuma rotina tenha sido executada, travando a decisão D2

## 3. Gravação e edição dos dados de controle

- [x] 3.1 Exigir tipo, código, revisão e data de próxima revisão quando a operação de envio carrega exatamente um arquivo, devolvendo recusa que nomeia os dados faltantes, e dispensá-los quando carrega vários ou uma pasta
- [x] 3.2 Implementar rota de edição dos dados de controle de um documento existente, exigindo a mesma permissão já requerida para substituir, sem reenvio de conteúdo e sem avançar a revisão
- [x] 3.3 Recusar a gravação de código já usado por documento ativo da mesma unidade com erro específico, e verificar por teste que o mesmo código em outra unidade é aceito sem revelar nada do documento homônimo
- [x] 3.4 Cobrir com teste o envio em lote e o envio de pasta sem dados de controle, verificando que são aceitos e resultam em situação Sem controle de revisão

## 4. Revisão na substituição

- [x] 4.1 Fazer a substituição de arquivo avançar a revisão em uma unidade quando houver revisão registrada, preservando código, tipo, responsável e data de próxima revisão
- [x] 4.2 Cobrir com teste que substituir arquivo **sem** revisão registrada não inaugura numeração, e que a versão anterior permanece indisponível em ambos os casos

## 5. Circulação do documento obsoleto

- [x] 5.1 Aplicar em `apps/api/src/lib/access.ts` a regra restritiva do obsoleto, verificando que ela apenas subtrai alcance e nunca concede
- [x] 5.2 Cobrir com teste os três caminhos — listagem de pasta, busca e acesso direto por identificador — confirmando que um colaborador com permissão não alcança o documento obsoleto por nenhum deles e que a recusa direta é indistinguível de recurso inexistente
- [x] 5.3 Estender `permission.test.ts` e `isolamento-unidade.test.ts` com o caso do obsoleto, verificando que a exceção não amplia o alcance de administrador sobre conteúdo de outra unidade

## 6. Interação com lixeira e busca

- [x] 6.1 Recusar a restauração de documento da lixeira cujo código já tenha sido reusado por documento ativo da mesma unidade, com erro específico que nomeie o documento ocupante, e cobrir com teste
- [x] 6.2 Acrescentar o código do documento ao alcance da busca, sem distinção de maiúsculas, e cobrir com teste que a busca por código respeita permissão e isolamento por unidade

## 7. Apresentação no explorador

- [x] 7.1 Apresentar na listagem a etiqueta do tipo com a sigla, a revisão, o responsável, a data de próxima revisão e a situação devolvida pelo servidor, verificando que a SPA não recalcula a situação pelo relógio do dispositivo
- [x] 7.2 Apresentar dado ausente como ausência explícita e situação Sem controle de revisão, cobrindo com teste de componente
- [x] 7.3 Oferecer no explorador a ação de editar os dados de controle somente a quem tem a permissão exigida, cobrindo com teste os dois casos
- [x] 7.4 Apresentar a recusa por código em uso de forma distinguível da recusa por dado faltante e da recusa por permissão, cobrindo com teste

## 8. Formulário de envio

- [x] 8.1 Pedir os dados de controle quando a pessoa envia exatamente um arquivo e não pedi-los quando envia vários ou uma pasta, cobrindo com teste os dois caminhos
- [x] 8.2 Verificar que o fluxo de envio em lote já entregue — progresso por item, falha independente, verificação de espaço, fatiamento — permanece inalterado pela exigência nova

## 9. Documentação

- [x] 9.1 Acrescentar ao manual em `docs/manual/docs/` a explicação do controle documental: o que cada situação significa, quando os dados são exigidos e como preenchê-los depois, com fidelidade à interface entregue
- [x] 9.2 Documentar no manual que documentos obsoletos deixam de aparecer para quem não é gestão da unidade

## 10. Verificação integrada

- [x] 10.1 Percorrer o fluxo completo numa unidade de teste — enviar um documento com dados, enviar um lote sem dados, editar os dados do lote, substituir avançando revisão, declarar obsoleto e confirmar o sumiço para colaborador — verificando cada desfecho contra os critérios do Épico 10
- [x] 10.2 Rodar `npm run lint`, `npm run build`, `npm run test` e `npm run format:check` na raiz e verificar que todos passam, com o Postgres de teste rodando sob papel não-superuser

## Workflow follow-up

- Levar ao aceite a consequência da decisão D7: arrastar um arquivo pede quatro campos, arrastar dois não pede nada.
- Acompanhar, depois da entrega, a proporção de documentos em "Sem controle de revisão"; crescimento sustentado indica que a decisão D7 precisa ser revisitada.
- Arquivar a change depois de satisfeitos os requisitos de revisão do projeto.
