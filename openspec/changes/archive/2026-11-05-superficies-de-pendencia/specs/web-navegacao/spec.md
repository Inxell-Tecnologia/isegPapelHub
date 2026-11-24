# Spec Delta

## ADDED Requirements

### Requirement: Explorador sinaliza documento de leitura obrigatória

O explorador SHALL apresentar, na linha do arquivo, um ícone de leitura
obrigatória quando a **revisão vigente** do documento estiver marcada como
leitura obrigatória, pelo veredito apurado pelo servidor na própria listagem. O
ícone SHALL ter nome acessível e dica que digam "Leitura obrigatória". Revisão
vigente sem marcação, documento cuja marcação é de revisão anterior e resposta
sem o veredito NÃO SHALL apresentar o ícone. Referência: PRD US 12.4; demanda
do cliente nº 2, seção 3.5 (Documentos).

#### Scenario: Documento marcado mostra o ícone
- **WHEN** uma pessoa abre a pasta de um documento cuja revisão vigente é de
  leitura obrigatória
- **THEN** a linha do documento apresenta o ícone de leitura obrigatória, com o
  nome acessível correspondente

#### Scenario: Nova revisão sem marcação não mostra o ícone
- **WHEN** um documento marcado é substituído e a revisão nova não é marcada
- **THEN** a linha do documento deixa de apresentar o ícone

#### Scenario: Sem veredito, sem ícone
- **WHEN** a listagem não informa se o documento é de leitura obrigatória
- **THEN** a linha não apresenta o ícone, e a listagem continua sendo exibida
