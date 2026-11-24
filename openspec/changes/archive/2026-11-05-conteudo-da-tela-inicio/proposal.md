# Proposal

## Why

A seção 1.3 de `docs/demanda_cliente_2.md` redesenha o conteúdo da tela Início
item a item (saudação, linha abaixo dela, atalhos, grade, recentes, coluna
direita, marca d'água). É a fatia **A3** do plano em
`docs/plano_demanda_cliente_2.md`, que estava travada por **D1** — a grade
"Minhas unidades" pressupunha acesso a várias unidades, e o sistema isola cada
pessoa numa só.

O cliente respondeu D1 em 2026-11-05
(`docs/respostas_d1_d3_d5_decisoes_estruturais.txt`): **(1a)** ninguém
trabalha em mais de uma unidade — a grade lista as pastas da unidade com o
título **"Pastas da unidade"**, e a diferença em relação ao Anexo A foi
**aceita por escrito**; **(3b)** a frase conta **"documentos novos nos últimos
7 dias"**, sem registrar último acesso; **(4a)** o cartão abre a pasta. A A1
(função e setor) e a A2 (menu e barra) já estão entregues. Nada mais trava a
fatia.

## What Changes

- **Saudação por horário** — "Bom dia / Boa tarde / Boa noite, [primeiro
  nome]", pelo relógio de quem vê a tela. Sem nome cadastrado, a saudação do
  horário sozinha ("Bom dia!").
- **Contagem de documentos novos** na linha abaixo da saudação, depois de
  função · setor · unidade: quantos documentos **ao alcance da pessoa** foram
  publicados nos últimos 7 dias. Rota nova `GET /files/recent/new-count`, sob o
  prefixo `/files` que já existe — nenhum prefixo de topo novo. A contagem
  passa pela mesma resolução de acesso da lista de recentes (`hasAccess`,
  verbo `view`), e **não amplia alcance**. Acima do teto de apuração, a tela
  diz "pelo menos N".
- **Quatro atalhos soltos**, sem título de seção, com ícone colorido, título e
  descrição: **Enviar documento**, **Nova pasta**, **Buscar documento** e
  **Manual do usuário**. Os atalhos de administração (Colaboradores, Painel,
  Unidades) e os de Documentos e Lixeira saem da tela — continuam no menu, que
  é onde a demanda os põe.
  - **Nova pasta** conduz ao explorador na raiz com um **pedido de nova pasta**
    no endereço, no mesmo idioma do pedido de envio; o explorador abre o
    formulário de nova pasta uma única vez.
  - **Buscar documento** conduz à tela de busca com o campo de termo já
    focado.
  - **Manual do usuário** abre o manual em nova aba, e só aparece quando a
    implantação tem manual configurado — como no menu.
- **"Pastas da unidade"** no lugar de "Suas pastas": grade de 3 colunas,
  cartão clicável, link **"Ver todas as pastas"** à direita.
- **"Documentos recentes"** no lugar de "Alterados recentemente": colunas
  **Tipo** (etiqueta), **Documento** (nome com o código abaixo), **Unidade**,
  **Revisão**, **Situação** e **Atualizado**; **5 linhas** na tela Início;
  link **"Ver histórico completo"** para o destino Recentes, que usa a mesma
  tabela com o recorte inteiro do servidor.
- **Coluna direita de 340 px** com os cartões **"Leitura obrigatória"** e
  **"Avisos"** — o **espaço** nesta fatia, como pede a demanda ("as funções são
  da Fase 2"); o conteúdo vem na C2. Cada cartão diz, por escrito, o que vai
  aparecer ali. Abaixo do limiar da forma larga, a coluna desce para depois
  do conteúdo principal.

### Fora desta fatia, de propósito

- **Link do tour** ("Primeira vez aqui? Faça o tour de 2 minutos") — o
  destino é a A6. `tela-inicial` normatiza que atalho apresentado conduz a uma
  ação executável; o link entra junto com o tour.
- **Marca d'água do símbolo** (420 px, 6%) — depende de **E1**: o ativo atual
  é JPEG opaco, e a 6% apresentaria um retângulo cinza. Mesmo motivo pelo qual
  a A2 deixou a marca d'água do menu de fora.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `tela-inicial` — saudação por horário, contagem de novos, conjunto fixo de
  quatro atalhos, títulos e colunas novos, coluna direita.
- `web-navegacao` — o explorador atende ao **pedido de nova pasta** recebido
  no endereço.
- `web-busca` — a tela de busca recebe quem chega sem termo com o campo de
  termo focado.

## Impact

- **API**: `apps/api/src/routes/recent.ts` (rota de contagem),
  `apps/api/src/config.ts` (janela de 7 dias configurável), testes em
  `recentes.test.ts`.
- **Shared**: DTO da contagem em `packages/shared/src/recent.ts`.
- **Web**: `inicio/` (tela, atalhos, tabela, consulta), `shell/identidade.ts`
  (saudação por horário), `navegacao/ExplorerPage.tsx` e o módulo do pedido,
  `busca/BuscaPage.tsx`, nome acessível do manual extraído do `AppShell`.
- **Documentação**: `docs/manual/docs/a-tela.md` e a tabela de tarefas
  rápidas; US 11.1 e 11.2 em `docs/prd_final.md`; status da A3 no plano.
- **Sem migração**, sem prefixo de rota de topo novo, sem job.
