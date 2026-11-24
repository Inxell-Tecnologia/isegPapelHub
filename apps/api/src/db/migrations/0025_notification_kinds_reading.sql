-- Change `avisos-e-atrasos` (fatia C3 do plano da demanda nº 2): o canal de
-- notificação passa a carregar os avisos de leitura obrigatória — nova
-- leitura, atraso ao leitor e atraso da equipe ao gestor (design.md D1).
--
-- Mesmo procedimento da 0019: `DROP` + `ADD` do `CHECK` de `kind`, seguro
-- porque a condição só cresce. Sem isto o `INSERT` do aviso seria recusado, e
-- em silêncio para quem usa o sistema — a emissão é deliberadamente engolida
-- para não desfazer a marcação.
--
-- A idempotência não precisa de nada novo: o índice único
-- `(recipient_user_id, kind, source_ref)` da 0013 já garante um aviso por
-- evento de origem.
ALTER TABLE notifications
  DROP CONSTRAINT notifications_kind_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN (
    'grant_created', 'grant_expiring', 'grant_expired', 'registration_pending',
    'reading_assigned', 'reading_overdue', 'reading_overdue_team'
  ));
