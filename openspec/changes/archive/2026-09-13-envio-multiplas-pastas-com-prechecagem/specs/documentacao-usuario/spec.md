## ADDED Requirements

### Requirement: Orientação de liberação de espaço fiel ao comportamento da cota

O manual SHALL descrever a liberação de espaço de armazenamento com fidelidade
ao comportamento efetivo do sistema, e NÃO SHALL orientar o usuário a excluir
arquivos como forma de liberar espaço para um envio imediato. A exclusão move o
arquivo para a lixeira sem devolver cota, e o espaço retorna somente com o
expurgo por retenção — de modo que a orientação de excluir produziria uma nova
tentativa de envio idêntica e igualmente recusada.

O manual SHALL informar que o espaço ocupado por arquivos na lixeira permanece
contabilizado na cota até o expurgo, e SHALL indicar o prazo de retenção vigente
remetendo à página de limites da implantação, em vez de fixar o número na prosa.
Referência: design.md D4 do change `envio-multiplas-pastas-com-prechecagem`.

#### Scenario: Manual não promete liberação imediata por exclusão
- **WHEN** o usuário consulta o manual sobre o que fazer ao atingir a cota
- **THEN** não encontra a orientação de excluir arquivos para voltar a enviar de
  imediato

#### Scenario: Manual explica o espaço retido na lixeira
- **WHEN** o usuário consulta o manual sobre cota de armazenamento
- **THEN** é informado de que arquivos na lixeira continuam ocupando cota até o
  expurgo, com o prazo remetido à página de limites
