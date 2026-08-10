# Limites

Os valores abaixo são os vigentes **nesta implantação** do PapelHub. Todos são
**padrões de variável de ambiente**, ajustáveis por quem administra a infraestrutura
— não são constantes fixas do produto, e podem ser diferentes em outra implantação.

| Limite                                    | Valor vigente | Ajustável por                          |
| ------------------------------------------ | -------------- | ---------------------------------------- |
| Cota de armazenamento por pessoa           | 10 GB          | `STORAGE_QUOTA_BYTES_PER_USER`          |
| Retenção da lixeira antes do expurgo       | 30 dias        | `TRASH_RETENTION_DAYS`                   |
| Antecedência do aviso de expiração de acesso | 7 dias       | `GRANT_EXPIRING_NOTICE_WINDOW_DAYS`      |
| Tamanho máximo do download compactado de pasta | 50 MB      | `DOWNLOAD_MANIFEST_MAX_BYTES`            |
| Quantidade máxima de arquivos no download compactado de pasta | 100 arquivos | `DOWNLOAD_MANIFEST_MAX_FILES` |

Se um desses valores parecer diferente do que você observa na tela, prevalece o que a
aplicação mostra — esta página descreve os padrões, não uma garantia contratual.
