# Proposal — responsividade-mobile-tablet

## Why

A SPA nunca foi construída para telas estreitas. O levantamento é objetivo:

```
@media            → 0 ocorrências em apps/web/src
useBreakpoint     → 0 ocorrências (só um mock de matchMedia em setup.ts)
grid responsivo   → 0 (os únicos <Col> são span={6} fixo)
scroll={{ x }}    → 0, em 6 tabelas
arquivos .css     → 0 (todo estilo é token do design system ou inline)
```

O único acerto pré-existente é o `<meta name="viewport">` de
`apps/web/index.html`. Não se trata de **melhorar** a responsividade — trata-se
de **introduzi-la**.

Na prática, num aparelho de 360px: a navegação lateral consome 200px dos 360
disponíveis; a coluna de ações do explorador soma seis botões rotulados
(`Visualizar`, `Baixar`, `Renomear`, `Permissões`, `Auditoria`, `Excluir`) que
não cabem em largura nenhuma de celular; e seis tabelas sem rolagem própria
estouram o documento, produzindo rolagem horizontal da página inteira.

O PRD (`docs/prd_final.md`) **não** traz NFR de responsividade — o alvo desta
change é decisão de produto tomada agora, não requisito recuperado. O alvo é
**consulta**: navegar pastas, visualizar arquivo e buscar precisam funcionar bem
no celular e no tablet. As demais telas não precisam de layout repensado, mas
precisam parar de quebrar.

## What Changes

- **Ponto de ruptura único em 992px (`lg` do design system)** — abaixo dele a
  aplicação assume a forma estreita; acima, permanece exatamente como hoje. Um
  limiar só, declarado em um lugar (design.md D1). Em `lg`, o tablet em retrato
  (768px) entra na forma estreita e entrega a largura toda ao conteúdo.
- **Navegação lateral vira painel sobreposto abaixo do limiar** — o `Sider`
  colapsável do desktop e o painel do modo estreito consomem a **mesma** lista
  de itens, extraída para uma origem única, em vez de duas listas paralelas
  (design.md D2).
- **Manual do usuário passa a ser o último item da navegação**, junto dos
  destinos internos, em vez de ocupar área separada no rodapé (design.md D3).
  Isso **reverte deliberadamente** a decisão D6/D8 do change arquivado
  `acesso-ao-manual-no-shell` e exige delta na capability `web-shell-e-auth`.
  As outras duas garantias daquele requisito — não participar da indicação de
  tela corrente, e anunciar pelo nome acessível que leva para fora — são
  **preservadas**, e a segunda ganha peso, por passar a ser a única portadora da
  distinção.
- **Ações secundárias do explorador colapsam em menu** no modo estreito:
  `Visualizar` permanece direta, por ser o verbo da consulta; as demais passam a
  um menu de ações do item (design.md D4). Nenhuma ação some.
- **Nenhuma tela produz rolagem horizontal do documento** — conteúdo largo rola
  dentro do próprio contêiner. Nas seis tabelas isto é uma linha cada.
- **Download de pasta é recusado com explicação no modo estreito**, em vez de ter
  o botão ocultado (design.md D5). A montagem do `.zip` acontece no cliente
  (`apps/web/src/navegacao/zip-download.ts`) e materializa o pacote inteiro em
  memória antes de entregá-lo; num celular isso é frágil. A recusa usa a **mesma
  gramática** que a capability `download-pasta` já exige para o estouro de
  limite, o que preserva integralmente o requisito de que a ação nunca
  desapareça sem explicação.
- **Preview ocupa a largura útil no modo estreito** — visualizar deixou de ser
  detalhe e passou a ser a tela central do uso móvel (design.md D6).
- **Manual atualizado no mesmo commit** — `a-tela.md` (posição do manual e forma
  da navegação), `visualizar-e-baixar.md` e `referencia/limites.md` (recusa do
  download de pasta em tela estreita).

Fora de escopo (registrado em design.md):

- **Envio de pasta em dispositivo móvel** — `webkitdirectory` não existe em
  Safari iOS nem em Chrome Android. É capacidade ausente da plataforma, não
  defeito de layout, e nenhum trabalho de CSS a recupera. A ação passa a ser
  recusada com explicação, pelo mesmo princípio do download de pasta
  (design.md D5).
- **Layout repensado para as telas de administração** (Pessoas, Unidades,
  Painel, Auditoria, Permissões) e para Lixeira e envio de arquivo. Elas entram
  no nível **utilizável**, não no **otimizado** (design.md D7). Repensá-las é
  mudança futura, com demanda própria.
