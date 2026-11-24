# Spec Delta

## ADDED Requirements

### Requirement: Navegação somente leitura em pasta compartilhada por outra unidade

O explorador SHALL exibir a pasta identificada com a unidade de origem
("Compartilhada pela unidade {nome}") quando a resposta de conteúdo de
pasta indicar `readOnly` e `sharedFrom`. A trilha SHALL começar na raiz
compartilhada (precedida de "Compartilhados comigo", nunca de
"Documentos"), e a SPA SHALL oferecer somente visualizar e, quando o
servidor indicar `canDownload`, baixar. Não SHALL oferecer enviar, nova pasta, renomear, mover,
excluir, permissões nem favorito. O orientador de pasta vazia SHALL
informar que não há documentos compartilhados, sem sugerir envio. A SPA NÃO
SHALL inferir esses vereditos no cliente: eles vêm da resposta do servidor.
Referência: PRD US 5.2, cenários 1 e 2; design.md D6.

#### Scenario: Raíra abre a Governança
- **WHEN** a Raíra aciona a pasta Governança em "Compartilhados comigo"
- **THEN** o explorador mostra o conteúdo da pasta, a identificação
  "Compartilhada pela unidade SEDE" e a trilha começando em "Governança",
  sem ações de escrita

#### Scenario: Subpasta navegável
- **WHEN** a Raíra abre uma subpasta da Governança
- **THEN** a trilha mostra "Governança › {subpasta}", e nenhuma pasta acima
  da Governança é nomeada
