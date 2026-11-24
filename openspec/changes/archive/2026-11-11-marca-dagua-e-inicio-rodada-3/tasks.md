# Tasks

> Fatia **de apresentação**, só em `apps/web` e `docs/`. Não há tarefa de
> infraestrutura (Terraform/GCP) nem de paridade dev (SessionStart hook): nenhuma
> rota, prefixo, variável de ambiente, migration ou recurso de nuvem muda.

## 1. Marca d'água da área principal

- [x] 1.1 Componente `MarcaDaguaDaAreaPrincipal` (ao lado de
      `MarcaDaguaDaNavegacao.tsx`): contêiner `position: fixed` cobrindo só a
      área principal (abaixo do `Header`, à direita da navegação, cuja largura
      recebe do `AppShell`), `overflow: hidden`, `pointer-events: none`,
      `aria-hidden`; `<img alt="">` do símbolo à direita, centralizado na
      vertical, altura `min(70vh, 560px)`, parcialmente para fora; constantes
      `OPACIDADE_MARCA_DAGUA_AREA_PRINCIPAL = 0.06` e
      `COR_MAIS_ESCURA_DO_SIMBOLO = '#008C5A'`, com a tabela de design.md D1
      comentada (design.md D1). Verificar: teste afirma imagem sem nome
      acessível, `pointer-events: none` e opacidade 0,06.
- [x] 1.2 Montar o componente uma vez no `AppShell`, com `Content` em
      `position: relative; z-index: 1`, e `left` acompanhando navegação
      expandida, colapsada e modo estreito (0). Verificar: teste do shell
      encontra a marca d'água em duas rotas distintas (Início e Documentos) e
      `login.test.tsx` afirma que a tela de login não a tem.
- [x] 1.3 `contraste.test.ts`: para `textoApoio`, `texto`, `azulLink` e
      `verdeAcao`, apurar o contraste contra a mistura de
      `COR_MAIS_ESCURA_DO_SIMBOLO` com `superficie` na opacidade da constante e
      afirmar ≥ 4,5:1. Verificar: o teste falha se a opacidade subir para 0,10.

## 2. Tokens novos

- [x] 2.1 `theme.ts`: `paleta.vermelhoIndicador = '#CF1322'` (5,57:1 com branco,
      comentado com o 3,27:1 do padrão) e `tonsDeAtalho` (quatro matizes, `icone`
      e `fundo`, reaproveitando os tons apurados de `tonsDeTipoDocumental`)
      (design.md D3 e D7). Verificar: `contraste.test.ts` afirma branco sobre
      `vermelhoIndicador` ≥ 4,5:1, cada `icone` sobre o seu `fundo` ≥ 3:1 e
      `azulLink` sobre `tonsDeEstado.informativo.fundo` ≥ 4,5:1.

## 3. Tela Início: estrutura, atalhos e convite ao tour

- [x] 3.1 `InicioPage`: saudação, convite e atalhos em largura total, acima da
      divisão entre conteúdo principal (pastas e recentes) e coluna direita
      (design.md D2), mantendo os `data-tour`. Verificar:
      `tela-inicial.test.tsx` afirma que o contêiner dos atalhos não está dentro
      do conteúdo principal e que `tour-guiado.test.tsx` continua passando.
- [x] 3.2 Grade dos atalhos por container query: contêiner com
      `container-type: inline-size` e grade 1 → 2 → 4 colunas, com
      `LIMIAR_ATALHOS_DUAS_COLUNAS` e `LIMIAR_ATALHOS_QUATRO_COLUNAS` como
      constantes interpoladas em `ESTILO_GLOBAL` (design.md D3), no lugar de
      `Row`/`Col`. Verificar: teste afirma a classe do contêiner e os quatro
      cartões como filhos diretos da grade; o CSS gerado contém as duas regras
      `@container`.
- [x] 3.3 `atalhos.ts`: descrições de design.md D4 e cores de `tonsDeAtalho`
      (ícone no quadrado tingido do próprio tom). Verificar:
      `tela-inicial.test.tsx` afirma as quatro descrições e que a do atalho de
      busca não contém "conteúdo".
