# Design — responsividade-mobile-tablet

## Contexto

A SPA (`apps/web`) é React + Ant Design, organizada por feature em pastas de
topo. Não existe nenhum arquivo `.css`: todo estilo é token do design system
(`app/theme.ts`) ou `style` inline. Não existe nenhuma media query, nenhum uso de
`Grid.useBreakpoint`, nenhuma tabela com rolagem própria.

O `AppShell` monta um `<Sider collapsible>` sem `breakpoint`, com dois `<Menu>`:
o de destinos internos e um segundo, de item único e `selectable={false}`,
empurrado ao pé por um wrapper flex com `margin-top: auto` — arranjo introduzido
pelo change arquivado `acesso-ao-manual-no-shell` (design.md D6/D8 de lá) para
hospedar o acesso ao manual.

Duas decisões de produto foram tomadas antes deste design e o condicionam:

1. O alvo do modo estreito é **consulta** — navegar, visualizar, buscar.
2. O manual passa a ser o **último item da navegação**, junto dos demais.

## Decisões

### D1. Um limiar só, em 992px (`lg`), declarado em um lugar

**Decisão:** a aplicação tem **um** ponto de ruptura, `lg` (992px). Abaixo dele,
forma estreita; a partir dele, a forma atual, inalterada.

Descartamos a escada completa do design system (`xs`/`sm`/`md`/`lg`/`xl`): cada
limiar adicional multiplica os estados a verificar, e nenhuma das telas pede um
terceiro comportamento intermediário.

Entre `md` (768) e `lg` (992), escolhemos `lg` porque o alvo é consulta. Um
tablet em retrato mede 768px:

```
  limiar md (768)                    limiar lg (992)  ◄── escolhido
  ┌────┬──────────────┐              ┌──────────────────┐
  │ ▸  │              │              │ ☰   PapelHub   ⚙ │
  │ ▸  │  ~570px      │              ├──────────────────┤
  │ ▸  │  úteis       │              │   768px úteis    │
  │ ▸  │              │              │   p/ o preview   │
  └────┴──────────────┘              └──────────────────┘
  navegação sempre à mão             conteúdo ganha 200px
```

Visualizar um PDF é o ato central do uso móvel; 200px a mais de largura valem
mais que a navegação permanentemente visível, que continua a um toque.

O valor vive numa constante única, e o modo estreito é lido por
`Grid.useBreakpoint` do design system — não por `window.matchMedia` escrito à
mão, que duplicaria a definição e sairia de sincronia com os tokens.

### D2. Uma origem de itens, dois contêineres

**Decisão:** a lista de itens de navegação é extraída para uma origem única,
consumida tanto pelo `Sider` (acima do limiar) quanto pelo painel sobreposto
(abaixo).

O erro fácil aqui é montar dois conjuntos de itens — um para cada contêiner — e
descobrir meses depois que um item de administração foi acrescentado só num
deles. A filtragem por papel (`unit_admin`, `global_admin`) torna essa
divergência silenciosa e difícil de notar.

```
              ┌──────────────────────────┐
              │  itens de navegação      │  filtrados por papel
              │  + manual (último)       │  ◄── origem única
              └───────────┬──────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        <Sider>  (≥ lg)        painel sobreposto (< lg)
        colapsável              sempre expandido
        tooltip no colapso      fecha ao navegar
```

Dois comportamentos do painel sobreposto precisam ser distintos, e é fácil errar:

- Tocar um **destino interno** navega **e fecha** o painel. Sem isso a pessoa
  toca "Arquivos" e continua olhando o menu, sem entender o que aconteceu.
- Tocar o **manual** **não** fecha o painel: abre outra aba, e a aplicação
  continua onde estava. Fechar aqui simularia uma navegação que não houve.

### D3. O manual vira o último item — e o nome acessível passa a carregar sozinho a distinção

**Decisão:** o acesso ao manual deixa a área separada do rodapé e passa a ser o
**último item** da lista única de navegação.

Isto **reverte** a decisão D6/D8 do change arquivado `acesso-ao-manual-no-shell`,
que o colocou em `<Menu>` próprio ao pé. A reversão é deliberada e tem delta de
spec correspondente.

O requisito vigente em `web-shell-e-auth` tem três cláusulas sobre o acesso
auxiliar. Só uma cai:

