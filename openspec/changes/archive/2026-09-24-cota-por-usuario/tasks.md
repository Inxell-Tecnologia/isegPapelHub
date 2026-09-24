# Tasks

## 1. Schema e contrato compartilhado

- [x] 1.1 Criar `apps/api/src/db/migrations/0015_user_storage_quota.sql` com
      `ALTER TABLE users ADD COLUMN storage_quota_bytes bigint` (nullable, sem
      default, sem backfill) e verificar que `npm run migrate --workspace apps/api`
      aplica sem erro e que a coluna aceita `NULL` num banco já populado pelo seed
- [x] 1.2 Confirmar que a policy RLS de `users` continua cobrindo a coluna nova
      (nenhuma policy nova é esperada) e verificar rodando
      `npm run test --workspace apps/api -- src/__tests__/rls-isolation.test.ts`
- [x] 1.3 Acrescentar ao DTO de pessoa em `packages/shared/src` o volume utilizado
      e a cota individual (opcional, aceitando remoção explícita), recompilar com
      `npm run build --workspace packages/shared` e verificar que `npm run build`
      na raiz passa com os consumidores enxergando os campos novos

## 2. Resolução da cota efetiva na API

- [x] 2.1 Criar a função de resolução da cota efetiva em `apps/api/src/lib/`
      (exceção nominal quando houver, `config.storageQuotaBytesPerUser` quando
      `NULL`) e verificar com teste unitário cobrindo os três casos: `NULL`, valor
      acima do padrão e valor zero
- [x] 2.2 Passar `GET /files/quota` a usar a cota efetiva, acrescentando a coluna
      à query que já lê `storage_used_bytes`, e verificar com
      `npm run test --workspace apps/api -- src/__tests__/quota-consulta.test.ts`
- [x] 2.3 Passar o envio avulso (`POST /files/upload-url`) e a substituição
      (`POST /files/:id/replace-url`) a usar a cota efetiva e verificar com
      `src/__tests__/file-management.test.ts`
- [x] 2.4 Passar o envio em lote (`POST /files/upload-urls`) a usar a cota efetiva
      na reserva consciente do lote e verificar com
      `src/__tests__/batch-upload.test.ts`
- [x] 2.5 Passar a reconciliação do finalize (`lib/storage-reconcile.ts`) a usar a
      cota efetiva do **dono do arquivo** e verificar com teste que uma pessoa com
      exceção nominal não tem o arquivo marcado `over_quota` num volume que
      estouraria o padrão
- [x] 2.6 Criar `apps/api/src/__tests__/cota-individual.test.ts` cobrindo os
      cenários da spec `cota-individual`: padrão para quem não tem exceção,
      exceção prevalecendo, mudança do padrão não alcançando quem tem exceção, e
      envio autorizado acima do padrão dentro da exceção

## 3. Capacidade agregada do painel

- [x] 3.1 Trocar o cálculo de `capacityBytes` em `apps/api/src/routes/dashboard.ts`
      de `cota × nº de pessoas` para `SUM(COALESCE(storage_quota_bytes, $padrao))`,
      com o padrão vindo do `config` como parâmetro (nunca como default da coluna),
      mantendo `quotaBytesPerUser` como a referência do padrão
- [x] 3.2 Verificar com `npm run test --workspace apps/api -- src/__tests__/dashboard.test.ts`,
      incluindo caso novo em que uma pessoa do alcance tem exceção nominal e a
      capacidade reflete a soma das cotas efetivas
- [x] 3.3 Verificar que o alcance sem pessoas continua devolvendo capacidade e
      percentual zero, sem divisão por zero

## 4. Concessão da exceção pela gestão de pessoas

- [x] 4.1 Incluir `storage_used_bytes` em `PERSON_COLUMNS` e na resposta de pessoa
      em `apps/api/src/routes/users.ts`, verificando que `GET /users` e
      `PATCH /users/:id` passam a devolvê-lo dentro do alcance de cada papel
- [x] 4.2 Aceitar o campo de cota em `PATCH /users/:id` com as três intenções
      (ausente, remoção explícita, valor inteiro ≥ 0) e verificar com teste que
      ausência preserva a cota vigente e que remoção devolve ao padrão
- [x] 4.3 Implementar a guarda fail-closed de `global_admin`: presença do campo
      sem o papel recusa a requisição **inteira** com `403`, sem aplicar os demais
      campos, e verificar com teste que envia cota junto de um campo de perfil
      válido e confirma que nada foi alterado
