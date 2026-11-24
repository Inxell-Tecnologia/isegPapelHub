# Controle documental

O PapelHub não guarda só arquivos: guarda **documentos controlados**. Cada documento
pode carregar, além do nome, cinco dados de controle — e é a partir deles que a
listagem diz, de relance, se o documento ainda vale.

## O que cada dado significa

| Dado | Para que serve |
| --- | --- |
| **Tipo** | Classifica o documento entre os dez tipos previstos. Aparece na listagem como uma **sigla** colorida ao lado do nome (por exemplo `PRT` para Protocolo). A cor acompanha a sigla; a informação é a sigla. |
| **Código** | Identificador do documento dentro da sua unidade (por exemplo `PRT-NSP-001`). Serve para citar e para **encontrar**: a busca por nome também procura pelo código. |
| **Revisão** | Número da versão vigente, apresentado como `Rev. 02`. |
| **Setor responsável** | Quem responde pelo documento — a quem procurar para falar dele. |
| **Próxima revisão** | A data em que o documento precisa ser revisto. É dela que nasce a situação. |

Os dez tipos e suas siglas: **PRT** Protocolo, **POP** Procedimento, **POL**
Política/Norma, **FOR** Formulário, **CHK** Checklist, **FLX** Fluxograma, **MAN**
Manual, **TC** Termo de Consentimento, **COM** Comunicado Interno e **ARQ** Arquivo
geral.

