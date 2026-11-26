-- Change `posse-pelo-dono-da-pasta` (PRD US 2.1, US 3.1/3.2, US 8.1):
-- separa posse (`owner_id`) de autoria (quem realmente criou/enviou), marca a
-- origem das concessões e registra o evento de envio na auditoria.
-- Arquivo novo — migrações já aplicadas não são editadas.
--
-- O backfill precisa enxergar linhas de todas as unidades (tabelas com FORCE
-- RLS): mesmo padrão de `0020_sectors.sql`/`0026_cross_unit_grants.sql`.
SET LOCAL app.user_role = 'global_admin';

-- ---------------------------------------------------------------------------
-- Autoria (design.md D3): imutável, gravada só no INSERT. Para os itens
-- anteriores a esta regra, dono e autor eram sempre a mesma pessoa.
ALTER TABLE folders ADD COLUMN created_by uuid REFERENCES users (id);
ALTER TABLE files ADD COLUMN uploaded_by uuid REFERENCES users (id);

UPDATE folders SET created_by = owner_id WHERE created_by IS NULL;
UPDATE files SET uploaded_by = owner_id WHERE uploaded_by IS NULL;

-- Janela de deploy (design.md Migration Plan): a revisão anterior da API não
-- grava autoria. O trigger preenche com o dono quando vier nula, para que o
-- NOT NULL não derrube um INSERT antigo. O código novo sempre grava explícito.
CREATE FUNCTION fill_folder_created_by() RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION fill_file_uploaded_by() RETURNS trigger AS $$
BEGIN
  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folders_fill_created_by BEFORE INSERT ON folders
  FOR EACH ROW EXECUTE FUNCTION fill_folder_created_by();
CREATE TRIGGER files_fill_uploaded_by BEFORE INSERT ON files
  FOR EACH ROW EXECUTE FUNCTION fill_file_uploaded_by();

ALTER TABLE folders ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE files ALTER COLUMN uploaded_by SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Origem da concessão (design.md D4): `autoria` = concedida automaticamente
-- a quem criou um item numa pasta de outra pessoa.
ALTER TABLE grants ADD COLUMN origin text NOT NULL DEFAULT 'manual'
  CHECK (origin IN ('manual', 'autoria'));

-- ---------------------------------------------------------------------------
-- Evento de envio concluído (design.md D7).
ALTER TABLE audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check
  CHECK (action IN ('view', 'download', 'rename', 'replace', 'delete', 'restore', 'move', 'upload'));