- [x] 3.4 Medir na app com Playwright (`npm run dev:api` + `npm run dev:web`), com
      manual configurado, em 1366, 1280, 1024 e 992 px de largura, navegação
      expandida e colapsada, e em 375 px: número de colunas dos atalhos e
      nenhum rótulo/descrição com `scrollWidth > clientWidth`; ajustar os
      limiares pela medição. Verificar: tabela de medição registrada no fim
      deste arquivo; em 1366×768 expandida, quatro atalhos numa linha.
- [x] 3.5 Convite ao tour como cápsula (design.md D5): ícone novo
      `IconeIniciarTour` (lucide `CirclePlay`) no módulo único de ícones, fundo e
      borda informativos, texto `azulLink` 600, altura mínima 44 px, linha da
      saudação alinhada ao centro. Verificar: `tela-inicial.test.tsx` afirma o
      link com nome acessível igual ao texto, o ícone `aria-hidden` e o destino
      do pedido de tour; `tour-guiado.test.tsx` passa.

## 4. Busca com a altura do botão de envio

- [x] 4.1 Antes de mexer, medir na app (Playwright, 1366 px) a altura da caixa
      do campo de busca e do botão "Enviar documento" e registrar os dois
      números no fim deste arquivo. Verificar: números registrados.
- [x] 4.2 `BuscaNoCabecalho`: caixa com `paddingBlock: 0` e altura
      `ALTURA_MINIMA_ACIONAMENTO`; acionador interno com 44 px sobre a borda
      (`marginBlock: -1`), encostado à direita (design.md D6), comentário da
      medição atualizado. Verificar: `shell-identidade-e-busca.test.tsx` afirma
      a altura declarada do campo e do acionador iguais a
      `ALTURA_MINIMA_ACIONAMENTO`, e que o acionamento por Enter e pelo
      acionador continua navegando para `/busca?q=…`.
- [x] 4.3 Medir de novo em 1366 e em 375 px: altura do campo igual à do botão de
      envio (± 0,5 px) e acionador com ≥ 44 px de altura; inspecionar por captura
      de tela o foco e o realce do acionador. Verificar: números e capturas
      registrados no fim deste arquivo.

## 5. Sino com indicador vermelho

- [x] 5.1 `NotificationCenter`: `Badge` com `color={paleta.vermelhoIndicador}`;
      nome acessível do botão `Notificações, N não lidas` (singular para 1;
      `Notificações` sem não lidas); número visual do indicador fora da árvore
      acessível (design.md D7). Verificar: `notificacoes.test.tsx` afirma o nome
      do botão com 0, 1 e 3 não lidas e que o número não é anunciado fora do
      botão.

## 6. Documentos recentes

- [x] 6.1 `tituloDoDocumento(fileName, documentCode)` em
      `shell/document-control-labels.ts` (design.md D9). Verificar: teste
      unitário cobre os cinco cenários do requisito "Linha de recentes destaca o
      título do documento" (código + separador, sem prefixo, prefixo diferente,
      nome igual ao código, sem código) e nomes sem extensão ou com ponto no
      meio.
- [x] 6.2 `TabelaDeRecentes`: título em negrito no link do visualizador, com
      `title` e `aria-label` iguais ao `fileName`, código embaixo. Verificar:
      `tela-inicial.test.tsx` encontra o botão pelo nome do arquivo, vê o título
      limpo como texto e, ao acionar, abre o visualizador.
- [x] 6.3 `RotuloDeTipoDocumental`: sigla em peso 600, `min-width` fixo
      (`LARGURA_ROTULO_DE_TIPO`) e centralizada (design.md D8). Verificar: teste
      afirma o `min-width` e o `title` com o nome completo do tipo; na app, a
      coluna Tipo do explorador em 1366 px não gera rolagem horizontal.

## 7. Rótulo de grupo no colapsado

- [x] 7.1 `AppShell`, `navegacao()`: no colapsado, rótulo de grupo visualmente
      oculto (texto preservado para tecnologia assistiva) e traço de separação
      via `ESTILO_GLOBAL` (design.md D10). Verificar:
      `shell-identidade-visual.test.tsx` colapsa a navegação e encontra os grupos
      pelo nome acessível NAVEGAÇÃO e AJUDA; na app, nenhum rótulo de grupo com
      reticência no colapsado e o orçamento da fatia A em 1366×768 expandido
      permanece sem rolagem.

