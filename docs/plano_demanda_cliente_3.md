# Plano de implementação — Demanda do cliente nº 3

Plano de execução de `docs/demanda_cliente_3.md` (PapelHub — ajustes da 1ª
versão: identidade ISETES, menu sem rolagem, tela Início e documentos
recentes). Mesmo papel de `docs/plano_demanda_cliente_2.md`: **catalogar as
fatias e guardar o estado em disco**, para que a implementação não dependa de
nenhuma janela de conversa.

> **O plano é o arquivo, não o chat.** Tudo o que é preciso para retomar está
> aqui, em `docs/demanda_cliente_3.md`, em `openspec/` e no histórico do git.

---

## Como retomar (protocolo de cada sessão)

1. **Situar-se**: `openspec list` (há change em voo?) e
   `ls openspec/changes/archive/ | tail -10`.
2. **Escolher a fatia**: na [tabela de status](#status-das-fatias), a primeira
   linha que não está `entregue` e cujas dependências estão satisfeitas.
3. **Carregar o contexto da fatia**, nesta ordem:
   - a seção da fatia neste documento;
   - os itens correspondentes de `docs/demanda_cliente_3.md` e a imagem de
     referência `docs/images/demanda_3/PapelHub_tela_inicial_numerado_ajustes.webp`;
   - a US indicada em `docs/prd_final.md`;
   - as specs de `openspec/specs/` que a fatia altera.
4. **Propor e implementar**: `/opsx:propose`, `/opsx:apply`, `/opsx:verify`,
   `/opsx:archive`.
5. **Fechar o ciclo no mesmo commit da fatia**: atualizar a linha da fatia
   (→ `entregue`, com o change arquivado), registrar lacunas e decisões novas,
   atualizar a página correspondente de `docs/manual/`.

---

## Status das fatias

Legenda: `pendente` · `proposta` · `em andamento` · `entregue`.

| # | Fatia | Itens da demanda | Situação | Depende de | Change |
| :-- | :--- | :--- | :--- | :--- | :--- |
| A | Identidade ISETES e menu compacto | 1, 2, 3, 4 | **entregue** | — | `identidade-isetes-e-menu-compacto` |
| B | Marca d'água e Início (rodada 3) | 5, 6, 8, 9, 10, 11, 12 | **entregue** | A (ativo do símbolo) | `marca-dagua-e-inicio-rodada-3` |
| C | Contagem de documentos nas pastas | 7 | **entregue** | — | `contagem-de-documentos-nas-pastas` |

Ordem sugerida: **A → B → C**. B só depende de A pelo ativo do símbolo em
`apps/web/public/` e por mexer no mesmo `AppShell.tsx` (A no `Sider`, B no
`Content`) — fazê-las em sequência evita conflito. C é independente e é a
única fatia com backend.

**Fora do código:** a grafia "Perfomance" (item 4) **não está no código nem no
seed** — é o cargo (`job_title`) da conta da Mariana em produção. Corrige-se
pela tela Colaboradores (edição de pessoa), por um administrador. Registrar
aqui quando for feito: _pendente_.

---

## Fatia A — Identidade ISETES e menu compacto

**Itens:** 1, 2, 3, 4. **Specs:** `identidade-visual`, `web-shell-e-auth`,
`sistema-de-design` (consulta).

**Diagnóstico.** Os itens Leitura obrigatória, Lixeira e o grupo AJUDA **já
existem** no código (`AppShell.tsx`); o cliente não os vê porque ficam abaixo
da dobra — o `Menu` rola (`overflowY: 'auto'`). O "incluir" do item 2 é sintoma
da rolagem. (Conferir também `APP_MANUAL_URL` em produção: sem ele o item
Manual do usuário não aparece.)

**Orçamento de altura (viewport de 768 px, todos os papéis):**

```
                         hoje     alvo
marca (logo + texto)     ~190     ~110   logo horizontal de 150 px de largura
rótulo NAVEGAÇÃO           32       32
itens (admin global: 10)  480      440   44 px, sem margem entre itens
rótulo AJUDA + 2 itens    128      120
cartão do usuário        ~130      ~64   uma linha + Sair em ícone
gatilho de recolher        64        0   sai do rodapé, vai para o topo
──────────────────────────────────────
admin global            ~1024     ~766
```

O mínimo de 44 px de acionamento (`sistema-de-design`) **não é relaxado**.
Abaixo de 768 px de altura visível, a rolagem do menu volta como último
recurso — nunca escondendo o rodapé.

**Entrega:** ativos novos em `apps/web/public/` (logo branca, logo colorida,
símbolo) no lugar de `logo-papelhub.jpg`; marca horizontal sem moldura
escura; símbolo no estado colapsado; gatilho de recolher no topo da
navegação; itens compactos; cartão do usuário compacto; marca d'água do
símbolo no pé do menu com contraste recalculado; login e favicon com a nova
identidade.

**Riscos:** contraste do texto sobre a marca d'água (o símbolo claro clareia o
fundo escuro); a demanda nº 2 pedia 200 px a 14% e esta pede "bem clarinho" —
valor final decidido por cálculo no design.md.

