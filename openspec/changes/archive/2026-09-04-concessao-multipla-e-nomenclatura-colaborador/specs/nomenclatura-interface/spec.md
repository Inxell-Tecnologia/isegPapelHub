## Purpose

Estabelecer o termo único com que o produto se refere à pessoa usuária em toda a
camada de apresentação — **Colaborador** —, o alcance dessa regra (texto visível
na SPA e no manual do usuário) e a fronteira que ela não cruza (rotas,
identificadores de código, esquema de banco e contratos de API), de modo que a
interface, o manual e a fala da operação usem uma palavra só.

## ADDED Requirements

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
privilégio administrativo, ao lado de "Administrador da unidade" e
"Administrador global". A adoção do mesmo termo para a entidade NÃO SHALL alterar
o conjunto de papéis, seus rótulos nem sua semântica, e a interface SHALL
continuar exibindo o papel de cada conta como atributo próprio, distinto do termo
que nomeia a entidade.

#### Scenario: Papel continua distinguindo administradores de colaboradores comuns
- **WHEN** um administrador consulta a listagem de colaboradores de sua unidade
- **THEN** cada linha exibe o papel da conta — "Colaborador", "Administrador da
  unidade" ou "Administrador global" — permitindo distinguir, entre os
  colaboradores listados, quem tem privilégio administrativo

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
