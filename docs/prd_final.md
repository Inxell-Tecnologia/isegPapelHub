# Product Requirements Document (PRD) — GDoc (Gestão Documental Segura)

## 1. Visão Geral e Problema

A organização do cliente é composta por múltiplas unidades e precisa centralizar o armazenamento de arquivos num único repositório em nuvem, porém sem abrir mão do **controle e da rastreabilidade do acesso à informação**. Hoje o desafio não é apenas "guardar arquivos", mas garantir governança: assegurar que cada pessoa só visualize, baixe, altere ou exclua exatamente aquilo que lhe foi autorizado, impedir vazamento por acesso indevido (inclusive por link direto), manter um histórico confiável de quem acessou cada arquivo e oferecer aos gestores visibilidade sobre o uso do espaço.

O **objetivo principal** do GDoc é entregar um repositório de arquivos corporativo, com aparência limpa e premium, cujo núcleo de valor é um motor de permissões granular e auditável, com isolamento entre unidades, lixeira com retenção e um painel gerencial de uso.

## 2. Personas

* **Administrador Global:** responsável pela plataforma como um todo. Enxerga todas as unidades e todos os arquivos, cadastra e desativa pessoas, define administradores de unidade, configura permissões e consome os registros de auditoria e o painel gerencial. Sua dor é a falta de controle centralizado e de comprovação de quem acessou o quê.
* **Administrador de Unidade** (apresentado na interface como **Administrador da unidade**; até a demanda nº 2 era **Gestor** — palavra agora reservada a quem acompanha as leituras da equipe, resposta 5a de `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`)**:** gerencia apenas a sua própria unidade — as pessoas, as pastas e as permissões daquela unidade. Não enxerga o conteúdo das demais unidades, salvo o que a SEDE ou outra unidade compartilhar com a sua (US 5.2). Sua dor é depender de uma área central para tarefas cotidianas de liberação de acesso do seu time.
* **Colaborador (Usuário Comum):** envia e consome arquivos no dia a dia. Só enxerga os arquivos e pastas que criou ou para os quais recebeu permissão explícita. Quando envia um arquivo, torna-se o dono dele e pode consultar quem o acessou. Sua dor é encontrar rapidamente o material certo e ter certeza de que documentos sensíveis não estão expostos a quem não deveria vê-los.

## 3. Escopo do MVP

* **Dentro do Escopo:**
  * Login por usuário e senha, com contas criadas exclusivamente pela área administrativa.
  * Área "Minha conta", com consulta aos próprios dados cadastrais e alteração da própria senha; redefinição administrativa de senha para quem esquecer a sua.
  * Cadastro de pessoas com os dados: nome, unidade, telefone, e-mail, função/cargo, setor e observação.
  * Isolamento por unidade: cada unidade só enxerga os próprios arquivos; existe o papel de administrador de unidade.
  * Compartilhamento somente leitura (visualizar e baixar) de pastas e documentos entre a unidade marcada como SEDE e as demais unidades, nos dois sentidos, sempre com a SEDE numa das pontas (US 5.2).
  * Navegador de arquivos com pastas aninhadas, trilha de navegação (breadcrumb), envio, download e visualização.
  * Envio de múltiplos arquivos de uma vez com progresso individual; envio de uma pasta inteira preservando a estrutura; download de uma pasta completa (com suas subpastas) num único arquivo compactado.
  * Permissões granulares (visualizar, baixar, enviar, renomear/substituir, excluir) atribuídas por pasta ou por arquivos selecionados, sem herança automática para o conteúdo interno, com prazo de expiração opcional.
  * Controle de acesso ativo: colaboradores só veem o que criaram ou o que lhes foi liberado; administradores enxergam conforme seu alcance (global ou de unidade). Bloqueio de acesso a um arquivo por link direto quando não há permissão.
  * Avisos relacionados à expiração de permissão: alerta à pessoa antes do vencimento e aviso à área administrativa no momento do corte de acesso.
  * Registro de auditoria de visualização e download (quem, qual arquivo, data e hora), consultável pela área administrativa e pelo dono do arquivo sobre seus próprios arquivos.
  * Lixeira: itens excluídos são retidos por até 30 dias, podem ser restaurados nesse período e são apagados de forma permanente e automática após o vencimento, por uma rotina diária executada às 3h.
  * Cota de armazenamento de 10 GB por pessoa como **padrão**, com bloqueio de novos envios ao atingir o limite; o Administrador Global pode conceder cota individual distinta a uma pessoa (ver adendo da US 8.1).
  * Painel (dashboard) com cartões de estatísticas principais e gráficos de quantidade de arquivos por tipo, envios por mês e espaço utilizado versus disponível, acessível pelo menu lateral.
  * Busca por nome e filtros por data, tipo de arquivo (imagens, vídeos, áudios, PDFs, entre outros) e autor na página de arquivos, com botão para limpar filtros.
  * Visualização, sem necessidade de baixar, de PDFs, imagens, vídeos, áudios, arquivos de texto e documentos de escritório (Word, Excel, PowerPoint).
  * Controle documental: cada documento pode carregar tipo (com sigla e cor), código único por unidade, revisão, setor responsável e data de próxima revisão; a situação (Vigente, A vencer, Em revisão, Revisão vencida, Obsoleto ou Sem controle de revisão) é apurada pelo relógio do servidor no momento da consulta. Os dados de controle são exigidos no envio de um documento e dispensados no envio em lote ou de pasta. Substituir o arquivo avança a revisão. Documentos marcados como obsoletos deixam de ser apresentados a Colaboradores.
  * Tela inicial orientada ao trabalho: identificação da pessoa, atalhos conforme o perfil, acesso rápido às pastas de primeiro nível permitidas e lista dos documentos alterados recentemente, sempre limitada ao que a pessoa pode acessar e à sua unidade.

* **Fora de Escopo (nesta versão):**
  * Login por conta Google ou integração com o login corporativo existente (o MVP usa usuário e senha próprios).
  * Autocadastro de pessoas ou convite por e-mail (contas são criadas apenas pela administração).
  * Recuperação de senha por e-mail ("esqueci minha senha" com link enviado à pessoa) — o MVP não envia e-mails, e por isso o esquecimento é resolvido por redefinição administrativa.
  * Edição do conteúdo dos documentos por dentro do sistema (a permissão de "editar" cobre apenas renomear e substituir o arquivo por uma nova versão).
  * Histórico de versões navegável de um arquivo (substituir troca o arquivo vigente; versões anteriores não ficam disponíveis para consulta).
  * Compartilhamento entre duas unidades que não sejam a SEDE, e qualquer ação de escrita (enviar, renomear/substituir, excluir) sobre conteúdo de outra unidade.
  * Notificações fora do contexto de expiração de permissão (ex.: aviso a cada novo compartilhamento recebido).
  * Leitura obrigatória com registro de ciência (confirmação datada de que a pessoa leu um documento).
  * Busca pelo conteúdo interno dos arquivos (a busca alcança nome e código do documento, não o texto dentro do PDF ou do documento de escritório).

## 4. Histórias de Usuário e Critérios de Aceitação

### Épico 1: Acesso e Gestão de Pessoas

* **US 1.1:** Como Administrador, eu quero cadastrar uma pessoa com seus dados e sua unidade para que ela possa acessar o sistema.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Cadastro válido:*
      * **Dado** que sou um administrador autenticado
      * **Quando** cadastro uma pessoa informando nome, unidade, telefone, e-mail, função/cargo, setor (escolhido entre os setores daquela unidade, ou nenhum) e observação, com um e-mail ainda não utilizado
      * **Então** a conta é criada, vinculada à unidade informada e ao setor escolhido, e a pessoa passa a poder fazer login com as credenciais definidas.
    * *Cenário 2 — E-mail duplicado:*
      * **Dado** que já existe uma conta com o e-mail informado
      * **Quando** tento cadastrar outra pessoa com o mesmo e-mail
      * **Então** o cadastro é recusado e o sistema exibe uma mensagem indicando que o e-mail já está em uso.
    * *Cenário 3 — Setor de outra unidade:*
      * **Dado** que sou um administrador autenticado
      * **Quando** tento cadastrar ou editar uma pessoa informando um setor que pertence a outra unidade
      * **Então** a operação é recusada por completo, sem aplicar nenhum dos demais campos enviados, e a recusa não distingue esse caso de um setor inexistente.

* **US 1.2:** Como Colaborador, eu quero entrar no sistema com usuário e senha para que apenas eu acesse minha área.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Login válido:*
      * **Dado** que possuo uma conta ativa
      * **Quando** informo usuário e senha corretos
      * **Então** sou autenticado e direcionado ao navegador de arquivos com o conteúdo que me é permitido.
    * *Cenário 2 — Credenciais inválidas:*
      * **Dado** que estou na tela de login
      * **Quando** informo uma senha incorreta
      * **Então** o acesso é negado, sem revelar se o problema foi o usuário ou a senha, e permaneço na tela de login.
    * *Cenário 3 — Conta desativada:*
      * **Dado** que minha conta foi desativada pela administração
      * **Quando** tento fazer login com credenciais corretas
      * **Então** o acesso é negado com aviso de conta indisponível.

