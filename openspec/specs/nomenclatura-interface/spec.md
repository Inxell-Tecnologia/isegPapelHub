# nomenclatura-interface Specification

## Purpose

Estabelecer o termo único com que o produto se refere à pessoa usuária em toda a
camada de apresentação — **Colaborador** —, o alcance dessa regra (texto visível
na SPA e no manual do usuário) e a fronteira que ela não cruza (rotas,
identificadores de código, esquema de banco e contratos de API), de modo que a
interface, o manual e a fala da operação usem uma palavra só.

## Requirements

### Requirement: Termo único para a pessoa usuária no texto visível

A aplicação SHALL empregar **"Colaborador"** (e o plural **"Colaboradores"**)
como o único termo para designar a pessoa usuária em todo texto visível ao
usuário: rótulos de menu e de navegação, títulos de página e de diálogo, rótulos
e placeholders de campo, cabeçalhos de coluna, textos de botão, mensagens de
confirmação, avisos de erro e estados vazios. Os termos **"Pessoa"/"Pessoas"** e
**"Servidor"/"Servidores"** (este no sentido de pessoa) NÃO SHALL aparecer em
texto visível.

A concordância gramatical SHALL acompanhar o termo — rótulos que concordavam com
"pessoa" (feminino) passam a concordar com "colaborador" (masculino), incluindo
os rótulos de status de conta.

O termo SHALL ser invariável por papel, por unidade e por estado de
autenticação: um administrador de unidade também é um colaborador do ponto de
vista do vocabulário da interface.

#### Scenario: Navegação e gestão de contas usam o termo único
- **WHEN** um administrador percorre a navegação lateral e abre a área de gestão
  de contas de acesso
- **THEN** o item de menu, o título da página, o botão de cadastro e os diálogos
  de criação, edição, ativação, desativação e redefinição de senha se referem a
  "Colaborador"/"Colaboradores", e em nenhum deles aparece "Pessoa", "Pessoas",
  "Servidor" ou "Servidores"

#### Scenario: Demais telas que nomeiam a pessoa usuária
- **WHEN** um administrador abre a auditoria de um arquivo, o painel gerencial, a
  gestão de unidades ou o diálogo de permissões de um recurso
- **THEN** cada ponto que nomeia a pessoa usuária — cabeçalho de coluna, rótulo
  de indicador, aviso de unidade com contas vinculadas e rótulo do seletor —
  usa "Colaborador"/"Colaboradores"

#### Scenario: Status de conta concorda em gênero com o termo
- **WHEN** a listagem de colaboradores exibe o status de uma conta ativa e o de
  uma conta desativada
- **THEN** os rótulos apresentados concordam com "colaborador" no masculino, e
  não nas formas femininas que concordavam com "pessoa"

### Requirement: Rótulo do papel de acesso preservado

A aplicação SHALL manter **"Colaborador"** como rótulo do papel de acesso sem
privilégio administrativo, ao lado de **"Administrador da unidade"** — rótulo do
papel com privilégio administrativo sobre a própria unidade — e de
"Administrador global".
O conjunto de papéis, sua semântica e seus limites de autorização NÃO SHALL ser
alterados por esta nomenclatura: muda o texto apresentado, não o papel. A
interface SHALL continuar exibindo o papel de cada conta como atributo próprio,
distinto do termo que nomeia a entidade.

