# Design — fundo-marca-tela-login

## Contexto

A tela de login (`apps/web/src/auth/LoginPage.tsx`) é a única rota de topo fora
do `AppShell` (`apps/web/src/app/router.tsx`) — o que significa que qualquer
tratamento visual aplicado a ela não vaza para nenhuma outra tela, sem
necessidade de escopo de CSS ou classe condicional. A SPA não tem arquivo `.css`
algum: todo estilo é token do Ant Design (`app/theme.ts`) ou `style` inline.

A capability `identidade-visual` já normatiza nome exibido, logomarca, favicon e
identificação do cliente, e contém uma regra que restringe o desenho desta
change:

> A logomarca SHALL ser apresentada sempre contida numa moldura escura própria,
> e NÃO SHALL ser exibida diretamente sobre um fundo claro sem essa moldura.

O `BrandMark` implementa isso com `background: '#141414'` fixo. Qualquer
alteração no campo visual do login precisa manter essa moldura válida.

## Decisões

### D1. A cor vem do azul da logomarca, não do fundo cinza da arte

**Decisão:** o fundo da tela de login é `#063c7c`.

A arte da logomarca foi amostrada pixel a pixel. Ela contém duas famílias de cor
com pretensões diferentes:

| Papel na arte | Cor | Natureza |
|---|---|---|
| Fundo fotográfico da peça | `#454440` / `#43423f` | cinza quente, esverdeado |
| Vinheta lateral | `#535049` | idem, mais claro |
| Disco de papel | `#ffe5c0` | creme |
| Brilho ciano (árvore e raízes) | `#abe2e7` → `#50a2ba` | claro → saturado |
| Palavra "PapelHub" | `#063c7c` | azul profundo |

"Cor compatível com a logomarca" admite duas leituras opostas. A **fidelidade ao
fundo da peça** levaria ao cinza `#454440`; a **fidelidade ao que se lê como
marca** leva ao azul `#063c7c`.

Escolhemos o azul, por três razões:

1. O cinza `#454440` é o fundo **fotográfico** sobre o qual a peça foi
   composta — é cenário, não cor de marca. Reproduzi-lo em tela cheia entrega um
   cinza-lodo apagado, que contraria o "premium" do NFR de usabilidade.
2. Sobre um fundo igual ao seu, a moldura da logomarca perde a fronteira e a
   marca se dissolve no campo. O azul separa a peça do fundo sem competir com
   ela.
3. `#063c7c` tem luminância relativa **0,047**, o que dá contraste **10,8:1**
   com branco — folga confortável de AAA (WCAG exige 7:1). Qualquer texto branco
   que venha a ser posto sobre o fundo, hoje ou depois, já nasce acessível.

A cor é **constante de apresentação**, derivada da logomarca — não configuração
por implantação. A própria logomarca também não é configurável (é arquivo no
repositório); tornar o fundo variável por cliente introduziria uma chave de
configuração sem demanda e sem par visual.

### D2. O cartão permanece branco — e é isso que preserva o requisito da moldura

**Decisão:** o cartão de acesso continua branco, com a composição atual
(logomarca em moldura escura, heading, identificação do cliente, formulário).

Foi avaliada uma alternativa: cartão escuro ou translúcido sobre o azul, que
deixaria o `BrandMark` se fundir ao cartão em vez de aparecer como um retângulo
preto sobre branco. Recusada por dois motivos.

O primeiro é de spec: com cartão claro, a pilha visual continua sendo

```
fundo #063c7c → cartão BRANCO → moldura #141414 → logomarca
```

e a exigência "nunca solta sobre fundo claro" segue **literalmente satisfeita**,
sem exceção a abrir e sem delta no requisito de moldura. Um cartão escuro
tornaria a moldura redundante e obrigaria a reabrir aquele requisito para
descrever quando ela é dispensável — custo desproporcional ao ganho estético.

O segundo é de consistência: o restante da aplicação usa superfícies claras do
Ant Design. Um login em tema escuro seria a única tela com outra linguagem.

### D3. `colorPrimary` não muda nesta change

