# Design

## Context

A C1 deixou pronta a lista das leituras da pessoa (`GET /reading/mine`), com a
situação apurada pelo relógio do Postgres (`READING_STATUS_SQL`: pendente,
atrasada, concluída, encerrada) e, para as que ainda levam ao documento, o
resumo do arquivo confirmado por `hasAccess`. O visualizador já confirma a
ciência a partir dessa mesma lista. A A2 criou o menu agrupado, e a A3 a coluna
direita do Início com dois cartões reservados.

## Goals / Non-Goals

**Goals**

- Que o leitor veja, sem procurar, quantas leituras tem abertas e chegue a
  cada uma em um clique.
- Que quem navega em Documentos reconheça o documento de leitura obrigatória.

**Non-Goals**

- Avisos no sino e atraso notificado (C3); acompanhamento e relatório (C4).

## Decisions

### D1 — Uma consulta só para menu, cartão, abas e visualizador

O contador do menu, o cartão do Início, as abas e o rodapé do visualizador
leem **a mesma consulta** (`useMyReadings`, chave `my-readings`). O TanStack
Query a deduplica, e a confirmação de ciência já a invalida (C1): confirmar no
visualizador atualiza o contador, o cartão e as abas sem nenhuma chamada a
mais, e as quatro superfícies nunca divergem entre si.

Não há rota de contagem à parte. A lista da pessoa é pequena (dezenas de
itens, não milhares), e uma segunda rota repetiria a reconciliação de quem
entra depois no público (`reconcileForUser`) — duas fontes para a mesma
pergunta é como uma delas envelhece sozinha. Se a lista crescer, a rota de
contagem entra sem mudar as telas.

### D2 — "Aberta" = pendente ou atrasada; encerrada não aparece

| Situação | Aba | Contador |
| :-- | :-- | :-- |
| Pendente | Pendentes | conta |
| Atrasada | Pendentes, sinalizada "Atrasada" em tom negativo | conta |
| Concluída | Concluídas | não |
| Encerrada | nenhuma | não |

A atrasada **continua aberta** (3.2, etapa 4) e por isso fica em Pendentes,
ordenada primeiro (a API já ordena atrasadas, pendentes, concluídas). A
sinalização em tom negativo é só apresentação da situação que a C1 já apura; o
**aviso** de atraso continua na C3.

A encerrada (nova revisão, obsoleto, excluído) não é pendência nem ciência — a
demanda só conhece "Pendentes" e "Concluídas" para o leitor. Apresentá-la numa
das duas mentiria; o histórico delas é assunto do acompanhamento (C4).

### D3 — "Ler e confirmar ciência" abre o visualizador, não confirma

O botão do cartão e da aba abre o `PreviewModal` com o arquivo da leitura; a
confirmação continua sendo a do rodapé do visualizador, habilitada só depois
que o documento abre (C1, D7). Um atalho que confirmasse direto pularia a
leitura — exatamente o que a etapa 3 proíbe.

Leitura aberta **sem arquivo** na resposta (a pessoa perdeu o alcance entre a
marcação e a consulta) não oferece o botão: acionador que conduz a recusa é o
que `tela-inicial` proíbe. Aparece o texto "Documento indisponível".

### D4 — Ícone na linha: coluna do resumo, revisão vigente

`fileSummaryColumns` ganha `required_reading`: existe marcação para a
**revisão atual** do arquivo e ele não é obsoleto — a mesma condição em que a
C1 considera a marcação em curso (`READING_STATUS_SQL`, ramo `closed`). Sai na
mesma consulta da listagem, como `can_edit_control`, sem round-trip por linha;
as consultas que usam o fragmento leem `FROM files` sem alias, e a subconsulta
correlaciona por `files.id`.

A RLS de `reading_campaigns` limita a subconsulta à unidade do contexto, e a
linha já passou pelo recorte de alcance da listagem — a coluna **não amplia**
nada: diz uma propriedade de um documento que a pessoa já vê. Não revela o
público nem o prazo (detalhes da marcação continuam só para quem marca, C1).

Na SPA, `requiredReading` é opcional com `.catch(undefined)`, como
`canEditControl`: API mais antiga que a SPA não derruba a listagem, e ausência
é "não apresentar o ícone". O ícone tem nome acessível ("Leitura
obrigatória") e dica com o mesmo texto; a informação nunca é só a cor.

### D5 — Destino `/leituras`, para qualquer papel

Toda pessoa pode ser do público, então o destino não tem guarda de papel (como
Compartilhados comigo e Favoritos). O caminho da SPA não colide com o prefixo
`/reading` da API — e por não ser prefixo de API, não entra nas três listas.

### D6 — Contador: número visível e nome acessível completo

O item mostra o contador só quando há leitura aberta (zero não é apresentado,
como no sino). O nome acessível do link inclui a contagem por extenso
("Leitura obrigatória, 2 pendentes"), para quem não enxerga o selo. No modo
colapsado a coluna mostra só ícones e o design system esconde o rótulo — e o
selo com ele —, então a dica apresentada ao apontar o item traz a contagem
("Leitura obrigatória (2)").

## Risks / Trade-offs

- **Consulta com escrita**: `GET /reading/mine` reconcilia a pendência de quem
  entrou depois (C1, D2) e agora roda em toda tela autenticada, pelo menu. A
  reconciliação é idempotente (`ON CONFLICT DO NOTHING`) e limitada à pessoa;
  aceito. A C3 vai reconciliar diariamente e tirar o peso da consulta.
- **Contador sem atualização ativa**: atualiza ao montar, ao voltar o foco à
  janela (padrão do TanStack Query) e após confirmar ciência. Marcação feita
  por outra pessoa aparece na próxima dessas ocasiões; o aviso imediato é do
  sino (C3).

## Migration Plan

Sem migração. Deploy da API e da SPA juntos; a SPA tolera a API anterior (D4).

## Open Questions

- Quantas pendências o cartão do Início lista antes do "Ver todas" — fixado em
  3, a confirmar na homologação.
