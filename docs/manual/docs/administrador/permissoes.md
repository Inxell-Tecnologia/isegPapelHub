# Conceder e revogar permissões

As permissões são geridas **por recurso** (pasta ou arquivo), na própria página
**Documentos**. Na linha do item, clique em **Permissões**:

1. Escolha **um ou mais colaboradores** — o campo aceita seleção múltipla, com busca
   por nome.
2. Marque os **verbos** desejados: **Visualizar, Baixar, Enviar, Renomear, Excluir**.
3. Opcionalmente, informe um **prazo de expiração**. Deixe em branco para uma
   concessão **permanente**, que vale até ser revogada manualmente.
4. Clique em **Conceder**.

Todos os colaboradores selecionados recebem todos os verbos marcados, numa única
operação: ou a concessão inteira é efetivada, ou nenhuma parte dela é. Se você
selecionar mais colaboradores do que o teto por requisição (ver
[Limites](../referencia/limites.md)), a tela recusa a operação e orienta a reduzir a
seleção — nenhuma concessão é feita nesse caso.

As concessões aparecem em **Concessões**, cada uma marcada como **vigente** (com a
data do vencimento, se houver) ou **expirada**. Você pode **Revogar** qualquer uma
individualmente, vigente ou expirada.

!!! warning "Expirar não é revogar"
    Quando o prazo é atingido, o acesso é encerrado automaticamente, mas a
    concessão **permanece registrada** na lista, marcada como expirada — isso
    preserva o histórico de quem teve acesso e até quando. Só **Revogar** remove a
    concessão da lista.

!!! note "Reconceder atualiza o prazo"
    Conceder de novo o mesmo verbo para o mesmo colaborador sobre o mesmo recurso
    substitui o prazo anterior pelo novo — estendendo ou encurtando o acesso.
    Reconceder **sem** informar prazo torna a concessão **permanente**, mesmo que
    ela tivesse um prazo antes. Ao selecionar colaboradores que já têm concessão
    sobre o recurso, a tela mostra o prazo atual de cada um antes de você confirmar.

!!! note "Avisos automáticos"
    Quando você concede um acesso **com prazo**, cada colaborador contemplado é
    avisado na hora, pela central de notificações — inclusive quando a concessão
    é para vários de uma vez. Com a antecedência configurada para o aviso prévio de
    expiração (ver [Limites](../referencia/limites.md)), ele recebe um novo aviso.
    Quando o prazo é atingido e o acesso é encerrado, a **administração da unidade**
    recebe um aviso identificando o colaborador, o recurso e o verbo cortado.

!!! warning "Sem herança automática"
    Conceder permissão sobre uma **pasta** libera **apenas aquela pasta** — não os
    arquivos e subpastas internos, que precisam de concessão própria. Isso é
    intencional, para evitar liberar mais do que o pretendido. A tela exibe um
    aviso lembrando disso ao conceder sobre pasta.

### Concessões automáticas (autoria)

Quando um colaborador cria uma subpasta ou envia um arquivo dentro da pasta de
**outra pessoa**, o item passa a pertencer ao **dono da pasta** (inclusive para a
cota), e quem o criou recebe automaticamente, sobre aquele item:

- **Visualizar**, **Baixar** e **Renomear**;
- **Enviar**, quando o item é uma pasta.

**Excluir** nunca é concedido automaticamente. Essas concessões são **permanentes**,
não geram aviso ao colaborador e aparecem em **Concessões** com o rótulo
**Automática (autoria)**. Elas funcionam como qualquer outra: você pode
**Revogar** cada uma individualmente, e o colaborador perde o acesso correspondente
na hora.

!!! note "Colaboradores de outra unidade"
    A lista de colaboradores mostra apenas pessoas **da mesma unidade** do item. Para
    liberar um item a alguém de outra unidade, use
    [Compartilhar com outra unidade](#compartilhar-com-outra-unidade). Se a tela
    recusar com a mensagem "Este colaborador é de outra unidade", é esse o caminho.

## Compartilhar com outra unidade

Algumas pastas e documentos precisam circular entre a **SEDE** e as demais unidades —
por exemplo, a pasta **Governança** da SEDE, que todas as unidades precisam consultar.
Para isso existe o compartilhamento entre unidades, no mesmo diálogo de **Permissões**:

1. Na linha da pasta ou do arquivo, clique em **Permissões**.
2. Expanda **Compartilhar com outra unidade**.
3. Escolha a **unidade de destino**. Se a sua unidade é a SEDE, aparecem as demais
   unidades; se não é, aparece apenas a SEDE.
4. Em **Para quem**, escolha **Unidade inteira** (vale para todos da unidade, inclusive
   quem for cadastrado depois) ou **Colaboradores selecionados** (escolha um ou mais
   colaboradores da unidade de destino).
5. Marque **Visualizar** e/ou **Baixar** e, se quiser, um **prazo de expiração**.
6. Clique em **Compartilhar**.

Quem recebe encontra o item em [Compartilhados comigo](../colaborador/compartilhados-comigo.md),
identificado com a unidade de origem.

Os compartilhamentos do item aparecem logo abaixo, com o destino, o verbo e o prazo, e
podem ser **revogados** a qualquer momento. Só a administração da unidade dona do item
vê e revoga esses compartilhamentos.

!!! warning "Compartilhar uma pasta compartilha todo o conteúdo dela"
    Diferente da concessão comum, o compartilhamento entre unidades de uma **pasta**
    vale para **tudo o que há dentro dela**, inclusive o que for guardado ali
    depois. Prefira compartilhar pastas dedicadas a esse fim, e não guarde nelas
    material que não deva sair da unidade.

!!! note "Somente leitura e sempre com a SEDE"
    - Entre unidades, só é possível **visualizar** e **baixar**: ninguém de outra
      unidade envia, renomeia, move ou exclui o que você compartilhou.
    - Toda concessão envolve a **SEDE**: a SEDE compartilha com as unidades, e cada
      unidade compartilha com a SEDE. Duas unidades que não são a SEDE não
      compartilham entre si.
    - Sem uma SEDE marcada, a seção explica que o recurso depende dessa marcação —
      peça ao administrador global (ver [Unidades](unidades.md)).
    - Documentos **obsoletos**, **pendentes de cadastro** ou na **lixeira** continuam
      fora do alcance de quem recebeu, mesmo dentro de uma pasta compartilhada.
    - O acesso de quem é de outra unidade é registrado na [auditoria](auditoria.md)
      do arquivo, aqui na sua unidade.

Um colaborador não concede permissão sobre o próprio arquivo — essa ação é exclusiva
da administração. Ver [Compartilhar um arquivo que você enviou](../colaborador/enviar.md#compartilhar-um-arquivo-que-voce-enviou).