**Entregue** (change arquivado em
`openspec/changes/archive/2026-11-10-identidade-isetes-e-menu-compacto/`).
Desvios e registros:

- **Medição em 1366×768** (`global_admin`, 12 itens, manual configurado, função
  longa): lista do menu com 576 px num espaço de 582 px — sem rolagem, folga de
  **6 px**. `collaborator`: 582/582. Em 1366×600 só a lista rola, com marca e
  cartão visíveis.
- **Restrição conhecida:** um item de menu a mais para administradores estoura
  o orçamento de 768 px. Qualquer fatia que acrescente item precisa refazer a
  medição (ver alavancas em design.md D1 do change).
- **Cartão do usuário:** função e unidade ficaram em **linhas próprias** (o
  plano era juntá-las com corte em 2 linhas) — com a função longa do caso real a
  unidade caía na reticência.
- **Marca d'água a 8%**, não os 14% da demanda nº 2: 14% reprova o piso de
  contraste (4,35:1); teste em `contraste.test.ts`.
- **Para a fatia B:** com a navegação colapsada, os rótulos de grupo aparecem
  cortados ("NAVEGAÇ…") — comportamento anterior a este change.

## Fatia B — Marca d'água e Início (rodada 3)

**Itens:** 5, 6, 8, 9, 10, 11, 12. **Specs:** `tela-inicial`,
`web-shell-e-auth`, `sistema-de-design`.

- **5** Marca d'água do símbolo à direita do `Content`, 6%, **em todas as
  telas**, decorativa (`aria-hidden`, sem captura de ponteiro).
- **6** Atalhos em grade de 4 colunas decidida pela **largura do contêiner**
  (container query), não da janela — a coluna da direita (Leitura
  obrigatória/Avisos) divide o espaço; descrições curtas do mockup; ícone em
  quadrado tingido.
- **8** Convite ao tour como cápsula azul-clara com ícone de play.
- **9** Altura da busca — **medir na app antes de mexer**: busca e botão já
  usam `controlHeight` 44.
- **10** O `Badge` do sino já é vermelho, mas o padrão (`#ff4d4f`) com número
  branco mede ~3,0:1, abaixo do piso de 4,5:1 — criar token de vermelho com
  contraste apurado.
- **11** Etiqueta de tipo no estilo do mockup (o componente
  `RotuloDeTipoDocumental` já existe).
- **12** Título limpo (sem extensão e sem o prefixo igual ao `documentCode`),
  em negrito, código embaixo; nome do arquivo íntegro no nome acessível.

**Entregue** (change arquivado em
`openspec/changes/archive/2026-11-11-marca-dagua-e-inicio-rodada-3/`).
Desvios e registros:

- **Busca (item 9), medida antes de mexer:** o campo tinha **66 px** contra os
  44 do botão — o acionador interno herdava o piso de 44 px e a caixa somava o
  preenchimento. Agora 44 px, com o acionador mantendo 44×44 sobre a borda.
- **Atalhos (item 6):** saudação, convite e atalhos passaram a ocupar a largura
  inteira, acima da divisão com a coluna direita (como no mockup). Grade por
  container query com limiares **medidos**: 4 colunas a partir de 880 px de
  área, 2 a partir de 440. O ícone foi para **acima** do texto — ao lado, a
  descrição quebrava em 1366 px.
- **Descrições fiéis:** "Por nome ou código" (o mockup prometia busca no
  conteúdo, que não existe) e "Passo a passo de cada tela" (o manual não tem
  imagens).
