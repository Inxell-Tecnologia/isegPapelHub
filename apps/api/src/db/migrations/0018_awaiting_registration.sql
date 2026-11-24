-- US 10.9 (change `arquivo-geral-e-pendente-de-cadastro`, design.md D1): o
-- arquivo enviado em lote sem os dados de controle exigidos deixa de ser
-- publicado sem rastreio e passa a nascer **pendente de cadastro** — fica na
-- pasta, mas fora de circulação até alguém completá-lo.
--
-- Coluna em `files`, não tabela nova, pela mesma razão de 0016: os campos
-- entram sob a fronteira de isolamento que `files` já tem (coluna `unit_id` +
-- policy de 0002_enable_rls.sql, que é por **linha**, não por coluna), e
-- **nenhuma policy RLS nova é criada**.
--
-- Por que um marcador gravado, e não derivação da ausência de dados
-- (design.md D1): o acervo anterior ao controle documental também não tem
-- tipo, código nem revisão. Derivar "pendente de cadastro" das colunas vazias
-- marcaria todo esse acervo retroativamente e o **tiraria de circulação de uma
-- vez** — regressão silenciosa de alcance, atingindo exatamente os arquivos
-- que a US 10.5 cenário 3 promete não invalidar. O marcador é fato sobre o
-- envio ("este item entrou incompleto, sob a regra nova"), não inferência
-- sobre o estado atual das colunas.
--
-- `DEFAULT false` é o que preserva esse acervo: tudo que já existe nasce
-- publicado, e continua com situação "Sem controle de revisão". `NOT NULL`
-- porque não há terceiro estado — ou o arquivo aguarda cadastro, ou não.
--
-- Sem backfill, por decisão (design.md, Migration Plan). Reverter o código
-- deixa a coluna inerte sem perder dado e sem mudar a visibilidade de nenhum
-- arquivo, porque `false` é o estado que o código anterior pressupõe para
-- todos.
--
-- Nenhum índice de início: a cláusula nova entra por `AND` em consultas que já
-- filtram por `deleted_at`, `unit_id` e pasta. Medir antes de acrescentar, como
-- foi feito em 0017.
--
-- Não confundir com `files.status` (`pending`/`active`/`replacing`/
-- `over_quota`), que descreve o ciclo do **upload**. São eixos independentes:
-- um arquivo pode estar `active` e aguardando cadastro, ou `pending` e já com
-- todos os dados. O nome evita de propósito a palavra "pending" (design.md D9).
ALTER TABLE files
  ADD COLUMN awaiting_registration boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN files.awaiting_registration IS
  'TRUE = arquivo entrou sem os dados de controle exigidos e aguarda cadastro (US 10.9): '
  'alcançado só por quem o enviou e pela administração da unidade, por listagem, busca, '
  'identificador direto e manifesto de download. Estado do CADASTRO, não da transferência '
  '(ver files.status) nem da revisão (situação é derivada no SELECT).';
