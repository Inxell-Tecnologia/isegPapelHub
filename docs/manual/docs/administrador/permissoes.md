# Conceder e revogar permissões

As permissões são geridas **por recurso** (pasta ou arquivo), na própria página
**Arquivos**. Na linha do item, clique em **Permissões**:

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

Um colaborador não concede permissão sobre o próprio arquivo — essa ação é exclusiva
da administração. Ver [Compartilhar um arquivo que você enviou](../colaborador/enviar.md#compartilhar-um-arquivo-que-voce-enviou).
