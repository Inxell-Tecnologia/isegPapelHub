# Spec Delta

## MODIFIED Requirements

### Requirement: Reserva de cota consciente do lote

Ao pré-checar a **cota efetiva** do usuário (capability `cota-individual`) para um
lote, o sistema SHALL considerar a soma dos tamanhos declarados dos itens do próprio
lote **e** dos envios ainda pendentes do mesmo usuário, não apenas o volume já
finalizado (`storage_used_bytes`). Os itens que couberem dentro do limite SHALL
receber URL; os que ultrapassarem o limite SHALL ser sinalizados com erro de cota,
sem impedir os itens que couberem. Nenhuma linha de arquivo SHALL ser inserida para
um item recusado por cota.

O limite aplicado SHALL ser o da pessoa que envia — sua exceção nominal quando
houver, o padrão da plataforma quando não houver —, e NÃO SHALL ser um valor fixo
do produto. Referência: PRD US 3.1, US 8.1.

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
