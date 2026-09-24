# Tasks

## 1. Separação dos dois alcances

- [x] 1.1 Desdobrar `canActOnTarget` (`apps/api/src/routes/users.ts`) em
      `canEditTarget` e `canResetPasswordOf`, lado a lado, com a tabela de alcance
      do design.md D1 no comentário; ambas leem o papel do alvo do banco na mesma
      transação, como hoje
- [x] 1.2 Ligar `POST /users/:id/password` a `canResetPasswordOf` com a regra
      **inalterada** e verificar com
      `npm run test --workspace apps/api -- src/__tests__/troca-de-senha.test.ts`
      (ou o arquivo que cobre a redefinição), confirmando que nenhum caso mudou
- [x] 1.3 Ligar `PATCH /users/:id` a `canEditTarget`, onde `global_admin` alcança
      `collaborator`, `unit_admin` e `global_admin` — inclusive a si mesmo —, e
      `unit_admin` segue alcançando apenas `collaborator`
- [x] 1.4 Verificar que o alcance do `unit_admin` não mudou em nenhuma das duas
      rotas, rodando `src/__tests__/people.test.ts` e
      `src/__tests__/isolamento-unidade.test.ts`

## 2. Travas de auto-edição no servidor

- [x] 2.1 Recusar em `PATCH /users/:id` a alteração do **próprio papel** para um
      papel diferente do atual, com recusa total (nenhum campo aplicado), e
      verificar com teste que envia papel novo junto de um campo de perfil válido
      e confirma que nada mudou
- [x] 2.2 Recusar a alteração do **próprio status** para desativado, com a mesma
      recusa total, e verificar com teste
- [x] 2.3 Garantir que reenviar o **mesmo** papel que já se tem não é tratado como
      alteração, e verificar com teste que a edição de si mesmo passa quando o
      papel vem inalterado no corpo

## 3. Cobertura do novo alcance

- [x] 3.1 Criar `apps/api/src/__tests__/alcance-admin-global.test.ts` cobrindo os
      cenários da spec: `global_admin` edita outro `global_admin`; `global_admin`
      edita a si mesmo; `unit_admin` continua recusado sobre `unit_admin` e sobre
      `global_admin`; e a senha de um `global_admin` continua irredutível mesmo
      para quem pode editá-lo
- [x] 3.2 Cobrir o caso que originou o change: `global_admin` concede cota
      individual a outro `global_admin`, e a si mesmo, verificando que o valor é
      gravado
- [x] 3.3 Verificar que o invariante "resta ao menos um `global_admin` ativo" se
      sustenta, com teste que esgota as operações permitidas sobre os demais
      administradores e confirma que o autor da ação permanece ativo e
      `global_admin`

## 4. Manual do administrador

- [x] 4.1 Acrescentar em `docs/manual/docs/administrador/pessoas.md` a tabela de
      **quem edita quem**, ao lado da tabela de redefinição de senha que já
      existe, deixando explícito o contraste: um administrador global edita outro
      administrador global, mas não redefine a senha dele
- [x] 4.2 Registrar na mesma página que ninguém altera o próprio papel nem
      desativa a própria conta, e verificar que o texto corresponde ao que a tela
      efetivamente faz (a SPA já esconde "Desativar" na própria linha)

## 5. Verificação de integração

- [x] 5.1 Rodar `npm run lint`, `npm run format:check` e `npm run build` na raiz e
      confirmar saída limpa
- [x] 5.2 Rodar `npm run test` na raiz e confirmar as duas suítes verdes, com
      atenção aos testes de segurança (`permission`, `isolamento-unidade`,
      `rls-isolation`), que não devem mudar
- [x] 5.3 Exercitar num banco de dev: um `global_admin` concede cota a outro
      `global_admin` pela API, e a tentativa de redefinir a senha dele continua
      `403`
- [x] 5.4 Rodar `openspec validate edicao-entre-admins-globais --strict`
