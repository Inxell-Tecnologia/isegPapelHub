# Spec Delta

## ADDED Requirements

### Requirement: Edição de perfil, e-mail, papel e status da pessoa

A página SHALL oferecer, por linha, a ação **"Editar"**, que abre o formulário pré-preenchido e, ao confirmar, chama **`PATCH /users/:id`** com nome, **e-mail**, telefone, função, setor, observação, papel e status. O setor SHALL vir da lista fechada da unidade **da pessoa editada**, com opção de ficar sem setor. O formulário NÃO SHALL conter campo de senha. Em sucesso, a SPA SHALL invalidar `GET /users`.

Referência: PRD US 1.1; design.md (web-pessoas) D3/D7; change `edicao-email-pessoa`.

#### Scenario: Edição altera os dados da pessoa
- **WHEN** um administrador edita nome/função/papel/status de uma pessoa e confirma
- **THEN** a SPA chama `PATCH /users/:id` e a listagem reflete os novos valores

#### Scenario: Edição troca ou limpa o setor
- **WHEN** um administrador escolhe outro setor da unidade da pessoa, ou limpa a
  escolha, e confirma
- **THEN** a SPA envia a troca ou a remoção do vínculo, e a listagem reflete o
  setor resultante

#### Scenario: Edição troca o e-mail
- **WHEN** um administrador altera o e-mail de uma pessoa e confirma
- **THEN** a SPA envia o novo e-mail em `PATCH /users/:id` e a listagem reflete o
  novo e-mail

#### Scenario: E-mail em formato inválido não é enviado
- **WHEN** o administrador deixa o e-mail vazio ou em formato inválido na edição
- **THEN** o formulário sinaliza o campo e não chama `PATCH /users/:id`

#### Scenario: Edição não expõe troca de senha
- **WHEN** o administrador abre o formulário de edição de uma pessoa
- **THEN** o formulário não apresenta campo de senha

### Requirement: E-mail em uso na edição sinalizado no campo

A SPA SHALL tratar o **409** de e-mail em uso devolvido por `PATCH /users/:id` como no cadastro: mensagem "e-mail já está em uso" no campo de e-mail, formulário de edição mantido aberto com o que foi digitado. Os demais 409 da edição (setor inválido, gestor de setor sem setor) SHALL continuar com o tratamento próprio de cada um.

#### Scenario: Troca para e-mail já usado
- **WHEN** o administrador troca o e-mail de uma pessoa por um que já pertence a
  outra conta e `PATCH /users/:id` retorna 409 de e-mail em uso
- **THEN** a SPA exibe "e-mail já está em uso" no campo de e-mail e mantém o
  formulário aberto com os demais campos preenchidos

#### Scenario: Outro 409 da edição não é confundido com e-mail em uso
- **WHEN** `PATCH /users/:id` retorna 409 por setor inválido
- **THEN** a SPA exibe o tratamento de setor, e não a mensagem de e-mail em uso

### Requirement: Aviso de efeito da troca de e-mail no login

A SPA SHALL avisar, no formulário de edição, quando o e-mail digitado difere do atual, que a pessoa passará a entrar com o novo e-mail e que o administrador deve comunicá-la, pois o sistema não envia aviso. O aviso NÃO SHALL aparecer quando o e-mail não foi alterado.

#### Scenario: Aviso ao alterar o e-mail
- **WHEN** o administrador altera o conteúdo do campo de e-mail na edição
- **THEN** o formulário exibe o aviso de que o login passará a ser o novo e-mail

#### Scenario: Sem aviso com o e-mail inalterado
- **WHEN** o administrador abre a edição e não altera o e-mail
- **THEN** o aviso não é exibido

## REMOVED Requirements

### Requirement: Edição de perfil, papel e status da pessoa
**Reason**: o e-mail deixa de ser somente-leitura na edição (change `edicao-email-pessoa`); o cenário "Edição não expõe troca de senha nem de e-mail" deixa de valer na parte do e-mail.
**Migration**: substituído por "Edição de perfil, e-mail, papel e status da pessoa", que preserva os demais cenários e mantém a ausência de campo de senha.
