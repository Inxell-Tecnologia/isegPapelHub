# Product Requirements Document (PRD) — GDoc (Gestão Documental Segura)

## 1. Visão Geral e Problema

A organização do cliente é composta por múltiplas unidades e precisa centralizar o armazenamento de arquivos num único repositório em nuvem, porém sem abrir mão do **controle e da rastreabilidade do acesso à informação**. Hoje o desafio não é apenas "guardar arquivos", mas garantir governança: assegurar que cada pessoa só visualize, baixe, altere ou exclua exatamente aquilo que lhe foi autorizado, impedir vazamento por acesso indevido (inclusive por link direto), manter um histórico confiável de quem acessou cada arquivo e oferecer aos gestores visibilidade sobre o uso do espaço.

O **objetivo principal** do GDoc é entregar um repositório de arquivos corporativo, com aparência limpa e premium, cujo núcleo de valor é um motor de permissões granular e auditável, com isolamento entre unidades, lixeira com retenção e um painel gerencial de uso.

## 2. Personas

* **Administrador Global:** responsável pela plataforma como um todo. Enxerga todas as unidades e todos os arquivos, cadastra e desativa pessoas, define administradores de unidade, configura permissões e consome os registros de auditoria e o painel gerencial. Sua dor é a falta de controle centralizado e de comprovação de quem acessou o quê.
* **Administrador de Unidade:** gerencia apenas a sua própria unidade — as pessoas, as pastas e as permissões daquela unidade. Não enxerga o conteúdo das demais unidades. Sua dor é depender de uma área central para tarefas cotidianas de liberação de acesso do seu time.
* **Colaborador (Usuário Comum):** envia e consome arquivos no dia a dia. Só enxerga os arquivos e pastas que criou ou para os quais recebeu permissão explícita. Quando envia um arquivo, torna-se o dono dele e pode consultar quem o acessou. Sua dor é encontrar rapidamente o material certo e ter certeza de que documentos sensíveis não estão expostos a quem não deveria vê-los.

## 3. Escopo do MVP

* **Dentro do Escopo:**
  * Login por usuário e senha, com contas criadas exclusivamente pela área administrativa.
  * Área "Minha conta", com consulta aos próprios dados cadastrais e alteração da própria senha; redefinição administrativa de senha para quem esquecer a sua.
  * Cadastro de pessoas com os dados: nome, unidade, telefone, e-mail, função/cargo, área de trabalho e observação.
  * Isolamento por unidade: cada unidade só enxerga os próprios arquivos; existe o papel de administrador de unidade.
  * Navegador de arquivos com pastas aninhadas, trilha de navegação (breadcrumb), envio, download e visualização.
  * Envio de múltiplos arquivos de uma vez com progresso individual; envio de uma pasta inteira preservando a estrutura; download de uma pasta completa (com suas subpastas) num único arquivo compactado.
  * Permissões granulares (visualizar, baixar, enviar, renomear/substituir, excluir) atribuídas por pasta ou por arquivos selecionados, sem herança automática para o conteúdo interno, com prazo de expiração opcional.
  * Controle de acesso ativo: colaboradores só veem o que criaram ou o que lhes foi liberado; administradores enxergam conforme seu alcance (global ou de unidade). Bloqueio de acesso a um arquivo por link direto quando não há permissão.
  * Avisos relacionados à expiração de permissão: alerta à pessoa antes do vencimento e aviso à área administrativa no momento do corte de acesso.
  * Registro de auditoria de visualização e download (quem, qual arquivo, data e hora), consultável pela área administrativa e pelo dono do arquivo sobre seus próprios arquivos.
  * Lixeira: itens excluídos são retidos por até 30 dias, podem ser restaurados nesse período e são apagados de forma permanente e automática após o vencimento, por uma rotina diária executada às 3h.
  * Cota de armazenamento de 10 GB por pessoa, com bloqueio de novos envios ao atingir o limite.
  * Painel (dashboard) com cartões de estatísticas principais e gráficos de quantidade de arquivos por tipo, envios por mês e espaço utilizado versus disponível, acessível pelo menu lateral.
  * Busca por nome e filtros por data, tipo de arquivo (imagens, vídeos, áudios, PDFs, entre outros) e autor na página de arquivos, com botão para limpar filtros.
  * Visualização, sem necessidade de baixar, de PDFs, imagens, vídeos, áudios, arquivos de texto e documentos de escritório (Word, Excel, PowerPoint).