* **US 1.3:** Como Colaborador, eu quero alterar minha própria senha em "Minha conta" para que apenas eu conheça a credencial de acesso à minha área.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Troca válida:*
      * **Dado** que estou autenticado e acesso "Minha conta"
      * **Quando** informo minha senha atual e uma nova senha válida
      * **Então** a senha é alterada, continuo autenticado nesta sessão e passo a entrar com a nova senha nos próximos acessos.
    * *Cenário 2 — Senha atual incorreta:*
      * **Dado** que estou na tela de alteração de senha
      * **Quando** informo uma senha atual que não confere
      * **Então** a alteração é recusada com aviso de que a senha atual está incorreta e a senha vigente permanece inalterada.
    * *Cenário 3 — Nova senha fora da política:*
      * **Dado** que estou na tela de alteração de senha
      * **Quando** informo uma nova senha que não atende ao tamanho mínimo exigido
      * **Então** a alteração é recusada com aviso do requisito não atendido, antes de qualquer mudança.
    * *Cenário 4 — Acessos anteriores encerrados:*
      * **Dado** que eu havia entrado no sistema em outro dispositivo ou navegador
      * **Quando** altero minha senha
      * **Então** aqueles acessos são encerrados e passam a exigir novo login, sem depender de eu sair manualmente em cada um deles.
    * *Cenário 5 — Meus dados são apenas consultados:*
      * **Dado** que acesso "Minha conta"
      * **Quando** visualizo meus dados cadastrais (nome, e-mail, unidade e papel)
      * **Então** eles são exibidos apenas para consulta, pois sua alteração continua sendo atribuição da área administrativa.

* **US 1.4:** Como Administrador de Unidade, eu quero redefinir a senha de um Colaborador para que ele recupere o acesso quando esquecer a própria senha.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Redefinição pelo Administrador de Unidade:*
      * **Dado** que sou Administrador de Unidade e o Colaborador pertence à minha unidade
      * **Quando** solicito a redefinição da senha dessa pessoa
      * **Então** o sistema gera uma nova senha, exibe-a uma única vez para que eu a repasse à pessoa e não volta a exibi-la depois.
    * *Cenário 2 — Alcance da redefinição:*
      * **Dado** que sou Administrador de Unidade
      * **Quando** tento redefinir a senha de outro Administrador de Unidade ou de um Administrador Global
      * **Então** a ação é recusada com aviso de permissão insuficiente; ao Administrador Global cabe redefinir a senha de Colaboradores e de Administradores de Unidade, e a senha de um Administrador Global só é alterada por ele mesmo em "Minha conta".
    * *Cenário 3 — Acesso anterior encerrado imediatamente:*
      * **Dado** que a pessoa estava com acesso aberto no momento da redefinição
      * **Quando** a senha é redefinida pela administração
      * **Então** todos os acessos abertos dessa pessoa são encerrados e a senha anterior deixa de funcionar de imediato.

### Épico 2: Navegação e Gestão de Arquivos e Pastas

* **US 2.1:** Como Colaborador, eu quero navegar por pastas aninhadas com uma trilha de navegação para que eu localize meus arquivos de forma familiar.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Navegação e trilha:*
      * **Dado** que estou em uma pasta com subpastas às quais tenho acesso
      * **Quando** entro em uma subpasta
      * **Então** vejo seu conteúdo permitido e a trilha de navegação é atualizada, permitindo retornar a qualquer nível anterior com um clique.
    * *Cenário 2 — Item sem permissão não aparece:*
      * **Dado** que uma pasta contém itens para os quais não tenho permissão
      * **Quando** abro essa pasta
      * **Então** apenas os itens que criei ou que me foram liberados são exibidos.

* **US 2.2:** Como Colaborador, eu quero renomear ou substituir um arquivo por uma nova versão para que eu mantenha o material atualizado, desde que eu tenha permissão para isso.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Substituição com permissão:*
      * **Dado** que tenho permissão de renomear/substituir sobre um arquivo
      * **Quando** envio uma nova versão para o mesmo arquivo
      * **Então** o arquivo vigente é substituído no mesmo local e o evento fica registrado, sem manter a versão anterior disponível para consulta.
    * *Cenário 2 — Ação sem permissão:*
      * **Dado** que não tenho permissão de renomear/substituir sobre um arquivo
      * **Quando** tento renomeá-lo ou substituí-lo
      * **Então** a ação é bloqueada e recebo aviso de permissão insuficiente.

* **US 2.3:** Como Colaborador, eu quero mover arquivos e pastas entre pastas e renomear pastas para que eu reorganize meu material sem precisar reenviá-lo.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Mover com permissão:*
      * **Dado** que sou dono de um arquivo ou de uma pasta e da pasta de destino
      * **Quando** movo o item para essa pasta
      * **Então** o item passa a residir no destino com o mesmo conteúdo e as mesmas permissões, sem que nada precise ser reenviado.
    * *Cenário 2 — Ação sem permissão:*
      * **Dado** que não sou dono do item nem Administrador da Unidade dele
      * **Quando** tento movê-lo ou renomeá-lo
      * **Então** a ação é bloqueada com aviso de permissão insuficiente e nada é alterado.
    * *Cenário 3 — Destino dentro do próprio item:*
      * **Dado** que quero mover uma pasta
      * **Quando** escolho como destino a própria pasta ou uma pasta contida nela
      * **Então** a ação é recusada com aviso, e a hierarquia permanece exatamente como estava.
    * *Cenário 4 — Nome já existente no destino:*
      * **Dado** que o destino já contém uma pasta com o mesmo nome
      * **Quando** movo ou renomeio uma pasta para esse nome
      * **Então** a ação é recusada com aviso, sem sobrescrever nem fundir o conteúdo das duas pastas.
    * *Cenário 5 — Renomear pasta:*
      * **Dado** que sou dono de uma pasta
      * **Quando** altero seu nome
      * **Então** o novo nome passa a ser exibido no mesmo lugar, e o conteúdo e a localização das subpastas e arquivos permanecem inalterados.
    * *Cenário 6 — Alcance do Administrador de Unidade:*
      * **Dado** que sou Administrador de Unidade
      * **Quando** reorganizo itens de qualquer pessoa
      * **Então** consigo fazê-lo apenas dentro da minha própria unidade, e nunca sobre itens de outra unidade.

* **US 2.4:** Como Colaborador, eu quero selecionar vários arquivos e pastas de uma vez e movê-los juntos para o mesmo destino para que eu reorganize uma pasta cheia sem repetir a ação item a item.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Lote movido com sucesso:*
      * **Dado** que selecionei vários arquivos e pastas sobre os quais tenho alcance
      * **Quando** escolho um destino e confirmo
      * **Então** todos passam a residir no destino com o mesmo conteúdo e as mesmas permissões, e recebo um único aviso de sucesso.
    * *Cenário 2 — Falha parcial com veredito por item:*
      * **Dado** que a seleção contém um item sobre o qual não tenho alcance, ou uma pasta cujo destino formaria ciclo ou colide de nome
      * **Quando** confirmo o movimento em lote
      * **Então** os demais itens são movidos normalmente, e sou informado de quantos foram movidos e de qual item foi recusado, com o motivo.
    * *Cenário 3 — Destino sem alcance derruba o lote inteiro:*
      * **Dado** que o destino escolhido está fora do meu alcance, é de outra unidade ou não existe
      * **Quando** confirmo o movimento em lote
      * **Então** nenhum item da seleção é movido, e recebo o aviso de permissão insuficiente.
    * *Cenário 4 — Teto de itens por operação:*
      * **Dado** que selecionei mais itens do que o teto permitido por operação
      * **Quando** acionar mover
      * **Então** a ação é recusada antes de qualquer envio, com aviso distinto da recusa por permissão.
    * *Cenário 5 — Seleção limpa ao navegar:*
      * **Dado** que tenho itens selecionados na pasta corrente
      * **Quando** entro em uma subpasta ou volto pela trilha de navegação
      * **Então** a seleção anterior é esvaziada, sem misturar itens de pastas diferentes num mesmo lote.

* **US 2.5:** Como Colaborador, eu quero marcar pastas e arquivos como favoritos e encontrá-los numa lista pessoal para que eu chegue ao que uso com frequência sem percorrer as pastas. *(Reentrada de escopo pela demanda do cliente nº 2, tabela 1.1 — antes excluída "por decisão do cliente".)*
  * **Critérios de Aceitação:**
    * *Cenário 1 — Marcar o que alcanço:*
      * **Dado** que posso visualizar uma pasta ou um arquivo
      * **Quando** o marco como favorito
      * **Então** ele passa a constar da minha lista de favoritos, do marcado mais recentemente para o mais antigo, com a pasta que o contém e a data da marcação.
    * *Cenário 2 — Não marco o que não alcanço:*
      * **Dado** um recurso que não posso visualizar, de outra unidade ou na lixeira
      * **Quando** tento marcá-lo
      * **Então** a marcação é recusada com a mesma resposta de recurso inexistente, sem revelar o motivo.
    * *Cenário 3 — Favorito não é permissão:*
      * **Dado** um favorito meu
      * **Quando** perco o acesso a ele (concessão vencida, documento obsoleto, ida para a lixeira)
      * **Então** ele some da lista sem erro e sem que a marca seja apagada; se o acesso voltar, ele volta a aparecer.
    * *Cenário 4 — A lista é pessoal:*
      * **Dado** que outra pessoa marcou um recurso que eu também alcanço
      * **Quando** abro os meus favoritos
      * **Então** o favorito dela não aparece, qualquer que seja o meu papel.
    * *Cenário 5 — Teto:*
      * **Dado** que já tenho o número máximo de favoritos (200)
      * **Quando** marco mais um
      * **Então** a marcação é recusada com aviso de limite atingido.

