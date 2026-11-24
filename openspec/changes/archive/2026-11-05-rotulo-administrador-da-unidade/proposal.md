# Proposal

## Why

Desde o change `identidade-visual-isetes` (design.md D7) o papel `unit_admin` é
exibido como **"Gestor"**, por escolha de nomenclatura do cliente. A demanda nº
2 trouxe um segundo "Gestor" — coordenador, gerente ou diretor que **acompanha
as leituras** da equipe sem administrar a unidade (seção 3.1) —, e
`nomenclatura-interface` proíbe a mesma palavra para dois papéis de alcances
diferentes.

O cliente decidiu a colisão em 2026-11-05
(`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, resposta 5a): quem
administra a unidade passa a se chamar **"Administrador da unidade"** em todas
as telas, e **"Gestor"** fica para quem acompanha leituras — "nos hospitais,
gestor já é como as pessoas chamam coordenador, gerente e diretor". É a fatia
**A7** do plano, pré-requisito do bloco C: a C0 não pode nomear o gestor de
acompanhamento enquanto a palavra estiver ocupada.

## What Changes

- **`ROLE_LABEL[unit_admin]`** passa de "Gestor" a **"Administrador da
  unidade"** — origem única do rótulo, então a troca alcança de uma vez o
  cadastro de colaboradores, o cartão do usuário, a recaída da linha da
  saudação e qualquer outra tela que exiba o papel.
- **`nomenclatura-interface` inverte a proibição**: hoje o requisito proíbe
  "Administrador da unidade" em texto visível; passa a exigi-lo e a reservar
  "Gestor" ao papel de acompanhamento de leituras (que entra com a C0). Até lá,
  "Gestor" não aparece como rótulo de papel em tela nenhuma.
- **Manual e PRD acompanham**: toda menção a "Gestor"/"gestor" como nome de
  quem administra a unidade vira "Administrador da unidade" / "administrador da
  unidade". As US 10.x escritas "Como Gestor" passam a "Como Administrador da
  unidade", para que "Gestor" no PRD signifique uma coisa só.
- **Só texto.** `unit_admin`, banco, contratos de API e permissões não mudam.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `nomenclatura-interface` — rótulo do papel `unit_admin` e reserva de
  "Gestor".

## Impact

- **Web**: `apps/web/src/shell/role-label.ts`; testes que fixam o texto
  (`rotulo-de-papel`, `pessoas`, `role-guard`); comentários que citam o rótulo.
- **Documentação**: `docs/manual/docs/` (`index.md`, `a-tela.md`,
  `administrador/pessoas.md`, `administrador/unidades.md`,
  `colaborador/controle-documental.md`); `docs/prd_final.md`; plano.
- **Sem migração, sem rota, sem mudança de permissão.**