* **Fora de Escopo (nesta versão):**
  * Login por conta Google ou integração com o login corporativo existente (o MVP usa usuário e senha próprios).
  * Autocadastro de pessoas ou convite por e-mail (contas são criadas apenas pela administração).
  * Recuperação de senha por e-mail ("esqueci minha senha" com link enviado à pessoa) — o MVP não envia e-mails, e por isso o esquecimento é resolvido por redefinição administrativa.
  * Edição do conteúdo dos documentos por dentro do sistema (a permissão de "editar" cobre apenas renomear e substituir o arquivo por uma nova versão).
  * Histórico de versões navegável de um arquivo (substituir troca o arquivo vigente; versões anteriores não ficam disponíveis para consulta).
  * Compartilhamento de arquivos entre unidades diferentes.
  * Notificações fora do contexto de expiração de permissão (ex.: aviso a cada novo compartilhamento recebido).

## 4. Histórias de Usuário e Critérios de Aceitação

### Épico 1: Acesso e Gestão de Pessoas

* **US 1.1:** Como Administrador, eu quero cadastrar uma pessoa com seus dados e sua unidade para que ela possa acessar o sistema.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Cadastro válido:*
      * **Dado** que sou um administrador autenticado
      * **Quando** cadastro uma pessoa informando nome, unidade, telefone, e-mail, função/cargo, área de trabalho e observação, com um e-mail ainda não utilizado
      * **Então** a conta é criada, vinculada à unidade informada, e a pessoa passa a poder fazer login com as credenciais definidas.
    * *Cenário 2 — E-mail duplicado:*
      * **Dado** que já existe uma conta com o e-mail informado
      * **Quando** tento cadastrar outra pessoa com o mesmo e-mail
      * **Então** o cadastro é recusado e o sistema exibe uma mensagem indicando que o e-mail já está em uso.

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

### Épico 3: Envio e Download em Lote

* **US 3.1:** Como Colaborador, eu quero enviar vários arquivos de uma vez e acompanhar o progresso de cada um para que eu saiba o que já concluiu.
  * **Critérios de Aceitação:**
    * *Cenário 1 — Progresso individual:*
      * **Dado** que selecionei vários arquivos para envio
      * **Quando** inicio o envio
      * **Então** cada arquivo exibe seu próprio progresso e um indica sucesso ou falha ao final, de forma independente dos demais.
    * *Cenário 2 — Falha parcial:*
      * **Dado** que um dos arquivos falha durante o envio
      * **Quando** os demais concluem
      * **Então** os que concluíram permanecem salvos e o que falhou é sinalizado, permitindo nova tentativa apenas dele.

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
      * **Então** nunca vejo arquivos pertencentes a outra unidade, mesmo por busca ou link direto.

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

## 5. Requisitos Funcionais

