# Spec Delta

## ADDED Requirements

### Requirement: Identidade devolvida à interface carrega nome e unidade

O sistema SHALL incluir, na identidade devolvida à interface pelo login e pela
consulta da sessão corrente, o nome da pessoa e o nome da sua unidade, além dos
valores já devolvidos. Ambos SHALL ser resolvidos na mesma releitura por
requisição que já alimenta o contexto de tenant, nunca a partir do token. Conta
sem nome cadastrado SHALL devolver o nome vazio, mantendo a forma da resposta
estável. Referência: PRD US 11.1.

#### Scenario: Sessão corrente devolve nome e unidade
- **WHEN** uma pessoa autenticada consulta a identidade da sua sessão
- **THEN** recebe, além do que já recebia, o seu nome e o nome da sua unidade

#### Scenario: Nome alterado no cadastro aparece na requisição seguinte
- **WHEN** o nome de uma pessoa é alterado no cadastro enquanto sua sessão
  segue aberta
- **THEN** a consulta seguinte da identidade devolve o nome novo, sem exigir
  novo login

#### Scenario: Conta sem nome devolve o campo vazio
- **WHEN** uma pessoa cuja conta não tem nome cadastrado consulta sua identidade
- **THEN** o nome é devolvido vazio, sem substituição por identificador interno
