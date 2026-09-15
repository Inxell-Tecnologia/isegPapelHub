## ADDED Requirements

### Requirement: Prazo próprio da URL assinada de envio

O sistema SHALL assinar as URLs de envio com um prazo de validade **próprio da
operação de envio**, configurável por ambiente e independente dos prazos de
visualização e de download. Alterar o prazo de download NÃO SHALL alterar o
prazo de envio, e vice-versa.

O prazo de envio SHALL ser compatível com o tempo real de transferência de um
lote — uma pasta inteira pode levar dezenas de minutos numa conexão comum — sem
que isso afrouxe os prazos das operações de leitura. A URL de envio SHALL
continuar autorizando **exclusivamente** a escrita de um único caminho de
objeto, com o tipo de conteúdo fixado na assinatura, sob o prefixo de unidade e
de dono já reservado; ela NÃO SHALL autorizar leitura de conteúdo algum nem
alcançar qualquer outro objeto. Referência: design.md D3 do change
`corrige-defeitos-envio-lote`.

#### Scenario: Prazo de envio é independente do de download
- **WHEN** o prazo da URL de download é alterado por configuração
- **THEN** o prazo das URLs de envio permanece o que sua própria configuração
  determina

#### Scenario: URL de envio não dá acesso de leitura
- **WHEN** alguém de posse de uma URL assinada de envio tenta usá-la para ler o
  conteúdo do objeto
- **THEN** a leitura é negada, porque a assinatura autoriza apenas a escrita
  daquele caminho de objeto
