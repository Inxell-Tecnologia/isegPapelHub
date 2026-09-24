-- Cota individual de armazenamento (change `cota-por-usuario`, design.md D1).
--
-- `NULL` significa **"segue o padrão da plataforma"**
-- (`config.storageQuotaBytesPerUser`, de `STORAGE_QUOTA_BYTES_PER_USER`), e não
-- "sem cota": a resolução da cota efetiva vive em `lib/quota.ts`. Por isso a
-- coluna é nullable e **sem DEFAULT** — um default no schema duplicaria o padrão
-- da aplicação e as duas fontes divergiriam no primeiro `terraform apply`.
--
-- Sem backfill de propósito: `NULL` já é o estado correto de toda linha
-- existente, e `ADD COLUMN` nullable sem default não reescreve a tabela — a
-- migration roda em produção antes da troca de tráfego (deploy.yml).
--
-- Nenhuma policy RLS nova: `users` já tem `unit_id` e policy; a coluna entra sob
-- a mesma fronteira de isolamento.
ALTER TABLE users ADD COLUMN storage_quota_bytes bigint;

COMMENT ON COLUMN users.storage_quota_bytes IS
  'Exceção nominal de cota, em bytes. NULL = segue o padrão da plataforma. Concedida apenas por global_admin.';
