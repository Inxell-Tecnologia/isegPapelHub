# Spec — platform-infrastructure (delta)

Capability existente. Esta mudança altera **apenas o gate que decide se um merge
implanta**, para que a publicação da documentação não arraste build, migração e
deploy da aplicação. O restante do requisito — migrar antes de trocar o tráfego,
idempotência, permissões da identidade do pipeline, fail-safe — permanece
palavra por palavra como está. Ver design.md D10.

O ajuste é de **precisão do critério**, não de afrouxamento: o gate sempre
respondeu "este merge muda o que roda em produção?", e arquivo de workflow do
GitHub Actions e `.gitignore` não mudam — não entram na imagem do container, não
alteram schema e não afetam a revisão implantada.

## MODIFIED Requirements

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