### Épico 3: Envio e Download em Lote

* **US 3.1:** Como Colaborador, eu quero enviar vários arquivos de uma vez e acompanhar o progresso de cada um para que eu saiba o que já concluiu.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Progresso do conjunto:*
      * **Dado** que selecionei vários arquivos para envio
      * **Quando** inicio o envio
      * **Então** acompanho um progresso único do conjunto, medido pelos bytes já transferidos sobre o total, com a quantidade de arquivos concluídos e o arquivo corrente como informação complementar — e um envio com milhares de arquivos não degrada a interface.
    * *Cenário 2 — Falha parcial:*
      * **Dado** que um dos arquivos falha durante o envio
      * **Quando** os demais concluem
      * **Então** os que concluíram permanecem salvos e o que falhou é contabilizado e listável sob demanda, permitindo nova tentativa apenas dele.

* **US 3.2:** Como Colaborador, eu quero enviar uma pasta inteira preservando suas subpastas para que a estrutura original seja mantida.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Estrutura preservada:*
      * **Dado** que selecionei uma pasta com subpastas
      * **Quando** concluo o envio
      * **Então** a hierarquia de subpastas e arquivos é recriada de forma idêntica dentro do sistema.

* **US 3.3:** Como Colaborador, eu quero baixar uma pasta completa em um único arquivo compactado para que eu leve todo o conteúdo de uma vez.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Download compactado:*
      * **Dado** que tenho permissão de baixar sobre os itens de uma pasta
      * **Quando** solicito o download da pasta
      * **Então** recebo um único arquivo compactado contendo os arquivos e subpastas para os quais tenho permissão.
    * *Cenário 2 — Conteúdo parcialmente permitido:*
      * **Dado** que a pasta contém itens sem permissão de download para mim
      * **Quando** solicito o download da pasta
      * **Então** apenas os itens permitidos são incluídos no arquivo compactado.

* **US 3.4:** Como Colaborador, eu quero enviar várias pastas de uma vez e saber antes de começar se o envio cabe no meu espaço, para não esperar dezenas de minutos por uma transferência que seria recusada no meio.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Várias pastas numa seleção só:*
      * **Dado** que arrasto duas ou mais pastas para a área de envio
      * **Quando** as solto
      * **Então** todos os arquivos das pastas são reunidos em um único envio e a hierarquia de cada pasta é recriada preservada dentro da pasta atual.
    * *Cenário 2 — Verificação antes de transferir:*
      * **Dado** que a minha seleção é maior que o meu espaço disponível
      * **Quando** a seleção é recebida
      * **Então** nenhum arquivo é transferido e sou informado do volume da seleção, do espaço disponível e do quanto falta, antes de qualquer espera.
    * *Cenário 3 — A recusa diz onde o espaço está:*
      * **Dado** que parte do meu espaço está ocupada por arquivos na lixeira
      * **Quando** um envio é recusado por falta de espaço
      * **Então** vejo quanto do meu espaço está em arquivos ativos, na lixeira e em envios pendentes, e sou informado de que excluir arquivos não libera espaço de imediato.
    * *Cenário 4 — Enviar só o que cabe:*
      * **Dado** que a seleção não cabe por inteiro
      * **Quando** escolho enviar apenas o que cabe
      * **Então** o subconjunto que cabe é enviado e sou informado com clareza de quantos arquivos ficaram de fora.
    * *Cenário 5 — Confirmação quando cabe:*
      * **Dado** que a seleção cabe no espaço disponível
      * **Quando** a verificação termina
      * **Então** vejo a quantidade de arquivos e o volume a enviar, e a transferência só começa após a minha confirmação.
    * *Cenário 6 — Espaço esgotado durante o envio:*
      * **Dado** que o meu espaço se esgota com o envio já em andamento
      * **Quando** o sistema detecta a falta de espaço
      * **Então** o envio é pausado sem tentar o restante, os arquivos já transferidos permanecem enviados, e sou informado de que o envio ficou incompleto e de quantos arquivos não foram enviados.
    * *Cenário 7 — Sem limite próprio de quantidade:*
      * **Dado** que selecionei uma quantidade muito grande de arquivos
      * **Quando** a verificação termina
      * **Então** não sou recusado por quantidade de arquivos: a única recusa por tamanho é a que o espaço disponível justifica.

* **US 3.5:** Como Colaborador, eu quero cadastrar os dados de cada arquivo no momento do envio em lote, numa tabela com uma linha por arquivo, para que enviar muitos documentos não signifique deixar todos sem identificação.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Uma linha por arquivo, depois do veredito de espaço:*
      * **Dado** que selecionei vários arquivos, ou uma pasta, e a seleção cabe no meu espaço
      * **Quando** a verificação de espaço termina
      * **Então** vejo uma tabela de cadastro com uma linha por arquivo, com tipo, código, título, revisão, responsável e próxima revisão, e nenhum arquivo é transferido antes de eu publicar.
    * *Cenário 2 — Título vem do nome do arquivo e é editável:*
      * **Dado** que a tabela de cadastro está aberta
      * **Quando** altero o título de uma linha
      * **Então** o arquivo é gravado com o título que informei, preservada a extensão original, e uma linha sem título não é enviada.
    * *Cenário 3 — Sugestão pelo nome do arquivo:*
      * **Dado** que o nome de um arquivo segue o padrão SIGLA-AREA-Nº
      * **Quando** ele entra na tabela
      * **Então** o tipo e o código vêm sugeridos, editáveis e identificados como sugestão — e um nome fora do padrão não recebe sugestão alguma.
    * *Cenário 4 — Aplicar a todos:*
      * **Dado** que quero o mesmo tipo, revisão, responsável e próxima revisão em todas as linhas
      * **Quando** informo esses valores no topo da tabela e aciono a aplicação
      * **Então** todas as linhas passam a tê-los, o código permanece individual de cada documento, e qualquer linha pode ser alterada depois.
    * *Cenário 5 — Publicar leva os dois grupos:*
      * **Dado** que a tabela tem linhas completas e incompletas
      * **Quando** confirmo a publicação
      * **Então** sou informado de quantos arquivos serão publicados e quantos ficarão Pendentes de cadastro, e todos são enviados — nenhum é descartado por estar incompleto.
    * *Cenário 6 — Código repetido dentro do próprio envio:*
      * **Dado** que duas linhas da tabela declaram o mesmo código
      * **Quando** tento publicar
      * **Então** a publicação é impedida e as duas linhas são apontadas, antes de qualquer transferência.
    * *Cenário 7 — Recusa de código vinda do servidor é corrigível:*
      * **Dado** que um arquivo foi recusado porque o código já pertence a outro documento da unidade
      * **Quando** vejo a falha
      * **Então** ela é apresentada como conflito daquele código, com os demais dados do arquivo preservados, bastando corrigir o código e repetir aquele item.

### Épico 4: Controle de Acesso e Permissões Granulares

* **US 4.1:** Como Administrador, eu quero conceder permissões específicas (visualizar, baixar, enviar, renomear/substituir, excluir) sobre uma pasta ou sobre arquivos selecionados para uma pessoa ou grupo, para que o acesso seja liberado na medida exata.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Concessão por arquivos selecionados:*
      * **Dado** que selecionei um ou mais arquivos e uma pessoa ou grupo de destino
      * **Quando** concedo, por exemplo, apenas a permissão de visualizar
      * **Então** o destinatário passa a visualizar exatamente aqueles itens, sem receber automaticamente as demais permissões nem acesso a outros itens da mesma pasta.
    * *Cenário 2 — Sem herança para o conteúdo interno:*
      * **Dado** que concedi permissão sobre uma pasta
      * **Quando** o destinatário abre essa pasta
      * **Então** ele acessa a pasta conforme concedido, mas os arquivos e subpastas internos só ficam acessíveis se tiverem sido liberados explicitamente.

* **US 4.2:** Como Colaborador, eu quero que o acesso direto por link a um arquivo sem permissão seja bloqueado para que documentos não sejam expostos por engano.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Link direto sem permissão:*
      * **Dado** que recebi o endereço direto de um arquivo para o qual não tenho permissão
      * **Quando** tento abri-lo por esse endereço
      * **Então** o acesso é bloqueado e nenhum conteúdo ou pré-visualização do arquivo é exibido.

* **US 4.3:** Como Administrador, eu quero definir um prazo de expiração opcional para uma permissão para que acessos temporários se encerrem sozinhos.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Aviso antes do vencimento:*
      * **Dado** que uma permissão concedida a uma pessoa tem data de expiração
      * **Quando** o vencimento se aproxima
      * **Então** a pessoa é avisada previamente de que o acesso será encerrado.
    * *Cenário 2 — Corte no vencimento com aviso à administração:*
      * **Dado** que a data de expiração de uma permissão foi atingida
      * **Quando** o prazo termina
      * **Então** o acesso correspondente é automaticamente encerrado e a área administrativa é avisada do corte.

