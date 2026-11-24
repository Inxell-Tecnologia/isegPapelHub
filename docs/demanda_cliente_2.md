# PapelHub - Ajustes da Fase 1, envio em lote e leitura obrigatória

1. Ajustar a tela Início conforme a seção 1 (itens da Fase 1).
2. Implementar o envio de vários arquivos conforme a seção 2.
3. Implementar a leitura obrigatória conforme a seção 3 (Fase 2).
4. Enviar prints das telas de Documentos e de acesso para homologação.

## 1. Ajustes na tela Início

A entrega avançou no menu em degradê, no item ativo em verde, nas fontes e na busca no topo. Os pontos abaixo ainda precisam ser ajustados para a Fase 1 ser aceita.

### 1.1 Menu lateral

| Elemento | Como está hoje | Como deve ficar |
| :--- | :--- | :--- |
| Logo | Miniatura ilegível | Logo ISETES branca, 150 px de largura, com "PapelHub" e "Gestão de Documentos" abaixo |
| Itens | Início, Documentos, Recentes, Lixeira, Manual | Rótulo NAVEGAÇÃO: Início, Documentos, Recentes, Favoritos, Compartilhados comigo, Leitura obrigatória (com contador), Lixeira.<br>Rótulo AJUDA: Manual do usuário, Tour guiado |
| Espaçamento | Itens muito espaçados | Itens compactos, com área de clique de 44 px de altura |
| Largura | "Manual do usuá..." cortado | Menu com 264 px; nenhum texto cortado |
| Rodapé | Só o botão de recolher | Cartão do usuário (iniciais, nome, perfil, unidade) + botão Sair. O botão de recolher pode ficar |
| Marca d'água | Não existe | Símbolo ISETES no pé do menu, 200 px, opacidade 14% |

### 1.2 Barra superior

