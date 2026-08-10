## Context

Esta é a segunda vez que a capability `identidade-visual` muda de nome — a
primeira foi `GDoc` → `Doc7` (`openspec/changes/archive/
2026-08-05-rebranding-doc7-setes/`). O mecanismo que aquela change construiu
(nome composto em runtime via `GET /auth/public-config`, subtítulo fora do
heading, degradação silenciosa sem `APP_CLIENT_NAME`) está correto e **não
muda** — só o literal `Doc7` vira `PapelHub`. O que é genuinamente novo é a
logomarca: a primeira change excluiu explicitamente "logo/ícone, paleta e
tipografia" do escopo; esta inclui.

O arquivo-fonte da logo (`docs/images/logo_papel_hub.jpg`) é uma foto/render
de 301×502, JPEG, com fundo opaco em gradiente radial escuro (vinheta) por
trás de uma árvore/raízes estilizada e o wordmark "PapelHub". Não há
transparência.

Restrição de ambiente que molda várias decisões abaixo: este sandbox **não
tem** ImageMagick, Pillow/PIL nem `sharp` instalados. Verificado durante a
exploração (`ToolSearch`/`Bash`): `convert` no PATH resolve para o utilitário
de disco do Windows, não ImageMagick; `python3 -c "import PIL"` falha. Ou
seja, **remoção de fundo / recorte de silhueta não é viável** neste ambiente
— exigiria segmentação (ML) ou edição manual fora do fluxo de codificação.

O que **é** viável, e verificado nesta exploração: `System.Drawing` do .NET
(built-in no Windows, sem instalar nada) via PowerShell consegue abrir,
recortar e redimensionar a imagem:

```
Add-Type -AssemblyName System.Drawing
[System.Drawing.Image]::FromFile(".../logo_papel_hub.jpg")  # → 301x502, Jpeg
```

Isso não resolve transparência, mas resolve **recorte quadrado + redimensão**
— o suficiente para um favicon que não fique esticado/distorcido.

## Goals / Non-Goals

**Goals:**

- `PapelHub` como nome exibido em todos os pontos onde `Doc7` está hoje —
  mesmo mecanismo do rebrand anterior, sem regressão de comportamento.
- Logomarca oficial visível na tela de login e no shell autenticado
  (expandido), sempre contida numa moldura escura própria — nunca solta sobre
  fundo claro.
- Favicon derivado da mesma arte, com aspecto quadrado correto (recorte, não
  esticamento).
- Preservar os invariantes de acessibilidade já normatizados (US 1.2: nome
  acessível do heading de login é o nome puro da aplicação).
- Manual do usuário (MkDocs) com a mesma marca e prosa atualizada.

**Non-Goals:**

- Remoção de fundo / recorte de silhueta da logo — inviável no ambiente (ver
  Context). A imagem é usada como fornecida, sempre emoldurada.
- Logomarca no estado colapsado do shell — permanece abreviação em texto.
- Renomear identificadores internos (`gdoc`, `@gdoc/*`, `name_prefix`) — fora
  de escopo por decisão já registrada em `CLAUDE.md`.
- Mudar o mecanismo de `APP_CLIENT_NAME` / `GET /auth/public-config` — só o
  literal `appName` muda.

## Decisions

### D1 — A logo é usada como fornecida, sempre dentro de uma "moldura escura contida"

Sem ferramenta de remoção de fundo, a alternativa a "aceitar o fundo escuro"
seria pedir um novo arquivo ao cliente — mas o usuário já decidiu (modo
explore) seguir com a arte como está. A decisão de design é **não lutar
contra o fundo**: em vez de tentar embutir a imagem diretamente no layout
claro do card de login (onde o retângulo escuro pareceria um bug), ela vive
sempre dentro de um contêiner escuro arredondado dimensionado por quem a
hospeda — um "cartão dentro do cartão". No shell, que já é escuro
(`Sider theme="dark"`), a moldura se funde visualmente; no login, ela cria
contraste deliberado.

_Alternativa descartada:_ CSS `mix-blend-mode` ou filtros para tentar
"apagar" o fundo por aproximação de cor. Rejeitada — gradiente radial não tem
uma cor-chave única, o resultado seria halo irregular, pior que a moldura
honesta.

### D2 — Um único padrão visual reaproveitado, não estilos duplicados

