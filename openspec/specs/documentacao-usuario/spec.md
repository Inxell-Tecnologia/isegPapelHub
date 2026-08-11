# documentacao-usuario Specification

## Purpose

Trata do **manual do usuário como artefato entregue**: onde ele vive, o que ele
tem o direito de afirmar e como chega a quem o usa. As regras de produto que o
manual descreve continuam normatizadas pelas capabilities correspondentes
(`navegacao`, `permissoes-granulares`, `lixeira`, `busca`, …) e pelo PRD
(`docs/prd_final.md`); esta capability não as redefine — ela define a
**fidelidade** e a **entrega** da documentação que fala sobre elas.

## Requirements

### Requirement: Manual do usuário em fonte única

O manual do usuário SHALL existir em **um único lugar** do repositório, de modo
que nenhuma prosa destinada ao usuário final seja mantida em duas cópias
paralelas. Uma alteração de comportamento da aplicação que exija ajuste no manual
SHALL ter exatamente um local onde ser aplicada, e NÃO SHALL depender de
sincronização manual entre documentos equivalentes. Documentos de outra natureza
— PRD, specs OpenSpec, README — NÃO SHALL ser considerados cópias do manual, por
terem público e propósito distintos. Referência: design.md D1.

#### Scenario: Correção de manual tem um único ponto de aplicação
- **WHEN** uma change altera comportamento visível ao usuário e precisa ajustar o
  manual
- **THEN** existe exatamente um arquivo de manual a alterar para aquele assunto

#### Scenario: Caminho antigo do manual não sobrevive como cópia
- **WHEN** o manual é reorganizado para uma nova estrutura
- **THEN** o documento anterior deixa de existir, em vez de permanecer como
  segunda versão do mesmo conteúdo

### Requirement: Fidelidade do manual à interface efetivamente entregue

O manual SHALL descrever exclusivamente o que a interface do usuário oferece na
versão vigente, adotando a perspectiva de quem olha a tela. Uma capacidade
existente apenas no backend, sem superfície na SPA que a acione, NÃO SHALL ser
apresentada ao usuário como recurso disponível, ainda que a rota correspondente
esteja implementada e testada. Rótulos de ação citados no manual SHALL
corresponder ao texto exibido nos controles da tela; quando duas ações distintas
existem com rótulos distintos, ambas SHALL ser documentadas com seus rótulos
próprios. Restrições de papel que determinam a ausência de um controle SHALL ser
informadas no guia do perfil afetado, e não apenas no guia do perfil que detém a
ação. Referência: design.md D8.

#### Scenario: Capacidade de backend sem superfície não é anunciada
- **WHEN** uma rota de API existe e nenhuma tela da SPA a aciona
- **THEN** o manual não apresenta a funcionalidade correspondente como
  disponível ao usuário

#### Scenario: Substituição de arquivo não é atribuída ao renomear
- **WHEN** o usuário consulta o manual sobre renomear um arquivo
- **THEN** encontra apenas a alteração de nome, sem menção a enviar uma nova
  versão no lugar do arquivo atual

#### Scenario: Ações homônimas com rótulos distintos são distinguidas
- **WHEN** a tela oferece o download da pasta atual e o download de uma subpasta
  por controles de rótulos diferentes
- **THEN** o manual documenta os dois rótulos, indicando o alcance de cada um

#### Scenario: Colaborador é informado de que não concede permissão
- **WHEN** um colaborador consulta o manual sobre compartilhar um arquivo que
  enviou
- **THEN** é informado de que a concessão de permissão é ação da administração e
  de que deve solicitá-la

### Requirement: Organização navegável por perfil de usuário

O manual SHALL ser organizado em páginas por assunto, agrupadas pelos perfis
definidos no produto — colaborador, administrador de unidade e administrador
global —, de modo que cada pessoa alcance o que lhe diz respeito sem percorrer
orientações de outro perfil. O conjunto SHALL preservar uma seção de referência
com o resumo de tarefas e as perguntas frequentes. A navegação SHALL ser
explícita, não derivada apenas da ordem alfabética dos arquivos. Referência:
design.md D3.

#### Scenario: Leitor alcança o assunto pelo perfil
- **WHEN** um administrador de unidade procura como conceder uma permissão
- **THEN** encontra o assunto agrupado sob a seção do seu perfil

