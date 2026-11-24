-- Change `favoritos` (fatia A4 do plano da demanda nº 2): marca pessoal de
-- favorito sobre pasta ou arquivo (design.md D1).
--
-- Polimórfica pelo mesmo motivo de `grants`: pasta e arquivo são os dois
-- recursos que a resolução de acesso conhece. Sem chave estrangeira para o
-- recurso — também como `grants` —, e por isso o expurgo da lixeira apaga as
-- marcas junto com as concessões (design.md D7).
--
-- Favorito **não é permissão**: nenhuma regra de `lib/access.ts` lê esta
-- tabela. A lista confirma cada marca por `hasAccess` (design.md D3).

-- Dado de unidade ⇒ exige `unit_id` + RLS, regra dura do projeto (CLAUDE.md).
-- `unit_id` é o da unidade do **recurso**, gravado pelo servidor.
CREATE TABLE favorites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES units (id),
  user_id       uuid NOT NULL REFERENCES users (id),
  resource_type text NOT NULL CHECK (resource_type IN ('folder', 'file')),
  resource_id   uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Uma marca por pessoa e recurso: marcar de novo é idempotente (design.md D2).
CREATE UNIQUE INDEX favorites_user_resource_uidx
  ON favorites (user_id, resource_type, resource_id);

-- A lista lê as marcas da pessoa da mais recente para a mais antiga.
CREATE INDEX favorites_user_created_idx ON favorites (user_id, created_at DESC);

-- O expurgo apaga por recurso.
CREATE INDEX favorites_resource_idx ON favorites (resource_type, resource_id);

-- A RLS isola **unidades**, não pessoas: a rota filtra `user_id` do contexto
-- explicitamente em toda leitura e escrita (design.md D1), como em
-- `notifications`.
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites FORCE ROW LEVEL SECURITY;

CREATE POLICY unit_isolation ON favorites
  USING (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  )
  WITH CHECK (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  );
