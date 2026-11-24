# Spec Delta

## MODIFIED Requirements

### Requirement: Tela inicial reserva a coluna de leitura obrigatória e avisos

A tela inicial SHALL apresentar, à direita do conteúdo principal, uma coluna de
cerca de 340 px com os cartões **"Leitura obrigatória"** e **"Avisos"**. O
cartão "Leitura obrigatória" SHALL listar as leituras obrigatórias **abertas**
da pessoa — pendentes e atrasadas, a atrasada sinalizada —, cada uma com o
documento, o prazo e o botão **"Ler e confirmar ciência"**, que SHALL abrir o
documento no visualizador; SHALL oferecer o acesso à lista completa; e, sem
leitura aberta, SHALL dizer que não há leitura pendente. Leitura aberta cujo
documento a pessoa não alcança mais NÃO SHALL oferecer o botão. O cartão
"Avisos" SHALL listar os avisos de leitura obrigatória da pessoa — nova
pendência, atraso e atraso da equipe —, os mais recentes primeiro, com a data;
sem nenhum, SHALL dizer que não há aviso de leitura obrigatória e que os demais
avisos estão no sino. Quando a largura não
comportar as duas colunas, a coluna SHALL passar para depois do conteúdo
principal, ocupando a largura disponível, sem rolagem horizontal. Referência:
PRD US 12.4 e 12.5; demanda do cliente nº 2, seções 1.3 (coluna direita), 3.2 (etapa
2, item 3) e 3.5 (Início).

#### Scenario: Coluna lateral na forma larga
- **WHEN** uma pessoa abre a tela inicial numa largura que comporta as duas
  colunas
- **THEN** vê os cartões "Leitura obrigatória" e "Avisos" numa coluna à direita
  do conteúdo principal

#### Scenario: Coluna desce na forma estreita
- **WHEN** uma pessoa abre a tela inicial numa largura que não comporta as duas
  colunas
- **THEN** os cartões aparecem depois do conteúdo principal, sem rolagem
  horizontal da página

#### Scenario: Cartão lista as pendências com prazo
- **WHEN** uma pessoa com leituras obrigatórias abertas abre a tela inicial
- **THEN** o cartão "Leitura obrigatória" mostra cada documento com o prazo e o
  botão "Ler e confirmar ciência", e a atrasada aparece sinalizada

#### Scenario: Botão abre o documento no visualizador
- **WHEN** a pessoa aciona "Ler e confirmar ciência" no cartão
- **THEN** o documento abre no visualizador, onde ela confirma a ciência

#### Scenario: Sem pendências, o cartão diz que não há
- **WHEN** uma pessoa sem leitura obrigatória aberta abre a tela inicial
- **THEN** o cartão "Leitura obrigatória" informa que não há leitura pendente

#### Scenario: Cartão diz o que vai apresentar
- **WHEN** uma pessoa sem aviso de leitura obrigatória lê o cartão "Avisos"
- **THEN** lê que não há aviso de leitura obrigatória e que os demais avisos
  estão no sino

#### Scenario: Cartão de avisos lista os avisos de leitura
- **WHEN** uma pessoa recebeu aviso de nova leitura e aviso de atraso
- **THEN** o cartão "Avisos" mostra os dois, o mais recente primeiro, com a
  data
