# Design — esvaziar-lixeira

## Contexto

O expurgo permanente existe e é sólido: `purge-trash` remove bytes antes da
linha, devolve cota, limpa grants e auditoria, tolera falha por item e
reprocessa no ciclo seguinte. O que falta não é mecânica — é **gatilho**. Hoje o
único gatilho é o decurso de 30 dias.

## Decisões

### D1 — Expurgo sob demanda apaga arquivos, nunca pastas

Duas razões independentes, e qualquer uma bastaria.

**Pasta não devolve cota.** `storage_used_bytes` é alimentado por
`files.size_bytes`; a tabela `folders` não tem tamanho porque uma pasta não
ocupa bytes no storage. Uma ação cujo propósito declarado é recuperar espaço não
tem motivo para tocar em pastas.

**Pasta traz propriedade cruzada para dentro de uma ação interativa.** O job
apaga pastas em camadas de folhas, de baixo para cima, e o faz com contexto de
sistema sobre **todos** os itens vencidos ao mesmo tempo. Uma ação restrita aos
itens de **uma pessoa** não tem essa garantia: uma pasta minha na lixeira pode
abrigar, também na lixeira, o arquivo de outra pessoa — e apagá-la violaria a
chave estrangeira daquele arquivo. Resolver isso exigiria ou alargar o escopo
para itens alheios (recusado em D2) ou uma travessia com regras próprias de
"pasta que só contém itens meus". Nada disso compra espaço algum.

Pastas vazias na lixeira, portanto, permanecem até o job. Elas não custam nada a
ninguém.

### D2 — Escopo estritamente próprio, sem exceção para administrador

A rota expurga somente arquivos cujo `owner_id` é o do solicitante, sob o
contexto de unidade dele — a RLS já impede alcançar outra unidade, e o filtro
por dono impede alcançar outra pessoa da mesma unidade.

Administrador de unidade e administrador global **não** ganham essa ação sobre a
lixeira alheia. A justificativa é a natureza da cota: ela é por pessoa, o
problema que a ação resolve é "não tenho espaço", e ninguém tem esse problema em
nome de outro. Dar a um administrador o poder de apagar permanentemente, e sem
espera, os arquivos que um colaborador ainda poderia restaurar é uma capacidade
destrutiva nova, cross-pessoa e irreversível — que nenhuma US pede e cujo
desenho (quem pode, sobre quem, com que aviso, com que auditoria) é discussão
própria, não um efeito colateral desta fatia.

Nota sobre o bypass de `global_admin`: ele **não** é usado aqui. O CLAUDE.md o
restringe a agregados de painel, e esta é rota de conteúdo — destrutiva, ainda
por cima. O job continua varrendo cross-unit com contexto de sistema, que é
outro caminho e permanece intocado.

### D3 — A sequência de expurgo é extraída, não reescrita

A ordem do `purgeExpiredFiles` codifica invariantes que custaram design:

```
   1. bytes do objeto      ─┐
   2. bytes do pending      │  idempotente, ANTES da linha: nunca deixar
      (substituição órfã)  ─┘  linha viva apontando bytes removidos
   3. cota devolvida ao dono
   4. auditoria do arquivo
   5. grants órfãos
   6. a linha do arquivo, por último
```

Reimplementar essa sequência na rota seria duplicar seis passos cuja ordem
importa, com a garantia de que uma das duas cópias divergiria no primeiro ajuste.
Ela vai para `lib/purge-file.ts`, recebendo o cliente de transação e o registro
do arquivo, e passa a ser consumida pelas duas pontas.

O que **não** vai para a função compartilhada é a seleção dos itens: o job
seleciona por `deleted_at` vencido, cross-unit, com contexto de sistema; a rota
seleciona por dono e `deleted_at IS NOT NULL`, sem prazo, no contexto de unidade
do solicitante. A diferença entre as duas está inteiramente na consulta de
seleção, e é aí que ela deve ficar visível.

A tolerância a falha por item é preservada: uma falha ao remover bytes de um
arquivo não impede o expurgo dos demais, e o arquivo que falhou permanece
íntegro — na rota, ele simplesmente continua na lixeira e volta a ser candidato
na próxima tentativa ou no ciclo do job.

### D4 — Irreversibilidade precisa ser dita antes, não descoberta depois

A ação não tem desfazer: os bytes saem do storage. A confirmação na SPA informa
**quantos arquivos** serão apagados e **quanto espaço retorna** — o segundo
número é a razão pela qual a pessoa está ali, e o primeiro é o custo que ela
está aceitando. Uma confirmação genérica ("tem certeza?") não permite avaliar a
troca.

Após o expurgo, a listagem da lixeira e a consulta de cota são invalidadas, para
que a pessoa veja imediatamente o espaço recuperado — é o encerramento do ciclo
que começou na recusa detalhada do envio.

**De onde vêm os dois números.** De `GET /files/quota`, que já devolve
`trashedBytes` — a soma dos arquivos **do solicitante** na lixeira, exatamente o
conjunto que a rota apaga. Falta apenas o par de contagem, e ele entra ali, como
`trashedFiles`, na mesma leitura: dois números do mesmo retrato nunca se
contradizem. `GET /trash` não serve para isso — lista **raízes de exclusão no
alcance** do solicitante (inclusive alheias, por grant `delete` ou por ser
admin), não informa tamanho, e não enxerga o arquivo que está na lixeira dentro
de uma pasta excluída, que ocupa bytes do mesmo jeito. Consequência assumida: se
o retrato de cota não estiver disponível, a ação não é oferecida — sem os
números, a confirmação seria a genérica que este D4 recusa.

## Riscos

- **Perda irreversível por engano.** Mitigada pela confirmação quantificada de
  D4. É risco inerente: a ação existe justamente para apagar antes do prazo.
- **Expurgo grande demora.** Esvaziar uma lixeira com milhares de arquivos faz
  uma chamada de storage por objeto. A resposta informa quantos foram apagados e
  quantos falharam; itens que falharem continuam na lixeira e reentram no ciclo
  do job. Se em uso real a operação se mostrar longa demais para uma requisição
  síncrona, o recorte natural é limitá-la por quantidade — sem mudar a regra.
- **Divergência entre job e rota após a extração.** Mitigada por D3: a sequência
  é uma só, e os testes existentes do job passam a cobrir também a rota.

**Rollback:** nenhuma migração, nenhum dado estrutural tocado. Reverter é o
redeploy da imagem anterior; a rota deixa de existir e o job segue idêntico.
Arquivos já expurgados não voltam — como não voltariam se o job os tivesse
expurgado.

## Open Questions

- **Teto de itens por chamada.** Não se introduz um agora, por falta de dado
  sobre o tamanho real das lixeiras. Se a operação se mostrar longa, o teto é a
  saída, com a mesma forma dos demais tetos configuráveis do `config.ts`.
