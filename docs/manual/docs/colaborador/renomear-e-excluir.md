# Mover, renomear e excluir

## Renomear arquivos e pastas

Se você tem permissão, use **Renomear** na linha do item para mudar o **nome** —
vale para **arquivos e pastas**. Sem permissão, a ação é bloqueada com aviso.

Renomear pasta muda só o nome exibido: o conteúdo e a localização de tudo o que está
dentro dela permanecem os mesmos.

## Mover arquivos e pastas

Use **Mover para...** na linha do item para reorganizar o que já foi enviado, sem
precisar excluir e reenviar. Ao clicar, um seletor mostra as pastas da unidade e
permite navegar nível a nível até o destino desejado — inclusive a **raiz da
unidade**, sempre disponível como opção. Confirme para concluir; o item deixa de
aparecer na listagem de origem.

Mover preserva o conteúdo, o dono, as permissões já concedidas sobre o item e o
histórico de auditoria de arquivo — nada disso é afetado pela mudança de local. Mover
uma pasta leva junto toda a sua subárvore, inclusive arquivos de outros colaboradores que
estejam dentro dela.

!!! warning "Mover para uma pasta compartilhada não compartilha o item"
    Quem já tinha acesso a um arquivo ou pasta continua tendo, exatamente como
    antes. Mas mover um item para dentro de uma pasta que você compartilha com a
    equipe **não estende** esse compartilhamento ao item movido — as permissões são
    sempre por item, nunca herdadas da pasta que o contém. Se quiser que outra
    colaborador acesse o item movido, peça a um administrador para conceder permissão
    sobre ele diretamente (ver [Permissões](../administrador/permissoes.md)).

Mover (arquivo ou pasta) e renomear pasta usam o mesmo alcance: **dono do item OU
administrador da sua unidade**, exigido também sobre o **destino** — ainda que
você tenha alguma concessão sobre o item ou sobre a pasta de destino, isso não
habilita mover nem renomear pasta nesta versão. Você pode encontrar duas recusas
específicas ao mover ou renomear pasta, além da falta de permissão:

- **Destino inválido** — ao tentar mover uma pasta para dentro dela mesma ou de uma
  subpasta sua, em qualquer profundidade.
- **Nome já existente no destino** — ao mover ou renomear uma pasta para um nome que
  já é usado por outra pasta viva no mesmo local. O sistema recusa em vez de
  substituir ou combinar o conteúdo das duas.

## Selecionar vários itens e mover em lote

Além de mover um item por vez, você pode marcar **vários arquivos e pastas** ao
mesmo tempo (uma caixa de seleção aparece em cada linha da listagem) e movê-los
juntos para o mesmo destino, numa única confirmação — útil para reorganizar uma
pasta cheia sem repetir a ação item a item. Assim que algo é marcado, uma barra
aparece acima da listagem mostrando quantos itens estão selecionados e o botão
**Mover selecionados**, que abre o mesmo seletor de destino usado para mover um
único item.

A seleção vale só para a pasta em que você está: **entrar em uma subpasta, voltar
pela trilha de navegação ou trocar de tela esvazia a seleção**. Não é possível
acumular itens de pastas diferentes num mesmo lote.

Ao confirmar, você recebe um único aviso, mesmo que a seleção misture arquivos e
pastas:

- **Sucesso total** — todos os itens passam a residir no destino.
- **Falha parcial** — o aviso informa quantos itens foram movidos e lista, um a
  um, cada item que não pôde ser movido e o motivo (sem permissão, destino dentro
  da própria pasta, ou nome já existente no destino). Os demais itens da seleção
  são movidos normalmente.
- **Destino sem alcance** — se você não tem permissão sobre o destino escolhido,
  nenhum item da seleção é movido, e o aviso é o mesmo de falta de permissão.

Se a seleção passar do teto de itens por operação (ver
[Limites](../referencia/limites.md)), a ação é recusada **antes** de qualquer
envio, com um aviso próprio, distinto da recusa por permissão.

## Excluir arquivos

Use **Excluir** na linha do arquivo. O item vai para a **Lixeira** (ver abaixo).

## Excluir pastas

Existem **dois** botões de exclusão de pasta, com o mesmo alcance da distinção feita
para download (ver [Visualizar e baixar](visualizar-e-baixar.md)):

- **Excluir esta pasta**, na barra superior — exclui a pasta **atual** que você está
  navegando. Não aparece na raiz da unidade, que não pode ser excluída.
- **Excluir**, na linha de cada subpasta na listagem — exclui aquela subpasta
  específica.

Em ambos os casos, a pasta e todo o seu conteúdo vão para a **Lixeira**.

## A lixeira

Ao excluir um arquivo ou pasta, ele **não some na hora**: vai para a **Lixeira**,
onde fica por um período de retenção (ver [Limites](../referencia/limites.md) para o
valor vigente). Nesse período você pode **restaurar** o item, que volta ao local de
origem com as permissões que tinha. Depois disso, uma rotina automática o apaga em
definitivo (não é mais possível recuperar).

Acesse pelo menu **Lixeira** para restaurar ou acompanhar seus itens excluídos. A
lista mostra a **data de exclusão** e quantos **dias restantes** faltam até o expurgo,
com destaque colorido quando o prazo está perto do fim.

### Esvaziar a lixeira para liberar espaço agora

Enquanto um arquivo está na lixeira, ele **continua ocupando a sua cota** (ver
[Enviar arquivos](enviar.md)). Se você precisa de espaço **hoje**, sem esperar o
expurgo automático, use **Esvaziar lixeira**, no alto da tela da Lixeira.

A confirmação diz, antes de qualquer coisa, **quantos arquivos** serão apagados e
**quanto espaço** retorna — é a troca que você está aceitando. Ao confirmar:

- os **seus arquivos** na lixeira são apagados **em definitivo**, e o espaço volta na
  hora para a sua cota;
- **não há como desfazer**: eles deixam de ser restauráveis;
- **pastas não são apagadas** — pasta não ocupa espaço, então continua na lixeira até
  o expurgo automático (inclusive quando os arquivos que estavam dentro dela foram
  apagados);
- **arquivos de outras pessoas não são afetados**, mesmo que apareçam na sua lista da
  Lixeira porque você tem permissão de exclusão sobre eles. Cada pessoa esvazia a
  própria lixeira — inclusive administradores, que não esvaziam a lixeira de
  terceiros.

Se algum arquivo não puder ser apagado no momento, os demais são apagados normalmente
e a tela informa quantos ficaram — eles permanecem na lixeira e entram no próximo
expurgo automático.

O botão só aparece quando você tem arquivos próprios na lixeira.
