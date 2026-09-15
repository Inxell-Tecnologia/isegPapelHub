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
