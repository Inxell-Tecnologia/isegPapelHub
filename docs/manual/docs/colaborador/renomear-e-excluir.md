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
uma pasta leva junto toda a sua subárvore, inclusive arquivos de outras pessoas que
estejam dentro dela.

!!! warning "Mover para uma pasta compartilhada não compartilha o item"
    Quem já tinha acesso a um arquivo ou pasta continua tendo, exatamente como
    antes. Mas mover um item para dentro de uma pasta que você compartilha com a
    equipe **não estende** esse compartilhamento ao item movido — as permissões são
    sempre por item, nunca herdadas da pasta que o contém. Se quiser que outra
    pessoa acesse o item movido, peça a um administrador para conceder permissão
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
