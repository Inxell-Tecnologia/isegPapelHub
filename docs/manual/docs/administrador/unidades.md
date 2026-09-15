# Unidades (administrador global)

O administrador global faz tudo que o administrador de unidade faz, porém com
alcance sobre **todas as unidades**.

## Administrar unidades

O menu **Unidades** é exclusivo do administrador global. Nele você:

- **Nova unidade** — informe o nome e confirme.
- **Renomear** — altera o nome de uma unidade existente.
- **Desativar** — só é possível desativar uma unidade **sem colaboradores vinculados**; a
  ação é **reversível** pelo botão **Ativar**.

Uma unidade desativada **não aceita novos cadastros de colaboradores** — ao tentar, o
seletor de unidade sinaliza que ela está desativada e pede outra escolha.

## Colaboradores em qualquer unidade

Ao cadastrar um colaborador, você escolhe a **unidade** de lotação (apenas unidades
ativas aparecem na lista). Esse campo só existe no **cadastro** — a unidade não é
alterada pela edição. A lista de [Colaboradores](pessoas.md) ganha uma coluna **Unidade**,
para você distinguir contas de unidades diferentes.

Você também define quem é **administrador de unidade** e acompanha o
[painel](painel.md) e a [auditoria](auditoria.md) no âmbito global.

!!! note "Isolamento preservado mesmo com alcance global"
    Mesmo com alcance global, o **isolamento entre unidades é preservado**: o
    conteúdo (arquivos, listagens, auditoria de bytes) de uma unidade continua
    pertencendo a ela. A visão global serve para governança e acompanhamento
    agregado, não para expor o conteúdo de uma unidade a outra.
