# Spec Delta

## ADDED Requirements

### Requirement: Acesso entre unidades auditado na origem, com identificação da pessoa

O servidor SHALL registrar como evento de auditoria na unidade de origem
do arquivo a visualização e o download feitos por compartilhamento entre
unidades. O evento SHALL conservar o nome da pessoa e o nome da unidade dela
no momento do acesso. A consulta de auditoria do arquivo, pelo dono ou pelo
administrador da origem, SHALL exibir esses eventos com o nome e a unidade
da pessoa, mesmo sem ela pertencer à unidade de quem consulta, sem expor o
e-mail dela. Nenhum evento SHALL deixar de aparecer na consulta por a pessoa
ser de outra unidade. Referência: PRD US 5.2, cenário 7; design.md D9.

#### Scenario: Acesso da Raíra aparece na auditoria da SEDE
- **WHEN** a Raíra, da Unidade Norte, visualizou um arquivo compartilhado da
  SEDE e o dono do arquivo consulta a auditoria dele
- **THEN** o evento de visualização aparece com o nome "Raíra Damasceno",
  a unidade "Unidade Norte" e o e-mail ausente

#### Scenario: A unidade de destino não lê a auditoria da origem
- **WHEN** a pessoa do destino tenta consultar a auditoria do arquivo
  compartilhado
- **THEN** a resposta é a mesma recusa dada a quem não é dono nem
  administrador
