# Proposal

## Why

A tela inicial apresenta à gerente de Governança o rótulo **"Colaborador"**. O
cliente reportou isso como defeito de leitura do cadastro (seção 1.3 de
`docs/demanda_cliente_2.md`, "Atenção → Perfil"), mas a conferência no código
mostrou outra coisa: o rótulo está correto para o dado que a tela escolhe
mostrar. O sistema guarda **dois** atributos distintos e a tela mostra o
errado para quem a lê.

- **Papel de acesso** (`users.role`: `collaborator`/`unit_admin`/`global_admin`)
  — define permissão. É o que a linha abaixo da saudação e o cartão do usuário
  exibem hoje, via `ROLE_LABEL`.
- **Função/cargo** (`users.job_title`, texto livre) — "Gerente de Governança".
  Existe ponta a ponta no cadastro de pessoas desde `0003_people_fields.sql`,
  mas **não entra em `AuthenticatedIdentity`**, de modo que nenhuma superfície
  autenticada o alcança.

O cliente respondeu ao questionário `docs/questionario_a1_funcao_e_setor.txt`
(fatia **A1** do plano em `docs/plano_demanda_cliente_2.md`) e fechou as duas
decisões que travavam esta fatia:

- **D2 — resposta 1 (a):** abaixo da saudação aparece **o cargo** da pessoa;
  quando o cargo não estiver preenchido, aí sim o nível de acesso. *"Para quem
  usa o sistema, o cargo é o que faz sentido; 'Colaborador' ou 'Gestor' é coisa
  interna do sistema."*