- [x] 4.4 Validar valor negativo e não inteiro com recusa sem efeito, e verificar
      com teste
- [x] 4.5 Verificar que o alcance entre unidades não mudou, rodando
      `npm run test --workspace apps/api -- src/__tests__/isolamento-unidade.test.ts`
      e acrescentando caso de `unit_admin` que tenta alterar cota de pessoa da
      própria unidade

## 5. Tela de gestão de pessoas

- [x] 5.1 Acrescentar o campo de cota individual ao formulário de pessoa em
      `apps/web/src/pessoas/`, em GB, convertendo para bytes no envio, visível
      apenas para `global_admin`, e verificar com teste de componente que o campo
      não é renderizado para `unit_admin`
- [x] 5.2 Exibir o consumo atual ao lado do campo e indicar explicitamente quando
      a pessoa segue o padrão da plataforma, verificando com teste de componente
- [x] 5.3 Oferecer a ação de devolver a pessoa ao padrão da plataforma sem exigir
      digitar o valor do padrão, e verificar com teste que a SPA envia a remoção
      da exceção
- [x] 5.4 Avisar quando o valor informado for menor que o consumo atual, sem
      impedir a confirmação, e verificar com teste de componente
- [x] 5.5 Tratar `403` do servidor como recusa legítima preservando o
      preenchimento, e verificar com teste que mocka a resposta de erro
- [x] 5.6 Documentar a concessão na página do perfil administrador em
      `docs/manual/docs/`, incluindo a consequência de cota abaixo do consumo e a
      remissão ao comportamento da lixeira, e verificar que a navegação do MkDocs
      referencia a página nova

## 6. Restauração do padrão da plataforma em 10 GiB

- [x] 6.1 (aplicação) Devolver o padrão de `storageQuotaBytesPerUser` em
      `apps/api/src/config.ts` para `10 * 1024 * 1024 * 1024` e verificar que a
      suíte da API passa sem depender do valor literal
- [x] 6.2 (paridade dev) Devolver `STORAGE_QUOTA_BYTES_PER_USER=10737418240` em
      `.env.example` e verificar que o comentário da variável volta a dizer 10 GB
- [x] 6.3 (infraestrutura) Devolver `default = 10737418240` a
      `storage_quota_bytes_per_user` em `infra/terraform/variables.tf` e verificar
      que nenhum outro arquivo do Terraform carrega o valor de 300 GiB
- [x] 6.4 (documentação) Atualizar `docs/manual/docs/referencia/limites.md` com a
      cota de 10 GB apresentada como **padrão sujeito a exceção nominal**, e
      verificar que a página descreve onde a pessoa vê a sua cota efetiva
- [x] 6.5 (documentação) Revisar `docs/custos-gcp/README.md` e a constante
      `COTA_GIB` de `docs/custos-gcp/modelo.py` para o padrão de 10 GiB,
      registrando que exceções nominais deslocam o teto de acervo caso a caso, e
      verificar rodando `python3 docs/custos-gcp/modelo.py`
- [x] 6.6 Corrigir o parêntese de cota em `CLAUDE.md` (seção de tráfego de bytes)
      para refletir o padrão de 10 GB por pessoa com exceção nominal possível

## 7. PRD

- [x] 7.1 Acrescentar a `docs/prd_final.md` o adendo à US 8.1 registrando a
      exceção nominal de cota e que a concessão é exclusiva do administrador
      global, mantendo os 10 GB como o padrão da história, e verificar que os
      demais pontos do PRD que citam a cota continuam coerentes com o adendo

## 8. Verificação de integração

- [x] 8.1 Rodar `npm run lint`, `npm run format:check` e `npm run build` na raiz e
      confirmar saída limpa
- [x] 8.2 Rodar `npm run test` na raiz (API contra Postgres real e web com jsdom) e
      confirmar as duas suítes verdes
- [x] 8.3 Exercitar o caminho ponta a ponta num banco de dev: conceder exceção a
      uma pessoa, confirmar que ela envia acima do padrão, remover a exceção e
      confirmar que ela volta a ser recusada pelo padrão
- [x] 8.4 Rodar `openspec validate cota-por-usuario --strict` e confirmar que a
      implementação cobre todos os cenários das specs desta mudança
