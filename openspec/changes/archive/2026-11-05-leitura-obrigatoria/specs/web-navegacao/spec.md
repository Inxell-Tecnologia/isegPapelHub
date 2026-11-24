# Spec Delta

## ADDED Requirements

### Requirement: Explorador oferece marcar leitura obrigatória

O explorador SHALL oferecer, na linha do arquivo, a ação **Leitura
obrigatória** somente a quem pode editar os dados de controle do documento, pelo
veredito já resolvido pelo servidor na listagem. A ação SHALL abrir o
formulário de marcação com o público, o prazo (padrão de 15 dias), a mensagem e
a prévia da contagem de pessoas, e SHALL informar quando o documento não é
elegível ou quando a revisão vigente já está marcada. Referência: PRD US 12.2;
demanda do cliente nº 2, seção 3.2 (etapa 1).

#### Scenario: Quem não edita o documento não vê a ação
- **WHEN** uma pessoa sem permissão de editar os dados de controle abre as
  ações de um arquivo
- **THEN** a ação Leitura obrigatória não é apresentada

#### Scenario: Formulário mostra a contagem antes de confirmar
- **WHEN** o publicador escolhe o público no formulário
- **THEN** vê quantas pessoas serão incluídas antes de confirmar
