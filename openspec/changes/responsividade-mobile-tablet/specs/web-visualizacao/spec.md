# Spec — web-visualizacao (delta)

Com o alvo da forma estreita recortado para **consulta**, visualizar deixou de
ser uma ação entre outras e passou a ser o ato central do uso em celular e
tablet. O requisito vigente normatiza a mecânica do preview — uma chamada a
`view-url`, elemento de apresentação escolhido pela categoria de MIME, nova URL
assinada a cada reabertura — mas não diz nada sobre o espaço que o preview ocupa,
e a implementação atual usa largura fixa.

Este delta acrescenta a obrigação de aproveitar a largura útil abaixo do ponto de
ruptura, sem tocar em nada da mecânica de assinatura e auditoria. Ver design.md
D6.

## MODIFIED Requirements

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
