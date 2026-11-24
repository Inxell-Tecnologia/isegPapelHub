# Unidades (administrador global)

O administrador global faz tudo que o administrador da unidade faz, porém com alcance sobre
**todas as unidades**.

## Administrar unidades

O menu **Unidades** é exclusivo do administrador global. Nele você:

- **Nova unidade** — informe o nome e confirme.
- **Renomear** — altera o nome de uma unidade existente.
- **Desativar** — só é possível desativar uma unidade **sem colaboradores vinculados**; a
  ação é **reversível** pelo botão **Ativar**.

- **Marcar como SEDE** — indica qual unidade é a **SEDE**. Só pode haver uma: enquanto
  houver uma SEDE marcada, o botão fica indisponível nas demais unidades, e é preciso
  **Desmarcar SEDE** antes de marcar outra. A SEDE marcada não pode ser desativada.

Uma unidade desativada **não aceita novos cadastros de colaboradores** — ao tentar, o
seletor de unidade sinaliza que ela está desativada e pede outra escolha.

## Colaboradores em qualquer unidade

Ao cadastrar um colaborador, você escolhe a **unidade** de lotação (apenas unidades
ativas aparecem na lista). Esse campo só existe no **cadastro** — a unidade não é
alterada pela edição. A lista de [Colaboradores](pessoas.md) ganha uma coluna **Unidade**,
para você distinguir contas de unidades diferentes.

Você também define quem é **administrador da unidade** e acompanha o
[painel](painel.md) e a [auditoria](auditoria.md) no âmbito global.

## A SEDE e o compartilhamento entre unidades

A marcação de SEDE é o que habilita o
[compartilhamento entre unidades](permissoes.md#compartilhar-com-outra-unidade): a SEDE
pode compartilhar pastas e documentos com as demais unidades, e cada unidade pode
compartilhar com a SEDE — sempre **somente para visualizar e baixar**.

!!! warning "Desmarcar a SEDE suspende os compartilhamentos"
    Os compartilhamentos entre unidades dependem da SEDE. Se você desmarcá-la, todos
    eles **deixam de valer** imediatamente. Nada é apagado: ao marcar a SEDE de novo,
    os compartilhamentos que envolvem a unidade marcada voltam a valer.

!!! note "Isolamento preservado mesmo com alcance global"
    Mesmo com alcance global, o **isolamento entre unidades é preservado**: o
    conteúdo (arquivos, listagens, auditoria de bytes) de uma unidade continua
    pertencendo a ela. A visão global serve para governança e acompanhamento
    agregado, não para expor o conteúdo de uma unidade a outra. A única exceção é o
    que for **compartilhado explicitamente** entre a SEDE e outra unidade.
