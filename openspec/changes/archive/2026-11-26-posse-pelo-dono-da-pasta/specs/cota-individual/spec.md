# Spec Delta

## ADDED Requirements

### Requirement: Envio consome a cota do futuro dono do arquivo

O sistema SHALL decidir sobre espaço, em todo ponto que emite URL de envio ou de substituição de versão, pela cota efetiva e pelo consumo da pessoa que é ou será **dona** do arquivo (capability `posse-e-autoria`), que é a mesma a quem a reconciliação atribui o consumo. Quem envia para pasta de outra pessoa NÃO SHALL ter o próprio espaço consumido.

#### Scenario: Envio para pasta de outra pessoa conta para o dono
- **WHEN** um colaborador envia um arquivo para a pasta de Daniel e o envio é
  reconciliado
- **THEN** o volume é somado ao consumo de Daniel e o consumo do colaborador não muda

#### Scenario: Colaborador sem espaço próprio envia para pasta de quem tem espaço
- **WHEN** um colaborador com a cota própria esgotada envia para a pasta de Daniel,
  que tem espaço
- **THEN** a URL de envio é emitida

#### Scenario: Substituição de versão usa a cota do dono do arquivo
- **WHEN** uma pessoa com concessão `rename` substitui um arquivo de Daniel por uma
  versão maior
- **THEN** a verificação de espaço considera a cota e o consumo de Daniel, pelo
  mesmo delta já usado na reconciliação

### Requirement: Recusa por espaço do dono não revela a cota alheia

O sistema SHALL recusar com um código de erro próprio, distinto da recusa por espaço do solicitante, o envio que não cabe no espaço do dono quando este é outra pessoa. A recusa NÃO SHALL conter cota, consumo, reserva ou disponível do dono, e NÃO SHALL existir rota que devolva esses valores a quem não é o dono nem tem acesso à gestão de pessoas.

#### Scenario: Recusa sem números
- **WHEN** o envio de um colaborador para a pasta de Daniel é recusado por falta de
  espaço de Daniel
- **THEN** a resposta indica apenas que o espaço do dono da pasta é insuficiente,
  sem nenhum valor de cota ou consumo

#### Scenario: Consulta do próprio espaço não muda
- **WHEN** um colaborador consulta o próprio espaço de armazenamento
- **THEN** recebe os valores referentes a si, sem incluir o que enviou para pastas
  de outras pessoas
