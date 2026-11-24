# Tasks

## 1. Filtro

- [x] 1.1 Criar `apps/web/src/pessoas/filtro-pessoas.ts` com `normalizarBusca(texto)` (NFD, remove `\p{M}`, `toLocaleLowerCase('pt-BR')`, `trim`) e `filtrarPessoas(pessoas, termo, nomeDaUnidade?)` que casa por trecho em nome, e-mail, função/cargo, setor e — quando a função de unidade é passada — nome da unidade; termo vazio devolve a lista intacta (design.md D2). Verificação: testes unitários novos (`filtro-pessoas.test.ts`) cobrindo acento, caixa, cada campo, unidade só quando informada, termo vazio/só espaços e campos nulos.

## 2. Página

- [x] 2.1 Em `apps/web/src/pessoas/PessoasPage.tsx`, adicionar estado do termo e `Input.Search` (`allowClear`, placeholder "Buscar por nome, e-mail, função ou setor", `aria-label` equivalente) à esquerda da faixa de ações, com `flex-wrap` (design.md D3); a tabela recebe `filtrarPessoas(data, termo, isGlobalAdmin ? unitNameById : undefined)`. Rastro em comentário: change `busca-de-colaboradores`, design.md D1/D2.
- [x] 2.2 Paginação controlada: página atual volta a 1 quando o termo muda; `locale.emptyText` "Nenhum colaborador encontrado" quando há termo e o recorte é vazio (design.md D3).
- [x] 2.3 Casos em `apps/web/src/__tests__/pessoas.test.tsx`: busca sem acento filtra por nome; busca por setor; global admin busca por unidade; limpar restaura; sem resultado mostra a mensagem; digitar não gera nova chamada a `/users` (contagem do `fetch` mockado). Verificação: `npm run test --workspace apps/web -- src/__tests__/pessoas.test.tsx` verde.

## 3. Documentação

- [x] 3.1 `docs/manual/docs/administrador/pessoas.md`: seção "Encontrar um colaborador" descrevendo o campo de busca, os campos pesquisados (incluindo unidade para o administrador global) e que acentos e maiúsculas são ignorados.

## 4. Fechamento

- [x] 4.1 `npm run lint`, `npm run build`, `npm run format:check` e `npm run test --workspace apps/web`. Verificação: todos verdes.

## Infraestrutura e paridade dev

Nenhuma tarefa: sem rota nova, sem parâmetro novo na API, sem migration, sem recurso de nuvem.
