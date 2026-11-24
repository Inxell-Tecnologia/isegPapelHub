# Tasks

> Fatia **de apresentação**, só em `apps/web` e `docs/`. Não há tarefa de
> infraestrutura (Terraform/GCP) nem de paridade dev (SessionStart hook): nenhuma
> rota, variável de ambiente, migration ou recurso de nuvem muda.

## 1. Ativos da marca

- [x] 1.1 Copiar para `apps/web/public/` a logo branca, a logo colorida e o
      símbolo de `docs/images/demanda_3/`, redimensionados para 2× a maior
      medida exibida (design.md D3): `isetes-logo-branca.png` e
      `isetes-logo-cor.png` com 300 px de largura, `isetes-simbolo.png` com
      400 px de altura, mantendo a transparência. Verificar: `file` reporta
      RGBA e as dimensões esperadas.
- [x] 1.2 Regerar `apps/web/public/favicon.png` (64×64) com o símbolo centralizado
      em fundo transparente, com margem lateral, sem recorte nem estiramento
      (design.md D7). Verificar: abrir o PNG e conferir a proporção do símbolo.
- [x] 1.3 Remover `apps/web/public/logo-papelhub.jpg` e qualquer referência a
      ele. Verificar: `grep -rn "logo-papelhub" apps/web` não encontra nada.

## 2. Marca do produto

- [x] 2.1 Reescrever `BrandMark` sem moldura e sem a proporção retrato:
      variante `logo` | `simbolo`, altura dada e largura derivada da proporção
      do ativo; o caminho do ativo e o `alt` de cada variante declarados juntos
      no mesmo módulo (design.md D3). Verificar: teste unitário renderiza as
      duas variantes com o `src` e as dimensões esperadas.
- [x] 2.2 `MarcaDoProduto`: logo branca a 150 px de largura e, logo abaixo, a
      linha "PapelHub · Gestão de Documentos" em texto, sem a linha da
      identificação do cliente; logo com `alt="Instituto SETES"`. Verificar:
      `shell-identidade-visual.test.tsx` reescrito afirma o nome do produto
      anunciado uma única vez, a logo anunciada como "Instituto SETES" e
      a ausência de "SETES" em texto na marca com `clientName` configurado.
- [x] 2.3 Estado colapsado: o símbolo (~40 px de altura) com `alt="PapelHub"` no
      lugar do texto "PH". Verificar: teste colapsa a navegação e encontra a
      imagem com nome acessível PapelHub, sem descritor nem identificação.
- [x] 2.4 `LoginPage`: a logo branca, decorativa, no campo escuro, sem moldura.
      Verificar: `login.test.tsx` atualizado — logo presente, sem nome
      acessível, heading com nome acessível "PapelHub" puro.

## 3. Navegação sem rolagem

- [x] 3.1 `theme.ts`, token `Menu`: margem vertical de item 0 mantendo
      `itemHeight` = 44; rótulo de grupo em `TAMANHO_MINIMO_TEXTO`, altura de
      linha 16 e preenchimento vertical de 4 px (design.md D1), com o
      orçamento de altura comentado junto. Verificar: teste afirma que
      `itemHeight` continua igual a `ALTURA_MINIMA_ACIONAMENTO`.
