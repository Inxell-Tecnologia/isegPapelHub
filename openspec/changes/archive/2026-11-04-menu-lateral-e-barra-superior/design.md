# Design

## Context

Ver `proposal.md` — Why. O que molda o desenho é o que já está fechado no
repositório e **não** se reabre aqui:

- **Origem única de itens de navegação.** `AppShell` monta a lista uma vez e a
  entrega à coluna lateral e ao painel sobreposto (design.md D2/D3 do change
  `responsividade-mobile-tablet`). Duas listas divergiriam em silêncio.
- **Ponto de ruptura único em `lg` (992 px)**, lido por `useNarrowMode` com
  veredito válido no primeiro render (`web-responsividade`).
- **Tokens com origem única** em `app/theme.ts`; nenhuma tela declara cor de
  marca por literal, e todo par de cores é apurado por cálculo em
  `__tests__/contraste.test.ts` (`sistema-de-design`).
- **Piso de 44 px de área de acionamento** e de 4,5:1 de contraste de texto,
  normatizados e verificáveis.
- **Permissão de envio é por pasta, resolvida pelo servidor.** `canUpload` chega
  no DTO de conteúdo da pasta (`FolderContentsResponse`); a SPA não a antecipa.

Duas restrições externas valem citar porque decidem escopo:

- O ativo da logomarca é **`logo-papelhub.jpg`, sem transparência** — é por isso
  que `identidade-visual` exige a moldura escura própria.
- `PARAM_PEDIDO_DE_ENVIO` vive hoje em `inicio/atalhos.ts`, pasta de feature.

## Goals / Non-Goals

**Goals**

- Entregar a estrutura do menu e da barra superior de forma que A4, A5, A6 e C2
  apenas **acrescentem itens** aos grupos já existentes, sem rearranjar o shell.
- Manter a origem única: um lugar declara a largura, um lugar monta os itens, um
  lugar compõe o cartão do usuário, um lugar define o endereço do manual.
- Não deixar nenhuma largura de tela produzir rolagem horizontal.

**Non-Goals**

- Nenhuma mudança em `apps/api`, em `packages/shared`, em migração ou em
  Terraform. A fatia é de apresentação.
- Não antecipar o veredito de permissão de envio no cliente.
- Não substituir o ativo da logomarca nem desenhar um símbolo novo.

## Decisions

### D1 — A largura de 264 px é um token, consumido pelos dois modos

`LARGURA_NAVEGACAO = 264` entra em `app/theme.ts`, ao lado dos outros pisos de
apresentação, e é consumida pelo `width` do `Sider` e pelo `width` do `Drawer`.

**Por quê:** a spec exige que a largura seja declarada em um único lugar "de modo
que a coluna lateral e o painel sobreposto não divirjam". Hoje o `Sider` usa a
largura padrão do design system (não declarada) e o `Drawer` usa 280 — dois
números, nenhum deles escrito como decisão. O painel sobreposto passa a 264:
cabe folgado em 375 px, e igualar os dois é o que impede o rótulo de caber num
modo e cortar no outro.

**Alternativa descartada:** deixar o `Drawer` em 280. Mantém duas larguras para o
mesmo menu, que é exatamente a divergência que o requisito proíbe.

**Por que 264 basta:** o maior rótulo que o menu chegará a ter é "Compartilhados
comigo" (21 caracteres, fatia A5). Descontados ícone, folgas e recuo, sobram
~176 px de caixa de texto — suficiente na família e no tamanho de corpo dos
tokens. A conferência é por medição na app, não por estimativa: a tarefa pede o
menu aberto com **todos** os itens do papel, incluindo os de administração.

### D2 — Agrupamento por `type: 'group'` na mesma lista, não por dois menus

Os grupos NAVEGAÇÃO e AJUDA entram como itens de tipo `group` **dentro** da
lista única que `AppShell` já monta, cada um com seus `children`.

**Por quê:** preserva a origem única. Dois componentes `Menu` empilhados
reintroduziriam o problema que `responsividade-mobile-tablet` resolveu — duas
listas a manter em paralelo —, e ainda exigiriam entregar `selectedKeys` a
ambos, com o risco de dois itens selecionados ao mesmo tempo. O rótulo de grupo
do design system já não é acionável e não entra em `selectedKeys`, o que atende
aos cenários "Rótulo de grupo não é acionável" e "Acesso auxiliar não é
apresentado como tela corrente" sem código novo.

