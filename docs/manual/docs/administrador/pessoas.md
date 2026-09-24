# Colaboradores

Além de tudo que o colaborador faz, o administrador de unidade gerencia **sua própria
unidade**. Seu alcance é **restrito à unidade** — você não enxerga nem gerencia
conteúdo de outras.

## Cadastrar e editar colaboradores

Abra **Colaboradores** no menu e clique em **Novo colaborador**. Informe:

- **Nome**
- **E-mail** (único; será o login)
- **Senha inicial** (mínimo de 8 caracteres)
- **Telefone**
- **Função/cargo**
- **Área de trabalho**
- **Observação**
- **Papel** (Colaborador ou Administrador da unidade)

Confirme em **Cadastrar**. O colaborador passa a poder entrar com essas credenciais.

- Se o **e-mail já estiver em uso**, o cadastro é recusado e o campo é sinalizado —
  ajuste o e-mail sem perder o resto do preenchimento.
- Para **editar** um colaborador, clique em **Editar** na linha dele. O **e-mail** não
  pode ser alterado na edição; os demais dados e o papel, sim.

A lista mostra nome, e-mail, função, papel e **status** (ativo ou desativado).

## Ativar e desativar colaboradores

Na linha do colaborador, use **Desativar** para cortar o acesso dele ao sistema. Os
**arquivos e a auditoria são preservados** — apenas o login deixa de funcionar. Use
**Ativar** para devolver o acesso.

!!! note
    Você não encontra a ação de desativar na **sua própria linha** — isso evita que um
    administrador corte o próprio acesso por engano.

## Redefinir a senha de um colaborador

Quando alguém esquece a senha, clique em **Redefinir senha** na linha do colaborador e
confirme. O sistema:

1. **Gera** uma nova senha (você não a escolhe);
2. exibe essa senha **uma única vez**, num aviso com botão para **copiar**;
3. **encerra imediatamente** todos os acessos abertos daquele colaborador, e a senha
   anterior deixa de funcionar.

Copie e repasse a senha com segurança antes de fechar o aviso — **ela não pode ser
consultada depois**. Se a senha se perder, é só redefinir de novo.

**Quem pode editar quem:**

| Quem edita               | Pode editar                                                      |
| ------------------------- | ------------------------------------------------------------------ |
| Administrador da unidade | Colaboradores da própria unidade                                 |
| Administrador global     | Todos, inclusive outros administradores globais e ele mesmo      |

Duas coisas ninguém faz, nem o administrador global: **mudar o próprio papel** e
**desativar a própria conta**. São as travas que impedem alguém de cortar o
próprio acesso — por isso a ação **Desativar** não aparece na sua própria linha.

!!! warning "Editar não é o mesmo que redefinir a senha"

    Um administrador global edita outro administrador global — inclusive o papel,
    o status e a cota —, mas **não redefine a senha dele**. A senha de um
    administrador global só muda por ele mesmo, em **Minha conta**. É por isso
    que as duas tabelas desta página são diferentes.

**Quem pode redefinir a senha de quem:**

| Quem redefine            | Pode redefinir de                                                             |
| ------------------------- | ------------------------------------------------------------------------------ |
| Administrador da unidade | Colaboradores da própria unidade                                              |
| Administrador global     | Colaboradores e administradores de unidade                                    |
| Ninguém                  | Administrador global — a senha dele só muda por ele mesmo, em **Minha conta** |

Quando a ação não é permitida para determinado colaborador, o botão **Redefinir senha**
simplesmente não aparece na linha dele.

Administradores globais cadastram colaboradores em qualquer unidade — ver
[Unidades](unidades.md).

## Cota de armazenamento de um colaborador

Todo colaborador começa com a **cota padrão** da plataforma — o valor da tabela de
[Limites](../referencia/limites.md). Quando alguém precisa de mais espaço, o
**administrador global** concede uma **cota individual** só para aquela pessoa, sem
alterar o limite de mais ninguém.

!!! info "Só o administrador global"

    A cota é a única coisa na tela de colaboradores que o administrador de unidade
    não edita. Para ele, o campo nem aparece.

No formulário de **Editar** de um colaborador, o campo **Cota de armazenamento**
funciona como uma chave de duas posições:

| Posição                | O que significa                                                        |
| ------------------------ | ------------------------------------------------------------------------ |
| **Padrão da plataforma** | A pessoa segue o limite geral. Se o limite geral mudar, ela acompanha. |
| **Cota individual**      | A pessoa tem um limite próprio, em GB, que você digita.               |

Logo abaixo do campo aparece **quanto a pessoa já usa hoje** — é a informação que
evita decidir no escuro. Para devolver alguém ao limite geral, basta voltar a chave
para **Padrão da plataforma**: você não precisa saber quanto é o padrão.

### Reduzir a cota de alguém

Você **pode** definir uma cota menor do que o espaço que a pessoa já ocupa, e a tela
avisa quando isso acontece. Nada é apagado: ela continua vendo e baixando tudo o que
tem. O que muda é que ela fica **impedida de enviar arquivos novos**, e só consegue
substituir uma versão quando a própria troca couber na cota.

Para voltar a caber, não basta excluir: o que está na lixeira **continua ocupando
cota** até o expurgo — ver [Mover, renomear e excluir](../colaborador/renomear-e-excluir.md).
Esvaziar a lixeira libera o espaço na hora.