- [x] 3.2 `AppShell`: `Sider` com `trigger={null}` e botão próprio de
      recolher/expandir no topo da navegação (44 px, `aria-label` "Recolher
      navegação" / "Expandir navegação"); remover `ALTURA_GATILHO_RECOLHER` e a
      reserva de `paddingBottom`; o `Drawer` não exibe o botão (design.md D4).
      Verificar: teste aciona o botão pelo nome acessível, a navegação colapsa
      e o mesmo botão passa a se chamar "Expandir navegação"; no modo estreito
      o botão não existe.
- [x] 3.3 Manter `overflowY: 'auto'` só na lista do `Menu`, com marca e cartão
      fora da área rolável (design.md D2), e atualizar o comentário que explica
      a rolagem como último recurso. Verificar: teste confirma que marca e
      cartão não são descendentes do contêiner rolável.

## 4. Cartão do usuário compacto

- [x] 4.1 `CartaoDoUsuario` em uma linha: avatar de 32 px, nome, função e
      unidade em linhas próprias (texto íntegro no `title` e no nome
      acessível — ajuste registrado em design.md D5) e **Sair** como botão de ícone 44×44 com `aria-label="Sair"` e
      dica, irmão do link de Minha conta (design.md D5); atualizar o comentário
      do componente. Verificar: `shell-identidade-e-busca.test.tsx` encontra o
      botão "Sair" fora do link "Minha conta", e acioná-lo encerra a sessão.

## 5. Marca d'água da navegação

- [x] 5.1 Componente decorativo da marca d'água: símbolo de ~200 px de altura no
      pé da coluna, `opacity` 0,08 em constante com a tabela de contraste do
      design.md D6 comentada, `aria-hidden`, `alt=""`, `pointer-events: none`,
      atrás do `Menu` e do cartão; omitido no colapsado. Verificar: teste afirma
      que a imagem não tem nome acessível, que o estilo tem
      `pointer-events: none` e que não é renderizada com a navegação colapsada.
- [x] 5.2 Teste do contraste: calcular, a partir das constantes de `theme.ts` e
      da opacidade da marca d'água, a razão de `textoSobreEscuro` sobre a
      mistura de `#00DE89` com `marinhoClaro`, e afirmar ≥ 4,5:1, no mesmo
      molde dos testes de contraste existentes. Verificar: o teste falha se a
      opacidade subir para 0,14.

## 6. Manual do usuário

- [x] 6.1 `docs/manual/docs/a-tela.md`: marca com a logo do Instituto SETES,
      controle de recolher no topo do menu, cartão do usuário com Sair em ícone,
      marca d'água; `docs/manual/docs/primeiro-acesso.md`: onde fica o Sair e a
      logo do login. Verificar: `grep -n "pé da coluna\|logo abaixo dele fica o
      botão" docs/manual/docs` não encontra o texto antigo.
- [x] 6.2 Logo do site do manual: substituir `docs/manual/docs/assets/logo-papelhub.png`
      pelo símbolo e ajustar `logo`/`favicon` em `docs/manual/mkdocs.yml`.
      Verificar: `grep -n "logo" docs/manual/mkdocs.yml` aponta para o ativo novo.

## 7. Verificação na app

- [x] 7.1 Subir a app (`npm run dev:api` + `npm run dev:web`) e medir com
      Playwright, em viewport **1366×768**, logado como `global_admin` numa
      implantação com `APP_MANUAL_URL` configurado e função longa: a lista do
      `Menu` tem `scrollHeight ≤ clientHeight`, e marca, os 12 itens e o cartão
      estão dentro da viewport. Repetir como `collaborator`. Se estourar, aplicar
      as alavancas na ordem de design.md D1, nunca a altura do item. Verificar:
      números registrados no fechamento das tarefas.
- [x] 7.2 Em viewport **1366×600**, confirmar que só a lista rola, com marca e
      cartão visíveis. Verificar: `getBoundingClientRect()` de marca e cartão
      dentro da viewport.
- [x] 7.3 Nenhum rótulo de item truncado em 264 px, inclusive "Compartilhados
      comigo" e "Leitura obrigatória" com contador. Verificar: nenhum rótulo com
      `scrollWidth > clientWidth`.
- [x] 7.4 Percorrer o shell só pelo teclado: botão de recolher no topo, itens
      dos dois grupos, link de Minha conta e Sair com anel de foco visível.
      Verificar: inspeção por captura de tela de cada foco.
- [x] 7.5 Rodar `npm run lint`, `npm run format:check`, `npm run build` e
      `npm run test`. Verificar: os quatro passam.

### Resultado da medição (7.1–7.3)

| Cenário | Lista do menu (scroll / visível) | Cartão (base) | Rótulos truncados |
| :-- | :-- | :-- | :-- |
| `global_admin`, 12 itens, manual, função longa — 1366×768 | 576 / 582 px — sem rolagem | 758 px | nenhum |
| `collaborator`, 9 itens — 1366×768 | 582 / 582 px — sem rolagem | 758 px | nenhum |
| `global_admin` — 1366×600 | 576 / 414 px — só a lista rola | 590 px (visível) | nenhum |

Item 44 px com passo de 44 px; rótulos de grupo 24 px; marca 109 px; Sair
44×44. Folga do pior caso: **6 px**.

## Workflow follow-up

- Atualizar a linha da fatia **A** em `docs/plano_demanda_cliente_3.md`
  (→ `entregue`, com o change arquivado) e registrar os números da medição 7.1
  e a restrição conhecida: um item de menu a mais para administradores estoura
  o orçamento de 768 px.
- Ao arquivar (`/opsx:archive`), atualizar à mão o **Purpose** de
  `openspec/specs/identidade-visual/spec.md`, que ainda descreve a moldura
  escura obrigatória.
- A correção de "Perfomance" no cadastro de produção é feita por um
  administrador, pela tela Colaboradores, e registrada no plano.
