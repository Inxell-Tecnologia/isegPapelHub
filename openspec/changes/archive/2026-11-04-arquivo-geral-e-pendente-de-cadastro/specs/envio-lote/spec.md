# envio-lote — delta

## MODIFIED Requirements

### Requirement: Emissão de URLs de envio em lote

O sistema SHALL aceitar, em `POST /files/upload-urls`, uma lista de itens a enviar,
cada item podendo trazer os **seus próprios** dados de controle, e SHALL responder
com um resultado **por item**, na mesma ordem, contendo ou uma URL
assinada de PUT (com o caminho do objeto, o prazo de expiração e a indicação de que
o item nasce publicado ou pendente de cadastro) em caso de sucesso,
ou um erro descritivo em caso de recusa. A falha de um item NÃO SHALL impedir a
emissão de URL para os demais itens válidos do mesmo lote. Cada item bem-sucedido
SHALL ter uma linha de arquivo `pending` inserida, seguindo o mesmo ciclo do envio
individual (PUT direto no storage → reconciliação em `POST /internal/storage-events`).
Referência: PRD US 3.1 e US 10.5.

#### Scenario: Lote totalmente válido
- **WHEN** uma pessoa solicita o envio de vários arquivos válidos em uma requisição
- **THEN** recebe, para cada arquivo, uma URL assinada própria e independente, e cada
  arquivo pode ser enviado e concluído separadamente dos demais

#### Scenario: Falha parcial não derruba o lote
- **WHEN** um dos itens do lote é recusado (por exemplo, por estourar a cota) e os
  demais são válidos
- **THEN** os itens válidos recebem suas URLs e podem concluir normalmente, enquanto o
  item recusado é sinalizado com seu erro, sem afetar os que concluíram

#### Scenario: Nova tentativa apenas do item que falhou
- **WHEN** um item foi recusado ou falhou no envio e a pessoa reenvia somente aquele
  arquivo em uma nova requisição
- **THEN** o item é processado isoladamente, sem exigir o reenvio dos itens que já
  haviam concluído

#### Scenario: Dados de controle são lidos por item
- **WHEN** um lote é enviado com dados de controle informados para alguns itens e
  ausentes em outros
- **THEN** cada item é tratado pelos dados que lhe pertencem, sem que os dados de um
  item sejam aplicados a outro

#### Scenario: A resposta diz, por item, se ele nasce pendente de cadastro
- **WHEN** um lote mistura itens com dados de controle completos e itens sem eles
- **THEN** o resultado de cada item informa a sua condição, de modo que quem enviou
  saiba quais arquivos ficaram pendentes de cadastro sem precisar consultá-los um a um

#### Scenario: Dado de controle inválido recusa só o seu item
- **WHEN** um item do lote informa dado de controle inválido e os demais itens são
  válidos
- **THEN** apenas aquele item é recusado, com a indicação do problema, e os demais
  recebem suas URLs normalmente
