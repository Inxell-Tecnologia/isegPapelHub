## MODIFIED Requirements

### Requirement: Concessão com prazo avisa a pessoa no ato da concessão

O sistema SHALL avisar **cada colaborador destinatário** no momento em que ele
recebe uma concessão com prazo de expiração, sem esperar por nenhuma rotina
agendada. O aviso SHALL identificar o recurso, os verbos concedidos e a data de
vencimento. Concessão **sem** prazo NÃO SHALL gerar este aviso.

Numa concessão que atinge **vários colaboradores** numa só operação, o sistema
SHALL emitir **um aviso por destinatário** — cada colaborador recebe o seu, e
nenhum recebe aviso a respeito da concessão de outro. A idempotência por evento de
origem SHALL continuar valendo **por destinatário**: repetir a mesma concessão,
sobre o mesmo recurso e com o mesmo vencimento, NÃO SHALL gerar aviso duplicado
para um colaborador que já foi avisado, ainda que a operação inclua outros
colaboradores novos — que, esses sim, SHALL ser avisados.

A emissão SHALL ocorrer **após** a concessão estar efetivada, e a sua falha NÃO
SHALL, em nenhuma hipótese, impedir a concessão, revertê-la ou fazer a operação
retornar erro a quem concedeu — a concessão é o ato autoritativo e a notificação é
efeito colateral. A falha de emissão para **um** destinatário NÃO SHALL impedir a
emissão para os demais. Uma falha de emissão SHALL ser registrada. Referência:
design.md D8 do change `expiracao-permissoes`.

#### Scenario: Pessoa é avisada ao receber concessão com prazo
- **WHEN** um administrador concede a um colaborador um ou mais verbos com prazo de
  expiração
- **THEN** o colaborador recebe, no ato, um aviso identificando o recurso, os
  verbos e a data de vencimento

#### Scenario: Cada destinatário de uma concessão múltipla recebe o seu aviso
- **WHEN** um administrador concede verbos com prazo a vários colaboradores numa
  única operação
- **THEN** cada colaborador recebe um aviso próprio identificando o recurso, os
  verbos e a data de vencimento, e nenhum recebe aviso sobre a concessão de outro

#### Scenario: Falha ao avisar um destinatário não impede os demais
- **WHEN** a emissão do aviso falha para um dos colaboradores de uma concessão
  múltipla
- **THEN** os demais colaboradores recebem seus avisos normalmente, a concessão
  permanece efetivada para todos e a falha é registrada

#### Scenario: Repetir a concessão não duplica o aviso de quem já foi avisado
- **WHEN** um administrador repete a concessão sobre o mesmo recurso, com o mesmo
  vencimento, incluindo um colaborador já avisado e outro ainda não avisado
- **THEN** o colaborador já avisado não recebe aviso duplicado e o colaborador
  novo recebe o seu

#### Scenario: Concessão permanente não gera aviso de concessão
- **WHEN** um administrador concede um verbo sem prazo de expiração
- **THEN** nenhum aviso de concessão é emitido

#### Scenario: Falha ao avisar não impede a concessão
- **WHEN** a emissão do aviso falha durante a concessão
- **THEN** a concessão permanece efetivada, a operação retorna sucesso a quem
  concedeu, e a falha é registrada
