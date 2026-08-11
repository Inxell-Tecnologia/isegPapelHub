# platform-infrastructure Specification

## Purpose

Define os requisitos verificáveis da fundação de infraestrutura do GDoc — os
trilhos sobre os quais as épicas do PRD serão construídas. Cobre armazenamento
privado, emissão de URLs assinadas com auditoria, isolamento por unidade,
paridade dev↔prod, segredos, jobs agendados e o pipeline de entrega. Não cobre
nenhuma feature de produto (login, navegador, permissões de negócio, painel),
que virão como mudanças próprias.
## Requirements
### Requirement: Armazenamento privado por padrão

O sistema SHALL armazenar os bytes dos arquivos em um bucket de object storage
sem qualquer acesso público, de modo que os objetos só sejam alcançáveis por
credenciais emitidas pelo backend após checagem de permissão.

#### Scenario: Bucket sem acesso público

- **WHEN** a infraestrutura de produção é provisionada
- **THEN** o bucket usa acesso uniforme em nível de bucket, não possui nenhum
  binding para `allUsers`/`allAuthenticatedUsers` e não expõe URL pública de objeto.

#### Scenario: Objeto inacessível sem URL assinada

- **WHEN** um objeto é requisitado diretamente pela sua URL de storage sem uma
  assinatura válida emitida pelo backend
- **THEN** o acesso é negado pelo storage e nenhum byte ou pré-visualização é retornado.

### Requirement: Emissão de URL assinada mediada por permissão e auditada

O sistema SHALL expor endpoints distintos de visualização e de download que,
antes de emitir uma URL assinada, validem a permissão correspondente no servidor
e registrem um evento de auditoria no momento da emissão.

#### Scenario: URL de visualização

- **WHEN** um usuário com permissão de visualizar solicita a URL de um arquivo
- **THEN** o backend registra um evento de auditoria `view` (usuário, arquivo,
  data/hora) e retorna uma URL assinada com disposição `inline` e TTL de ~5 min.

#### Scenario: URL de download

- **WHEN** um usuário com permissão de baixar solicita a URL de um arquivo
- **THEN** o backend registra um evento de auditoria `download` e retorna uma URL
  assinada com disposição `attachment` e TTL de ~15–30 min.

#### Scenario: Solicitação sem permissão

- **WHEN** um usuário sem a permissão exigida solicita a URL de um arquivo
- **THEN** o backend nega a solicitação, não emite URL assinada e não registra
  evento de acesso ao conteúdo.

### Requirement: Controle de cota em upload direto

O sistema SHALL impor a cota de armazenamento por pessoa mesmo quando o upload
é feito direto ao storage, combinando pré-checagem na emissão e reconciliação
após a finalização do objeto. A reconciliação SHALL aceitar o transporte de
notificação usado em produção — a entrega push do Pub/Sub, cujo corpo é o
envelope `{ message: { data } }` com o metadata do objeto do GCS codificado em
base64 — e SHALL autenticar essa notificação antes de tocar em qualquer dado. Ao
reconciliar um objeto recém-finalizado, o sistema SHALL tornar o arquivo
correspondente consultável (status ativo), de modo que um upload concluído deixe
de ficar pendente indefinidamente.

#### Scenario: Pré-checagem bloqueia estouro declarado

- **WHEN** um usuário solicita URL de upload cujo tamanho declarado somado ao uso
  atual excede a cota
- **THEN** o backend recusa a emissão da URL e informa que a cota seria excedida.

#### Scenario: Reconciliação após finalização em produção

- **WHEN** o objeto termina de ser enviado ao storage e a notificação de
  finalização chega no formato de produção (envelope de push do Pub/Sub com o
  metadata do objeto do GCS)
- **THEN** o backend decodifica a notificação, identifica o arquivo pelo caminho
  do objeto, atualiza o uso real da pessoa, torna o arquivo ativo/consultável e
  sinaliza/remove o objeto caso o limite tenha sido ultrapassado.

#### Scenario: Notificação de finalização não autenticada é recusada

- **WHEN** uma requisição chega ao endpoint de finalização sem uma credencial de
  notificação válida (token OIDC ausente, com assinatura inválida ou com audience
  incorreta)
