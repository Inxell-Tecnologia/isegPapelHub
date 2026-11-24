-- Épico 10 (change `controle-documental`, design.md D1/D5): o repositório de
-- arquivos passa a ser um repositório de **documentos controlados**.
--
-- Colunas em `files`, não tabela nova (design.md D1): tabela nova com dado de
-- unidade exigiria `unit_id` e policy RLS própria — mais uma superfície de
-- isolamento para manter correta, em troca de um JOIN em todo `SELECT` de
-- listagem. Aqui os campos entram sob a fronteira de isolamento que `files` e
-- `folders` já têm, e **nenhuma policy RLS nova é criada**.
--
-- Todas nuláveis e sem DEFAULT, sem backfill: `ADD COLUMN` nulável sem default
-- não reescreve a tabela (mesmo raciocínio de 0015), e "sem dado de controle"
-- já é o estado correto de todo o acervo existente — ele nasce com situação
-- "Sem controle de revisão", por desenho (design.md, Non-Goals).
--
-- Não há coluna de **situação**: ela é derivada no `SELECT`, pelo relógio do
-- banco (design.md D2, `lib/document-control.ts`). Gravá-la exigiria rotina
-- diária e abriria a janela de mentira entre a virada da data e a execução do
-- job — exatamente o defeito que a vigência de concessões já evita.
ALTER TABLE files
  ADD COLUMN document_type text,
  ADD COLUMN document_code text,
  ADD COLUMN document_revision integer,
  ADD COLUMN responsible_sector text,
  ADD COLUMN next_review_at date,
  ADD COLUMN lifecycle_state text;

COMMENT ON COLUMN files.document_type IS
  'Tipo documental (enum DocumentType de @gdoc/shared). NULL = arquivo sem classificação.';
COMMENT ON COLUMN files.document_code IS
  'Código do documento, único por unidade entre os não excluídos (ver files_unit_document_code_uidx).';
COMMENT ON COLUMN files.document_revision IS
  'Revisão vigente, inteiro (design.md D8). NULL = documento sem numeração — substituir NÃO inaugura numeração.';
COMMENT ON COLUMN files.next_review_at IS
  'Data da próxima revisão. NULL = sem controle de revisão; a situação é derivada daqui no SELECT, nunca gravada.';
COMMENT ON COLUMN files.lifecycle_state IS
  'Estado DECLARADO do ciclo de vida (current/in_review/obsolete, enum DocumentLifecycleState). NULL = vigente, não declarado.';

-- Tipo da pasta, para cor e ícone no explorador (design.md D1). Mesma
-- natureza das colunas acima: nulável, sem backfill.
ALTER TABLE folders ADD COLUMN folder_type text;

COMMENT ON COLUMN folders.folder_type IS
  'Tipo documental predominante da pasta (enum DocumentType). Apresentação apenas — não restringe o conteúdo.';

-- O conjunto fechado dos oito tipos e dos três estados declarados **não** é
-- CHECK de schema de propósito: eles são constantes de produto no contrato
-- compartilhado (design.md D4, como `UserRole` e `Permission`), e a API é o
-- único guardião de regra do sistema. Um CHECK aqui transformaria "acrescentar
-- um nono tipo" numa migração de banco, e duplicaria num segundo lugar uma
-- lista que já tem fonte única em `packages/shared`.

-- Unicidade do código por unidade (design.md D5): a garantia é do **banco**,
-- não da aplicação — duas requisições simultâneas com o mesmo código não
-- conseguem ambas gravar. Parcial em dois eixos:
--   - `deleted_at IS NULL`: código de documento na lixeira fica livre para
--     reuso (requisito "Código de documento excluído é liberado para reuso").
--     A consequência — restaurar o original passa a ser recusado — é
--     normatizada e tratada com erro próprio (`document_code_in_use`).
--   - `document_code IS NOT NULL`: o acervo sem código não disputa o índice.
-- `lower(...)` segue o precedente de `folders_unit_parent_name_uidx` (0006):
-- `PRT-001` e `prt-001` na mesma unidade seriam confusão para o usuário, e a
-- busca por código é explicitamente insensível a maiúsculas.
CREATE UNIQUE INDEX files_unit_document_code_uidx
  ON files (unit_id, lower(document_code))
  WHERE deleted_at IS NULL AND document_code IS NOT NULL;

-- Apoio à busca por código (mesmo padrão de 0010 para `file_name`): o termo
-- é comparado com curinga à esquerda, que não usa B-tree comum.
CREATE INDEX IF NOT EXISTS files_document_code_trgm_idx
  ON files USING gin (document_code gin_trgm_ops);
