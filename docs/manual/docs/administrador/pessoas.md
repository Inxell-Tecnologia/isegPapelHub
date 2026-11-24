# Colaboradores

Além de tudo que o colaborador faz, o administrador da unidade gerencia **sua própria unidade**. Seu alcance é **restrito à unidade** — você não enxerga nem gerencia
conteúdo de outras.

## Cadastrar e editar colaboradores

Abra **Colaboradores** no menu e clique em **Novo colaborador**. Informe:

- **Nome**
- **E-mail** (único; será o login)
- **Senha inicial** (mínimo de 8 caracteres)
- **Telefone**
- **Função/cargo** — o cargo da pessoa, como "Gerente de Governança". É o que
  aparece para ela abaixo da saudação na tela inicial e no seu cartão, no pé do
  menu. Preencher este campo não altera permissão nenhuma.
- **Setor** — escolhido de uma **lista** dos setores da unidade, não digitado.
  Pode ficar **sem setor**. Veja [Setores da unidade](#setores-da-unidade).
- **Observação**
- **Papel** (Colaborador ou Administrador da unidade)
- **Acompanhamento de leituras** — se a pessoa é **gestora** e de quê (ver
  [Gestores de acompanhamento](#gestores-de-acompanhamento))

Confirme em **Cadastrar**. O colaborador passa a poder entrar com essas credenciais.

- Se o **e-mail já estiver em uso**, o cadastro é recusado e o campo é sinalizado —
  ajuste o e-mail sem perder o resto do preenchimento.
- Para **editar** um colaborador, clique em **Editar** na linha dele. Nome,
  **e-mail**, telefone, função, setor, observação e papel podem ser alterados. Para
  deixar a pessoa **sem setor**, limpe a escolha no campo Setor.

### Corrigir o e-mail de um colaborador

O e-mail é o **login** da pessoa. Para corrigir um e-mail cadastrado errado, abra
**Editar** na linha dela, troque o e-mail e clique em **Salvar**.

- A pessoa passa a entrar **com o novo e-mail e a mesma senha** a partir desse
  momento; o e-mail antigo deixa de funcionar. Se ela já estiver com o sistema
  aberto, continua usando normalmente.
- **O sistema não avisa a pessoa** — o formulário mostra um lembrete enquanto o
  e-mail estiver alterado. Comunique a troca você mesmo.
- Se o novo e-mail **já pertencer a outra conta**, a alteração é recusada e o campo
  é sinalizado; nada do que você alterou no formulário é salvo até corrigir.
- O administrador da unidade troca o e-mail dos **colaboradores da sua unidade**;
  o administrador global troca o de **qualquer pessoa**, inclusive o próprio — as
  mesmas regras de "Quem pode editar quem", mais abaixo.

## Encontrar um colaborador

Acima da lista de **Colaboradores** há um campo de busca. Digite parte do
**nome**, do **e-mail**, da **função/cargo** ou do **setor** e a lista mostra só
quem corresponde — a partir de qualquer trecho, não só do começo. Maiúsculas e
acentos não importam: "joao" encontra "João". O administrador global também
pode buscar pelo **nome da unidade**.

- Se ninguém corresponder, a lista mostra **Nenhum colaborador encontrado**.
- Para voltar a ver todos, apague o texto ou clique no **×** do campo.
- A busca só filtra a lista que você já vê: não mostra ninguém fora do seu
  alcance.

## Gestores de acompanhamento

**Gestor** é quem acompanha se a equipe leu os documentos de leitura
obrigatória — coordenador, gerente, diretor. Não é papel de acesso: a pessoa
continua **Colaborador** (ou Administrador da unidade), e marcar alguém como
gestor **não** permite cadastrar pessoas, liberar permissões nem abrir arquivo
nenhum.

No campo **Acompanhamento de leituras** do cadastro, escolha:

| Opção                           | Acompanha                                    | Quem pode marcar          |
| ------------------------------- | -------------------------------------------- | ------------------------- |
| **Não acompanha**               | —                                            | —                         |
| **Gestor do setor**             | As pessoas do **setor** da pessoa            | Administração da unidade  |
| **Gestor da unidade**           | Todas as pessoas da **unidade**              | Administração da unidade  |
| **Gestor de todas as unidades** | Todas as unidades (Governança da Sede)       | Só o administrador global |

- **Gestor do setor precisa de setor.** Se a pessoa não tiver setor, o sistema
  recusa e pede que você escolha o setor. E, enquanto ela for gestora do setor,
  não é possível deixá-la sem setor — troque antes o acompanhamento.
- O sistema **não** deduz o gestor pelo cargo: "Coordenadora" escrito na
  Função/cargo não faz ninguém gestor. É a marcação que vale.
- Ninguém marca a si mesmo.
- Quem tem **Gestor de todas as unidades** só pode ter o acompanhamento
  alterado pelo administrador global; para o administrador da unidade, o campo
  aparece travado.
- A coluna **Acompanhamento** da lista mostra quem é gestor e de quê. O sistema
  registra quem fez cada marcação e quando.

!!! note "O que o gestor recebe"
    A marcação define quem recebe, no sino, o **aviso de atraso da equipe** da
    leitura obrigatória — com os nomes de quem está atrasado no seu alcance (ver
    [Leitura obrigatória](../colaborador/leitura-obrigatoria.md#avisos)), e
    quem vê, na aba **Acompanhamento**, quem leu cada documento (ver
    [Acompanhar quem leu](../colaborador/leitura-obrigatoria.md#acompanhar-quem-leu-publicador-gestor-e-governanca)).

## Setores da unidade

O setor é uma **lista fechada, por unidade** — e não um texto que cada pessoa
digita do seu jeito. A razão é prática: a mesma área escrita como "Governança",
"governanca" e "Gov." seria tratada como três setores diferentes, e quem
estivesse escrito de um jeito ficaria de fora de uma consulta feita pelo outro.

Para manter a lista, abra **Colaboradores** e clique em **Setores**. No painel
que abre você pode:

- **Adicionar** um setor;
- **Renomear** um setor — útil para padronizar a escrita. Renomear **não**
  desfaz nenhum vínculo: quem estava no setor continua nele, com o nome novo;
- **Remover** um setor **sem colaboradores**. Se ainda houver gente vinculada, a
  remoção é recusada e o sistema informa quantas pessoas são — mova-as antes.

O nome do setor é único dentro da unidade, sem diferenciar maiúsculas de
minúsculas. Duas unidades podem ter setores de mesmo nome, independentes entre
si.

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

    Um administrador global edita outro administrador global — inclusive o
    e-mail, o papel, o status e a cota —, mas **não redefine a senha dele**. A senha de um
    administrador global só muda por ele mesmo, em **Minha conta**. É por isso
    que as duas tabelas desta página são diferentes.

**Quem pode redefinir a senha de quem:**

| Quem redefine            | Pode redefinir de                                                             |
| ------------------------- | ------------------------------------------------------------------------------ |
| Administrador da unidade | Colaboradores da própria unidade                                              |
| Administrador global     | Colaboradores e administradores da unidade                                    |
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

    A cota é a única coisa na tela de colaboradores que o administrador da unidade não edita. Para ele, o campo nem aparece.

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
