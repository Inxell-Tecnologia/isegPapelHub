# Spec Delta

## ADDED Requirements

### Requirement: Tour guiado apresenta as áreas da tela inicial

O sistema SHALL oferecer um tour guiado, de cerca de dois minutos, que apresenta
uma a uma as áreas da tela inicial e do seu entorno — navegação, busca, envio de
documento, avisos, atalhos, pastas da unidade, documentos recentes, coluna de
leitura obrigatória e ajuda —, com avanço, retorno e encerramento a qualquer
momento, operáveis pelo teclado. O tour NÃO SHALL começar sozinho. Referência:
PRD US 11.3; demanda do cliente nº 2, tabelas 1.1 e 1.3.

#### Scenario: O tour percorre as áreas em sequência
- **WHEN** uma pessoa começa o tour
- **THEN** cada passo destaca uma área da tela com a explicação dela, e a pessoa
  avança, volta ou encerra quando quiser

#### Scenario: O tour não interrompe o primeiro acesso
- **WHEN** uma pessoa entra pela primeira vez
- **THEN** o tour não começa sem que ela o acione

### Requirement: O tour só aponta o que a pessoa vê

Cada passo SHALL ser apresentado somente quando a área a que se refere estiver
presente na tela de quem faz o tour. Passo cuja área não esteja presente — pelo
papel, pela largura da tela ou pela configuração da implantação — SHALL ser
omitido, e o tour NÃO SHALL apontar para área ausente. Referência: PRD US 11.3.

#### Scenario: Passo sem área é omitido
- **WHEN** a implantação não tem manual configurado e a pessoa começa o tour
- **THEN** o passo da ajuda não é apresentado, e os demais seguem normalmente

#### Scenario: Na forma estreita o tour aponta o acionador do menu
- **WHEN** uma pessoa começa o tour numa tela estreita, em que o menu lateral não
  está presente
- **THEN** o passo da navegação aponta o botão que abre o menu

### Requirement: O tour é acionável pelo menu e pela saudação, uma vez por pedido

O tour SHALL ser acionável pelo item **Tour guiado** do grupo AJUDA, a partir de
qualquer tela, e pelo convite da saudação. Os dois acionadores SHALL conduzir à
tela inicial com um pedido de tour no endereço, atendido uma única vez:
recarregar a tela ou voltar a ela pelo histórico NÃO SHALL reabrir o tour.
Referência: PRD US 11.3.

#### Scenario: Acionado de outra tela, o tour começa na tela inicial
- **WHEN** uma pessoa que está nos documentos aciona Tour guiado no menu
- **THEN** a tela inicial é apresentada e o tour começa

#### Scenario: O pedido de tour não se repete
- **WHEN** uma pessoa começa o tour e depois recarrega a tela
- **THEN** o tour não começa outra vez

### Requirement: O sistema lembra, por pessoa, que o tour foi feito

Concluir ou encerrar o tour SHALL registrar, na conta da pessoa, que ela o fez,
e esse registro SHALL valer em qualquer dispositivo em que ela entrar. O
registro SHALL ser feito somente sobre a própria conta, e NÃO SHALL impedir de
refazer o tour pelo menu. Referência: PRD US 11.3.

#### Scenario: Encerrar no meio também registra
- **WHEN** uma pessoa fecha o tour antes do último passo
- **THEN** o convite da saudação deixa de aparecer para ela

#### Scenario: O registro acompanha a pessoa, não o dispositivo
- **WHEN** uma pessoa que fez o tour entra por outro computador
- **THEN** o convite da saudação não aparece

#### Scenario: Refazer continua possível
- **WHEN** uma pessoa que já fez o tour aciona Tour guiado no menu
- **THEN** o tour começa normalmente