| Cláusula | Situação |
|---|---|
| "área própria ao pé, visualmente separada" | **substituída** por "último item" |
| "NÃO participa da indicação de tela corrente" | **preservada** |
| "nome acessível indica que leva para fora" | **preservada — e reforçada** |

A terceira merece atenção. Antes, ela era redundante: quem enxergava a tela via a
separação visual, e quem não enxergava tinha o `aria-label`. Agora a separação
visual **não existe mais**, e o nome acessível é a **única** coisa que distingue
"sai da aplicação" de "mais uma tela". Afrouxá-lo passaria a ser uma regressão de
acessibilidade real, não cosmética.

A não-seleção continua garantida de graça pela mecânica já existente:
`selectedKeys` é controlado e deriva de `location.pathname`, que nunca coincide
com a chave do manual. O `selectable={false}` do menu separado deixa de existir
junto com o menu; a garantia passa a vir do controle de `selectedKeys`, e o teste
que a trava permanece.

Efeito colateral favorável: **a mudança simplifica o shell**. Somem o segundo
`<Menu>`, o wrapper flex e o `margin-top: auto` — e com eles o comentário de
`AppShell.tsx` que explica por que `.ant-layout-sider-children` precisava de um
wrapper. Um único `<Menu>` é trivialmente portável para o painel sobreposto;
dois menus com `margin-top: auto` exigiriam recriar o wrapper flex lá dentro.

### D4. No modo estreito, "visualizar" fica direta e o resto vai para um menu

**Decisão:** a coluna de ações do explorador mantém `Visualizar` como ação
direta no modo estreito; `Baixar`, `Renomear`, `Permissões`, `Auditoria` e
`Excluir` passam a um menu de ações do item.

```
  < lg:  [👁 Visualizar]  [⋯]
                           └─ Baixar · Renomear · Permissões · Auditoria · Excluir
  ≥ lg:  tudo visível, exatamente como hoje
```

A hierarquia passa a **espelhar o escopo declarado**: consulta em primeiro plano,
o resto a um toque. Nenhuma ação é suprimida — a distinção é entre *direta* e
*agrupada*, nunca entre *presente* e *ausente*.

Isso preserva uma regra já normatizada em `web-navegacao` que seria fácil violar
sem perceber: a SPA **não infere permissão no cliente** — oferece a ação e trata
o `403` do servidor. Esconder ações por tamanho de tela é legítimo; escondê-las
por permissão presumida não é, e continua proibido.

Custo medido nos testes antes de decidir: apenas `explorer.test.tsx` e
`unidades.test.tsx` dependem desses botões (10 asserções). O agrupamento é
barato.

### D5. Capacidade ausente se recusa com explicação — nunca se oculta

**Decisão:** quando o dispositivo não suporta uma ação, a ação **permanece
visível** e a recusa explica o motivo. Vale para o download de pasta e para o
envio de pasta.

Este é o ponto onde a change quase violou uma spec vigente. `download-pasta` diz:

> A ação de baixar pasta SHALL ser oferecida uniformemente em **toda** pasta (…)
> e NÃO SHALL ser ocultada em função do tamanho provável do conteúdo — pedidos
> que excedam os limites SHALL ser recusados com a mensagem acionável acima, **em
> vez de a ação desaparecer da interface sem explicação**.

A proibição literal nomeia um eixo — ocultar **em função do tamanho do
conteúdo**. Ocultar por classe de dispositivo é outro eixo, e a letra não seria
violada. Mas a oração final ("desaparecer da interface sem explicação") descreve
exatamente o mecanismo que "esconder o botão no celular" usaria.

```
   OCULTAR no modo estreito          RECUSAR com explicação  ◄── escolhido
   ┌────────────────────┐            ┌────────────────────────────┐
   │ [Nova pasta]       │            │ [Nova pasta]               │
   │                    │            │ [Baixar esta pasta]        │
   │  ação some, sem    │            │        ↓ toca              │
   │  explicação        │            │  "Baixar pasta não está    │
   │                    │            │   disponível neste         │
   │  ✗ contraria o     │            │   dispositivo. Use um      │
   │    espírito de D9  │            │   computador."             │
   │                    │            │  ✓ mesma gramática do teto │
   └────────────────────┘            └────────────────────────────┘
```

Recusar preserva o requisito **inteiro**, letra e espírito, reutiliza a forma que
a capability já escolheu para o estouro de limite, e ainda ensina a alternativa —
enquanto ocultar deixaria a pessoa concluindo que o produto não faz aquilo.

