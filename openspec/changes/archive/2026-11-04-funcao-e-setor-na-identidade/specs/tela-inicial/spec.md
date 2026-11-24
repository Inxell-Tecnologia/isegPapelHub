# Spec Delta

## MODIFIED Requirements

### Requirement: Tela inicial identifica a pessoa pelo nome

A tela inicial SHALL apresentar o nome da pessoa autenticada, a sua **função —
o cargo do cadastro —**, o seu **setor** e a sua unidade. Quando a função não
estiver preenchida, a tela SHALL apresentar, em seu lugar, o rótulo do **papel
de acesso**, pela origem única desse rótulo; quando o setor não existir, SHALL
omiti-lo sem espaço reservado. NÃO SHALL apresentar identificador interno,
fragmento de identificador ou qualquer valor que a pessoa não reconheça como
seu. Referência: PRD US 11.1; demanda do cliente nº 2, seção 1.3;
`docs/respostas_a1_funcao_e_setor.txt`, resposta 1 (a).

#### Scenario: Pessoa vê o próprio nome ao entrar
- **WHEN** uma pessoa autenticada abre a tela inicial
- **THEN** vê seu nome, sua função, seu setor e sua unidade

#### Scenario: Função do cadastro prevalece sobre o papel de acesso
- **WHEN** uma pessoa com cargo preenchido no cadastro — por exemplo "Gerente de
  Governança" — abre a tela inicial, tendo papel de acesso `collaborator`
- **THEN** lê o seu cargo, e **não** o rótulo do papel de acesso

#### Scenario: Conta sem função recorre ao rótulo do papel
- **WHEN** uma pessoa cuja conta não tem cargo preenchido abre a tela inicial
- **THEN** lê o rótulo do seu papel de acesso no lugar da função, com exatamente
  o mesmo texto usado nas demais telas que exibem papel

#### Scenario: Pessoa sem nome cadastrado não vê identificador interno
- **WHEN** uma pessoa cuja conta não tem nome cadastrado abre a tela inicial
- **THEN** a saudação recorre a um tratamento genérico, e em nenhum momento
  apresenta o identificador interno da conta
