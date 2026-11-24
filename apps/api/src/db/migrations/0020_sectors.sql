-- Change `funcao-e-setor-na-identidade` (fatia A1 do plano da demanda nº 2):
-- setor deixa de ser texto livre em `users.work_area` e passa a ser **entidade
-- por unidade**. Arquivo novo — as migrações 0001-0019 já aplicadas não são
-- editadas.
--
-- Por quê (docs/respostas_a1_funcao_e_setor.txt, respostas 5a e 6a): o cliente
-- confirmou que setor será **critério de público** da leitura obrigatória e
-- recorte do relatório, e que "setor" e "Área de trabalho" são o mesmo
-- conceito. Texto livre não serve de critério: "Governança", "governanca" e
-- "Gov." são três setores para o sistema, e quem estiver escrito de um jeito
-- fica de fora do envio feito pelo outro.
--
-- ============================================================================
-- O `SET LOCAL` abaixo não é zelo: sem ele o backfill não faz nada, em silêncio
-- ============================================================================
-- `0002_enable_rls.sql` usa FORCE ROW LEVEL SECURITY porque o papel da
-- aplicação é **dono** das tabelas — e FORCE alcança o dono. Sem
-- `app.current_unit`/`app.user_role` definidos, `current_setting(..., true)`
-- devolve NULL, a policy `unit_isolation` não é satisfeita e um INSERT/UPDATE
-- aqui atingiria **zero linhas, sem erro**. Medido neste sandbox: `UPDATE 0`,
-- nenhuma mensagem.
--
-- `db/migrate.ts` envolve cada arquivo em BEGIN/COMMIT, então SET LOCAL tem
-- exatamente o alcance desta migration. É o mesmo mecanismo de bypass que
-- `attachTenantContext` e `withSystemBypass` (test-db.ts) já usam — não um
-- caminho especial.
--
-- Precedente, para quem vier depois: `0012_password_changed_at.sql` faz
-- `UPDATE users SET password_changed_at = created_at` **sem** esse contexto, e
-- portanto não atualizou linha alguma. Nada quebrou porque o `DEFAULT now()`
-- da própria coluna cobriu o caso. Não editar aquela migration já aplicada —
-- ver o teste `setores-migracao.test.ts`, que registra o achado.
SET LOCAL app.user_role = 'global_admin';

-- Dado de unidade ⇒ exige `unit_id` + RLS, regra dura do projeto (CLAUDE.md).
CREATE TABLE sectors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id    uuid NOT NULL REFERENCES units (id),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Alvo da chave estrangeira **composta** de `users` (design.md D1). É esta
  -- unicidade redundante que permite ao banco — não só à rota — recusar pessoa
  -- apontando para setor de outra unidade.
  CONSTRAINT sectors_unit_id_id_key UNIQUE (unit_id, id)
);

-- Unicidade por unidade ignorando caixa e espaços nas extremidades: "CME" e
-- "cme " não coexistem na mesma unidade (design.md D3).
--
-- **Deliberadamente sem acento-insensibilidade.** `unaccent` fundiria
-- "Governança" com "governanca", mas não "Governança" com "Gov." — e é esse o
-- par que o acervo real tem. Fusão correta exige julgamento humano: a lista
-- oficial de cada unidade, aplicada por **renomeação** pela administração.
-- Fundir por heurística aqui seria decidir em nome do cliente com o dado
-- original já descartado.
CREATE UNIQUE INDEX sectors_unit_name_key ON sectors (unit_id, lower(btrim(name)));

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors FORCE ROW LEVEL SECURITY;

CREATE POLICY unit_isolation ON sectors
  USING (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  )
  WITH CHECK (
    unit_id = NULLIF(current_setting('app.current_unit', true), '')::uuid
    OR current_setting('app.user_role', true) = 'global_admin'
  );

-- Vínculo pessoa→setor sob FK **composta** (design.md D1): o banco recusa
-- `sector_id` de outra unidade, em vez de confiar que toda escrita passe pela
-- rota. `sector_id` nulo não é checado (MATCH SIMPLE), que é exatamente o
-- desejado — "sem setor" é estado válido e permanente para quem não tem.
ALTER TABLE users
  ADD COLUMN sector_id uuid,
  ADD CONSTRAINT users_sector_same_unit_fk
    FOREIGN KEY (unit_id, sector_id) REFERENCES sectors (unit_id, id);

-- Índice do lado **referenciante** da FK. Postgres não o cria sozinho, e sem
-- ele cada remoção de setor varre `users` para checar o RESTRICT implícito —
-- que é justamente a operação que a capability `setores` exige ser exata
-- ("setor com pessoas vinculadas não é removido"). Serve também à contagem de
-- pessoas por setor exibida na manutenção da lista. Parcial, no molde de
-- `grants_expires_at_idx` (0013): pessoa sem setor não participa de nenhuma
-- das duas consultas.
CREATE INDEX users_sector_id_idx ON users (sector_id) WHERE sector_id IS NOT NULL;

-- ============================================================================
-- Backfill: cada grafia distinta por unidade vira um setor, preservando o texto
-- ============================================================================
-- `DISTINCT ON` com desempate por `created_at` escolhe a grafia da ocorrência
-- mais antiga — critério estável, não o que o planejador decidir na hora.
INSERT INTO sectors (unit_id, name)
SELECT DISTINCT ON (unit_id, lower(btrim(work_area)))
       unit_id, btrim(work_area)
FROM users
WHERE work_area IS NOT NULL AND btrim(work_area) <> ''
ORDER BY unit_id, lower(btrim(work_area)), created_at;

UPDATE users u
SET sector_id = s.id
FROM sectors s
WHERE s.unit_id = u.unit_id
  AND lower(btrim(s.name)) = lower(btrim(u.work_area))
  AND u.work_area IS NOT NULL
  AND btrim(u.work_area) <> '';

-- A coluna antiga **sai**, em vez de ficar inerte como em 0018 (design.md D2).
-- Ali a coluna nova era aditiva e reverter o código a deixava inofensiva; aqui
-- é a coluna **antiga** que sobraria — um segundo lugar onde o mesmo conceito
-- mora, sem escritor e sem leitor, esperando a próxima pessoa que mexer em
-- `routes/users.ts` reencontrá-la em `PERSON_COLUMNS`. Nenhum dado se perde: a
-- grafia original de cada valor é agora o **nome** de um setor, e o caminho de
-- volta está em design.md, Migration Plan passo 4.
ALTER TABLE users DROP COLUMN work_area;

COMMENT ON TABLE sectors IS
  'Setor da unidade (US 1.1; change funcao-e-setor-na-identidade). Lista FECHADA por unidade: '
  'substitui users.work_area (texto livre) porque setor passa a escolher o público da leitura '
  'obrigatória e a recortar o relatório da Fase 2 — e grafia divergente do mesmo setor deixaria '
  'gente fora do envio. Unicidade por (unit_id, lower(btrim(name))); acento NÃO é normalizado, '
  'a padronização é feita por renomeação pela administração.';

COMMENT ON COLUMN users.sector_id IS
  'Setor da pessoa, ou NULL para "sem setor" (estado válido). A FK é COMPOSTA com unit_id, '
  'de modo que o banco recusa setor de outra unidade — não só a rota. Trocar a unidade de uma '
  'pessoa exige zerar esta coluna no mesmo passo, ou a FK recusa o UPDATE (o que é o '
  'comportamento seguro).';