O motivo técnico da recusa: `zip-download.ts` monta o pacote em *streaming*, mas
materializa o `Blob` **inteiro** em memória antes de entregá-lo
(`triggerBlobDownload`, via `URL.createObjectURL` + `<a download>`). Com o teto
de 50MB do manifesto, isso ataca justamente o dispositivo mais fraco; e o Safari
iOS tem histórico irregular com `download` em URLs de blob, abrindo o conteúdo
inline em vez de salvar — um `.zip` aberto inline é uma tela em branco.

O envio de pasta segue o mesmo princípio por motivo diferente: `webkitdirectory`
simplesmente não existe em Safari iOS nem em Chrome Android. Nenhum CSS recupera
isso; uma recusa honesta é melhor que um seletor que não abre.

Generalizamos o princípio na capability nova, em vez de repeti-lo caso a caso —
é a mesma regra em dois lugares e valerá para o terceiro.

### D6. Preview aproveita a largura útil — deixou de ser detalhe

**Decisão:** no modo estreito, o preview ocupa a largura útil da tela, e a área
de conteúdo recebe altura proporcional ao viewport.

Enquanto o alvo era "consultar e baixar", o `width={800}` do `PreviewModal` era
um item de lista. Com o alvo recortado para **consulta**, visualizar virou o ato
central do uso móvel, e o preview passou a ser a tela principal — não um modal
acessório. A largura fixa de 800px e o `height: '70vh'` do visualizador embutido
precisam ceder ao viewport real.

Duas armadilhas ficam registradas para a implementação: `70vh` reproduz em modo
estreito o mesmo problema de barra de endereço retrátil já tratado na change
`fundo-marca-tela-login`; e um visualizador embutido de PDF em tela pequena
depende do navegador, que pode simplesmente não renderizar inline — caso em que a
tela precisa degradar para uma alternativa explicável, e não para um retângulo
vazio.

### D7. Dois níveis de adequação, declarados — e uma capability para eles

**Decisão:** as telas se dividem em dois níveis normatizados, e o contrato
transversal ganha capability própria (`web-responsividade`).

```
┌─ OTIMIZADO — layout pensado para a tela estreita ────────────┐
│  Login · Início · Explorador (navegar) · Preview · Busca     │
│  Minha conta · Notificações · Manual · Sair                  │
├─ UTILIZÁVEL — não quebra; conteúdo largo rola no contêiner ──┤
│  Lixeira · Pessoas · Unidades · Painel · Auditoria           │
│  Permissões · Envio de arquivo                               │
├─ RECUSADO — capacidade ausente no dispositivo (D5) ──────────┤
│  Download de pasta · Envio de pasta                          │
└──────────────────────────────────────────────────────────────┘
```

O nível **utilizável** é deliberadamente barato: rolagem própria do contêiner
resolve as seis tabelas com uma linha cada, e tira a rolagem horizontal do
documento em toda a aplicação. "Fora do foco" não pode significar "quebrado" — a
diferença entre os dois níveis é *layout repensado* versus *funciona com
esforço*, nunca *funciona* versus *não funciona*.

Sobre a capability nova: a alternativa era espalhar "não produz rolagem
horizontal" como delta em oito capabilities de tela. Recusada — o contrato
ficaria repetido oito vezes, sem dono, e cada tela futura nasceria com a
obrigação de recopiá-lo. Com capability própria, o contrato tem um lugar, e as
capabilities existentes só recebem delta onde muda **comportamento**, não onde
muda layout.

## Riscos e verificação

- **Divergência entre os dois contêineres de navegação** é o risco estrutural
  desta change (D2). Mitigação: origem única de itens, e teste que percorre a
  navegação nos dois modos com o mesmo papel, comparando os itens.
- **jsdom não faz layout.** Os testes travam declarações e presença de elementos;
  não provam que algo cabe na tela. A verificação de que nenhuma tela produz
  rolagem horizontal exige navegador real, em pelo menos 360px e 768px.
- **Regressão no modo largo** é o risco silencioso: toda a mudança precisa ser
  invisível acima de 992px. A conferência final passa pelas telas nos dois lados
  do limiar, e os testes existentes do `Sider` colapsável permanecem sem
  alteração de propósito.
- **A recusa por capacidade não pode virar recusa por permissão.** As mensagens
  precisam ser distinguíveis: "não disponível neste dispositivo" e "permissão
  insuficiente" descrevem situações diferentes e levam a ações diferentes.