Formulário e Checklist eram, antes, um tipo só. Os checklists cadastrados naquela
época continuam aparecendo como **FOR**: o sistema não tem como saber quais deles são
checklists. Para corrigir, use a ação **Dados de controle** do documento (ver
[Preencher ou corrigir os dados depois](#preencher-ou-corrigir-os-dados-depois)) e
escolha o tipo **CHK — Checklist**.

### Arquivo geral: o que não é documento da Matriz

Nem tudo que você guarda é documento controlado. Uma ata de reunião, uma planilha de
trabalho, uma apresentação — nada disso tem código nem revisão, e forçá-los a ter
seria inventar um dado.

Para esses casos existe o tipo **Arquivo geral**. Ele pede **só o título**:

- não tem código, revisão nem data de próxima revisão — e informar qualquer um dos
  três é recusado, porque o tipo declara justamente não os ter;
- não tem situação de revisão: a coluna **Situação** fica vazia, e não "Sem controle
  de revisão";
- não entra nas contagens de documentos a vencer ou vencidos.

É diferente de um arquivo cujos dados você ainda não preencheu. **Arquivo geral** é a
afirmação de que aquele arquivo nunca terá código; um arquivo sem dados é uma
pendência a resolver.

## A situação de um documento

A coluna **Situação** é calculada **pelo servidor, no momento em que você consulta** —
nunca por uma rotina que roda de madrugada. Não existe intervalo em que a tela afirme
"Vigente" sobre um documento que já venceu: a virada do prazo vale na consulta
seguinte.

| Situação | Quando aparece |
| --- | --- |
| **Vigente** | A próxima revisão está a mais de 60 dias. |
| **Vence em N dias** | A próxima revisão ocorre dentro dos próximos 60 dias, e a tela diz em quantos dias. |
| **Em revisão** | Alguém declarou que o documento está sendo reescrito. Prevalece sobre a data. |
| **Revisão vencida** | A data da próxima revisão já passou. |
| **Obsoleto** | O documento foi declarado fora de uso. Prevalece sobre a data. |
| **Sem controle de revisão** | O documento não tem data de próxima revisão informada. Não é contado entre os documentos a vencer nem entre os vencidos. |

| **Pendente de cadastro** | O arquivo foi enviado sem os dados obrigatórios e ainda não foi publicado. Fica fora de circulação até ser cadastrado. |

!!! note "Sem controle de revisão não é erro"
    Todo o acervo que já existia antes do controle documental fica nesta situação.
    Esses arquivos continuam plenamente acessíveis, com as mesmas permissões de
    sempre — eles apenas não têm prazo de revisão a cobrar. Quando quiser, preencha os
    dados depois (abaixo).

### Pendente de cadastro

Quando você envia vários arquivos e deixa alguma linha da tabela de cadastro sem os
dados obrigatórios, aquele arquivo **não** é recusado: é aceito e fica **Pendente de
cadastro**. Nesse estado:

- o arquivo fica na pasta, mas **não aparece para os outros leitores nem na busca** —
  mesmo para quem tem permissão sobre ele;
- quem o enviou e os administradores da unidade continuam enxergando-o, com a etiqueta
  **Pendente de cadastro**;
- quem o enviou recebe um **aviso no sino**, um por arquivo, dizendo qual completar;
- ao completar os dados, o arquivo passa a circular normalmente, com as permissões
  que já estavam concedidas.

A ideia é simples: nada é publicado sem identificação, mas nada é perdido por falta
dela. Você termina o envio e cadastra depois, no seu tempo.

## Quando os dados são exigidos

Nenhum documento é publicado sem os dados obrigatórios — **enviado sozinho ou em
lote**. Cada arquivo tem os seus próprios dados.

- **Enviando um único arquivo** (não vindo de pasta): o PapelHub pede **tipo, código,
  revisão, setor responsável e data de próxima revisão** antes de publicar. Sem eles o
  envio é recusado, e a tela diz exatamente quais dados faltam.
- **Enviando vários arquivos, ou uma pasta**: o PapelHub abre uma **tabela de cadastro
  com uma linha por arquivo**, e os dados valem **por arquivo** (ver
  [Enviar arquivos](enviar.md#a-tabela-de-cadastro-no-envio-de-varios-arquivos)). O que
  vier completo é publicado; o que vier sem algum dado obrigatório é aceito e fica
  **Pendente de cadastro** (acima), à espera de ser completado.
- **Arquivo geral**: pede só o título, em qualquer um dos dois casos.

Um dado **inválido** é diferente de um dado **ausente**: tipo fora da lista ou data
impossível fazem o arquivo ser recusado, com o aviso do problema. Dado ausente nunca
recusa — só deixa o arquivo pendente.

O código precisa ser **único na sua unidade**. Se já existir outro documento ativo com
aquele código, a publicação é recusada com um aviso específico de **código em uso** —
diferente do aviso de dado faltante e do aviso de permissão. O mesmo código pode
existir em outra unidade sem conflito algum.

## Preencher ou corrigir os dados depois

Na listagem, a ação **Dados de controle** de cada documento abre o formulário de
edição. Ela aparece apenas para quem pode **alterar** aquele documento — o dono dele, a
administração da unidade, ou quem recebeu a permissão **Renomear** sobre ele (ver
[Permissões](../administrador/permissoes.md)). Quem não pode não vê a ação: o sistema
não oferece o que recusaria em seguida.

Alterar esses dados:

- **não** troca o arquivo enviado e **não** avança a revisão por si só;
- **reapura a situação** na hora, a partir da nova data;
- permite declarar a situação como **Vigente**, **Em revisão** ou **Obsoleto**.

!!! note "Não há histórico de versões"
    O PapelHub mantém apenas a **versão vigente** de cada documento. A revisão é um
    número que avança; versões anteriores não ficam disponíveis para consulta.

## Documento obsoleto sai de circulação

Um documento declarado **Obsoleto** deixa de aparecer para quem não é administrador da
unidade: não aparece na listagem da pasta, não é encontrado pela busca (nem pelo nome,
nem pelo código), não entra no download da pasta e não abre por link direto — nem para
o próprio dono, se ele não for administrador da unidade. É assim por desenho: ninguém
deve seguir um procedimento substituído.

Para a **administração da unidade**, o documento continua visível, claramente marcado
como **Obsoleto**, e pode ser reativado pela ação **Dados de controle**. A
obsolescência não atravessa unidades: um administrador alcança apenas os documentos da
própria unidade, como em todo o resto do sistema.

!!! warning "Código de documento excluído e restauração"
    O código de um documento na **lixeira** fica livre para ser reusado. Se outro
    documento tomar aquele código e você tentar **restaurar** o original, a restauração
    é recusada com um aviso que diz **qual documento** ocupa o código — mude o código
    do ocupante (ou do documento restaurado, depois) para resolver.
