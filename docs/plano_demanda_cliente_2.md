# Plano de implementação — Demanda do cliente nº 2

Plano de execução de `docs/demanda_cliente_2.md` (PapelHub — ajustes da Fase 1,
envio em lote e leitura obrigatória). Mesmo papel que `docs/frontend_roadmap.md`
cumpriu para a SPA: **catalogar as fatias e guardar o estado em disco**, para que
a implementação não dependa de nenhuma janela de conversa.

> **O plano é o arquivo, não o chat.** Tudo o que é preciso para retomar está
> aqui, em `openspec/` e no histórico do git. Nenhuma fatia pressupõe contexto
> de uma sessão anterior.

---

## Como retomar (protocolo de cada sessão)

Execute na ordem, sem depender de memória de conversa:

1. **Situar-se**: `openspec list` (há change em voo?) e
   `ls openspec/changes/archive/ | tail -10` (o que foi entregue por último).
2. **Escolher a fatia**: na [tabela de status](#status-das-fatias), a primeira
   linha que não está `entregue` e cujas dependências estão satisfeitas.
3. **Carregar o contexto da fatia** — só estas leituras, nesta ordem:
   - a seção da fatia neste documento (o que entrega, do que depende, riscos);
   - a seção correspondente de `docs/demanda_cliente_2.md` (texto do cliente,
     vinculante);
   - a US indicada em `docs/prd_final.md` (critérios Dado/Quando/Então são
     vinculantes);
   - as specs listadas em `openspec/specs/` que a fatia altera.
4. **Conferir bloqueios**: ver [Decisões pendentes](#decisões-pendentes-do-cliente)
   e [Dependências externas](#dependências-externas-fora-do-código). Fatia com
   bloqueio aberto **não começa** — pule para a próxima liberada.
5. **Propor e implementar**: `/opsx:propose` (ou `/opsx:new` + `/opsx:continue`),
   depois `/opsx:apply`, `/opsx:verify` e `/opsx:archive`.
6. **Fechar o ciclo no mesmo commit da fatia**:
   - atualizar a linha da fatia na tabela de status (→ `entregue`, com o nome do
     change arquivado);
   - registrar aqui qualquer lacuna conhecida ou decisão nova;
   - atualizar a página correspondente de `docs/manual/` (regra já vigente no
     `CLAUDE.md`);
   - atualizar `docs/prd_final.md` quando a fatia acrescentar ou alterar uma US.

**O passo 6 é o que mantém o plano retomável.** Uma fatia entregue sem atualizar
esta tabela deixa o plano mentindo, e a sessão seguinte começa no escuro.

---

## Status das fatias

Legenda: `pendente` · `bloqueada` (ver coluna Bloqueio) · `em andamento` ·
`entregue`.

| # | Fatia | Seção da demanda | Situação | Bloqueio | Change arquivado |
| :-- | :--- | :--- | :--- | :--- | :--- |
| A1 | Função e setor na identidade | 1.3 (Atenção: Perfil), 3.1 | **entregue** | — | `funcao-e-setor-na-identidade` |
| A2 | Menu lateral e barra superior | 1.1, 1.2 | **entregue** | E1 (parcial) | `menu-lateral-e-barra-superior` |
| A3 | Conteúdo da tela Início | 1.3 | **entregue** | E1 (marca d'água) | `conteudo-da-tela-inicio` |
| A4 | Favoritos | 1.1 (menu) | **entregue** | — | `favoritos` |
| A5 | Compartilhados comigo | 1.1 (menu) | **entregue** | — | `compartilhados-comigo` |
| A6 | Tour guiado | 1.1, 1.3 | **entregue** | — | `tour-guiado` |
| A7 | Rótulo "Administrador da unidade" | — (resposta 5 de D3) | **entregue** | — | `rotulo-administrador-da-unidade` |
| B1 | Arquivo geral e pendente de cadastro | 2.3, 2.4 | **entregue** | — | `arquivo-geral-e-pendente-de-cadastro` |
| B2 | Tabela de cadastro no envio em lote | 2.1, 2.2 | **entregue** | — | `tabela-de-cadastro-no-envio-em-lote` |
| C0 | Gestor de acompanhamento no cadastro | 3.1 | **entregue** | — | `gestor-de-acompanhamento` |
| C1 | Núcleo da leitura obrigatória (marcar e dar ciência) | 3.1, 3.2 (etapas 1 e 3), 3.3, 3.4 | **entregue** | — | `leitura-obrigatoria` |
| C2 | Superfícies de pendência (menu, contador, cartão, abas) | 3.2 (etapa 2), 3.5 | **entregue** | — | `superficies-de-pendencia` |
| C3 | Avisos e atrasos | 3.2 (etapas 2 e 4), 3.3 | **entregue** | — | `avisos-e-atrasos` |
| C4 | Acompanhamento e relatório exportável | 3.5 | **entregue** | — | `acompanhamento-de-leituras` |

Ordem sugerida: **A1 → A2 → A3 → (A4, A5, A6 em qualquer ordem) → B1 → B2 →
A7 → C0 → C1 → C2 → C3 → C4** (C0 e C1 são independentes entre si; ambas só
esperam a A7). Na prática o bloco B foi antecipado e, entre A4 e A5, a
**A5 veio primeiro** — não exigia migração e fixou a forma de listagem plana
que a A4 consome.

> ✅ **A janela aberta pela B1 está fechada.** Entre a B1 e a B2, o servidor
> exigia os dados por item e a SPA não os enviava, de modo que todo envio em lote
> nascia Pendente de cadastro. Com a B2 entregue, o envio em lote publica o que
> está completo e deixa pendente só o que falta — verificado na app: três
> arquivos, dois publicados (um deles Arquivo geral), um pendente com aviso no
> sino.

Os blocos **A** (Fase 1), **B** (envio em lote) e **C** (Fase 2) são
independentes entre si, exceto por C2, que ocupa espaços de layout criados em
A2/A3. Se a prioridade do cliente mudar, o bloco B pode ser antecipado inteiro
sem tocar em A.

---

## Decisões pendentes do cliente

Cada uma trava as fatias indicadas. **Não resolver por conta própria** — são
decisões de produto, e duas delas mexem no núcleo de segurança do sistema.

> ✅ **D2, D3 e D4 foram perguntadas e respondidas.** O questionário está em
> `docs/questionario_a1_funcao_e_setor.txt` e as respostas, transcritas, em
> **`docs/respostas_a1_funcao_e_setor.txt`** (2026-11-04). **D2 e D4 estão
> resolvidas** e liberaram a A1 (change `funcao-e-setor-na-identidade`); **D3
> está parcialmente resolvida** — o alcance ficou definido, mas a **colisão do
> nome "Gestor" continua aberta** e segue travando C1 e C3. **D1** ficou de fora
> de propósito — é estrutural e vai com as alternativas e o custo de cada uma;
> o cliente confirmou que quer tratá-la separado.

> ✅ **D1, D3 (colisão de nome) e D5 foram perguntadas e respondidas.** O
> questionário está em `docs/questionario_d1_d3_d5_decisoes_estruturais.txt` e
> as respostas, transcritas, em
> **`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`** (2026-11-05). As três
> foram para o caminho que **não reabre o isolamento** nesta demanda:
>
> - **D1** → tenancy mantida; a grade do Início lista pastas, com o título
>   **"Pastas da unidade"** (diferença do Anexo A aceita por escrito), contagem
>   de **"documentos novos nos últimos 7 dias"** e cartão clicável. Libera a
>   **A3** (e, por consequência, a A6).
> - **D3** → `unit_admin` passa a ser exibido como **"Administrador da
>   unidade"** em todas as telas, e **"Gestor"** fica para quem acompanha
>   leituras, marcado **explicitamente no cadastro** (setor ou unidade inteira).
>   Vira duas fatias novas, **A7** (o rótulo) e **C0** (a marcação), e libera o
>   **bloco C**.
> - **D5** → exceção estreita, **só para a Fase 2**: situação nominal de leitura
>   das outras unidades, sem bytes e sem auditoria, concedida pessoa a pessoa
>   (Mariana Bispo e Ana Morais, da Sede). Cabe na **C4**.
>
> Vieram também **dois pedidos que não são desta demanda** e ficam registrados
> sem travar nada: a Governança **abrir e baixar** documentos das outras
> unidades (resposta 7, "mais para frente") e uma área única de **Documentos
> Institucionais** lida por todas as unidades. Ver **D7**.

### D1 — "Minhas unidades": acesso a mais de uma unidade  ✅ respondida

> **Resposta 1 (a):** ninguém precisa trabalhar em mais de uma unidade — a
> tenancy fica como está. A grade lista as **pastas de primeiro nível da
> unidade da pessoa**, com o título **"Pastas da unidade"**; o cliente
> **aceitou por escrito** a diferença em relação ao Anexo A. **Resposta 3
> (b):** a frase conta **"documentos novos nos últimos 7 dias"** — não há
> coluna de último acesso a criar. **Resposta 4 (a):** o cartão abre a pasta.
> O caso da Governança foi respondido em **D5**. Ver
> `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`.

A demanda (1.3) pede uma grade de unidades e a frase *"você tem acesso a X
unidades"*. O sistema de hoje é o oposto: **`users.unit_id` é `NOT NULL` e
único** — cada pessoa pertence a exatamente uma unidade, o RLS do Postgres
filtra por `app.current_unit` (um valor), e `access.ts` é *fail-closed* para
recurso de outra unidade. Nem o administrador global enxerga conteúdo alheio.

Opções:

| | Caminho | Custo | Risco |
| :-- | :--- | :--- | :--- |
| **a** | Manter a tenancy. Os cartões listam **pastas de primeiro nível da própria unidade** (comportamento atual do change `shell-e-inicio`), com o título "Minhas unidades" e o tratamento visual pedido | baixo | diferença visível em relação ao Anexo A — precisa de aceite explícito |
| **b** | Pertencimento múltiplo: tabela `user_units`, `app.current_unit` passa a conjunto, policies RLS de `=` para `IN`, alternador de unidade na interface | alto | mexe no invariante de isolamento; exige revisão de todas as rotas e dos testes de isolamento |
| **c** | Pessoa segue em uma unidade, mas concessões podem atravessar unidades para recursos específicos | médio | abre exceção no *fail-closed* do `access.ts`; isolamento deixa de ser absoluto |

**Recomendação: (a) nesta rodada**, com aceite formal da diferença; (b) só como
change própria, isolada, com os testes de isolamento reescritos antes do código.
A frase da saudação, se (a) for aceita, vira contagem de pastas, não de unidades.

> Observação: a mesma decisão reaparece em **3.1** — *"Governança (Sede)
> acompanha todas as leituras"*. Relatório nominal de pessoas de outras unidades
> é alcance cross-unit, exatamente o que a trava do bypass de `global_admin`
> proíbe hoje. Ver **D5**.

### D2 — "Perfil" exibido: papel ou função?  ✅ respondida

> **Resposta 1 (a):** aparece o **cargo** do cadastro; sem cargo preenchido,
> o nível de acesso. A resposta 2 (b) confirma a correção de cadastro, mas os
> nomes vieram ocultados — é operação do cliente. Ver
> `docs/respostas_a1_funcao_e_setor.txt`.

A demanda (1.3) reporta: *"para a gerente de Governança aparece Colaborador"*.
Não é leitura errada do cadastro — é descasamento de conceito. O sistema tem
**papel** (`collaborator` / `unit_admin` / `global_admin`, que define permissão)
e **função/cargo** (`job_title`, texto livre, sem efeito em permissão). A tela
mostra o papel; o cliente espera ler a função.

Opções: (i) exibir `job_title` quando preenchido, caindo para o papel quando não
— sem efeito em permissão; (ii) rever o cadastro dessas pessoas para
`unit_admin`, se a intenção é que elas realmente administrem a unidade.

Provavelmente **as duas**: (i) resolve a tela, (ii) resolve a permissão. Precisa
do cliente para saber qual é o caso de cada pessoa.

> **Verificado no código (2026-11-04).** A linha é
> `apps/web/src/inicio/InicioPage.tsx:69` — `ROLE_LABEL[identity.role] · unitName`.
> `ROLE_LABEL` (`apps/web/src/shell/role-label.ts`) já mapeia `unit_admin` →
> **"Gestor"**, de modo que a tela escrever "Colaborador" significa que a pessoa
> **está cadastrada como `collaborator`** — não há defeito de leitura a corrigir.
> `job_title` e `work_area` existem ponta a ponta no cadastro de pessoas
> (`0003_people_fields.sql`, `routes/users.ts`, `PessoaFormModal.tsx`, rotulados
> "Função/cargo" e "Área de trabalho"), mas **não entram em
> `AuthenticatedIdentity`** (`packages/shared/src/auth.ts`: só `id`, `unitId`,
> `role`, `fullName`, `unitName`). É esse o acréscimo da A1.

### D3 — "Gestor" e "equipe": hierarquia nova  ✅ respondida

> **Resposta 5 (a) (2026-11-05) — fecha a colisão de nome:** `unit_admin`
> passa a ser exibido como **"Administrador da unidade"** em todas as telas, e
> **"Gestor"** fica para quem acompanha leituras ("nos hospitais, gestor já é
> como as pessoas chamam coordenador, gerente e diretor"). É a **A7**.
> **Resposta 6 (a):** o sistema sabe quem é gestor por **marcação explícita no
> cadastro** — "acompanha as leituras do setor" ou "da unidade inteira" —,
> nunca deduzida do texto livre do cargo. É a **C0**.

> **Respostas 3 (b) e 4 (b):** opção (ii) — coordenador e gerente acompanham
> o **próprio setor**, diretor acompanha a **unidade inteira**; é papel
> **distinto** de quem administra (não cadastra pessoas nem libera permissão).
> A chefia nominal foi descartada pelo custo de manutenção. **Continua aberta
> a colisão de nome abaixo** — um dos dois "Gestor" tem de ser renomeado, e é
> decisão do cliente. Trava C1 e C3.

A seção 3.1 define um perfil **Gestor** que *"acompanha as pendências da própria
equipe"*, e 3.2 (etapa 4) manda avisar *"o gestor dele"*. Isso exige saber **quem
é gestor de quem** — relação que não existe em nenhuma tabela. Os três papéis
atuais não a expressam.

> **Colisão de nome a resolver antes da spec.** "Gestor" **já é o rótulo de
> `unit_admin` na interface** (decisão de nomenclatura do cliente, change
> `identidade-visual-isetes`, design.md D7). O "Gestor" da seção 3.1 — *"diretor,
> gerente ou coordenador da unidade ou setor"* que acompanha pendências — pode
> ser a mesma pessoa ou um papel distinto, que acompanha leituras sem administrar
> a unidade. Se for distinto, a interface passa a ter dois "Gestor" com alcances
> diferentes, o que `nomenclatura-interface` proíbe ("rótulo do papel é idêntico
> em toda a interface"). Um dos dois tem de ser renomeado — decisão do cliente.

Opções: (i) gestor = `unit_admin` da unidade, e "equipe" = a unidade inteira
(barato, perde o recorte por setor); (ii) gestor por setor (depende de **D4**):
"equipe" = pessoas do mesmo setor; (iii) chefia nominal (`users.manager_id`),
explícita e precisa, com custo de manutenção do cadastro.

### D4 — "Setor": texto livre ou entidade?  ✅ respondida

> **Respostas 5 (a) e 6 (a):** setor **é** critério de público e recorte de
> relatório, e **é o mesmo conceito** de "Área de trabalho" — aproveitar o que
> está cadastrado, padronizando a escrita. Logo: **entidade por unidade**,
> entregue pela A1. A pergunta 7 (lista oficial, com Ana) segue pendente e
> **não trava**: a lista inicial nasce do acervo e é padronizada por
> renomeação.

Hoje existe `users.work_area` (texto livre, sem validação) e, em documentos,
`responsible_sector` (também livre). A demanda usa setor como **critério de
público** (3.2: *"unidades, setores, perfis ou pessoas, combináveis"*), como
recorte de relatório (3.5) e na saudação (1.3).

Texto livre não serve de critério de público: "Governança", "governanca" e
"Gov." viram três setores. Para 3.2 e 3.5 funcionarem, setor precisa ser
**entidade por unidade** (tabela `sectors` com `unit_id` + RLS, `users.sector_id`
apontando para ela), com migração dos valores livres existentes.

Se o cliente aceitar adiar o público por setor, D4 cai para "só exibição" e fica
barata.

### D5 — Alcance do relatório de acompanhamento  ✅ respondida (Fase 2)

> **Resposta 7 (a):** opção (ii) abaixo. A Governança acompanha **quem leu e
> quem não leu em cada unidade** — nomes, setores, datas e percentual — **sem
> abrir arquivo e sem ver auditoria de acesso**. **Resposta 8:** o alcance é
> concedido **pessoa a pessoa**: **Mariana Bispo** (Sede — Gerência de
> Governança e Performance Corporativa) e **Ana Morais** (Sede — Diretoria de
> Serviços Compartilhados).
>
> Consequências para a C4: (1) é a **exceção estreita e explícita** à trava do
> bypass de `global_admin` que o invariante 3 exige registrar em `design.md`;
> ela alcança **só as tabelas de leitura obrigatória e os campos de pessoa
> necessários ao relatório** (nome, unidade, setor) — nunca `files`,
> `folders`, URL assinada ou `audit_events`; (2) a concessão é um atributo
> **nominal e auditável** da pessoa, não um papel que "liga para todo mundo" —
> cabe na mesma marcação da C0, como terceiro alcance ("todas as unidades"),
> atribuível só por `global_admin`; (3) precisa de teste de isolamento
> próprio provando que a mesma pessoa **continua recebendo `403`** em bytes e
> auditoria de outra unidade.
>
> A resposta 7 também registra que, "mais para frente", a Governança precisará
> **abrir e baixar** os documentos das unidades (opção b). **Não é desta
> demanda** — ver **D7**.

Ligada a **D1**. A seção 3.5 quer Governança vendo todos os documentos,
publicador vendo os que marcou e gestor vendo só a própria equipe. As duas
últimas visões cabem no modelo atual; a primeira, não — é leitura nominal
cross-unit.

Opções: (i) Governança vê tudo **da Sede**, e cada unidade tem a sua
Governança local; (ii) papel novo de auditor cross-unit, restrito a
*agregados e nomes de leitura obrigatória* (sem bytes, sem auditoria de acesso)
— exceção estreita e explícita à trava do bypass, documentada em `design.md`;
(iii) resolver junto com D1(b).

### D7 — Pedidos estruturais registrados para depois  🔴 estrutural · fora da demanda nº 2

Vieram no retorno de 2026-11-05 e **não travam nenhuma fatia**. Os dois
reabrem o isolamento entre unidades e, por isso, cada um vira **change
própria, com prazo próprio e revisão de segurança antes do código** — o
cliente concordou explicitamente com isso no item (i).

- **(i) Governança abre e baixa documentos das outras unidades** (resposta 7,
  opção b). Mesmo caminho de D1(b)/D5(iii): para um perfil nominal, o
  `access.ts` deixa de ser *fail-closed* em outra unidade para os verbos
  `view` e `download`, e toda rota de conteúdo que hoje compara
  `resource.unit_id === ctx.unitId` precisa ser revista. Pergunta a fazer
  quando for planejado: a auditoria de acesso (opção c) continua fora?
- **(ii) Área única de "Documentos Institucionais"** (observação final). Uma
  área lida e baixada por **todas** as unidades, em que **só a Governança
  publica e revisa** — uma versão de cada documento, sem cópias por unidade.
  Só políticas, normas, protocolos, POPs e formulários institucionais
  aprovados. É leitura de conteúdo atravessando unidades, ainda que num
  formato mais estreito que (i): **um** acervo com leitura ampla, não acesso
  de uma pessoa ao acervo de outra unidade. Questões a resolver na proposta:
  onde mora no modelo (`unit_id` da Sede com regra de leitura global, ou
  dono próprio fora da tenancy), como RLS e `access.ts` passam a admitir essa
  leitura sem abrir as demais pastas da Sede, quem conta como "Governança"
  para publicar, e como fica a **leitura obrigatória** de um documento
  institucional para todas as unidades — hoje a C1 limita o público à
  unidade do documento.

> Enquanto não houver change própria, nenhuma fatia antecipa (i) ou (ii) "de
> passagem". Em especial, a C1 **mantém** "unidades no público = a unidade do
> documento" escrito na spec; a extensão para documento institucional entra
> com (ii), não antes.

### D6 — Formato e prazo (menores)

- **Exportação Excel e PDF** (3.5): não há precedente no repositório — a
  auditoria tem "sem exportação" como lacuna conhecida. Decidir entre
  geração no cliente (sem dependência nova no servidor, tetos de volume) ou
  biblioteca no servidor. Recomendação: cliente, como já se faz no `.zip` de
  pasta (`client-zip`), mantendo a regra de que a API não monta artefato.
- **Prazo da Fase 2** (seção 5): **estimado em 2026-11-05** — ver
  [Estimativa da Fase 2](#estimativa-da-fase-2). Formato de exportação segue
  com a recomendação acima; decide-se na proposta da C4 sem voltar ao cliente,
  salvo se ele pedir o contrário.

### Estimativa da Fase 2

Feita depois de D3 e D5 respondidas, quando o tamanho do bloco C ficou
conhecido. **Base**: o ritmo medido nas seis fatias já entregues desta demanda
(proposta → implementação → arquivamento de cada uma coube num dia útil,
inclusive a B1, a maior delas, com duas migrações e reversão de requisito) e o
tamanho relativo de cada fatia do bloco C contra essas.

| Fatia | Tamanho relativo | Dias úteis |
| :-- | :--- | --: |
| A7 — rótulo "Administrador da unidade" | menor que a A5 (só texto, manual e PRD) | 0,5 |
| C0 — gestor de acompanhamento no cadastro | ≈ A1 (migração, cadastro, identidade) | 1 |
| C1 — marcar e dar ciência | ≈ B1 + B2 (duas tabelas com RLS, público reavaliado, regra por revisão) | 3 |
| C2 — superfícies de pendência | ≈ A2 (só apresentação, sobre espaços que a A3 cria) | 1,5 |
| C3 — avisos e atrasos | job + scheduler no Terraform + deploy | 1,5 |
| C4 — acompanhamento e exportação | a maior em risco: exceção de D5, três recortes de alcance, exportação | 3 |
| **Subtotal** | | **10,5** |
| Folga de 20% (retrabalho de homologação, revisão de segurança da C4) | | 2 |
| **Total de desenvolvimento** | | **≈ 13** |

**Calendário**, contando que a Fase 2 começa depois de fechar o que resta da
Fase 1 (A3, A4 e A6, ≈ 3 dias úteis, a partir de 2026-11-05) e descontando o
feriado de 20/11:

- **início da Fase 2**: 10/11/2026;
- **entrega completa em homologação**: até **27/11/2026**;
- **produção**: depois de uma semana de homologação pelo cliente — previsão
  **semana de 07/12/2026**.

Entregas intermediárias, para o cliente homologar por partes: **A7 + C0 + C1**
(marcar e dar ciência funcionando) por volta de 17/11; **C2 + C3** por volta de
23/11; **C4** em 27/11.

**Condições** — o prazo vale se: (1) o ambiente de homologação e o contato de
TI (**E3**) estiverem definidos até o início de C1; (2) a marcação de quem é
gestor (C0) for **feita pelo cliente** no cadastro antes de homologar C3 e C4 —
é dado dele, não do sistema; (3) **D7 não entrar** na Fase 2. Qualquer pedido
de D7 dentro da Fase 2 reabre a estimativa: é trabalho de isolamento, com
revisão de segurança antes do código.

---

## Dependências externas (fora do código)

| | Item | Responsável | Trava |
| :-- | :--- | :--- | :--- |
| **E1** | Logo ISETES branca (150 px) e símbolo em PNG transparente, para o menu e as marcas d'água | Governança | A2 e A3 só fecham com os arquivos; a estrutura pode ser implementada antes, com o ativo atual |
| **E2** | Prints das telas de Documentos e de acesso para homologação | TI | entrega de homologação, não bloqueia código |
| **E3** | Ambiente de homologação e contato de TI para a tela de acesso | TI + Governança | o contato de suporte já é configurável por implantação (`identidade-visual`); falta o valor |

---

## Fatias

### A1 — Função e setor na identidade

- **Capabilities**: `autenticacao` (modificada), `gestao-pessoas` (modificada),
  possivelmente `setores` (nova, se D4 = entidade)
- **Demanda**: 1.3 (Atenção → Perfil), 1.3 (linha da saudação), 3.1
- **PRD**: US 1.1 (cadastro), US 11.1 (saudação)
- **Entrega**: a identidade devolvida à interface passa a carregar função e
  setor, de modo que a saudação e o cartão do usuário mostrem o que o cadastro
  diz. Resolve a queixa do "Colaborador" conforme **D2**. Se **D4** apontar para
  entidade, entrega a tabela de setores (com `unit_id` e policy RLS, como manda
  o `CLAUDE.md`) e a migração dos `work_area` existentes.
- **Depende de**: — (mas está travada por D2 e D3/D4)
- **Risco**: tabela nova exige coluna `unit_id` + policy RLS; esquecer a policy
  é furo de isolamento, não detalhe.
- **Por que primeiro**: A3 (saudação), C1 (público por setor) e C3 (aviso ao
  gestor) dependem desses dados. Fazer depois obriga a voltar às três.

### A2 — Menu lateral e barra superior  ✅ entregue

> Change `menu-lateral-e-barra-superior`. **Desvios do previsto aqui,
> decididos durante a especificação e a implementação:**
>
> - **O contador do sino já existia.** `NotificationCenter` consome
>   `useUnreadNotificationCount` e envolve o botão num `Badge` desde antes. O
>   relato de "sino sem contador" descreve contagem **zero**, que o design
>   system não desenha. Nenhuma rota nova, nenhum requisito novo em
>   `notificacoes` — o risco anotado nesta seção se resolveu na conferência.
> - **Os 600 px de busca viraram teto, não medida.** No limiar de 992 px a
>   barra dispõe de 680 px e o campo divide com sino, ajuda e envio: 600 fixos
>   estourariam a linha e produziriam a rolagem horizontal que
>   `web-responsividade` proíbe. Medido na app: 400 px em 992, 432 em 1024 e o
>   teto de 600 a partir de 1280.
> - **O `Input.Search` foi descartado.** Ele renderiza o acionador num
>   `ant-input-group-addon` — **fora** da caixa do campo — com ou sem
>   `enterButton`, o oposto do que a demanda pede. O acionador é `suffix` de um
>   `Input` comum.
> - **O botão de envio não é filtrado por papel.** `canUpload` é por pasta e vem
>   do servidor; permissão de envio nasce de concessão, não de papel. O botão
>   reusa o pedido pelo endereço de `cartoes-de-atalho-acionaveis`, e o
>   explorador o atende só depois do veredito — é assim que o atalho não conduz
>   a recusa. `PARAM_PEDIDO_DE_ENVIO` saiu de `inicio/atalhos.ts` para
>   `navegacao/pedido-de-envio.ts`, já que agora tem três consumidores.
> - **Dois defeitos que só a medição em navegador pegou:** o campo de busca
>   colapsava para **24 px** em 375 px (corrigido com piso de 120 px, botão de
>   envio só com ícone e ajuda fora da barra no modo estreito — o manual segue
>   a um toque no grupo AJUDA do painel), e o cartão do usuário ficava em
>   **y=977 numa viewport de 900 px**, fora da tela, porque o `Sider` cresce com
>   o conteúdo da página (coluna passou a `sticky`/`100vh`, com reserva da
>   altura do gatilho de recolher).
> - **O avatar exigiu requisito novo em `sistema-de-design`.** `#9ED8F6` mede
>   11,12:1 com o texto escuro e **1,54:1 com branco**, e o `Avatar` escreve em
>   branco por padrão. O rótulo de grupo também: o padrão do design system para
>   título de grupo no menu escuro é um branco translúcido que reprova no piso.
>
> **Lacunas conhecidas, aceitas:**
>
> - Quatro itens de menu não entraram, por não terem destino: **Favoritos**,
>   **Compartilhados comigo** (A4, A5), **Leitura obrigatória** (C2) e **Tour
>   guiado** (A6). A homologação da A2 verá um menu diferente do Anexo A por
>   isso.
> - **E1 segue aberto, e a medida de 150 px não se aplica ao ativo atual**: ele
>   é retrato (301×502), de modo que 150 px de largura dariam 250 px de altura
>   num menu de 264 px. A logomarca foi de 40 para 96 px de altura e a queixa de
>   "miniatura ilegível" é resolvida pelo **nome em texto**, que não depende de
>   ativo. A marca d'água do símbolo (200 px, 14%) continua fora: o JPEG é
>   opaco, e a 14% apresentaria um retângulo cinza.
> - O cartão do usuário exibe o **papel**, não a função do cadastro. É a A1,
>   travada por **D2** — e o cartão é a única superfície que apresenta o dado,
>   então a troca fica contida nele.

- **Capabilities**: `web-shell-e-auth` (modificada), `identidade-visual`
  (modificada), `web-busca` (modificada), `sistema-de-design` (modificada)
- **Demanda**: 1.1 e 1.2 (as duas tabelas, item a item)
- **PRD**: US 11.1
- **Entrega**: menu com 264 px e nenhum rótulo truncado; logo branca de 150 px
  com "PapelHub" e "Gestão de Documentos"; itens compactos com área de
  acionamento de 44 px; agrupamento por rótulo **NAVEGAÇÃO** e **AJUDA**;
  cartão do usuário no rodapé (iniciais, nome, perfil, unidade) + **Sair**,
  preservando o recolher; marca d'água do símbolo no pé do menu (200 px, 14%).
  No topo: busca à esquerda com 600 px e lupa dentro do campo, com o texto de
  apoio pedido; botão verde **Enviar documento** para quem tem permissão de
  envio; sino com contador de não lidas; botão de Ajuda; avatar sai do topo.
- **Depende de**: — (E1 para o ativo final)
- **Decisão de escopo**: os itens de menu **Favoritos**, **Compartilhados
  comigo** e **Leitura obrigatória** pertencem a fatias que ainda não existem
  (A4, A5, C2). Esta fatia entrega a **estrutura dos grupos** e os destinos que
  já funcionam; cada item entra junto com a sua fatia. Menu com item que não
  leva a nada é regressão — a capability `tela-inicial` já normatiza que "atalho
  apresentado conduz a uma ação executável".
- **Risco**: o contador do sino consome a contagem de não lidas que
  `notificacoes` já expõe — conferir antes de criar rota nova.

### A3 — Conteúdo da tela Início  ✅ entregue

> Change `conteudo-da-tela-inicio`. **Desvios do previsto aqui, decididos
> durante a especificação e a implementação:**
>
> - **"Novo" é publicado, não alterado** (design.md D1). A tabela de recentes
>   logo abaixo já mostra as alterações; contá-las de novo repetiria a tabela
>   com outro número e faria um documento renomeado parecer novo.
> - **Rota própria, `GET /files/recent/new-count`**, sob `/files` — nenhum
>   prefixo de topo novo, o invariante 7 não foi tocado. A contagem passa pela
>   mesma `hasAccess(view)` da lista, item a item, com o teto
>   `candidateLimit`; acima dele a tela diz **"pelo menos N"**, nunca o teto
>   como número exato.
> - **Os atalhos de administração saíram da tela.** O conjunto agora é o da
>   demanda (Enviar documento, Nova pasta, Buscar documento, Manual do
>   usuário), os quatro alcançáveis por qualquer papel. O filtro por papel
>   continua no código para o atalho que vier a exigir papel.
> - **"Nova pasta" e "Buscar documento" conduzem à ação, não à tela**, pela
>   regra já vigente em `tela-inicial`: o explorador atende um pedido de nova
>   pasta no endereço (`/pastas?nova-pasta=1`, **só na raiz**, onde criar é
>   livre a qualquer pessoa autenticada; numa subpasta o pedido é descartado),
>   e a busca recebe quem chega sem termo com o campo focado.
> - **A coluna Pasta saiu dos recentes**, por não estar na lista da demanda; a
>   coluna **Unidade é constante** (D1) e vem da identidade, não do DTO. O
>   destino Recentes usa a mesma tabela — uma origem só — e passou a se chamar
>   "Documentos recentes".
> - **A coluna direita foi feita sem media query** (`flex-wrap`, 999:1), para
>   não criar um segundo limiar de largura além do `lg` da aplicação. Os dois
>   cartões dizem o que vão apresentar, e **não** "nenhuma pendência" — a frase
>   seria verdadeira só por vacuidade.
> - **Títulos de cartão quebram linha em vez de truncar**: em 375 px o link
>   "Ver histórico completo" cortava "Documentos recentes" com reticências.
>   Medido na app: sem rolagem horizontal em 375 px, coluna direita com 340 px
>   em 1440 px.
>
> **Lacunas conhecidas, aceitas:**
>
> - **Link do tour** fora — o destino é a A6, e atalho sem destino é
>   regressão. Entra com a A6.
> - **Marca d'água** fora — **E1**: o ativo atual é JPEG opaco.
> - "Ver histórico completo" leva ao **recorte** do servidor (até 10
>   documentos em 90 dias, `config.recentDocuments`), não a um histórico sem
>   limite; a frase de apoio do destino diz isso por escrito.
> - Redação da linha de contagem a confirmar na homologação.
> - O manual (`a-tela.md`) ainda chama `unit_admin` de "Gestor" — é a A7 que
>   troca o rótulo em todo lugar.

- **Capabilities**: `tela-inicial` (modificada), `controle-documental`
  (consumida na tabela de recentes)
- **Demanda**: 1.3 (tabela inteira)
- **PRD**: US 11.1 e 11.2
- **Entrega**: saudação por horário ("Bom dia/Boa tarde/Boa noite, [primeiro
  nome]"); linha de contexto com setor, unidade escrita como no cadastro e as
  contagens; link do tour à direita da saudação (destino em A6); quatro cartões
  soltos, sem título de seção, com ícone colorido, título e descrição; grade
  **"Pastas da unidade"** (D1: pastas de primeiro nível da própria unidade,
  cartão clicável abrindo a pasta — diferença do Anexo A aceita por escrito); "Documentos recentes" com as colunas
  pedidas (Tipo como etiqueta, Documento com código abaixo, Unidade, Revisão,
  Situação, Atualizado) em 5 linhas, com link para o histórico completo; coluna
  direita de 340 px com os espaços de "Leitura obrigatória" e "Avisos" — **o
  layout nesta fatia, as funções em C2**; marca d'água à direita (420 px, 6%,
  não clicável).
- **Depende de**: A1 (setor e função na saudação), A2 (chrome)
- **Contagem de novos (D1, resposta 3b)**: *"documentos novos nos últimos 7
  dias"*, apurada pelo relógio do Postgres — **sem** `last_login_at` e sem
  migração. A frase deixa de falar em "X unidades" (cada pessoa tem uma só); a
  redação exata da linha fica para a proposta, fiel ao que a tela mostra.
- **Risco**: a contagem de documentos novos não pode ampliar alcance — tem de
  passar pela mesma resolução de acesso da listagem, como já exige a capability
  `tela-inicial` ("a lista de recentes não amplia alcance").

### A4 — Favoritos  ✅ entregue

> Change `favoritos`. **Desvios do previsto aqui, decididos durante a
> especificação e a implementação:**
>
> - **A US entrou no Épico 2, não no 11** — como a A5, que foi para o Épico 4:
>   favoritos é navegação, não orientação da tela inicial. É a **US 2.5**, e a
>   linha correspondente saiu da lista de Fora de Escopo do PRD.
> - **Perder o acesso oculta, não apaga** (design.md D3): a lista parte da
>   marca e confirma cada item por `hasAccess`, e uma concessão vencida é
>   reversível. Ida para a lixeira também só oculta; o **expurgo** apaga as
>   marcas, em `lib/purge-file.ts` (arquivos) e `jobs/purge-trash.ts` (pastas),
>   junto com as concessões.
> - **Desmarcar não exige alcance** — quem perdeu o acesso pode limpar a
>   própria marca; marcar exige `view`, com 404 indistinguível.
> - **A indicação no explorador vem em `favoriteFolderIds`/`favoriteFileIds`**
>   da listagem de pasta, numa consulta à parte restrita aos ids já liberados,
>   e não como coluna nova em `fileSummaryColumns` (design.md D5) — aquele
>   fragmento é compartilhado com busca e recentes. Campos **opcionais** no
>   contrato, para uma API anterior não quebrar a SPA.
> - **Prefixo de topo novo `/favorites`** nas três listas, com caso próprio em
>   `web-serving.test.ts`.
>
> **Lacunas conhecidas, aceitas:**
>
> - Favoritar só no explorador e na própria lista — busca, recentes e
>   visualizador ficaram fora (Non-Goals).
> - Marcas ocultas por perda de acesso **contam no teto de 200**, e a pessoa
>   não as vê para desmarcar.
> - Sem paginação nem filtros na lista, como em Compartilhados.

- **Capabilities**: `favoritos` (nova), `web-navegacao` (modificada)
- **Demanda**: 1.1 (item de menu)
- **PRD**: US nova (Épico 11) — **reentrada de escopo**: favoritos foi excluído
  "por decisão do cliente" no change `shell-e-inicio`; o PRD precisa registrar a
  volta.
- **Entrega**: marcar/desmarcar arquivo ou pasta como favorito, destino de menu
  listando os favoritos vigentes. Tabela com `unit_id` + RLS; favorito **não é
  permissão** — perder acesso ao recurso o remove da lista, sem erro.
- **Depende de**: A2 (o item entra no menu)
- **Consome a forma fixada pela A5**: a listagem plana de recursos em
  profundidade arbitrária (localização = pasta-mãe, arquivo abre no
  visualizador, pasta abre no explorador, ações só dos verbos concedidos,
  perda de alcance remove sem erro) já está resolvida em
  `compartilhados-comigo`. Favoritos é a mesma tela sobre outro dado —
  inventar uma segunda forma é o que faria as duas divergirem.

### A5 — Compartilhados comigo  ✅ entregue

> Change `compartilhados-comigo`. **Desvios do previsto aqui, decididos durante
> a especificação e a implementação:**
>
> - **Não é reentrada de escopo.** Esta seção classificava a fatia como tal, por
>   analogia com Favoritos e Tour guiado. A lista de Fora de Escopo do PRD
>   exclui *compartilhamento entre unidades* e *notificação a cada
>   compartilhamento recebido* — **não** a listagem do que foi compartilhado
>   comigo. Entrou como **US 4.4, no Épico 4** (permissões granulares), e não no
>   Épico 11: o que a fatia entrega é a contrapartida da concessão granular, não
>   orientação da tela inicial.
> - **Os fragmentos de alcance de `lib/access.ts` não servem a esta tela**
>   (design.md D1) — e esta é a descoberta que mais moldou a change.
>   `resourceScopeClause` devolve **`TRUE`** para quem é administrador da
>   unidade da listagem, o que é correto para a listagem de pasta e
>   apresentaria **todo o acervo da unidade** ao `unit_admin` sob o título
>   "Compartilhados comigo". A lista parte da **concessão**; `hasAccess` depois
>   apenas confirma. O teste que fixa isso (admin com uma concessão recebida vê
>   um item, não o acervo) é o mais importante da fatia.
> - **As regras restritivas entram por `hasAccess`, não por cláusula SQL
>   reescrita** (design.md D2). O plano previa reusar `nonObsoleteClause` e
>   `visibleRegistrationClause` como fragmentos; o precedente de
>   `GET /files/recent` é mais forte — *"nenhuma segunda expressão da regra de
>   acesso"* —, e uma chamada por recurso basta, porque as regras restritivas
>   são propriedade do recurso, não do verbo.
> - **Nenhum prefixo de rota novo.** `GET /grants/received` vive sob `/grants`,
>   que já está nas três listas — o invariante 7 não foi tocado. Em compensação,
>   é a primeira rota de `/grants` aberta a `collaborator`, e por isso
>   `permissoes-granulares` passou a distinguir **administrar as concessões de
>   um recurso** de **ler as próprias**.
> - **O prazo acompanha o verbo, não o item** (design.md D5). Conceder vários
>   verbos numa operação dá a todos o mesmo prazo, mas reconceder um subconjunto
>   com prazo diferente é permitido, e um prazo "do item" teria de escolher
>   entre mentir e omitir.
> - **A localização é só a pasta-mãe** (design.md D7), pelo precedente de
>   `GET /files/recent`. Durante a conferência: `buildBreadcrumb`
>   (`routes/folders.ts:71`) **sobe os pais sem checar acesso em nenhum deles**,
>   de modo que a trilha do explorador nomeia pastas que a pessoa não alcança.
>   É **pré-existente** (alcançável hoje por quem digita o endereço) e não foi
>   ampliado aqui — a lista não acrescenta nome de ancestral nenhum. Fica como
>   fatia futura, não como passageira desta.
> - **Dois achados de passagem, corrigidos**: o enum de verbos estava escrito à
>   mão duas vezes em `lib/schemas.ts` e a terceira cópia entraria com esta
>   fatia (extraído para `permissionSchema`); e a ordem dos verbos na resposta
>   dependia da ordem das linhas de `grants`, indeterminada sem `ORDER BY` —
>   agora é a ordem canônica do enum.
>
> **A forma da listagem plana ficou fixada aqui, para a A4 consumir**: o que
> mostrar como localização, o que o clique faz em arquivo e em pasta, que ações
> oferecer (só as dos verbos que vieram) e o que acontece quando o alcance cai.
> Favoritos é a mesma forma sobre outro dado.
>
> **Lacuna conhecida, aceita**: a lista não tem paginação nem filtros. O tamanho
> é ditado pelo que a administração concedeu nominalmente, e ambos são aditivos.

- **Capabilities**: `compartilhados-comigo` (**nova**), `permissoes-granulares`
  (**modificada**), `web-shell-e-auth` (**modificada**)
- **Demanda**: 1.1 (item de menu)
- **PRD**: **US 4.4 nova, no Épico 4** — ver o desvio acima
- **Entrega**: destino listando os recursos sobre os quais a pessoa tem
  concessão vigente de outra pessoa (não os que ela mesma criou), um item por
  recurso com o conjunto dos verbos. Dado já existia: a tabela de concessões,
  com a vigência avaliada no SQL pelo relógio do Postgres. **Nenhuma migração.**
- **Depende de**: A2
- **Risco**: a listagem não pode revelar recurso excluído ou de outra unidade —
  *fail-closed* igual ao `access.ts`.

### A6 — Tour guiado  ✅ entregue

> Change `tour-guiado`. **Desvios do previsto aqui, decididos durante a
> especificação e a implementação:**
>
> - **Memória no servidor, não no navegador** (design.md D4):
>   `users.tour_completed_at` e `tourCompleted` na identidade, pela mesma
>   releitura por requisição. Nos hospitais o computador é compartilhado, e
>   `localStorage` lembraria a máquina. Conferido na app: fechado o tour num
>   navegador, o convite não apareceu no outro.
> - **O tour não começa sozinho** — a demanda pede convite, não interrupção —,
>   e **fechar no meio conta como feito** (D5).
> - **Pedido no endereço `/?tour=1`**, no idioma dos pedidos de envio e de nova
>   pasta: os dois acionadores levam ao Início, onde estão os alvos.
> - **"Só o que se vê" por presença do alvo** (D2): passos montados na hora de
>   começar, a partir de `data-tour`, omitindo o ausente. Medido: 9 passos em
>   1440 px com manual; 8 em 375 px (o passo do menu aponta o ☰ e o da ajuda
>   sai com o botão da barra).
> - **O grupo AJUDA ganhou um acesso interno** (D7): o requisito de navegação
>   foi reescrito para distinguir o manual (externo, anuncia a saída) do tour
>   (interno, fecha o painel sobreposto como um destino). Com o tour, o grupo
>   AJUDA nunca fica sem item.
> - **Nenhuma dependência nova**: `Tour` do Ant Design.
>
> **Lacunas conhecidas, aceitas:**
>
> - Tour só da tela Início — explorador, busca e administração não têm o seu.
> - Texto dos passos a confirmar na homologação.
> - Um passo cujo alvo mude de lugar numa fatia futura é omitido em silêncio;
>   o teste que monta os passos na forma larga é a rede.

- **Capabilities**: `tour-guiado` (nova)
- **Demanda**: 1.1 (AJUDA → Tour guiado), 1.3 ("Primeira vez aqui?")
- **PRD**: US nova (Épico 11) — **reentrada de escopo**.
- **Entrega**: tour de ~2 minutos pelas áreas da tela, acionável pelo menu e
  pelo link da saudação, com memória de "já fiz" por pessoa.
- **Depende de**: A2, A3 (os pontos que o tour aponta precisam existir)
- **Nota**: o tour só percorre o que a pessoa pode ver — passo apontando para
  item fora do perfil é bug de alcance, não de layout.

### A7 — Rótulo "Administrador da unidade"  ✅ entregue

> Change `rotulo-administrador-da-unidade`. **Desvios do previsto aqui:**
>
> - **`nomenclatura-interface` foi invertida, não acrescida**: o requisito
>   proibia o texto "Administrador da unidade" (decisão de 2026-10 do mesmo
>   cliente); agora o exige e **reserva "Gestor"** ao papel de acompanhamento,
>   sem uso até a C0.
> - **"da" e não "de" unidade** — a forma que o cliente escreveu (design.md D1).
> - **O cartão do usuário mudou de forma**: a linha "função · unidade" passou de
>   uma linha com reticências para até duas, porque o rótulo longo cortava o
>   nome da unidade (medido: 191 px de texto). Na tabela de colaboradores o
>   rótulo cabe inteiro.
> - **PRD**: a persona e as cinco US 10.x "Como Gestor" passaram a
>   "Administrador da unidade", para "Gestor" significar uma coisa só.
>
> **O que ficou com "Gestor", de propósito**: citações literais do cliente em
> comentários ("'Colaborador' ou 'Gestor' é coisa interna do sistema"), o
> histórico do rótulo em `role-label.ts`, nomes de fixture ("Fulana Gestora") e
> os cenários "a quem não é gestão" de `favoritos` e `compartilhados-comigo`
> (falam de gestão, não do rótulo).

- **Capabilities**: `nomenclatura-interface` (modificada), `web-shell-e-auth`
  e `web-pessoas` (conferidas — consomem o rótulo)
- **Demanda**: nenhuma seção — nasce da resposta 5 (a) de D3
- **PRD**: onde o PRD usar "Gestor" como nome de `unit_admin`, passa a
  "Administrador da unidade"
- **Entrega**: `ROLE_LABEL[UNIT_ADMIN]` (`apps/web/src/shell/role-label.ts`,
  origem única do rótulo) passa de "Gestor" a **"Administrador da unidade"**;
  as páginas do manual que nomeiam o papel (`index.md`, `a-tela.md`,
  `administrador/pessoas.md`) e os testes que fixam o texto acompanham. Só
  texto exibido: `unit_admin`, banco e contratos não mudam.
- **Depende de**: —
- **Por que antes do bloco C**: enquanto "Gestor" significar `unit_admin`, a
  C0 não tem como nomear o gestor de acompanhamento sem a colisão que
  `nomenclatura-interface` proíbe. Fatia pequena de propósito — trocar o
  rótulo no mesmo change que cria o papel novo misturaria uma renomeação
  global com uma regra de alcance.
- **Risco**: rótulo longo no cartão do usuário do menu (264 px) e na tabela de
  pessoas — medir no navegador, como na A2. E um "Gestor" esquecido em
  qualquer tela passa a mentir **depois** da C0; procurar a palavra no
  repositório inteiro (código, manual, PRD, specs), não só no mapa.

### B1 — Arquivo geral e pendente de cadastro  ✅ entregue

> Change `arquivo-geral-e-pendente-de-cadastro`. **Desvios do previsto aqui,
> decididos durante a especificação e a implementação:**
>
> - **`busca` e `gestao-arquivos` não foram modificadas.** Por precedente: a
>   regra do documento obsoleto declara a ocultação **uma vez**, em
>   `controle-documental`, cobrindo "listagem, busca e acesso direto". A
>   visibilidade do pendente segue a mesma forma — uma regra, quatro caminhos —
>   em vez de espalhar cláusulas por capability de consulta. `web-navegacao`
>   entrou (apresentação da etiqueta).
> - **O requisito antigo entrou sob REMOVED, não MODIFIED.** O cenário "Envio em
>   lote dispensa os dados" nomeia a dispensa; mantê-lo sob MODIFIED produziria
>   nome de cenário em contradição com o corpo. Mesmo tratamento que a change
>   `identidade-visual-isetes` deu ao caso equivalente, com Reason e Migration.
> - **O conjunto exigido foi de quatro para cinco campos** (entrou o
>   responsável, pela tabela 2.2 da demanda), o que altera também o **envio
>   unitário** já entregue.
> - **Duas migrações, não uma**: a `0019` precisou ampliar o `CHECK` de
>   `notifications.kind`, que recusava o valor novo — e recusava **em silêncio**,
>   porque a emissão do aviso é deliberadamente engolida para não impedir o
>   envio. Só o teste revelou.
> - **Defeito corrigido de passagem**: a fronteira Zod da SPA convertia toda
>   situação desconhecida em "Sem controle de revisão" (`.catch`), que não é
>   fallback neutro mas afirmação — uma SPA mais antiga que a API apresentaria
>   arquivo pendente como acervo em circulação.
> - **Lacuna conhecida**: a checagem de código duplicado **dentro do próprio
>   lote** foi implementada no servidor (sem ela a colisão abortaria a transação
>   e derrubaria o lote inteiro), mas a pré-checagem no cliente, que avisa antes
>   de enviar, continua sendo da B2.

- **Capabilities**: `controle-documental` (**modificada**), `envio-lote`
  (modificada), `notificacoes` (modificada), `web-navegacao` (modificada)
- **Demanda**: 2.3 e 2.4; a **Regra** no topo da seção 2
- **PRD**: **US 10.5 alterada** — ver risco abaixo
- **Entrega**:
  - **Tipo "Arquivo geral"** (2.4): nono valor do conjunto fechado de tipos
    (hoje são oito, sem ele). Pede só o título; não tem código, revisão nem
    situação; **não pode ser marcado como leitura obrigatória** (trava que C1
    precisa respeitar). Distinto de "sem dados preenchidos": é declaração
    deliberada de que o arquivo não é documento da Matriz.
  - **Estado "Pendente de cadastro"** (2.3): arquivo fica na pasta, **não
    aparece para leitores nem na busca**, visível só para quem enviou e para a
    Governança, etiquetado; quem enviou é avisado no sino até completar; ao
    completar, publica normalmente.
- **Depende de**: — (D4 só se a visibilidade da "Governança" exigir setor)
- **Risco (o maior do bloco)**: isto **reverte** comportamento já arquivado. A
  spec `controle-documental` tem hoje o cenário *"Envio em lote dispensa os
  dados"* e a US 10.5 cenário 2 diz que o lote "não exige os dados". A fatia tem
  de **alterar** requisito e US, não acrescentar ao lado — deixar os dois textos
  conviver é spec contraditória. O acervo anterior continua protegido pelo
  cenário 3 da US 10.5 ("acervo anterior não é invalidado"): arquivo antigo sem
  dados **não** vira "Pendente de cadastro" retroativamente.
- **Risco 2**: "não aparece na busca" é regra de alcance. Precisa de teste de
  isolamento próprio, no mesmo nível dos testes de obsoleto.

### B2 — Tabela de cadastro no envio em lote  ✅ entregue

> Change `tabela-de-cadastro-no-envio-em-lote`. **Desvios do previsto aqui,
> decididos durante a especificação e a implementação:**
>
> - **Dois defeitos vivos entraram no escopo**, não previstos nesta seção. A B1
>   levou o conjunto exigido de quatro para cinco campos no servidor, e o
>   formulário do **envio unitário** ficou em quatro: quem não preenchia o
>   responsável recebia a recusa do servidor em vez da validação local. E o tipo
>   **Arquivo geral** era inalcançável pela interface — o formulário exigia os
>   três campos que o servidor recusa para ele.
> - **A causa desses dois foi atacada, não só o sintoma** (design.md D9): o
>   conjunto exigido e a lista de campos recusados pelo Arquivo geral subiram
>   para `packages/shared`, e a API passou a lê-los de lá. Era uma constante
>   duplicada à mão nos dois lados; é isso que produz "servidor exige cinco,
>   tela exige quatro".
> - **O requisito do envio unitário entrou sob REMOVED + ADDED, não MODIFIED**,
>   pelo precedente que a B1 fixou: o cenário "Envio de vários arquivos não
>   apresenta o formulário" **nomeia** a dispensa que esta fatia extingue, e
>   mantê-lo sob MODIFIED produziria nome de cenário em contradição com o corpo.
> - **`envio-lote` foi modificada para declarar comportamento já implementado**:
>   a recusa por conflito de código **por item** — com o acervo e dentro do
>   próprio lote — e a retomada do código preso a envio pendente de quem pede
>   existiam desde a B1 e não estavam na spec. Nenhum código de servidor mudou
>   nesta fatia; entraram três casos de teste.
> - **A marca de sugestão é textual, não colorida.** O fundo âmbar funciona no
>   campo de código, mas o `Select` do tipo pinta o próprio fundo por cima — e
>   `controle-documental` já fixou que informação não depende de cor. Cada
>   célula sugerida carrega "sugerido pelo nome do arquivo" por escrito.
> - **Siglas do cliente ≠ siglas da interface** (design.md D4): o reconhecedor
>   aceita `POL/NOR`, `FOR/CHK`, `TC` e `CI` da tabela 2.2 **e** as da interface
>   (`POL`, `FRM`, `TCO`, `COM`), porque um reconhecedor com as da interface
>   falharia justamente nos nomes que o acervo do cliente traz.
> - **Lacunas conhecidas, aceitas:** (a) o cadastro digitado na tabela **não é
>   rascunho** — fechar a tela, cancelar, ou a pausa por falta de espaço no meio
>   do envio o perdem; persistir rascunho exigiria armazenamento e ciclo de vida
>   próprios; (b) **nenhuma pré-checagem do código contra o acervo** antes de
>   enviar — a guarda segue sendo o servidor, que recusa o item antes de
>   qualquer byte, e a linha recusada volta corrigível com o cadastro
>   preservado; (c) o botão de publicar nomeia os dois grupos ("Publicar
>   completos (N) e enviar M como pendente(s)"), mais longo que o "Publicar
>   completos" da demanda, porque o rótulo curto mentiria sobre o destino das
>   linhas incompletas.

- **Capabilities**: `web-upload` (modificada), `envio-lote` (modificada)
- **Demanda**: 2.1 (passo a passo) e 2.2 (campos)
- **PRD**: US 10.5 (na forma alterada por B1), US 3.1/3.2
- **Entrega**: ao selecionar ou arrastar vários arquivos (ou uma pasta), abre-se
  uma tabela com **uma linha por arquivo**; Título pré-preenchido com o nome do
  arquivo; sugestão de Tipo e Código quando o nome segue `SIGLA-AREA-Nº`; linha
  **"Aplicar a todos"** no topo preenchendo Tipo, Revisão, Responsável e Próxima
  revisão de uma vez, com cada linha ainda editável depois; indicador de
  completa/incompleta por linha; botão **"Publicar completos"**; incompletas
  salvas como Pendente de cadastro.
- **Depende de**: **B1** (o estado e o tipo precisam existir antes)
- **Risco**: a unicidade de código é por unidade e já está especificada
  (`controle-documental`: "Código do documento é único dentro da unidade"). A
  tabela precisa barrar duplicata **também dentro do próprio lote**, antes de
  enviar — dois arquivos do mesmo lote com o mesmo código não podem passar pela
  checagem individual e colidir no servidor.
- **Risco 2**: o envio em lote já tem teto de itens por requisição e reserva de
  cota consciente do lote (`envio-lote`). A tabela de cadastro não muda esses
  tetos — e a publicação parcial ("só os completos") tem de conviver com a
  reserva de cota sem vazar reserva dos itens não publicados.

### C0 — Gestor de acompanhamento no cadastro  ✅ entregue

> Change `gestor-de-acompanhamento`. **Desvios e decisões da implementação:**
>
> - **Uma coluna em `users`** (`reading_oversight`), não tabela de vínculos: um
>   alcance por pessoa basta (design.md D1). O terceiro alcance, **"todas as
>   unidades"**, entrou como previsto — atribuível, alterável e retirável só
>   pelo administrador global (D3).
> - **"do setor exige setor" mora no banco** (`CHECK`), porque também é violável
>   pela remoção do setor, não só pela marcação (D2). 409
>   `reading_oversight_requires_sector`, recusa total.
> - **Quem marcou e quando** (`reading_oversight_set_by`/`_at`) ficam no banco,
>   fora da resposta da API — são trilha (D5).
> - **Na identidade** (`readingOversight`), pela mesma releitura por requisição:
>   retirar vale na seguinte, testado (D6).
> - **`lib/access.ts` não mudou**: teste prova que um gestor de todas as
>   unidades continua recusado em arquivo alheio e na gestão de pessoas (D7).
> - O administrador da unidade **não edita a própria conta** (regra anterior a
>   esta fatia); a trava de auto-marcação vale, na prática, para o global.
> - Nasce o **Épico 12** no PRD, com a **US 12.1**.
>
> **Lacuna conhecida**: nada muda no que o gestor vê até a C3 (avisos) e a C4
> (acompanhamento); a tabela de colaboradores ganhou uma coluna e já rolava por
> dentro em 1440 px.

- **Capabilities**: `gestao-pessoas` (modificada), `web-pessoas` (modificada),
  `autenticacao` (modificada, se o alcance entrar na identidade)
- **Demanda**: 3.1 (perfil Gestor); respostas 3, 4 e 6 de D3; resposta 8 de D5
- **PRD**: Épico 12 — US de cadastro do gestor de acompanhamento
- **Entrega**: no cadastro de pessoa, a marcação **"acompanha as leituras"**
  com alcance **do setor** ou **da unidade inteira** (resposta 6a). Atributo
  da pessoa, **ortogonal ao papel de acesso**: não concede cadastrar pessoas
  nem liberar permissão (resposta 4b), e não dá acesso a arquivo nenhum.
  Proposta a validar no design: um terceiro alcance, **"todas as unidades"**,
  para a Governança de D5 — atribuível só por `global_admin`, concedido
  pessoa a pessoa e auditado.
- **Depende de**: **A7** (o nome "Gestor" precisa estar livre)
- **Regras a fixar na spec**: alcance "do setor" exige setor preenchido
  (sem setor a marcação é recusada, não vira "unidade" em silêncio); mudar o
  setor da pessoa muda a equipe que ela acompanha na requisição seguinte; o
  alcance é relido a cada requisição, como papel e status
  (`attachTenantContext`) — tirar a marcação corta a visão na hora.
- **Risco**: é a primeira vez que um atributo de pessoa amplia o que ela vê
  além do próprio acervo. O que a marcação libera é **só** a visão de
  acompanhamento da C4 e o aviso da C3 — escrever isso como limite na spec, e
  testar que a marcação não muda nenhuma resposta de `access.ts`.

### C1 — Núcleo da leitura obrigatória (marcar e dar ciência)  ✅ entregue

> Change `leitura-obrigatoria`. **Desvios e decisões da implementação:**
>
> - **Ser do público libera visualizar** (design.md D6) — a decisão de
>   segurança da fatia. Sem ela quase ninguém do público leria um documento
>   alheio. Ramo novo em `lib/access.ts`: só `view`, só arquivo, só a revisão
>   marcada e vigente, depois das subtrações (obsoleto, pendente) e com
>   comparação de unidade. Fora da listagem de pasta e da busca. **Aparece nos
>   Recentes e na contagem de novos** do leitor, que usam a mesma `hasAccess` —
>   aceito, e é por onde o leitor chega ao documento até a C2.
> - **Quem marca é quem edita os dados de controle** (`rename`, design.md D4),
>   não "quem tem envio na pasta": marcar é decidir sobre um documento.
> - **Só documento que abre no visualizador** (D11), descoberto na
>   implementação: o público não baixa, então formato sem pré-visualização
>   seria ilegível para ele. Recusa `not_previewable`.
> - **Tudo apurado na consulta** (D3): Pendente, Atrasada, Concluída, Encerrada
>   pelo relógio do Postgres; nova revisão e obsoleto encerram sem escrita.
> - **Público é critério** (D2): quem entra depois recebe a pendência, com 15
>   dias, **na primeira consulta às próprias leituras** — até a C3 reconciliar
>   diariamente.
> - **Prefixo de topo novo `/reading`**, nas três listas.
>
> **Lacunas conhecidas, aceitas:**
>
> - Não há ainda **tela de "minhas leituras"** — a API (`GET /reading/mine`)
>   existe; menu, abas, contador, cartão do Início e ícone na linha são da
>   **C2**. Até lá o leitor chega pelo visualizador a partir dos Recentes ou do
>   endereço.
> - **Marcar na etapa final do envio** fica para depois; a fatia cobre o
>   "depois, em Mais opções".
> - O aviso de "pedir nova ciência?" **no momento de substituir** o arquivo
>   também fica para a C2; hoje o pedido acontece ao reabrir a marcação, com o
>   público anterior preenchido.
> - O evento de carga do `iframe` não distingue documento carregado de página
>   de erro — limitação do navegador; o botão habilita nos dois casos.

- **Capabilities**: `leitura-obrigatoria` (nova), `controle-documental`
  (consumida), `auditoria` (consumida)
- **Demanda**: 3.1, 3.2 (etapas 1 e 3), 3.3, 3.4
- **PRD**: épico novo (**Épico 12**), com US para marcar e para dar ciência
- **Entrega**:
  - **Marcação** (etapa 1): na etapa final do envio ou depois, em "Mais opções";
    só documento **controlado e Vigente** (portanto nunca "Arquivo geral", trava
    de B1); público combinável (unidades, setores, perfis, pessoas), prazo com
    padrão de 15 dias, mensagem opcional; **prévia da contagem de pessoas antes
    de confirmar**. Só publicador com permissão de envio marca.
  - **Ciência** (etapa 3): botão no rodapé do visualizador, habilitado só depois
    que o documento abre; confirmação com a declaração nominal ("Declaro que li
    e compreendi o documento [código] - [título], Rev. [nº]"); **irreversível**;
    o item sai de Pendentes e vai para Concluídas.
  - **Registros** (3.4): marcação (documento, código, revisão, público, prazo,
    mensagem, quem marcou, data e hora) e ciência (usuário, unidade, setor,
    documento, código, revisão, data e hora).
  - **Regras** (3.3): ciência **vale por revisão**; nova revisão pergunta ao
    publicador se pede nova ciência, preservando o histórico; pendências de
    revisão que virou Obsoleto são encerradas automaticamente; pendências de
    pessoa desligada saem do cálculo de adesão.
- **Depende de**: **A7** (a tela não pode usar "Gestor" para dois papéis).
  D3, D4 e D5 estão respondidas.
- **Risco**: as duas tabelas novas precisam de `unit_id` + policy RLS. Público
  que atravessa unidades é a mesma questão de D1 — **a tenancy continua como
  está** (D1 respondida), então "unidades" no público significa **a unidade do
  documento**, e isso tem de estar escrito na spec, não implícito. Documento
  institucional lido por todas as unidades é **D7(ii)**, não esta fatia.
- **Risco 2**: "pessoa nova no público recebe a pendência com prazo de 15 dias a
  partir da entrada" (3.3) significa que o público é **resolvido na consulta**,
  não congelado na marcação. Decisão de design a fixar no `design.md`: público
  como critério (reavaliado) + pendências materializadas na primeira vez que a
  pessoa é alcançada.
- **Por que uma fatia só**: marcar sem dar ciência não entrega valor, e dar
  ciência sem marcar não existe. Separá-las produziria duas fatias
  inutilizáveis.

### C2 — Superfícies de pendência  ✅ entregue

> Change `superficies-de-pendencia` (PRD **US 12.4**). **Desvios e decisões da
> implementação:**
>
> - **Uma consulta só** (design.md D1): contador do menu, cartão do Início,
>   abas e rodapé do visualizador leem `GET /reading/mine`, já existente desde
>   a C1. Não há rota nova nem migração; confirmar ciência atualiza as quatro
>   superfícies de uma vez. Consequência aceita: a reconciliação de quem entra
>   depois no público (C1, D2) passa a rodar em toda tela autenticada, pelo
>   menu — idempotente e limitada à própria pessoa; a C3 vai tirar esse peso.
> - **Encerrada não aparece** em Pendentes nem em Concluídas (D2): não é
>   pendência nem ciência. O histórico delas é do acompanhamento (C4).
> - **"Atrasada" sinalizada em tom negativo** já nesta fatia, nas abas e no
>   cartão — é só apresentação da situação que a C1 apura. Da C3 restam o
>   **aviso** no sino ao leitor e ao gestor e a rotina diária.
> - **Ícone na linha** por coluna nova do resumo de arquivo (`requiredReading`,
>   D4): revisão atual marcada e não obsoleta, apurada na própria listagem; não
>   amplia alcance nem revela público ou prazo.
> - Destino da SPA em **`/leituras`** — não é prefixo de API, não entra nas
>   três listas.
> - O cartão do Início lista **3** pendências antes do "Ver todas" (a
>   confirmar na homologação).
>
> **Lacuna conhecida, aceita:** o aviso "pedir nova ciência?" **no momento de
> substituir** o arquivo, que a C1 tinha deixado para cá, **não entrou**: a SPA
> não tem tela de substituição de arquivo (só a API,
> `POST /files/:id/replace-url`). O pedido continua acontecendo ao reabrir a
> marcação, com o público anterior preenchido. Entra junto com a tela de
> substituir, quando ela existir.

- **Capabilities**: `leitura-obrigatoria` (modificada), `tela-inicial`
  (modificada), `web-shell-e-auth` (modificada), `web-navegacao` (modificada),
  `web-visualizacao` (modificada)
- **Demanda**: 3.2 (etapa 2), 3.5 (linhas Início, Menu, Documentos, Visualizador)
- **PRD**: Épico 12
- **Entrega**: contador no item **Leitura obrigatória** do menu; cartão na
  coluna direita da tela Início (documento, prazo e botão "Ler e confirmar
  ciência"), ocupando o espaço criado em A3; destino de menu com abas
  **Pendentes** e **Concluídas** para todos; ícone de leitura obrigatória na
  linha do arquivo em Documentos.
- **Depende de**: **C1** (não há pendência a mostrar antes), **A2** (item de
  menu e contador), **A3** (espaço da coluna direita)
- **Nota**: a aba **Acompanhamento** é de C4 — aqui entram só as duas abas de
  todo mundo.

### C3 — Avisos e atrasos  ✅ entregue

> Change `avisos-e-atrasos` (PRD **US 12.5**). **Desvios e decisões da
> implementação:**
>
> - **Três assuntos novos** no canal (design.md D1): `reading_assigned`,
>   `reading_overdue` e `reading_overdue_team`, cada um com o seu evento de
>   origem. O atraso é avisado **uma vez por leitura e prazo** — sem lembrete
>   diário; a situação Atrasada continua visível nas abas e no cartão.
> - **Nova leitura avisada onde nasce** (D2): na marcação, na consulta às
>   próprias leituras (quem entrou depois) e pela rotina, que também emite o
>   que tiver falhado. A falha ao avisar não desfaz a marcação.
> - **Aviso ao gestor agregado** por (gestor, marcação, prazo), com a contagem e
>   até 20 nomes e setores (D3), em vez de um aviso por pessoa atrasada.
> - **"Todas as unidades" não recebe atraso de outra unidade** (D3): aviso
>   nominal entre unidades é a exceção estreita da D5, que fica com o relatório
>   da C4. Na própria unidade, cobre a unidade inteira.
> - **Rotina `notify-readings` às 03:45** (D4): reconcilia o público de todas
>   as marcações em curso — a pendência de quem entra depois deixa de depender
>   de a pessoa abrir a aplicação — e emite os avisos. Script
>   `npm run notify:readings`; par job + agendador em `scheduler.tf`.
> - **Cartão "Avisos" do Início** deixou de ser reservado: lista os avisos de
>   leitura obrigatória (D5). O sino oferece "Abrir leituras" nos do leitor; o
>   do gestor ainda não tem destino (C4).
>
> **Lacunas conhecidas, aceitas:** o aviso ao gestor congela a lista no
> momento da emissão (quem confirma depois continua no texto); a primeira
> execução depois do deploy avisa, uma vez, todos os atrasos já existentes; o
> aviso ao gestor não leva a uma tela até a C4 existir.

- **Capabilities**: `leitura-obrigatoria` (modificada), `notificacoes`
  (modificada), `platform-infrastructure` (job + scheduler)
- **Demanda**: 3.2 (etapa 2, item 1; etapa 4, itens 1 e 2), 3.3
- **PRD**: Épico 12
- **Entrega**: notificação no sino ao surgir pendência; **"Atrasada" em
  vermelho** depois do prazo, com a pendência **continuando aberta** (o prazo não
  encerra nada); aviso de atraso ao leitor **e ao gestor dele** — quem tem a
  marcação da C0 cobrindo o setor ou a unidade do leitor (pode ser mais de
  uma pessoa).
- **Depende de**: **C0**, **C1**
- **Nota (pós-C2)**: a sinalização **"Atrasada"** nas abas e no cartão do Início
  já foi entregue pela C2; restaram aqui o aviso no sino e a rotina diária.
- **Risco**: a emissão é idempotente por `(recipientUserId, kind, sourceRef)` —
  a rotina de atraso roda todo dia e **não pode** reavisar a cada execução; o
  `sourceRef` tem de incluir a competência do aviso. O padrão já está resolvido
  em `notificacoes` ("reexecução no mesmo dia não duplica aviso").
- **Risco 2**: job novo exige script em `package.json` **e** par job+scheduler
  no Terraform (`infra/terraform/scheduler.tf`) — regra do `CLAUDE.md`. E a
  situação "Atrasada" é **apurada na consulta** pelo relógio do Postgres, nunca
  dependente do job ter rodado, como já se faz na situação do documento.

### C4 — Acompanhamento e relatório exportável  ✅ entregue

> Change `acompanhamento-de-leituras` (PRD **US 12.6**). **Com ela, todas as
> fatias da demanda nº 2 estão entregues no código.** Desvios e decisões:
>
> - **Recorte único em SQL** (design.md D1) para a lista e o relatório:
>   publicador (o que criou, público inteiro), gestor do setor (unidade própria,
>   só o setor), gestor da unidade (unidade própria, público inteiro) e todas as
>   unidades (tudo). Somam por união; o alcance é relido a cada requisição.
> - **A exceção da D5 num lugar só** (D3): `lib/reading-oversight.ts` é o único
>   ponto em que consulta de pessoa atravessa unidades, com o contexto de sistema
>   só no ramo `all_units`, colunas enumeradas e **nada de `files` na
>   resposta**. Teste próprio: a mesma pessoa continua recusada, de forma
>   indistinguível de inexistente, em `view-url`, `download-url`, auditoria e
>   estado de leitura do arquivo de outra unidade.
> - **D6 decidida**: exportação **no navegador** (`write-excel-file`, `jspdf` +
>   `jspdf-autotable`, carregados sob demanda), do que está filtrado na tela.
>   Nenhuma dependência nova no servidor.
> - **Filtros na tela**, sobre a lista já recortada pelo servidor (D5).
> - O aviso de **atraso da equipe** (C3) passou a levar ao relatório da marcação
>   (`/leituras?aba=acompanhamento&marcacao=<id>`).
>
> **Lacunas conhecidas, aceitas:** pessoa **desativada** some da lista nominal,
> não só do cálculo (a ciência dela continua no banco); o **administrador da
> unidade** não acompanha por ser administrador — acompanha o que marcou ou pela
> marcação da C0; gestor do setor não vê marcação sem ninguém do seu setor; não
> há relatório consolidado de várias marcações num arquivo só.

- **Capabilities**: `leitura-obrigatoria` (modificada)
- **Demanda**: 3.5 (linha Acompanhamento) e a nota de visibilidade
- **PRD**: Épico 12
- **Entrega**: aba **Acompanhamento** para publicador, gestores e Governança —
  por documento: total do público, confirmados, pendentes, atrasados e **% de
  adesão**; lista nominal com nome, unidade, setor, data e hora; filtros por
  unidade, setor e situação; exportação em **Excel e PDF**.
- **Depende de**: **C0** (quem é gestor e de quem; quem é Governança), **C1**,
  **D6** (formato de exportação). D5 está respondida: a visão da Governança é
  a exceção estreita descrita lá — leitura nominal, sem bytes, sem auditoria.
- **Risco**: é a fatia que mais pressiona o isolamento — lista **nominal** com
  unidade e setor. Três visões distintas (Governança / publicador / gestor) são
  três recortes de alcance, e cada um precisa de teste próprio. O cálculo de
  adesão exclui pessoa desligada (3.3).
- **Nota (pós-C3)**: o aviso de atraso ao gestor de **todas as unidades** ficou
  restrito à própria unidade dele (C3, design.md D3). Se o cliente quiser o
  aviso das outras unidades, ele entra aqui, sob a mesma exceção estreita da D5
  e com o mesmo teste de isolamento; o destino "Abrir acompanhamento" do aviso
  ao gestor também nasce aqui.

---

## Grafo de dependências

```
  A1 (função e setor) ──┐
                        ├──▶ A3 (conteúdo do Início) ──┐
  A2 (menu e topo) ─────┤                              │
       │                └──▶ A4 (favoritos)            │
       │                └──▶ A5 (compartilhados)       │
       │                                               │
       └──────────────────▶ A6 (tour) ◀────────────────┘

  B1 (arquivo geral + pendente) ──▶ B2 (tabela de cadastro no lote)

  A7 (rótulo "Administrador da unidade") ──┬──▶ C0 (gestor no cadastro)
                                           └──▶ C1 (marcar + ciência)

  C1 ──┬──▶ C2 (superfícies) ◀── A2, A3
       ├──▶ C3 (avisos e atrasos) ◀── C0
       └──▶ C4 (acompanhamento e relatório) ◀── C0
```

Blocos A, B e C são independentes; os laços entre eles são **C2 → A2/A3**
(a coluna direita e o item de menu têm de existir antes de receberem função) e
**A7 → C0/C1** (o nome "Gestor" tem de estar livre antes de ganhar o papel novo).

---

## Fora do código (rastreio da seção 5 da demanda)

| Ação | Responsável | Situação |
| :--- | :--- | :--- |
| Ajustar a tela Início (seção 1) | TI | fatias A1–A3 |
| Enviar prints de Documentos e Login | TI | E2 — pendente |
| Implementar envio em lote (seção 2) | TI | fatias B1–B2 |
| Informar prazo da leitura obrigatória (Fase 2) | TI | **estimado** em 2026-11-05: homologação até 27/11, produção na semana de 07/12 — ver D6 |
| Planejar acesso da Governança a documentos das unidades e "Documentos Institucionais" | TI + Governança | D7 — fora da demanda nº 2, change própria |
| Enviar logo branca e símbolo em PNG | Governança | E1 — pendente |
| Definir ambiente de homologação e contato de TI | TI + Governança | E3 — pendente |

---

## Invariantes que nenhuma fatia pode violar

Repetidos aqui porque este plano é lido fora de contexto, e todas as fatias
tocam em alcance de dados:

1. **Tabela nova com dado de unidade exige coluna `unit_id` e policy RLS.**
   Vale para setores (A1), favoritos (A4), marcação e ciência (C1).
2. **Isolamento por unidade é *fail-closed*** — recurso inexistente ou de outra
   unidade responde igual, sem distinguir os casos.
3. **O administrador global não é olho universal** sobre bytes, listagem de
   itens ou auditoria de outra unidade. D1 foi respondida sem abrir a trava;
   D5 abre **uma** exceção estreita (situação nominal de leitura, na C4), que
   tem de estar registrada no `design.md` da C4. D7 é pedido para abrir a trava
   sobre conteúdo — nenhuma fatia desta demanda o faz.
4. **Vigência e situação são apuradas no relógio do Postgres, na consulta** —
   nunca dependentes de rotina ter rodado. Vale para o prazo de leitura (C3).
5. **Bytes nunca passam pela API** — o visualizador de C1 usa a URL assinada que
   já existe; "confirmar ciência" não é motivo para servir conteúdo pela
   aplicação.
6. **A API não monta artefato de download** — o `.zip` de pasta é montado no
   cliente, e a exportação de C4 segue o mesmo princípio (ver D6).
7. **Prefixo de rota de topo novo entra em três listas** —
   `apps/api/src/lib/api-prefixes.ts`, `apps/web/vite.config.ts` e
   `infra/terraform/locals.tf`.
8. **Documentação na mesma entrega** — tela visível ajusta a página
   correspondente de `docs/manual/`, com fidelidade ao que foi efetivamente
   entregue.