#### Scenario: Conteúdo comum permanece acessível a todos os perfis
- **WHEN** qualquer pessoa procura como trocar a própria senha
- **THEN** encontra a orientação sem depender de ser administrador

### Requirement: Limites operacionais apresentados como padrões da implantação

O manual SHALL apresentar os limites operacionais configuráveis — cota de
armazenamento por pessoa, prazo de retenção da lixeira, tetos de quantidade e
tamanho do download compactado e antecedência do aviso de expiração — informando
seus valores vigentes e deixando explícito que são **padrões da implantação**,
ajustáveis por configuração de ambiente. Esses valores NÃO SHALL ser afirmados
como constantes imutáveis do produto. O endereço de acesso à aplicação SHALL ser
identificado como o endereço da implantação em questão, e não como endereço único
do produto. Referência: design.md D9.

#### Scenario: Limite é apresentado com sua natureza configurável
- **WHEN** o usuário consulta a cota de armazenamento no manual
- **THEN** encontra o valor vigente acompanhado da ressalva de que é o padrão
  desta implantação

#### Scenario: Endereço não é apresentado como único do produto
- **WHEN** o usuário consulta como acessar a aplicação
- **THEN** o endereço é identificado como o desta implantação

### Requirement: Publicação automatizada do manual como site

O manual SHALL ser publicado automaticamente como site estático navegável a
partir do repositório, sem etapa manual de publicação a cada alteração. A
publicação SHALL ocorrer quando uma alteração do manual chega à branch principal,
e NÃO SHALL ser disparada por alterações que não tocam o manual. O artefato
publicado SHALL ser gerado a partir do commit correspondente, sem que HTML gerado
seja versionado no repositório. Referência: design.md D5, D7.

#### Scenario: Alteração do manual publica o site
- **WHEN** uma alteração no manual é integrada à branch principal
- **THEN** o site é reconstruído e publicado com o conteúdo daquele commit

#### Scenario: Alteração de código não republica o manual
- **WHEN** uma alteração que não toca o manual é integrada à branch principal
- **THEN** a publicação do site não é disparada

#### Scenario: Site publicado não é versionado como HTML
- **WHEN** o site é publicado
- **THEN** nenhum arquivo gerado do site é adicionado ao histórico do repositório

### Requirement: Integridade dos links verificada antes da integração

A construção do manual SHALL tratar referência interna quebrada como **falha**, e
NÃO SHALL publicar um site cujo build tenha emitido aviso de link ou referência
não resolvida. A verificação SHALL ocorrer também em pull request, antes da
integração, de modo que uma alteração que quebre uma referência interna seja
barrada em vez de publicada. A verificação em pull request NÃO SHALL publicar o
site. Referência: design.md D6.

#### Scenario: Link interno quebrado reprova a verificação
- **WHEN** uma alteração do manual referencia uma página inexistente
- **THEN** a construção falha e a alteração não é integrada

#### Scenario: Verificação em pull request não publica
- **WHEN** a construção do manual é executada para um pull request
- **THEN** o site é construído para verificação, sem ser publicado

### Requirement: Manual alcançável a partir da aplicação autenticada

A aplicação SHALL oferecer, em toda tela do shell autenticado, um acesso
permanente e visível ao manual do usuário, de modo que ninguém dependa de
conhecimento externo sobre a existência ou o endereço da documentação. O
acesso SHALL estar disponível a **qualquer papel**, por ser recurso de apoio e
não item de administração, e NÃO SHALL variar conforme unidade, papel ou
permissão.

O acesso SHALL ser apresentado como **saída da aplicação**, distinguível dos
destinos internos de navegação, e SHALL preservar o estado da tela em que a
pessoa está quando o manual é aberto — consultar a documentação NÃO SHALL
custar o trabalho em curso.

O acesso NÃO SHALL ser oferecido antes da autenticação. Este requisito governa
a **afordância** dentro da aplicação; ele NÃO determina que o conteúdo
publicado seja restrito a pessoas autenticadas.

Referência: design.md D1, D7, D8 do change `acesso-ao-manual-no-shell`.