* **US 4.4:** Como Colaborador, eu quero ver num só lugar as pastas e os arquivos que outras pessoas liberaram para mim, para que eu os alcance sem depender de alguém me mandar o endereço.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Reúne o que foi liberado para mim:*
      * **Dado** que recebi permissão vigente sobre uma pasta e sobre um arquivo de outra pessoa
      * **Quando** abro o destino de compartilhados
      * **Então** vejo os dois, cada um com o que posso fazer nele, o prazo de cada permissão quando houver, a pasta que o contém e a data em que foi compartilhado, ordenados do mais recente para o mais antigo.
    * *Cenário 2 — Alcanço o item sem percorrer as pastas:*
      * **Dado** que o item liberado está dentro de pastas que eu não posso abrir
      * **Quando** aciono o item na lista
      * **Então** o arquivo abre na visualização e a pasta abre no explorador, sem que eu precise navegar até elas, e a lista não me mostra o nome de nenhuma pasta acima da que contém o item.
    * *Cenário 3 — A permissão vencida não aparece:*
      * **Dado** que o prazo de uma permissão que eu tinha foi atingido
      * **Quando** consulto a lista
      * **Então** o item não aparece, ainda que a permissão permaneça registrada para a administração.
    * *Cenário 4 — A lista não amplia o meu alcance:*
      * **Dado** que existem documentos obsoletos, arquivos pendentes de cadastro, itens na lixeira e conteúdo de outra unidade
      * **Quando** consulto a lista
      * **Então** nenhum deles aparece, qualquer que seja o meu perfil, e a ausência é indistinguível de o item não existir.
    * *Cenário 5 — Só as ações que a minha permissão cobre:*
      * **Dado** que recebi apenas a permissão de baixar um arquivo
      * **Quando** vejo o item na lista
      * **Então** me é oferecido baixar e não me é oferecido visualizar, sem atalho que resulte em recusa.
    * *Cenário 6 — Nada compartilhado comigo:*
      * **Dado** que ninguém liberou nada para mim
      * **Quando** abro o destino
      * **Então** a tela explica a ausência, em vez de apresentar uma tabela vazia sem explicação.

### Épico 5: Isolamento por Unidade

* **US 5.1:** Como Administrador de Unidade, eu quero gerenciar apenas as pessoas e os arquivos da minha unidade para que meu escopo de atuação seja restrito a ela.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Alcance restrito:*
      * **Dado** que sou administrador de uma unidade
      * **Quando** acesso a área administrativa
      * **Então** vejo e gerencio somente as pessoas, pastas, arquivos e permissões da minha unidade, sem acesso ao conteúdo das demais.
    * *Cenário 2 — Colaborador não enxerga outra unidade:*
      * **Dado** que sou colaborador de uma unidade
      * **Quando** navego pelos arquivos
      * **Então** nunca vejo arquivos pertencentes a outra unidade, mesmo por busca ou link direto, salvo o que foi compartilhado com a minha unidade ou comigo pela US 5.2.

* **US 5.2:** Como Administrador (Global, ou da unidade dona do conteúdo), eu quero compartilhar pastas e documentos entre a SEDE e as demais unidades, para que material institucional circule sem quebrar o isolamento do restante do acervo. (Demanda do cliente: a pasta Governança é da SEDE, mas as unidades precisam vê-la.)
  * **Critérios de Aceitação:**
    * *Cenário 1 — SEDE compartilha pasta com uma unidade:*
      * **Dado** que a pasta Governança é da SEDE
      * **Quando** a compartilho com a Unidade Norte para visualizar
      * **Então** qualquer pessoa da Unidade Norte — inclusive quem for cadastrado depois — abre a pasta e tudo o que há dentro dela, inclusive o que entrar depois, sem poder enviar, renomear ou excluir.
    * *Cenário 2 — Compartilhamento com uma pessoa:*
      * **Dado** que compartilhei a pasta Governança com uma pessoa de outra unidade
      * **Quando** ela abre "Compartilhados comigo"
      * **Então** a pasta aparece, identificada como vinda da SEDE, e abre normalmente.
    * *Cenário 3 — Unidade compartilha com a SEDE:*
      * **Dado** que sou administrador de uma unidade
      * **Quando** compartilho um documento dela com a SEDE
      * **Então** a SEDE passa a alcançá-lo, e não consigo compartilhá-lo com nenhuma outra unidade.
    * *Cenário 4 — Fora do compartilhamento nada muda:*
      * **Dado** um compartilhamento vigente
      * **Quando** uma pessoa da unidade de destino navega, busca ou usa link direto para qualquer item fora do que foi compartilhado
      * **Então** é recusada como se o item não existisse.
    * *Cenário 5 — Regras restritivas continuam valendo:*
      * **Dado** que um documento dentro da pasta compartilhada está obsoleto, pendente de cadastro ou na lixeira
      * **Quando** alguém da unidade de destino tenta alcançá-lo
      * **Então** é recusado como se não existisse.
    * *Cenário 6 — Prazo e revogação:*
      * **Dado** que o compartilhamento tem prazo ou foi revogado
      * **Quando** o prazo vence ou a revogação acontece
      * **Então** o acesso termina na requisição seguinte.
    * *Cenário 7 — Auditoria na origem:*
      * **Dado** que uma pessoa de outra unidade visualizou ou baixou um arquivo compartilhado
      * **Quando** o dono ou o administrador da unidade de origem consulta a auditoria do arquivo
      * **Então** o acesso aparece com o nome da pessoa e a unidade dela.
    * *Cenário 8 — Concessão comum não atravessa unidades:*
      * **Dado** que tento conceder uma permissão comum a uma pessoa de outra unidade
      * **Quando** confirmo
      * **Então** sou recusado e orientado a usar o compartilhamento entre unidades, em vez de ver uma concessão sem efeito.

### Épico 6: Lixeira e Retenção

* **US 6.1:** Como Colaborador, eu quero que itens excluídos vão para uma lixeira em vez de serem apagados imediatamente para que eu possa recuperá-los se me arrepender.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Exclusão e restauração:*
      * **Dado** que excluí um arquivo sobre o qual tenho permissão de excluir
      * **Quando** acesso a lixeira dentro de 30 dias e escolho restaurar
      * **Então** o item volta ao seu local de origem com as permissões que possuía.
    * *Cenário 2 — Expurgo automático:*
      * **Dado** que um item está na lixeira há mais de 30 dias
      * **Quando** a rotina diária das 3h é executada
      * **Então** o item é apagado de forma permanente e deixa de poder ser restaurado.

* **US 6.2:** Como Colaborador, eu quero esvaziar a minha lixeira quando quiser para que eu recupere de imediato o espaço que os arquivos excluídos ainda ocupam na minha cota, sem esperar os 30 dias de retenção.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Espaço devolvido na hora:*
      * **Dado** que tenho arquivos meus na lixeira, ainda dentro do prazo de retenção
      * **Quando** aciono esvaziar a lixeira e confirmo a ação
      * **Então** esses arquivos são apagados de forma permanente, deixam de poder ser restaurados, e o meu espaço utilizado é reduzido pelo tamanho deles.
    * *Cenário 2 — Confirmação informa a troca antes de apagar:*
      * **Dado** que aciono esvaziar a lixeira
      * **Quando** a confirmação é exibida
      * **Então** vejo quantos arquivos serão apagados, quanto espaço retorna e o aviso de que a ação não tem volta, e nada é apagado até que eu confirme.
    * *Cenário 3 — Alcance restrito ao que é meu:*
      * **Dado** que na lixeira existem também arquivos de outras pessoas e pastas
      * **Quando** esvazio a minha lixeira
      * **Então** apenas os arquivos de que sou dono são apagados: os arquivos das outras pessoas seguem restauráveis e as pastas permanecem na lixeira até o expurgo automático.
    * *Cenário 4 — Falha em um arquivo não derruba os demais:*
      * **Dado** que a remoção de um dos arquivos falha durante o expurgo
      * **Quando** a operação termina
      * **Então** os demais arquivos são apagados normalmente, o arquivo que falhou permanece íntegro na lixeira, e sou informado de quantos foram apagados e quantos falharam.

### Épico 7: Auditoria

* **US 7.1:** Como Administrador, eu quero consultar quem visualizou ou baixou cada arquivo, com data e hora, para que haja comprovação de acesso.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Registro de acesso:*
      * **Dado** que uma pessoa visualizou ou baixou um arquivo
      * **Quando** consulto o registro de auditoria desse arquivo
      * **Então** vejo quem realizou a ação, qual ação (visualizar ou baixar) e a data e hora correspondentes.

* **US 7.2:** Como Colaborador dono de um arquivo, eu quero ver quem acessou os arquivos que enviei para que eu acompanhe o uso do meu próprio material.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Dono consulta apenas os seus:*
      * **Dado** que sou dono de um arquivo
      * **Quando** abro o registro de auditoria
      * **Então** vejo os acessos aos arquivos que eu enviei e não vejo registros de arquivos de outras pessoas.

### Épico 8: Cotas e Painel Gerencial

* **US 8.1:** Como Colaborador, eu quero ser impedido de enviar quando atingir meu limite de 10 GB para que eu respeite minha cota individual.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Bloqueio no limite:*
      * **Dado** que meu espaço utilizado atingiu 10 GB
      * **Quando** tento enviar um novo arquivo
      * **Então** o envio é bloqueado e recebo aviso de que a cota foi atingida, indicando a necessidade de liberar espaço.
  * **Adendo — cota individual por exceção nominal** (change `cota-por-usuario`): os 10 GB permanecem como o **padrão da plataforma**, aplicado a toda pessoa que não tenha exceção. O **Administrador Global** — e somente ele, nunca o Administrador de Unidade — pode conceder a uma pessoa uma cota individual diferente, diretamente no cadastro dela, sem alterar o limite de mais ninguém. O bloqueio do Cenário 1 passa a ser avaliado contra a **cota efetiva** da pessoa (a exceção quando houver, o padrão quando não houver).
    * *Cenário 2 — Exceção nominal prevalece:*
      * **Dado** que o Administrador Global concedeu a mim uma cota individual acima do padrão
      * **Quando** envio um arquivo que ultrapassa o padrão mas cabe na minha cota
      * **Então** o envio é aceito, e a cota das demais pessoas permanece inalterada.
    * *Cenário 3 — Cota abaixo do já utilizado:*
      * **Dado** que minha cota foi reduzida abaixo do espaço que já ocupo
      * **Quando** tento enviar um novo arquivo
      * **Então** o envio é bloqueado, **nenhum arquivo meu é apagado**, e continuo podendo visualizar e baixar o que já tenho.

