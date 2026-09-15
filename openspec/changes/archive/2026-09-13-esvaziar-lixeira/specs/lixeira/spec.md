## ADDED Requirements

### Requirement: Expurgo imediato dos próprios arquivos na lixeira

O sistema SHALL permitir que uma pessoa apague **permanentemente**, sob demanda e
sem aguardar o prazo de retenção, os **arquivos de que ela é dona** que se
encontram na lixeira, devolvendo-lhe a cota correspondente ao tamanho de cada
arquivo apagado. A operação SHALL ser irreversível: os arquivos apagados NÃO
SHALL poder ser restaurados.

A operação SHALL alcançar **exclusivamente arquivos do próprio solicitante**.
Arquivos de outra pessoa da mesma unidade NÃO SHALL ser afetados, e arquivos de
outra unidade SHALL permanecer inalcançáveis. Administrador de unidade e
administrador global NÃO SHALL dispor, por esta operação, de expurgo sobre a
lixeira de terceiro — a cota é pessoal, e a operação existe para que cada pessoa
administre a própria.

A operação SHALL afetar **apenas arquivos**, nunca pastas: pastas não ocupam
bytes e não devolvem cota, e as pastas na lixeira SHALL permanecer sujeitas
exclusivamente ao expurgo automático por decurso de prazo.

A operação SHALL seguir a mesma sequência do expurgo automático — remover os
bytes do objeto, e o do objeto órfão de substituição quando houver, **antes** de
apagar a linha, devolver a cota ao dono e apagar metadados, auditoria do arquivo
e grants órfãos — e SHALL ser tolerante a falha por item: a falha ao apagar um
arquivo NÃO SHALL impedir o expurgo dos demais, e o arquivo que falhou SHALL
permanecer íntegro na lixeira. A resposta SHALL informar quantos arquivos foram
apagados, quanto espaço foi devolvido e quantos falharam.

A operação SHALL ser precedida de confirmação explícita que informe **quantos
arquivos** serão apagados, **quanto espaço** retorna e que a ação **não tem
volta** — uma confirmação genérica não permite avaliar a troca. Nada SHALL ser
apagado antes da confirmação. Concluído o expurgo, o espaço recuperado SHALL
aparecer de imediato, sem recarregar a página.

O expurgo automático diário por decurso de prazo SHALL permanecer em vigor, sem
alteração: a forma sob demanda o acompanha, não o substitui. Referência: PRD
Épico 6 / US 6.2; RF #12, RF #13; design.md D1/D2/D3/D4 do change
`esvaziar-lixeira`.

#### Scenario: Esvaziar a própria lixeira devolve cota na hora
- **WHEN** uma pessoa esvazia sua lixeira, contendo arquivos ainda dentro do
  prazo de retenção
- **THEN** os arquivos são apagados permanentemente, seus bytes saem do
  armazenamento e o espaço utilizado da pessoa é reduzido pelo tamanho deles

#### Scenario: Arquivo de outra pessoa não é afetado
- **WHEN** uma pessoa esvazia sua lixeira e há, na lixeira da mesma unidade,
  arquivos de outra pessoa
- **THEN** apenas os arquivos de quem pediu são apagados, e os das demais pessoas
  permanecem restauráveis

#### Scenario: Pastas na lixeira permanecem
- **WHEN** uma pessoa esvazia sua lixeira e há pastas suas na lixeira
- **THEN** as pastas permanecem na lixeira, sujeitas ao expurgo automático por
  decurso de prazo

#### Scenario: Confirmação informa a troca antes de apagar
- **WHEN** a pessoa aciona esvaziar a lixeira
- **THEN** a confirmação informa quantos arquivos serão apagados e quanto espaço
  retorna, avisa que a ação não tem volta, e nada é apagado enquanto ela não
  confirmar

#### Scenario: Falha ao apagar um arquivo não derruba os demais
- **WHEN** a remoção dos bytes de um dos arquivos falha durante o expurgo sob
  demanda
- **THEN** os demais arquivos são apagados normalmente, o que falhou permanece
  íntegro na lixeira, e a resposta informa a quantidade apagada e a que falhou

#### Scenario: Expurgo automático continua valendo
- **WHEN** uma pessoa nunca aciona o expurgo sob demanda
- **THEN** seus itens na lixeira continuam sendo expurgados pela rotina diária ao
  vencer o prazo de retenção
