-- Change `tour-guiado` (fatia A6 do plano da demanda nº 2), design.md D4:
-- memória de "já fiz o tour" **por pessoa**, no servidor. Por pessoa e não por
-- navegador porque nos hospitais o computador é compartilhado entre turnos.
--
-- Anulável e sem default: ninguém começa com o tour feito. Coluna de `users`,
-- que já tem `unit_id` e RLS — nenhuma policy nova.
ALTER TABLE users ADD COLUMN tour_completed_at timestamptz NULL;
