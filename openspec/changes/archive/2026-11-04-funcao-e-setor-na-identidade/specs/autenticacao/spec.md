# Spec Delta

## MODIFIED Requirements

### Requirement: Identidade devolvida à interface carrega nome, unidade, função e setor

O sistema SHALL incluir, na identidade devolvida à interface pelo login e pela
consulta da sessão corrente, o nome da pessoa, o nome da sua unidade, a sua
**função/cargo** e o nome do seu **setor**, além dos valores já devolvidos.
Todos SHALL ser resolvidos na mesma releitura por requisição que já alimenta o
contexto de tenant, nunca a partir do token. Conta sem nome cadastrado SHALL
devolver o nome vazio; conta sem função e conta sem setor SHALL devolvê-los
igualmente vazios — mantendo a forma da resposta estável em todos os casos.
Referência: PRD US 11.1; `docs/respostas_a1_funcao_e_setor.txt`, resposta 1 (a).

#### Scenario: Sessão corrente devolve nome e unidade
- **WHEN** uma pessoa autenticada consulta a identidade da sua sessão
- **THEN** recebe, além do que já recebia, o seu nome, o nome da sua unidade, a
  sua função e o seu setor

#### Scenario: Nome alterado no cadastro aparece na requisição seguinte
- **WHEN** o nome de uma pessoa é alterado no cadastro enquanto sua sessão
  segue aberta
- **THEN** a consulta seguinte da identidade devolve o nome novo, sem exigir
  novo login

#### Scenario: Função corrigida no cadastro aparece na requisição seguinte
- **WHEN** a função/cargo ou o setor de uma pessoa é alterado no cadastro
  enquanto sua sessão segue aberta
- **THEN** a consulta seguinte da identidade devolve o valor novo, sem exigir
  novo login, pela mesma releitura por requisição que vale para o nome

#### Scenario: Conta sem nome devolve o campo vazio
- **WHEN** uma pessoa cuja conta não tem nome cadastrado consulta sua identidade
- **THEN** o nome é devolvido vazio, sem substituição por identificador interno

#### Scenario: Conta sem função ou sem setor devolve os campos vazios
- **WHEN** uma pessoa cuja conta não tem função/cargo preenchido, ou não tem
  setor, consulta sua identidade
- **THEN** os campos correspondentes são devolvidos vazios, com a mesma forma de
  resposta das contas que os têm — sem omissão do campo e sem valor inventado

## RENAMED Requirements

- FROM: `### Requirement: Identidade devolvida à interface carrega nome e unidade`
- TO: `### Requirement: Identidade devolvida à interface carrega nome, unidade, função e setor`

O título deixou de cobrir o que o requisito guarda. O que ele protege é a
**origem** dos dados de apresentação da identidade — a releitura por requisição,
nunca o token —, e essa regra passa a valer para quatro valores, não dois. A
função é o dado que o cliente espera ler no lugar do papel de acesso
(`docs/respostas_a1_funcao_e_setor.txt`, resposta 1 (a)) e o setor é o que a
tela inicial apresenta ao lado da unidade.
