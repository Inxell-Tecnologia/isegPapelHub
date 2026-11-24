-- Change `compartilhamento-entre-unidades` (PRD US 5.2): compartilhamento
-- somente leitura entre a unidade marcada como SEDE e as demais unidades.
-- Arquivo novo — migrações já aplicadas não são editadas.
--
-- A parte de dados (fim do arquivo) precisa enxergar `grants` e `users` de
-- todas as unidades: mesmo padrão de `0020_sectors.sql`, `SET LOCAL` do papel
-- global_admin, restrito a esta transação de migração.
SET LOCAL app.user_role = 'global_admin';

-- ---------------------------------------------------------------------------
-- SEDE (design.md D11): no máximo uma unidade marcada.
ALTER TABLE units ADD COLUMN is_headquarters boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX units_single_headquarters_uidx ON units (is_headquarters)
  WHERE is_headquarters;

-- A identidade da SEDE (id, nome) é legível por qualquer contexto de unidade
-- (design.md D4, passo 2.b): saber qual unidade é a SEDE não é conteúdo.
-- Policy **permissiva só de SELECT**, somada (OR) à `unit_isolation`
-- existente — a escrita em `units` continua exigindo a policy original.
CREATE POLICY headquarters_visible ON units
  FOR SELECT
  USING (is_headquarters);

-- ---------------------------------------------------------------------------
-- Compartilhamento entre unidades (design.md D1). Tabela própria, separada de
-- `grants`, para que nenhuma consulta existente mude de significado.
CREATE TABLE cross_unit_grants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Origem: sempre a unidade do recurso.
  unit_id          uuid NOT NULL REFERENCES units (id),
  resource_type    text NOT NULL CHECK (resource_type IN ('folder', 'file')),
  resource_id      uuid NOT NULL,
  -- Destino: gravado mesmo na concessão por pessoa (design.md D1).
  subject_unit_id  uuid NOT NULL REFERENCES units (id),
  -- NULL = a unidade de destino inteira.
  subject_user_id  uuid REFERENCES users (id),
  permission       text NOT NULL CHECK (permission IN ('view', 'download')),
  granted_by       uuid NOT NULL REFERENCES users (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  CONSTRAINT cross_unit_grants_distinct_units CHECK (subject_unit_id <> unit_id)
);

-- Idempotência de reconcessão (mesma semântica de `grants`); NULLS NOT
-- DISTINCT para a concessão à unidade inteira (PG 16 em todos os ambientes).
CREATE UNIQUE INDEX cross_unit_grants_uidx ON cross_unit_grants
  (unit_id, resource_type, resource_id, subject_unit_id, subject_user_id, permission)
  NULLS NOT DISTINCT;
CREATE INDEX cross_unit_grants_subject_idx ON cross_unit_grants (subject_unit_id, subject_user_id);
CREATE INDEX cross_unit_grants_resource_idx ON cross_unit_grants (resource_type, resource_id);

ALTER TABLE cross_unit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_unit_grants FORCE ROW LEVEL SECURITY;

-- design.md D2. A origem gere (lê e escreve); o bypass de global_admin segue o
-- padrão das demais tabelas e as rotas comparam `unit_id` explicitamente.
CREATE POLICY origin_manage ON cross_unit_grants
  USING (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  )
  WITH CHECK (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  );

-- O destino **só lê** (FOR SELECT — nunca revoga nem altera), e só o que lhe
-- diz respeito: o que foi dado à unidade dele, ou a ele em pessoa. Sem
-- `app.current_user_id` o ramo pessoal compara com NULL e nega (fail-closed).
CREATE POLICY destination_read ON cross_unit_grants
  FOR SELECT
  USING (
    subject_unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    AND (
      subject_user_id IS NULL
      OR subject_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- A transação de visita (`app.user_role = 'shared_visitor'`, design.md D3)
-- é **somente leitura** por imposição do banco, não só da aplicação: policies
-- RESTRITIVAS (combinadas por AND com as permissivas) recusam INSERT, UPDATE e
-- DELETE nesse papel em toda tabela de unidade — inclusive em
-- `cross_unit_grants`, que a visita lê pela `origin_manage` mas jamais altera.
-- A única escrita da visita é o evento de auditoria (`audit_events` fica fora
-- da lista, de propósito).
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'units', 'users', 'files', 'folders', 'grants', 'cross_unit_grants',
    'notifications', 'sectors', 'favorites', 'reading_campaigns', 'reading_assignments'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY shared_visitor_no_insert ON %I AS RESTRICTIVE FOR INSERT
         WITH CHECK (current_setting(''app.user_role'', true) IS DISTINCT FROM ''shared_visitor'')',
      tabela);
    EXECUTE format(
      'CREATE POLICY shared_visitor_no_update ON %I AS RESTRICTIVE FOR UPDATE
         USING (current_setting(''app.user_role'', true) IS DISTINCT FROM ''shared_visitor'')',
      tabela);
    EXECUTE format(
      'CREATE POLICY shared_visitor_no_delete ON %I AS RESTRICTIVE FOR DELETE
         USING (current_setting(''app.user_role'', true) IS DISTINCT FROM ''shared_visitor'')',
      tabela);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Auditoria (design.md D9): retrato de quem acessou vindo de outra unidade.
-- Preenchido só em evento de visita; a RLS de `users` esconderia a pessoa da
-- consulta da origem.
ALTER TABLE audit_events
  ADD COLUMN actor_name text,
  ADD COLUMN actor_unit_name text;

-- ---------------------------------------------------------------------------
-- Dados (design.md D10): concessões comuns sem efeito — sujeito de unidade
-- diferente da do recurso. As de view/download viram compartilhamento por
-- pessoa (com o mesmo prazo, autor e data); todas saem de `grants`. A regra
-- da SEDE não é validada aqui — é avaliada na resolução (design.md D4), então
-- as cópias ficam inertes até a SEDE ser marcada.
DO $$
DECLARE
  copiadas integer;
  removidas integer;
BEGIN
  INSERT INTO cross_unit_grants
    (unit_id, resource_type, resource_id, subject_unit_id, subject_user_id,
     permission, granted_by, created_at, expires_at)
  SELECT g.unit_id, g.resource_type, g.resource_id, u.unit_id, g.subject_user_id,
         g.permission, g.granted_by, g.created_at, g.expires_at
    FROM grants g
    JOIN users u ON u.id = g.subject_user_id
   WHERE u.unit_id <> g.unit_id
     AND g.permission IN ('view', 'download')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS copiadas = ROW_COUNT;

  DELETE FROM grants g
   USING users u
   WHERE u.id = g.subject_user_id
     AND u.unit_id <> g.unit_id;
  GET DIAGNOSTICS removidas = ROW_COUNT;

  RAISE NOTICE 'cross_unit_grants: % concessão(ões) copiada(s); % concessão(ões) sem efeito removida(s) de grants',
    copiadas, removidas;
END
$$;
