# Spec Delta

## MODIFIED Requirements

### Requirement: Leitura obrigatória avisa pelo canal de notificação

O canal de notificação SHALL carregar três assuntos de leitura obrigatória:
**nova leitura**, à pessoa do público; **leitura atrasada**, ao leitor; e
**atraso da equipe**, ao gestor. Cada um SHALL ter o seu evento de origem —
a atribuição; a atribuição e o prazo; a marcação e o prazo, respectivamente —
de modo que reemitir não duplique. O sino SHALL apresentar os três; os dois
do leitor SHALL levar à lista das próprias leituras, e o do gestor SHALL levar
ao relatório de acompanhamento da marcação. Referência: PRD US 12.5 e 12.6;
demanda do cliente nº 2, seções 3.2 (etapas 2 e 4) e 3.5 (Sino).

#### Scenario: Sino apresenta a nova leitura com acesso à lista
- **WHEN** a pessoa abre o sino com um aviso de nova leitura obrigatória
- **THEN** lê o documento e o prazo, e encontra o acesso às próprias leituras

#### Scenario: Reexecutar não reavisa
- **WHEN** a rotina de avisos de leitura roda duas vezes no mesmo dia, ou em
  dias seguidos, sobre a mesma leitura atrasada
- **THEN** o leitor tem um único aviso de atraso dela

#### Scenario: Aviso de leitura não atravessa unidade
- **WHEN** a rotina avisa leituras de duas unidades
- **THEN** cada aviso fica na unidade da leitura, e nenhuma pessoa recebe aviso
  sobre pessoa de outra unidade

#### Scenario: Aviso ao gestor leva ao relatório da marcação
- **WHEN** o gestor aciona o aviso de atraso da equipe
- **THEN** abre o acompanhamento no relatório daquela marcação