- **THEN** o backend recusa a requisição sem alterar cota nem status de nenhum
  arquivo.

#### Scenario: Notificação de objeto desconhecido é reconhecida sem reprocessar

- **WHEN** a notificação de finalização se refere a um objeto que não corresponde
  a nenhum arquivo pendente (por exemplo, evento duplicado tardio ou objeto já
  reconciliado)
- **THEN** o backend reconhece a notificação como processada — sem reter a
  mensagem em retentativa infinita — e não altera cota nem status.

### Requirement: Isolamento por unidade imposto no banco

O sistema SHALL isolar os dados por unidade no nível do banco de dados via
Row-Level Security sobre uma coluna de unidade, de forma que consultas da
aplicação não possam retornar dados de outra unidade, com exceção do papel de
administrador global.

#### Scenario: Consulta restrita à própria unidade

- **WHEN** uma requisição de um colaborador ou administrador de unidade executa
  qualquer consulta em tabelas com escopo de unidade
- **THEN** o banco retorna apenas linhas cuja unidade corresponde à do usuário,
  mesmo que a consulta da aplicação não filtre explicitamente por unidade.

#### Scenario: Administrador global agrega todas as unidades

- **WHEN** uma requisição de administrador global consulta tabelas com escopo de unidade
- **THEN** as políticas de RLS permitem agregação sobre todas as unidades.

#### Scenario: Contexto de unidade seguro sob pooling

- **WHEN** a aplicação define o contexto de unidade e papel da requisição
- **THEN** ele é aplicado por transação (`SET LOCAL`), não vazando entre requisições
  que compartilham a mesma conexão do pool.

### Requirement: Prefixo de unidade no storage

O sistema SHALL organizar os objetos sob um prefixo por unidade, de modo que o
caminho de qualquer objeto seja derivado do contexto de unidade autenticado.

#### Scenario: Caminho de objeto com prefixo de unidade

- **WHEN** o backend determina o caminho de um objeto para upload
- **THEN** o caminho é prefixado pelo identificador da unidade do usuário
  (ex.: `/{unit_id}/{owner_id}/{uuid}`).

### Requirement: Paridade de ambientes por seams de configuração

O sistema SHALL executar o mesmo código de aplicação nos ambientes de
desenvolvimento (sandbox) e de produção (GCP), trocando apenas configuração,
por meio de interfaces (seams) para storage, banco, segredos e autenticação.

#### Scenario: Storage trocado por configuração

- **WHEN** a aplicação roda no sandbox com o emulador de storage e em produção com
  o storage do GCP
- **THEN** o mesmo código do `StoragePort` opera nos dois ambientes, selecionado
  por variável de ambiente, sem ramificação específica de provedor no código de negócio.

#### Scenario: Isolamento testável no sandbox

- **WHEN** os testes de isolamento por unidade rodam contra o Postgres local do sandbox
- **THEN** as mesmas políticas de RLS de produção são exercidas e um usuário de uma
  unidade não consegue acessar dados de outra.

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

### Requirement: Gestão de segredos e senhas

O sistema SHALL obter segredos de um cofre gerenciado em produção e de configuração
local no desenvolvimento, e SHALL armazenar senhas apenas como hash.

#### Scenario: Origem de segredos por ambiente

- **WHEN** a aplicação inicia em produção
- **THEN** os valores sensíveis vêm do Secret Manager; no sandbox, das variáveis de
  ambiente locais, atrás do mesmo `SecretsPort`.

#### Scenario: Senha nunca em texto puro

- **WHEN** uma senha de usuário é persistida
- **THEN** ela é armazenada como hash (argon2) e nunca em texto puro.

### Requirement: Infraestrutura de jobs agendados

O sistema SHALL prover o encanamento de execução agendada para as rotinas de
retenção e expiração, sem implementar sua lógica de negócio nesta mudança.

#### Scenario: Agendamento provisionado

- **WHEN** a infraestrutura de produção é provisionada
- **THEN** existe um agendador disparando jobs em container, incluindo um disparo
  diário às 03:00, com um alvo de job de exemplo que executa e registra sucesso.

