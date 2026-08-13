# web-visualizacao Specification

## Purpose

Define os requisitos verificáveis da visualização e do download de arquivos
na SPA do GDoc, abertos a partir do explorador (change `web-navegacao`): um
modal de preview que chama `POST /files/:id/view-url` e ramifica pela
resposta discriminada do servidor — renderização inline por categoria de MIME
quando `previewAvailable: true`, ou mensagem de indisponibilidade com oferta
de download condicionada a `download.available` quando `false` — e a ação de
baixar por `POST /files/:id/download-url` com navegação simples para a URL
assinada (`attachment`). Implementa o lado de frontend da **US 9.2** (cenários
1 e 2) e dos **RF #10/#16** do PRD (`docs/prd_final.md`), consumindo os
endpoints já prontos em `apps/api/src/routes/files.ts` sem re-descrever seus
cenários de backend (ver capability `visualizacao`).

## Requirements

### Requirement: Visualização inline de arquivo pré-visualizável

A partir do explorador, a SPA SHALL permitir **visualizar** um arquivo sem
baixá-lo, abrindo um preview (via clique no nome do arquivo ou em uma ação
"Visualizar"). Ao abrir, a SPA SHALL chamar `POST /files/:id/view-url` **uma
vez**. Quando a resposta for `previewAvailable: true`, a SPA SHALL renderizar o
conteúdo **inline** usando a URL assinada retornada, escolhendo o elemento de
apresentação a partir da categoria de MIME do arquivo
(`fileCategory(contentType)` de `@gdoc/shared`): imagem, vídeo, áudio, PDF ou
texto — sem que o arquivo seja transferido como download. Reabrir o preview
SHALL emitir uma nova chamada (nova URL assinada).

Abaixo do ponto de ruptura definido pela capability `web-responsividade`, o
preview SHALL aproveitar a **largura útil** da tela, e NÃO SHALL ficar limitado a
uma largura fixa menor que ela. A altura da área de conteúdo SHALL acompanhar a
área efetivamente visível do navegador, de modo que a redução do viewport — pelo
recolhimento da barra de endereço ou pela abertura do teclado virtual — não
deixe parte do conteúdo inalcançável.

Quando o navegador não renderizar inline um formato declarado como
pré-visualizável, a SPA SHALL apresentar indisponibilidade explicável, e NÃO
SHALL deixar área vazia sem explicação.

Referência: PRD US 9.2 (cenário 1), RF #16; design.md D1/D2/D3 do change
`web-visualizacao`; design.md D6 do change `responsividade-mobile-tablet`.

#### Scenario: Visualizar arquivo em formato suportado
- **WHEN** o usuário abre a visualização de um arquivo pré-visualizável (PDF,
  imagem, vídeo, áudio ou texto) sobre o qual tem permissão
- **THEN** a SPA obtém a URL assinada via `POST /files/:id/view-url` e exibe o
  conteúdo diretamente na tela, sem baixar o arquivo

#### Scenario: Elemento de apresentação escolhido pela categoria do arquivo
- **WHEN** a resposta do preview é `previewAvailable: true`
- **THEN** a SPA renderiza uma imagem como imagem, um PDF ou texto em visualizador
  embutido, e vídeo/áudio com controles de reprodução, conforme a categoria de
  MIME do arquivo, apontando para a URL assinada

#### Scenario: Preview aproveita a largura útil em tela estreita
- **WHEN** o usuário abre a visualização de um arquivo numa tela mais estreita
  que o ponto de ruptura
- **THEN** o preview ocupa a largura útil disponível, em vez de permanecer
  limitado a uma largura fixa menor que a tela

#### Scenario: Redução do viewport não torna o conteúdo inalcançável
- **WHEN** a área visível do navegador é reduzida enquanto o preview está aberto
- **THEN** o conteúdo do preview permanece inteiramente alcançável, sem que parte
  dele fique fora da área utilizável

#### Scenario: Formato não renderizado pelo navegador explica a indisponibilidade
- **WHEN** o navegador do dispositivo não renderiza inline um formato declarado
  como pré-visualizável
- **THEN** a SPA informa a indisponibilidade e orienta a alternativa, em vez de
  apresentar área vazia

### Requirement: Formato sem pré-visualização informa indisponibilidade e oferece download conforme permissão

A SPA SHALL informar que a **pré-visualização não está disponível** quando
`POST /files/:id/view-url` responder `previewAvailable: false`
(`reason: 'unsupported_format'`) e SHALL oferecer o **download apenas quando**
`download.available` for `true`. Quando `download.available` for `false`, a SPA
SHALL exibir somente a mensagem de indisponibilidade, sem botão de download.
Nenhum conteúdo do arquivo SHALL ser renderizado nesse caso. Documentos de
escritório (Word/Excel/PowerPoint) recaem neste comportamento enquanto o backend
não os marcar como pré-visualizáveis, sem tratamento especial no cliente.

Referência: PRD US 9.2 (cenário 2), RF #16; design.md D5.

#### Scenario: Formato não suportado com permissão de download
- **WHEN** o usuário tenta visualizar um arquivo cujo formato não tem
  pré-visualização e a resposta traz `download.available: true`
- **THEN** a SPA informa que a pré-visualização está indisponível e oferece um
  botão de download

#### Scenario: Formato não suportado sem permissão de download
- **WHEN** o usuário tenta visualizar um arquivo sem pré-visualização e a
  resposta traz `download.available: false`
- **THEN** a SPA informa que a pré-visualização está indisponível e não exibe
  botão de download

### Requirement: Download de arquivo por URL assinada

A SPA SHALL oferecer uma ação de **baixar** por arquivo que chama
`POST /files/:id/download-url` e, ao receber a URL assinada, dispara o download
por **navegação simples** para essa URL (a resposta do servidor usa disposição
`attachment`), sem transferir os bytes através da própria aplicação. A ação de
download do ramo de indisponibilidade (formato não suportado com
`download.available: true`) SHALL usar o mesmo fluxo.

Referência: PRD US 9.2, RF #16; design.md D4.

#### Scenario: Baixar arquivo com permissão
- **WHEN** o usuário aciona o download de um arquivo sobre o qual tem permissão
- **THEN** a SPA obtém a URL assinada via `POST /files/:id/download-url` e o
  browser inicia o download do arquivo

### Requirement: Acesso a arquivo sem permissão é bloqueado sem expor preview

A SPA SHALL exibir um aviso de **permissão insuficiente** e NÃO SHALL renderizar
qualquer conteúdo do arquivo quando o servidor responder **403** a
`POST /files/:id/view-url` ou `POST /files/:id/download-url` (arquivo inexistente,
de outra unidade ou sem a concessão do verbo correspondente). Uma resposta
**401** SHALL continuar sendo tratada centralmente, encerrando a sessão e
redirecionando a `/login`.

Referência: PRD US 9.2, RF #10; design.md D6.

#### Scenario: Visualização sem permissão não expõe conteúdo
- **WHEN** o usuário tenta visualizar ou baixar um arquivo para o qual não tem
  permissão e a API responde 403
- **THEN** a SPA exibe um aviso de permissão insuficiente e nenhum conteúdo do
  arquivo é mostrado