| Elemento | Como está hoje | Como deve ficar |
| :--- | :--- | :--- |
| Busca | À direita, com botão verde separado | À esquerda, 600 px, lupa dentro do campo. Texto: "Buscar por nome, código (ex.: PRT-NSP-001) ou palavra-chave" |
| Botão de envio | Não existe | Botão verde "Enviar documento" (#067A52), para perfis com permissão de envio |
| Notificações | Sino sem contador | Sino com contador de não lidas |
| Ajuda | Não existe | Botão de Ajuda (ícone circle-help) |
| Usuário | Avatar cinza e nome no topo | Sai do topo e vai para o rodapé do menu. Avatar em azul céu (#9ED8F6) |

### 1.3 Conteúdo da tela

| Elemento | Como está hoje | Como deve ficar |
| :--- | :--- | :--- |
| Saudação | "Olá, Mariana Mendonça!" | "Bom dia / Boa tarde / Boa noite, [primeiro nome]", conforme o horário |
| Linha abaixo | "Colaborador. SEDE" | Setor unidade - "você tem acesso a X unidades e Y documentos novos desde o último acesso". Unidade escrita como no cadastro (ex.: Sede ISETES) |
| Tour | Não existe | À direita da saudação: "Primeira vez aqui? Faça o tour de 2 minutos" |
| Atalhos | Quadro "O que você pode fazer" com 3 itens só de texto | 4 cartões soltos, sem título de seção, cada um com icone colorido, título e descrição: Enviar documento, Nova pasta, Buscar documento, Manual do usuário |
| Unidades | "Suas pastas" (GERAL, GOVERNANÇA) | Título "Minhas unidades". Grade de 3 colunas com as unidades liberadas ao perfil (ícone, nome e local). Cada cartão abre a pasta raiz da unidade. Link "Ver todas as pastas" à direita |
| Recentes | "Alterados recentemente": Documento, Pasta, Situação, Alterado em | Título "Documentos recentes", link "Ver histórico completo". Colunas: Tipo (etiqueta colorida), Documento (nome + código abaixo), Unidade, Revisão, Situação, Atualizado. 5 linhas |
| Coluna direita | Não existe | Coluna de 340 px com os cartões "Leitura obrigatória" e "Avisos". As funções são da Fase 2, mas o espaço já deve existir no layout |
| Marca d'água | Não existe | Símbolo ISETES à direita do conteúdo, 420 px, opacidade 6%, não clicável |

**Atenção**
* **Perfil:** para a gerente de Governança aparece "Colaborador". Verificar se o perfil está sendo lido corretamente do cadastro.
* **Cores:** conferir no inspetor do navegador os códigos da seção 5 do projeto (botões #067A52, links #025484, fundo #F3F7F9).
* **Arquivos:** a Governança envia a logo branca e o símbolo em PNG transparente.

## 2. Envio de vários arquivos

**Regra**
Nenhum documento é publicado sem os dados obrigatórios, seja enviado sozinho ou em lote. Cada arquivo tem os seus próprios dados.
A solução atual (não pedir dados quando são vários arquivos) deixa publicar documentos sem tipo, código e revisão. O correto é manter o envio em lote, com cadastro por arquivo.

### 2.1 Passo a passo

1. O usuário seleciona ou arrasta vários arquivos (ou uma pasta).
2. O sistema abre uma tabela de cadastro com uma linha por arquivo.
3. O Título vem preenchido com o nome do arquivo.
4. Se o nome seguir o padrão SIGLA-AREA-Nº (ex.: PRT-NSP-001_Identificacao.pdf), o sistema sugere o Tipo e o Código.
5. No topo da tabela, a linha "Aplicar a todos" preenche de uma vez Tipo, Revisão, Responsável e Próxima revisão. Cada linha pode ser alterada depois.
6. Cada linha mostra se está completa (ícone verde) ou incompleta (ícone amarelo).
7. O botão "Publicar completos" publica só as linhas completas.
8. As linhas incompletas são salvas como Pendente de cadastro.

### 2.2 Campos da tabela de cadastro

| Campo | Obrigatório | "Aplicar a todos" | Observação |
| :--- | :--- | :--- | :--- |
| Tipo | Sim | Sim | PRT, POP, POL/NOR, FOR/CHK, FLX, MAN, TC, CI ou Arquivo geral |
| Código | Sim | Não | Individual. Não pode repetir código + revisão já publicados |
| Título | Sim | Não | Vem do nome do arquivo; editável |
| Revisão | Sim | Sim | Rev. 00, Rev. 01... |
| Responsável | Sim | Sim | Área ou pessoa responsável |
| Próxima revisão | Sim | Sim | Data; usada para calcular a situação |

### 2.3 Pendente de cadastro

* Fica na pasta, mas não aparece para os leitores nem na busca.
* Aparece só para quem enviou e para a Governança, com a etiqueta "Pendente de cadastro".
* Quem enviou recebe aviso no sino até completar os dados.
* Ao completar os dados, o arquivo pode ser publicado normalmente.

### 2.4 Arquivo geral (não controlado)

Para arquivos que não são documentos da Matriz (atas, planilhas de trabalho, apresentações), criar no campo Tipo a opção "Arquivo geral".
* Pede só o Título.
* Não tem código, revisão nem situação (Vigente, A vencer etc.).
* Não pode ser marcado como leitura obrigatória.

## 3. Leitura obrigatória

**Objetivo**
Garantir que as pessoas certas leiam a revisão vigente de um documento dentro do prazo, com registro de quem leu, quando e qual revisão.

### 3.1 Quem faz o quê

| Quem | Perfil | O que faz |
| :--- | :--- | :--- |
| Publicador | Governança e gestores com permissão de envio | Marca o documento como leitura obrigatória, define o público e o prazo |
| Leitor | Colaboradores incluídos no público | Lê o documento e confirma a ciência |
| Gestor | Diretor, gerente ou coordenador da unidade ou setor | Acompanha as pendências da própria equipe |
| Governança | Gerência de Governança (Sede) | Acompanha todas as leituras e emite o relatório |

Colaborador sem permissão de envio não marca leitura obrigatória.

### 3.2 Fluxo

**Etapa 1 - Marcar (publicador)**
1. Na etapa final do envio, ou depois, em "Mais opções > Leitura obrigatória" no arquivo.
2. Só documento controlado e com situação Vigente.
3. Preenche: público (unidades, setores, perfis ou pessoas, combináveis), prazo (padrão 15 dias) e mensagem opcional.
4. Antes de confirmar, o sistema mostra quantas pessoas serão incluídas.

**Etapa 2 - Avisar (sistema)**
1. Notificação no sino.
2. Contador no item "Leitura obrigatória" do menu.
3. Cartão "Leitura obrigatória" na coluna direita da tela Início, com documento, prazo e botão "Ler e confirmar ciência".

**Etapa 3 - Ler e confirmar (leitor)**
1. Clica em "Ler e confirmar ciência" e o documento abre no visualizador.
2. O botão "Confirmar ciência" fica no rodapé do visualizador e só é habilitado depois que o documento abre.
3. Ao clicar, aparece: "Declaro que li e compreendi o documento [código] - [título], Rev. [nº]." + botões Confirmar / Cancelar.
4. O sistema grava os dados da ciência (item 3.4). A confirmação não pode ser desfeita.
5. O documento sai de "Pendentes" e vai para "Concluídas".

**Etapa 4 - Acompanhar (gestor e Governança)**
1. Passado o prazo sem confirmação, a pendência continua aberta e aparece como "Atrasada", em vermelho.
2. O leitor e o gestor dele recebem aviso de atraso.
3. A Governança consulta e exporta o relatório (item 3.5).

### 3.3 Regras

| Situação | Regra |
| :--- | :--- |
| Pessoa nova no público | Quem entra depois da marcação (admissão ou troca de setor) recebe a pendência com prazo de 15 dias a partir da entrada |
| Nova revisão | A ciência vale por revisão. Ao publicar nova revisão, o publicador escolhe se pede nova ciência ao mesmo público. As ciências anteriores ficam no histórico |
| Documento obsoleto | Pendências abertas de uma revisão que virou Obsoleto são encerradas automaticamente |
| Desligamento | Pendências de usuário desligado saem do cálculo de adesão |

### 3.4 Dados a gravar

| Registro | Campos |
| :--- | :--- |
| Marcação (por documento) | Documento, código, revisão, público, prazo, mensagem, quem marcou, data e hora da marcação |
| Ciência (por usuário) | Usuário, unidade, setor, documento, código, revisão, data e hora da confirmação |

### 3.5 Telas e relatório

| Tela | O que mostra |
| :--- | :--- |
| Início | Cartão "Leitura obrigatória" com pendentes e prazo |
| Menu Leitura obrigatória | Abas "Pendentes" e "Concluídas" para todos. Aba "Acompanhamento" para publicador, gestores e Governança |
| Documentos | Ícone de leitura obrigatória na linha do arquivo |
| Visualizador | Botão "Confirmar ciência" no rodapé |
| Sino | Avisos de nova pendência e de atraso |
| Acompanhamento (relatório) | Por documento: total do público, confirmados, pendentes, atrasados e % de adesão. Lista nominal com nome, unidade, setor, data e hora. Filtros por unidade, setor e situação. Exportação em Excel e PDF |

*Visibilidade do relatório: a Governança vê todos os documentos; o publicador vê os que marcou; o gestor vê só a própria equipe.*

## 4. Critérios de aceite

**Tela Início (Fase 1)**
* Layout igual ao Anexo A: menu, barra superior, saudação, atalhos, Minhas unidades, Documentos recentes e coluna direita.
* Logo branca legível e marcas d'água aplicadas.
* Cores conferidas no inspetor e fontes Lexend e Source Sans 3 carregando.
* Perfil, setor e unidade corretos, testados com 3 perfis (Sede-gestão, unidade-gestão, colaborador de unidade).

**Envio de vários arquivos**
* Nenhum arquivo é publicado sem os campos obrigatórios.
* "Aplicar a todos" funciona e cada linha continua editável.
* Código duplicado é bloqueado.
* Incompletos ficam como "Pendente de cadastro", visíveis só para quem enviou e para a Governança.

**Leitura obrigatória**
* Só publicador com permissão marca, e só documento Vigente.

## 5. Próximos passos

| Ação | Responsável | Prazo |
| :--- | :--- | :--- |
| Ajustar a tela Início (seção 1) | TI | |
| Enviar prints de Documentos e Login | TI | |
| Implementar envio em lote (seção 2) | TI | |
| Informar prazo da leitura obrigatória (Fase 2) | TI | |
| Enviar logo branca e símbolo em PNG | Governança | |
| Definir ambiente de homologação e contato da Ti para a tela de acesso | Ti e Governança | |