* **US 8.2:** Como Administrador, eu quero um painel com cartões e gráficos de uso para que eu acompanhe a saúde do repositório.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Painel acessível pelo menu lateral:*
      * **Dado** que estou autenticado como administrador
      * **Quando** abro o painel pelo menu lateral
      * **Então** vejo cartões com as estatísticas principais e gráficos de quantidade de arquivos por tipo, envios por mês e espaço utilizado versus disponível, dentro do meu alcance (global ou de unidade).

### Épico 9: Busca, Filtros e Visualização

* **US 9.1:** Como Colaborador, eu quero buscar por nome e filtrar por data, tipo de arquivo e autor para que eu encontre rapidamente o que preciso.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Busca com filtros combinados:*
      * **Dado** que estou na página de arquivos
      * **Quando** informo um nome e aplico filtros de data, tipo e autor
      * **Então** vejo apenas os itens que atendem a todos os critérios e para os quais tenho permissão.
    * *Cenário 2 — Limpar filtros:*
      * **Dado** que apliquei um ou mais filtros
      * **Quando** aciono o botão de limpar filtros
      * **Então** todos os filtros são removidos e a lista volta ao estado inicial permitido.

* **US 9.2:** Como Colaborador, eu quero visualizar arquivos sem baixá-los para que eu consulte o conteúdo com rapidez.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Formatos suportados:*
      * **Dado** que tenho permissão de visualizar um arquivo de PDF, imagem, vídeo, áudio, texto ou documento de escritório (Word, Excel, PowerPoint)
      * **Quando** abro sua visualização
      * **Então** vejo o conteúdo diretamente na tela, sem que o arquivo seja baixado.
    * *Cenário 2 — Formato não suportado:*
      * **Dado** que o arquivo é de um formato sem visualização disponível
      * **Quando** tento visualizá-lo
      * **Então** o sistema informa que a pré-visualização não está disponível e oferece o download, respeitando minhas permissões.

### Épico 10: Controle Documental

> Este épico transforma o repositório de arquivos num repositório de **documentos controlados**: cada documento passa a carregar tipo, código, revisão, responsável e prazo de próxima revisão, e a aplicação passa a dizer, de relance, se ele ainda vale. Decorre de solicitação direta do cliente (Instituto SETES) e preserva uma fronteira já fixada no Escopo do MVP: **avançar a revisão não cria histórico navegável** — a versão anterior continua indisponível para consulta, como em qualquer substituição.

* **US 10.1:** Como Colaborador, eu quero classificar um documento por tipo para que eu o identifique de relance na listagem, sem abrir o arquivo.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Tipo exibido como sigla e cor:*
      * **Dado** que um documento foi classificado com um dos tipos previstos (Protocolo, Procedimento, Política/Norma, Formulário, Checklist, Fluxograma, Manual, Termo de Consentimento ou Comunicado Interno)
      * **Quando** visualizo a listagem da pasta que o contém
      * **Então** vejo a sigla do tipo junto ao nome do documento, acompanhada da cor correspondente àquele tipo.
    * *Cenário 2 — A cor nunca é a única portadora da informação:*
      * **Dado** que um documento exibe a etiqueta do seu tipo
      * **Quando** consulto a listagem sem distinguir cores
      * **Então** a sigla do tipo permanece legível por si só, sem que eu dependa da cor para saber de que tipo se trata.
    * *Cenário 3 — Documento sem classificação:*
      * **Dado** que um arquivo foi enviado sem tipo informado
      * **Quando** visualizo a listagem
      * **Então** ele aparece normalmente, sem etiqueta de tipo, e continua acessível conforme minhas permissões.

* **US 10.2:** Como Colaborador, eu quero que cada documento controlado tenha um código próprio para que eu o encontre e o cite sem ambiguidade.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Busca pelo código:*
      * **Dado** que existe na minha unidade um documento de código `PRT-NSP-001` a que tenho acesso
      * **Quando** informo esse código na busca
      * **Então** o documento correspondente é encontrado.
    * *Cenário 2 — Código repetido na mesma unidade é recusado:*
      * **Dado** que já existe na minha unidade um documento com o código que informei
      * **Quando** tento publicar outro documento com o mesmo código
      * **Então** o envio é recusado com aviso claro de código já em uso, e nenhum documento é publicado.
    * *Cenário 3 — O mesmo código em unidades diferentes não conflita:*
      * **Dado** que outra unidade possui um documento com o código que informei
      * **Quando** publico um documento com esse código na minha unidade
      * **Então** a publicação é aceita, pois o código é único dentro de cada unidade, e em nenhum momento o documento da outra unidade me é revelado.

* **US 10.3:** Como Colaborador, eu quero ver a revisão vigente e o responsável por cada documento para que eu saiba com quem falar e qual versão estou lendo.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Revisão e responsável na listagem:*
      * **Dado** que tenho permissão de visualizar um documento controlado
      * **Quando** abro a pasta que o contém
      * **Então** vejo, naquela linha, a revisão vigente e o setor responsável pelo documento.
    * *Cenário 2 — Documento sem esses dados:*
      * **Dado** que um arquivo foi enviado sem revisão nem responsável informados
      * **Quando** o vejo na listagem
      * **Então** os campos aparecem vazios de forma explícita, sem número de revisão presumido.

* **US 10.4:** Como Administrador da unidade, eu quero ver a situação de cada documento para que eu identifique o que está vencido ou prestes a vencer sem precisar conferir datas uma a uma.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Documento dentro do prazo:*
      * **Dado** que um documento tem data de próxima revisão a mais de 60 dias
      * **Quando** o consulto
      * **Então** sua situação é apresentada como **Vigente**.
    * *Cenário 2 — Documento a vencer:*
      * **Dado** que a data de próxima revisão de um documento ocorre dentro dos próximos 60 dias
      * **Quando** o consulto
      * **Então** sua situação é apresentada como **A vencer**, indicando em quantos dias vence.
    * *Cenário 3 — Documento com revisão vencida:*
      * **Dado** que a data de próxima revisão de um documento já passou
      * **Quando** o consulto
      * **Então** sua situação é apresentada como **Revisão vencida**.
    * *Cenário 4 — Documento declarado em revisão:*
      * **Dado** que o responsável declarou que o documento está em elaboração ou revisão
      * **Quando** o consulto
      * **Então** sua situação é apresentada como **Em revisão**, independentemente da data de próxima revisão.
    * *Cenário 5 — Documento sem controle de revisão:*
      * **Dado** que um arquivo não tem data de próxima revisão informada
      * **Quando** o consulto
      * **Então** sua situação é apresentada como **Sem controle de revisão**, e ele não é contabilizado entre os documentos a vencer nem entre os vencidos.
    * *Cenário 6 — A virada de prazo não depende de rotina:*
      * **Dado** que um documento vence a revisão no instante seguinte
      * **Quando** o consulto após esse instante, sem que nenhuma rotina programada tenha sido executada
      * **Então** sua situação já é apresentada como **Revisão vencida**, pois é apurada pelo relógio do servidor no momento da consulta.

* **US 10.5:** Como Administrador da unidade, eu quero que os dados de controle sejam exigidos ao publicar um documento para que a unidade não acumule documentos sem rastreio.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Envio de um documento exige os dados:*
      * **Dado** que estou enviando um único documento
      * **Quando** confirmo a publicação sem informar tipo, código, revisão, responsável e data de próxima revisão
      * **Então** o sistema recusa a publicação e indica quais dados faltam.
    * *Cenário 2 — Envio em lote exige os dados de cada arquivo:*
      * **Dado** que estou enviando vários arquivos de uma vez, ou uma pasta inteira
      * **Quando** confirmo o envio informando os dados de parte dos arquivos e deixando outros sem eles
      * **Então** os arquivos com os dados completos são publicados normalmente, e os incompletos são aceitos e ficam **Pendentes de cadastro** (US 10.9) — nenhum arquivo é publicado sem os dados obrigatórios, enviado sozinho ou em lote.
    * *Cenário 3 — Acervo anterior não é invalidado:*
      * **Dado** que a unidade já possuía arquivos enviados antes da existência do controle documental
      * **Quando** navego por eles
      * **Então** permanecem acessíveis conforme minhas permissões, com situação **Sem controle de revisão**, sem que nenhum deles se torne inválido, inacessível ou pendente de cadastro.

