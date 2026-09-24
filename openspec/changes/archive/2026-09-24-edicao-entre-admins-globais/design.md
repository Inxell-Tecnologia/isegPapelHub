# Design

## Context

Ver `proposal.md` — Why. O estado do código em uma frase: `canActOnTarget`
(`apps/api/src/routes/users.ts:80`) é chamada por **duas** rotas com necessidades
diferentes, e implementa a mais estrita das duas.

```
                       canActOnTarget()
                   ┌──────────┴──────────┐
                   │                     │
        PATCH /users/:id         POST /users/:id/password
        (dados, papel,           (redefinição administrativa)
         status, cota)
                   │                     │
                   ▼                     ▼
          herdou a regra           regra legítima
          por acidente             (troca-de-senha D5,
                                    PRD US 1.4 cen. 2)
```

A linha que causa o `403` é uma só:

```ts
if (!targetRole || targetRole === UserRole.GLOBAL_ADMIN) return false;
```

## Goals / Non-Goals

**Goals:**

- Alinhar a implementação à spec `gestao-pessoas`, que já permite `global_admin`
  sobre `global_admin`.
- Tornar a diferença entre os dois alcances **legível no código**, para que a
  próxima rota que precise de um deles não escolha o errado sem perceber.
- Não abrir caminho de auto-bloqueio ao abrir a edição.

**Non-Goals:**

- Mexer no alcance do `unit_admin`, em qualquer das duas rotas.
- Mexer na RLS ou no isolamento por unidade — este change não toca em nenhuma
  rota de conteúdo, e a trava do bypass de `global_admin` continua como está.
- Introduzir hierarquia entre administradores globais (quem criou quem, quem é
  "mais antigo"). Eles passam a ser pares.

## Decisions

### D1 — Duas funções nomeadas, não uma função parametrizada

`canEditTarget(client, ctx, targetId)` e `canResetPasswordOf(client, ctx,
targetId)`, cada uma dita pela rota correspondente.

A alternativa era manter uma função só com um parâmetro (`purpose: 'edit' |
'password'`). Descartada: no ponto de chamada, um enum ou booleano esconde que a
diferença é **de segurança**, e errar o argumento é silencioso — o código
compila, os testes de outra rota passam, e a brecha só aparece em produção. Dois
nomes diferentes tornam a escolha errada visível na revisão.

As duas compartilham o que de fato é comum (ler o papel do alvo do **banco**, na
mesma transação, nunca do corpo da requisição) e divergem só na tabela de
alcance:

| Ator \ Alvo | `collaborator` | `unit_admin` | `global_admin` |
| --- | --- | --- | --- |
| **Edição** — `unit_admin` | ✔ | ✘ | ✘ |
| **Edição** — `global_admin` | ✔ | ✔ | **✔ (novo, inclusive si mesmo)** |
| **Senha** — `unit_admin` | ✔ | ✘ | ✘ |
| **Senha** — `global_admin` | ✔ | ✔ | ✘ (inalterado) |

### D2 — As duas travas de auto-edição bastam; não há contagem de "último administrador"

`PATCH /users/:id` recusa, para **qualquer** papel:

- alterar o **próprio papel** para um papel diferente do atual;
- alterar o **próprio status** para desativado.

Poderia-se, em vez disso, contar administradores globais ativos e recusar a
operação que zerasse a conta. Descartado por ser mais caro e menos previsível:
uma contagem dentro da transação depende do estado do banco no instante, produz
recusas que variam com quem mais existe, e ainda assim não impediria o caso mais
provável — a pessoa desativar a si mesma sem perceber.

As duas travas dão a mesma garantia por construção. Quem executa precisa ser um
administrador global **ativo** (o middleware relê papel e status do banco a cada
requisição), e não pode tocar em si mesmo; logo, depois de qualquer operação
permitida, **ele próprio continua sendo um administrador global ativo**. O
invariante "existe pelo menos um administrador global ativo" se preserva sem
consultar mais nada.

Isso importa porque o bootstrap **não** é rede de segurança para desativação: ele
conta `role = 'global_admin'` sem filtrar status. Um último administrador
desativado mantém a contagem em 1, o job vira no-op e a recuperação exige SQL
manual. Rebaixamento seria recuperável; desativação não.

### D3 — A regra de senha não é afrouxada

Fica como está: a senha de um `global_admin` não é redefinida por ninguém, nem
por outro `global_admin`. A spec `troca-de-senha` a declara de forma normativa e
o PRD a fixa em US 1.4 cenário 2.

A razão substantiva é a assimetria entre as duas ações: editar os dados de outro
administrador é administração; **redefinir a senha dele é tomar a conta dele** —
A redefine, lê a senha gerada na tela (exibida uma única vez, por desenho) e
entra como B, com todos os rastros passando a apontar para B. Nenhuma das razões
para abrir a edição se aplica a isso.

### D4 — A SPA não muda, e isso é deliberado

As travas de interface já existem e já estão certas: `PessoasPage` esconde
"Desativar" na própria linha, e `PessoaFormModal` não oferece papel de alcance
menor para si. O que este change faz é **transformar convenção de tela em
invariante de servidor** — a SPA nunca foi a linha de defesa, e até agora essas
duas regras só existiam nela.

Consequência prática: nenhum arquivo de `apps/web` é tocado, e os testes novos
são de API.

## Risks / Trade-offs

- **Administradores globais viram pares: A pode rebaixar ou desativar B** → é o
  pedido, não um efeito colateral. Mitigação disponível hoje: a consulta
  `SELECT email, role, status FROM users WHERE role = 'global_admin'` mostra o
  estado a qualquer momento. Mitigação de verdade seria auditoria, que segue como
  dívida (`proposal.md` — Fora de escopo).
- **Sem rastro da operação** → mesma dívida. Vale notar que isso já vale hoje
  para rebaixar um `unit_admin`, então o change não cria a lacuna, só amplia o
  conjunto de alvos a que ela se aplica.
- **A separação em duas funções pode divergir com o tempo** (alguém altera uma e
  esquece a outra) → as duas ficam lado a lado no mesmo arquivo, com a tabela de
  alcance de D1 no comentário, e cada ramo tem teste próprio.

## Migration Plan

Nenhuma migration; a mudança é de código. Deploy normal pelo pipeline: build →
job de migração (no-op, nada pendente) → nova revisão do Cloud Run.

**Rollback:** voltar a imagem anterior restaura o comportamento antigo na hora.
Nenhum dado é escrito de forma irreversível por este change — o que ele altera é
a decisão de autorizar ou recusar uma requisição.

**Nota operacional.** A cota concedida por `UPDATE` manual enquanto a edição
estava bloqueada continua valendo e não precisa ser refeita: a coluna é a mesma
que a tela passa a escrever.
