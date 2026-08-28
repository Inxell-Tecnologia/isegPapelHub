-- Change `mover-e-renomear-itens` (US 2.3): mover arquivo/pasta e renomear
-- pasta. Arquivo novo — as migrações 0001-0013 já aplicadas não são editadas.

-- O índice de 0006/0008 é (unit_id, parent_id, lower(name)) WHERE
-- deleted_at IS NULL, e como NULL != NULL em índice único do Postgres, duas
-- pastas vivas homônimas na raiz (parent_id IS NULL) passam hoje — remendado
-- em código dentro de ensureFolderPath. Mover-para-raiz e renomear-na-raiz
-- precisariam do mesmo remendo em mais dois lugares; em vez disso o índice
-- passa a cobrir a raiz com NULLS NOT DISTINCT (design.md D5).
--
-- Mesmo padrão de detecção de duplicatas da 0006, agora também cobrindo a
-- raiz: falha explícita aqui é preferível a quebrar a criação do índice sem
-- explicação, ou a deduplicar dado em silêncio (design.md, Migration Plan).
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1
    FROM folders
    WHERE deleted_at IS NULL
    GROUP BY unit_id, parent_id, lower(name)
    HAVING count(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'folders: % grupo(s) duplicado(s) de (unit_id, parent_id, lower(name)) entre pastas vivas encontrado(s) — deduplicar (inclusive na raiz) antes de aplicar 0014',
      dup_count;
  END IF;
END $$;

DROP INDEX folders_unit_parent_name_uidx;
CREATE UNIQUE INDEX folders_unit_parent_name_uidx
  ON folders (unit_id, parent_id, lower(name)) NULLS NOT DISTINCT
  WHERE deleted_at IS NULL;

-- Auditoria de mover arquivo (design.md D6), mesmo padrão incremental de
-- 0004/0008. Mover/renomear pasta não gera evento — não muda este CHECK.
ALTER TABLE audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check
  CHECK (action IN ('view', 'download', 'rename', 'replace', 'delete', 'restore', 'move'));
