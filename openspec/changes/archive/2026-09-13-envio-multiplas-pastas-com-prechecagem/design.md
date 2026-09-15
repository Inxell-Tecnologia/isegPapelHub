# Design — envio-multiplas-pastas-com-prechecagem

## Contexto

O envio em lote já tem o contrato certo e, com `corrige-defeitos-envio-lote`
aplicado, tem também o comportamento certo em escala. O que falta é **postura**:
hoje o sistema descobre a viabilidade tentando, e o usuário descobre o resultado
esperando. Esta fatia inverte isso — decide antes, e diz com precisão.

Números que sustentam as decisões, medidos sobre um perfil misto de documentos
de escritório (PDF digital 30%, docx 20%, PDF escaneado 15%, xlsx 15%, jpg de
câmera 12%, jpg digitalizado 8% — **média ponderada de 1,1 MB por arquivo**):

| Seleção | Volume | 5 Mbps | 20 Mbps | 100 Mbps | da cota de 10 GB |
| --------- | -------- | -------- | --------- | ---------- | ------------------ |
| 1.000 arquivos | 1,07 GB | 31 min | 8 min | 2 min | 11% |
| 2.000 arquivos | 2,13 GB | 1,0 h | 15 min | 3 min | 21% |
| 3.000 arquivos | 3,20 GB | 1,5 h | 23 min | 5 min | 32% |

## Decisões

### D1 — Arrastar e soltar é a única seleção múltipla de pastas possível

`webkitdirectory` abre um seletor de **pasta única** em todos os navegadores, e
`showDirectoryPicker()` também — além de não existir em Firefox nem Safari. Não
há botão que resolva; a única interação da plataforma que entrega N pastas de uma
vez é o `drop`.

A boa notícia é que a mecânica já está instalada. Com a propriedade `directory`
ativa, o `rc-upload` percorre `dataTransfer.items` por `webkitGetAsEntry()`,
desce recursivamente pelas subárvores e, ao emitir cada arquivo, **preenche
`webkitRelativePath` a partir do `fullPath` da entrada**
(`rc-upload/lib/traverseFileTree.js`). Consequências que determinam o desenho:

- `deriveRelativePath` funciona **sem uma linha de alteração** — o formato
  entregue (`PastaA/Sub/arquivo.pdf`) é o mesmo do seletor nativo.
- N pastas soltas produzem **um único array achatado**, que chega ao
  `beforeUpload` como uma seleção só. O envio de várias pastas é, para as camadas
  de baixo, indistinguível do envio de uma.
- A mesma travessia trata entradas de arquivo, então **uma** área de soltar cobre
  pastas e arquivos soltos misturados.

Os dois botões permanecem, e não por simetria: `drop` não é acionável por
teclado, e não existe em toque. A área de soltar segue a regra de
`web-responsividade` que já recusa "Enviar pasta" abaixo do limiar.