### Requirement: Pipeline de build e deploy

O sistema SHALL prover um pipeline que valide, empacote e publique a imagem da
aplicação e a implante no ambiente de execução gerenciado. O pipeline SHALL
**aplicar as migrações de banco pendentes antes de trocar o tráfego** para a
revisão nova, de modo que a revisão implantada nunca suba contra um schema
desatualizado. A aplicação das migrações SHALL ser idempotente — aplicar somente
as pendentes e ser no-op quando não houver nenhuma — e SHALL rodar como um job em
container reusando a mesma imagem, service account e integração de banco da
aplicação. A **identidade do pipeline SHALL ter permissão para atualizar e
executar o job de migração** (obter/atualizar a imagem do job e disparar sua
execução) e para agir como a service account de runtime que o job reusa; sem essa
permissão o passo de migração falha e a implantação é bloqueada — a concessão
SHALL alcançar o próprio recurso do job, não apenas o serviço da aplicação.

O pipeline SHALL **pular o build, a publicação da imagem e a implantação quando
nenhum dos arquivos alterados na branch alvo tiver efeito sobre o que roda em
produção**. Pertencem a esse conjunto os arquivos de documentação (`*.md`,
`docs/`, artefatos OpenSpec e `LICENSE`), as **definições de workflow de
integração contínua** e o arquivo de **exclusões do controle de versão** — nenhum
deles compõe a imagem do container, altera o schema do banco ou afeta a revisão
implantada. Se qualquer arquivo alterado estiver fora desse conjunto, o pipeline
SHALL implantar normalmente (padrão fail-safe), e o mesmo SHALL valer quando o
conjunto de arquivos alterados não puder ser determinado. Arquivos de código,
de dependências, de configuração de build e de infraestrutura NÃO SHALL pertencer
ao conjunto sob nenhuma hipótese. O gate SHALL residir no pipeline de entrega,
nunca desabilitando as verificações de CI (lint/build/test) que servem de required
check. Referência: design.md D10 do change `manual-usuario-mkdocs`.

#### Scenario: Pipeline ponta a ponta com migrações

- **WHEN** o pipeline roda para uma mudança de código na branch alvo
- **THEN** ele executa lint, build e testes, publica a imagem no registro de
  artefatos, aplica as migrações de banco pendentes e só então implanta o serviço
  no runtime gerenciado.

#### Scenario: Identidade do pipeline pode atualizar e executar o job de migração

- **WHEN** o pipeline chega ao passo de migração e usa sua identidade para
  atualizar a imagem do job de migração e executá-lo
- **THEN** a identidade tem a permissão necessária sobre o recurso do job (obter,
  atualizar e executar) e sobre a service account de runtime que o job reusa, e o
  passo conclui sem erro de permissão.

#### Scenario: Sem migração pendente

- **WHEN** o pipeline roda e não há migração de banco pendente
- **THEN** o passo de migração conclui com sucesso sem alterar o schema (no-op) e
  a implantação prossegue.

#### Scenario: Migração falha aborta a implantação

- **WHEN** a aplicação das migrações pendentes falha
- **THEN** o pipeline interrompe antes do `deploy`, o tráfego permanece na revisão
  anterior e a falha é reportada.

#### Scenario: Merge docs-only não implanta

- **WHEN** o pipeline é acionado por um merge cujos arquivos alterados são todos de
  documentação (`*.md`, `docs/`, artefatos OpenSpec, `LICENSE`)
- **THEN** o pipeline não builda, não publica imagem nem implanta, e registra que
  pulou por não ter efeito em produção.

#### Scenario: Merge que só publica documentação não implanta a aplicação

- **WHEN** o pipeline é acionado por um merge que altera documentação e a
  definição do workflow que a publica, sem tocar código, dependências,
  configuração de build ou infraestrutura
- **THEN** o pipeline não builda, não publica imagem nem implanta, e a única
  consequência do merge é a publicação da documentação.

#### Scenario: Merge misto implanta

- **WHEN** o pipeline é acionado por um merge que altera pelo menos um arquivo fora
  do conjunto sem efeito em produção
