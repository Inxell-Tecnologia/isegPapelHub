# Tasks

## 1. Contrato compartilhado

- [x] 1.1 Definir em `packages/shared` o DTO da resposta da listagem — tipo do
  recurso (pasta/arquivo), identificador, nome, nome da pasta que o contém
  (nulo na raiz), conjunto de verbos concedidos, vencimento quando houver, data
  do compartilhamento e os dados de controle do documento para a linha de
  arquivo —, e verificar com `npm run build --workspace packages/shared` que o
  `dist/` compila e expõe o tipo aos dois consumidores.

## 2. Consulta e rota de leitura

- [x] 2.1 Implementar em `apps/api/src/routes/grants.ts` a consulta de
  concessões recebidas: base em `grants` por `subject_user_id` e vigência
  (`expires_at IS NULL OR expires_at > now()`), duas pernas em `UNION ALL`
  (pastas e arquivos), `GROUP BY` por recurso agregando os verbos e tomando
  `MAX(created_at)` como data, `owner_id <> $me`, e ordenação do mais recente
  para o mais antigo (design.md D1, D4, D5, D6, D8). **Não** usar
  `visibleResourceClause`/`resourceScopeClause` — D1 explica por quê. Verificar
  com teste que um administrador de unidade com **uma** concessão recebida
  recebe **um** item, e não o acervo da unidade.
- [x] 2.2 Compor as regras restritivas por reúso dos fragmentos existentes
  (`deleted_at IS NULL`, cláusula do obsoleto e cláusula do pendente de
  cadastro de `lib/document-control.ts`), sem reescrevê-las (design.md D2), e
  verificar com testes que documento obsoleto e arquivo pendente de outra
  pessoa não aparecem ao colaborador, e que aparecem ao administrador da
  unidade.
- [x] 2.3 Expor a rota `GET /grants/received` sob `attachTenantContext`,
  aberta a qualquer papel autenticado, e verificar com teste que um
  `collaborator` recebe 200 enquanto as rotas de administrar concessões
  continuam respondendo 403 a ele.
- [x] 2.4 Devolver o nome da pasta que contém o item, e nenhum nome de pasta
  ancestral acima dela (design.md D7), verificando com teste sobre um arquivo
  concedido em profundidade cujas pastas intermediárias a pessoa não alcança.

## 3. Testes de alcance

- [x] 3.1 Cobrir, no nível dos testes de isolamento, cada caminho de recusa da
  listagem: concessão expirada, concessão de terceiro, item na lixeira, recurso
  de que a pessoa é dona, e recurso de outra unidade **inclusive para
  `global_admin`** — verificando que cada caso não devolve nome de recurso nem
  nome de pasta.
- [x] 3.2 Cobrir a vigência pelo relógio do Postgres: concessão que vence entre
  duas consultas sai na seguinte sem nenhuma rotina ter rodado, e concessão
  revogada sai sem erro.
- [x] 3.3 Cobrir a agregação: `view` + `download` sobre o mesmo arquivo formam
  um item com os dois verbos, e acrescentar um verbo não duplica o item e passa
  a reger a sua posição na ordenação.

## 4. Destino na SPA

- [x] 4.1 Criar `apps/web/src/compartilhados/` com a consulta (fronteira Zod em
  `lib/schemas.ts`, amarrada ao tipo compartilhado) e a página da listagem —
  colunas de nome, localização, o que a pessoa pode fazer, vencimento e data do
  compartilhamento —, verificando com teste de componente que a tabela
  apresenta o que a API devolveu.
- [x] 4.2 Oferecer em cada item somente as ações cujos verbos vieram na resposta
  (design.md D9): arquivo com `view` abre o `PreviewModal` que a busca já usa,
  arquivo só com `download` oferece baixar sem oferecer visualizar, e pasta
  navega para `/pastas/:id`. Verificar com testes os três casos.
- [x] 4.3 Apresentar, na ausência de concessões recebidas, a orientação de que
  nada foi compartilhado — não a tabela vazia do design system —, verificando
  com teste de componente.
- [x] 4.4 Registrar a rota `/compartilhados` em `app/router.tsx`, sem guarda por
  papel (não é item de administração), e verificar com teste que um
  `collaborator` alcança o destino.

## 5. Item de menu

- [x] 5.1 Acrescentar "Compartilhados comigo" ao grupo NAVEGAÇÃO em
  `shell/AppShell.tsx`, para qualquer papel, retirando do comentário a lacuna
  registrada para a A5, e verificar com teste que o item aparece para
  `collaborator` e leva ao destino.
- [x] 5.2 Conferir que o rótulo integral cabe na navegação de 264 px sem
  truncamento — "Compartilhados comigo" é o rótulo que fixou essa largura
  (`app/theme.ts:152`) — medindo na app em 992 px e no modo estreito, conforme
  o requisito de largura de `web-shell-e-auth`.

## 6. Documentação e registro

- [x] 6.1 Criar a página do destino no manual (`docs/manual/docs/colaborador/`),
  acrescentá-la ao `nav` do `mkdocs.yml` e à página "A tela" na lista de itens
  do menu, com fidelidade ao que foi efetivamente entregue, e verificar que o
  site do manual constrói.
- [x] 6.2 Acrescentar a **US 4.4** ao Épico 4 de `docs/prd_final.md` (não ao
  Épico 11 — ver proposal.md, Impact), com os cenários de listagem, exclusão do
  expirado, o que a lista não revela e perda de acesso.
- [x] 6.3 Atualizar `docs/plano_demanda_cliente_2.md`: linha **A5** para
  `entregue` com o nome do change, a correção da classificação de "reentrada de
  escopo", os desvios decididos durante a especificação (D1 do design: por que
  os fragmentos de alcance não foram reusados; D7: a trilha do explorador como
  lacuna conhecida) e o registro de que a forma da listagem plana ficou fixada
  aqui para consumo da A4.

## 7. Verificação de integração

- [x] 7.1 Rodar `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` na raiz, confirmando que os quatro passam.
- [x] 7.2 Verificar na app, com os dados de seed: conceder a um colaborador uma
  pasta e um arquivo em profundidade, entrar como ele, abrir o destino pelo
  menu, abrir o arquivo na visualização e a pasta no explorador; então revogar
  uma das concessões e confirmar que o item sai na consulta seguinte.

## Workflow follow-up

- Rodar `/opsx:verify` antes de arquivar.
- Arquivar com `/opsx:archive`, sincronizando as specs em `openspec/specs/`.
