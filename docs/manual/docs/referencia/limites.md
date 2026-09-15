# Limites

Os valores abaixo são os vigentes **nesta implantação** do PapelHub. Todos são
**padrões de variável de ambiente**, ajustáveis por quem administra a infraestrutura
— não são constantes fixas do produto, e podem ser diferentes em outra implantação.

| Limite                                    | Valor vigente | Ajustável por                          |
| ------------------------------------------ | -------------- | ---------------------------------------- |
| Cota de armazenamento por colaborador      | 10 GB          | `STORAGE_QUOTA_BYTES_PER_USER`          |
| Retenção da lixeira antes do expurgo       | 30 dias        | `TRASH_RETENTION_DAYS`                   |
| Antecedência do aviso de expiração de acesso | 7 dias       | `GRANT_EXPIRING_NOTICE_WINDOW_DAYS`      |
| Tamanho máximo do download compactado de pasta | 50 MB      | `DOWNLOAD_MANIFEST_MAX_BYTES`            |
| Quantidade máxima de arquivos no download compactado de pasta | 100 arquivos | `DOWNLOAD_MANIFEST_MAX_FILES` |
| Quantidade máxima de colaboradores por concessão de permissão | 50 colaboradores | `GRANTS_MAX_SUBJECTS` |
| Quantidade máxima de itens por operação de mover em lote | 100 itens | `MOVE_BATCH_MAX_ITEMS` |
| Quantidade máxima de arquivos por requisição de envio | 500 arquivos | `UPLOAD_BATCH_MAX_ITEMS` |

A **quantidade máxima de arquivos por requisição de envio** é um detalhe interno e
**não é um limite que você encontre na tela**: um envio grande é dividido
automaticamente em partes menores que esse valor, de modo que o uso normal nunca o
alcança. O único limite de tamanho que o envio apresenta a você é a **cota de
armazenamento** — ver [Enviar arquivos](../colaborador/enviar.md).

O **espaço ocupado por arquivos na lixeira continua contando na sua cota** até o
expurgo automático, ao fim do prazo de retenção da tabela acima. Excluir arquivos,
portanto, não libera espaço de imediato.

Se um desses valores parecer diferente do que você observa na tela, prevalece o que a
aplicação mostra — esta página descreve os padrões, não uma garantia contratual.

## Recursos não disponíveis em celular e tablet

Estes recursos dependem de capacidades ausentes nesses aparelhos:

| Recurso                      | Motivo                                                               |
| ------------------------------ | ----------------------------------------------------------------------- |
| **Baixar pasta**              | O pacote compactado é montado no próprio aparelho antes de ser salvo, o que não é confiável em celular ou tablet. |
| **Enviar pasta**              | O seletor de pasta (`webkitdirectory`) não existe em Safari iOS nem em Chrome Android. |
| **Arrastar e soltar pastas e arquivos** | Arrastar e soltar não existe em aparelhos de toque. |

**Baixar pasta** e **Enviar pasta** são **botões**: eles continuam visíveis, nunca
somem da tela, e são recusados ao acionar, com orientação para usar um computador. A
**área de arrastar e soltar** não é um botão — não há acionamento a recusar, e por
isso ela simplesmente não aparece nesses aparelhos; os botões de envio continuam no
lugar.

Enviar e baixar **arquivos** avulsos não são afetados.
