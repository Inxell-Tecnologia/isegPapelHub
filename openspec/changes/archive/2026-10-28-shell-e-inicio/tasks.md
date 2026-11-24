# Tasks

## 1. Identidade com nome e unidade

- [x] 1.1 Acrescentar nome da pessoa e nome da unidade a `AuthenticatedIdentity` em `packages/shared`, e verificar que `npm run build --workspace packages/shared` gera o `dist/` consumido pelos demais workspaces
- [x] 1.2 Resolver os dois campos na mesma releitura por requisição que já alimenta o contexto de tenant, nunca a partir do token, e devolvê-los no login e na consulta da sessão corrente
- [x] 1.3 Cobrir com teste de API os três cenários normatizados: identidade devolve nome e unidade, nome alterado no cadastro aparece na requisição seguinte sem novo login, e conta sem nome devolve o campo vazio sem recorrer ao identificador

## 2. Listagem de documentos alterados recentemente

- [x] 2.1 Implementar a rota de recentes derivando o instante da última alteração de `files.created_at` e dos eventos de auditoria que alteram o documento (`replace`, `rename`, `move`), consolidando por documento antes de aplicar o teto
- [x] 2.2 Aplicar a cada candidato a mesma resolução de acesso usada pela listagem de pasta, sem montar uma segunda expressão da regra, e verificar por teste que documento sem permissão não aparece nem tem nome ou pasta revelados
- [x] 2.3 Cobrir com teste contra o Postgres real que a lista não atravessa unidades, inclusive para o administrador global
- [x] 2.4 Cobrir com teste que um documento sai da lista na consulta seguinte quando a concessão que dava acesso a ele expira, aproveitando a avaliação de vigência pelo relógio do banco
- [x] 2.5 Medir o plano da consulta com volume realista de auditoria e, se necessário, acrescentar índice de apoio por unidade e instante como migração aditiva com `IF NOT EXISTS`
- [x] 2.6 Cobrir com teste que ações de leitura (`view`, `download`) não produzem linha na lista, travando a decisão D1

## 3. Tela inicial

- [x] 3.1 Substituir `app/HomePage.tsx` por tela própria, deixando de usar `PlaceholderPage`, e verificar que a rota inicial a apresenta após o login
- [x] 3.2 Apresentar a saudação com nome, função e unidade, com tratamento genérico para conta sem nome cadastrado, e cobrir os dois casos com teste de componente
- [x] 3.3 Apresentar os atalhos filtrados pelo perfil e cobrir com teste que atalho fora do alcance do perfil não é apresentado
- [x] 3.4 Apresentar os cartões de acesso rápido às pastas de primeiro nível acessíveis, cobrindo com teste a restrição às pastas que a pessoa pode abrir e a orientação quando não há nenhuma
- [x] 3.5 Apresentar a lista de documentos recentes com a data de cada alteração, cobrindo com teste a ordenação e a mensagem de ausência de alterações
- [x] 3.6 Emitir as consultas da tela em paralelo e apresentar cada área assim que a sua resposta chega, verificando que uma consulta lenta não bloqueia as demais

## 4. Navegação do shell

- [x] 4.1 Reorganizar os destinos da navegação para tela inicial, documentos, recentes e lixeira, acrescidos dos destinos de administração permitidos ao papel, mantendo o manual como acesso auxiliar na última posição
- [x] 4.2 Renomear o destino "Arquivos" para "Documentos" em todo texto visível e verificar que nenhuma tela remanescente usa o termo anterior
- [x] 4.3 Remover a busca do conjunto de destinos e cobrir com teste que ela não aparece entre eles
- [x] 4.4 Substituir no rodapé da navegação o fragmento de identificador pelo nome e perfil reais, cobrindo com teste que o identificador interno não aparece em lugar nenhum do shell
- [x] 4.5 Verificar que o painel sobreposto do modo estreito continua oferecendo exatamente os mesmos itens do modo largo, alimentado pela mesma origem única

## 5. Busca no cabeçalho

- [x] 5.1 Apresentar o campo de busca no cabeçalho de toda tela autenticada e conduzir à tela de resultados com o termo aplicado ao ser acionado
- [x] 5.2 Cobrir com teste que digitar no campo não dispara consulta ao servidor, preservando o acionamento explícito já normatizado
- [x] 5.3 Verificar em 375px que o campo do cabeçalho não produz rolagem horizontal nem desloca o acionador do painel de navegação

## 6. Documentação

- [x] 6.1 Atualizar o manual em `docs/manual/docs/` com a descrição da tela inicial — saudação, atalhos, pastas e recentes — com fidelidade ao que é entregue
- [x] 6.2 Atualizar no manual a navegação reorganizada e a busca no cabeçalho, verificando que "Arquivos" não permanece como nome de destino

## 7. Verificação integrada

- [x] 7.1 Percorrer a aplicação nos três papéis e confirmar que cada um vê apenas os destinos, atalhos, pastas e documentos recentes compatíveis com o seu alcance
- [x] 7.2 Revalidar o modo estreito em 375px e 768px, verificando que a tela inicial e o cabeçalho novo não regridem nenhum comportamento entregue pela change `responsividade-mobile-tablet`
- [x] 7.3 Rodar `npm run lint`, `npm run build`, `npm run test` e `npm run format:check` na raiz e verificar que todos passam

## Workflow follow-up

- Levar ao aceite a divergência da decisão D4: os cartões apresentam pastas de primeiro nível da própria unidade, não as seis unidades do desenho — consequência de manter o isolamento por unidade.
- Implementar esta change **depois** de `controle-documental`, para que a lista de recentes e os cartões já nasçam com tipo e situação.
- Arquivar a change depois de satisfeitos os requisitos de revisão do projeto.