**Consequência obrigatória — contraste do rótulo de grupo.** A cor padrão do
título de grupo no menu escuro do design system é um branco translúcido, da
mesma natureza do branco a 65% que `identidade-visual-isetes` já teve de
substituir por reprovar no piso. O rótulo passa a usar `paleta.textoSobreEscuro`
(5,48:1 na base do degradê, 10,58:1 no topo) pelo token `darkGroupTitleColor`.
Sem isso o agrupamento nasce com um texto abaixo do piso.

**Grupo vazio não aparece:** o grupo AJUDA só é acrescentado à lista quando tem
pelo menos um filho — hoje, quando `publicConfig.manualUrl` está configurada.
Montá-lo sempre deixaria um rótulo encabeçando seção vazia.

### D3 — 600 px é teto do campo de busca, não largura fixa

O campo recebe `flex: 1`, `maxWidth: 600` e `minWidth: 0`.

**Por quê — é aritmética, não gosto.** No limiar de 992 px, em modo largo, a
barra superior dispõe de `992 − 264 (menu) − 48 (recuo) = 680 px`. Dentro dela
precisam caber o sino (~44), a ajuda (~44), a ação de envio (~190) e as folgas
(~36): restam ~366 px. Um campo de 600 px fixos estouraria a linha por ~234 px e
produziria **rolagem horizontal do documento**, que `web-responsividade` proíbe
em toda tela. Com o teto, o campo fica em ~366 px no limiar e cresce até 600 px a
partir de ~1226 px de viewport.

**Alternativa descartada:** manter 600 px fixos e esconder a ação de envio abaixo
de alguma largura. Troca uma regressão por outra — a ação principal pedida pela
demanda desapareceria justamente nas telas de trabalho de 1024 e 1280 px.

**A lupa vai dentro do campo, e isso descarta o `Input.Search`.** A suposição
inicial — "`Input.Search` sem `enterButton` desenha a lupa dentro" — foi
**verificada e é falsa**: com ou sem `enterButton`, o design system renderiza o
botão num `ant-input-group-addon`, isto é, **fora** da caixa do campo, que é
exatamente o que o requisito proíbe. O acionador entra então como `suffix` de um
`Input` comum, dentro do `ant-input-affix-wrapper`; `type="search"` preserva o
papel de `searchbox`. Isso também apaga a ramificação `enterButton={!isNarrow}`
que existia só para o botão verde não comer a largura no modo estreito — não há
botão adjacente em largura nenhuma.

**Medido na app** (quatro larguras, navegador real): 400 px em 992, 432 em 1024
e o teto de 600 a partir de 1280, sem rolagem horizontal em nenhuma.

### D3b — Abaixo do limiar, o teto não basta: o campo precisa de piso, e a barra precisa ceder

No modo estreito o campo recebe piso de 120 px, a ação de envio fica **só com o
ícone** (nome acessível preservado) e o acesso à ajuda **sai da barra**.

**Por quê — a medição reprovou a primeira tentativa.** Com `flex: 1` sem piso e
os três controles rotulados, o campo colapsou para **24 px** em 375 px: caixa
visível em que não se digita. É o mesmo defeito que `responsividade-mobile-tablet`
já havia corrigido uma vez, e que voltou ao se retirar o piso junto com o botão
adjacente. `flex: 1` cede toda a largura aos vizinhos quando eles a pedem.

O piso sozinho só trocaria o colapso do campo por rolagem horizontal, então a
largura tem de vir de algum lugar: o rótulo "Enviar documento" (~140 px) e o
acionador de ajuda (~44 px). **Nenhum acesso é perdido** — a ação de envio
mantém o nome acessível e a dica, e o mesmo manual continua a um toque no grupo
AJUDA do painel sobreposto. Medido depois da correção: **163 px** de campo em
375 px, sem rolagem horizontal.

### D4 — A ação de envio reusa o pedido pelo endereço, e não é filtrada por papel

O botão leva a `/pastas?enviar=1`, o mesmo endereço que o cartão "Enviar
documentos" da tela inicial já usa, e é oferecido a **qualquer** papel
autenticado.

