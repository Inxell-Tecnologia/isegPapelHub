## ADDED Requirements

### Requirement: Jobs agendados executam o módulo presente na imagem

Todo job em container que reusa a imagem da aplicação SHALL invocar seu ponto
de entrada por um caminho que exista na imagem publicada, na mesma forma
relativa ao diretório de trabalho da imagem usada pelo comando do serviço.
Um job cujo módulo não existe na imagem NÃO SHALL ser provisionado. Referência:
change `correcoes-herdadas-do-fork`, design.md D1.

#### Scenario: Execução agendada encontra o módulo
- **WHEN** o agendador dispara o expurgo da lixeira, os avisos de permissão ou
  os avisos de leitura obrigatória contra a imagem real da aplicação
- **THEN** o job carrega o seu módulo e executa a rotina, sem falha de
  "módulo não encontrado"

#### Scenario: Execução manual confirma o ponto de entrada
- **WHEN** um job agendado é executado manualmente logo após uma implantação
- **THEN** ele termina com o resultado da rotina registrado nos logs, o que
  confirma o ponto de entrada antes do horário agendado

### Requirement: Criação de recursos de runtime ordenada após o acesso aos segredos

A infraestrutura como código SHALL declarar que o serviço da aplicação e cada
job em container só são criados depois da concessão de leitura dos segredos
que referenciam à service account com que rodam. A criação NÃO SHALL depender
da ordem acidental do provisionamento. Os jobs NÃO SHALL ter proteção de
exclusão no nível da ferramenta de infraestrutura, porque não guardam dado e
podem ser recriados. O serviço da aplicação SHALL manter essa proteção.
Referência: design.md D2.

#### Scenario: Primeiro provisionamento de um projeto vazio
- **WHEN** a infraestrutura é provisionada pela primeira vez num projeto vazio
- **THEN** o serviço e todos os jobs são criados sem erro de permissão
  negada sobre segredo

#### Scenario: Job cuja criação falhou pode ser recriado
- **WHEN** a criação de um job falha e o provisionamento seguinte planeja
  substituí-lo
- **THEN** a substituição é executada, sem ser recusada por proteção de
  exclusão

#### Scenario: Serviço da aplicação continua protegido
- **WHEN** uma alteração de infraestrutura implicaria destruir o serviço da
  aplicação
- **THEN** a destruição é recusada até que a proteção seja retirada de forma
  explícita

### Requirement: Assinatura de finalização de upload não expira por inatividade

A assinatura que entrega à aplicação as notificações de finalização de objeto
SHALL ser configurada sem expiração por inatividade. Um período sem uploads,
de qualquer duração, NÃO SHALL fazer as notificações seguintes serem
descartadas. Referência: design.md D3.

#### Scenario: Upload após longo período sem atividade
- **WHEN** um arquivo é enviado depois de mais de 31 dias sem nenhum upload na
  implantação
- **THEN** a notificação de finalização é entregue, e o arquivo deixa de ficar
  pendente e passa a contar na cota

### Requirement: Implantação pode ser disparada manualmente

O pipeline de implantação SHALL aceitar um disparo manual, além do disparo
pela conclusão da integração contínua na branch alvo. O disparo manual SHALL
implantar o commit correspondente ao ref escolhido e NÃO SHALL ser pulado pela
classificação "sem efeito em produção". Todo passo do pipeline SHALL usar a
mesma referência ao commit implantado, qualquer que seja o gatilho.
Referência: design.md D5.

#### Scenario: Evento de integração perdido
- **WHEN** o disparo automático não ocorreu para o último commit da branch alvo
- **THEN** um disparo manual publica a imagem desse commit, migra o banco e
  implanta o serviço

#### Scenario: Reimplantação sem commit novo
- **WHEN** alguém dispara manualmente a implantação da branch alvo e o último
  merge só alterou documentação
- **THEN** o pipeline builda, migra e implanta mesmo assim
