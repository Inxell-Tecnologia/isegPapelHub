# Design

## Context

O rótulo do papel tem origem única desde `identidade-visual-isetes`
(`apps/web/src/shell/role-label.ts`): o mapa estava triplicado antes, e o
requisito "Rótulo do papel é idêntico em toda a interface" proíbe divergência.
A troca de texto é, portanto, de uma linha no código — o trabalho está em não
deixar "Gestor" para trás em manual, PRD e specs.

## Goals / Non-Goals

**Goals**

- "Administrador da unidade" como rótulo de `unit_admin` em toda a interface e
  no manual.
- "Gestor" livre para a C0.

**Non-Goals**

- Criar o papel de acompanhamento de leituras (C0).
- Renomear identificadores internos (`unit_admin`, `isAdmin`, rotas).

## Decisions

### D1 — "Administrador da unidade", com "da"

O questionário oferecia "Administrador **de** unidade"; o cliente escreveu
"Administrador **da** unidade". Fica a forma do cliente: é a que ele vai
procurar na homologação, e lê melhor diante do nome da unidade ao lado
("Administrador da unidade · Sede ISETES").

### D2 — Inverter o requisito, não acrescentar outro ao lado

`nomenclatura-interface` diz hoje que "Administrador da unidade" NÃO SHALL
aparecer. Acrescentar um requisito novo que o exija deixaria a spec
contraditória; o requisito é **modificado** — passa a exigir o rótulo novo e a
proibir "Gestor" como nome de `unit_admin`. O cenário "o rótulo anterior não
aparece" continua, agora com o rótulo antigo trocado.

### D3 — "Gestor" reservado, sem uso até a C0

Entre esta change e a C0, nenhuma tela exibe "Gestor" como rótulo de papel. A
spec registra a reserva para que a C0 a encontre escrita, e não precise
descobri-la pelo histórico.

### D4 — Prosa do manual e do PRD também

O manual usa "gestor" em prosa ("o gestor gerencia sua própria unidade"). Ficar
com a prosa antiga faria o manual chamar de "gestor" quem a tela chama de
"Administrador da unidade" — e, depois da C0, de "gestor" duas pessoas
diferentes. Toda menção a quem administra vira "administrador da unidade".
Personagens de teste com nome "Gestora" ficam: são dados de fixture, não
rótulo.

## Risks / Trade-offs

- **Rótulo mais longo** no cartão do usuário (menu de 264 px) e na tabela de
  colaboradores. Medido no navegador: na tabela cabe inteiro; no cartão, a
  linha "função · unidade" era de uma linha só, com reticências, e passou a
  cortar o nome da unidade. Ver D5.

### D5 — Linha do cartão do usuário em até duas linhas

A segunda linha do cartão (`CartaoDoUsuario`) passa de uma linha com
reticências para **até duas** antes de cortar. Com "Administrador da unidade",
uma linha deixava o nome da unidade fora (191 px para o texto); duas comportam
o caso comum, e o corte volta só acima disso, com o texto íntegro preservado no
`title` e no nome acessível, como antes.
- **Menção esquecida.** Mitigação: busca por `Gestor`/`gestor` no repositório
  inteiro como tarefa, com a lista do que fica (fixtures) justificada.

## Migration Plan

Só texto; deploy comum.

## Open Questions

Nenhuma.
