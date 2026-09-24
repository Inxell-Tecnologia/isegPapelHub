# Spec Delta

## MODIFIED Requirements

### Requirement: Espaço utilizado consistente com a cota

O bloco de espaço do painel SHALL derivar do mesmo contador que governa o
bloqueio de envio da cota por pessoa (US 8.1): o espaço utilizado SHALL ser a
soma do espaço consumido por pessoa (`storage_used_bytes`) no alcance, a
capacidade total SHALL ser a **soma das cotas efetivas** das pessoas no alcance
— a exceção nominal de quem a tiver, o padrão da plataforma para as demais
(capability `cota-individual`) — e o espaço disponível SHALL ser a capacidade
total menos o utilizado (nunca negativo). O painel NÃO SHALL alterar a regra de
cota; apenas a lê.

A capacidade NÃO SHALL ser obtida multiplicando uma cota única pela quantidade
de pessoas, pois isso deixaria de refletir a capacidade real assim que existisse
qualquer exceção nominal no alcance. O painel SHALL continuar informando a cota
padrão da plataforma como referência, distinta da capacidade total.

#### Scenario: Espaço utilizado versus disponível
- **WHEN** o administrador solicita o painel
- **THEN** o bloco de espaço apresenta o utilizado e o disponível a partir do
  espaço consumido por pessoa e das cotas efetivas do alcance, de forma coerente
  com o limite que bloqueia novos envios

#### Scenario: Alcance sem pessoas
- **WHEN** o alcance do solicitante não contém nenhuma pessoa
- **THEN** a capacidade total e o percentual da cota são zero, sem erro de
  divisão

#### Scenario: Exceção nominal é somada à capacidade
- **WHEN** uma pessoa do alcance tem exceção nominal de cota
- **THEN** a capacidade total do painel reflete a cota dessa pessoa, e não o
  padrão da plataforma aplicado a ela