O termo **"Gestor"** NÃO SHALL nomear o papel com privilégio administrativo de
unidade em texto visível ao usuário — nem na interface, nem no manual. "Gestor"
fica **reservado** a quem acompanha as leituras da equipe sem administrar a
unidade (demanda do cliente nº 2, seção 3.1;
`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, resposta 5a), e só SHALL
aparecer como rótulo quando esse papel existir. Identificadores internos de
código, esquema de banco e contratos de API permanecem inalterados e não são
objeto deste requisito.

#### Scenario: Papel continua distinguindo administradores de colaboradores comuns
- **WHEN** um administrador consulta a listagem de colaboradores de sua unidade
- **THEN** cada linha exibe o papel da conta — "Colaborador", "Administrador da
  unidade" ou "Administrador global" — permitindo distinguir, entre os
  colaboradores listados, quem tem privilégio administrativo

#### Scenario: O rótulo anterior não aparece em texto visível
- **WHEN** uma pessoa percorre as telas que nomeiam o papel de acesso
- **THEN** em nenhuma delas "Gestor" nomeia o papel de quem administra a
  unidade

#### Scenario: Mudança de rótulo não amplia nem reduz privilégio
- **WHEN** uma conta com privilégio administrativo de unidade passa a ser
  rotulada como "Administrador da unidade"
- **THEN** as ações que ela pode executar permanecem exatamente as mesmas de
  antes da mudança de rótulo

#### Scenario: O manual usa o mesmo rótulo da interface
- **WHEN** uma pessoa lê, no manual, o que quem administra a unidade pode fazer
- **THEN** encontra "Administrador da unidade", o mesmo texto que a interface
  exibe para esse papel

### Requirement: Alcance da nomenclatura limitado à camada de apresentação

A regra de nomenclatura SHALL alcançar **apenas** o texto visível ao usuário na
SPA e no manual do usuário. Endereços de rota, identificadores de código, nomes
de tabela e coluna, campos de contratos de API, códigos de erro e identificadores
de papel NÃO SHALL ser renomeados por força desta regra — endereços já divulgados
continuam válidos e nenhum contrato consumido por cliente algum é quebrado pela
troca de vocabulário.

#### Scenario: Endereço já divulgado continua válido
- **WHEN** uma pessoa acessa o endereço da área de gestão de contas que já usava
  antes da troca de nomenclatura
- **THEN** a página abre normalmente, agora apresentando o texto com o termo
  "Colaboradores"

#### Scenario: Contrato de API não muda por causa do vocabulário
- **WHEN** a interface passa a exibir "Colaborador" no lugar de "Pessoa"
- **THEN** os campos, códigos de erro e identificadores de papel trocados entre
  SPA e servidor permanecem inalterados

### Requirement: Manual do usuário adota o mesmo termo

O manual do usuário SHALL empregar **"Colaborador"/"Colaboradores"** para a
pessoa usuária, em prosa, títulos de página e rótulos de navegação, em
correspondência ao que a interface exibe — mantendo a fidelidade do manual à tela
efetivamente entregue. Os endereços das páginas publicadas do manual NÃO SHALL
mudar por força desta regra, preservando os links já divulgados e a verificação
de integridade de links.

#### Scenario: Manual e interface usam o mesmo termo
- **WHEN** uma pessoa lê a página do manual que descreve a gestão de contas e a
  compara com a tela correspondente
- **THEN** ambos usam "Colaborador"/"Colaboradores" para a pessoa usuária, sem
  ocorrência de "Pessoa"/"Pessoas" ou "Servidor"/"Servidores" nesse sentido

#### Scenario: Endereços das páginas do manual preservados
- **WHEN** o manual é publicado após a troca de nomenclatura
- **THEN** cada página continua acessível pelo mesmo endereço de antes e a
  verificação de integridade de links do manual passa sem apontar quebra

### Requirement: Rótulo do papel é idêntico em toda a interface

A aplicação SHALL apresentar o rótulo de um mesmo papel de acesso com texto
idêntico em **toda tela que o exiba** — perfil da própria conta, listagem de
colaboradores, seletor de papel no cadastro e, no shell autenticado e na tela
inicial, nas situações em que o papel é exibido. Um rótulo alterado SHALL mudar
simultaneamente em todas elas, sem possibilidade de uma tela ficar com o texto
antigo.

O shell autenticado e a tela inicial apresentam a **função** do cadastro, e
exibem o rótulo do papel **apenas como recaída**, quando a pessoa não tem função
preenchida (capabilities `web-shell-e-auth` e `tela-inicial`). Nessa recaída o
rótulo SHALL vir da mesma origem única das demais telas. A função NÃO SHALL ser
tratada como rótulo de papel: ela é texto do cadastro, sem efeito sobre
autorização, e NÃO SHALL ser padronizada por esta regra.

#### Scenario: Mesmo papel exibe o mesmo rótulo em telas distintas
- **WHEN** uma pessoa com privilégio administrativo de unidade, e sem função
  preenchida no cadastro, consulta o shell autenticado, o perfil da própria conta
  e a listagem de colaboradores
- **THEN** o papel aparece com exatamente o mesmo texto nas três telas

#### Scenario: Alteração de rótulo não deixa tela para trás
- **WHEN** o rótulo de um papel de acesso é alterado
- **THEN** nenhuma tela da aplicação continua exibindo o texto anterior

#### Scenario: Função exibida no lugar do papel não é rótulo de papel
- **WHEN** uma pessoa com função "Gerente de Governança" e papel `collaborator`
  consulta o shell autenticado e a listagem de colaboradores
- **THEN** o shell apresenta a função, a listagem apresenta o papel com o rótulo
  de origem única, e a divergência entre os dois textos não configura rótulo de
  papel inconsistente
