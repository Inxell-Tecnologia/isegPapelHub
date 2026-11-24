# Spec Delta

## Purpose

Define o registro das ações administrativas sobre pessoas — quem alterou o quê,
em quem, quando, com o valor anterior e o novo —, separado do registro de acesso
a arquivos (capability `auditoria`). Nesta fatia cobre a edição de pessoa em
`PATCH /users/:id`, incluindo a troca de e-mail.

## ADDED Requirements

### Requirement: Edição efetiva de pessoa gera registro administrativo

O sistema SHALL gravar um registro administrativo a cada edição bem-sucedida em `PATCH /users/:id` que altere ao menos um campo da pessoa. O registro SHALL conter quem executou, a pessoa editada, a unidade dessa pessoa, a data e hora, e, para cada campo alterado, o valor anterior e o novo. Campos enviados com o valor vigente NÃO SHALL constar do registro.

#### Scenario: Troca de e-mail registrada com valor anterior e novo

- **WHEN** um administrador troca o e-mail de uma pessoa de `a@x.com` para
  `b@x.com`
- **THEN** é gravado um registro com o autor, a pessoa, a data e hora, e o campo
  e-mail com `a@x.com` como anterior e `b@x.com` como novo

#### Scenario: Vários campos alterados na mesma edição

- **WHEN** um administrador altera, numa mesma requisição, o papel e o status de
  uma pessoa
- **THEN** o registro daquela edição traz os dois campos, cada um com seu valor
  anterior e novo

#### Scenario: Campo reenviado sem mudança não é registrado

- **WHEN** o formulário de edição envia o papel e o status vigentes junto com um
  nome novo
- **THEN** o registro contém apenas o nome; papel e status não constam

#### Scenario: Edição sem nenhuma mudança efetiva não gera registro

- **WHEN** uma edição bem-sucedida reenvia somente os valores vigentes
- **THEN** nenhum registro administrativo é gravado

### Requirement: Campos cobertos pelo registro da edição de pessoa

O registro administrativo da edição de pessoa SHALL cobrir todos os campos que `PATCH /users/:id` aceita: e-mail, nome, telefone, função/cargo, observação, setor, papel, status, cota individual e acompanhamento de leituras. A senha NÃO SHALL constar do registro em forma alguma, por não ser campo da edição.

#### Scenario: Alteração de cota registrada

- **WHEN** um `global_admin` concede ou remove a cota individual de uma pessoa
- **THEN** o registro traz a cota anterior e a nova, sendo "sem exceção" um
  valor representável

#### Scenario: Remoção de setor registrada

- **WHEN** um administrador remove o vínculo de setor de uma pessoa
- **THEN** o registro traz o setor anterior e a ausência de setor como novo valor

### Requirement: Registro gravado atomicamente com a edição

O registro administrativo SHALL ser gravado na mesma transação da edição: se a edição for recusada ou falhar por qualquer motivo, nenhum registro SHALL ser gravado, e se o registro não puder ser gravado, a edição NÃO SHALL ser aplicada.

#### Scenario: Edição recusada não deixa registro

- **WHEN** uma edição é recusada (fora do alcance, e-mail em uso, setor de outra
  unidade, trava de auto-edição)
- **THEN** nenhum registro administrativo é gravado

#### Scenario: Falha ao registrar desfaz a edição

- **WHEN** a gravação do registro falha durante uma edição
- **THEN** nenhum campo da pessoa é alterado

### Requirement: Registro administrativo só de inclusão

O registro administrativo SHALL ser só de inclusão: a aplicação NÃO SHALL conseguir alterar nem apagar um registro já gravado, garantia imposta no banco e não apenas pela ausência de rota.

#### Scenario: Alteração de registro recusada pelo banco

- **WHEN** o papel de banco da aplicação tenta alterar ou apagar um registro
  administrativo
- **THEN** nenhuma linha é alterada nem apagada

### Requirement: Registro administrativo isolado por unidade

O registro administrativo SHALL pertencer à unidade da **pessoa editada** e SHALL ser isolado por unidade no banco, como as demais tabelas com dado de unidade: um `unit_admin` NÃO SHALL ler nem gravar registros de outra unidade.

#### Scenario: Edição por administrador global grava na unidade da pessoa

- **WHEN** um `global_admin` lotado na unidade A edita uma pessoa da unidade B
- **THEN** o registro pertence à unidade B

#### Scenario: Leitura restrita à própria unidade

- **WHEN** o contexto de um `unit_admin` da unidade A lê registros administrativos
- **THEN** só registros da unidade A são visíveis

### Requirement: Registro administrativo sem tela de consulta nesta fatia

O sistema SHALL manter o registro administrativo apenas gravado nesta fatia, sem rota nem tela de consulta; o registro de acesso a arquivos (capability `auditoria`) NÃO SHALL expor eventos administrativos.

#### Scenario: Auditoria de arquivo não mistura eventos administrativos

- **WHEN** uma pessoa autorizada consulta a auditoria de um arquivo
- **THEN** a resposta contém apenas eventos de acesso ao arquivo, nunca edições de
  pessoa
