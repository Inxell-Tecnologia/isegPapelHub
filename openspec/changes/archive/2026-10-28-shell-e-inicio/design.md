# Design

## Context

Ver `proposal.md` — Why, e o Épico 11 do PRD para os critérios de aceite. O
estado de partida relevante:

- `app/HomePage.tsx` renderiza `PlaceholderPage` — um `Result` com o favicon.
- `AuthenticatedIdentity` carrega identificador, unidade e papel. O nome da
  pessoa só existe em `GET /auth/profile`, rota separada que o shell não
  consome.
- **Nenhuma tabela do sistema tem `updated_at`.** Nada carimba a última
  alteração de um arquivo.
- `audit_events` registra sete ações — `view`, `download`, `rename`, `replace`,
  `delete`, `restore`, `move` — com autor, alvo, unidade e instante, sob RLS, e
  já possui índice por arquivo (migração `0009`).
- `attachTenantContext` relê unidade, papel e status do banco a **cada**
  requisição, nunca do token, para que desativar uma conta corte o acesso na
  hora.

## Goals / Non-Goals

**Goals:**
- Que a tela de entrada responda, sem clique, a "quem sou, onde estou, o que
  mudou".
- Que "recentes" não introduza nenhuma via nova de vazamento: o que aparece ali
  é exatamente o que a pessoa já alcançaria navegando.
- Acrescentar a funcionalidade sem criar coluna, tabela ou carimbo novo.

**Non-Goals:**
- Histórico pessoal de navegação ("onde eu estive"). Recentes é "o que mudou",
  decisão do cliente.
- Página de recentes com paginação e filtros. A tela inicial mostra um recorte
  curto; a busca continua sendo o caminho para procurar.

## Decisions

### D1 — Recentes sai da auditoria, não de uma coluna nova

A última alteração de um documento é derivada de duas fontes que já existem:
`files.created_at` para a publicação, e os eventos de `audit_events` cujas
ações alteram o documento — `replace`, `rename`, `move`. O instante relevante é
o mais recente entre eles.

*Alternativa considerada:* acrescentar `updated_at` a `files`, carimbado em
cada alteração. Rejeitada por uma razão específica: o carimbo teria de ser
lembrado em todo caminho de escrita, hoje e no futuro — substituir, renomear,
mover em lote, restaurar da lixeira, editar dados de controle. Um caminho
esquecido não quebra nada visivelmente; apenas faz o documento sumir da lista
de recentes, defeito silencioso e difícil de notar. A auditoria, ao contrário,
**já é obrigatória** nesses caminhos e é verificada por teste: derivar dela
significa que um caminho novo aparece em recentes de graça, ou não é auditado —
e não ser auditado é falha que o projeto já trata como grave.

Custo assumido: a consulta agrega sobre uma tabela que cresce. Mitigado por
recorte duplo — janela de tempo e teto de itens — e por índice de apoio.

Consequência que precisa ser dita: ações de **leitura** (`view`, `download`)
não entram. Elas não alteram o documento, e incluí-las transformaria a lista em
histórico de navegação, que é outra coisa (ver Non-Goals).

### D2 — O filtro de permissão é o mesmo da navegação, aplicado item a item

A lista não usa consulta própria "esperta" que tente deduzir alcance. Ela
coleta candidatos e submete cada um à mesma resolução de acesso que a listagem
de pasta usa — dono OU administrador da unidade OU concessão vigente do verbo.

*Alternativa considerada:* um `JOIN` com `grants` montado na própria consulta,
mais rápido. Rejeitada porque passaria a existir uma **segunda** expressão da
regra de acesso no sistema. Duas expressões divergem: a mudança na regra
central seria aplicada numa e esquecida na outra, e o sintoma seria vazamento,
não erro. O custo de desempenho é aceitável num recorte curto; o custo de uma
regra duplicada não é.

Daí decorre, sem esforço, o cenário "perda de acesso remove o documento da
lista": a vigência da concessão é avaliada no SQL pelo relógio do Postgres a
cada consulta, então um acesso expirado some na requisição seguinte.

