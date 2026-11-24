# Proposal

## Why

Na 3ª rodada de ajustes (`docs/demanda_cliente_3.md`, itens 5, 6, 8, 9, 10, 11
e 12; fatia **B** de `docs/plano_demanda_cliente_3.md`) o cliente aponta, na
imagem de referência `docs/images/demanda_3/PapelHub_tela_inicial_numerado_ajustes.webp`,
o que ainda separa a área principal e a tela Início do mockup: falta o símbolo
do ISETES como marca d'água à direita; os quatro atalhos quebram em duas linhas
e têm descrições longas; o convite ao tour é um link solto; a busca parece mais
alta que o botão de envio; o número do sino não se destaca; a etiqueta de tipo e
o título dos documentos recentes não seguem o mockup.

O momento é este porque a fatia **A** (`identidade-isetes-e-menu-compacto`,
arquivada em 2026-11-10) já trouxe o símbolo para `apps/web/public/` e mexeu no
`Sider` do `AppShell.tsx`; esta fatia mexe no `Content` e na barra superior do
mesmo arquivo, e fazê-las em sequência evita conflito.

A fatia é de **apresentação**: nenhuma regra de permissão, alcance de dados,
rota da API ou tráfego de bytes muda. PRD: US 11.1 (tela inicial), US 11.2
(documentos recentes) e US 11.3 (tour); as US são referenciadas pelas specs, não
reescritas.

## What Changes

**Área principal (itens 5, 9 e 10)**

- **Marca d'água** do símbolo do ISETES no **lado direito da área principal**,
  em **6%** de opacidade, em **todas as telas autenticadas** (decisão do
  cliente), puramente decorativa: sem anúncio por tecnologia assistiva, sem
  capturar acionamento, sem gerar rolagem e sem baixar o contraste de nenhum
  texto abaixo do piso de 4,5:1, apurado por cálculo.
- **Busca com a altura do botão de envio:** a medição do código mostra que o
  campo hoje é **mais alto** que o botão — o acionador interno herda o piso de
  44 px (`controlHeightSM`) e soma o preenchimento da caixa. O campo passa a ter
  a mesma altura do botão "Enviar documento", sem que o acionador interno perca a
  área mínima de acionamento.
- **Sino com o número de avisos não lidos em vermelho**, com um tom de vermelho
  que sustente o número branco a ≥ 4,5:1 — o vermelho padrão do design system
  mede 3,27:1.

**Tela Início (itens 6, 8, 11 e 12)**

- **Atalhos numa linha só**, em quatro colunas, quando o **espaço da própria
  área de conteúdo** comporta — e não a largura da janela, porque a coluna de
  Leitura obrigatória/Avisos divide o espaço. Descrições curtas, do mockup, fiéis
  ao que o produto faz (a busca não alcança o conteúdo dos arquivos, então a
  descrição não o promete). Ícone em quadrado tingido do próprio tom.
- **Convite ao tour** como cápsula azul-clara com ícone de play, mantendo-se link
  com o mesmo destino, nome acessível e regra de exibição.
- **Etiqueta de tipo** no estilo do mockup: sigla em negrito, fundo tingido do
  tom do tipo, largura uniforme na coluna. A sigla continua sendo a portadora da
  informação; a cor, redundância.
- **Título limpo** na lista de recentes: nome do documento sem a extensão do
  arquivo e sem o prefixo igual ao código, em negrito, com o código embaixo. O
  nome do arquivo íntegro continua disponível no nome acessível e na dica.

**Arremate da fatia A**

- Com a navegação **colapsada**, os rótulos de grupo (NAVEGAÇÃO, AJUDA) aparecem
  cortados ("NAVEGAÇ…"). No colapsado, o rótulo dá lugar a um separador visual e
  continua nomeando o grupo para tecnologia assistiva.

**Fora de escopo**

- **Item 7** (ícone colorido e nº de documentos nas pastas): é a fatia **C**,
  a única com backend — exige contagem filtrada por acesso.
- **Item 13** (acompanhamento por unidade): Fase 2, por decisão do cliente.
- Marca d'água atravessando os cartões, como insinua o mockup: os cartões
  continuam opacos (ver design.md D1). Revisitar só se o cliente pedir.
- Um campo próprio de **título** do documento nos dados de controle: o título
  limpo é derivado do nome do arquivo na apresentação; um título cadastrado é
  mudança futura de `controle-documental`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `identidade-visual`: requisito novo da marca d'água do símbolo na área
  principal, em todas as telas autenticadas, decorativa e com contraste apurado.
- `tela-inicial`: atalhos numa linha de quatro decidida pelo espaço do conteúdo,
  com descrições curtas fiéis; convite ao tour como cápsula com ícone; linha de
  recentes com título limpo em destaque e etiqueta de tipo de largura uniforme.
- `web-busca`: o campo de busca do cabeçalho tem a mesma altura da ação de envio,
  sem reduzir a área de acionamento do acionador interno.
- `web-shell-e-auth`: o número de não lidas do sino é apresentado em vermelho com
  contraste apurado; com a navegação colapsada, o rótulo de grupo não aparece
  cortado.

## Impact

- **Web**: `apps/web/src/shell/AppShell.tsx` (hospedagem da marca d'água no
  `Content`; rótulo de grupo no colapsado), componente novo da marca d'água da
  área principal (ao lado de `MarcaDaguaDaNavegacao.tsx`),
  `BuscaNoCabecalho.tsx`, `NotificationCenter.tsx`, `apps/web/src/app/theme.ts`
  (token de vermelho de aviso, opacidade apurada, regras de grade no
  `ESTILO_GLOBAL`), `RotuloDeTipoDocumental.tsx`, `apps/web/src/inicio/`
  (`InicioPage.tsx`, `atalhos.ts`, `TabelaDeRecentes.tsx`, função pura do título
  limpo).
- **Testes**: `contraste.test.ts` (vermelho do sino, marca d'água sobre fundo
  claro), `tela-inicial.test.tsx`, `shell-identidade-visual.test.tsx`,
  `shell-identidade-e-busca.test.tsx`, `notificacoes.test.tsx`, teste unitário do
  título limpo; medições com Playwright na app.
- **Manual**: `docs/manual/docs/a-tela.md` (marca d'água, atalhos, convite ao
  tour, sino, documentos recentes).
- **API, banco, infraestrutura**: nenhum impacto.
