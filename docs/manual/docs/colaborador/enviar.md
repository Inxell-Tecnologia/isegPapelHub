# Enviar arquivos

Na página **Documentos**, há três formas de escolher o que enviar para a pasta atual:

- **Arrastar e soltar** — arraste **várias pastas e arquivos de uma vez** para a área
  de envio e solte. A estrutura de subpastas de **cada** pasta solta é recriada igual
  dentro do sistema, e arquivos que não estejam em pasta alguma vão direto para a
  pasta atual. Esta é a única forma de enviar **mais de uma pasta** na mesma operação:
  o seletor de pastas do navegador escolhe uma pasta por vez. A área de soltar não
  aparece em celular e tablet (ver [Limites](../referencia/limites.md)).
- **Enviar arquivos** — selecione **vários arquivos de uma vez** pelo seletor do
  navegador.
- **Enviar pasta** — selecione **uma pasta inteira** pelo seletor do navegador; a
  estrutura de subpastas é recriada igual. Em celular ou tablet, o botão continua
  visível, mas a ação é recusada ao tocar — o seletor de pasta do aparelho não suporta
  essa operação (ver [Limites](../referencia/limites.md)). Use um computador para
  enviar uma pasta inteira.

## Todo envio pede os dados de controle

Nenhum documento é publicado sem os dados obrigatórios — **tipo, código, revisão,
responsável e data de próxima revisão** —, enviado sozinho ou em lote. Cada arquivo
tem os seus próprios dados.

Quando a seleção tem **exatamente um arquivo** (e ele não vem de uma pasta), o
PapelHub pede os dados num formulário, antes de publicar, e recusa o envio se algum
faltar.

Para o que não é documento da Matriz — atas, planilhas de trabalho, apresentações —
escolha o tipo **Arquivo geral**, que pede **só o título**: os campos de código,
revisão e próxima revisão ficam indisponíveis, porque esse tipo declara não ter prazo
de revisão. Ver [Controle documental](controle-documental.md).

### A tabela de cadastro, no envio de vários arquivos

Ao selecionar ou arrastar **vários arquivos, ou uma pasta**, o PapelHub abre uma
**tabela de cadastro com uma linha por arquivo**. Ela é a confirmação do envio: nada é
transferido antes de você publicar ali.

A tabela aparece **depois** da verificação de espaço (abaixo) — se a seleção não
couber, você recebe o veredito antes de preencher qualquer coisa.

Em cada linha:

- **Título** vem preenchido com o nome do arquivo e é editável. É o nome com que o
  arquivo será gravado; a extensão original é preservada, você não precisa redigitá-la.
  Título em branco impede publicar — é o único dado que não admite pendência.
- **Tipo** e **Código** vêm **sugeridos** quando o nome do arquivo segue o padrão
  `SIGLA-AREA-Nº` (por exemplo, `PRT-NSP-001_Identificacao.pdf` sugere o tipo
  Protocolo e o código `PRT-NSP-001`). A célula sugerida aparece destacada, para você
  distinguir o que o sistema propôs do que você confirmou — confira antes de publicar.
- **Código** é individual de cada documento e único na sua unidade. Se dois arquivos
  do mesmo envio declararem o mesmo código, os dois são apontados e a publicação fica
  bloqueada até você ajustar.
- Uma etiqueta diz se a linha está **Completa** ou **Incompleta**; passando o mouse
  sobre a incompleta você vê quais dados faltam.

### Aplicar a todos

No topo da tabela, a linha **Aplicar a todos** preenche **tipo, revisão, responsável e
próxima revisão** em todas as linhas de uma vez, quando você clica em **Aplicar a
todos**. É o caminho para lotes grandes: cadastre o que é comum num gesto e ajuste
depois só as exceções.

Dois detalhes que valem saber:

- o **código não** entra no "aplicar a todos", porque é individual de cada documento;
- aplicar **sobrescreve** as linhas que você já tinha editado. Faça a aplicação
  primeiro e os ajustes individuais depois — cada linha pode ser alterada a qualquer
  momento antes de publicar.

### Publicar completos, e o que acontece com os incompletos

O botão de publicação diz quantos arquivos serão publicados e quantos ficarão
pendentes, e as duas coisas acontecem **no mesmo envio**: os arquivos das linhas
completas são publicados, e os das incompletas são enviados e ficam **Pendente de
cadastro** — fora de circulação, visíveis só para você e para a gestão da unidade, com
um aviso no sino, até que você complete o cadastro pela ação **Dados de controle** na
listagem. Nenhum arquivo é descartado por estar incompleto.

!!! info "Arquivo pendente ocupa o seu espaço"
    Um arquivo Pendente de cadastro é um arquivo de verdade na pasta: ele **conta na
    sua cota** como qualquer outro, mesmo sem aparecer para os leitores. Completar o
    cadastro não muda o espaço ocupado — o que muda é a circulação.

