## MODIFIED Requirements

### Requirement: Provisionamento idempotente do ambiente de desenvolvimento

O sistema SHALL prover um hook de início de sessão que provisione a infraestrutura
de desenvolvimento de forma idempotente e reproduzível a cada sessão efêmera.

A idempotência SHALL significar **convergência para o estado esperado**, e não
ausência de ação quando algum artefato já existe. Em particular, a configuração
de ambiente local SHALL convergir para o conjunto de chaves declarado no arquivo
de exemplo do repositório: uma chave presente no exemplo e ausente na
configuração local SHALL ser acrescentada com o valor do exemplo, de modo que
uma configuração criada antes da introdução de uma variável não deixe a
funcionalidade correspondente desligada em desenvolvimento.

A convergência NÃO SHALL sobrescrever valores já definidos localmente, NÃO SHALL
remover chaves ausentes do exemplo e NÃO SHALL reordenar ou reescrever o
conteúdo preexistente — a configuração local permanece sob controle de quem
desenvolve, e o hook apenas completa o que falta.

#### Scenario: Provisionamento repetível

- **WHEN** o hook de início de sessão executa em uma sessão nova
- **THEN** ele instala dependências, sobe o banco local, aplica migrações, executa
  seed apenas se necessário e sobe o emulador de storage com o bucket criado,
  deixando testes e linters aptos a rodar.

#### Scenario: Reexecução sem efeito colateral

- **WHEN** o hook executa novamente com os serviços já no ar
- **THEN** ele detecta o estado atual e não duplica serviços nem recria dados de seed.

#### Scenario: Chave nova do exemplo alcança a configuração local existente

- **WHEN** o hook executa em um ambiente cuja configuração local foi criada antes
  da introdução de uma variável hoje presente no arquivo de exemplo
- **THEN** a chave ausente é acrescentada com o valor do exemplo, e a
  funcionalidade que depende dela opera em desenvolvimento como opera em produção

#### Scenario: Valor local preenchido não é sobrescrito

- **WHEN** o hook executa em um ambiente cuja configuração local define uma
  chave com valor diferente do arquivo de exemplo
- **THEN** o valor local é preservado, e o valor do exemplo não o substitui
