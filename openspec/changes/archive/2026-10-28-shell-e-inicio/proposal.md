# Proposal

## Why

A tela de Início é, hoje, quatro linhas de código: um `Result` com o favicon e o
texto "Bem-vindo ao PapelHub". Quem entra no sistema chega a uma tela que não
informa nada e não leva a lugar nenhum — precisa procurar no menu o que veio
fazer.

No cabeçalho, a situação é pior que inexpressiva: a identidade do usuário é
apresentada como os dois primeiros caracteres do seu identificador interno,
produzindo rótulos como "66 / Colaborador". A capability `web-shell-e-auth` já
exige, desde a sua entrega, que a pessoa "veja seu nome/identidade e papel" —
o comportamento atual nunca atendeu a esse requisito.

Esta change entrega a tela inicial como ponto de partida do trabalho e acerta o
shell: identificação real, navegação reorganizada e busca sempre ao alcance.
Implementa o Épico 11 do PRD (US 11.1 e 11.2), acrescentado ao
`docs/prd_final.md` para esta fatia.

## What Changes

- **A identidade devolvida à interface passa a carregar nome e unidade.** Hoje
  só traz identificador, unidade e papel — o nome existe apenas numa rota de
  perfil separada, que o shell não consome.
- **Tela inicial reconstruída**: saudação com nome, função e unidade; atalhos
  filtrados pelo perfil; cartões de acesso rápido às pastas de primeiro nível
  permitidas; e a lista dos documentos alterados recentemente.
- **"Documentos recentes"** — listagem das últimas alterações (publicação,
  substituição, renomeação, movimentação) nos documentos a que a pessoa tem
  acesso. Derivada do registro de auditoria que o sistema já mantém: nenhuma
  coluna nova, nenhum carimbo novo a lembrar de gravar.
- **Navegação reorganizada**: "Arquivos" passa a "Documentos"; "Buscar" deixa de
  ser item de menu e vira campo permanente no cabeçalho; "Recentes" entra como
  destino. Itens de administração e acesso ao manual permanecem onde estão.
- **Rodapé da navegação** passa a apresentar nome e perfil reais, no lugar do
  fragmento de identificador.

### Fora de escopo

- **"Compartilhados comigo"**, presente no desenho do cliente: fora por decisão
  dele. A informação existe (as concessões estão registradas), mas a tela não
  entra nesta rodada.
- **Favoritos e tour guiado**: fora por decisão do cliente, já refletida no PRD.
- **Cartões de "Minhas unidades"** como desenhados, listando seis unidades: o
  modelo de isolamento permanece como está — cada pessoa pertence a uma
  unidade, e nem o administrador global enxerga conteúdo de outra. Os cartões
  entregam **pastas de primeiro nível da própria unidade**, com o mesmo
  tratamento visual. É diferença visível em relação ao desenho e decorre
  diretamente da decisão de manter a tenancy atual.
- **Busca pelo conteúdo interno dos arquivos**: épico próprio, fora do PRD nesta
  fase. O campo no cabeçalho busca por nome e, com a change
  `controle-documental`, por código.

## Capabilities

### New Capabilities
- `tela-inicial`: o que a tela de entrada apresenta a quem acabou de entrar —
  identificação, atalhos conforme o perfil, acesso rápido às pastas permitidas e
  as últimas alterações nos documentos ao alcance da pessoa — e as garantias de
  permissão e isolamento que essa apresentação não pode violar.

### Modified Capabilities
- `autenticacao`: acrescenta que a identidade devolvida à interface carrega o
  nome da pessoa e o nome da sua unidade, além do que já carrega.
- `web-shell-e-auth`: o requisito "Shell de layout com identidade e navegação"
  passa a exigir que a identidade apresentada seja o nome da pessoa, nunca um
  identificador interno, e fixa o conjunto de destinos da navegação, com a
  busca fora dele.
- `web-busca`: acrescenta o campo de busca permanentemente acessível no
  cabeçalho, sem afrouxar o acionamento explícito já normatizado.

## Impact

**Backend (`apps/api`)**:
- `GET /auth/me` e a resposta de login passam a carregar nome e unidade,
  resolvidos na mesma releitura por requisição que já ocorre.
- Rota nova para os documentos alterados recentemente, construída sobre
  `audit_events` e sujeita à mesma resolução de acesso das listagens — sem
  verbo novo, sem tabela nova, sem coluna nova.

**Contrato compartilhado (`packages/shared`)**: `AuthenticatedIdentity` ganha
nome e unidade; DTO novo para a listagem de recentes.

**Frontend (`apps/web`)**: `app/HomePage.tsx` deixa de ser `PlaceholderPage` e
passa a tela própria; `shell/AppShell.tsx` muda navegação e rodapé; campo de
busca entra no cabeçalho.

**Ordem recomendada de implementação**: esta change deve vir **depois** de
`controle-documental`. A tabela de documentos recentes e os cartões de pastas
apresentam tipo e situação; implementá-la antes obrigaria a voltar a ela para
acrescentar as colunas.

**Documentação**: o manual ganha a descrição da tela inicial e da navegação
reorganizada.