**Alternativa descartada:** acumular seleções sucessivas do botão ("clique
Enviar pasta três vezes") como caminho principal. Funciona — e de fato já
acumula hoje, por acidente do `setItems` — mas exige N diálogos para N pastas e
não é o que foi pedido. Continua disponível como caminho secundário, agora
alimentando a mesma área de preparo.

### D2 — `GET /files/quota`: dado da pessoa, não agregado de painel

A rota devolve, para o **próprio solicitante**:

| Campo | Origem |
| ------- | -------- |
| `quotaBytes` | `config.storageQuotaBytesPerUser` |
| `usedBytes` | `users.storage_used_bytes` |
| `trashedBytes` | soma de `size_bytes` dos arquivos do solicitante na lixeira |
| `pendingBytes` | soma de `size_bytes` dos arquivos em `pending`/`replacing` |
| `availableBytes` | `quotaBytes − usedBytes − pendingBytes` |

Três pontos de cuidado, todos deliberados:

**`trashedBytes` é informativo, não subtraído duas vezes.** Um arquivo na
lixeira **continua contando** em `storage_used_bytes` — o decremento só acontece
no job `purge-trash`. Então ele já está dentro de `usedBytes`; `trashedBytes`
existe para **explicar** onde parte do espaço está, não para entrar na conta.
Confundir isso produziria um disponível inflado e uma promessa falsa.

**A rota não usa o bypass de `global_admin`.** O CLAUDE.md restringe esse bypass
a agregados de painel; cota é dado de pessoa. A rota lê exclusivamente o
`ctx.userId` da sessão — não aceita identificador de usuário como parâmetro, de
modo que não existe superfície para consultar a cota de terceiro, nem dentro da
própria unidade.

**Não é uma garantia, é um retrato.** Entre a consulta e o fim de um envio de
quarenta minutos, outra aba do mesmo usuário pode consumir espaço. A guarda
continua sendo o servidor, fatia a fatia. Ver D7.

### D3 — A análise da seleção é local e gratuita

Contar arquivos e somar tamanhos **não lê bytes**: `File.size` vem dos metadados
que o navegador já tem. O custo real é a travessia do `dataTransfer`, que para
milhares de entradas leva segundos perceptíveis — daí um estado **"Analisando
seleção…"** com cancelamento, antes de qualquer número aparecer.

Ordem deliberada: analisar → consultar `GET /files/quota` → decidir. A consulta
vem **depois** da contagem, para que o retrato do espaço seja o mais recente
possível em relação ao momento da decisão.

### D4 — A recusa decompõe o espaço e desmente o conselho antigo

Quando a seleção não cabe, a recusa informa o tamanho pedido, o disponível, o
que falta, e a decomposição: ativos, **retido na lixeira com o prazo de
devolução**, e reservado por pendentes.

O ponto não-óbvio é a frase obrigatória de que **excluir arquivos não libera
espaço imediatamente**. Sem ela, a recusa induz exatamente o erro que o manual
hoje ensina (`enviar.md`: "Para voltar a enviar, libere espaço excluindo
arquivos") — a pessoa exclui 2 GB, tenta de novo e falha de forma idêntica, com
a confiança no produto reduzida em vez do problema resolvido. Uma recusa que
induz ação inútil é pior que uma recusa muda.

A saída acionável oferecida é **"enviar só o que cabe"**: a SPA seleciona o
prefixo da seleção que cabe no disponível e envia esse subconjunto, deixando o
restante identificado. Isso mantém a recusa produtiva sem depender do expurgo
imediato, que é fatia própria.

**Alternativa descartada:** recusar e apontar a lixeira como solução. Só seria
honesto com expurgo imediato disponível — e mesmo assim seria uma escolha do
usuário, não um caminho que a recusa deva pressupor.

### D5 — Fatiamento remove o teto da vista, sem removê-lo do servidor

O envio é dividido em fatias de no máximo **200 itens** ou **500 MB**, o que
vier primeiro, e cada fatia pede suas URLs **imediatamente antes** de
transferir.

Os números:

- **200 itens** — no pior caso medido (153 bytes por item, nome real com
  subpasta) uma fatia pesa ~30 KB de corpo, folga de 30× contra o teto de 1 MB
  de `corrige-defeitos-envio-lote`, e fica bem abaixo do teto de 500 itens por
  requisição.
- **500 MB** — numa conexão ruim de 2 Mbps, 500 MB levam ~35 min, dentro do prazo
  de 60 min da URL de envio (D3 de `corrige-defeitos-envio-lote`) e fora dos 30
  min anteriores. É o teto que impede uma fatia de arquivos pesados de vencer
  antes de terminar.

Os dois se revezam sozinhos: no perfil misto uma fatia de 200 pesa ~219 MB, e o
**item manda** — comportamento previsível. O teto de bytes só acorda em acervos
de escaneados pesados. Nenhum dos dois isoladamente serve.

**Onde os tetos moram, e por quê o servidor não impõe o "envio":** a fatia é um
conceito do cliente. A API vê requisições, nunca "o envio", e portanto **não
consegue** — nem deve — impor um teto sobre um conjunto que ela não observa. Isso
não é um furo: o teto por requisição continua validado no servidor
(`upload_batch_limit_exceeded`), e a guarda real do conjunto é a **cota**, que é
autoritativa, é do servidor, e já soma pendentes. O precedente está escrito no
próprio `config.ts`, sobre o manifesto de download: *"o limite protege a memória
do cliente, não o servidor"*.

**Não existe teto de arquivos por envio visível ao usuário.** Com fatiamento, os
limites que justificariam um são todos técnicos e todos dissolvidos. A única
recusa legítima é a que o espaço disponível justifica — e essa o usuário
entende, porque é sobre o acervo dele, não sobre uma constante nossa.

### D6 — Progresso macro medido em bytes

A barra mede **bytes transferidos sobre bytes totais**. Contagem de arquivos,
nome do arquivo corrente, e contador de falhas ficam como texto secundário.

Por bytes e não por arquivos: num acervo com docx de 180 KB ao lado de PDFs
escaneados de 2,6 MB, uma barra por contagem avança quatorze vezes mais rápido
num arquivo que noutro. Ela anda aos trancos, e qualquer estimativa de tempo
derivada dela é ficção. Por bytes a barra anda proporcional ao trabalho real e a
estimativa vale alguma coisa.

Efeito colateral desejado: a barra macro **elimina a lista de N linhas**. Com
2.000 arquivos, renderizar um `List.Item` com `Progress` por item trava a aba
antes do envio — e o envio ainda precisa rodar por dezenas de minutos naquela
mesma aba. As falhas colapsam num contador com detalhe sob demanda, que é o único
lugar onde uma lista por item ainda faz sentido, porque é curta por natureza.

O progresso de cada PUT continua vindo do `onProgress` do `put-object.ts`, que
não muda; o que muda é o consumidor, que passa a acumular bytes em vez de
manter percentual por item.

### D7 — Estouro no meio é exceção tratada, não fluxo normal

Com a pré-checagem, uma fatia recusada por cota significa que o espaço mudou
**depois** do retrato — outra aba, outro dispositivo. Comportamento:

```
   fatia 7 recusada por cota
            │
            ▼
   pausa o envio (não continua tentando as fatias seguintes)
            │
            ├──▶ o que já subiu permanece enviado
            ├──▶ reconsulta GET /files/quota  (o retrato agora é o real)
            └──▶ exibe o mesmo painel detalhado de D4, com o que falta
```

Não se continua para as fatias seguintes: se o espaço acabou, insistir só produz
uma sequência de recusas e uma árvore parcial imprevisível. Pausar deixa o estado
legível — "estas pastas subiram até aqui" — e a retomada é uma decisão informada.

A árvore fica **parcialmente** enviada, o que hoje não acontece (o lote único é
tudo-ou-nada dentro de uma transação). É uma perda real, aceita conscientemente:
a alternativa — desfazer o que já subiu — descartaria dezenas de minutos de
transferência bem-sucedida para restaurar uma pureza que ninguém pediu. A
pré-checagem é o que torna esse caso raro o bastante para que a troca valha.

## Riscos

- **O retrato da cota envelhece durante o envio.** Aceito e tratado em D7; a
  pré-checagem reduz a frequência, não elimina o caso. A guarda do servidor
  permanece intocada.
- **Árvore parcial após pausa.** Consequência direta de D7, registrada acima.
  Mitigada pela raridade e pela legibilidade do estado final.
- **Travessia de seleções enormes segura a aba.** Mitigada pelo estado
  "Analisando seleção…" com cancelamento (D3). Não se introduz teto de sanidade
  por contagem: seria reintroduzir pela porta dos fundos o limite que D5 remove,
  sem dado que o justifique.
- **Perda do progresso por item.** Alguém que gostava de ver as 1.000 barras
  perde isso. É o preço de a aba sobreviver ao envio; o detalhe continua
  disponível para as falhas, que é onde ele é acionável.

**Rollback:** nenhuma migração, nenhum dado tocado. Reverter é o redeploy da
imagem anterior — `GET /files/quota` deixa de existir e a SPA volta ao envio
não-fatiado. Arquivos já enviados não são afetados.

## Open Questions — resolvidas na implementação

- **Estimativa de duração na confirmação.** ~~Exibir "~12 min" exige uma taxa, e
  a primeira fatia é a única fonte honesta dela.~~ **Decidido: a confirmação não
  exibe estimativa.** Ela mostra o que é fato — quantidade de arquivos e volume —
  e cala sobre o que ainda não é. A estimativa aparece **durante** o envio, a
  partir da taxa medida (`estimarRestante`, com piso de 5 s de amostra), e não
  antes. Estimar de saída com uma taxa suposta mentiria justamente no primeiro
  minuto, que é quando a pessoa decide se espera — e uma estimativa que encolhe
  ou dobra sozinha ensina a ignorar a estimativa.
- **Tamanho do subconjunto em "enviar só o que cabe".** ~~Prefixo da ordem de
  travessia é o mais simples e previsível, mas pode partir uma subpasta ao
  meio.~~ **Decidido: prefixo da ordem de travessia** (`subconjuntoQueCabe`). A
  alternativa — preencher priorizando pastas inteiras — é mais agradável e menos
  previsível: o corte deixa de ter relação com a ordem que a pessoa vê, e o
  resultado não é antecipável. O preço do prefixo (partir uma subpasta) é pago
  pela interface, que declara exatamente quantos arquivos e quanto volume ficaram
  de fora. Nenhum arquivo é partido — a unidade é sempre o arquivo inteiro —, e o
  corte é no **primeiro** item que não cabe, sem garimpar itens menores adiante,
  pelo mesmo motivo: previsibilidade acima de aproveitamento.