!!! warning "O cadastro da tabela não é rascunho"
    O que você digita na tabela existe só até você publicar. Se fechar a tela, ou
    cancelar, o cadastro é perdido e a seleção precisa ser refeita. Para lotes grandes,
    use **Aplicar a todos** e publique; o que ficar pendente você completa depois, com
    calma, pela listagem.

## Verificação antes de começar

Um envio grande pode levar dezenas de minutos, e por isso **nada é transferido antes
de o sistema verificar se cabe**. Ao receber sua seleção, o PapelHub:

1. **Analisa a seleção** — conta os arquivos e soma os tamanhos. Em seleções com
   milhares de arquivos isso leva alguns segundos, e a tela mostra **Analisando
   seleção…**, com a opção de **Cancelar**. Nada é enviado nessa fase.
2. **Consulta o seu espaço disponível** no servidor.
3. **Responde se cabe**, antes de transferir qualquer arquivo.

**Se couber**, a tela mostra a quantidade de arquivos e o volume a enviar e aguarda a
sua confirmação — o envio só começa depois dela. Com **um** arquivo, a confirmação é o
botão **Publicar documento** do formulário; com **vários**, é o botão de publicação da
tabela de cadastro.

**Se não couber**, nenhum arquivo é transferido e a tela mostra o volume da seleção, o
espaço disponível, quanto falta, e **onde o seu espaço está**: em arquivos ativos, em
arquivos na lixeira e em envios ainda não concluídos. Você pode então **enviar só o
que cabe** — o sistema abre a tabela de cadastro **apenas com o subconjunto que
couber**, informando com clareza quantos arquivos ficaram de fora. Você não cadastra
arquivo que não será enviado.

Não existe limite de **quantidade** de arquivos por envio imposto pela tela: o envio é
dividido internamente em partes, e a única recusa por tamanho é a que o seu espaço
disponível justifica.

## Acompanhar o envio

O andamento aparece como **um progresso único do conjunto**, medido pelos **bytes já
transferidos** sobre o total — e não pela contagem de arquivos concluídos, que andaria
aos trancos quando os arquivos têm tamanhos muito diferentes. Ao lado dele ficam a
quantidade de arquivos concluídos, o arquivo que está subindo no momento e, quando o
sistema já mediu a velocidade real da sua conexão, uma estimativa de tempo restante.

Os arquivos são enviados **alguns de cada vez**, não todos ao mesmo tempo — isso faz
cada arquivo concluir mais rápido do que se todos disputassem a conexão.

Se algum arquivo falhar, os outros continuam. As falhas aparecem como um **contador**,
e o botão **Ver falhas** lista quais foram, com **Repetir** em cada um.

Ao enviar um arquivo, **você se torna o dono dele** e passa a poder consultar quem o
acessou (ver [Auditoria](auditoria.md)).

## Cota de armazenamento

Cada colaborador tem uma cota de armazenamento (ver
[Limites](../referencia/limites.md) para o valor vigente desta implantação). Ao
atingir o limite, novos envios são recusados — com o detalhamento descrito acima.

!!! warning "Excluir arquivos não libera espaço de imediato"
    Excluir um arquivo o move para a **lixeira**, e um arquivo na lixeira **continua
    ocupando a sua cota**. O espaço só retorna quando o arquivo é apagado em
    definitivo — pelo expurgo automático, ao fim do prazo de retenção da lixeira
    (ver [Limites](../referencia/limites.md) para o prazo vigente), ou quando você
    mesmo **esvazia a lixeira**. Por isso, só excluir não resolve: a nova tentativa
    seria recusada do mesmo jeito.

    Quando um envio não couber, as saídas imediatas são **enviar só o que cabe** ou
    **esvaziar a lixeira** para recuperar na hora o espaço retido nela — lembrando que
    esvaziar apaga seus arquivos em definitivo, sem possibilidade de restauração (ver
    [Mover, renomear e excluir](renomear-e-excluir.md#esvaziar-a-lixeira-para-liberar-espaco-agora)).

Se o seu espaço se esgotar **durante** um envio já em andamento — porque outro
dispositivo ou outra aba consumiu espaço no intervalo —, o envio **pausa**: os
arquivos já transferidos permanecem enviados, o restante não é tentado, e a tela
informa que o envio ficou **incompleto** e quantos arquivos não foram enviados, com o
mesmo detalhamento do espaço.

## Compartilhar um arquivo que você enviou

Enviar um arquivo faz de você o **dono**, mas não concede permissão a mais ninguém
sobre ele. **Conceder permissão é ação da administração da sua unidade** — se você
precisa que outro colaborador acesse um arquivo que enviou, peça a um administrador que
conceda a permissão (ver [Permissões](../administrador/permissoes.md)). Você não vê o
botão **Permissões** na tela, porque essa ação não está disponível para o perfil de
colaborador.