- **D4 — respostas 5 (a) e 6 (a):** setor **será** critério de público da
  leitura obrigatória e recorte do relatório (*"um POP da CME ou do Centro
  Cirúrgico"*), e é **o mesmo conceito** do campo "Área de trabalho" já
  cadastrado — *"podem aproveitar o que já está cadastrado, só precisa
  padronizar a escrita"*. O cliente aceitou explicitamente o acréscimo de prazo
  que isso traz à Fase 2.

Texto livre não serve de critério de público: "Governança", "governanca" e
"Gov." são três setores para o sistema, e quem estiver digitado de um jeito fica
de fora do envio feito pelo outro. Por isso setor passa a ser **entidade por
unidade**. Fazer isso agora, e não quando a Fase 2 precisar, é o que evita
voltar às fatias A3 (saudação), C1 (público por setor), C3 (aviso ao gestor) e
C4 (relatório por setor) — todas as quatro consomem este dado.

## What Changes

- **Setor vira entidade por unidade.** Tabela `sectors` com `unit_id` e policy
  RLS, nome único por unidade (sem distinção de caixa), e `users.sector_id`
  apontando para ela sob **chave estrangeira composta** `(unit_id, sector_id)`:
  o banco passa a recusar pessoa apontando para setor de outra unidade, não só
  a aplicação.
- **BREAKING (contrato de API): `users.work_area` deixa de existir.** O campo
  `workArea` sai de `CreatePersonRequest`, `UpdatePersonRequest` e
  `PersonResponse`, substituído por `sectorId`/`sectorName`. Pela resposta 6 (a)
  são o mesmo conceito, e manter os dois seria duas fontes para um dado — a
  duplicidade que torna o critério de público inútil. A migração **preserva o
  dado**: cada valor distinto de `work_area` por unidade nasce como um setor, e
  cada pessoa nasce apontando para o seu.
- **A identidade autenticada passa a carregar função e setor.**
  `AuthenticatedIdentity` ganha `jobTitle` e `sectorName`, resolvidos na
  **mesma releitura por requisição** que já alimenta `fullName`/`unitName` — é
  isso que faz um cargo corrigido no cadastro aparecer na requisição seguinte,
  sem novo login.
- **A linha abaixo da saudação e o cartão do usuário passam a apresentar a
  função.** Com o papel de acesso como recurso **de recaída**, não como texto
  principal: conta sem cargo cadastrado continua lendo "Colaborador"/"Gestor",
  pelo mesmo `ROLE_LABEL` de hoje. A linha da tela inicial acrescenta o setor;
  o cartão de 264 px fica em função · unidade, com o setor no texto íntegro.
- **O cadastro de pessoa troca o campo de texto livre por lista fechada.**
  "Área de trabalho" (`Input`) vira "Setor" (`Select`) com os setores da unidade
  da pessoa — e "sem setor" segue sendo um estado válido, porque a lista
  definitiva do cliente ainda não chegou (pergunta 7).
- **A administração mantém a lista de setores da própria unidade** — criar,
  renomear e remover setor sem ninguém apontado. É o que torna a lista fechada
  sustentável: sem isso, um setor novo não teria como entrar, e a padronização
  da escrita pedida na resposta 6 (a) não teria como ser feita.

**Fora de escopo, de propósito:**

- **O papel "Gestor" da seção 3.1 e a relação gestor↔equipe (D3).** As respostas
  3 (b) e 4 (b) — *coordenador e gerente acompanham o próprio setor, diretor
  acompanha a unidade; são papéis diferentes de quem administra* — **não fecham
  D3**: "Gestor" já é o rótulo de `unit_admin` na interface, e
  `nomenclatura-interface` proíbe dois rótulos iguais com alcances diferentes.
  Um dos dois tem de ser renomeado, e isso é decisão do cliente. Esta fatia
  entrega o **setor** de que esse papel dependerá (D3 opção ii), sem criar papel
  algum.
- **Mudar o nível de acesso das pessoas de referência de cada unidade**
  (resposta 2 (b)). É operação de cadastro, não de código — e os nomes vieram
  ocultados na resposta (`[NOME – UNIDADE]`). Fica como pendência do cliente.
- **"Você tem acesso a X unidades" e o alcance cross-unit da Governança**
  (D1/D5). O próprio cliente combinou tratar separado; segue travando A3 e C4.
- **Público por setor, relatório por setor e as contagens da saudação.** São C1,
  C4 e A3. Esta fatia entrega o dado, não os consumidores.
- **"Minha conta" (`web-minha-conta`).** Continua apresentando o **nível de
  acesso**, e isso é correto: é a tela do cadastro, onde o papel é o dado
  pertinente. A troca vale para as superfícies de uso diário.

## Capabilities

### New Capabilities

- `setores`: setor como entidade por unidade — cadastro, unicidade por unidade,
  isolamento (coluna `unit_id` + RLS + chave composta que impede vínculo
  cross-unit), alcance de quem mantém a lista e regra de remoção.

### Modified Capabilities

- `autenticacao`: a identidade resolvida por requisição passa a trazer **função
  e setor** da pessoa, pela mesma releitura que já traz nome e unidade.
- `gestao-pessoas`: o campo de cadastro deixa de ser área de trabalho em texto
  livre e passa a ser **setor por referência**, restrito aos setores da unidade
  da pessoa; o alcance por papel permanece o mesmo.
- `tela-inicial`: a identificação deixa de ser "nome, papel e unidade" e passa a
  ser **nome, função, setor e unidade**, com o papel como recaída.
- `web-shell-e-auth`: o cartão do rodapé da navegação apresenta **função** no
  lugar do papel, com a mesma recaída.
- `web-pessoas`: o formulário de pessoa passa a oferecer **lista fechada** de
  setores, e a página ganha a **manutenção da lista de setores** da unidade.
- `nomenclatura-interface`: o requisito "rótulo do papel é idêntico em toda a
  interface" passa a reconhecer que o shell autenticado e a tela inicial
  apresentam **função**, exibindo o rótulo do papel só na recaída — e, quando o
  exibem, pela mesma origem única.

## Impact

**Banco** — `0020_sectors.sql`: tabela `sectors` (`unit_id` + RLS + unicidade
por unidade), `users.sector_id` com FK composta, backfill a partir de
`work_area` e remoção da coluna. O backfill exige contexto de bypass dentro da
própria migration: sob `FORCE ROW LEVEL SECURITY` a policy nega sem
`app.current_unit`/`app.user_role` — ver design.md D4.

**Contratos (`packages/shared`)** — `AuthenticatedIdentity` (+`jobTitle`,
+`sectorName`); `CreatePersonRequest`/`UpdatePersonRequest`/`PersonResponse`
(−`workArea`, +`sectorId`, +`sectorName` na resposta); DTOs novos de setor.

**API** — `middleware/tenant-context.ts` (duas colunas e um `LEFT JOIN` na
consulta que já acontece), `routes/auth.ts` (login e `/auth/me`),
`routes/users.ts`, `routes/sectors.ts` (novo). Prefixo `/sectors` **nas três
pontas** em sincronia: `lib/api-prefixes.ts`, `apps/web/vite.config.ts` e
`infra/terraform/locals.tf`.

**SPA** — `shell/CartaoDoUsuario.tsx`, `shell/identidade.ts`,
`inicio/InicioPage.tsx`, `pessoas/PessoaFormModal.tsx`, `pessoas/PessoasPage.tsx`,
`setores/` (novo), `lib/schemas.ts`.

**Manual do usuário** — as páginas de cadastro de colaborador e de tela inicial
descrevem "Área de trabalho" e o perfil exibido; ambas mudam no mesmo commit.

**PRD** — US 1.1 (cenário 1 cita "área de trabalho") e US 11.1 (cenário 1 cita
"minha função") passam a refletir setor por referência e função do cadastro.

**Plano** — `docs/plano_demanda_cliente_2.md`: linha A1 da tabela de status,
e as decisões D2 e D4 registradas como respondidas (D3 segue aberta, pelo
conflito de nomenclatura).