- ~~**Etiqueta de tipo (item 11):** o mockup escreve "FOR"; a sigla do
  formulário continua **FRM**, da Matriz do cliente.~~ **Corrigido após retorno
  do cliente (2026-11-13):** na Matriz de Documentos do cliente a sigla é
  **FOR** (e **CHK** para checklist); a interface passou a apresentar **FOR**.
  Em seguida o cliente pediu o **checklist como tipo próprio (CHK)**: entregue
  pelo change `tipo-checklist` (ver `openspec/changes/archive/*-tipo-checklist/`).
  Formulário (`FOR`) e Checklist (`CHK`) são tipos distintos; o acervo já
  gravado como formulário não é reclassificado automaticamente. O cadastro em
  lote sugere Checklist para `CHK` e Formulário para `FOR` e `FRM`.
- **Sigla do termo de consentimento (retorno do cliente, 2026-11-13):** a
  etiqueta passou de **TCO** para **TC**, como o cliente escreve na tabela 2.2
  da demanda nº 2. O cadastro em lote reconhece `TC` e, por compatibilidade,
  `TCO`.
- **Marca d'água a 6%** atrás do conteúdo, com os cartões opacos — não
  atravessa o cartão de Avisos como o mockup insinua. 10% reprovaria o verde de
  ação como texto (4,39:1).
- **Sino (item 10):** `#CF1322` (5,57:1 com o número branco).
- **Menu colapsado:** rótulos de grupo viraram traço (pendência da fatia A); o
  orçamento de 768 px segue em 582/582 px para `global_admin`.
- **Validado com o cliente (2026-11-13):** de acordo com os textos dos atalhos
  ("Por nome ou código", "Passo a passo de cada tela") e com a marca d'água
  mais clara (6%) e por trás dos cartões opacos. Do item 7, de acordo com o
  número de documentos **só nos cartões de pasta da tela Início** (o explorador
  `/pastas` não mostra a contagem).

## Fatia C — Contagem de documentos nas pastas

**Item:** 7. **Specs:** `navegacao`/`web-navegacao`, `tela-inicial`.

`FolderResponse` não traz contagem. Exige `documentCount` na listagem da raiz,
**filtrado pelo acesso de quem consulta** (dono, admin da unidade do recurso ou
grant vigente de `view`), só filhos diretos, fora da lixeira — sem herança,
fail-closed, como `apps/api/src/lib/access.ts`. Uma contagem não filtrada
revelaria a existência de itens sem permissão. Teste junto dos de isolamento.
Front: "N documentos" no cartão e ícone tingido.

**Entregue** (change arquivado em
`openspec/changes/archive/2026-11-11-contagem-de-documentos-nas-pastas/`).
Desvios e registros:

- **Contagem nas duas rotas de conteúdo** (raiz e `/folders/:id/contents`),
  não só na raiz: `listContents` é comum, e o custo é uma consulta agregada
  indexada. A tabela do explorador não mostra o número.
- **Mesmo recorte da listagem, por construção:** os fragmentos SQL são os da
  consulta de arquivos; o teste afirma `documentCount(X)` igual ao número de
  arquivos de `GET /folders/X/contents` para dono, admin da unidade,
  colaborador com concessões parciais, quem enviou o pendente e admin global.
  Os casos de não vazamento ficaram num arquivo próprio,
  `apps/api/src/__tests__/contagem-documentos-pastas.test.ts`, em vez de
  espalhados por `isolamento-unidade`/`expiracao-permissoes-acesso`.
- **`documentCount` opcional no contrato** (`FolderListItemResponse`), como
  `favoriteFolderIds`: API anterior não o envia, e a SPA omite a linha em vez
  de mostrar zero.
- ~~**Pendência a validar com o cliente:** a contagem é de documentos
  **diretos**; uma pasta que só tem subpastas mostra "Nenhum documento".~~
  **Resolvida:** o cliente pediu a soma de tudo o que está dentro da pasta,
  incluindo subpastas, contando só o que a pessoa pode abrir; subpasta sem
  acesso fica fora da conta com toda a descendência. Entregue pelo change
  `contagem-de-documentos-na-subarvore` (ver
  `openspec/changes/archive/*-contagem-de-documentos-na-subarvore/`).
