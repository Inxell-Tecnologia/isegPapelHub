# Design

## Context

A tela Início foi criada pelo change `shell-e-inicio` e ajustada por
`cartoes-de-atalho-acionaveis` (cartão acionável por inteiro) e
`funcao-e-setor-na-identidade` (função e setor na linha abaixo da saudação).
Hoje ela apresenta: "Olá, [nome completo]!", a linha função · setor · unidade,
um cartão "O que você pode fazer" com até seis atalhos filtrados por papel,
"Suas pastas" e "Alterados recentemente" (documento, pasta, situação, data).

A demanda nº 2, seção 1.3, pede outra composição, e D1 foi respondida pelo
cliente mantendo o isolamento por unidade. Esta change é a A3 do plano.

## Goals / Non-Goals

**Goals**

- Entregar a composição da seção 1.3 com a diferença aceita em D1.
- Contar "documentos novos nos últimos 7 dias" sem ampliar alcance.
- Manter as garantias já normatizadas: atalho conduz a ação executável,
  cartão acionável por inteiro, recentes não ampliam alcance, consultas da
  tela independentes.

**Non-Goals**

- Tour guiado (A6) e o link dele.
- Marca d'água (E1).
- Conteúdo dos cartões "Leitura obrigatória" e "Avisos" (C2).
- Registrar último acesso (resposta 3b dispensou).

## Decisions

### D1 — "Novo" é **publicado** nos últimos 7 dias

"Documentos novos" é lido como documentos cuja **publicação** (`files.created_at`)
caiu nos últimos 7 dias — não "alterados", que é o que a tabela de recentes
já mostra logo abaixo. Contar alterações repetiria a tabela com outro número e
faria um documento renomeado parecer novo. A janela é apurada pelo relógio do
Postgres (`now() - interval`), como toda vigência da aplicação, e fica em
`config.recentDocuments.newWindowDays` (padrão 7) para não ser número escrito
na rota.

### D2 — Rota própria, `GET /files/recent/new-count`

A contagem não entra na resposta de `GET /files/recent`. Duas razões: (a) a
tela Início já trata as suas áreas como **consultas independentes e
paralelas** (design de `shell-e-inicio`, Risks) — a contagem lenta não pode
segurar a tabela, nem o contrário; (b) o destino Recentes consome a mesma rota
de lista e não precisa pagar pela contagem.

Mora sob `/files`, já tenant-scoped e já nas três listas de prefixos — o
invariante 7 do plano não é tocado. Não colide com rotas de `:id`: a única
rota `GET /files/:id/...` de dois segmentos depois do id é `/files/:id/audit`,
e `recent/new-count` não casa com ela.

### D3 — A contagem usa `hasAccess`, item a item, com teto

Mesma regra de `GET /files/recent` (design.md D2 de `shell-e-inicio`):
**nenhuma segunda expressão da regra de acesso**. Os candidatos são os
arquivos da unidade do contexto (`unit_id` comparado explicitamente, pela
trava do bypass), ativos, fora da lixeira, publicados na janela; cada um passa
por `hasAccess(view)`. Herdam-se sem código próprio o obsoleto (oculto a quem
não administra), o pendente de cadastro (visível só a quem enviou e à
administração) e a vigência de concessão.

O custo é proporcional ao número de candidatos, e por isso há **teto**: lê-se
até `candidateLimit + 1` candidatos; se o teto for ultrapassado a resposta diz
`capped: true` e a tela escreve "pelo menos N" — e não "mais de N": `count`
é o que se apurou entre os candidatos lidos, um piso, que pode ser o total
exato se os candidatos além do teto forem inacessíveis. Um número exato que custasse uma
varredura sem limite a cada abertura da tela Início não vale o que custa.

### D4 — Quatro atalhos fixos, filtro por papel preservado

O conjunto passa a ser o da demanda: Enviar documento, Nova pasta, Buscar
documento, Manual do usuário. Os quatro são alcançáveis por qualquer papel
autenticado, então o filtro por papel (`roles`) fica sem uso **hoje** — mas o
mecanismo permanece, porque o requisito "atalho fora do alcance do perfil não
é apresentado" continua valendo para qualquer atalho que venha a entrar.

Saem Documentos, Lixeira, Colaboradores, Painel e Unidades. Não é perda de
caminho: todos estão no menu lateral, permanentemente visível na forma larga
e a um toque na estreita. A demanda os tira da tela de propósito.

O manual é o único atalho com **condição de configuração**: sem
`publicConfig.manualUrl` ele não aparece — o mesmo tratamento do item de
menu, e pela mesma razão (atalho sem destino é regressão). O nome acessível
anuncia a saída da aplicação, com o **mesmo texto** do menu; por isso o texto
sai do `AppShell` para um módulo próprio, consumido pelos dois.

