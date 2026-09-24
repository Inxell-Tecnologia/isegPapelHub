# Proposal

## Why

Nenhum administrador global consegue ser editado — nem por outro administrador
global. Tentar editar qualquer dado de um `global_admin` (nome, telefone, papel,
status, cota) devolve `403`, e não existe caminho pela aplicação: rebaixá-lo para
depois editá-lo esbarra na mesma recusa.

A causa não é uma decisão sobre edição, e sim um **reuso indevido**:
`canActOnTarget` foi escrita para a **redefinição administrativa de senha**
(change `troca-de-senha`, design.md D5), onde a regra "a senha de um
`global_admin` não é redefinida por ninguém" é deliberada e normativa (PRD US 1.4
cenário 2). A mesma função passou a governar também `PATCH /users/:id`, estendendo
uma regra de **senha** a **toda a edição de pessoa**.

A própria spec já diz o contrário do que o código faz. `gestao-pessoas` estabelece
que "um `global_admin` NÃO SHALL ser editado por quem **não seja**
`global_admin`" — ou seja, por outro administrador global, sim. Este change fecha
a divergência entre spec e implementação.

O caso que a expôs é concreto e está em produção: a pessoa que precisa de cota
individual para enviar ~200 GB é ela própria administradora global, e por isso é
justamente a única categoria que o sistema não consegue editar. A concessão só
foi possível por `UPDATE` manual no banco.

## What Changes

- **Separação dos dois alcances.** O alcance da **edição de pessoa** deixa de ser
  o mesmo da **redefinição de senha**. Cada rota passa a consultar o alcance que
  lhe corresponde, e a distinção fica explícita no código em vez de implícita no
  reuso de uma função.
- **`global_admin` alcança `global_admin` na edição.** Um administrador global
  passa a editar dados, papel, status e cota de outro administrador global, e
  também **de si mesmo**. `unit_admin` continua alcançando apenas `collaborator`,
  sem mudança alguma.
- **Duas travas novas no servidor, para qualquer papel:** ninguém altera o
  **próprio papel**, e ninguém desativa a **própria conta**. Hoje esses dois
  caminhos são inalcançáveis só porque um `global_admin` não podia ser editado;
  ao abrir a edição, eles passariam a existir — e um deles é um bloqueio
  permanente (ver Impact).
- **A regra de senha fica intacta.** A redefinição administrativa de senha de um
  `global_admin` continua impossível para qualquer pessoa, inclusive outro
  `global_admin`, restando apenas a alteração pela própria pessoa em "Minha
  conta". Redefinir a senha de outro administrador é caminho de **tomada de
  conta** (A redefine a senha de B e entra como B), coisa diferente de editar os
  dados dele.
- **Manual do administrador** ganha a tabela de quem edita quem, ao lado da
  tabela de senha que já existe e que passa a contrastar com ela.

## Capabilities

### New Capabilities

<!-- Nenhuma. O comportamento alterado pertence a uma capability existente. -->

### Modified Capabilities

- `gestao-pessoas`: o alcance da edição passa a incluir `global_admin` sobre
  `global_admin` (inclusive sobre si mesmo), deixando de herdar a regra de
  senha; e a edição passa a recusar, para qualquer papel, a alteração do próprio
  papel e a desativação da própria conta.

## Impact

**API.** `apps/api/src/routes/users.ts` — a função de alcance por papel do alvo
se desdobra em duas (edição e senha), e `PATCH /users/:id` ganha as duas travas
de auto-edição. `POST /users/:id/password` continua chamando exatamente o alcance
de hoje, sem alteração de comportamento.

**Nada mais.** Sem migration, sem contrato compartilhado novo, sem infraestrutura.

**SPA: sem mudança de código.** As travas de interface já existem e já estão
corretas — `PessoasPage` esconde "Desativar" na própria linha
(`!(isSelf && isActive)`) e `PessoaFormModal` não oferece papel de alcance menor
para si (`ROLE_RANK`). O que faltava era o servidor, que é o guardião. Este change
transforma o que hoje é só convenção de tela em invariante de servidor.

**Risco fechado pelas travas — e por que ele importa.** O job de bootstrap recria
um administrador global apenas quando `count(*) WHERE role = 'global_admin'` é
zero: ele **não filtra status**. Desativar o último administrador global deixaria
a contagem em 1, tornaria o bootstrap um no-op e ninguém entraria — recuperação
só por SQL manual. Rebaixar seria recuperável; desativar, não.

As duas travas de auto-edição bastam para fechar isso, sem contagem de
"último administrador": quem executa a ação precisa ser um `global_admin` ativo,
e não pode tocar em si mesmo — logo **sempre resta pelo menos um administrador
global ativo**, o próprio autor da ação.

## Fora de escopo

- **Auditoria da edição entre administradores.** Continua valendo a decisão do
  change `cota-por-usuario` (design.md D6): `audit_events` é log de arquivo
  (`file_id NOT NULL`), e `PATCH /users/:id` não audita nada hoje — nem papel,
  nem status. Um administrador global rebaixar outro seguirá sem rastro. A dívida
  é o log administrativo, que cobriria papel, status e cota de uma vez.
- **Confiança mútua entre administradores globais.** Depois deste change, um
  administrador global pode rebaixar ou desativar outro. É consequência aceita do
  pedido, não efeito colateral: administradores globais passam a ser pares.