* **US 10.6:** Como Administrador da unidade, eu quero que substituir o arquivo avance a revisão para que a numeração acompanhe a realidade do documento.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Substituição avança a revisão:*
      * **Dado** que tenho permissão de substituir um documento controlado que está na revisão 01
      * **Quando** substituo o arquivo por uma nova versão
      * **Então** o documento passa a constar na revisão 02, mantendo código, tipo e responsável.
    * *Cenário 2 — A revisão anterior não fica disponível para consulta:*
      * **Dado** que um documento teve sua revisão avançada
      * **Quando** procuro a revisão anterior
      * **Então** ela não está disponível, pois o sistema mantém apenas a versão vigente — comportamento já previsto no escopo do MVP.
    * *Cenário 3 — Sem permissão de substituir, a revisão não avança:*
      * **Dado** que não tenho permissão de substituir um documento
      * **Quando** tento substituí-lo
      * **Então** a ação é recusada e a revisão permanece como estava.

* **US 10.7:** Como Administrador da unidade, eu quero que documentos obsoletos saiam de circulação para que ninguém siga um procedimento substituído.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Colaborador não alcança documento obsoleto:*
      * **Dado** que um documento foi marcado como obsoleto
      * **Quando** um Colaborador navega pela pasta, busca pelo nome ou pelo código, ou acessa o endereço direto do documento
      * **Então** em nenhum desses caminhos o documento lhe é apresentado, nem sua pré-visualização.
    * *Cenário 2 — Administrador da unidade continua enxergando o obsoleto:*
      * **Dado** que um documento foi marcado como obsoleto
      * **Quando** um Administrador da unidade consulta a pasta
      * **Então** o documento aparece, claramente identificado como **Obsoleto**.
    * *Cenário 3 — Obsolescência não atravessa unidades:*
      * **Dado** que um Administrador da unidade consulta documentos obsoletos
      * **Quando** faz essa consulta
      * **Então** enxerga apenas os da própria unidade, sem que a condição de obsoleto abra qualquer acesso a conteúdo de outra unidade.

* **US 10.8:** Como Colaborador, eu quero poder declarar que um arquivo não é documento da Matriz para que atas, planilhas de trabalho e apresentações convivam no repositório sem fingir ter código e revisão.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Arquivo geral pede só o título:*
      * **Dado** que estou enviando uma ata de reunião
      * **Quando** escolho o tipo **Arquivo geral** e informo apenas o título
      * **Então** o arquivo é publicado normalmente, sem exigir código, revisão nem data de próxima revisão.
    * *Cenário 2 — Arquivo geral não tem situação de revisão:*
      * **Dado** que um arquivo foi declarado **Arquivo geral**
      * **Quando** navego pela pasta que o contém
      * **Então** ele aparece identificado pelo seu tipo e sem nenhuma situação de revisão — nem Vigente, nem A vencer, nem Sem controle de revisão.
    * *Cenário 3 — Dados de documento controlado são recusados:*
      * **Dado** que estou declarando um arquivo como **Arquivo geral**
      * **Quando** informo um código, uma revisão ou uma data de próxima revisão
      * **Então** a operação é recusada, porque o tipo declara justamente não ter esses dados.

* **US 10.9:** Como Administrador da unidade, eu quero que o arquivo enviado sem os dados obrigatórios fique fora de circulação até ser cadastrado para que ninguém leia como oficial um documento que ainda não foi identificado.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Pendente não aparece para os leitores:*
      * **Dado** que um arquivo foi enviado em lote sem os dados obrigatórios
      * **Quando** um Colaborador que não o enviou navega pela pasta, busca pelo nome, acessa o endereço direto ou baixa a pasta compactada
      * **Então** em nenhum desses caminhos o arquivo lhe é apresentado, ainda que ele tenha permissão sobre o arquivo.
    * *Cenário 2 — Quem enviou e a Governança enxergam o pendente:*
      * **Dado** que um arquivo ficou pendente de cadastro
      * **Quando** quem o enviou, ou um Administrador da unidade, consulta a pasta
      * **Então** o arquivo aparece identificado como **Pendente de cadastro**.
    * *Cenário 3 — Quem enviou é avisado:*
      * **Dado** que enviei arquivos e parte deles ficou pendente de cadastro
      * **Quando** abro minhas notificações
      * **Então** encontro um aviso por arquivo pendente, identificando qual arquivo completar.
    * *Cenário 4 — Completar o cadastro publica o arquivo:*
      * **Dado** que um arquivo está pendente de cadastro e já tem parte dos dados preenchidos
      * **Quando** informo o último dado que faltava, sem reinformar os demais
      * **Então** o arquivo deixa de estar pendente e passa a circular conforme as permissões já concedidas.
    * *Cenário 5 — Preenchimento parcial mantém a pendência:*
      * **Dado** que um arquivo está pendente de cadastro
      * **Quando** informo parte dos dados obrigatórios e deixo algum em falta
      * **Então** os dados informados são gravados e o arquivo continua pendente de cadastro, sem erro.
    * *Cenário 6 — Pendência não atravessa unidades:*
      * **Dado** que um Administrador da unidade consulta arquivos pendentes de cadastro
      * **Quando** faz essa consulta
      * **Então** enxerga apenas os da própria unidade, sem que a condição de pendente abra qualquer acesso a conteúdo de outra unidade.

### Épico 11: Orientação na Tela Inicial

> Este épico trata da tela de entrada como ponto de partida do trabalho, e não como boas-vindas decorativa. Decorre de solicitação direta do cliente.