### D5 — Pedido de nova pasta, no idioma do pedido de envio

"Nova pasta" conduz a `/pastas?nova-pasta=1`. O explorador abre o formulário
de nova pasta e retira o parâmetro do endereço **substituindo** a entrada de
histórico — o pedido vale uma vez, como o de envio
(`web-navegacao`, "O pedido não se repete").

O pedido só é atendido **na raiz da unidade**. Ali criar pasta é livre a
qualquer pessoa autenticada (`POST /folders` sem `parentId` não tem checagem
de dono); numa subpasta a regra é do servidor, e o cliente não a antecipa.
Chegando o pedido a uma subpasta, ele é descartado sem abrir nada — assim o
atalho nunca conduz a recusa. O atendimento espera o conteúdo da raiz chegar,
para o formulário não abrir sobre uma tela ainda em carregamento.

### D6 — Busca recebe com o campo focado

"Buscar documento" conduz a `/busca`. Quem chega **sem** termo encontra o
campo de termo focado — é o que faz valer "conduz à ação, sem precisar
localizá-la". Com termo no endereço (vindo da barra superior) nada muda: a
busca já executa, e roubar o foco para o campo atrapalharia quem vai ler os
resultados.

### D7 — Colunas dos recentes: as da demanda, nas duas telas

A tabela passa às colunas pedidas — Tipo, Documento (nome + código abaixo),
Unidade, Revisão, Situação, Atualizado — e continua sendo **uma origem só**
para a tela Início e o destino Recentes. A tela Início corta em **5 linhas**;
o destino mostra o recorte inteiro que o servidor devolve.

Duas consequências aceitas:

- **A coluna Pasta sai.** Não está na lista da demanda. O documento continua
  abrindo no visualizador pelo nome, e a pasta segue alcançável pela busca e
  pelo explorador.
- **A coluna Unidade é constante** — por D1 toda linha é da unidade da pessoa.
  Fica porque o cliente a pediu e porque a coluna continua correta se D7(ii)
  ("Documentos Institucionais") vier a trazer documento de outra origem. O
  valor vem da identidade (`unitName`), não de campo novo no DTO: hoje seria
  dado redundante em toda linha.

"Ver histórico completo" é o texto pedido. O destino tem o recorte do
servidor
(`config.recentDocuments`: até 10 documentos em 90 dias); o título do destino
passa a "Documentos recentes", e a frase de apoio continua dizendo que é um
recorte dos últimos dias, para o link não prometer mais do que entrega.

### D8 — Coluna direita sem media query

A coluna de 340 px é feita com `flex-wrap`: conteúdo principal com
`flex: 999 1 480px`, coluna com `flex: 1 1 340px`. Lado a lado, o espaço livre
vai quase todo para o conteúdo e a coluna fica em ~340 px; quando não cabem os
dois, a coluna desce e ocupa a largura inteira. Isso evita um segundo limiar
de largura além do `lg` da aplicação (`app/responsive.ts`), e não produz
rolagem horizontal em 360 px (`web-responsividade`).

Os dois cartões dizem por escrito o que vai aparecer neles. Não dizem
"nenhuma pendência": hoje a leitura obrigatória não existe, e a frase seria
verdadeira só por vacuidade — e passaria a mentir no dia em que alguém
olhasse antes da C2 chegar inteira.

### D9 — Saudação por horário, no relógio de quem vê

Bom dia de 5h a 11h59, boa tarde de 12h a 17h59, boa noite no resto — pelo
relógio do navegador. É texto de cortesia, não regra: não há razão para
perguntar ao servidor. O **primeiro nome** é o primeiro termo do nome
cadastrado. A função recebe o instante por parâmetro, para o teste fixar o
horário.

## Risks / Trade-offs

- **Custo da contagem** — até `candidateLimit` chamadas a `hasAccess` por
  abertura da tela, no pior caso. Mesmo perfil de custo que a lista de
  recentes já tem; a janela de 7 dias deixa o caso comum muito abaixo do teto.
- **Perda da coluna Pasta** — aceita (D7). Se a homologação reclamar, voltar a
  ela é aditivo.
- **Atalhos de administração somem da tela** — quem usava o cartão
  "Colaboradores" passa a usar o menu. Aceito pela demanda.

## Migration Plan

Sem migração de dados. Deploy comum da API e da SPA; a rota nova é aditiva, e
uma SPA antiga simplesmente não a chama.

## Open Questions

- Redação exata da linha de contagem — fixada aqui como "— N documentos novos
  nos últimos 7 dias" (com "nenhum documento novo" e "1 documento novo"), a
  confirmar na homologação.
