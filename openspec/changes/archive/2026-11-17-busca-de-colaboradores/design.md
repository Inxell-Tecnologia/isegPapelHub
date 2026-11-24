# Design

## D1 — Filtro no cliente, sobre a lista já carregada

Alternativas: (a) filtrar no cliente o resultado de `GET /users`; (b) novo
parâmetro `?q=` em `GET /users`, com `ILIKE`/`unaccent` no Postgres.

Escolhida **(a)**. `GET /users` já devolve a lista inteira do alcance do
administrador, sem paginação, e a tabela já pagina no cliente — a busca é só
mais um recorte do mesmo array. Não há chamada nova a cada tecla, o resultado
é instantâneo e nada muda na superfície de segurança: o filtro nunca amplia o
que a API entregou (RLS por `unit_id` + checagem de papel continuam sendo a
linha de defesa). A opção (b) exigiria a extensão `unaccent` (ou coluna
normalizada) e debounce na SPA, sem ganho no volume atual (dezenas a poucas
centenas de pessoas por unidade).

Gatilho de revisão: se `GET /users` passar a paginar no servidor, a busca
migra para (b) — filtrar só a página carregada daria resultado errado.

## D2 — Campos pesquisados e normalização

Campos: nome completo, e-mail, função/cargo, nome do setor e — só para o
administrador global, que é quem vê a coluna — nome da unidade (resolvido pelo
mesmo `unitNameById` da coluna). Papel, status e acompanhamento ficam de fora:
são conjuntos fechados, melhor servidos por filtro estruturado (fora de
escopo), e casar "ativo" por trecho em texto livre geraria falsos positivos.

Normalização dos dois lados: `normalize('NFD')`, remoção das marcas
combinantes (`\p{M}`), `toLocaleLowerCase('pt-BR')` e `trim` do termo.
Comparação por `includes` (trecho). Termo vazio (ou só espaços) não filtra.
A função fica num helper puro (`filtro-pessoas.ts`) para ser testada sem
renderizar a página.

Um único termo, sem divisão por palavras: "maria silva" casa com quem tem esse
trecho contíguo no nome. Mantém o comportamento previsível; dividir em tokens
pode ser revisto se o uso pedir.

## D3 — Componente, posição e estados

`Input.Search` do Ant Design com `allowClear` e placeholder "Buscar por nome,
e-mail, função ou setor", filtrando a cada alteração (`onChange`), sem botão
de envio obrigatório. Fica na mesma faixa das ações da página, à esquerda;
"Setores" e "Novo colaborador" seguem à direita. Em telas estreitas a faixa
quebra linha (`flex-wrap`), com o campo ocupando a largura disponível
(capability `web-responsividade`).

A paginação da tabela passa a ser controlada o suficiente para **voltar à
página 1 quando o termo muda** — sem isso o Ant Design pode manter uma página
que deixou de existir no recorte. Sem resultado, a tabela exibe
`locale.emptyText` "Nenhum colaborador encontrado"; com o termo vazio e a lista
vazia, mantém o vazio padrão.

O termo vive em estado local da página: não vai para a URL nem sobrevive à
navegação (fora de escopo). Editar, ativar/desativar ou redefinir senha de uma
pessoa filtrada não limpa a busca — a invalidação de `users` recarrega a lista
e o filtro é reaplicado sobre ela.