A moldura escura contida aparece em dois lugares (login, shell expandido).
Em vez de duplicar a marcação/estilo, a implementação usa **um componente de
apresentação único** (ex.: um `BrandMark`/`Logo` em `apps/web/src`, exportado
para os dois consumidores) parametrizado só por tamanho — mesma imagem, raio
de borda e fundo, para que o padrão não divirja se alguém ajustar um dos dois
lugares no futuro.

### D3 — Asset físico em `apps/web/public/`, mesmo padrão do favicon

`apps/web/public/favicon.svg` já estabelece o precedente: asset estático
servido pela SPA sem passar por import/hash do bundler. A logo segue o mesmo
caminho — copiada para `apps/web/public/` sob um nome estável (não o nome de
arquivo original do cliente, que carrega espaço e é um nome de entrega, não
um nome de asset de produto). `docs/images/logo_papel_hub.jpg` continua
existindo como o arquivo-fonte entregue pelo cliente (prosa/asset autoral,
fora do escopo do Prettier); o arquivo em `apps/web/public/` é a cópia
servida.

_Alternativa descartada:_ importar a imagem de `src/` e deixar o Vite
hashear o nome no build. Sem vantagem aqui — a imagem não muda por
implantação (diferente de `APP_CLIENT_NAME`) e o precedente do favicon já é
`public/`; misturar os dois padrões sem motivo é inconsistência gratuita.

### D4 — Favicon: recorte quadrado central via `System.Drawing`, não estiramento

O favicon precisa de proporção 1:1. Redimensionar a arte 301×502 direto para
um quadrado sem recortar **estica** a imagem (compressão vertical),
distorcendo a árvore e o wordmark — pior que não trocar o favicon. A
alternativa viável verificada nesta exploração é um **recorte quadrado
central** (301×301, capturando o núcleo do símbolo) seguido de redimensão
para os tamanhos de favicon usuais, via PowerShell + `System.Drawing` — não
exige instalar nenhuma dependência nova (é parte do .NET no Windows) e roda
como um passo único de geração de asset, não como script de build ou
dependência de runtime/CI. O resultado é commitado como arquivo estático,
igual à logo principal.

Consequência aceita: a wordmark "PapelHub" dentro do círculo provavelmente
fica ilegível em 16×16 — comportamento normal de favicon (a maioria das
marcas com texto só lê o símbolo nesse tamanho, não o nome). O que o recorte
quadrado evita é o defeito visual pior: a imagem esticada/borrada.

`apps/web/index.html` troca `<link rel="icon" type="image/svg+xml"
href="/favicon.svg">` pelo favicon derivado (tipo MIME correspondente ao
formato de saída escolhido na implementação — SVG deixa de ser o formato do
ícone, já que a fonte é raster).

### D5 — Sequenciamento com a change `manual-usuario-mkdocs` em andamento

`docs/manual/` está sob uma change ativa (`manual-usuario-mkdocs`, artifacts
completos, 29/35 tasks, ainda não arquivada) que também toca `mkdocs.yml` e
as páginas de prosa. O usuário aprovou o overlap. Para não colidir threads de
edição na mesma árvore, a tarefa de manual desta change (logo + prosa
`PapelHub`) é sequenciada **depois** das tasks restantes daquela change
alcançarem o estado atual do repositório — ou seja, tasks.md desta change
trata `docs/manual/**` como alvo a reconferir no momento da implementação
(o texto pode já ter mudado sob os pés), não como um diff estático definido
agora.

### D6 — Colapsado do shell continua só texto (`D7` → `PH`)

Mesmo raciocínio do rebrand anterior (design.md D6 da change arquivada): o
estado colapsado não tem largura para nada além de uma sigla curta, e a arte
é um recorte retrato alto sem uma versão de ícone quadrado dedicada — que
este ambiente não tem como produzir com qualidade (ver Non-Goals). Produzir
esse recorte de ícone é trabalho de design gráfico, não geração
automatizada; fica para uma iteração futura caso o cliente forneça (ou peça)
uma versão "somente símbolo".

### D7 — Nome acessível: a logo no login continua decorativa, a do shell expandido não

