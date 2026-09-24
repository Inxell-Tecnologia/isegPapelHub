# Spec Delta

## ADDED Requirements

### Requirement: Campo de cota individual restrito ao administrador global

A SPA SHALL apresentar, no formulário de edição de pessoa, um campo de **cota
individual de armazenamento** visível e editável **somente** para quem tem papel
`global_admin`. Para `unit_admin` o campo NÃO SHALL aparecer, nem como
somente-leitura desabilitado que sugira uma permissão inexistente.

A trava na interface SHALL ser espelho da regra do servidor, nunca a linha de
defesa: a SPA NÃO SHALL inferir autorização própria, e um `403` do servidor
SHALL ser tratado como recusa legítima, preservando o preenchimento do
formulário.

O campo SHALL ser expresso em **GB** na interface, convertendo para a unidade do
contrato da API ao enviar, e SHALL permitir devolver a pessoa ao **padrão da
plataforma** sem exigir que o administrador conheça ou digite o valor do padrão.

#### Scenario: Administrador global vê e edita a cota
- **WHEN** um `global_admin` abre o formulário de edição de uma pessoa
- **THEN** o campo de cota individual aparece preenchido com a cota vigente e
  pode ser alterado

#### Scenario: Administrador de unidade não vê o campo
- **WHEN** um `unit_admin` abre o formulário de edição de uma pessoa da sua
  unidade
- **THEN** o campo de cota individual não é apresentado, e os demais campos
  seguem editáveis

#### Scenario: Voltar ao padrão da plataforma
- **WHEN** um `global_admin` opta por devolver a pessoa ao padrão da plataforma
- **THEN** a SPA envia a remoção da exceção, sem exigir a digitação de um valor

#### Scenario: Recusa do servidor não descarta o preenchimento
- **WHEN** o servidor recusa a edição com `403`
- **THEN** a SPA informa a recusa e mantém os dados já digitados no formulário

### Requirement: Consumo atual exibido ao lado da cota

A SPA SHALL exibir, junto do campo de cota individual, o **volume de
armazenamento já utilizado** pela pessoa, para que a decisão de cota seja tomada
com o consumo à vista. A SPA SHALL indicar de forma explícita quando a pessoa
**segue o padrão da plataforma**, distinguindo esse estado de uma exceção
nominal cujo valor coincida com o padrão.

A SPA SHALL sinalizar quando o valor informado for **menor que o consumo atual**,
explicando que a pessoa ficará impedida de enviar e substituir arquivos até
liberar espaço, sem impedir a confirmação — a decisão é do administrador.

#### Scenario: Consumo visível na edição
- **WHEN** um `global_admin` abre o formulário de edição de uma pessoa
- **THEN** vê o volume já utilizado por ela ao lado do campo de cota

#### Scenario: Pessoa sem exceção é identificada como padrão da plataforma
- **WHEN** a pessoa não tem exceção nominal
- **THEN** a SPA indica que ela segue o padrão da plataforma, e não um valor
  próprio

#### Scenario: Aviso ao definir cota abaixo do consumo
- **WHEN** o administrador informa uma cota menor que o volume já utilizado pela
  pessoa
- **THEN** a SPA avisa que a pessoa ficará bloqueada para novos envios e
  substituições, e ainda assim permite confirmar