**Por quê:** `canUpload` é **por pasta** e vem do DTO de conteúdo; a barra
superior não tem pasta de contexto, e nenhum endpoint responde "esta pessoa pode
enviar em algum lugar". O caminho já resolvido por `cartoes-de-atalho-acionaveis`
(design.md D4/D5) é anunciar o pedido no endereço e deixar o explorador atendê-lo
**só** depois do veredito do servidor — é assim que um atalho oferecido não
conduz a uma recusa.

**Alternativas descartadas:**

- *Filtrar por papel.* Permissão de envio vem de concessão, não de papel: um
  `collaborator` com concessão de envio perderia o botão, e um `unit_admin` sem
  pasta onde enviar o veria sem efeito. O papel é a informação errada.
- *Veredito novo no servidor* ("pode enviar em pelo menos uma pasta"). Endpoint
  ou campo novo para decidir apresentação, que ainda teria de agregar a resolução
  de acesso sobre a árvore inteira — custo e pressão sobre alcance que a fatia
  não justifica.

**Arrumação que isso exige:** `PARAM_PEDIDO_DE_ENVIO` sai de `inicio/atalhos.ts`
para `navegacao/pedido-de-envio.ts`. O shell não deve importar de uma pasta de
feature para falar com outra; quem define o idioma do pedido é a navegação, que é
quem o atende. `inicio/atalhos.ts` e `ExplorerPage` passam a consumir de lá.

### D5 — Com o nome em texto, a logomarca passa a decorativa

`BrandMark` ganha o nome "PapelHub" e o descritor "Gestão de Documentos" como
texto irmão; o `alt` da imagem sai e ela vira `aria-hidden`.

**Por quê:** `identidade-visual` dava o nome acessível à imagem porque ali ela era
a **única** portadora do nome. Com o texto ao lado, manter o `alt` faria a marca
ser anunciada duas vezes em sequência por leitor de tela. A decisão D7 de
`identidade-visual-isetes` não está sendo contrariada — a premissa dela deixou de
valer, e o delta registra isso.

A **moldura escura permanece**: o ativo continua sem transparência. O descritor
não aparece no estado colapsado, onde não há largura para ele sem truncar — mesma
razão já registrada para a identificação do cliente (design.md D6 daquele change).

### D6 — O cartão do usuário é um link para Minha conta, com Sair ao lado

Um componente único, `shell/CartaoDoUsuario.tsx`, consumido pelo rodapé da coluna
lateral e pelo rodapé do painel sobreposto. O corpo do cartão (avatar, nome,
perfil, unidade) é um **link** para `/minha-conta`; **Sair** é um botão irmão,
fora do link.

**Por quê:** a demanda pede o cartão "+ botão Sair" visível, e o requisito vigente
exige que "Minha conta" siga alcançável por qualquer papel. Resolver com um menu
suspenso manteria as duas ações escondidas atrás de um clique, que é o que a
demanda está justamente tirando do topo. Link e botão **irmãos**, nunca aninhados:
controle acionável dentro de link é alvo ambíguo para teclado e para leitor de
tela.

**Contraste sobre o degradê:** nome em `paleta.branco` (8,16:1 na base do degradê),
perfil e unidade em `paleta.textoSobreEscuro` (5,48:1). Ambos acima do piso nos
dois extremos do degradê.

**Nome longo** não alarga a navegação: o cartão trunca com reticências e carrega o
valor íntegro em `title`, que é o tratamento que o shell já dá à identidade no
modo estreito. O requisito de "nenhum rótulo cortado" é sobre **item de
navegação**, cujo conjunto é fechado e mensurável; nome de pessoa não é.

**Colapsado:** fica só o avatar, com nome, perfil e unidade em `title`. O
identificador interno não aparece em nenhum estado.

**A coluna precisa ser fixa à viewport para que o rodapé seja rodapé.** A
medição na app encontrou o cartão em **y=977 numa viewport de 900 px** — fora
da tela: o `Sider` cresce com o conteúdo da página, de modo que o "pé da
navegação" era o pé do **documento**, não o da tela. A coluna passa a
`position: sticky; top: 0; height: 100vh`, e o rodapé reserva a altura do
gatilho de recolher, que o design system posiciona fixo ao pé da viewport e que
sem a reserva cobriria o cartão.

### D7 — O avatar recebe token próprio, com as iniciais em texto escuro

