# Design

## Context

Marcação (`reading_campaigns`) e atribuição (`reading_assignments`) têm
`unit_id` + RLS (C1). A situação de cada atribuição é derivada na consulta
(`READING_STATUS_SQL`). A C0 marcou no cadastro quem acompanha e com que alcance
(`users.reading_oversight`: `sector`, `unit`, `all_units`), e essa marcação
**não** concede acesso a conteúdo — nenhuma regra de `lib/access.ts` a lê. O
admin global já tem um bypass de RLS, travado para agregados: rotas de
conteúdo comparam a unidade do recurso.

## Goals / Non-Goals

**Goals**

- Os números e a lista nominal de 3.5, nos três recortes, cada um com teste.
- A exceção da Governança exatamente do tamanho da D5, e nem um campo a mais.
- Exportar Excel e PDF sem a API montar artefato.

**Non-Goals**

- Abrir documento de outra unidade (D7); relatório consolidado de várias
  marcações num arquivo só; agendamento de envio do relatório.

## Decisions

### D1 — Um recorte só, expresso em SQL, para lista e relatório

A atribuição `a` (de pessoa **ativa** `u`, da marcação `c`) é visível a quem
consulta quando:

```
c.created_by = :eu                                   -- publicador
OR :alcance = 'all_units'                             -- Governança (D3)
OR (:alcance = 'unit'   AND c.unit_id = :minha_unidade)
OR (:alcance = 'sector' AND c.unit_id = :minha_unidade AND u.sector_id = :meu_setor)
```

O alcance e o setor de quem consulta são **relidos do banco** a cada
requisição (como `attachTenantContext` faz com papel e status): tirar a
marcação de gestor corta o acompanhamento na requisição seguinte. Uma única
função monta o fragmento para a lista de marcações e para o relatório nominal —
duas cópias divergiriam, e a que divergisse vazaria.

Cada marcação visível leva o seu **recorte**: `full` (publicador, gestor da
unidade, Governança) ou `sector` (só o setor do gestor), apresentado na tela
("Sua equipe: setor CME") para o número não ser lido como o da marcação
inteira. Pessoas de vários recortes somam por união: o publicador que também é
gestor do setor vê o público inteiro das marcações que criou.

### D2 — Números de 3.5, e o que conta

Sobre as atribuições visíveis da marcação: **público** (total), **confirmados**
(concluída), **pendentes**, **atrasados**, **encerradas** (nova revisão,
obsoleto, excluído) e **adesão** = confirmados ÷ público, em %, arredondada;
sem público, adesão ausente. Pessoa **desativada** não conta e não aparece na
lista — "pendências de usuário desligado saem do cálculo de adesão" (3.3); o
registro dela continua no banco. A marcação aparece **em curso** enquanto a
revisão marcada é a vigente de um documento não obsoleto e não excluído — a
mesma condição de `READING_STATUS_SQL` —, e **encerrada** depois, com o
histórico preservado.

### D3 — Governança: a exceção estreita da D5, num lugar só

Para quem tem `reading_oversight = 'all_units'` a consulta atravessa unidades —
é o "quem leu e quem não leu em cada unidade" da resposta 7(a). A RLS do
contexto da pessoa não permitiria; a consulta roda com o **contexto de sistema**
(o mesmo das rotinas), **só** nesse ramo, **só** dentro de
`lib/reading-oversight.ts`, e só depois de reler do banco que a pessoa está
ativa e tem esse alcance.

O que ela lê: `reading_campaigns` (código, título e revisão já copiados na
marcação, C1 D1), `reading_assignments`, e de `users`/`sectors`/`units` só
**nome, setor e unidade**. De `files` lê apenas as três colunas que decidem se
a marcação está em curso (revisão atual, obsoleto, excluído), e **nada** de
`files` vai à resposta — nem id, nem nome, nem caminho. Não há URL assinada,
listagem de pasta nem `audit_events` neste caminho.

O que ela **não** abre, e o teste fixa: a mesma pessoa continua recebendo
recusa indistinguível de inexistente em `view-url`, `download-url`, auditoria
e no estado de leitura de um arquivo de outra unidade — a marcação da C0
continua sem ser lida por `lib/access.ts`.

O publicador e o gestor rodam no **próprio** contexto: a RLS e o fragmento
limitam à unidade duas vezes.

### D4 — Duas rotas sob `/reading/oversight`

- `GET /reading/oversight` → `{ available, campaigns }`. `available` é verdade
  para quem tem alcance de acompanhamento marcado **ou** criou alguma marcação
  — é o que decide se a aba aparece; a lista vem com os números de D2, em curso
  primeiro, as mais recentes primeiro.
- `GET /reading/oversight/campaigns/:id` → a marcação com os números e a lista
  nominal visível. Marcação fora do recorte, de outra unidade (sem a exceção) ou
  inexistente → **404 indistinguível**.

Prefixo `/reading` já existe nas três listas; nenhuma muda.

### D5 — Filtros na tela, sobre a lista já recortada

A lista nominal de uma marcação é do tamanho do público (centenas, não
milhares). Os filtros de unidade, setor e situação são aplicados na SPA sobre o
que o servidor já recortou — filtrar não amplia nada, e a resposta não precisa
de parâmetros. O setor apresentado é o **do momento da ciência** para quem
confirmou (3.4) e o atual para quem não confirmou.

### D6 — Exportação montada no navegador

Seguindo a regra de que a API não monta artefato (o `.zip` de pasta é montado no
cliente com `client-zip`), Excel e PDF saem no navegador a partir da lista **já
filtrada** na tela: `write-excel-file` (`.xlsx`) e `jspdf` + `jspdf-autotable`
(`.pdf`). As bibliotecas são carregadas **sob demanda** (`import()` no clique),
para não pesar na carga da aplicação. O arquivo traz o documento, a revisão, a
unidade, o prazo, os filtros aplicados, os números e a lista, e o nome
`acompanhamento-<código>-rev<nº>.<ext>`. Nenhuma dependência nova no servidor.

### D7 — Aviso ao gestor leva ao relatório

O aviso `reading_overdue_team` (C3) ganha destino:
`/leituras?aba=acompanhamento&marcacao=<id>`. A aba e a marcação vêm do
endereço, de modo que o link abre direto o relatório; marcação fora do recorte
de quem abre cai no 404 de D4 e a tela diz que o relatório não está disponível.

## Risks / Trade-offs

- **A exceção da Governança é o furo deliberado no isolamento.** Mitigação: um
  ramo, um arquivo, contexto de sistema só ali, colunas enumeradas, nada de
  `files` na resposta, e o teste de isolamento da D5 cobrindo bytes, auditoria e
  estado do arquivo de outra unidade para a mesma pessoa.
- **Desativado some do relatório.** Atende 3.3 ("sai do cálculo"); quem precisar
  da ciência histórica de um desligado a encontra no banco. Registrado como
  lacuna.
- **Gestor do setor vê a marcação só pela sua equipe**, e marcação sem ninguém
  do setor não aparece para ele.
- **Administrador da unidade** não acompanha por ser administrador; acompanha o
  que marcou, ou pela marcação da C0 feita por outro administrador.

## Migration Plan

Sem migração. API e SPA juntas. Dependências novas só na SPA.

## Open Questions

- Se a Governança quiser um relatório consolidado de várias marcações num
  arquivo só, entra como evolução da exportação, sem mudar o recorte.