No login, o padrão já existente é preservado sem mudança de regra: a imagem
(que substitui o ícone `FolderOutlined`) fica `aria-hidden`, porque o
`<h3>PapelHub</h3>` ao lado já carrega o nome acessível real (US 1.2,
design.md D6 da change arquivada).

No shell **expandido**, porém, hoje o nome existe como **texto puro** (`{
collapsed ? 'D7' : 'Doc7' }`) — lido normalmente por tecnologia assistiva.
Substituir esse texto pela imagem sem mais nada **regrediria** a
acessibilidade (o nome da marca sumiria da árvore de acessibilidade ali). A
logomarca no shell expandido leva `alt="PapelHub"` — ela é a única
portadora do nome nesse local, então não pode ser puramente decorativa. Isso
não é uma cópia mecânica do padrão do login; é uma decisão própria desta
change, porque o contexto de marcação é diferente (lá há texto irmão, aqui
não).

### D8 — Identificação do cliente (`SETES`) não muda de mecanismo

O subtítulo de cliente continua elemento irmão, abaixo do nome/logo, só no
estado expandido do shell e sempre visível no login quando configurado —
comportamento normatizado por `identidade-visual` e não tocado por esta
change. A moldura da logo não encosta no espaço do subtítulo.

## Risks / Trade-offs

- **Favicon ilegível em tamanhos mínimos.** Mitigado por D4 (recorte
  quadrado evita distorção; ilegibilidade da wordmark em 16×16 é esperada e
  aceitável — o símbolo continua reconhecível).
- **Ambiente sem ferramenta de imagem "de verdade".** `System.Drawing`
  resolve recorte/redimensão, mas não segmentação/transparência — se o
  cliente pedir fundo transparente depois, é uma change própria que depende
  de receber um arquivo-fonte adequado ou de rodar fora deste ambiente.
- **Churn de teste mecânico.** Mesma natureza do rebrand anterior — literal
  `'Doc7'` → `'PapelHub'` em oito arquivos de teste; sem caso de
  comportamento novo além dos dois já cobertos pela capability existente.
- **Overlap com `manual-usuario-mkdocs`.** Mitigado por D5 (sequenciamento,
  não edição simultânea da mesma linha).
- **Regressão de acessibilidade se a alternativa da imagem no shell
  expandido for esquecida.** Mitigado por D7, que fixa a distinção explícita
  entre os dois usos (decorativo vs. portador de nome).

## Migration Plan

Nenhuma migração de banco, nenhuma mudança de infraestrutura Terraform,
nenhuma mudança na paridade do sandbox. Ordem de aplicação:

1. **Geração de assets** (passo único, fora do build): copiar
   `docs/images/logo_papel_hub.jpg` para `apps/web/public/` sob nome estável;
   gerar o favicon derivado (recorte quadrado + redimensão via
   `System.Drawing`/PowerShell) e também commitá-lo em `apps/web/public/`.
2. **API** (`config`/`routes/auth.ts`/`server.ts`): troca de literal
   `Doc7` → `PapelHub`. Nenhuma mudança de contrato — `PublicConfigResponse`
   permanece `{ appName, clientName }`.
3. **Web**: componente de moldura compartilhado (D2); `LoginPage.tsx`,
   `AppShell.tsx` (expandido usa logo com `alt`, colapsado troca `D7` → `PH`),
   `HomePage.tsx`, `session-context.tsx` (fallback), `index.html` (`<title>`
   e `<link rel="icon">`).
4. **Testes**: âncoras de nome nos oito arquivos listados na proposal.
5. **Documentação**: `README.md`, `CLAUDE.md`, `docs/frontend_roadmap.md`,
   `openspec/specs/identidade-visual/spec.md` — junto com o código que
   implementa cada trecho, não em lote separado.
6. **Manual MkDocs**: por último, após reconferir o estado de
   `docs/manual/**` sob a change `manual-usuario-mkdocs` (D5).

`APP_CLIENT_NAME` não é afetado — implantações continuam funcionando durante
o rollout sem nenhuma janela de incompatibilidade entre API e SPA (mesmo
artefato de deploy, conforme `publicacao-frontend`).

## Open Questions

Nenhuma pendente. Todas as decisões de design (posicionamento da logo,
tratamento do fundo, abreviação do colapsado, escopo do favicon,
sequenciamento com o manual) foram fechadas com o usuário em modo explore
antes desta proposta.