## 8. Manual do usuário

- [x] 8.1 `docs/manual/docs/a-tela.md`: marca d'água à direita da área principal
      (decorativa), atalhos numa linha com as novas descrições, convite ao tour
      em destaque azul com ícone de play, número do sino em vermelho, título do
      documento sem código e sem extensão nos recentes (nome completo ao apontar).
      Verificar: `grep -n "Encontrar por nome, tipo" docs/manual/docs` não
      encontra a descrição antiga; o texto descreve só o que a tela entrega.

## 9. Verificação integrada

- [x] 9.1 Percorrer a tela Início só pelo teclado: convite, quatro atalhos,
      pastas, recentes, coluna direita, sino e busca com anel de foco visível.
      Verificar: inspeção por captura de tela de cada foco.
- [x] 9.2 Rodar `npm run lint`, `npm run format:check`, `npm run build` e
      `npm run test`. Verificar: os quatro passam.

### Resultado das medições (3.4, 4.1, 4.3, 6.3, 7.1, 9.1)

Playwright no Chromium, `npm run dev:api` + `npm run dev:web`, manual
configurado, `admin.a@gdoc.dev` (e `global_admin` para o orçamento do menu).

**Atalhos (3.4).** Descrição mais longa ("Arraste ou selecione o arquivo"):
176 px; cartão mínimo = 176 + 24 + 2 = **202 px**. Limiares finais:
**440 px** (2 colunas) e **880 px** (4 colunas). Com o ícone **ao lado** do texto
(desenho anterior) a descrição quebrava em 1366 px; o cartão passou a ter o
ícone **acima** do texto, como no mockup (design.md D3, ajustado).

| Janela | Navegação | Área dos atalhos | Linhas | Cartão | Rótulo/descrição cortados | Rolagem horizontal |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1366 | expandida | 1054 | 1 (4 col.) | 252 | nenhum | não |
| 1366 | colapsada | 1238 | 1 (4 col.) | 298 | nenhum | não |
| 1280 | expandida | 968 | 1 (4 col.) | 230 | nenhum | não |
| 1100 | expandida | 788 | 2 | 386 | nenhum | não |
| 1100 | colapsada | 972 | 1 (4 col.) | 231 | nenhum | não |
| 1024 | expandida | 712 | 2 | 348 | nenhum | não |
| 1024 | colapsada | 896 | 1 (4 col.) | 212 | nenhum | não |
| 992 | expandida | 680 | 2 | 332 | nenhum | não |
| 992 | colapsada | 864 | 2 | 424 | nenhum | não |
| 700 | painel | 676 | 2 | 330 | nenhum | não |
| 375 | painel | 351 | 4 (1 col.) | 351 | nenhum | não |

**Busca (4.1 → 4.3).** Antes: campo **66 px**, botão "Enviar documento" 44 px.
Depois: campo **44 px**, acionador interno **44×44**, botão 44 px — em 1366 e
em 375 px. Anel de foco do acionador visível (contorno de 3 px) e o da caixa
segue o realce de borda do design system.

**Explorador (6.3).** 1366×768, coluna Tipo com a etiqueta uniforme: sem rolagem
horizontal do documento.

**Menu (7.1).** `global_admin`, 1366×768: lista 582/582 px, sem rolagem, antes e
depois de colapsar e expandir — o orçamento da fatia A não mudou. Colapsada:
nenhum rótulo de grupo com reticência; o traço separa os grupos.

**Teclado (9.1).** Ordem e foco visível (contorno de 3 px) em: campo de busca,
acionador, Enviar documento, sino, Ajuda, convite ao tour (cápsula), os quatro
atalhos, Ver todas as pastas e Ver histórico completo.

## Workflow follow-up

- Atualizar a linha da fatia **B** em `docs/plano_demanda_cliente_3.md`
  (→ `entregue`, com o change arquivado), registrando as medições de 3.4, 4.1 e
  4.3, os limiares finais da grade e o desvio "FOR × FRM" do mockup.
- Arquivar com `/opsx:archive` após `/opsx:verify`.