- **Download de arquivo único no modo estreito** — continua funcionando pela URL
  assinada, que o navegador móvel trata nativamente. Sai do foco de otimização,
  não do produto.
- **Aplicativo nativo ou PWA instalável** — nada aqui pressupõe empacotamento.
- **Revisão de tipografia e densidade para toque** (alvos de 44px, escala de
  fonte) — melhoria real, mas independente do limiar e das telas; mudança
  futura.

## Capabilities

### Added Capabilities

- `web-responsividade`: capability nova, para o contrato **transversal** —
  existência de um limiar único e declarado, ausência de rolagem horizontal do
  documento em qualquer tela, os dois níveis de adequação (consulta otimizada
  versus demais telas utilizáveis) e o princípio de que **capacidade ausente no
  dispositivo é recusada com explicação, nunca por ocultação da ação**.

  A alternativa era espalhar a mesma frase como delta em oito capabilities de
  tela (`web-busca`, `web-lixeira`, `web-pessoas`, `web-unidades`, `web-painel`,
  `web-auditoria`, `web-permissoes`, `web-upload`). Recusada: o contrato ficaria
  repetido em oito lugares e sem dono, e cada tela nova nasceria com a obrigação
  de recopiá-lo (design.md D7).

### Modified Capabilities

- `web-shell-e-auth`: o requisito "Shell de layout com identidade e navegação"
  troca a cláusula de **posicionamento** do acesso auxiliar — de "área própria ao
  pé, visualmente separada" para "último item da navegação" — e passa a
  descrever a navegação em painel sobreposto abaixo do limiar. As cláusulas de
  não-seleção e de nome acessível permanecem.
- `web-navegacao`: o requisito "Gestão de arquivos e pastas por item conforme
  permissão" passa a exigir que as ações permaneçam **alcançáveis** no modo
  estreito, admitindo agrupamento em menu, e que a ação de visualizar permaneça
  direta. Nenhuma ação pode ser suprimida por tamanho de tela.
- `web-visualizacao`: o requisito "Visualização inline de arquivo
  pré-visualizável" passa a exigir que o preview aproveite a largura útil no modo
  estreito.
- `download-pasta`: o requisito "Pedido acima do limite configurado é recusado
  com orientação" generaliza a recusa — hoje só por limite de tamanho ou
  contagem — para incluir **capacidade indisponível no dispositivo**, mantendo a
  proibição de ocultar a ação e a exigência de mensagem acionável.

## Impact

- **Web (`apps/web/src`):** `shell/AppShell.tsx` (origem única de itens, painel
  sobreposto, manual como último item, cabeçalho com o gatilho da navegação);
  `navegacao/ExplorerPage.tsx` (menu de ações, rolagem da tabela, recusa do
  download de pasta); `visualizacao/PreviewModal.tsx` (largura e altura no modo
  estreito); `busca/BuscaPage.tsx`, `lixeira/LixeiraPage.tsx`,
  `pessoas/PessoasPage.tsx`, `unidades/UnidadesPage.tsx`,
  `auditoria/AuditoriaModal.tsx` (rolagem própria da tabela);
  `painel/PainelPage.tsx` (colunas responsivas); `upload/UploadArea.tsx`
  (recusa explicada do envio de pasta); `shell/NotificationCenter.tsx` (largura
  fixa de 360px).
- **Testes:** `explorer.test.tsx` e `unidades.test.tsx` (10 asserções em botões
  de ação que deixam de estar sempre visíveis — alteração deliberada);
  `shell-manual-do-usuario.test.tsx` (estrutura de dois menus deixa de existir);
  `shell-identidade-visual.test.tsx` sobrevive, pois o `Sider` colapsável
  permanece acima do limiar. Casos novos para o painel sobreposto, para a
  posição do manual e para as duas recusas por capacidade.
- **Docs:** `docs/manual/docs/a-tela.md`,
  `docs/manual/docs/colaborador/visualizar-e-baixar.md`,
  `docs/manual/docs/referencia/limites.md`.
- **Sem mudança de API, de contrato compartilhado, de configuração de ambiente,
  de Terraform ou de banco.** Nenhum prefixo de rota novo — as três listas
  (`api-prefixes.ts`, `vite.config.ts`, `locals.tf`) permanecem intocadas.
  Toda a mudança é de apresentação; **o servidor continua sendo o único guardião
  de permissão**, e nada aqui altera o que ele autoriza.