**Decisão:** o token `colorPrimary: '#1d4ed8'` de `app/theme.ts` permanece.

Consequência assumida, registrada para não ser lida depois como descuido: na
tela de login passam a conviver dois azuis, e o mais interno é o mais luminoso.

```
#063c7c  fundo    ██████  marinho profundo
#ffffff  cartão   ░░░░░░
#1d4ed8  "Entrar" ████    azul royal — mais claro que o fundo que o contém
```

Não é erro: dá destaque ao CTA, que é o único ato da tela. Alinhar `colorPrimary`
a um tom derivado de `#063c7c` afetaria botões, links, seleção e foco em
**todas** as telas da aplicação — decisão de escopo próprio, com regressão visual
ampla a validar. Fica registrada como mudança futura possível, não como pendência
desta change.

### D4. O fundo cobre o viewport, e o `body` não pode aparecer por baixo

**Decisão:** o fundo é aplicado de modo a cobrir a área visível integralmente,
com altura em unidade de viewport **dinâmica** (`100dvh`), e o elemento raiz do
documento não pode expor sua própria cor sob o container do login.

Hoje o container usa `minHeight: '100vh'`. Enquanto tudo é branco, os dois
defeitos abaixo existem mas são invisíveis. Com fundo colorido, aparecem:

1. **`100vh` em navegadores móveis** mede a altura do viewport **sem** descontar
   a barra de endereço retrátil. Ao rolar, a barra recolhe, o viewport cresce, e
   o container de `100vh` deixa de alcançar o fim da tela — surge uma faixa da
   cor do `body`. `100dvh` (viewport dinâmico) acompanha a mudança. Suporte:
   Safari iOS 15.4+, Chrome 108+ — abaixo disso o valor é ignorado e o
   comportamento degrada para o de hoje, o que torna seguro usá-lo sem
   *fallback* elaborado.
2. **Overscroll elástico** do iOS: ao puxar além do fim, o navegador revela a
   cor do elemento raiz, não a do container — mesmo com o container medindo
   certo. Pintar apenas a `<div>` do login deixa esse rastro branco.

A implementação escolhe **onde** pintar em função disso; o requisito de spec
descreve o efeito observável (cobertura integral, sem faixa de outra cor), não a
técnica, para não congelar a mecânica de CSS.

### D5. Cartão fluido, e o teclado virtual não é tratado com posicionamento fixo

**Decisão:** o cartão passa de `width: 360` para largura fluida com teto
(`width: '100%'`, `maxWidth: 360`), e o container garante respiro lateral por
padding próprio.

Em `375px` (iPhone SE, o menor alvo realista) um cartão de `360px` deixa 7,5px de
cada lado — visualmente encostado. Com o fundo branco isso passava despercebido;
com o fundo azul, a falta de margem fica evidente.

Sobre o teclado virtual: ao focar um campo, o teclado sobe e o viewport encolhe,
o que faz um container centralizado com `align-items: center` deslocar o cartão.
**Não** vamos tratar isso com `position: fixed`, `scroll-into-view` manual ou
`visualViewport` — todas as três trocam um desconforto por uma classe nova de
bugs. O padding vertical do container, combinado com `min-height` (em vez de
`height`), permite que o container cresça e a página role naturalmente quando o
conteúdo não couber, que é o comportamento que os navegadores já dão de graça.

## Riscos e verificação

- **A cor está correta?** Amostragem programática da arte, não estimativa
  visual: `#063c7c` é o pixel de maior componente azul relativo da imagem
  (`docs/images/logo_papel_hub.jpg`, 301×502). O valor entra no código com
  comentário citando essa origem, para que uma troca futura de logomarca
  encontre o rastro.
- **Contraste:** calculado, não presumido — 10,8:1 contra branco. O conteúdo do
  cartão não é afetado (permanece escuro sobre branco).
- **Verificação obrigatória em navegador real**, não só em jsdom: os dois
  defeitos de D4 são invisíveis em Testing Library, porque jsdom não tem
  viewport dinâmico nem overscroll. A conferência final exige Safari iOS (ou
  emulação com barra retrátil) e uma tela de 375px de largura.
