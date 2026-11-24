-- Change `edicao-email-pessoa`: registro administrativo da edição de pessoa.
--
-- Tabela própria, separada de `audit_events` (design.md D3): `audit_events` é
-- o registro de **acesso a arquivo** (`file_id NOT NULL`, verbos de arquivo),
-- a capacidade que o produto vende, e não recebe eventos de administração —
-- mesma razão do change `cota-por-usuario`, design.md D6, cuja dívida este
-- change paga.
--
-- `unit_id` é a unidade da **pessoa editada**, não a do autor: um
-- `global_admin` editando alguém da unidade B gera evento da unidade B.
CREATE TABLE admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units (id),
  actor_user_id uuid NOT NULL REFERENCES users (id),
  target_user_id uuid NOT NULL REFERENCES users (id),
  -- Nasce com uma só ação; ações futuras (cadastro, redefinição de senha)
  -- entram alargando o CHECK numa migration nova.
  action text NOT NULL CHECK (action IN ('person_updated')),
  -- `{ campo: { from, to } }`, só com os campos que efetivamente mudaram, nos
  -- nomes do contrato da API (design.md D5).
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_events_unit_id_idx ON admin_events (unit_id);
CREATE INDEX admin_events_target_created_idx ON admin_events (target_user_id, created_at DESC);

-- Só de inclusão **por imposição do banco** (design.md D4): com FORCE e sem
-- policy de UPDATE/DELETE, o papel da app — inclusive dono da tabela — não
-- altera nem apaga registro algum (o comando afeta 0 linhas).
ALTER TABLE admin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_events FORCE ROW LEVEL SECURITY;

CREATE POLICY unit_isolation_select ON admin_events FOR SELECT
  USING (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  );

CREATE POLICY unit_isolation_insert ON admin_events FOR INSERT
  WITH CHECK (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  );

-- Transação de visita entre unidades é somente leitura em toda tabela de
-- unidade (migration 0026, design.md D3 de `compartilhamento-entre-unidades`).
CREATE POLICY shared_visitor_no_insert ON admin_events AS RESTRICTIVE FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) IS DISTINCT FROM 'shared_visitor');
