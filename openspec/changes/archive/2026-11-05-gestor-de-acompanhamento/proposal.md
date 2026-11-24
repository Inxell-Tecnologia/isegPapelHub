# Proposal

## Why

A seção 3.1 de `docs/demanda_cliente_2.md` cria o perfil **Gestor**: diretor,
gerente ou coordenador que **acompanha as pendências de leitura** da equipe. O
cliente fixou o desenho em duas rodadas:

- `docs/respostas_a1_funcao_e_setor.txt`, respostas 3b e 4b — coordenador e
  gerente acompanham **o próprio setor**, o diretor acompanha **a unidade
  inteira**; e é papel **distinto** de quem administra (não cadastra pessoas
  nem libera permissão);
- `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, respostas 5a, 6a, 7a e 8
  — o nome "Gestor" é deste papel (a A7 o liberou), o sistema sabe quem é
  gestor por **marcação explícita no cadastro**, nunca pelo texto do cargo, e a
  Governança da Sede acompanha **todas as unidades**, concedido pessoa a pessoa.

É a fatia **C0** do plano em `docs/plano_demanda_cliente_2.md`, de que C3
(aviso ao gestor) e C4 (relatório) dependem. Esta fatia **só registra** quem
acompanha e o quê; ninguém passa a ver nada novo até a C4.

## What Changes

- **Marcação "Acompanha leituras" no cadastro de pessoa**, com três alcances:
  **do setor**, **da unidade** e **de todas as unidades**. Rótulos na
  interface: "Gestor do setor", "Gestor da unidade", "Gestor de todas as
  unidades". Ausente = não acompanha.
- **Ortogonal ao papel de acesso.** Um `collaborator` pode ser gestor; a
  marcação não concede cadastrar pessoas, liberar permissão nem abrir arquivo —
  nenhuma regra de `lib/access.ts` a lê.
- **Regras de consistência no banco e na rota:**
  - "do setor" **exige setor**: marcar sem setor, ou remover o setor de quem é
    gestor do setor, é recusado com motivo próprio — nunca vira "unidade" em
    silêncio;
  - "de todas as unidades" só pode ser **atribuída, alterada ou retirada pelo
    administrador global** — é a exceção estreita de D5, e o administrador da
    unidade não a mexe;
  - ninguém altera **a própria** marcação, como já não altera o próprio papel.
- **Registro de quem marcou e quando** (`reading_oversight_set_by`/`_at`),
  atualizado a cada mudança do alcance.
- **Relida a cada requisição**: o alcance entra na identidade pela mesma
  releitura de `attachTenantContext` — tirar a marcação corta na requisição
  seguinte, sem novo login.
- **Listagem de colaboradores** mostra o alcance de cada pessoa.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `gestao-pessoas` — marcação de acompanhamento, regras e alcance.
- `web-pessoas` — campo no formulário e coluna na listagem.

## Impact

- **Banco**: migração `0023_reading_oversight.sql` (colunas em `users`, `CHECK`
  de setor).
- **API**: `routes/users.ts` (criar/editar/listar), identidade em
  `middleware/tenant-context.ts` e `routes/auth.ts`.
- **Shared**: `ReadingOversight`, campo em `PersonResponse`,
  `CreatePersonRequest`, `UpdatePersonRequest` e `AuthenticatedIdentity`.
- **Web**: `pessoas/PessoaFormModal.tsx`, `pessoas/PessoasPage.tsx`, rótulos.
- **Documentação**: `docs/manual/docs/administrador/pessoas.md`; PRD — nasce o
  **Épico 12 (Leitura Obrigatória)** com a **US 12.1**; plano.
