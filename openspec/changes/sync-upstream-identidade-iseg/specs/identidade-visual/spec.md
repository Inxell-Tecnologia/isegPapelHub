# Spec Delta

## MODIFIED Requirements

### Requirement: Logomarca oficial é exibida na tela de login e no shell expandido

A aplicação SHALL exibir a logomarca oficial — a **versão negativa** da logo
horizontal do ISEG, de fundo transparente — na tela de login e no shell
expandido, apenas sobre os fundos escuros da marca, sem moldura própria, e
NÃO SHALL exibi-la sobre fundo claro.

Referência: change `sync-upstream-identidade-iseg`, design.md D3 e D4.

#### Scenario: Logomarca aparece na tela de login
- **WHEN** uma pessoa não autenticada abre a tela de login
- **THEN** a logomarca oficial é exibida sobre o campo escuro da composição,
  junto ao cabeçalho com o nome da aplicação, sem moldura própria

#### Scenario: Logomarca aparece no shell expandido
- **WHEN** uma pessoa autenticada visualiza o shell com a navegação expandida
- **THEN** a logomarca oficial é exibida diretamente sobre o fundo da navegação,
  no topo, sem moldura própria

#### Scenario: Logomarca não aparece sobre fundo claro
- **WHEN** qualquer tela da aplicação apresenta a logomarca oficial
- **THEN** o fundo imediatamente atrás dela é um dos fundos escuros da marca

#### Scenario: Nenhum vestígio da identidade de outro cliente
- **WHEN** uma pessoa percorre a tela de login, o shell autenticado e o manual
  do usuário desta implantação
- **THEN** nenhuma logo, símbolo, favicon, nome acessível ou exemplo de
  identificação pertence a outra organização que não o ISEG

## ADDED Requirements

### Requirement: Ativos da marca são derivados das artes do cliente

Os ativos da marca SHALL ser derivados das artes fornecidas pelo cliente por um
procedimento versionado e reproduzível, sem edição à mão e sem franja do fundo
branco original. O símbolo SHALL existir em versão negativa (fundos escuros) e
colorida (fundos claros), cada superfície usando a do seu fundo.

Referência: change `sync-upstream-identidade-iseg`, design.md D3 e D4.

#### Scenario: Símbolo usa a versão adequada ao fundo
- **WHEN** o símbolo da marca é apresentado sobre a navegação escura e sobre a
  área principal clara
- **THEN** sobre a navegação aparece a versão negativa, e sobre a área principal
  a versão colorida

#### Scenario: Versão negativa preserva o degradê e clareia o texto
- **WHEN** a logomarca ou o símbolo é apresentado sobre um fundo escuro da marca
- **THEN** o anel e a cruz mantêm o degradê turquesa → laranja, e a sigla e o
  texto institucional aparecem em branco

#### Scenario: Ativos são regeráveis a partir das artes do cliente
- **WHEN** o cliente substitui as artes de origem da marca
- **THEN** os ativos da aplicação são regerados pelo procedimento versionado, sem
  edição manual de imagem
