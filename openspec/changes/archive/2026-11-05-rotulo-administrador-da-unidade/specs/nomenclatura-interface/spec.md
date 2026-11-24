# Spec Delta

## MODIFIED Requirements

### Requirement: Rótulo do papel de acesso preservado

A aplicação SHALL manter **"Colaborador"** como rótulo do papel de acesso sem
privilégio administrativo, ao lado de **"Administrador da unidade"** — rótulo do
papel com privilégio administrativo sobre a própria unidade — e de
"Administrador global".
O conjunto de papéis, sua semântica e seus limites de autorização NÃO SHALL ser
alterados por esta nomenclatura: muda o texto apresentado, não o papel. A
interface SHALL continuar exibindo o papel de cada conta como atributo próprio,
distinto do termo que nomeia a entidade.

O termo **"Gestor"** NÃO SHALL nomear o papel com privilégio administrativo de
unidade em texto visível ao usuário — nem na interface, nem no manual. "Gestor"
fica **reservado** a quem acompanha as leituras da equipe sem administrar a
unidade (demanda do cliente nº 2, seção 3.1;
`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, resposta 5a), e só SHALL
aparecer como rótulo quando esse papel existir. Identificadores internos de
código, esquema de banco e contratos de API permanecem inalterados e não são
objeto deste requisito.

#### Scenario: Papel continua distinguindo administradores de colaboradores comuns
- **WHEN** um administrador consulta a listagem de colaboradores de sua unidade
- **THEN** cada linha exibe o papel da conta — "Colaborador", "Administrador da
  unidade" ou "Administrador global" — permitindo distinguir, entre os
  colaboradores listados, quem tem privilégio administrativo

#### Scenario: O rótulo anterior não aparece em texto visível
- **WHEN** uma pessoa percorre as telas que nomeiam o papel de acesso
- **THEN** em nenhuma delas "Gestor" nomeia o papel de quem administra a
  unidade

#### Scenario: Mudança de rótulo não amplia nem reduz privilégio
- **WHEN** uma conta com privilégio administrativo de unidade passa a ser
  rotulada como "Administrador da unidade"
- **THEN** as ações que ela pode executar permanecem exatamente as mesmas de
  antes da mudança de rótulo

#### Scenario: O manual usa o mesmo rótulo da interface
- **WHEN** uma pessoa lê, no manual, o que quem administra a unidade pode fazer
- **THEN** encontra "Administrador da unidade", o mesmo texto que a interface
  exibe para esse papel