- **THEN** o pipeline builda, publica, aplica migrações pendentes e implanta
  normalmente.

#### Scenario: Alteração de código continua implantando mesmo acompanhada de documentação

- **WHEN** o pipeline é acionado por um merge que altera um arquivo de `apps/`,
  `packages/` ou `infra/` junto com vários arquivos de documentação
- **THEN** o pipeline implanta normalmente, sem que o volume de documentação
  altere a classificação.

#### Scenario: Conjunto de arquivos indeterminado implanta

- **WHEN** o pipeline não consegue determinar os arquivos alterados pelo merge
- **THEN** o pipeline implanta normalmente, por padrão fail-safe.

### Requirement: Prova de fundação ponta a ponta

O sistema SHALL incluir uma verificação mínima que exercite storage e banco em
ambos os ambientes, sem implementar qualquer feature do PRD.

#### Scenario: Saúde e fluxo mínimo

- **WHEN** a prova de fundação executa
- **THEN** um endpoint de saúde responde e um fluxo mínimo de upload → emissão de
  URL assinada → download conclui com sucesso, exercitando storage e banco.

### Requirement: CORS do bucket autoriza a origem do SPA em produção

A configuração de CORS do bucket de arquivos SHALL autorizar a(s) origem(ns) do
SPA em produção nos métodos usados pelo upload/download direto (`GET`, `PUT`,
`HEAD`), de modo que o preflight `OPTIONS` do navegador retorne
`Access-Control-Allow-Origin` e a transferência direta ao storage conclua sem ser
bloqueada pela política de CORS. Como em produção a SPA é servida pela própria API
no Cloud Run (mesma origem), a origem autorizada é a(s) URL(s) do serviço Cloud
Run da API; enquanto o serviço for exposto por mais de uma forma de URL, **todas**
SHALL constar na lista de origens autorizadas.

#### Scenario: Upload direto do SPA de produção conclui o preflight

- **WHEN** o SPA carregado a partir de uma URL de produção do serviço Cloud Run
  faz um `PUT` cross-origin de um arquivo na URL assinada emitida pelo backend
- **THEN** o preflight `OPTIONS` do bucket responde com
  `Access-Control-Allow-Origin` correspondente à origem do SPA e o `PUT` dos bytes
  é aceito pelo storage.

#### Scenario: Origem não autorizada continua bloqueada

- **WHEN** uma origem que não é uma origem configurada do SPA tenta um `PUT`/`GET`
  cross-origin no bucket
- **THEN** o bucket não retorna `Access-Control-Allow-Origin` para essa origem e o
  navegador bloqueia a requisição — o CORS não amplia o acesso além das origens
  explicitamente autorizadas, e a privacidade do bucket (sem acesso público)
  permanece intacta.

### Requirement: Postura de backup e recuperação do Cloud SQL de produção

A instância de produção do Cloud SQL SHALL manter **backups automáticos diários
habilitados e retidos** (`backup_configuration.enabled = true`, com retenção de
pelo menos os últimos dias configurados) como durabilidade mínima — backups
NUNCA SHALL ser desligados enquanto a instância operar em produção.

O **Point-in-Time Recovery (PITR)** MAY estar desligado na fase MVP/baixo uso
para economizar o custo do arquivamento contínuo de transaction logs (WAL); nesse
estado o RPO efetivo é o último backup diário (~24h). O PITR SHALL ser reativado
antes de a instância operar com carga/dados de produção que exijam recuperação de
ponto-no-tempo (RPO curto).

O estado do PITR SHALL ser configurado no Terraform (fonte da verdade), nunca por
alteração manual no console/`gcloud` que geraria drift; quando desligado, a
configuração SHALL registrar, por anotação adjacente, que é temporário e o
gatilho de reativação.

#### Scenario: Backups diários permanecem ligados com o PITR desligado

- **WHEN** o PITR está desligado na fase MVP
- **THEN** os backups automáticos diários da instância permanecem habilitados e
  retidos, de modo que ainda é possível restaurar a instância para o estado de um
  dos backups diários mais recentes.

#### Scenario: Estado do PITR reflete o Terraform, sem drift

