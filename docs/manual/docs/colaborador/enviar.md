# Enviar arquivos

Na página **Arquivos**, há três formas de escolher o que enviar para a pasta atual:

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

## Verificação antes de começar

Um envio grande pode levar dezenas de minutos, e por isso **nada é transferido antes
de o sistema verificar se cabe**. Ao receber sua seleção, o PapelHub:

1. **Analisa a seleção** — conta os arquivos e soma os tamanhos. Em seleções com
   milhares de arquivos isso leva alguns segundos, e a tela mostra **Analisando
   seleção…**, com a opção de **Cancelar**. Nada é enviado nessa fase.
2. **Consulta o seu espaço disponível** no servidor.
3. **Responde se cabe**, antes de transferir qualquer arquivo.

**Se couber**, a tela mostra a quantidade de arquivos e o volume a enviar e aguarda
você clicar em **Enviar** — o envio só começa depois dessa confirmação.

**Se não couber**, nenhum arquivo é transferido e a tela mostra o volume da seleção, o
espaço disponível, quanto falta, e **onde o seu espaço está**: em arquivos ativos, em
arquivos na lixeira e em envios ainda não concluídos. Você pode então **enviar só o
que cabe** — o sistema envia o subconjunto que couber no espaço disponível e informa
com clareza quantos arquivos ficaram de fora.

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
