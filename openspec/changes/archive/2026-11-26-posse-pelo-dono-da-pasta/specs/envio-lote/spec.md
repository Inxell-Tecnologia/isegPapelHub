# Spec Delta

## MODIFIED Requirements

### Requirement: Reserva de cota consciente do lote

Ao pré-checar a **cota efetiva** (capability `cota-individual`) para um lote, o
sistema SHALL considerar, **para cada futuro dono** dos itens (capability
`posse-e-autoria`), a soma dos tamanhos declarados dos itens do próprio lote que
lhe pertencerão **e** dos envios ainda pendentes cujo dono é essa mesma pessoa,
não apenas o volume já finalizado (`storage_used_bytes`). Os itens que couberem
dentro do limite do seu futuro dono SHALL receber URL; os que ultrapassarem o
limite SHALL ser sinalizados com erro de cota, sem impedir os itens que couberem.
Nenhuma linha de arquivo SHALL ser inserida para um item recusado por cota.

O limite aplicado SHALL ser o do **futuro dono** de cada item — sua exceção
nominal quando houver, o padrão da plataforma quando não houver —, e NÃO SHALL ser
um valor fixo do produto. Quando o futuro dono é quem envia, o comportamento é o
mesmo de antes. Quando é outra pessoa, o erro do item SHALL ser distinguível do
erro de cota própria e NÃO SHALL revelar valores da cota alheia. Referência: PRD
US 3.1, US 8.1; change `posse-pelo-dono-da-pasta`.

#### Scenario: Lote que excede a cota no conjunto
- **WHEN** os arquivos do lote cabem individualmente, mas a soma deles (com os envios
  pendentes) ultrapassa a cota efetiva do usuário
- **THEN** os primeiros itens que couberem recebem URL e os que excederem o limite são
  recusados com erro de cota, sem que nenhuma linha seja inserida para os recusados

#### Scenario: Item recusado por cota não consome reserva
- **WHEN** um item do lote é recusado por cota
- **THEN** nenhuma linha `pending` é criada para ele e o volume reservado do usuário
  não é acrescido por esse item

#### Scenario: Lote de quem tem exceção nominal usa o limite da exceção
- **WHEN** um usuário com exceção nominal acima do padrão da plataforma envia um lote
  cuja soma ultrapassa o padrão, mas cabe na sua exceção
- **THEN** todos os itens do lote recebem URL, sem recusa por cota

#### Scenario: Lote para a pasta de outra pessoa usa a cota dela
- **WHEN** um colaborador com pouco espaço próprio envia um lote para a pasta de
  Daniel, e o lote cabe no espaço de Daniel
- **THEN** todos os itens recebem URL, e a reserva é contabilizada em Daniel, não no
  colaborador

#### Scenario: Espaço do dono insuficiente
- **WHEN** um colaborador envia um lote para a pasta de Daniel e o espaço de Daniel
  não comporta parte dos itens
- **THEN** os itens que excedem são recusados com um erro que indica falta de espaço
  do dono da pasta, sem informar cota, consumo ou disponível de Daniel
