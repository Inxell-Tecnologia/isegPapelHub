# Proposal

## Why

A Fase 1 da demanda do cliente nº 2 não é aceita enquanto o shell não for
ajustado: o menu lateral corta rótulos ("Manual do usuá..."), espaça os itens
além do necessário, exibe a logomarca como miniatura ilegível e deixa o rodapé
com apenas o botão de recolher; na barra superior a busca fica à direita com
botão verde separado, não há ação de envio nem acesso à ajuda, e a identidade
ocupa o topo. É a fatia **A2** de `docs/plano_demanda_cliente_2.md` (seções 1.1
e 1.2 da demanda), e vem antes de A4, A5, A6 e C2 porque é ela que cria os
espaços — grupos de navegação e rodapé do menu — que aquelas fatias ocupam.

A fatia é de **apresentação**: nenhuma regra de permissão, alcance de dados ou
tráfego de bytes muda. O que muda é onde cada coisa fica e quanto espaço ocupa.

## What Changes

**Menu lateral (demanda 1.1)**

- Largura de 264 px, com os rótulos dos itens **sem truncamento**.
- Itens compactos, preservando o piso de 44 px de área de acionamento que
  `sistema-de-design` já normatiza — compactar é reduzir folga, nunca o alvo.
- Navegação agrupada por rótulo **NAVEGAÇÃO** (destinos internos) e **AJUDA**
  (acessos auxiliares). O manual do usuário passa a viver no grupo AJUDA.
- Marca no topo com a logomarca acompanhada de **"PapelHub"** e do descritor
  **"Gestão de Documentos"** abaixo, legíveis sobre o degradê.
- **Cartão do usuário no rodapé do menu** (iniciais, nome, perfil, unidade) com
  a ação **Sair**, preservando o botão de recolher.

**Barra superior (demanda 1.2)**

- Busca à **esquerda**, com a lupa **dentro** do campo (sai o botão verde
  separado) e o texto de apoio "Buscar por nome, código (ex.: PRT-NSP-001) ou
  palavra-chave".
- Botão de ação **"Enviar documento"** no verde de ação da paleta.
- Botão de **Ajuda**, que leva ao mesmo manual do grupo AJUDA.
- Sino de notificações permanece; a identidade **sai do topo** e vai para o
  rodapé do menu.
- Avatar com superfície em azul céu e iniciais em texto escuro.

**Não muda, por já estar atendido**

O **contador do sino** já existe: `NotificationCenter` consome
`useUnreadNotificationCount` e envolve o botão num `Badge`. O relato de "sino
sem contador" descreve o comportamento correto de contagem zero — o design
system não desenha distintivo para zero. Nenhuma rota nova, nenhum requisito
novo em `notificacoes`.

## Capabilities

### New Capabilities

Nenhuma. A fatia reposiciona e redimensiona o que já existe; não introduz
comportamento de sistema que mereça capability própria.

### Modified Capabilities

- `web-shell-e-auth`: a identidade deixa de ser apresentada **no cabeçalho** e
  passa ao **rodapé da navegação**, com nome, perfil e unidade visíveis em vez
  de reunidos num menu suspenso; a navegação passa a ser **agrupada por
  natureza**, e o acesso auxiliar deixa de ser definido pela "última posição"
  para ser definido pelo **grupo** que o reúne; a largura da navegação passa a
  ser declarada como suficiente para não truncar rótulo.
- `web-busca`: o campo do cabeçalho passa a declarar **onde** fica na barra, que
  a lupa é **interna** ao campo, qual é o texto de apoio e que sua largura é um
  **teto**, não uma medida fixa — para não produzir rolagem horizontal no
  limiar de ruptura.
- `identidade-visual`: a marca do shell expandido passa a apresentar o **nome e
  o descritor do produto** junto da logomarca, e o nome acessível deixa de ser
  carregado pela imagem (passa a haver texto irmão).
- `sistema-de-design`: a paleta ganha a **superfície de avatar** em azul céu,
  com a regra de que ela carrega texto escuro — o par com branco mede 1,54:1 e
  reprova no piso.

## Impact

**Código (apresentação, `apps/web`)**

- `shell/AppShell.tsx` — reorganiza `Sider` (largura, grupos, marca, rodapé) e
  `Header` (ordem, ação de envio, ajuda); o menu de identidade sai do topo.
- `shell/BuscaNoCabecalho.tsx` — lupa interna, texto de apoio, largura por teto.
- `shell/BrandMark.tsx` — passa a compor logomarca + nome + descritor.
- `shell/CartaoDoUsuario.tsx` (novo) — cartão do rodapé, consumido pela coluna
  lateral e pelo painel sobreposto a partir de **uma** origem.
- `app/theme.ts` — token da superfície de avatar.
- `__tests__/contraste.test.ts` — apura o par novo por cálculo.

**Sem impacto**: `apps/api`, `packages/shared`, migrações, Terraform, prefixos de
rota (`api-prefixes.ts` e as duas listas irmãs ficam intactas — nenhuma rota de
topo nova). Nenhuma tabela, nenhuma coluna, nenhuma policy RLS.

**Documentação**: `docs/manual/` — a página que descreve a navegação e a barra
superior passa a refletir os grupos, o cartão do usuário e as ações novas.

## Fora de escopo

Cada item abaixo tem fatia ou dependência própria no plano, e entra com ela.
Item de menu que não leva a nada é regressão — `tela-inicial` já normatiza que
"atalho apresentado conduz a uma ação executável".

- **Itens Favoritos e Compartilhados comigo** no grupo NAVEGAÇÃO — fatias A4 e
  A5 (os destinos não existem).
- **Item Leitura obrigatória, com contador** — fatia C2.
- **Item Tour guiado** no grupo AJUDA — fatia A6.
- **Logomarca branca de 150 px sem moldura escura** e **marca d'água do símbolo
  no pé do menu (200 px, 14%)** — dependência externa **E1**. O ativo atual é
  um JPEG **sem transparência**: a 14% de opacidade ele apresentaria um
  retângulo cinza, não um símbolo. A estrutura do menu é entregue agora; estes
  dois requisitos esperam o PNG transparente.
- **Trocar o "perfil" do cartão do usuário pela função do cadastro** — fatia A1,
  decisão **D2**. O cartão nasce exibindo o papel, como hoje; por ser a única
  superfície que o apresenta, a troca em A1 fica contida nele.
