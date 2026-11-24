# Proposal

## Why

Na tela inicial, os cartões de **"O que você pode fazer"** e de **"Suas pastas"**
prometem ser clicáveis por inteiro e não são. `Card hoverable` aplica
`cursor: pointer` e sombra de elevação ao cartão **todo** — é o que o Ant Design
faz com `.ant-card-hoverable` —, mas o único alvo que navega é o `<Link>` inline
do rótulo, uma caixa de ~22px de altura na largura do texto
(`apps/web/src/inicio/InicioPage.tsx:60-67` e `90-96`). Cerca de 85% da
superfície de cada cartão mostra a mão e não leva a lugar nenhum. Quem clica no
meio do cartão, na descrição ou à direita do rótulo conclui — com razão — que
"esse cartão não funciona"; quem acerta o texto conclui que aquele, e só aquele,
está implementado. Não há caso especial no código: os seis atalhos saem do mesmo
`map`, e o defeito é idêntico em todos, inclusive no de "Unidades".

Os 22px também ficam **abaixo do piso de 44px** que o requisito "Piso de
acessibilidade verificável na camada visual" (`openspec/specs/sistema-de-design/`)
exige de controle interativo — a tela inicial é hoje uma exceção não declarada a
esse piso.

Dois fatos explicam por que isso atravessou a entrega. Primeiro, nenhum teste da
suíte **aciona** um cartão de atalho: a verificação de
`apps/web/src/__tests__/tela-inicial.test.tsx:145-171` prova que o destino é
alcançável montando a SPA já na URL (`renderApp([destino])`), o que mede a guarda
de rota, não a área de clique — exatamente a palavra *aciona* do cenário da spec
ficou sem cobertura. Segundo, o atalho **"Enviar documentos"** aponta para
`/pastas`, o mesmo destino de "Ver documentos": são dois cartões com texto
diferente e comportamento igual, e o de envio não envia — deixa a pessoa procurar
a área de envio na página.

## What Changes

- Nas **duas** seções da tela inicial, o cartão inteiro passa a ser o link: um
  `<Link>` envolvendo o `<Card>`, com `href` real — mantendo foco de teclado,
  Ctrl+clique e "abrir em nova aba", que um `onClick` em `<div>` destruiria. A
  altura do cartão passa a ser a área de acionamento, satisfazendo o piso de 44px
  sem nenhum estilo novo para isso.
- O nome acessível de cada cartão de atalho **permanece o rótulo curto** ("Enviar
  documentos", "Lixeira", "Unidades") que spec e testes já fixaram: sem cuidado, o
  link envolvente passaria a anunciar rótulo + descrição concatenados.
- O atalho **"Enviar documentos"** passa a conduzir ao envio em si, não só ao
  explorador: aponta para `/pastas` com um pedido de envio na URL, que o
  explorador atende levando a pessoa à área de envio que já existe na página.
  "Ver documentos" continua em `/pastas`, e a duplicata de destino deixa de
  existir.
- O pedido de envio é atendido **somente quando o servidor já resolveu que a
  pessoa pode enviar** na pasta aberta. Sem permissão, a pessoa chega ao
  explorador normalmente e nada se desloca — o atalho nunca conduz a uma recusa,
  que é o que o cenário "Atalho apresentado conduz a uma ação executável" exige.
- Cobertura por `href` e por nome acessível nas duas seções, mais o comportamento
  do pedido de envio com e sem permissão. **Não** se simula clique: o cartão é um
  link, e o que o torna acionável em toda a área é o elemento que o envolve, não
  um manipulador a disparar.
- O manual do usuário (`docs/manual/docs/a-tela.md`) é ajustado no mesmo commit:
  cartões acionáveis por inteiro e o atalho de envio que leva ao envio.
- **Fora de escopo**: as linhas da tabela "Alterados recentemente" (a tabela tem
  ações por linha e um alvo de clique na linha inteira competiria com elas); o
  conjunto de atalhos, seus rótulos e descrições, que não mudam; qualquer
  alteração em permissão, rota de API, DTO ou tráfego de bytes; e transformar o
  envio em modal ou em rota própria — a área de envio continua onde está, dentro
  do explorador.

## Capabilities

### New Capabilities

Nenhuma. O comportamento já é governado por `tela-inicial` e `web-navegacao`.

### Modified Capabilities

- `tela-inicial`: ganha o requisito **"Cartão da tela inicial é acionável em toda
  a sua área"**, que governa as duas seções de cartões — hoje as specs dizem o que
  cada cartão apresenta e para onde conduz, e são silenciosas sobre *onde* se
  clica; foi nesse silêncio que a superfície morta se acomodou. E o requisito
  **"Atalhos da tela inicial refletem o que o perfil pode fazer"** passa a exigir
  que o atalho de envio conduza ao envio, e não a uma tela onde o envio ainda
  precise ser procurado.
- `web-navegacao`: ganha o requisito **"Explorador atende ao pedido de envio
  recebido na URL"** — chegar ao explorador com o pedido de envio leva a pessoa à
  área de envio quando ela pode enviar, não a leva quando não pode, e o pedido não
  se repete ao voltar ou recarregar.
- `sistema-de-design`: **não** muda. O requisito de 44px já existe e passa a ser
  satisfeito pela tela inicial, em vez de contrariado.

## Impact

- **Código**: `apps/web/src/inicio/InicioPage.tsx` (as duas seções),
  `apps/web/src/inicio/atalhos.ts` (destino do atalho de envio) e
  `apps/web/src/navegacao/ExplorerPage.tsx` (consumo do pedido de envio,
  reaproveitando o `focarAreaDeEnvio` que já serve o estado de pasta vazia,
  `ExplorerPage.tsx:226`).
- **API, banco, permissão, auditoria, bytes**: nada. A mudança é de apresentação;
  a API segue o único guardião de permissão, e a decisão de envio continua sendo a
  do servidor (`canUpload` do DTO de conteúdo), nunca inferida no cliente.
- **Rotas**: nenhuma rota nova. O pedido de envio viaja como parâmetro de consulta
  em `/pastas`, no mesmo padrão de `/busca?q=` — `API_PREFIXES` e as duas pontas
  que ela espelha (`vite.config.ts`, `locals.tf`) não são tocadas.
- **Testes**: `apps/web/src/__tests__/tela-inicial.test.tsx` ganha verificação de
  `href` nos cartões das duas seções; a cobertura do pedido de envio entra nos
  testes do explorador. Os testes que hoje localizam os atalhos por
  `getByRole('link', { name: '<rótulo>' })` seguem valendo sem alteração — é essa
  a razão de preservar o nome acessível curto.
- **Documentação**: `docs/manual/docs/a-tela.md`, na seção "Tela inicial".
- **Dependências**: nenhuma nova.