1. Autenticação por usuário e senha; contas criadas exclusivamente pela área administrativa, sem autocadastro.
2. Cadastro de pessoas com os campos: nome, unidade, telefone, e-mail, função/cargo, área de trabalho e observação; e-mail único por conta.
3. Alteração da própria senha em "Minha conta", mediante confirmação da senha atual e respeitando o tamanho mínimo exigido; a alteração encerra os demais acessos abertos da pessoa. Os dados cadastrais aparecem em "Minha conta" apenas para consulta.
4. Redefinição administrativa de senha, com senha gerada pelo sistema e exibida uma única vez, encerrando de imediato os acessos abertos da pessoa: o Administrador de Unidade redefine a senha de Colaboradores da própria unidade; o Administrador Global, a de Colaboradores e Administradores de Unidade. A senha de um Administrador Global só é alterada por ele mesmo.
5. Três níveis de papel: Administrador Global, Administrador de Unidade e Colaborador, com alcance de visibilidade correspondente.
6. Isolamento total de conteúdo entre unidades: nenhuma pessoa acessa arquivos de unidade diferente da sua, por navegação, busca ou link direto.
7. Estrutura de pastas aninhadas com trilha de navegação; envio, download e visualização de itens conforme permissão.
8. Envio de múltiplos arquivos com progresso individual e tratamento independente de falhas; envio de pasta preservando a hierarquia; download de pasta completa em arquivo compactado, restrito aos itens permitidos.
9. Permissões concedidas por pasta ou por arquivos selecionados, cobrindo visualizar, baixar, enviar, renomear/substituir e excluir, sem herança automática para o conteúdo interno de pastas.
10. Prazo de expiração opcional por permissão: aviso prévio à pessoa, encerramento automático do acesso no vencimento e aviso à área administrativa no momento do corte.
11. Ao enviar um arquivo, o remetente torna-se seu dono e recebe direito de consultar a auditoria daquele arquivo.
12. Controle de acesso ativo em toda a aplicação, incluindo bloqueio de acesso a arquivo por link direto sem permissão, sem expor pré-visualização.
13. Registro de auditoria de visualização e download, contendo pessoa, ação, data e hora; consultável por administradores (dentro do seu alcance) e pelo dono do arquivo sobre seus próprios arquivos.
14. Lixeira com retenção de 30 dias, restauração ao local de origem com permissões preservadas e expurgo permanente automático por rotina diária às 3h.
15. Cota de 10 GB por pessoa, com bloqueio de novos envios ao atingir o limite e aviso correspondente.
16. Painel gerencial com cartões de estatísticas e gráficos de arquivos por tipo, envios por mês e espaço utilizado versus disponível, respeitando o alcance do administrador.
17. Busca por nome e filtros combináveis por data, tipo de arquivo e autor, com botão para limpar filtros, sempre limitados aos itens permitidos.
18. Visualização sem download de PDFs, imagens, vídeos, áudios, arquivos de texto e documentos de escritório (Word, Excel, PowerPoint); mensagem clara quando não houver pré-visualização.

## 6. Requisitos Não Funcionais

* **Segurança e Confidencialidade:** o acesso à informação é sempre validado no servidor a cada ação (visualizar, baixar, enviar, alterar, excluir), independentemente da interface; links diretos nunca contornam a verificação de permissão. Senhas são armazenadas de forma protegida e nunca exibidas — a única exceção é a senha gerada em uma redefinição administrativa, apresentada uma única vez a quem a solicitou e não recuperável depois. Alterar ou redefinir uma senha encerra os acessos já abertos daquela pessoa.
* **Privacidade entre unidades:** o isolamento por unidade é um requisito de confidencialidade — em nenhuma hipótese o conteúdo de uma unidade fica visível a outra.
* **Desempenho e escala:** o sistema deve suportar arquivos grandes (sem limite de tamanho por arquivo definido), incluindo vídeos, com envio e download estáveis; a navegação em pastas com muitos itens deve permanecer fluida.
* **Confiabilidade da retenção e da auditoria:** os registros de auditoria e o controle da lixeira devem ser confiáveis e resistentes a perda; a rotina diária de expurgo às 3h deve executar de forma consistente.
* **Usabilidade:** interface limpa e premium, com navegação familiar no estilo explorador de arquivos, feedback claro de progresso de envio e mensagens compreensíveis de erro e de permissão insuficiente.
* **Ambiente:** a solução opera em ambiente de nuvem já definido pelo cliente, com o armazenamento dos arquivos em nuvem; decisões de arquitetura e componentes específicos serão detalhadas na fase de arquitetura, fora deste documento.

## 7. Métricas de Sucesso

* **Governança comprovável:** 100% dos acessos de visualização e download registrados na auditoria; zero incidentes de acesso a arquivo sem permissão (inclusive por link direto) nos testes de segurança de lançamento.
* **Adoção:** percentual de colaboradores ativos por semana e volume de arquivos sob gestão crescendo mês a mês nos primeiros 90 dias.
* **Eficiência operacional:** redução do tempo médio para localizar um arquivo (com busca e filtros) e para liberar um acesso, comparado ao processo atual do cliente.
* **Confiabilidade da retenção:** 100% dos itens vencidos na lixeira expurgados pela rotina diária e zero perdas indevidas de itens dentro do prazo de 30 dias.
* **Controle de espaço:** cota de 10 GB por pessoa respeitada em 100% dos casos, sem envios além do limite.
* **Satisfação:** avaliação positiva das personas administrativas quanto à clareza do painel gerencial e ao controle de permissões após o primeiro mês de uso.
