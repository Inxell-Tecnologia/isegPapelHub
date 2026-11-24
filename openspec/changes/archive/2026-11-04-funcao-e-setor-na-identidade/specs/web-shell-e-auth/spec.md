# Spec Delta

## MODIFIED Requirements

### Requirement: Identidade no rodapé da navegação apresenta nome, função e unidade

O rodapé da navegação SHALL apresentar, de forma permanentemente visível e sem
exigir acionamento, as iniciais do nome, o nome, a **função** — o cargo do
cadastro — e a unidade da pessoa autenticada, e SHALL oferecer a ação **Sair**.
Quando a função não estiver preenchida, o rodapé SHALL apresentar o rótulo do
**papel de acesso** em seu lugar, pela origem única desse rótulo. As iniciais
SHALL derivar do nome, nunca do identificador interno. O controle de recolher a
navegação SHALL permanecer disponível.

Referência: PRD US 11.1 cenário 1; demanda do cliente nº 2, seção 1.1;
`docs/respostas_a1_funcao_e_setor.txt`, resposta 1 (a).

#### Scenario: Rodapé apresenta a identidade sem exigir acionamento
- **WHEN** uma pessoa autenticada visualiza a navegação expandida
- **THEN** lê no rodapé suas iniciais, seu nome, sua função e sua unidade, sem
  precisar abrir nenhum menu

#### Scenario: Conta sem função recorre ao rótulo do papel
- **WHEN** uma pessoa cuja conta não tem cargo preenchido visualiza o rodapé da
  navegação
- **THEN** lê o rótulo do seu papel de acesso no lugar da função, com o mesmo
  texto exibido nas demais telas que apresentam papel

#### Scenario: Sair está ao alcance no rodapé
- **WHEN** uma pessoa autenticada quer encerrar a sessão
- **THEN** alcança a ação Sair a partir do rodapé da navegação

#### Scenario: Nome longo não rompe a largura da navegação
- **WHEN** a pessoa autenticada tem nome mais longo do que o rodapé acomoda
- **THEN** o cartão preserva a largura da navegação e o nome completo permanece
  disponível a quem aponta o cartão ou o consulta por tecnologia assistiva

#### Scenario: Recolher a navegação preserva o alcance da identidade
- **WHEN** uma pessoa autenticada recolhe a navegação
- **THEN** o controle de recolher continua disponível e a identidade permanece
  alcançável, sem que o identificador interno apareça em seu lugar

## RENAMED Requirements

- FROM: `### Requirement: Identidade no rodapé da navegação apresenta nome, papel e unidade`
- TO: `### Requirement: Identidade no rodapé da navegação apresenta nome, função e unidade`

O rodapé passou a apresentar a **função** do cadastro, e o papel de acesso só
quando ela falta — o título com "papel" descreveria o estado anterior
(`docs/respostas_a1_funcao_e_setor.txt`, resposta 1 (a): *"'Colaborador' ou
'Gestor' é coisa interna do sistema"*).
