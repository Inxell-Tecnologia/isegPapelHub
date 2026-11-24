# autenticacao Specification

## Purpose

Define os requisitos verificáveis de autenticação por usuário e senha do
GDoc — emissão e verificação de sessão, origem do segredo de sessão, e como
a identidade autenticada alimenta o contexto de tenant (RLS) em cada
requisição. Implementa o Épico 1 / US 1.2 do PRD (`docs/prd_final.md`); os
cenários Given/When/Then da US 1.2 são vinculantes e este spec os torna
verificáveis no backend sem os re-descrever.

## Requirements

### Requirement: Autenticação por usuário e senha

O sistema SHALL autenticar uma pessoa por e-mail e senha em `POST /auth/login`,
verificando a senha contra o hash argon2 armazenado, e SHALL emitir uma sessão
apenas quando a conta existir, a senha conferir e a conta estiver ativa. Referência:
PRD US 1.2.

#### Scenario: Login válido emite sessão

- **WHEN** uma pessoa com conta ativa envia e-mail e senha corretos
- **THEN** o sistema responde com sucesso e estabelece uma sessão autenticada
  (cookie `HttpOnly`), e as requisições seguintes são reconhecidas como dessa
  pessoa

#### Scenario: Credenciais inválidas não revelam a causa

- **WHEN** o e-mail não existe **ou** a senha está incorreta
- **THEN** o sistema nega o acesso com uma resposta única e genérica, sem indicar se
  o problema foi o usuário ou a senha, e nenhuma sessão é emitida

#### Scenario: Conta desativada não autentica

- **WHEN** a pessoa tem `status = 'disabled'` e envia credenciais corretas
- **THEN** o acesso é negado com aviso de conta indisponível e nenhuma sessão é
  emitida

### Requirement: Segredo de sessão sempre via SecretsPort

O sistema SHALL assinar e verificar a sessão usando `AUTH_SESSION_SECRET` obtido
através do `SecretsPort` (Secret Manager em produção, `.env` em desenvolvimento), e
SHALL NEVER ler esse segredo diretamente de `process.env` na lógica de negócio.

#### Scenario: Origem do segredo por ambiente

- **WHEN** a API emite ou verifica uma sessão em produção
- **THEN** o segredo é resolvido pelo `SecretsPort` a partir do Secret Manager, sem
  qualquer chave de sessão embutida no código ou lida direto do ambiente pela rota

### Requirement: Identidade autenticada alimenta o contexto de tenant

O sistema SHALL resolver a identidade da requisição a partir da sessão autenticada
(substituindo o header placeholder `x-gdoc-user-id`) e SHALL popular o contexto de
tenant relendo `unit_id`, papel e status da pessoa no banco a cada requisição,
mantendo o mecanismo de `SET LOCAL app.current_unit` / `app.user_role` por
transação. Uma sessão válida cujo dono foi desativado ou removido SHALL ser
recusada.

A sessão emitida SHALL registrar o **instante de sua emissão**, e a mesma releitura
por requisição SHALL trazer o instante da última mudança de senha da pessoa: uma
sessão emitida **antes** dessa mudança SHALL ser recusada, no mesmo ponto em que se
recusa a sessão de conta desativada. Uma sessão que não registre seu instante de
emissão SHALL ser tratada como inválida (fail-closed). Referência: design.md
(troca-de-senha) D1/D3.

#### Scenario: Requisição autenticada abre transação com contexto correto

- **WHEN** uma requisição a uma rota protegida chega com sessão válida de uma pessoa
  ativa
- **THEN** o sistema resolve `unit_id` e papel do banco e executa a operação sob
  `SET LOCAL` desse contexto (nunca `SET` de sessão), com a RLS como fronteira real

#### Scenario: Sessão válida de conta desativada é recusada

- **WHEN** chega uma requisição com sessão ainda não expirada, porém o dono foi
  desativado após a emissão
- **THEN** o acesso é negado na revalidação por requisição, sem depender de expirar
  o token

#### Scenario: Sessão anterior à última mudança de senha é recusada

- **WHEN** chega uma requisição com sessão ainda não expirada, porém emitida antes
  da última mudança de senha do seu dono
- **THEN** o acesso é negado na revalidação por requisição, sem depender de expirar
  o token e sem consultar qualquer registro de sessão no servidor

#### Scenario: Sessão sem instante de emissão é recusada

- **WHEN** chega uma requisição com sessão cujo formato não registra o instante de
  emissão
- **THEN** a sessão é tratada como inválida e o acesso é negado

#### Scenario: Requisição sem sessão é rejeitada

- **WHEN** uma rota protegida é acessada sem sessão válida
- **THEN** o sistema responde não autenticado e não executa a operação

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

### Requirement: Encerramento de sessão

O sistema SHALL expor `POST /auth/logout` que encerra a sessão corrente, e `GET
/auth/me` que devolve a identidade autenticada (id, unidade, papel) da requisição.

#### Scenario: Logout encerra a sessão

- **WHEN** uma pessoa autenticada chama `POST /auth/logout`
- **THEN** a sessão é encerrada (cookie limpo) e requisições seguintes a rotas
  protegidas são tratadas como não autenticadas

#### Scenario: Consulta da própria identidade

- **WHEN** uma pessoa autenticada chama `GET /auth/me`
- **THEN** o sistema devolve seu id, unidade e papel, sem expor senha ou hash
