# Spec Delta

## MODIFIED Requirements

### Requirement: Substituir arquivo por nova versão

O sistema SHALL permitir que o dono de um arquivo o substitua por uma nova versão em
`POST /files/:id/replace-url`, recebendo uma URL assinada de curta duração para enviar
o novo conteúdo. A nova versão SHALL ocupar o **mesmo local lógico** (mesma pasta e
mesmo nome) do arquivo vigente, e a versão anterior NÃO SHALL permanecer disponível
para consulta (sem histórico de versões — fora de escopo no PRD). A substituição SHALL
respeitar a cota do dono, considerando a diferença de tamanho entre a versão nova e a
antiga. Quem não é o dono NÃO SHALL conseguir substituir. Referência: PRD US 2.2.

Quando o arquivo substituído for um documento com revisão registrada, a
substituição SHALL avançar a revisão em uma unidade, preservando código, tipo,
responsável e data de próxima revisão. Documento sem revisão registrada SHALL
permanecer sem revisão — a substituição NÃO SHALL inaugurar numeração por conta
própria. O avanço da revisão NÃO SHALL tornar a versão anterior consultável.
Referência: PRD US 10.6.

#### Scenario: Substituição pelo dono preserva o local
- **WHEN** o dono envia uma nova versão para um arquivo sobre o qual tem permissão
- **THEN** o arquivo vigente é substituído no mesmo local, a versão anterior deixa de
  estar disponível, e o evento fica registrado na auditoria

#### Scenario: Substituição sem permissão é bloqueada
- **WHEN** uma pessoa que não tem permissão tenta substituir um arquivo
- **THEN** a ação é bloqueada com aviso de permissão insuficiente e o arquivo vigente
  permanece intacto

#### Scenario: Substituição respeita a cota pelo delta
- **WHEN** a nova versão faria o espaço utilizado do dono ultrapassar a cota,
  considerando a diferença para a versão anterior
- **THEN** a substituição é bloqueada com aviso de cota atingida e o arquivo vigente
  permanece intacto

#### Scenario: Substituição avança a revisão do documento
- **WHEN** o dono substitui um documento que está registrado na revisão 01
- **THEN** o documento passa a constar na revisão 02, mantendo código, tipo,
  responsável e data de próxima revisão

#### Scenario: Documento sem revisão registrada continua sem revisão
- **WHEN** o dono substitui um arquivo que não tem revisão registrada
- **THEN** a substituição ocorre normalmente e o arquivo permanece sem revisão

#### Scenario: Avanço de revisão não torna a versão anterior consultável
- **WHEN** um documento tem sua revisão avançada por substituição
- **THEN** a versão anterior permanece indisponível para consulta, como em
  qualquer substituição