* **US 11.1:** Como Colaborador, eu quero que a tela inicial me diga quem sou, onde estou e o que posso fazer para que eu comece a trabalhar sem procurar no menu.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Identificação pessoal:*
      * **Dado** que acabei de entrar no sistema
      * **Quando** a tela inicial é apresentada
      * **Então** vejo meu nome, a minha **função/cargo do cadastro**, o meu setor e a minha unidade, e não um identificador interno.
    * *Cenário 4 — Conta sem função cadastrada:*
      * **Dado** que a minha conta não tem função/cargo preenchido
      * **Quando** a tela inicial é apresentada
      * **Então** vejo, no lugar da função, o rótulo do meu perfil de acesso — com o mesmo texto que as demais telas usam para ele —, e o setor é omitido quando não existe.
    * *Cenário 2 — Atalhos conforme o meu perfil:*
      * **Dado** que estou na tela inicial
      * **Quando** consulto os atalhos oferecidos
      * **Então** vejo apenas os que meu perfil pode executar, sem atalho que resulte em recusa ao ser acionado.
    * *Cenário 3 — Acesso rápido às pastas principais:*
      * **Dado** que tenho acesso a pastas de primeiro nível da minha unidade
      * **Quando** estou na tela inicial
      * **Então** vejo cartões para essas pastas, sob o título "Pastas da unidade", restritos às que posso abrir; cada cartão abre a pasta, e há um caminho para ver todas as pastas. Não são listadas unidades: cada pessoa pertence a uma unidade só (resposta 1a de `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, que aceitou essa diferença em relação ao Anexo A da demanda nº 2).
    * *Cenário 5 — Saudação pelo horário e documentos novos:*
      * **Dado** que acabei de entrar no sistema
      * **Quando** a tela inicial é apresentada
      * **Então** sou saudado com "Bom dia", "Boa tarde" ou "Boa noite" e o meu primeiro nome, e a linha abaixo informa quantos documentos que eu posso abrir foram publicados nos últimos 7 dias — sem contar documento fora do meu alcance nem de outra unidade (resposta 3b do mesmo retorno).
    * *Cenário 6 — Atalhos da tela inicial:*
      * **Dado** que estou na tela inicial
      * **Quando** consulto os atalhos
      * **Então** vejo, como cartões soltos com ícone, título e descrição, Enviar documento, Nova pasta, Buscar documento e Manual do usuário (este só quando a implantação tem manual configurado); cada um conduz à ação — a área de envio, o formulário de nova pasta, o campo de busca, o manual em nova aba.

* **US 11.2:** Como Colaborador, eu quero ver os documentos alterados recentemente para que eu acompanhe o que mudou sem vasculhar pastas.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Últimas alterações:*
      * **Dado** que documentos a que tenho acesso foram publicados, substituídos, renomeados ou movidos recentemente
      * **Quando** abro a tela inicial
      * **Então** vejo esses documentos ordenados da alteração mais recente para a mais antiga, com a data da alteração.
    * *Cenário 2 — A lista respeita a permissão:*
      * **Dado** que um documento a que **não** tenho acesso foi alterado
      * **Quando** consulto os documentos recentes
      * **Então** ele não aparece na lista, nem seu nome, nem sua pasta.
    * *Cenário 3 — A lista não atravessa unidades:*
      * **Dado** que documentos de outra unidade foram alterados
      * **Quando** consulto os documentos recentes
      * **Então** nenhum deles aparece, qualquer que seja o meu papel.
    * *Cenário 4 — Sem alterações recentes:*
      * **Dado** que nenhum documento a que tenho acesso foi alterado
      * **Quando** abro a tela inicial
      * **Então** a área de recentes informa a ausência de alterações, em vez de permanecer vazia sem explicação.
    * *Cenário 5 — Recorte e colunas na tela inicial:*
      * **Dado** que mais de cinco documentos a que tenho acesso foram alterados
      * **Quando** abro a tela inicial
      * **Então** a área "Documentos recentes" apresenta os cinco mais recentes, cada um com tipo, nome com o código abaixo, unidade, revisão, situação e data da atualização, e "Ver histórico completo" leva ao recorte inteiro.

* **US 11.3:** Como Colaborador, eu quero um tour curto pelas áreas da tela inicial para que eu aprenda a usar o sistema sem depender de treinamento. *(Reentrada de escopo pela demanda do cliente nº 2, tabelas 1.1 e 1.3 — antes excluída.)*
  * **Critérios de Aceitação:**
    * *Cenário 1 — Convite a quem não fez:*
      * **Dado** que nunca fiz o tour
      * **Quando** abro a tela inicial
      * **Então** vejo, à direita da saudação, "Primeira vez aqui? Faça o tour de 2 minutos"; o tour não começa sem que eu o acione.
    * *Cenário 2 — O tour só aponta o que vejo:*
      * **Dado** que comecei o tour
      * **Quando** percorro os passos
      * **Então** cada passo destaca uma área presente na minha tela, e área ausente (pela largura da tela ou pela configuração) não tem passo.
    * *Cenário 3 — Acionável de qualquer tela:*
      * **Dado** que estou em qualquer tela
      * **Quando** aciono "Tour guiado" no grupo AJUDA do menu
      * **Então** a tela inicial é apresentada e o tour começa; recarregar a tela não o reabre.
    * *Cenário 4 — Memória por pessoa:*
      * **Dado** que concluí ou fechei o tour
      * **Quando** volto à tela inicial, neste ou em outro computador
      * **Então** o convite não aparece mais, e o tour continua disponível no menu.

### Épico 12: Leitura Obrigatória

> Este épico trata da leitura obrigatória com registro de ciência e do seu acompanhamento (demanda do cliente nº 2, seção 3). Decorre de solicitação direta do cliente; o desenho do perfil Gestor foi fixado em `docs/respostas_a1_funcao_e_setor.txt` (respostas 3b e 4b) e `docs/respostas_d1_d3_d5_decisoes_estruturais.txt` (respostas 5a, 6a, 7a e 8).

* **US 12.1:** Como Administrador da unidade, eu quero marcar no cadastro quem acompanha as leituras da equipe, e de que alcance, para que coordenadores, gerentes e diretores possam acompanhar quem leu sem ganhar acesso de administração.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Marcação explícita:*
      * **Dado** que edito o cadastro de uma pessoa da minha unidade
      * **Quando** marco o acompanhamento "do setor" ou "da unidade"
      * **Então** a pessoa passa a constar como Gestor do setor ou Gestor da unidade, e fica registrado quem marcou e quando; o cargo escrito no cadastro não decide nada.
    * *Cenário 2 — Gestor do setor exige setor:*
      * **Dado** uma pessoa sem setor
      * **Quando** tento marcá-la como Gestor do setor, ou tento remover o setor de quem já é Gestor do setor
      * **Então** a operação é recusada com a explicação, sem converter o alcance em outro.
    * *Cenário 3 — Todas as unidades só pelo administrador global:*
      * **Dado** que sou Administrador da unidade
      * **Quando** tento conceder, alterar ou retirar o alcance "de todas as unidades"
      * **Então** a operação é recusada; só o Administrador global o faz, pessoa a pessoa.
    * *Cenário 4 — Não é acesso:*
      * **Dado** uma pessoa marcada como gestora
      * **Quando** ela tenta abrir arquivo sem permissão ou a gestão de pessoas
      * **Então** é recusada como antes; a marcação libera apenas o acompanhamento da leitura obrigatória, e ninguém marca a si mesmo.

* **US 12.2:** Como publicador, eu quero marcar um documento em vigor como leitura obrigatória, com público, prazo e mensagem, para que as pessoas certas leiam a revisão vigente.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Marcar:*
      * **Dado** que posso editar os dados de controle de um documento controlado, em vigor e que abre no visualizador
      * **Quando** escolho o público (toda a unidade, setores, perfis ou pessoas, combináveis), o prazo (padrão de 15 dias) e, se quiser, uma mensagem
      * **Então** vejo quantas pessoas serão incluídas antes de confirmar, e a marcação fica registrada para a revisão vigente, com quem marcou e quando.
    * *Cenário 2 — Documento não elegível:*
      * **Dado** um Arquivo geral, um arquivo pendente de cadastro, ou um documento em revisão, vencido, obsoleto ou sem pré-visualização
      * **Quando** tento marcá-lo
      * **Então** a marcação é recusada com o motivo.
    * *Cenário 3 — Público na unidade:*
      * **Dado** que o documento é da minha unidade
      * **Quando** defino o público
      * **Então** só entram pessoas ativas da unidade do documento; quem entrar depois no público recebe a leitura com 15 dias de prazo a partir de então.
    * *Cenário 4 — Nova revisão:*
      * **Dado** que a revisão anterior foi marcada e o documento foi substituído
      * **Quando** abro a leitura obrigatória do documento
      * **Então** o formulário vem preenchido com o público anterior, para eu pedir nova ciência da revisão vigente.

* **US 12.3:** Como leitor, eu quero ler o documento e confirmar a ciência no próprio visualizador para que fique registrado que li a revisão vigente.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Confirmar:*
      * **Dado** que tenho leitura obrigatória aberta de um documento
      * **Quando** o documento termina de abrir no visualizador e aciono "Confirmar ciência"
      * **Então** vejo "Declaro que li e compreendi o documento [código] - [título], Rev. [nº]." e, ao confirmar, a ciência fica registrada com data, hora, minha unidade e meu setor naquele momento; não pode ser desfeita.
    * *Cenário 2 — Visualizar sem outra permissão:*
      * **Dado** que sou do público de um documento de outra pessoa
      * **Quando** abro o documento
      * **Então** consigo visualizá-lo, mas não baixá-lo nem alterá-lo, e ele não aparece na navegação de pastas nem na busca.
    * *Cenário 3 — Atraso e encerramento:*
      * **Dado** uma leitura minha aberta
      * **Quando** o prazo passa, ou o documento ganha nova revisão, ou é declarado obsoleto
      * **Então** ela aparece como Atrasada e continua aberta, no primeiro caso; é encerrada, nos dois outros — sem depender de rotina.

* **US 12.4:** Como leitor, eu quero ver no menu, na tela inicial e numa lista própria as leituras obrigatórias que tenho a fazer para que eu não perca nenhum prazo.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Contador no menu:*
      * **Dado** que tenho leituras obrigatórias pendentes ou atrasadas
      * **Quando** olho o menu, em qualquer tela
      * **Então** o item "Leitura obrigatória" mostra quantas são; sem nenhuma em aberto, não mostra número.
    * *Cenário 2 — Pendentes e Concluídas:*
      * **Dado** que abro o item "Leitura obrigatória"
      * **Quando** percorro as abas
      * **Então** vejo em "Pendentes" as leituras em aberto, as atrasadas primeiro e sinalizadas, com documento, prazo e o botão "Ler e confirmar ciência", e em "Concluídas" as ciências que confirmei, com data e hora; a leitura encerrada não aparece em nenhuma das duas.
    * *Cenário 3 — Cartão na tela inicial:*
      * **Dado** que tenho leituras em aberto
      * **Quando** abro a tela inicial
      * **Então** o cartão "Leitura obrigatória" da coluna direita as lista com o prazo e o botão "Ler e confirmar ciência"; sem nenhuma, diz que não há leitura pendente.
    * *Cenário 4 — O atalho abre, não confirma:*
      * **Dado** uma leitura em aberto
      * **Quando** aciono "Ler e confirmar ciência"
      * **Então** o documento abre no visualizador, e a ciência só é confirmada pelo botão do rodapé, depois que o documento abre; confirmada, a leitura passa para "Concluídas" e o contador diminui.
    * *Cenário 5 — Ícone em Documentos:*
      * **Dado** um documento cuja revisão vigente é de leitura obrigatória
      * **Quando** abro a pasta dele
      * **Então** a linha do documento traz o ícone de leitura obrigatória; uma revisão nova ainda não marcada não traz.

* **US 12.5:** Como leitor e como gestor, eu quero ser avisado da leitura nova e do atraso para que nenhum prazo passe sem que alguém saiba.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Leitura nova:*
      * **Dado** que um documento foi marcado e eu sou do público, ou passei a ser depois
      * **Quando** a minha leitura é criada
      * **Então** recebo no sino um aviso com o documento e o prazo, uma vez só; se o aviso falhar, a marcação continua valendo e o aviso sai na rotina diária.
    * *Cenário 2 — Quem entra depois:*
      * **Dado** que fui admitido ou mudei para um setor do público de uma marcação em curso
      * **Quando** a rotina diária roda
      * **Então** passo a ter a leitura, com 15 dias de prazo, e o aviso — sem precisar abrir o sistema.
    * *Cenário 3 — Atraso ao leitor:*
      * **Dado** que o prazo da minha leitura passou sem ciência
      * **Quando** a rotina diária roda
      * **Então** recebo um aviso de atraso, uma vez por prazo, e a leitura continua aberta como Atrasada.
    * *Cenário 4 — Atraso ao gestor:*
      * **Dado** que sou gestor do setor ou da unidade de pessoas atrasadas
      * **Quando** a rotina diária roda
      * **Então** recebo um aviso por documento e prazo, com quantas estão atrasadas e os nomes e setores delas; gestor de outro setor, de outra unidade, e quem já confirmou não entram.

* **US 12.6:** Como publicador, gestor ou Governança, eu quero acompanhar quem leu cada documento e exportar o relatório para que a adesão seja cobrada e comprovada.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Números por documento:*
      * **Dado** que marquei um documento, ou sou gestor, ou acompanho todas as unidades
      * **Quando** abro a aba "Acompanhamento"
      * **Então** vejo, para cada documento ao meu alcance, o público, os confirmados, pendentes, atrasados e a % de adesão; pessoa desativada não conta.
    * *Cenário 2 — Três recortes:*
      * **Dado** o meu alcance
      * **Quando** consulto o acompanhamento
      * **Então** como publicador vejo o que marquei; como gestor do setor, só as pessoas do meu setor; como gestor da unidade, a unidade inteira; acompanhando todas as unidades, todas elas — e marcação fora do alcance é tratada como inexistente.
    * *Cenário 3 — Relatório nominal e exportação:*
      * **Dado** o relatório de um documento
      * **Quando** filtro por unidade, setor ou situação e exporto em Excel ou PDF
      * **Então** a lista e o arquivo trazem só as pessoas filtradas, com nome, unidade, setor, situação, prazo, data e hora da ciência, além do documento, da revisão, dos filtros e dos números.
    * *Cenário 4 — Sem abrir o documento:*
      * **Dado** que acompanho todas as unidades
      * **Quando** tento visualizar, baixar, auditar ou consultar o estado de leitura de um arquivo de outra unidade
      * **Então** sou recusado como se o arquivo não existisse; o acompanhamento mostra quem leu, nunca o documento.

## 5. Requisitos Funcionais

1. Autenticação por usuário e senha; contas criadas exclusivamente pela área administrativa, sem autocadastro.
2. Cadastro de pessoas com os campos: nome, unidade, telefone, e-mail, função/cargo, setor e observação; e-mail único por conta. O **setor** é escolhido de uma lista fechada cadastrada por unidade — não é texto livre —, porque passa a servir de critério de público e de recorte de relatório; é opcional, e a administração da unidade mantém a lista.
3. Alteração da própria senha em "Minha conta", mediante confirmação da senha atual e respeitando o tamanho mínimo exigido; a alteração encerra os demais acessos abertos da pessoa. Os dados cadastrais aparecem em "Minha conta" apenas para consulta.
4. Redefinição administrativa de senha, com senha gerada pelo sistema e exibida uma única vez, encerrando de imediato os acessos abertos da pessoa: o Administrador de Unidade redefine a senha de Colaboradores da própria unidade; o Administrador Global, a de Colaboradores e Administradores de Unidade. A senha de um Administrador Global só é alterada por ele mesmo.
5. Três níveis de papel: Administrador Global, Administrador de Unidade e Colaborador, com alcance de visibilidade correspondente.
6. Isolamento total de conteúdo entre unidades: nenhuma pessoa acessa arquivos de unidade diferente da sua, por navegação, busca ou link direto — salvo compartilhamento entre unidades vigente (RF 28).
7. Estrutura de pastas aninhadas com trilha de navegação; envio, download e visualização de itens conforme permissão.
8. Envio de múltiplos arquivos com progresso individual e tratamento independente de falhas; envio de pasta preservando a hierarquia; download de pasta completa em arquivo compactado, restrito aos itens permitidos.
9. Permissões concedidas por pasta ou por arquivos selecionados, cobrindo visualizar, baixar, enviar, renomear/substituir e excluir, sem herança automática para o conteúdo interno de pastas.
10. Prazo de expiração opcional por permissão: aviso prévio à pessoa, encerramento automático do acesso no vencimento e aviso à área administrativa no momento do corte.
11. Ao enviar um arquivo, o remetente torna-se seu dono e recebe direito de consultar a auditoria daquele arquivo.
12. Controle de acesso ativo em toda a aplicação, incluindo bloqueio de acesso a arquivo por link direto sem permissão, sem expor pré-visualização.
13. Registro de auditoria de visualização e download, contendo pessoa, ação, data e hora; consultável por administradores (dentro do seu alcance) e pelo dono do arquivo sobre seus próprios arquivos.
14. Lixeira com retenção de 30 dias, restauração ao local de origem com permissões preservadas e expurgo permanente automático por rotina diária às 3h.
15. Cota de 10 GB por pessoa como padrão, com bloqueio de novos envios ao atingir o limite e aviso correspondente; cota individual por exceção nominal, concedida apenas pelo Administrador Global (adendo da US 8.1).
16. Painel gerencial com cartões de estatísticas e gráficos de arquivos por tipo, envios por mês e espaço utilizado versus disponível, respeitando o alcance do administrador.
17. Busca por nome e filtros combináveis por data, tipo de arquivo e autor, com botão para limpar filtros, sempre limitados aos itens permitidos.
18. Visualização sem download de PDFs, imagens, vídeos, áudios, arquivos de texto e documentos de escritório (Word, Excel, PowerPoint); mensagem clara quando não houver pré-visualização.
19. Classificação de documento por tipo, entre os tipos previstos, apresentada na listagem como sigla acompanhada de cor; a sigla é sempre legível por si só, sem que a cor seja a única portadora da informação.
20. Código de documento único por unidade, utilizável como critério de busca; o mesmo código em unidades distintas não conflita e nunca revela conteúdo de outra unidade.
21. Revisão vigente, setor responsável e data de próxima revisão registrados por documento e apresentados na listagem.
22. Situação do documento apurada no momento da consulta, pelo relógio do servidor, a partir da data de próxima revisão e do estado declarado, sem depender de rotina programada: Vigente, A vencer (dentro de 60 dias), Em revisão, Revisão vencida, Obsoleto ou Sem controle de revisão.
23. Dados de controle exigidos no envio de um documento e dispensados no envio em lote ou de pasta; o acervo anterior permanece acessível com situação Sem controle de revisão, sem invalidação.
24. Substituição de arquivo avança a revisão do documento, preservando código, tipo e responsável; versões anteriores continuam indisponíveis para consulta, conforme o escopo do MVP.
25. Documento marcado como obsoleto deixa de ser apresentado a Colaboradores por navegação, busca ou link direto, permanecendo visível a perfis de gestão da própria unidade e nunca atravessando o isolamento entre unidades.
26. Tela inicial com identificação da pessoa, atalhos filtrados pelo perfil, acesso rápido às pastas de primeiro nível permitidas e lista de documentos alterados recentemente, restrita às permissões da pessoa e à sua unidade.
27. Destino próprio, disponível a qualquer perfil, reunindo as pastas e os arquivos sobre os quais a pessoa tem permissão vigente recebida de outra pessoa, com os verbos e o prazo de cada um, a pasta que contém o item e a data do compartilhamento; a lista respeita todas as regras de visibilidade já vigentes e não amplia alcance.
28. Compartilhamento somente leitura (visualizar e baixar) de pasta ou documento entre a unidade marcada como SEDE (no máximo uma) e as demais unidades, sempre com a SEDE numa das pontas, concedido pelo Administrador Global ou pelo Administrador da unidade dona do conteúdo, a uma pessoa ou a uma unidade inteira, com prazo opcional e revogação; a pasta compartilhada alcança todo o seu conteúdo, inclusive o que entrar depois; obsoletos, pendentes de cadastro e itens na lixeira continuam de fora; o acesso é auditado na unidade de origem; a concessão comum a pessoa de outra unidade é recusada.

## 6. Requisitos Não Funcionais

* **Segurança e Confidencialidade:** o acesso à informação é sempre validado no servidor a cada ação (visualizar, baixar, enviar, alterar, excluir), independentemente da interface; links diretos nunca contornam a verificação de permissão. Senhas são armazenadas de forma protegida e nunca exibidas — a única exceção é a senha gerada em uma redefinição administrativa, apresentada uma única vez a quem a solicitou e não recuperável depois. Alterar ou redefinir uma senha encerra os acessos já abertos daquela pessoa.
* **Privacidade entre unidades:** o isolamento por unidade é um requisito de confidencialidade — em nenhuma hipótese o conteúdo de uma unidade fica visível a outra, salvo compartilhamento explícito, somente leitura, envolvendo a SEDE (US 5.2).
* **Desempenho e escala:** o sistema deve suportar arquivos grandes (sem limite de tamanho por arquivo definido), incluindo vídeos, com envio e download estáveis; a navegação em pastas com muitos itens deve permanecer fluida.
* **Confiabilidade da retenção e da auditoria:** os registros de auditoria e o controle da lixeira devem ser confiáveis e resistentes a perda; a rotina diária de expurgo às 3h deve executar de forma consistente.
* **Usabilidade:** interface limpa e premium, com navegação familiar no estilo explorador de arquivos, feedback claro de progresso de envio e mensagens compreensíveis de erro e de permissão insuficiente.
* **Ambiente:** a solução opera em ambiente de nuvem já definido pelo cliente, com o armazenamento dos arquivos em nuvem; decisões de arquitetura e componentes específicos serão detalhadas na fase de arquitetura, fora deste documento.

## 7. Métricas de Sucesso

* **Governança comprovável:** 100% dos acessos de visualização e download registrados na auditoria; zero incidentes de acesso a arquivo sem permissão (inclusive por link direto) nos testes de segurança de lançamento.
* **Adoção:** percentual de colaboradores ativos por semana e volume de arquivos sob gestão crescendo mês a mês nos primeiros 90 dias.
* **Eficiência operacional:** redução do tempo médio para localizar um arquivo (com busca e filtros) e para liberar um acesso, comparado ao processo atual do cliente.
* **Confiabilidade da retenção:** 100% dos itens vencidos na lixeira expurgados pela rotina diária e zero perdas indevidas de itens dentro do prazo de 30 dias.
* **Controle de espaço:** cota efetiva de cada pessoa (padrão de 10 GB ou exceção nominal) respeitada em 100% dos casos, sem envios além do limite.
* **Satisfação:** avaliação positiva das personas administrativas quanto à clareza do painel gerencial e ao controle de permissões após o primeiro mês de uso.
