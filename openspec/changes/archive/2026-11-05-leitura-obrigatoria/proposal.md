# Proposal

## Why

A seção 3 de `docs/demanda_cliente_2.md` pede a **leitura obrigatória**: o
publicador marca um documento, define público e prazo, e cada pessoa do público
lê a revisão vigente e confirma a ciência, com registro de quem leu, quando e
qual revisão. É a fatia **C1** do plano em `docs/plano_demanda_cliente_2.md` —
o núcleo do bloco C, de que C2 (superfícies), C3 (avisos) e C4 (relatório)
dependem. A A7 liberou o nome "Gestor" e a C0 registrou quem acompanha; nada
mais trava esta fatia.

## What Changes

- **Marcar** (etapa 1): em "Mais opções > Leitura obrigatória" na linha do
  arquivo do explorador, para quem pode editar os dados de controle do
  documento. Só documento **controlado, em vigor** (Vigente ou a vencer) **e
  que abre no visualizador** — nunca Arquivo geral, pendente de cadastro, em
  revisão, vencido, obsoleto ou em formato sem pré-visualização.
  Público **combinável** — toda a unidade, setores, perfis de acesso, pessoas —,
  prazo com padrão de **15 dias** e mensagem opcional; **prévia da contagem**
  de pessoas antes de confirmar. Uma marcação por revisão.
- **Dar ciência** (etapa 3): no visualizador, o botão **"Confirmar ciência"**
  no rodapé, habilitado só depois que o documento abre; a confirmação mostra a
  declaração nominal ("Declaro que li e compreendi o documento [código] -
  [título], Rev. [nº].") e é **irreversível**.
- **Registros** (3.4): marcação com documento, código, revisão, público, prazo,
  mensagem, quem marcou e quando; ciência com pessoa, unidade, setor (como
  estava no momento), documento, código, revisão, data e hora.
- **Regras** (3.3), apuradas **na consulta**, pelo relógio do Postgres, sem
  rotina:
  - a ciência vale **por revisão**: substituir o arquivo encerra as pendências
    da revisão anterior, e o publicador **pede nova ciência ao mesmo público**
    marcando a revisão nova — o formulário vem preenchido com o público
    anterior; as ciências antigas ficam no histórico;
  - revisão que vira **obsoleta** encerra as pendências abertas;
  - pessoa **desativada** sai do público;
  - pessoa que **entra no público depois** (admissão, troca de setor) recebe a
    pendência com prazo de 15 dias a partir de quando é alcançada.
- **Ser do público libera visualizar o documento.** Hoje um colaborador só vê
  documento alheio por concessão explícita; sem isto, quase ninguém do público
  conseguiria ler. É um ramo **novo e estreito** em `lib/access.ts`: só o verbo
  `view`, só a revisão marcada e vigente, só na unidade do documento — não
  baixa, não altera, não aparece na navegação nem na busca.
- **Rotas novas** sob o prefixo de topo `/reading` (nas três listas): estado da
  leitura de um arquivo, opções de público, prévia, marcação, minhas leituras
  e ciência. A lista "minhas leituras" é a API que a C2 apresenta nas abas.

### Fora desta fatia

- Marcar **na etapa final do envio** — esta fatia cobre o "depois"; o envio
  passa a oferecê-lo numa fatia futura.
- Sino, contador, cartão do Início, abas e ícone na linha (C2); avisos de
  atraso (C3); acompanhamento e relatório (C4).

## Capabilities

### New Capabilities

- `leitura-obrigatoria` — marcação, público, ciência, situação e regras.

### Modified Capabilities

- `controle-acesso` — o destinatário de leitura obrigatória visualiza a
  revisão marcada.
- `web-navegacao` — ação "Leitura obrigatória" na linha do arquivo.
- `web-visualizacao` — "Confirmar ciência" no rodapé do visualizador.

## Impact

- **Banco**: migração `0024_reading.sql` (`reading_campaigns`,
  `reading_assignments`, com `unit_id` + RLS).
- **API**: `routes/reading.ts`, `lib/reading.ts` (público e situação),
  `lib/access.ts` (ramo `view`), prefixo `/reading` em `api-prefixes.ts`,
  `vite.config.ts` e `locals.tf`.
- **Shared**: `reading.ts` (DTOs).
- **Web**: `leitura/` (modal de marcação, consultas), ação no `ExplorerPage`,
  rodapé no `PreviewModal`.
- **Documentação**: manual (página nova); PRD (US 12.2 e 12.3); plano.
