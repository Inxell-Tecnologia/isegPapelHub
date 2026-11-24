# Design

## Context

`users` tem papel (`role`), setor (`sector_id`, entidade por unidade desde a
A1) e cargo (`job_title`, texto livre). O cliente rejeitou deduzir o gestor do
cargo (resposta 6a): "Coordenadora" e "Coord." seriam duas coisas para o
sistema. A marcação é um dado novo, explícito.

## Goals / Non-Goals

**Goals**

- Registrar, por pessoa, se e o que ela acompanha.
- Fixar as regras que impedem estado incoerente (gestor do setor sem setor).
- Deixar o dado pronto para C3 e C4, relido a cada requisição.

**Non-Goals**

- Qualquer visão nova: a tela de acompanhamento e o relatório são da C4.
- Avisar o gestor (C3).

## Decisions

### D1 — Uma coluna enumerada em `users`, não uma tabela

`users.reading_oversight text NULL CHECK IN ('sector','unit','all_units')`. Um
alcance por pessoa basta: a resposta 3b dá a cada pessoa um alcance, e uma
tabela de vínculos só seria necessária para "acompanha os setores X e Y", que
ninguém pediu. Coluna de `users` herda `unit_id` e RLS — nenhuma policy nova.

### D2 — "do setor" exige setor, no banco

`CHECK (reading_oversight IS DISTINCT FROM 'sector' OR sector_id IS NOT NULL)`.
A regra fica no banco porque há dois caminhos para violá-la — marcar sem setor
e **remover o setor** de quem já é gestor do setor — e o segundo passa pela
edição de setor, não pela de marcação. A rota traduz a violação (`23514`) em
**409 `reading_oversight_requires_sector`**, recusa total. Converter em
"unidade" em silêncio ampliaria o alcance sem ninguém pedir.

### D3 — "todas as unidades" é do administrador global

Atribuir, alterar ou retirar o alcance `all_units` exige `global_admin`. O
administrador da unidade recebe **403** ao tentar marcar `all_units` e também
ao mudar a marcação de quem já a tem — retirar é tão sensível quanto atribuir,
porque a concessão veio de cima. É a exceção estreita de D5 do plano,
concedida pessoa a pessoa.

### D4 — Ninguém altera a própria marcação

Mesma trava de "Nenhuma pessoa altera o próprio papel": a marcação amplia o
que a pessoa verá na C4, e ampliar o próprio alcance é exatamente o que a trava
existe para impedir. Reenviar o **mesmo** valor não é alteração (o formulário
sempre manda o vigente).

### D5 — Quem marcou e quando

`reading_oversight_set_by uuid` e `reading_oversight_set_at timestamptz`,
gravados quando o alcance **muda**. É o "fica registrado quem tem esse alcance"
que o questionário prometeu ao cliente (pergunta 8). Não entram na resposta da
API por ora: são trilha, e a tela de auditoria de pessoas não existe.

### D6 — Na identidade, pela mesma releitura

`readingOversight` entra em `AuthenticatedIdentity` pela consulta de
`attachTenantContext` que já traz nome, função e setor. A C4 vai decidir a
visão por esse dado; relê-lo a cada requisição é o que faz retirar a marcação
cortar a visão na hora, como desativar uma conta corta o acesso.

### D7 — Nenhuma regra de acesso lê a marcação

`lib/access.ts` não muda. Um teste prova que um gestor da unidade continua sem
alcançar arquivo alheio sem concessão — o que a marcação libera é **só** a
visão de acompanhamento da C4 e o aviso da C3, e isso fica escrito como limite
na spec.

### D8 — Rótulos "Gestor do setor / da unidade / de todas as unidades"

A A7 reservou "Gestor" a este papel; os três rótulos o qualificam pelo
alcance. Origem única dos rótulos, como `ROLE_LABEL`.

## Risks / Trade-offs

- **Primeiro atributo que vai ampliar visão.** Mitigado por D7 e pela trava de
  auto-edição (D4).
- **Gestor do setor sem setor na base atual**: impossível de criar, pelo
  `CHECK` (D2). Nenhum dado existente é afetado — a coluna nasce nula.

## Migration Plan

Migração aditiva (`0023`): três colunas anuláveis e um `CHECK` que toda linha
existente satisfaz (marcação nula).

## Open Questions

Nenhuma.
