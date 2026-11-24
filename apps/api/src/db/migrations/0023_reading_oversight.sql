-- Change `gestor-de-acompanhamento` (fatia C0 do plano da demanda nº 2):
-- marcação explícita de quem acompanha as leituras da equipe e com que alcance
-- (`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, respostas 6a e 8).
--
-- Coluna de `users` (design.md D1): herda `unit_id` e RLS, nenhuma policy
-- nova. Nula = não acompanha; toda linha existente nasce assim.
--
-- **Nenhuma regra de `lib/access.ts` lê esta coluna** (design.md D7): ela não
-- concede acesso a conteúdo.
ALTER TABLE users
  ADD COLUMN reading_oversight text NULL
    CHECK (reading_oversight IN ('sector', 'unit', 'all_units')),
  -- Quem fez a última alteração e quando (design.md D5) — o "fica registrado
  -- quem tem esse alcance" prometido ao cliente.
  ADD COLUMN reading_oversight_set_by uuid NULL REFERENCES users (id),
  ADD COLUMN reading_oversight_set_at timestamptz NULL;

-- "do setor" exige setor (design.md D2), **no banco**: há dois caminhos para
-- violar a regra — marcar sem setor e remover o setor de quem já é gestor do
-- setor —, e o segundo passa pela edição de setor, não pela de marcação. A
-- rota traduz a violação em 409 `reading_oversight_requires_sector`.
ALTER TABLE users
  ADD CONSTRAINT users_reading_oversight_sector_check
    CHECK (reading_oversight IS DISTINCT FROM 'sector' OR sector_id IS NOT NULL);