### D3 — Nome e unidade vêm da releitura por requisição, nunca do token

Os campos novos da identidade são resolvidos na mesma releitura que
`attachTenantContext` já faz a cada requisição.

Isso não é detalhe de implementação: é o que faz o cenário "nome alterado
aparece na requisição seguinte" funcionar sem novo login, e é o que impede que
um nome fique congelado num token de sessão de longa duração. É também
coerente com a razão pela qual a releitura existe — desativar uma conta corta o
acesso na hora.

### D4 — Os cartões são pastas de primeiro nível, não unidades

O desenho do cliente mostra seis cartões de unidade e a frase "você tem acesso
a 6 unidades". O modelo permanece como está: `users.unit_id` é único por
pessoa, a RLS escopa tudo por `unit_id`, e nem o administrador global alcança
conteúdo de outra unidade.

Os cartões entregam, então, as **pastas de primeiro nível da própria unidade** a
que a pessoa tem acesso — que é o segundo nível da árvore no desenho, com o
mesmo tratamento de ícone e cor. A trilha de navegação sobrevive intacta, pois a
raiz já leva o nome da unidade.

É diferença visível em relação ao desenho e decorre diretamente da decisão de
manter a tenancy. Precisa constar do aceite, não ser descoberta na demonstração.

### D5 — O campo do cabeçalho conduz à tela de busca, não busca sozinho

Acionar o campo navega para a tela de resultados com o termo aplicado. Ele não
consulta o servidor enquanto a pessoa digita.

*Alternativa considerada:* resultados em menu suspenso, conforme se digita.
Rejeitada porque a change arquivada `busca-acionamento-explicito` tornou o
acionamento explícito por decisão deliberada — busca a cada tecla multiplica
requisições e produz resultados que piscam. O campo no cabeçalho muda **onde** a
busca começa, não **como** ela dispara.

### D6 — Esta change vem depois de `controle-documental`

A tabela de recentes e os cartões de pasta apresentam tipo e situação do
documento. Implementar esta change antes obrigaria a voltar a ela para
acrescentar colunas que a outra entrega.

A dependência é de ordem, não de bloqueio: o que esta change define — identidade
com nome, atalhos, pastas, recentes — funciona sem os dados de controle,
apenas apresenta menos colunas.

## Risks / Trade-offs

- **`audit_events` cresce sem limite e a consulta de recentes agrega sobre
  ela** → recorte por janela de tempo e teto de itens, com índice de apoio por
  unidade e instante; medir o plano de consulta com volume realista antes de
  dar por pronto.
- **O mesmo documento alterado várias vezes poderia aparecer repetido** →
  a lista é por documento, não por evento: consolidar pelo instante mais
  recente antes de aplicar o teto, senão o teto é consumido por repetições de
  um único documento.
- **Documento expurgado pela lixeira deixa evento órfão** → a consulta parte dos
  documentos vigentes e busca o instante, não o contrário; evento sem documento
  vivo simplesmente não produz linha.
- **Os cartões de pasta divergem do desenho do cliente** → levar ao aceite com
  a razão: é consequência de manter o isolamento por unidade, decisão tomada
  deliberadamente.
- **A tela inicial passa a fazer várias consultas ao carregar** (identidade,
  pastas, recentes) → são independentes e podem ser emitidas em paralelo; a
  tela apresenta cada área assim que a sua chega, sem esperar pelas demais.

## Migration Plan

Sem migração de dados. Índice de apoio em `audit_events`, se o plano de consulta
indicar necessidade, entra como migração aditiva com `IF NOT EXISTS` — mesmo
padrão das migrações de índice já existentes.

Ordem: `packages/shared` recompilado → API com os campos de identidade e a rota
de recentes → SPA. A SPA tolera a ausência dos campos novos por construção, como
já faz com a configuração pública.

**Rollback:** reverter a aplicação. Nada é persistido; o índice, se criado, pode
permanecer sem efeito.
