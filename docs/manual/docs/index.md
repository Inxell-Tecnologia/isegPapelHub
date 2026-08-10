# Manual do Usuário — PapelHub

Bem-vindo(a) ao **PapelHub**, o repositório documental corporativo da organização. Este
manual explica, em linguagem simples, como usar o sistema no dia a dia. É um guia
**funcional**: fala do que você vê e faz na tela, não de como o sistema é construído
por dentro.

!!! note "Endereço desta implantação"
    O endereço abaixo é o desta implantação específica do PapelHub — não o endereço
    único do produto. Cada organização pode ter o seu próprio.

    **https://gdoc-prod-api-hmwigy67mq-uc.a.run.app/**

Use um navegador atualizado (Chrome, Edge, Firefox ou Safari). Não é preciso instalar
nada.

## O que é o PapelHub

O PapelHub é um repositório de arquivos na nuvem com **controle rigoroso de acesso**. A
ideia central é simples: cada pessoa vê, baixa, envia, altera ou exclui **apenas
aquilo que criou ou que lhe foi liberado** — nada além disso. Tudo que acontece com
os arquivos importantes (visualizações e downloads) fica registrado, e cada unidade
da organização enxerga somente o seu próprio conteúdo.

Principais recursos:

- Navegador de arquivos com **pastas e subpastas** e trilha de navegação.
- **Envio** de vários arquivos de uma vez ou de uma pasta inteira, preservando a
  estrutura de subpastas.
- **Visualização** de arquivos sem precisar baixá-los.
- **Permissões granulares** por pasta ou por arquivo (visualizar, baixar, enviar,
  renomear, excluir).
- **Lixeira** com retenção temporária para recuperar o que foi excluído.
- **Auditoria** de quem acessou cada arquivo.
- **Painel** gerencial de uso (para administradores).
- **Cota de armazenamento** por pessoa.

Valores de cota, retenção e demais tetos operacionais são padrões desta implantação
— ver [Limites](referencia/limites.md).

## Perfis de usuário

O que você pode fazer no PapelHub depende do seu **perfil**, definido pela administração
quando sua conta é criada. Existem três:

| Perfil                       | O que enxerga                                                                                 | O que pode fazer                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Colaborador**              | Apenas os arquivos e pastas que criou ou que lhe foram liberados.                             | Enviar, visualizar, baixar, renomear e excluir conforme sua permissão; ver a auditoria dos arquivos que enviou; trocar a própria senha.                                                     |
| **Administrador da unidade** | Tudo da **sua unidade** (pessoas, pastas, arquivos, permissões). Não enxerga outras unidades. | Tudo o que o colaborador faz, mais: cadastrar, editar, ativar/desativar pessoas da unidade e redefinir a senha delas; conceder e revogar permissões; ver o painel e a auditoria da unidade. |
| **Administrador global**     | **Todas as unidades**.                                                                        | Tudo o que o administrador de unidade faz, em escala global; além disso, cria e administra as **unidades** e define administradores de unidade.                                             |

!!! note "Alcance, não exceção"
    Os perfis definem o **alcance** (o que você enxerga). Mesmo sendo
    administrador, você respeita o isolamento entre unidades — conteúdo de uma
    unidade nunca aparece para outra.

## Por onde continuar

- Primeiro acesso à aplicação: [Primeiro acesso](primeiro-acesso.md)
- Conhecendo a tela (menu, notificações, perfil): [A tela](a-tela.md)
- Guia do colaborador: comece por [Navegar e criar pastas](colaborador/navegar-e-criar.md)
- Guia da administração: comece por [Pessoas](administrador/pessoas.md)
- Resumo de tarefas e perguntas frequentes: [Tarefas rápidas](referencia/tarefas-rapidas.md), [FAQ](referencia/faq.md)

---

_Este manual cobre o uso funcional do PapelHub. Para dúvidas sobre políticas de acesso da
sua organização, procure a área administrativa da sua unidade._
