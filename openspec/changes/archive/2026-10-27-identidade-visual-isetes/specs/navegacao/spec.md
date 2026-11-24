# Spec Delta

## ADDED Requirements

### Requirement: Resposta de conteúdo informa o veredito de envio da pasta corrente

A rota de navegação SHALL informar, junto do conteúdo da pasta, se o
solicitante pode **enviar** nela, resolvendo o veredito pela mesma regra de
acesso que governa a rota de envio. O valor SHALL estar sempre presente na
resposta, e NÃO SHALL substituir a autorização da rota de envio.

#### Scenario: Dono da pasta recebe veredito favorável
- **WHEN** a pessoa que criou a pasta solicita o conteúdo dela
- **THEN** a resposta informa que ela pode enviar nessa pasta

#### Scenario: Concessão de envio sobre pasta de outra pessoa é refletida
- **WHEN** uma pessoa com concessão vigente do verbo de envio sobre pasta de
  outra pessoa solicita o conteúdo dessa pasta
- **THEN** a resposta informa que ela pode enviar, embora não seja dona nem
  administradora da unidade

#### Scenario: Quem só pode visualizar recebe veredito desfavorável
- **WHEN** uma pessoa com concessão apenas de visualização sobre pasta de
  outra pessoa solicita o conteúdo dessa pasta
- **THEN** a resposta apresenta o conteúdo e informa que ela **não** pode
  enviar nessa pasta

#### Scenario: O veredito não dispensa a autorização da rota de envio
- **WHEN** um pedido de envio chega a uma pasta sobre a qual o solicitante não
  tem o verbo de envio
- **THEN** a rota de envio recusa por conta própria, independentemente do
  veredito que a rota de navegação tenha informado antes

#### Scenario: Raiz da unidade sempre admite envio
- **WHEN** qualquer pessoa autenticada solicita o conteúdo da raiz da própria
  unidade
- **THEN** a resposta informa que ela pode enviar, por a raiz não ser recurso
  concedível