`paleta.azulAvatar = '#9ED8F6'` entra nos tokens; as iniciais usam `paleta.texto`.

**Por quê:** apurado por cálculo antes de decidir — `#9ED8F6` mede **11,12:1** com
`paleta.texto` e **1,54:1** com branco. O `Avatar` do design system escreve em
branco por padrão, de modo que adotar a cor sem fixar a das iniciais entregaria
1,54:1, reprovação grosseira no piso de 4,5:1. É a mesma armadilha que o guia do
cliente já trouxe no verde da marca (2,21:1 com branco), e o requisito novo em
`sistema-de-design` a fecha pelo mesmo caminho. Como superfície, o avatar mede
5,29:1 contra a base do degradê — acima do piso de 3:1 de elemento de interface.

### D8 — Compactar é reduzir folga, nunca o alvo de toque

Os itens ficam compactos pelo espaçamento vertical entre eles e pelo recuo, com a
altura do item **fixada no piso de 44 px** (`Menu.itemHeight`), não herdada de um
valor derivado maior.

**Por quê:** o tema fixa `controlHeight: 44`, e o design system deriva a altura do
item de menu de um token "grande" proporcional a ele — é a explicação provável do
"itens muito espaçados" relatado, e por isso a altura passa a ser declarada em vez
de derivada. A direção é obrigatória de qualquer modo: o piso de 44 px é requisito
de `sistema-de-design`, então compactar abaixo dele está fora de questão. A
conferência é por medição na app.

## Risks / Trade-offs

- **[A barra superior estoura no limiar de 992 px]** → o teto de D3 é a
  mitigação, e a verificação foi feita em navegador real: 992, 1024, 1280 e
  1440 px, sem rolagem horizontal, com o campo em 400/432/600/600 px e todo
  item de menu em exatamente 44 px de altura, nenhum truncado. **A mesma
  medição reprovou duas coisas que a inspeção não teria pego** — o campo
  colapsado a 24 px em 375 px (D3b) e o cartão do usuário fora da viewport
  (D6). As duas estão corrigidas e cobertas por teste; registrá-las aqui é o
  que impede que voltem por "simplificação" do estilo.
- **[O rótulo de grupo nasce abaixo do piso de contraste]** → token
  `darkGroupTitleColor` em D2, com o par apurado em `__tests__/contraste.test.ts`
  junto dos demais. Sem o teste, a regressão é invisível.
- **[O cartão do usuário divergir entre os dois modos]** → componente único; a
  spec cobre com o cenário "Painel sobreposto oferece os mesmos itens do modo
  largo", que passa a incluir a identidade no rodapé.
- **[O botão de envio parecer prometer permissão que a pessoa não tem]** →
  trade-off assumido e já normatizado: o explorador não apresenta recusa, apenas
  deixa de focar a área de envio. É o mesmo comportamento do cartão da tela
  inicial desde `cartoes-de-atalho-acionaveis`; divergir aqui criaria duas
  respostas para o mesmo pedido.
- **[A fatia entrega menu "incompleto" em relação ao Anexo A]** → quatro itens
  pedidos (Favoritos, Compartilhados comigo, Leitura obrigatória, Tour guiado)
  ficam fora porque seus destinos não existem. Oferecê-los agora violaria
  "atalho apresentado conduz a uma ação executável". A homologação da A2 precisa
  ser feita sabendo disso — é diferença visível, e está nomeada no proposal.
- **[A marca d'água e a logo branca não entram]** → dependência E1. O ativo atual
  é JPEG opaco: a 14% de opacidade apresentaria um retângulo cinza no pé do menu,
  e sobre fundo claro exigiria a moldura escura que a demanda quer eliminar.
  Entregar a estrutura e esperar o PNG transparente é mais honesto que entregar
  um defeito visível e um requisito não verificável.

## Migration Plan

Não há migração: nenhuma tabela, nenhuma coluna, nenhum contrato de API. O
desenho é reversível por `git revert` do commit da fatia, sem estado a desfazer.

## Open Questions

Nenhuma que mude specs, abordagem ou tarefas. As decisões de produto que ainda
travam o bloco A (D1 a D4 do plano) são de **A1 e A3**; A2 não depende delas —
o cartão do usuário nasce exibindo o papel, e a troca pela função do cadastro
fica contida nele quando D2 for respondida.
