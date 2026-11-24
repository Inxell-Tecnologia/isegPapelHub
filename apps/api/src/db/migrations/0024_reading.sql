-- Change `leitura-obrigatoria` (fatia C1 do plano da demanda nº 2): marcação de
-- documento como leitura obrigatória e ciência de cada pessoa do público
-- (demanda, seções 3.1–3.4).
--
-- Duas tabelas (design.md D1): a **campanha**, uma por revisão do documento, e a
-- **atribuição**, uma por pessoa. Ambas com dado de unidade ⇒ `unit_id` + RLS,
-- regra dura do projeto (CLAUDE.md).
--
-- A situação de cada atribuição (pendente, atrasada, concluída, encerrada) **não
-- é coluna**: é derivada na consulta pelo relógio do Postgres (design.md D3),
-- como a situação do documento. Nova revisão e obsoleto encerram pendências sem
-- escrita e sem rotina.

CREATE TABLE reading_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id           uuid NOT NULL REFERENCES units (id),
  file_id           uuid NOT NULL REFERENCES files (id) ON DELETE CASCADE,
  -- Cópia do documento como estava ao ser marcado (design.md D1): renomear ou
  -- substituir depois não reescreve o registro de 3.4.
  document_revision integer NOT NULL,
  document_code     text NOT NULL,
  document_title    text NOT NULL,
  -- Critério do público (design.md D2): { wholeUnit, sectorIds, roles, userIds },
  -- combinados por "ou", avaliado sobre as pessoas ativas da unidade.
  audience          jsonb NOT NULL,
  -- Prazo é do **dia**, não do instante — mesmo tratamento de `next_review_at`.
  due_date          date NOT NULL,
  message           text NULL,
  created_by        uuid NOT NULL REFERENCES users (id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Uma marcação por revisão.
  CONSTRAINT reading_campaigns_file_revision_key UNIQUE (file_id, document_revision)
);

CREATE INDEX reading_campaigns_unit_idx ON reading_campaigns (unit_id);

CREATE TABLE reading_assignments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id                  uuid NOT NULL REFERENCES units (id),
  campaign_id              uuid NOT NULL REFERENCES reading_campaigns (id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES users (id),
  -- Prazo desta pessoa: o da marcação, ou 15 dias a partir de quando ela foi
  -- alcançada, se entrou depois no público (demanda 3.3).
  due_date                 date NOT NULL,
  assigned_at              timestamptz NOT NULL DEFAULT now(),
  acknowledged_at          timestamptz NULL,
  -- Setor **no momento** da ciência (demanda 3.4): o setor da pessoa pode mudar
  -- depois, e o registro descreve a confirmação como ela aconteceu.
  acknowledged_sector_name text NULL,
  CONSTRAINT reading_assignments_campaign_user_key UNIQUE (campaign_id, user_id)
);

CREATE INDEX reading_assignments_user_idx ON reading_assignments (user_id);

ALTER TABLE reading_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_campaigns FORCE ROW LEVEL SECURITY;
CREATE POLICY unit_isolation ON reading_campaigns
  USING (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  )
  WITH CHECK (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  );

ALTER TABLE reading_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY unit_isolation ON reading_assignments
  USING (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  )
  WITH CHECK (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  );