#### Scenario: Colaborador alcança o manual de qualquer tela
- **WHEN** uma pessoa com papel `collaborator` está autenticada em qualquer
  tela da aplicação
- **THEN** encontra na navegação um acesso ao manual do usuário

#### Scenario: Acesso ao manual não é item de administração
- **WHEN** pessoas de papéis diferentes visualizam o shell autenticado
- **THEN** todas encontram o mesmo acesso ao manual, sem variação por papel

#### Scenario: Consultar o manual não descarta o trabalho em curso
- **WHEN** uma pessoa com uma pasta aberta ou uma busca filtrada aciona o
  acesso ao manual
- **THEN** o manual é apresentado sem que a tela em curso perca seu estado

#### Scenario: Pessoa não autenticada não recebe o acesso
- **WHEN** uma pessoa sem sessão visualiza a tela de login
- **THEN** nenhum acesso ao manual é oferecido nessa tela

### Requirement: Endereço do manual configurado por implantação

O endereço do manual SHALL ser obtido de configuração da implantação, resolvida
em **tempo de execução**, de modo que uma implantação possa apontar para a sua
própria hospedagem do manual sem alteração de código e sem nova compilação do
frontend. O endereço NÃO SHALL ser fixado em tempo de compilação, para que uma
mesma imagem de aplicação sirva implantações distintas.

Quando a implantação **não expressar escolha** sobre o endereço, a aplicação
SHALL adotar o **endereço canônico** do manual publicado por este repositório, e
o acesso SHALL ser apresentado normalmente. Ausência de escolha SHALL abranger
tanto a configuração não definida quanto a configuração definida sem valor —
as duas formas SHALL produzir o mesmo resultado, para que nenhuma camada de
implantação possa anular o padrão apenas por declarar a configuração vazia.

Configurar o endereço SHALL **trocar o destino** do acesso, e NÃO SHALL ser
meio de ligar ou desligar sua apresentação: nenhum valor de configuração SHALL
suprimir o acesso ao manual. Assim, o requisito de alcançabilidade é satisfeito
por padrão em toda implantação, e não apenas naquelas que preenchem a
configuração.

A aplicação SHALL **omitir inteiramente** o acesso ao manual quando a
configuração de apresentação não puder ser obtida, e NÃO SHALL apresentar acesso
desabilitado, mensagem de erro ou referência que não leve a lugar nenhum.

Um endereço configurado com valor inválido SHALL impedir o arranque da
aplicação, com identificação da configuração responsável, em vez de ser
apresentado ao usuário.

Referência: design.md D2, D4, D5 do change `acesso-ao-manual-no-shell`;
design.md D1, D2, D3 do change `corrige-alcance-do-manual`.

#### Scenario: Implantação aponta para a própria hospedagem do manual
- **WHEN** o endereço do manual é alterado na configuração da implantação
- **THEN** o acesso na aplicação passa a levar ao novo endereço sem exigir nova
  compilação do frontend

#### Scenario: Implantação sem configuração alcança o manual canônico
- **WHEN** uma implantação não define o endereço do manual
- **THEN** o shell autenticado apresenta o acesso ao manual, apontando para o
  endereço canônico do manual publicado por este repositório

#### Scenario: Configuração declarada sem valor equivale a não configurada
- **WHEN** uma implantação declara a configuração do endereço do manual com
  valor vazio
- **THEN** o acesso é apresentado apontando para o endereço canônico, sem
  diferença observável em relação a não ter declarado a configuração

#### Scenario: Nenhum valor de configuração suprime o acesso
- **WHEN** qualquer valor válido é atribuído à configuração do endereço do
  manual
- **THEN** o acesso continua sendo apresentado, com o destino correspondente ao
  valor configurado

#### Scenario: Falha ao obter a configuração omite o acesso
- **WHEN** a aplicação não consegue obter a configuração pública
- **THEN** o acesso ao manual é omitido, sem erro exibido ao usuário e sem
  impedir o uso das demais telas

#### Scenario: Endereço inválido é barrado no arranque
- **WHEN** o endereço do manual é configurado com um valor que não é um
  endereço web válido
- **THEN** a aplicação falha ao iniciar, identificando a configuração
  responsável, em vez de renderizar o valor na tela
