# Spec Delta

## ADDED Requirements

### Requirement: Jobs da aplicação acompanham a imagem implantada

A cada implantação, o pipeline SHALL atualizar para a imagem recém-implantada
todo job em container que reusa a imagem da aplicação — os agendados e o de
provisionamento do administrador —, depois da troca de tráfego do serviço. O
pipeline NÃO SHALL executar esses jobs: eles rodam no seu agendamento ou por
acionamento explícito. Referência: change `deploy-atualiza-jobs-agendados`,
design.md D3.

#### Scenario: Deploy alinha a imagem dos jobs à do serviço
- **WHEN** o pipeline implanta uma nova imagem da aplicação
- **THEN** ao final, cada job que reusa a imagem da aplicação aponta para a mesma
  imagem que o serviço passou a servir

#### Scenario: Atualização não dispara os jobs
- **WHEN** o pipeline atualiza a imagem dos jobs
- **THEN** nenhum deles é executado por causa disso, inclusive o de expurgo da
  lixeira

#### Scenario: Falha ao atualizar um job é visível sem desfazer o deploy
- **WHEN** a atualização de um job falha, por permissão ausente ou outro erro
- **THEN** a execução do pipeline termina em falha, nomeando o job, e o serviço
  permanece na revisão recém-implantada

### Requirement: Identidade do pipeline tem permissão por recurso sobre os jobs

A identidade do pipeline SHALL ter permissão sobre cada job que atualiza e sobre a
service account de runtime de cada um, concedida **por recurso**. Ela NÃO SHALL
receber permissão de alcance de projeto para atualizar ou descobrir jobs.
Referência: design.md D1 e D2.

#### Scenario: Atualização conclui sem erro de permissão
- **WHEN** o pipeline atualiza a imagem de um job da lista
- **THEN** a identidade tem a permissão necessária sobre o job e sobre a service
  account com que ele roda, e a atualização conclui sem erro de permissão

#### Scenario: Identidade não enxerga jobs fora da lista
- **WHEN** se inspecionam as permissões da identidade do pipeline
- **THEN** não há concessão de alcance de projeto sobre jobs, apenas concessões
  sobre os recursos declarados

### Requirement: Lista de jobs atualizados pelo deploy tem origem única

O conjunto de jobs que o pipeline atualiza SHALL derivar de uma declaração única
na infraestrutura como código, da qual decorrem também as permissões da
identidade do pipeline sobre esses jobs. Quando a lista entregue ao pipeline
estiver ausente ou vazia, o pipeline SHALL falhar com mensagem que nomeie a
configuração faltante, e NÃO SHALL concluir com sucesso sem atualizar job algum.

#### Scenario: Job novo declarado recebe permissão e entra na lista
- **WHEN** um job que reusa a imagem da aplicação é acrescentado à declaração
- **THEN** a identidade do pipeline passa a ter permissão sobre ele e o job
  aparece na lista exposta para o pipeline, sem outra edição de permissão

#### Scenario: Lista ausente falha alto
- **WHEN** o pipeline chega ao passo de atualização dos jobs sem a lista
  configurada
- **THEN** a execução falha com mensagem que indica qual configuração preencher e
  de onde obter o valor