- **WHEN** o Terraform declara `point_in_time_recovery_enabled = false` (com a
  anotação de reativação) e é aplicado
- **THEN** o estado real da instância em produção reflete o valor declarado, e um
  `terraform plan` subsequente não acusa diferença nessa flag.

#### Scenario: Reativação restabelece a recuperação de ponto-no-tempo

- **WHEN** o sistema atinge o gatilho de reativação (estável, com carga/uso real)
  e o Terraform passa `point_in_time_recovery_enabled` de volta para `true` e é
  aplicado
- **THEN** o PITR volta a ficar ativo na instância e a janela de recuperação de
  ponto-no-tempo passa a acumular a partir da reativação.

### Requirement: Região dos recursos regionais parametrizada e única

A infraestrutura de produção SHALL provisionar todos os recursos regionais
(Cloud Run, Cloud SQL, buckets do Cloud Storage, Artifact Registry, Cloud
Scheduler/Jobs e NEG serverless) a partir de um único parâmetro de região no
Terraform (`var.region`, fonte da verdade) — nenhum recurso SHALL referenciar
região literal. Na fase de testes a região ativa SHALL ser `us-central1`, por
custo; a configuração SHALL registrar, por anotação adjacente ao parâmetro, o
trade-off de latência para usuários no Brasil e o gatilho de reavaliação da
região antes de operar com carga real sensível a latência.

#### Scenario: Região única aplicada a todos os recursos regionais

- **WHEN** a infraestrutura de produção é provisionada com
  `region = "us-central1"`
- **THEN** todos os recursos regionais nascem em `us-central1` e um
  `terraform plan` subsequente não acusa diferença de região em nenhum recurso.

#### Scenario: Anotação de latência e gatilho de retorno

- **WHEN** a região ativa é distante dos usuários por decisão de custo
- **THEN** a definição do parâmetro de região carrega anotação explícita do
  trade-off de latência e do gatilho que dispara a reavaliação (carga/uso real
  sensível a latência), de modo que qualquer troca futura de região encontre o
  registro no próprio ponto de mudança.

### Requirement: Troca de região reconcilia os artefatos derivados da URL do serviço

Uma troca de região da infraestrutura de produção SHALL reconciliar, como parte
da própria mudança, todos os artefatos derivados da URL do serviço Cloud Run —
que muda junto com a região: as origens autorizadas no CORS do bucket de
arquivos (ambas as formas de URL expostas pelo Cloud Run), o audience da
validação OIDC do push do Pub/Sub e a variável de região consumida pelo
pipeline de CI/CD. O ambiente recriado SHALL passar pelo bootstrap do
administrador global (migrações + criação do `global_admin` via Job) antes de
ser considerado operacional, e os invariantes de segurança existentes (bucket
privado, URL assinada só após checagem de permissão, RLS por `unit_id`) SHALL
permanecer válidos sem exceção durante e após a troca.

#### Scenario: Upload direto funcional pelas duas formas de URL

- **WHEN** a troca de região é concluída e a SPA é aberta por qualquer uma das
  duas formas de URL do serviço Cloud Run
- **THEN** o preflight CORS do upload direto ao bucket é aceito e o envio de
  arquivo completa com sucesso.

#### Scenario: Reconciliação de cota ativa no ambiente novo

- **WHEN** um upload é finalizado no bucket recriado com a validação OIDC
  ligada para o audience novo
- **THEN** o push do Pub/Sub é aceito (não 401) e o arquivo sai do estado
  `pending` com a cota do dono reconciliada.

#### Scenario: Pipeline de deploy aponta para a região nova

- **WHEN** o pipeline de CI/CD roda após a troca de região
- **THEN** a imagem é publicada no Artifact Registry da região nova e o deploy
  atualiza o serviço Cloud Run da região nova, sem referência à região antiga.

#### Scenario: Ambiente recriado nasce fail-closed

- **WHEN** a infraestrutura é recriada na região nova e o bootstrap ainda não
  foi executado
- **THEN** não existe nenhuma conta utilizável e um acesso direto a objeto do
  bucket sem URL assinada é negado sem retornar bytes ou preview.

