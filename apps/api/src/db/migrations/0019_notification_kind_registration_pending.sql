-- US 10.9 (change `arquivo-geral-e-pendente-de-cadastro`): o canal de
-- notificação passa a carregar um assunto que não é concessão — quem enviou um
-- arquivo que ficou pendente de cadastro é avisado.
--
-- `notifications.kind` nasceu em 0013 com um `CHECK` enumerando os três
-- valores de concessão. O valor novo precisa entrar nessa lista: sem isto o
-- `INSERT` é recusado pelo banco, e **em silêncio** do ponto de vista de quem
-- usa o sistema, porque a emissão do aviso é deliberadamente engolida para que
-- "a falha ao avisar não impeça a conclusão do envio". O envio concluiria, o
-- arquivo ficaria pendente, e ninguém seria avisado.
--
-- Arquivo novo em vez de edição da 0013, pela convenção do repositório:
-- migração já aplicada não é editada.
--
-- `DROP` + `ADD` do mesmo `CHECK` é a forma de ampliar um enum em `CHECK` no
-- Postgres. É seguro aqui porque a condição só **cresce**: todo valor que
-- passava continua passando, então nenhuma linha existente pode violá-la, e a
-- validação da tabela não encontra nada a recusar.
--
-- A idempotência do aviso não precisa de nada novo: o índice único
-- `notifications_recipient_kind_source_uidx` em
-- `(recipient_user_id, kind, source_ref)`, criado em 0013, já garante um aviso
-- por `(destinatário, tipo, evento de origem)` — e para este aviso o evento de
-- origem é o próprio arquivo.
ALTER TABLE notifications
  DROP CONSTRAINT notifications_kind_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('grant_created', 'grant_expiring', 'grant_expired', 'registration_pending'));
