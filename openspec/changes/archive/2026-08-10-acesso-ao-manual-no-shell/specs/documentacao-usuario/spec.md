# Spec — documentacao-usuario (delta)

A capability trata hoje da **produção e da publicação** do manual: fonte
única, fidelidade à interface, organização por perfil, publicação
automatizada e integridade de links. Falta a etapa final da entrega — a
**chegada** do manual a quem o usa. Um manual publicado que o usuário não
encontra falha no propósito da capability, por melhor que seja o conteúdo.

Este delta acrescenta a obrigação de alcançabilidade a partir da aplicação.
Ver design.md D1, D2, D4, D7.

## ADDED Requirements

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

Referência: design.md D1, D7, D8.

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

Quando o endereço NÃO estiver configurado, a aplicação SHALL **omitir
inteiramente** o acesso ao manual, e NÃO SHALL apresentar acesso desabilitado,
mensagem de erro ou referência que não leve a lugar nenhum. A mesma omissão
SHALL ocorrer quando a configuração não puder ser obtida.

Um endereço configurado com valor inválido SHALL impedir o arranque da
aplicação, com identificação da configuração responsável, em vez de ser
apresentado ao usuário.

Referência: design.md D2, D4, D5.

#### Scenario: Implantação aponta para a própria hospedagem do manual
- **WHEN** o endereço do manual é alterado na configuração da implantação
- **THEN** o acesso na aplicação passa a levar ao novo endereço sem exigir nova
  compilação do frontend

#### Scenario: Sem endereço configurado não há acesso apresentado
- **WHEN** uma implantação não configura o endereço do manual
- **THEN** o shell autenticado não apresenta acesso ao manual, e nenhum link
  morto é exibido

#### Scenario: Falha ao obter a configuração omite o acesso
- **WHEN** a aplicação não consegue obter a configuração pública
- **THEN** o acesso ao manual é omitido, sem erro exibido ao usuário e sem
  impedir o uso das demais telas

#### Scenario: Endereço inválido é barrado no arranque
- **WHEN** o endereço do manual é configurado com um valor que não é um
  endereço web válido
- **THEN** a aplicação falha ao iniciar, identificando a configuração
  responsável, em vez de renderizar o valor na tela
