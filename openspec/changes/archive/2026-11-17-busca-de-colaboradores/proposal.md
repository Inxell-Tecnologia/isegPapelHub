# Proposal

## Why

Em `/admin/pessoas` (menu **Colaboradores**) a listagem traz todas as pessoas
do alcance do administrador — a unidade inteira para o administrador da
unidade, todas as unidades para o administrador global — numa tabela paginada,
na ordem de cadastro. Com o crescimento das unidades, achar um colaborador
específico para editar, desativar ou redefinir a senha exige folhear páginas.
Falta um campo de busca na própria tela.

PRD: US 1.1 (cadastro e manutenção de pessoas pela administração). Os critérios
da US não mudam; este change é uma melhoria de usabilidade da listagem que a
implementa (spec `web-pessoas`).

## What Changes

**Web**

- A página de colaboradores ganha um **campo de busca** acima da tabela, ao
  lado das ações "Setores" e "Novo colaborador".
- O texto digitado filtra a listagem por **nome, e-mail, função/cargo e
  setor** — e, para o administrador global, também pelo **nome da unidade**.
  A comparação ignora maiúsculas/minúsculas e acentos ("joao" encontra
  "João") e casa por trecho (contém), não só pelo início.
- O filtro é aplicado **no cliente**, sobre a lista já carregada por
  `GET /users` (ver design.md D1). Limpar o campo devolve a listagem completa;
  ao mudar o texto a tabela volta à primeira página.
- Busca sem resultado mostra a tabela vazia com a mensagem **"Nenhum
  colaborador encontrado"**, distinta do estado de erro de carregamento.

**API / Banco / Infra**

- Nenhuma mudança: sem rota nova, sem parâmetro novo em `GET /users`, sem
  migration. A busca só restringe o que a SPA exibe — não amplia o que a API
  devolve (a RLS e a checagem de papel de `GET /users` seguem intocadas).

**Documentação**

- `docs/manual/docs/administrador/pessoas.md`: seção curta sobre a busca na
  lista de colaboradores.

## Capabilities

### Modified Capabilities

- `web-pessoas`: novo requisito — busca de colaborador na listagem.

## Impact

- `apps/web/src/pessoas/PessoasPage.tsx` (campo de busca, filtro, estado vazio).
- Possível helper puro de normalização de texto em `apps/web/src/pessoas/`
  (testável isoladamente).
- `apps/web/src/__tests__/pessoas.test.tsx` (casos novos).
- Manual do administrador.

## Fora de escopo

- Filtros estruturados (por papel, status, setor, unidade em lista de
  escolha) — podem vir num change próprio se pedidos.
- Busca paginada no servidor (ver design.md D1 para o gatilho de revisão).
- Persistir o texto da busca na URL ou entre visitas.
